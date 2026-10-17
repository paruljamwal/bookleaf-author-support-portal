import { randomBytes } from "node:crypto";
import { Router } from "express";
import { loginSchema, registerSchema } from "@bookleaf/shared";
import {
  ACCESS_COOKIE,
  clearAuthCookies,
  REFRESH_COOKIE,
  setAccessCookie,
  setAuthCookies,
  setCsrfCookie,
} from "../auth/cookies.js";
import { verifyAccessToken, verifyRefreshToken } from "../auth/tokens.js";
import { asyncHandler } from "../lib/async.js";
import { AppError } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { authenticate, refreshSession, registerAuthor, revokeSession } from "../services/auth.service.js";

function readCookie(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function sessionUserIds(accessCookie: unknown, refreshCookie: unknown): string[] {
  const ids = new Set<string>();
  const access = readCookie(accessCookie);
  if (access) {
    try {
      ids.add(verifyAccessToken(access).sub);
    } catch {
      // An expired access cookie can still be paired with a live refresh cookie.
    }
  }
  const refresh = readCookie(refreshCookie);
  if (refresh) {
    try {
      ids.add(verifyRefreshToken(refresh).sub);
    } catch {
      // Ignore a refresh cookie that is already expired or unsigned.
    }
  }
  return [...ids];
}

export const authRouter = Router();

authRouter.get(
  "/csrf",
  asyncHandler(async (req, res) => {
    const token = randomBytes(32).toString("hex");
    setCsrfCookie(req, res, token);
    res.json({ csrfToken: token });
  }),
);

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const session = await registerAuthor(body);
    setAuthCookies(req, res, session.accessToken, session.refreshToken);
    res.status(201).json({ user: session.user });
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const session = await authenticate(body.email, body.password);
    setAuthCookies(req, res, session.accessToken, session.refreshToken);
    res.json({ user: session.user });
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (typeof token !== "string" || token.length === 0) {
      throw new AppError(401, "UNAUTHENTICATED", "Your session has expired. Sign in again.");
    }
    const accessToken = await refreshSession(token);
    setAccessCookie(req, res, accessToken);
    res.json({ ok: true });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const userIds = sessionUserIds(req.cookies?.[ACCESS_COOKIE], req.cookies?.[REFRESH_COOKIE]);
    await Promise.all(userIds.map((userId) => revokeSession(userId)));
    clearAuthCookies(req, res);
    res.json({ ok: true });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.actor) throw new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");
    res.json({
      user: {
        id: req.actor.id,
        email: req.actor.email,
        name: req.actor.name,
        role: req.actor.role,
        authorPublicId: req.actor.authorPublicId,
      },
    });
  }),
);
