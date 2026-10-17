import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";
import { CSRF_COOKIE } from "../auth/cookies.js";
import { logger } from "../lib/logger.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function tokensMatch(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function requireCsrf(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const header = req.get("x-csrf-token");
  const cookie = req.cookies?.[CSRF_COOKIE];
  let reason: "header_missing" | "cookie_missing" | "mismatch" | null = null;
  if (typeof header !== "string") reason = "header_missing";
  else if (typeof cookie !== "string") reason = "cookie_missing";
  else if (!tokensMatch(header, cookie)) reason = "mismatch";
  if (reason) {
    logger.warn("csrf rejected", { reason, method: req.method, path: req.originalUrl });
    next(new AppError(403, "CSRF_REJECTED", "Refresh the page and try again."));
    return;
  }
  next();
}
