import cron from "node-cron";
import mongoose from "mongoose";
import User from "../models/user.model.js";
import logger from "./logger.js";

// Error types for better handling
const ErrorTypes = {
  TRANSIENT: "TRANSIENT",
  VALIDATION: "VALIDATION",
  BUSINESS: "BUSINESS",
  FATAL: "FATAL",
};

class SchedulerError extends Error {
  constructor(message, type, code, retryable = false) {
    super(message);
    this.name = "SchedulerError";
    this.type = type;
    this.code = code;
    this.retryable = retryable;
    this.timestamp = new Date().toISOString();
  }
}

// Error classification function
const classifyError = (error) => {
  if (error.code === 112 || error.codeName === "WriteConflict") {
    return new SchedulerError(
      error.message,
      ErrorTypes.TRANSIENT,
      error.code,
      true
    );
  }

  if (error.code === 11000) {
    return new SchedulerError(
      "Duplicate key error",
      ErrorTypes.VALIDATION,
      error.code,
      false
    );
  }

  if (error.name === "ValidationError") {
    return new SchedulerError(
      `Validation error: ${error.message}`,
      ErrorTypes.VALIDATION,
      "VALIDATION_ERROR",
      false
    );
  }

  if (error.name === "CastError") {
    return new SchedulerError(
      `Invalid data format: ${error.message}`,
      ErrorTypes.VALIDATION,
      "CAST_ERROR",
      false
    );
  }

  if (
    error.message.includes("No participants") ||
    error.message.includes("No problem statements") ||
    error.message.includes("Not enough participants") ||
    error.message.includes("ProFillerathon already started")
  ) {
    return new SchedulerError(
      error.message,
      ErrorTypes.BUSINESS,
      "BUSINESS_RULE",
      false
    );
  }

  return new SchedulerError(
    error.message,
    ErrorTypes.FATAL,
    "UNKNOWN_ERROR",
    false
  );
};

