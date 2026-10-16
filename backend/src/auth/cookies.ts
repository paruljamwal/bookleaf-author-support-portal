import type { CookieOptions, Response } from "express";
import { getEnv, ttlToMs } from "../config/env.js";

export const ACCESS_COOKIE = "bookleaf_access";
export const REFRESH_COOKIE = "bookleaf_refresh";
export const CSRF_COOKIE = "bookleaf_csrf";

function baseOptions(): CookieOptions {
  const env = getEnv();
  return {
    secure: env.COOKIE_SECURE === "true" || env.NODE_ENV === "production",
    sameSite: env.COOKIE_SAMESITE,
    path: "/",
  };
}

export function setAccessCookie(res: Response, accessToken: string): void {
  const env = getEnv();
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseOptions(),
    httpOnly: true,
    maxAge: ttlToMs(env.JWT_ACCESS_TTL),
  });
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  const env = getEnv();
  const options = baseOptions();
  setAccessCookie(res, accessToken);
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...options,
    httpOnly: true,
    maxAge: ttlToMs(env.JWT_REFRESH_TTL),
    path: "/api/v1/auth",
  });
}

export function clearAuthCookies(res: Response): void {
  const options = baseOptions();
  res.clearCookie(ACCESS_COOKIE, { ...options, httpOnly: true });
  res.clearCookie(REFRESH_COOKIE, { ...options, httpOnly: true, path: "/api/v1/auth" });
}

export function setCsrfCookie(res: Response, token: string): void {
  const options = baseOptions();
  res.cookie(CSRF_COOKIE, token, {
    ...options,
    httpOnly: false,
    maxAge: 7 * 86_400_000,
  });
}
