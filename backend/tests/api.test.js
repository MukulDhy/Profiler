import { jest } from "@jest/globals";
import request from "supertest";

// ─── Module mocks (must be registered before the app is imported) ────────────

jest.unstable_mockModule("../utils/sendMail.js", () => ({
  default: jest.fn(async () => ({ messageId: "test-message" })),
}));

const chatMock = jest.fn(async () => ({
  answer: "Grounded test answer.",
  suggestions: ["What should I probe next?"],
  provider: "mock",
  model: "mock-model",
}));

const jobMatchMock = jest.fn(async () => ({
  score: 82,
  matchedKeywords: ["Node.js", "MongoDB"],
  missingKeywords: ["Rust"],
  strengths: ["Strong backend evidence."],
  gaps: ["No Rust evidence."],
  suggestions: ["Add measurable outcomes."],
  verdict: "Strong match for a backend role.",
  provider: "mock",
  model: "mock-model",
}));

jest.unstable_mockModule("../services/aiAnalyser.service.js", () => ({
  analyzeResume: jest.fn(),
  analyzeResumeText: jest.fn(),
  aiAnalyserHealth: jest.fn(async () => ({ status: "ok" })),
  chatWithProfile: chatMock,
  matchJobDescription: jobMatchMock,
}));

const { app } = await import("../app.js");
const { default: Upload } = await import("../models/resume.model.js");

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PASSWORD = "Test@12345";
const NEW_PASSWORD = "NewTest@12345";

const sampleProfile = {
  candidate: {
    name: "Ada Lovelace",
    title: "Backend Engineer",
    initials: "AL",
    location: "London, UK",
    email: "ada@example.com",
    experienceYears: 7,
    summary: "Backend engineer focused on distributed systems.",
    links: { github: "https://github.com/ada" },
  },
  analysis: {
    score: 88,
    atsScore: 91,
    keywordMatch: { matched: 18, total: 20 },
    formatting: "Pass",
    missingKeywords: ["Rust"],
    strengths: ["Strong systems design."],
    weaknesses: ["Limited frontend evidence."],
    suggestions: ["Add scale metrics."],
    recruiterImpression: "A strong backend hire.",
  },
  skills: [{ name: "Node.js", level: 90, group: "Backend" }],
  radarSkills: [{ axis: "Backend", value: 90 }],
  timeline: [
    {
      year: "2022 — Now",
      role: "Senior Engineer",
      org: "Analytical Engines",
      blurb: "Led the migration to event-driven services.",
    },
  ],
  projects: [
    {
      id: "project-1",
      name: "Engine API",
      tagline: "Event-driven backend",
      tech: ["Node.js", "MongoDB"],
      metrics: { latency: "-40%" },
      summary: "Designed an event-driven API handling 10k rps.",
      links: { github: "https://github.com/ada/engine" },
    },
  ],
  platforms: [],
  recruiterInsights: {
    roleFits: [
      { role: "Backend Engineer", score: 92, verdict: "Strong fit" },
    ],
    interviewQuestions: ["How did you design the event pipeline?"],
  },
  codingActivity: [],
};

const makeResume = (userId, overrides = {}) =>
  Upload.create({
    userId,
    fileName: "ada-lovelace.pdf",
    url: "https://example.com/ada-lovelace.pdf",
    publicId: "ada-lovelace",
    fileType: "pdf",
    fileSize: 2048,
    processingStatus: "completed",
    extractedText: "Ada Lovelace — backend engineer with seven years of experience.",
    profile: sampleProfile,
    ...overrides,
  });

async function createSession(overrides = {}) {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/register").send({
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: PASSWORD,
    ...overrides,
  });

  expect(response.status).toBe(201);
  return {
    agent,
    token: response.body.data.accessToken,
    user: response.body.data.user,
  };
}

// ─── Auth ────────────────────────────────────────────────────────────────────