// Retry mechanism with exponential backoff
const retryOperation = async (operation, maxRetries = 3, baseDelay = 500) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = classifyError(error);

      if (!lastError.retryable || attempt === maxRetries) {
        throw lastError;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      logger.warn(`Attempt ${attempt} failed. Retrying in ${delay}ms...`, {
        error: lastError.message,
        type: lastError.type,
        code: lastError.code,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

// Function to cancel ProFillerathon and cleanup (standalone function with its own session)
const cancelProFillerathon = async (ProFillerathon, reason = "Technical issues", io) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const { _id, title, participants } = ProFillerathon;

    logger.info(`Cancelling ProFillerathon: ${title}`, {
      ProFillerathonId: _id,
      reason,
      participantCount: participants?.length || 0,
    });

    // Update ProFillerathon status to cancelled
    await ProFillerathon.findByIdAndUpdate(
      _id,
      {
        $set: {
          status: "cancelled",
          isActive: false,
          reason: reason,
        },
      },
      { session }
    );

    // Clear currentProFillerathonId for all participants
    if (participants && participants.length > 0) {
      const userUpdatePromises = participants.map((participantId) =>
        User.findByIdAndUpdate(
          participantId,
          {
            $unset: { currentProFillerathonId: null },
          },
          { session }
        )
      );

      await Promise.all(userUpdatePromises);
      logger.info(
        `Cleared currentProFillerathonId for ${participants.length} participants`
      );
    }

    // Delete any teams that were created for this ProFillerathon
    const teamsDeleted = await Team.deleteMany(
      { ProFillerathonId: _id },
      { session }
    );

    // Delete team members associated with those teams
    if (teamsDeleted.deletedCount > 0) {
      const teamIds = (
        await Team.find({ ProFillerathonId: _id }).session(session)
      ).map((team) => team._id);
      await TeamMember.deleteMany({ teamId: { $in: teamIds } }, { session });
      logger.info(
        `Deleted ${teamsDeleted.deletedCount} teams and their members`
      );
    }

    await session.commitTransaction();

    logger.info(`Successfully cancelled ProFillerathon: ${title}`, {
      ProFillerathonId: _id,
      participantsCleared: participants?.length || 0,
      teamsDeleted: teamsDeleted.deletedCount || 0,
    });

    // Notify clients about ProFillerathon cancellation
    if (io) {
      io.to(_id.toString()).emit("ProFillerathon-cancelled", {
        ProFillerathonId: _id,
        ProFillerathonTitle: title,
        reason: reason,
        cancelledAt: new Date().toISOString(),
      });
    }

    return {
      success: true,
      ProFillerathonId: _id,
      ProFillerathonTitle: title,
      participantsCleared: participants?.length || 0,
      teamsDeleted: teamsDeleted.deletedCount || 0,
      reason: reason,
    };
  } catch (error) {
    await session.abortTransaction();
    logger.error(`Failed to cancel ProFillerathon ${ProFillerathon.title}:`, error);
    throw error;
  } finally {
    session.endSession();
  }
};

// Team creation logic with proper transaction handling and cancellation on failure
const createTeamsForProFillerathon = async (ProFillerathon, io) => {
  const session = await mongoose.startSession();
  let transactionCommitted = false;

  try {
    await session.startTransaction();

    const {
      participants,
      maxTeamSize,
      problemStatements,
      minParticipantsToFormTeam,
      _id,
      title,
    } = ProFillerathon;

    // Validation checks - throw errors instead of calling cancelProFillerathon here
    if (!participants || participants.length === 0) {
      const errorMsg = `No participants for ProFillerathon: ${title}`;
      logger.warn(errorMsg);
      throw new SchedulerError(
        errorMsg,
        ErrorTypes.BUSINESS,
        "NO_PARTICIPANTS",
        false
      );
    }

    if (!problemStatements || problemStatements.length === 0) {
      const errorMsg = `No problem statements for ProFillerathon: ${title}`;
      logger.warn(errorMsg);
      throw new SchedulerError(
        errorMsg,
        ErrorTypes.BUSINESS,
        "NO_PROBLEM_STATEMENTS",
        false
      );
    }

    if (participants.length < minParticipantsToFormTeam) {
      const errorMsg = `Not enough participants to form teams. Need at least ${minParticipantsToFormTeam}, have ${participants.length}`;
      logger.warn(errorMsg);
      throw new SchedulerError(
        errorMsg,
        ErrorTypes.BUSINESS,
        "INSUFFICIENT_PARTICIPANTS",
        false
      );
    }

    // Check if ProFillerathon has already started
    const now = new Date();
    if (ProFillerathon.startDate <= now) {
      const errorMsg = `ProFillerathon ${title} has already started. Cannot form teams.`;
      logger.error(errorMsg);
      throw new SchedulerError(
        errorMsg,
        ErrorTypes.BUSINESS,
        "ProFillerATHON_STARTED",
        false
      );
    }

    // Calculate optimal team distribution
    const totalParticipants = participants.length;
    const optimalTeamCount = Math.ceil(totalParticipants / maxTeamSize);
    const baseTeamSize = Math.floor(totalParticipants / optimalTeamCount);
    const remainder = totalParticipants % optimalTeamCount;

    logger.info(`Creating teams for ProFillerathon: ${title}`, {
      totalParticipants,
      optimalTeamCount,
      baseTeamSize,
      remainder,
      minParticipantsToFormTeam,
      maxTeamSize,
    });

    // Shuffle participants randomly
    const shuffledParticipants = [...participants];
    for (let i = shuffledParticipants.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledParticipants[i], shuffledParticipants[j]] = [
        shuffledParticipants[j],
        shuffledParticipants[i],
      ];
    }

    const createdTeams = [];
    const emailPromises = [];
    let participantIndex = 0;

    // Create teams with optimal distribution
    for (let teamIndex = 0; teamIndex < optimalTeamCount; teamIndex++) {
      const currentTeamSize =
        teamIndex < remainder ? baseTeamSize + 1 : baseTeamSize;

      if (participantIndex >= shuffledParticipants.length) break;

      const teamMembers = shuffledParticipants.slice(
        participantIndex,
        participantIndex + currentTeamSize
      );
      participantIndex += currentTeamSize;

      // Pick random problem statement
      const randomProblemIndex = Math.floor(
        Math.random() * problemStatements.length
      );
      const randomProblem = problemStatements[randomProblemIndex];

      // Generate unique team name
      const teamName = `Team-${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`;

      // Create team document
      const team = await Team.create(
        [
          {
            ProFillerathonId: _id,
            name: teamName,
            problemStatement: randomProblem,
            submissionStatus: "not_submitted",
            teamSize: currentTeamSize,
            teamMember: teamMembers,
          },
        ],
        { session }
      );

      // Create team members and update users
      const teamMemberPromises = teamMembers.map((memberId, index) => {
        const role = index === 0 ? "leader" : "developer";
        return TeamMember.create(
          [
            {
              teamId: team[0]._id,
              userId: memberId,
              role: role,
              status: "active",
            },
          ],
          { session }
        );
      });

      // Update users' current ProFillerathon
      const userUpdatePromises = teamMembers.map((memberId) =>
        User.findByIdAndUpdate(
          memberId,
          { currentProFillerathonId: _id },
          { session }
        )
      );

      await Promise.all([...teamMemberPromises, ...userUpdatePromises]);

      // Populate team details
      const populatedTeam = await Team.findById(team[0]._id)
        .populate({
          path: "teamMember",
          select: "id name email skills",
        })
        .populate({
          path: "members",
          populate: {
            path: "userId",
            select: "id name email skills",
          },
        })
        .session(session);

      createdTeams.push(populatedTeam);

      // Prepare email notifications (outside transaction)
      for (const memberId of teamMembers) {
        const user = await User.findById(memberId).session(session);
        if (!user) continue;

        const teammates = teamMembers
          .filter((mId) => mId.toString() !== memberId.toString())
          .map(async (mId) => {
            const teammate = await User.findById(mId).session(session);
            return teammate ? teammate.name : "Teammate";
          });

        const teammateNames = await Promise.all(teammates);

        emailPromises.push(
          sendTeamNotification({
            email: user.email,
            name: user.name,
            ProFillerathonTitle: title,
            teammates: teammateNames,
            problemStatement: randomProblem,
            teamName: teamName,
          }).catch((emailError) => {
            logger.error(`Failed to send email to ${user.email}:`, emailError);
            return null;
          })
        );
      }
    }

    // Update ProFillerathon status
    await ProFillerathon.findByIdAndUpdate(
      _id,
      {
        $set: {
          status: "registration_closed",
        },
      },
      { session }
    );

    await session.commitTransaction();
    transactionCommitted = true;
    logger.info(`Transaction committed successfully for ProFillerathon: ${title}`);

    // Send emails outside transaction
    if (emailPromises.length > 0) {
      const emailResults = await Promise.allSettled(emailPromises);
      const successfulEmails = emailResults.filter(
        (r) => r.status === "fulfilled"
      ).length;
      const failedEmails = emailResults.filter(
        (r) => r.status === "rejected"
      ).length;

      logger.info(
        `Emails sent: ${successfulEmails} successful, ${failedEmails} failed`
      );

      emailResults.forEach((result, index) => {
        if (result.status === "rejected") {
          logger.error(
            `Failed to send email to participant at index ${index}: ${result.reason}`
          );
        }
      });
    }

    logger.info(
      `Successfully created ${createdTeams.length} teams for ${title}`
    );
    return {
      success: true,
      teamsCreated: createdTeams.length,
      ProFillerathonId: _id,
      ProFillerathonTitle: title,
    };
  } catch (error) {
    // Only abort transaction if it hasn't been committed
    if (!transactionCommitted) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        logger.warn(`Error aborting transaction: ${abortError.message}`);
      }
    }

    // If team formation fails due to business rules and ProFillerathon hasn't started, cancel it
    const now = new Date();
    if (ProFillerathon.startDate > now && error.type === ErrorTypes.BUSINESS) {
      logger.warn(
        `Team formation failed for ProFillerathon ${ProFillerathon.title} due to business rules, cancelling ProFillerathon: ${error.message}`
      );
      try {
        // Use a separate session for cancellation
        await cancelProFillerathon(
          ProFillerathon,
          `Team formation failed: ${error.message}`,
          io
        );

        // Return a success result for cancellation case instead of throwing error
        return {
          success: true,
          teamsCreated: 0,
          ProFillerathonId: ProFillerathon._id,
          ProFillerathonTitle: ProFillerathon.title,
          cancelled: true,
          reason: error.message,
        };
      } catch (cancelError) {
        logger.error(
          `Failed to cancel ProFillerathon after team formation failure:`,
          cancelError
        );
        // Re-throw the original business error, not the cancellation error
        throw error;
      }
    } else if (error.type === ErrorTypes.FATAL) {
      logger.error(
        `Fatal error during team formation for ProFillerathon ${ProFillerathon.title}:`,
        error
      );
    }

    throw error;
  } finally {
    try {
      session.endSession();
    } catch (sessionError) {
      logger.warn(`Error ending session: ${sessionError.message}`);
    }
  }
};

