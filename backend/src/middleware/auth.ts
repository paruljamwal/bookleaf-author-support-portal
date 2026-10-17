import { subject } from "@casl/ability";
import type { NextFunction, Request, Response } from "express";
import { defineAbilityFor, type Action, type AppAbility, type SubjectName } from "@bookleaf/shared";
import { verifyAccessToken } from "../auth/tokens.js";
import { ACCESS_COOKIE } from "../auth/cookies.js";
import { AppError } from "../lib/errors.js";
import { UserModel } from "../models/User.js";

export interface RequestActor {
  id: string;
  email: string;
  name: string;
  role: "AUTHOR" | "ADMIN";
  authorPublicId: string | null;
  authorId: string | null;
  tokenVersion: number;
  ability: AppAbility;
}

declare global {
  // Express augments its Request type through the global namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      actor?: RequestActor;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[ACCESS_COOKIE];
    if (typeof token !== "string" || token.length === 0) {
      throw new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");
    }
    let claims;
    try {
      claims = verifyAccessToken(token);
    } catch (error) {
      if (error instanceof AppError && error.status === 401) {
        throw new AppError(401, "ACCESS_EXPIRED", "Sign in to continue.");
      }
      throw error;
    }
    const user = await UserModel.findById(claims.sub).select(
      "email name role author authorPublicId tokenVersion",
    );
    if (!user || user.tokenVersion !== claims.tv) {
      throw new AppError(401, "ACCESS_EXPIRED", "Sign in to continue.");
    }
    const authorPublicId = user.authorPublicId ?? null;
    req.actor = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      authorPublicId,
      authorId: user.author ? user.author.toString() : null,
      tokenVersion: user.tokenVersion,
      ability: defineAbilityFor({ role: user.role, authorPublicId }),
    };
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAbility(action: Action, subjectName: SubjectName) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.actor) {
      next(new AppError(401, "UNAUTHENTICATED", "Sign in to continue."));
      return;
    }
    if (req.actor.ability.cannot(action, subjectName)) {
      next(new AppError(403, "FORBIDDEN", "You do not have access to that action."));
      return;
    }
    next();
  };
}

export function assertCanReadOwned(
  actor: RequestActor,
  subjectName: "Book" | "Ticket",
  record: { authorPublicId: string },
): void {
  if (actor.ability.cannot("read", subject(subjectName, record))) {
    throw new AppError(404, "NOT_FOUND", "That record was not found.");
  }
}
