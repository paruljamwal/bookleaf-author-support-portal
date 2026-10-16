import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().default(""),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().regex(/^\d+[mhd]$/).default("15m"),
  JWT_REFRESH_TTL: z.string().regex(/^\d+[mhd]$/).default("7d"),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false"),
  COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  AI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  AI_API_KEY: z.string().default(""),
  AI_MODEL: z.string().min(1).default("gpt-4o-mini"),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(12_000),
  AI_AUTO_PROCESS: z.enum(["true", "false"]).default("true"),
  PUSHER_APP_ID: z.string().default(""),
  PUSHER_KEY: z.string().default(""),
  PUSHER_SECRET: z.string().default(""),
  PUSHER_CLUSTER: z.string().default(""),
  DEMO_ADMIN_EMAIL: z.string().email().default("ops@bookleaf.demo"),
  DEMO_ADMIN_PASSWORD: z.string().min(8).default("BookLeaf#Admin1"),
  DEMO_AUTHOR_PASSWORD: z.string().min(8).default("BookLeaf#Author1"),
  SEED_DATA_PATH: z.string().default(""),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug"]).default("info"),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

const DEMO_PASSWORD_KEYS = ["DEMO_ADMIN_PASSWORD", "DEMO_AUTHOR_PASSWORD"] as const;

/** Keep `#` in a demo password. Dotenv treats an unquoted `#` as a comment. */
export function demoPasswordValue(raw: string): string {
  const trimmed = raw.trim();
  const quoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2);
  return quoted ? trimmed.slice(1, -1) : trimmed;
}

function applyDemoPasswords(filePath: string): void {
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    if (!DEMO_PASSWORD_KEYS.includes(key as (typeof DEMO_PASSWORD_KEYS)[number])) continue;
    process.env[key] = demoPasswordValue(trimmed.slice(separator + 1));
  }
}

function loadEnvFile(): void {
  if (process.env.NODE_ENV === "test") return;
  const candidates = [
    path.resolve(process.cwd(), "backend/.env"),
    path.resolve(process.cwd(), ".env"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      loadDotenv({ path: candidate });
      applyDemoPasswords(candidate);
      return;
    }
  }
}

export function getEnv(): AppEnv {
  if (cached) return cached;
  loadEnvFile();
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid environment configuration. ${details}`);
  }
  if (parsed.data.NODE_ENV === "production") {
    if (!parsed.data.MONGODB_URI) {
      throw new Error("MONGODB_URI is required in production.");
    }
    if (parsed.data.COOKIE_SAMESITE === "none" && parsed.data.COOKIE_SECURE !== "true") {
      throw new Error("COOKIE_SECURE must be true when COOKIE_SAMESITE is none.");
    }
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvCache(): void {
  cached = null;
}

export function ttlToMs(ttl: string): number {
  const match = /^(\d+)([mhd])$/.exec(ttl);
  if (!match) throw new Error("Invalid duration.");
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === "m") return amount * 60_000;
  if (unit === "h") return amount * 3_600_000;
  return amount * 86_400_000;
}
