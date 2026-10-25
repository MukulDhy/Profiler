export default {
  testEnvironment: "node",
  transform: {},
  setupFiles: ["<rootDir>/tests/env.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  testTimeout: 60_000,
};
