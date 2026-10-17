import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getEnv } from "../config/env.js";

const TTL_SECONDS = 7 * 24 * 60 * 60;

function sign(payload: string): string {
  return createHmac("sha256", getEnv().JWT_ACCESS_SECRET).update(payload).digest("hex");
}

function macMatches(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Signed token returned in JSON. The same value is stored in the CSRF cookie when the browser keeps it. */
export function issueCsrfToken(now = Date.now()): string {
  const nonce = randomBytes(32).toString("hex");
  const expiresAt = Math.floor(now / 1000) + TTL_SECONDS;
  const payload = `${nonce}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyCsrfToken(token: string, now = Date.now()): "ok" | "invalid" | "expired" {
  const parts = token.split(".");
  if (parts.length !== 3) return "invalid";
  const [nonce, expiresText, mac] = parts;
  if (!nonce || !/^[a-f0-9]{64}$/.test(nonce) || !expiresText || !/^\d+$/.test(expiresText) || !mac) {
    return "invalid";
  }
  if (!macMatches(mac, sign(`${nonce}.${expiresText}`))) return "invalid";
  const expiresAt = Number(expiresText);
  if (!Number.isFinite(expiresAt) || expiresAt * 1000 <= now) return "expired";
  return "ok";
}
