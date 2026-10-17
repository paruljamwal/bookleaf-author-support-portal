import type { CookieOptions, Request, Response } from "express";
import { getEnv, ttlToMs } from "../config/env.js";

export const ACCESS_COOKIE = "bookleaf_access";
export const REFRESH_COOKIE = "bookleaf_refresh";
export const CSRF_COOKIE = "bookleaf_csrf";

type AppCookieOptions = CookieOptions & { partitioned?: boolean };

function allowedOrigins(): string[] {
  return getEnv()
    .CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/** A credentialed browser call from another host cannot send a SameSite=Lax cookie. */
export function crossSiteRequest(req: Request): boolean {
  const origin = req.get("origin");
  if (!origin || !allowedOrigins().includes(origin)) return false;
  let originHost = "";
  try {
    originHost = new URL(origin).hostname;
  } catch {
    return false;
  }
  return originHost.length > 0 && originHost !== req.hostname;
}

function baseOptions(req: Request): AppCookieOptions {
  const env = getEnv();
  const crossSite = crossSiteRequest(req);
  return {
    secure: env.COOKIE_SECURE === "true" || env.NODE_ENV === "production" || crossSite,
    sameSite: crossSite ? "none" : env.COOKIE_SAMESITE,
    path: "/",
    ...(crossSite ? { partitioned: true } : {}),
  };
}

export function setAccessCookie(req: Request, res: Response, accessToken: string): void {
  const env = getEnv();
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseOptions(req),
    httpOnly: true,
    maxAge: ttlToMs(env.JWT_ACCESS_TTL),
  });
}

export function setAuthCookies(req: Request, res: Response, accessToken: string, refreshToken: string): void {
  const env = getEnv();
  const options = baseOptions(req);
  setAccessCookie(req, res, accessToken);
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...options,
    httpOnly: true,
    maxAge: ttlToMs(env.JWT_REFRESH_TTL),
    path: "/api/v1/auth",
  });
}

export function clearAuthCookies(req: Request, res: Response): void {
  const options = baseOptions(req);
  res.clearCookie(ACCESS_COOKIE, { ...options, httpOnly: true });
  res.clearCookie(REFRESH_COOKIE, { ...options, httpOnly: true, path: "/api/v1/auth" });
}

export function setCsrfCookie(req: Request, res: Response, token: string): void {
  res.cookie(CSRF_COOKIE, token, {
    ...baseOptions(req),
    httpOnly: false,
    maxAge: 7 * 86_400_000,
  });
}
