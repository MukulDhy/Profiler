import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import logger from "../utils/logger.js";

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    // mongodb-memory-server 8 defaults to "ephemeralForTest", which MongoDB 7+
    // no longer supports. wiredTiger works across all supported versions.
    instance: { storageEngine: "wiredTiger" },
  });
  await mongoose.connect(mongoServer.getUri());
  logger.info("Connected to in-memory database for testing");
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
  logger.info("Disconnected from in-memory database");
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});
