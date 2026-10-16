import jwt from "jsonwebtoken";
import type { Role } from "@bookleaf/shared";
import { getEnv } from "../config/env.js";
import { AppError } from "../lib/errors.js";

export interface AccessClaims {
  sub: string;
  role: Role;
  authorPublicId: string | null;
  tv: number;
  typ: "access";
}

export interface RefreshClaims {
  sub: string;
  tv: number;
  typ: "refresh";
}

function isRole(value: unknown): value is Role {
  return value === "AUTHOR" || value === "ADMIN";
}

export function signAccessToken(input: Omit<AccessClaims, "typ">): string {
  const env = getEnv();
  return jwt.sign({ ...input, typ: "access" }, env.JWT_ACCESS_SECRET, {
    algorithm: "HS256",
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions["expiresIn"],
  });
}

export function signRefreshToken(input: Omit<RefreshClaims, "typ">): string {
  const env = getEnv();
  return jwt.sign({ ...input, typ: "refresh" }, env.JWT_REFRESH_SECRET, {
    algorithm: "HS256",
    expiresIn: env.JWT_REFRESH_TTL as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessClaims {
  const env = getEnv();
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ["HS256"] });
    if (typeof payload !== "object" || payload === null) throw new Error("invalid");
    if (payload.typ !== "access" || typeof payload.sub !== "string" || !isRole(payload.role)) {
      throw new Error("invalid");
    }
    const authorPublicId = payload.authorPublicId;
    if (authorPublicId !== null && typeof authorPublicId !== "string") throw new Error("invalid");
    if (typeof payload.tv !== "number") throw new Error("invalid");
    return {
      sub: payload.sub,
      role: payload.role,
      authorPublicId,
      tv: payload.tv,
      typ: "access",
    };
  } catch {
    throw new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");
  }
}

export function verifyRefreshToken(token: string): RefreshClaims {
  const env = getEnv();
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ["HS256"] });
    if (typeof payload !== "object" || payload === null) throw new Error("invalid");
    if (
      payload.typ !== "refresh" ||
      typeof payload.sub !== "string" ||
      typeof payload.tv !== "number"
    ) {
      throw new Error("invalid");
    }
    return { sub: payload.sub, tv: payload.tv, typ: "refresh" };
  } catch {
    throw new AppError(401, "UNAUTHENTICATED", "Your session has expired. Sign in again.");
  }
}
