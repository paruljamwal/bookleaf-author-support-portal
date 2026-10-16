import { Router } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../lib/async.js";

export const healthRouter = Router();

healthRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({
      status: connected ? "ok" : "degraded",
      database: connected ? "connected" : "disconnected",
      time: new Date().toISOString(),
    });
  }),
);
