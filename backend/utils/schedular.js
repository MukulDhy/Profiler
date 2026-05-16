import cron from "node-cron";
import mongoose from "mongoose";
//import { sendTeamNotification } from "../services/sendTeamEmail.service.js";
// import Inflioathon from "../models/Infliothon.model.js";
// import Team from "../models/team.model.js";
// import TeamMember from "../models/teamMember.model.js";
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
    error.message.includes("Inflioathon already started")
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

// Function to cancel Inflioathon and cleanup (standalone function with its own session)
const cancelInflioathon = async (Inflioathon, reason = "Technical issues", io) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const { _id, title, participants } = Inflioathon;

    logger.info(`Cancelling Inflioathon: ${title}`, {
      InflioathonId: _id,
      reason,
      participantCount: participants?.length || 0,
    });

    // Update Inflioathon status to cancelled
    await Inflioathon.findByIdAndUpdate(
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

    // Clear currentInflioathonId for all participants
    if (participants && participants.length > 0) {
      const userUpdatePromises = participants.map((participantId) =>
        User.findByIdAndUpdate(
          participantId,
          {
            $unset: { currentInflioathonId: null },
          },
          { session }
        )
      );

      await Promise.all(userUpdatePromises);
      logger.info(
        `Cleared currentInflioathonId for ${participants.length} participants`
      );
    }

    // Delete any teams that were created for this Inflioathon
    const teamsDeleted = await Team.deleteMany(
      { InflioathonId: _id },
      { session }
    );

    // Delete team members associated with those teams
    if (teamsDeleted.deletedCount > 0) {
      const teamIds = (
        await Team.find({ InflioathonId: _id }).session(session)
      ).map((team) => team._id);
      await TeamMember.deleteMany({ teamId: { $in: teamIds } }, { session });
      logger.info(
        `Deleted ${teamsDeleted.deletedCount} teams and their members`
      );
    }

    await session.commitTransaction();

    logger.info(`Successfully cancelled Inflioathon: ${title}`, {
      InflioathonId: _id,
      participantsCleared: participants?.length || 0,
      teamsDeleted: teamsDeleted.deletedCount || 0,
    });

    // Notify clients about Inflioathon cancellation
    if (io) {
      io.to(_id.toString()).emit("Inflioathon-cancelled", {
        InflioathonId: _id,
        InflioathonTitle: title,
        reason: reason,
        cancelledAt: new Date().toISOString(),
      });
    }

    return {
      success: true,
      InflioathonId: _id,
      InflioathonTitle: title,
      participantsCleared: participants?.length || 0,
      teamsDeleted: teamsDeleted.deletedCount || 0,
      reason: reason,
    };
  } catch (error) {
    await session.abortTransaction();
    logger.error(`Failed to cancel Inflioathon ${Inflioathon.title}:`, error);
    throw error;
  } finally {
    session.endSession();
  }
};

