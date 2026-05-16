// tests/controllers/auth.controller.test.js
import request from "supertest";
import {app} from "../../app";
import User from "../../models/user.model";
describe("Auth Controller", () => {
  describe("POST /api/auth/register", () => {
    it("should register a new user", async () => {
      const userData = {
        name: "Test User",
        email: "test@example.com",
        password: "password123",
        userType: "patient",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData);

      expect(response.statusCode).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("token");
      expect(response.body.data.user).toHaveProperty("email", userData.email);
      expect(response.body.data.user).toHaveProperty(
        "userType",
        userData.userType
      );

      // Verify user was created in DB
      const userInDb = await User.findOne({ email: userData.email });
      expect(userInDb).toBeTruthy();
      expect(userInDb.name).toBe(userData.name);
    });

    it("should not register a user with existing email", async () => {
      // Create a user first
      await User.create({
        name: "Existing User",
        email: "existing@example.com",
        password: "password123",
        userType: "patient",
      });

      // Try to register with same email
      const userData = {
        name: "New User",
        email: "existing@example.com",
        password: "password123",
        userType: "caregiver",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData);

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty("error");
    });

    it("should validate required fields", async () => {
      const userData = {
        name: "Incomplete User",
        email: "incomplete@example.com",
        // Missing password and userType
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData);

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      // Create a test user
      await User.create({
        name: "Login Test",
        email: "login@example.com",
        password: "password123",
        userType: "patient",
      });
    });

    it("should login with correct credentials", async () => {
      const loginData = {
        email: "login@example.com",
        password: "password123",
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(loginData);

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("token");
    });

    it("should not login with incorrect password", async () => {
      const loginData = {
        email: "login@example.com",
        password: "wrongpassword",
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
        password: "password123",
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(loginData);

      expect(response.statusCode).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
