import type { RealtimeEventName } from "@bookleaf/shared";
import { getEnv } from "../config/env.js";
import { logger } from "../lib/logger.js";

export interface TicketEventInput {
  name: RealtimeEventName;
  ticketId: string;
  authorPublicId: string;
  status: string;
  category: string | null;
  priority: string | null;
  updatedAt: string;
}

export interface DeliveryRecord {
  channels: string[];
  event: RealtimeEventName;
  payload: {
    ticketId: string;
    authorPublicId: string;
    status: string;
    category: string | null;
    priority: string | null;
    updatedAt: string;
  };
}

const deliveries: DeliveryRecord[] = [];

export function deliveredEvents(): DeliveryRecord[] {
  return deliveries;
}

export function clearDeliveredEvents(): void {
  deliveries.length = 0;
}

function channelsFor(event: TicketEventInput): string[] {
  if (event.name === "ticket.note.added") return ["private-admin"];
  return [`private-author-${event.authorPublicId}`, "private-admin", `private-ticket-${event.ticketId}`];
}

let pusherClient: { trigger: (channels: string[], event: string, payload: unknown) => Promise<unknown> } | null =
  null;

async function getPusher(): Promise<typeof pusherClient> {
  const env = getEnv();
  if (!env.PUSHER_APP_ID || !env.PUSHER_KEY || !env.PUSHER_SECRET || !env.PUSHER_CLUSTER) return null;
  if (!pusherClient) {
    const { default: Pusher } = await import("pusher");
    pusherClient = new Pusher({
      appId: env.PUSHER_APP_ID,
      key: env.PUSHER_KEY,
      secret: env.PUSHER_SECRET,
      cluster: env.PUSHER_CLUSTER,
      useTLS: true,
    });
  }
  return pusherClient;
}

export async function publishTicketEvent(event: TicketEventInput): Promise<void> {
  const channels = channelsFor(event);
  const payload = {
    ticketId: event.ticketId,
    authorPublicId: event.authorPublicId,
    status: event.status,
    category: event.category,
    priority: event.priority,
    updatedAt: event.updatedAt,
  };
  if (getEnv().NODE_ENV === "test") {
    deliveries.push({ channels, event: event.name, payload });
  }
  const pusher = await getPusher();
  if (!pusher) return;
  try {
    await pusher.trigger(channels, event.name, payload);
  } catch (error) {
    logger.warn("realtime publish failed", { name: error instanceof Error ? error.name : "Error" });
  }
}

export function realtimeConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.PUSHER_APP_ID && env.PUSHER_KEY && env.PUSHER_SECRET && env.PUSHER_CLUSTER);
}