// Function to complete ProFillerathon and perform cleanup
const completeProFillerathon = async (ProFillerathon, io) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const { _id, title, status, participants } = ProFillerathon;

    logger.info(`Completing ProFillerathon: ${title}`, {
      ProFillerathonId: _id,
      currentStatus: status,
    });

    // Update ProFillerathon status to completed
    await ProFillerathon.findByIdAndUpdate(
      _id,
      {
        $set: {
          status: "completed",
          isActive: false,
        },
      },
      { session }
    );

    // Find all teams for this ProFillerathon
    const teams = await Team.find({ ProFillerathonId: _id }).session(session);
    logger.info(
      `Found ${teams.length} teams to process for ProFillerathon: ${title}`
    );

    // Update team statuses to completed
    const teamUpdatePromises = teams.map((team) =>
      Team.findByIdAndUpdate(
        team._id,
        {
          $set: {
            status: "completed",
          },
        },
        { session }
      )
    );

    // Clear currentProFillerathonId for all participants
    const userUpdatePromises = participants.map((participantId) =>
      User.findByIdAndUpdate(
        participantId,
        {
          $unset: { currentProFillerathonId: null },
        },
        { session }
      )
    );

    await Promise.all([...teamUpdatePromises, ...userUpdatePromises]);
    await session.commitTransaction();

    logger.info(`Successfully completed ProFillerathon: ${title}`);

    return {
      success: true,
      ProFillerathonId: _id,
      ProFillerathonTitle: title,
      teamsProcessed: teams.length,
      participantsProcessed: participants.length,
    };
  } catch (error) {
    await session.abortTransaction();
    logger.error(`Failed to complete ProFillerathon ${ProFillerathon.title}:`, error);
    throw error;
  } finally {
    session.endSession();
  }
};