describe("Authentication", () => {
  it("registers a user and returns the current session", async () => {
    const { agent, token, user } = await createSession();

    expect(token).toBeTruthy();
    expect(user.email).toBe("ada@example.com");
    expect(user.password).toBeUndefined();

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe("ada@example.com");
    expect(me.body.data.isDemo).toBe(false);
  });

  it("rejects a weak password", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "Weak Password",
      email: "weak@example.com",
      password: "password",
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("rejects unauthenticated access", async () => {
    const response = await request(app).get("/api/auth/me");
    expect(response.status).toBe(401);
  });

  it("updates the profile, changes the password and signs in again", async () => {
    const { agent } = await createSession();

    const profile = await agent.put("/api/auth/profile").send({
      bio: "Building reliable distributed systems.",
      username: "ada-l",
      githubUsername: "ada",
    });

    expect(profile.status).toBe(200);
    expect(profile.body.data.user.bio).toBe(
      "Building reliable distributed systems."
    );
    expect(profile.body.data.user.githubUsername).toBe("ada");

    const changed = await agent.put("/api/auth/change-password").send({
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    expect(changed.status).toBe(200);

    const oldLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: PASSWORD });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: NEW_PASSWORD });
    expect(newLogin.status).toBe(200);
  });

  it("disables the demo account when DEMO_MODE is false", async () => {
    const response = await request(app).post("/api/auth/demo");
    expect(response.status).toBe(404);
  });
});

// ─── Resume sharing & public profile ────────────────────────────────────────

describe("Resume sharing and public profile", () => {
  it("shares a resume, serves the public profile and revokes the link", async () => {
    const { agent, user } = await createSession();
    const resume = await makeResume(user._id);

    const share = await agent.post(`/api/resume/${resume._id}/share`);
    expect(share.status).toBe(200);
    expect(share.body.data.sharing.isPublic).toBe(true);
    expect(share.body.data.sharing.url).toContain("/share/");

    const token = share.body.data.sharing.shareToken;
    expect(token).toBeTruthy();

    const publicProfile = await request(app).get(
      `/api/public/profile/${token}`
    );
    expect(publicProfile.status).toBe(200);
    expect(publicProfile.body.data.profile.candidate.name).toBe("Ada Lovelace");
    expect(publicProfile.body.data.profile.candidate.email).toBeUndefined();
    expect(publicProfile.body.data.resume.fileName).toBe("ada-lovelace.pdf");

    await Upload.updateOne(
      { _id: resume._id },
      {
        extractedText:
          "Ada Lovelace - backend engineer. Contact ada@example.com",
      }
    );

    const publicChat = await request(app)
      .post(`/api/public/profile/${token}/chat`)
      .send({ question: "What are their strongest skills?" });

    expect(publicChat.status).toBe(200);
    expect(publicChat.body.data.answer).toBe("Grounded test answer.");
    expect(chatMock).toHaveBeenCalled();

    const chatPayload = chatMock.mock.calls.at(-1)?.[0] || {};
    expect(chatPayload.profile.candidate.email).toBeUndefined();
    expect(chatPayload.extractedText).not.toContain("ada@example.com");
    expect(chatPayload.extractedText).toContain("[redacted]");

    const revoke = await agent.delete(`/api/resume/${resume._id}/share`);
    expect(revoke.status).toBe(200);
    expect(revoke.body.data.sharing.isPublic).toBe(false);

    const revoked = await request(app).get(`/api/public/profile/${token}`);
    expect(revoked.status).toBe(404);
  });

  it("rejects sharing a resume that has not finished analysing", async () => {
    const { agent, user } = await createSession();
    const resume = await makeResume(user._id, {
      processingStatus: "processing",
      profile: null,
    });

    const share = await agent.post(`/api/resume/${resume._id}/share`);
    expect(share.status).toBe(409);
  });

  it("returns stable ids and sharing state in the resume list", async () => {
    const { agent, user } = await createSession();
    const first = await makeResume(user._id);
    await makeResume(user._id, {
      fileName: "second.pdf",
      publicId: "second",
    });

    await agent.post(`/api/resume/${first._id}/share`);

    const list = await agent.get("/api/resume");
    expect(list.status).toBe(200);
    expect(list.body.data.uploads).toHaveLength(2);
    expect(list.body.data.pagination.total).toBe(2);

    for (const upload of list.body.data.uploads) {
      expect(upload.id).toBeTruthy();
      expect(upload.sharing).toBeDefined();
    }

    const shared = list.body.data.uploads.find(
      (upload) => upload.fileName === "ada-lovelace.pdf"
    );
    expect(shared.sharing.isPublic).toBe(true);
  });

  it("returns 404 for an unknown public token", async () => {
    const response = await request(app).get("/api/public/profile/not-a-token");
    expect(response.status).toBe(404);
  });
});

