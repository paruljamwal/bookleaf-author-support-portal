import { connectDatabase, disconnectDatabase } from "../db/connect.js";
import { logger } from "../lib/logger.js";
import { seedDatabase } from "./seed.js";

await connectDatabase();
try {
  const report = await seedDatabase();
  logger.info("seed complete", report);
} finally {
  await disconnectDatabase();
}
