import { getEnv } from "../config/env.js";

const SECRET_KEY = /password|token|secret|authorization|cookie|apiKey|api_key/i;

function sanitize(meta: object | undefined): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (SECRET_KEY.test(key)) {
      safe[key] = "[redacted]";
      continue;
    }
    safe[key] = value;
  }
  return safe;
}

function write(level: string, message: string, meta?: object): void {
  const envLevel = process.env.LOG_LEVEL ?? "info";
  const order = ["fatal", "error", "warn", "info", "debug"];
  if (order.indexOf(level) > order.indexOf(envLevel)) return;
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    message,
    ...sanitize(meta),
  });
  if (level === "error" || level === "fatal") console.error(line);
  else console.log(line);
}

export const logger = {
  debug(message: string, meta?: object) {
    write("debug", message, meta);
  },
  info(message: string, meta?: object) {
    write("info", message, meta);
  },
  warn(message: string, meta?: object) {
    write("warn", message, meta);
  },
  error(message: string, meta?: object) {
    write("error", message, meta);
  },
};

export function logConfigHint(): void {
  const env = getEnv();
  logger.info("configuration loaded", {
    nodeEnv: env.NODE_ENV,
    aiConfigured: Boolean(env.AI_API_KEY),
    pusherConfigured: Boolean(env.PUSHER_APP_ID && env.PUSHER_KEY && env.PUSHER_SECRET && env.PUSHER_CLUSTER),
    mongoConfigured: Boolean(env.MONGODB_URI),
  });
}