// Main scheduler function with comprehensive error handling
export const startScheduler = (io) => {
  // Team formation scheduler (runs every 30 seconds)
  cron.schedule(
    "*/30 * * * * *",
    async () => {
      const marker = {
        status: "started",
        timestamp: new Date().toISOString(),
        ProFillerathonsProcessed: 0,
        errors: [],
      };

      try {
        logger.debug("Team formation scheduler started", {
          timestamp: marker.timestamp,
        });

        const now = new Date();
        const twoMinutesAgo = new Date(now.getTime() - 2 * 60000);

        // Find ProFillerathons where registration deadline has passed
        const ProFillerathonsToProcess = await ProFillerathon.find({
          registrationDeadline: { $lte: now, $gte: twoMinutesAgo },
          isActive: true,
          status: "registration_open",
          participants: { $exists: true, $ne: [] },
        }).populate({
          path: "participants",
          select: "name email skills",
        });

        marker.ProFillerathonsToProcess = ProFillerathonsToProcess.length;
        logger.info(
          `Found ${ProFillerathonsToProcess.length} ProFillerathons to process for team formation`
        );

        for (const ProFillerathon of ProFillerathonsToProcess) {
          const ProFillerathonMarker = {
            ProFillerathonId: ProFillerathon._id,
            title: ProFillerathon.title,
            status: "processing",
            startedAt: new Date().toISOString(),
          };

          try {
            logger.info(
              `Processing ProFillerathon for team formation: ${ProFillerathon.title}`
            );

            const result = await retryOperation(
              () => createTeamsForProFillerathon(ProFillerathon, io),
              3,
              500
            );

            // Check if ProFillerathon was cancelled but handled successfully
            if (result.cancelled) {
              ProFillerathonMarker.status = "cancelled";
              logger.info(
                `ProFillerathon cancelled successfully: ${ProFillerathon.title} - ${result.reason}`
              );
            } else {
              ProFillerathonMarker.status = "completed";
              marker.ProFillerathonsProcessed++;
              logger.info(
                `Successfully processed ProFillerathon: ${ProFillerathon.title}`
              );
            }

            ProFillerathonMarker.completedAt = new Date().toISOString();
            ProFillerathonMarker.result = result;
          } catch (error) {
            ProFillerathonMarker.status = "failed";
            ProFillerathonMarker.error = {
              message: error.message,
              type: error.type,
              code: error.code,
              retryable: error.retryable,
            };
            ProFillerathonMarker.completedAt = new Date().toISOString();
            marker.errors.push(ProFillerathonMarker.error);

            if (error.type === ErrorTypes.TRANSIENT) {
              logger.warn(
                `Transient error processing ProFillerathon ${ProFillerathon.title}:`,
                error
              );
            } else if (error.type === ErrorTypes.BUSINESS) {
              logger.info(
                `Business rule violation for ProFillerathon ${ProFillerathon.title}: ${error.message}`
              );
            } else {
              logger.error(
                `Error processing ProFillerathon ${ProFillerathon.title}:`,
                error
              );
            }
          }
        }

        marker.status = "completed";
        marker.completedAt = new Date().toISOString();

        logger.debug("Team formation scheduler completed", {
          ProFillerathonsProcessed: marker.ProFillerathonsProcessed,
          totalErrors: marker.errors.length,
        });
      } catch (error) {
        marker.status = "failed";
        marker.error = classifyError(error);
        marker.completedAt = new Date().toISOString();
        logger.error("Team formation scheduler fatal error:", error);
      }
    },
    {
      scheduled: true,
      timezone: "UTC",
    }
  );

  // ProFillerathon completion scheduler (runs every minute)
  cron.schedule(
    "* * * * *",
    async () => {
      const marker = {
        status: "started",
        timestamp: new Date().toISOString(),
        ProFillerathonsScheduled: 0,
        errors: [],
      };

      try {
        logger.debug("ProFillerathon completion scheduler started", {
          timestamp: marker.timestamp,
        });

        const now = new Date();
        const threshold = new Date(now.getTime() + 3 * 60 * 1000);

        // Find ProFillerathons ending soon
        const ProFillerathonsToComplete = await ProFillerathon.find({
          startDate: { $lte: now }, // already started
          endDate: { $gt: now, $lte: threshold }, // ending in next X minutes
          isActive: true,
          status: {
            $in: ["registration_closed", "ongoing", "winner_to_announced"],
          },
        });

        marker.ProFillerathonsToComplete = ProFillerathonsToComplete.length;
        logger.info(
          `Found ${ProFillerathonsToComplete.length} ProFillerathons to complete`
        );

        for (const ProFillerathon of ProFillerathonsToComplete) {
          const ProFillerathonMarker = {
            ProFillerathonId: ProFillerathon._id,
            title: ProFillerathon.title,
            status: "processing",
            startedAt: new Date().toISOString(),
          };

          try {
            logger.info(`Completing ProFillerathon: ${ProFillerathon.title}`);
            await retryOperation(
              () => completeProFillerathon(ProFillerathon, io),
              3,
              500
            );

            ProFillerathonMarker.status = "completed";
            ProFillerathonMarker.completedAt = new Date().toISOString();
            marker.ProFillerathonsScheduled++;

            logger.info(`Successfully completed ProFillerathon: ${ProFillerathon.title}`);
          } catch (error) {
            ProFillerathonMarker.status = "failed";
            ProFillerathonMarker.error = {
              message: error.message,
              type: error.type,
              code: error.code,
            };
            ProFillerathonMarker.completedAt = new Date().toISOString();
            marker.errors.push(ProFillerathonMarker.error);
            logger.error(
              `Error completing ProFillerathon ${ProFillerathon.title}:`,
              error
            );
          }
        }

        marker.status = "completed";
        marker.completedAt = new Date().toISOString();

        logger.debug("ProFillerathon completion scheduler completed", {
          ProFillerathonsScheduled: marker.ProFillerathonsScheduled,
          totalErrors: marker.errors.length,
        });
      } catch (error) {
        marker.status = "failed";
        marker.error = classifyError(error);
        marker.completedAt = new Date().toISOString();
        logger.error("ProFillerathon completion scheduler fatal error:", error);
      }
    },
    {
      scheduled: true,
      timezone: "UTC",
    }
  );

  // Status update scheduler (runs every 5 minutes)
  cron.schedule(
    "*/5 * * * *",
    async () => {
      try {
        logger.info("ProFillerathon status update scheduler started");
        const now = new Date();

        // Update ProFillerathons that should be in "ongoing" status
        const ongoingResult = await ProFillerathon.updateMany(
          {
            startDate: { $lte: now },
            endDate: { $gt: now },
            status: "registration_closed",
            isActive: true,
          },
          {
            $set: { status: "ongoing" },
          }
        );

        // Update ProFillerathons that should be in "winner_to_announced" status
        const winnerResult = await ProFillerathon.updateMany(
          {
            endDate: { $lte: now },
            winnerAnnouncementDate: { $gt: now },
            status: "ongoing",
            isActive: true,
          },
          {
            $set: { status: "winner_to_announced" },
          }
        );

        logger.info("ProFillerathon status update scheduler completed", {
          ongoingUpdated: ongoingResult.modifiedCount,
          winnerUpdated: winnerResult.modifiedCount,
        });
      } catch (error) {
        logger.error("ProFillerathon status update scheduler error:", error);
      }
    },
    {
      scheduled: true,
      timezone: "UTC",
    }
  );

  logger.info("All ProFillerathon schedulers started successfully");
};

// Export for testing
export {
  ErrorTypes,
  SchedulerError,
  classifyError,
  retryOperation,
  createTeamsForProFillerathon,
  completeProFillerathon,
  cancelProFillerathon,
};
