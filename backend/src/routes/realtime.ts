import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/async.js";
import { AppError } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { authorizeRealtimeChannel } from "../realtime/auth.js";
import { realtimeConfigured } from "../realtime/publish.js";

export const realtimeRouter = Router();

const authSchema = z.object({
  socket_id: z.string().min(1).max(200),
  channel_name: z.string().min(1).max(120),
});

realtimeRouter.get(
  "/status",
  asyncHandler(async (_req, res) => {
    res.json({ enabled: realtimeConfigured() });
  }),
);

realtimeRouter.post(
  "/auth",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.actor) throw new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");
    const body = authSchema.parse(req.body);
    const auth = await authorizeRealtimeChannel(req.actor, body.socket_id, body.channel_name);
    res.json(auth);
  }),
);