// ─── Chat ────────────────────────────────────────────────────────────────────

describe("Grounded chat", () => {
  it("creates a conversation and persists both messages", async () => {
    const { agent, user } = await createSession();
    const resume = await makeResume(user._id);

    const created = await agent
      .post("/api/chat/conversations")
      .send({ resumeId: resume._id });

    expect(created.status).toBe(201);
    const conversationId = created.body.data.conversation.id;

    const sent = await agent
      .post(`/api/chat/conversations/${conversationId}/messages`)
      .send({ content: "Summarise the candidate" });

    expect(sent.status).toBe(200);
    expect(sent.body.data.message.role).toBe("assistant");
    expect(sent.body.data.message.content).toBe("Grounded test answer.");
    expect(sent.body.data.suggestions).toEqual(["What should I probe next?"]);
    expect(sent.body.data.title).toBe("Summarise the candidate");

    const conversation = await agent.get(
      `/api/chat/conversations/${conversationId}`
    );

    expect(conversation.status).toBe(200);
    expect(conversation.body.data.conversation.messages).toHaveLength(2);
    expect(conversation.body.data.conversation.messages[0]).toMatchObject({
      role: "user",
      content: "Summarise the candidate",
    });

    const list = await agent.get(
      `/api/chat/conversations?resumeId=${resume._id}`
    );
    expect(list.status).toBe(200);
    expect(list.body.data.conversations).toHaveLength(1);
    expect(list.body.data.conversations[0].messageCount).toBe(2);
  });
});

// ─── Notes ───────────────────────────────────────────────────────────────────

describe("Recruiter notes", () => {
  it("creates, lists and deletes a note", async () => {
    const { agent, user } = await createSession();
    const resume = await makeResume(user._id);

    const created = await agent.post("/api/notes").send({
      resumeId: resume._id,
      body: "Strong systems thinker. Validate on-call experience.",
    });

    expect(created.status).toBe(201);
    const noteId = created.body.data.note.id;

    const list = await agent.get(`/api/notes?resumeId=${resume._id}`);
    expect(list.status).toBe(200);
    expect(list.body.data.notes).toHaveLength(1);
    expect(list.body.data.notes[0].body).toContain("Strong systems thinker");

    const removed = await agent.delete(`/api/notes/${noteId}`);
    expect(removed.status).toBe(200);

    const empty = await agent.get(`/api/notes?resumeId=${resume._id}`);
    expect(empty.body.data.notes).toHaveLength(0);
  });
});

// ─── Job matching ────────────────────────────────────────────────────────────

describe("Job description matching", () => {
  it("scores a job description against a resume", async () => {
    const { agent, user } = await createSession();
    const resume = await makeResume(user._id);

    const response = await agent.post("/api/ai/job-match").send({
      resumeId: resume._id,
      jobDescription:
        "We are hiring a backend engineer with strong Node.js and MongoDB experience to build event-driven services at scale.",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.match.score).toBe(82);
    expect(response.body.data.match.matchedKeywords).toContain("Node.js");
    expect(jobMatchMock).toHaveBeenCalled();
  });

  it("rejects a job description that is too short", async () => {
    const { agent, user } = await createSession();
    const resume = await makeResume(user._id);

    const response = await agent.post("/api/ai/job-match").send({
      resumeId: resume._id,
      jobDescription: "Too short",
    });

    expect(response.status).toBe(400);
  });
});

// ─── GitHub ──────────────────────────────────────────────────────────────────

describe("GitHub activity", () => {
  it("rejects an invalid username without calling GitHub", async () => {
    const { agent } = await createSession();

    const response = await agent.get(
      "/api/github/activity?username=not%20a%20username"
    );

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});
