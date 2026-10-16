import type { RequestActor } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { TicketModel } from "../models/Ticket.js";
import { getEnv } from "../config/env.js";

const AUTHOR_CHANNEL = /^private-author-(AUTH\d+|A[0-9A-F]{8})$/;
const TICKET_CHANNEL = /^private-ticket-(TKT-\d{4,})$/;

export async function assertChannelAccess(actor: RequestActor, channel: string): Promise<void> {
  if (channel === "private-admin") {
    if (actor.role !== "ADMIN") {
      throw new AppError(403, "FORBIDDEN", "You cannot subscribe to that channel.");
    }
    return;
  }

  const authorMatch = AUTHOR_CHANNEL.exec(channel);
  if (authorMatch) {
    const authorId = authorMatch[1];
    if (actor.role === "ADMIN" || actor.authorPublicId === authorId) return;
    throw new AppError(403, "FORBIDDEN", "You cannot subscribe to that channel.");
  }

  const ticketMatch = TICKET_CHANNEL.exec(channel);
  if (ticketMatch) {
    const ticketId = ticketMatch[1];
    const ticket = ticketId
      ? await TicketModel.findOne({ ticketId }).select("authorPublicId")
      : null;
    if (ticket && (actor.role === "ADMIN" || actor.authorPublicId === ticket.authorPublicId))
      return;
    throw new AppError(403, "FORBIDDEN", "You cannot subscribe to that channel.");
  }

  throw new AppError(403, "FORBIDDEN", "You cannot subscribe to that channel.");
}

export async function authorizeRealtimeChannel(
  actor: RequestActor,
  socketId: string,
  channel: string,
): Promise<{ auth: string }> {
  await assertChannelAccess(actor, channel);
  const env = getEnv();
  if (!env.PUSHER_APP_ID || !env.PUSHER_KEY || !env.PUSHER_SECRET || !env.PUSHER_CLUSTER) {
    throw new AppError(503, "REALTIME_UNAVAILABLE", "Live updates are not configured.");
  }
  const { default: Pusher } = await import("pusher");
  const pusher = new Pusher({
    appId: env.PUSHER_APP_ID,
    key: env.PUSHER_KEY,
    secret: env.PUSHER_SECRET,
    cluster: env.PUSHER_CLUSTER,
    useTLS: true,
  });
  return pusher.authorizeChannel(socketId, channel);
}
