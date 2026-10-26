export default {
  testEnvironment: "node",
  transform: {},
  setupFiles: ["<rootDir>/env.js"], // must run before the app/modules are imported
  setupFilesAfterEnv: ["<rootDir>/setup.js"],
  // Downloading/starting the in-memory MongoDB can take longer than Jest's 5s default.
  testTimeout: 120000,
};