// Team creation logic with proper transaction handling and cancellation on failure
const createTeamsForInflioathon = async (Inflioathon, io) => {
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
    } = Inflioathon;

    // Validation checks - throw errors instead of calling cancelInflioathon here
    if (!participants || participants.length === 0) {
      const errorMsg = `No participants for Inflioathon: ${title}`;
      logger.warn(errorMsg);
      throw new SchedulerError(
        errorMsg,
        ErrorTypes.BUSINESS,
        "NO_PARTICIPANTS",
        false
      );
    }

    if (!problemStatements || problemStatements.length === 0) {
      const errorMsg = `No problem statements for Inflioathon: ${title}`;
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

    // Check if Inflioathon has already started
    const now = new Date();
    if (Inflioathon.startDate <= now) {
      const errorMsg = `Inflioathon ${title} has already started. Cannot form teams.`;
      logger.error(errorMsg);
      throw new SchedulerError(
        errorMsg,
        ErrorTypes.BUSINESS,
        "InflioATHON_STARTED",
        false
      );
    }

    // Calculate optimal team distribution
    const totalParticipants = participants.length;
    const optimalTeamCount = Math.ceil(totalParticipants / maxTeamSize);
    const baseTeamSize = Math.floor(totalParticipants / optimalTeamCount);
    const remainder = totalParticipants % optimalTeamCount;

    logger.info(`Creating teams for Inflioathon: ${title}`, {
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
            InflioathonId: _id,
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

      // Update users' current Inflioathon
      const userUpdatePromises = teamMembers.map((memberId) =>
        User.findByIdAndUpdate(
          memberId,
          { currentInflioathonId: _id },
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

        // emailPromises.push(
        //   sendTeamNotification({
        //     email: user.email,
        //     name: user.name,
        //     InflioathonTitle: title,
        //     teammates: teammateNames,
        //     problemStatement: randomProblem,
        //     teamName: teamName,
        //   }).catch((emailError) => {
        //     logger.error(`Failed to send email to ${user.email}:`, emailError);
        //     return null;
        //   })
        // );
      }
    }

    // Update Inflioathon status
    await Inflioathon.findByIdAndUpdate(
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
    logger.info(`Transaction committed successfully for Inflioathon: ${title}`);

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
      InflioathonId: _id,
      InflioathonTitle: title,
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

    // If team formation fails due to business rules and Inflioathon hasn't started, cancel it
    const now = new Date();
    if (Inflioathon.startDate > now && error.type === ErrorTypes.BUSINESS) {
      logger.warn(
        `Team formation failed for Inflioathon ${Inflioathon.title} due to business rules, cancelling Inflioathon: ${error.message}`
      );
      try {
        // Use a separate session for cancellation
        await cancelInflioathon(
          Inflioathon,
          `Team formation failed: ${error.message}`,
          io
        );

        // Return a success result for cancellation case instead of throwing error
        return {
          success: true,
          teamsCreated: 0,
          InflioathonId: Inflioathon._id,
          InflioathonTitle: Inflioathon.title,
          cancelled: true,
          reason: error.message,
        };
      } catch (cancelError) {
        logger.error(
          `Failed to cancel Inflioathon after team formation failure:`,
          cancelError
        );
        // Re-throw the original business error, not the cancellation error
        throw error;
      }
    } else if (error.type === ErrorTypes.FATAL) {
      logger.error(
        `Fatal error during team formation for Inflioathon ${Inflioathon.title}:`,
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

// Function to complete Inflioathon and perform cleanup
const completeInflioathon = async (Inflioathon, io) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const { _id, title, status, participants } = Inflioathon;

    logger.info(`Completing Inflioathon: ${title}`, {
      InflioathonId: _id,
      currentStatus: status,
    });

    // Update Inflioathon status to completed
    await Inflioathon.findByIdAndUpdate(
      _id,
      {
        $set: {
          status: "completed",
          isActive: false,
        },
      },
      { session }
    );

    // Find all teams for this Inflioathon
    const teams = await Team.find({ InflioathonId: _id }).session(session);
    logger.info(
      `Found ${teams.length} teams to process for Inflioathon: ${title}`
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

    // Clear currentInflioathonId for all participants
    const userUpdatePromises = participants.map((participantId) =>
      User.findByIdAndUpdate(
        participantId,
        {
          $unset: { currentInflioathonId: null },
        },
        { session }
      )
    );

    await Promise.all([...teamUpdatePromises, ...userUpdatePromises]);
    await session.commitTransaction();

    logger.info(`Successfully completed Inflioathon: ${title}`);

    return {
      success: true,
      InflioathonId: _id,
      InflioathonTitle: title,
      teamsProcessed: teams.length,
      participantsProcessed: participants.length,
    };
  } catch (error) {
    await session.abortTransaction();
    logger.error(`Failed to complete Inflioathon ${Inflioathon.title}:`, error);
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
        InflioathonsProcessed: 0,
        errors: [],
      };

      try {
        logger.debug("Team formation scheduler started", {
          timestamp: marker.timestamp,
        });

        const now = new Date();
        const twoMinutesAgo = new Date(now.getTime() - 2 * 60000);

        // Find Inflioathons where registration deadline has passed
        const InflioathonsToProcess = await Inflioathon.find({
          registrationDeadline: { $lte: now, $gte: twoMinutesAgo },
          isActive: true,
          status: "registration_open",
          participants: { $exists: true, $ne: [] },
        }).populate({
          path: "participants",
          select: "name email skills",
        });

        marker.InflioathonsToProcess = InflioathonsToProcess.length;
        logger.info(
          `Found ${InflioathonsToProcess.length} Inflioathons to process for team formation`
        );

        for (const Inflioathon of InflioathonsToProcess) {
          const InflioathonMarker = {
            InflioathonId: Inflioathon._id,
            title: Inflioathon.title,
            status: "processing",
            startedAt: new Date().toISOString(),
          };

          try {
            logger.info(
              `Processing Inflioathon for team formation: ${Inflioathon.title}`
            );

            const result = await retryOperation(
              () => createTeamsForInflioathon(Inflioathon, io),
              3,
              500
            );

            // Check if Inflioathon was cancelled but handled successfully
            if (result.cancelled) {
              InflioathonMarker.status = "cancelled";
              logger.info(
                `Inflioathon cancelled successfully: ${Inflioathon.title} - ${result.reason}`
              );
            } else {
              InflioathonMarker.status = "completed";
              marker.InflioathonsProcessed++;
              logger.info(
                `Successfully processed Inflioathon: ${Inflioathon.title}`
              );
            }

            InflioathonMarker.completedAt = new Date().toISOString();
            InflioathonMarker.result = result;
          } catch (error) {
            InflioathonMarker.status = "failed";
            InflioathonMarker.error = {
              message: error.message,
              type: error.type,
              code: error.code,
              retryable: error.retryable,
            };
            InflioathonMarker.completedAt = new Date().toISOString();
            marker.errors.push(InflioathonMarker.error);

            if (error.type === ErrorTypes.TRANSIENT) {
              logger.warn(
                `Transient error processing Inflioathon ${Inflioathon.title}:`,
                error
              );
            } else if (error.type === ErrorTypes.BUSINESS) {
              logger.info(
                `Business rule violation for Inflioathon ${Inflioathon.title}: ${error.message}`
              );
            } else {
              logger.error(
                `Error processing Inflioathon ${Inflioathon.title}:`,
                error
              );
            }
          }
        }

        marker.status = "completed";
        marker.completedAt = new Date().toISOString();

        logger.debug("Team formation scheduler completed", {
          InflioathonsProcessed: marker.InflioathonsProcessed,
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

  // Inflioathon completion scheduler (runs every minute)
  cron.schedule(
    "* * * * *",
    async () => {
      const marker = {
        status: "started",
        timestamp: new Date().toISOString(),
        InflioathonsScheduled: 0,
        errors: [],
      };

      try {
        logger.debug("Inflioathon completion scheduler started", {
          timestamp: marker.timestamp,
        });

        const now = new Date();
        const threshold = new Date(now.getTime() + 3 * 60 * 1000);

        // Find Inflioathons ending soon
        const InflioathonsToComplete = await Inflioathon.find({
          startDate: { $lte: now }, // already started
          endDate: { $gt: now, $lte: threshold }, // ending in next X minutes
          isActive: true,
          status: {
            $in: ["registration_closed", "ongoing", "winner_to_announced"],
          },
        });

        marker.InflioathonsToComplete = InflioathonsToComplete.length;
        logger.info(
          `Found ${InflioathonsToComplete.length} Inflioathons to complete`
        );

        for (const Inflioathon of InflioathonsToComplete) {
          const InflioathonMarker = {
            InflioathonId: Inflioathon._id,
            title: Inflioathon.title,
            status: "processing",
            startedAt: new Date().toISOString(),
          };

          try {
            logger.info(`Completing Inflioathon: ${Inflioathon.title}`);
            await retryOperation(
              () => completeInflioathon(Inflioathon, io),
              3,
              500
            );

            InflioathonMarker.status = "completed";
            InflioathonMarker.completedAt = new Date().toISOString();
            marker.InflioathonsScheduled++;

            logger.info(`Successfully completed Inflioathon: ${Inflioathon.title}`);
          } catch (error) {
            InflioathonMarker.status = "failed";
            InflioathonMarker.error = {
              message: error.message,
              type: error.type,
              code: error.code,
            };
            InflioathonMarker.completedAt = new Date().toISOString();
            marker.errors.push(InflioathonMarker.error);
            logger.error(
              `Error completing Inflioathon ${Inflioathon.title}:`,
              error
            );
          }
        }

        marker.status = "completed";
        marker.completedAt = new Date().toISOString();

        logger.debug("Inflioathon completion scheduler completed", {
          InflioathonsScheduled: marker.InflioathonsScheduled,
          totalErrors: marker.errors.length,
        });
      } catch (error) {
        marker.status = "failed";
        marker.error = classifyError(error);
        marker.completedAt = new Date().toISOString();
        logger.error("Inflioathon completion scheduler fatal error:", error);
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
        logger.info("Inflioathon status update scheduler started");
        const now = new Date();

        // Update Inflioathons that should be in "ongoing" status
        const ongoingResult = await Inflioathon.updateMany(
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

        // Update Inflioathons that should be in "winner_to_announced" status
        const winnerResult = await Inflioathon.updateMany(
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

        logger.info("Inflioathon status update scheduler completed", {
          ongoingUpdated: ongoingResult.modifiedCount,
          winnerUpdated: winnerResult.modifiedCount,
        });
      } catch (error) {
        logger.error("Inflioathon status update scheduler error:", error);
      }
    },
    {
      scheduled: true,
      timezone: "UTC",
    }
  );

  logger.info("All Inflioathon schedulers started successfully");
};

// Export for testing
export {
  ErrorTypes,
  SchedulerError,
  classifyError,
  retryOperation,
  createTeamsForInflioathon,
  completeInflioathon,
  cancelInflioathon,
};
