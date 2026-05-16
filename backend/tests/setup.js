// tests/setup.js
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import logger from "../utils/logger";

let mongoServer;

// Setup before tests
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  logger.info("Connected to in-memory database for testing");
});

// Clean up after tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  logger.info("Disconnected from in-memory database");
});

// Clear database between tests
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});
