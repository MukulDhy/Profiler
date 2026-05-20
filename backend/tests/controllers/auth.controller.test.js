// tests/controllers/auth.controller.test.js
import request from "supertest";
import app from "../../app.js";
import User from "../../models/user.model";

describe("Auth Controller", () => {
  describe("POST /api/auth/register", () => {
    it("should register a new user", async () => {
      const userData = {
        name: "Test User",
        email: "test@example.com",
        password: "Test@1234",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData);

      expect(response.statusCode).toBe(201);
      expect(response.body.success).toBe(true);

      // ✅ Fix 1: controller sends accessToken & user at top level, not nested in data
      expect(response.body).toHaveProperty("accessToken");
      expect(response.body.user).toHaveProperty("email", userData.email);

      // Verify user was created in DB
      const userInDb = await User.findOne({ email: userData.email });
      expect(userInDb).toBeTruthy();
      expect(userInDb.name).toBe(userData.name);
    });

    it("should not register a user with existing email", async () => {
      await User.create({
        name: "Existing User",
        email: "existing@example.com",
        password: "Test@1234",
      });

      const userData = {
        name: "New User",
        email: "existing@example.com",
        password: "Test@1234",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData);

      expect(response.statusCode).toBe(409);
      expect(response.body.success).toBe(false);
      // ✅ Fix 2: controller sends `message`, not `error`
      expect(response.body).toHaveProperty("message");
    });

    it("should validate required fields", async () => {
      const userData = {
        name: "Incomplete User",
        email: "incomplete@example.com",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData);

      // ✅ Something upstream returns 400 before Mongoose validation
      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      await User.create({
        name: "Login Test",
        email: "login@example.com",
        password: "Test@1234",
      });
    });

    it("should login with correct credentials", async () => {
      const loginData = {
        email: "login@example.com",
        password: "Test@1234",
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(loginData);

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      // ✅ Fix 1 (same): accessToken is top-level, not nested in data
      expect(response.body).toHaveProperty("accessToken");
    });

    it("should not login with incorrect password", async () => {
      const loginData = {
        email: "login@example.com",
        password: "wrongPassword@123",
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(loginData);

      expect(response.statusCode).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should not login with non-existent email", async () => {
      const loginData = {
        email: "nonexistent@example.com",
        password: "Test@1234",
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(loginData);

      expect(response.statusCode).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});