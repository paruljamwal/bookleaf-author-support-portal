import { randomBytes } from "node:crypto";
import type { AuthUser, RegisterInput } from "@bookleaf/shared";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../auth/tokens.js";
import { AppError } from "../lib/errors.js";
import { AuthorModel } from "../models/Author.js";
import { UserModel } from "../models/User.js";

let dummyHash: Promise<string> | null = null;

function placeholderHash(): Promise<string> {
  dummyHash ??= hashPassword("placeholder-password-not-used");
  return dummyHash;
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

async function newAuthorPublicId(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const authorId = `A${randomBytes(4).toString("hex").toUpperCase()}`;
    const existing = await AuthorModel.exists({ authorId });
    if (!existing) return authorId;
  }
  throw new AppError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
}

export async function registerAuthor(
  input: RegisterInput,
): Promise<{ user: AuthUser; accessToken: string; refreshToken: string }> {
  const email = input.email.toLowerCase();
  const name = input.name.trim();
  const existingUser = await UserModel.findOne({ email });
  const existingAuthor = await AuthorModel.findOne({ email });
  if (existingUser || existingAuthor) {
    throw new AppError(409, "CONFLICT", "An account with that email already exists.");
  }

  const authorId = await newAuthorPublicId();
  const joinedDate = new Date().toISOString().slice(0, 10);
  const author = await AuthorModel.create({
    authorId,
    name,
    email,
    joinedDate,
  });
  try {
    await UserModel.create({
      email,
      passwordHash: await hashPassword(input.password),
      name,
      role: "AUTHOR",
      author: author._id,
      authorPublicId: authorId,
      tokenVersion: 0,
    });
  } catch (error) {
    await AuthorModel.deleteOne({ _id: author._id });
    if (isDuplicateKey(error)) {
      throw new AppError(409, "CONFLICT", "An account with that email already exists.");
    }
    throw error;
  }
  return authenticate(email, input.password);
}

export async function authenticate(
  email: string,
  password: string,
): Promise<{
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}> {
  const user = await UserModel.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  const passwordHash = user?.passwordHash ?? (await placeholderHash());
  const matches = await verifyPassword(password, passwordHash);
  if (!user || !matches) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }
  const authorPublicId = user.authorPublicId ?? null;
  const authUser: AuthUser = {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    authorPublicId,
  };
  return {
    user: authUser,
    accessToken: signAccessToken({
      sub: authUser.id,
      role: authUser.role,
      authorPublicId,
      tv: user.tokenVersion,
    }),
    refreshToken: signRefreshToken({ sub: authUser.id, tv: user.tokenVersion }),
  };
}

export async function refreshSession(refreshToken: string): Promise<string> {
  const claims = verifyRefreshToken(refreshToken);
  const user = await UserModel.findById(claims.sub);
  if (!user || user.tokenVersion !== claims.tv) {
    throw new AppError(401, "UNAUTHENTICATED", "Your session has expired. Sign in again.");
  }
  return signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    authorPublicId: user.authorPublicId ?? null,
    tv: user.tokenVersion,
  });
}

export async function revokeSession(userId: string): Promise<void> {
  await UserModel.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
}
