import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { verifyCsrfToken } from "../auth/csrf-token.js";
import { CSRF_COOKIE } from "../auth/cookies.js";
import { AppError } from "../lib/errors.js";
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
  const headerPresent = typeof header === "string" && header.length > 0;
  const cookiePresent = typeof cookie === "string" && cookie.length > 0;
  let reason: "header_missing" | "signature_invalid" | "token_expired" | "cookie_mismatch" | null = null;
  if (!headerPresent) {
    reason = "header_missing";
  } else {
    const verdict = verifyCsrfToken(header);
    if (verdict === "expired") reason = "token_expired";
    else if (verdict !== "ok") reason = "signature_invalid";
    else if (cookiePresent && !tokensMatch(header, cookie)) reason = "cookie_mismatch";
  }
  if (reason) {
    logger.warn("csrf rejected", {
      reason,
      headerPresent,
      cookiePresent,
      method: req.method,
      path: req.originalUrl,
    });
    next(new AppError(403, "CSRF_REJECTED", "Refresh the page and try again."));
    return;
  }
  next();
}
