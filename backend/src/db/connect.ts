import { mkdirSync } from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { getEnv } from "../config/env.js";
import { logger } from "../lib/logger.js";

interface MemoryServer {
  getUri(): string;
  stop(): Promise<boolean>;
}

let memoryServer: MemoryServer | null = null;

function dataDirectory(): string {
  const cwd = process.cwd();
  if (cwd.endsWith(`${path.sep}backend`)) return path.join(cwd, ".data", "mongo");
  return path.join(cwd, "backend", ".data", "mongo");
}

function mongoHost(uri: string): string {
  const normalized = uri.replace(/^mongodb\+srv:\/\//, "https://").replace(/^mongodb:\/\//, "http://");
  try {
    return new URL(normalized).hostname;
  } catch {
    return "";
  }
}

function usableMongoUri(uri: string, production: boolean): string {
  const trimmed = uri.trim();
  if (!trimmed) return "";
  const host = mongoHost(trimmed);
  const placeholder = !host || host.includes("<") || host.includes(">");
  if (!placeholder) return trimmed;
  if (production) {
    throw new Error("MONGODB_URI must use a real database host.");
  }
  logger.warn("MONGODB_URI host is a placeholder. Starting the local development database.");
  return "";
}

export async function connectDatabase(): Promise<void> {
  const env = getEnv();
  let uri = usableMongoUri(env.MONGODB_URI, env.NODE_ENV === "production");
  if (!uri) {
    if (env.NODE_ENV === "production") {
      throw new Error("MONGODB_URI is required in production.");
    }
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    mkdirSync(dataDirectory(), { recursive: true });
    const server = await MongoMemoryServer.create({
      instance: {
        dbName: "bookleaf",
        dbPath: dataDirectory(),
        storageEngine: "wiredTiger",
      },
    });
    memoryServer = server;
    uri = server.getUri("bookleaf");
    logger.info("started local persistent MongoDB", { dbPath: dataDirectory() });
  }
  await mongoose.connect(uri);
  logger.info("connected to MongoDB");
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
