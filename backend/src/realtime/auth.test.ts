import { defineAbilityFor } from "@bookleaf/shared";
import { describe, expect, it } from "vitest";
import type { RequestActor } from "../middleware/auth.js";
import { assertChannelAccess } from "./auth.js";

function author(authorPublicId: string): RequestActor {
  return {
    id: "user-1",
    email: "author@email.com",
    name: "Author",
    role: "AUTHOR",
    authorPublicId,
    authorId: "author-1",
    tokenVersion: 0,
    ability: defineAbilityFor({ role: "AUTHOR", authorPublicId }),
  };
}

describe("realtime channel access", () => {
  it("allows a seeded author and a self-registered author on their own channels", async () => {
    await expect(assertChannelAccess(author("AUTH001"), "private-author-AUTH001")).resolves.toBeUndefined();
    await expect(assertChannelAccess(author("A12B34C5D"), "private-author-A12B34C5D")).resolves.toBeUndefined();
  });

  it("rejects another author's channel and an unknown channel name", async () => {
    await expect(assertChannelAccess(author("A12B34C5D"), "private-author-AUTH001")).rejects.toMatchObject({
      status: 403,
    });
    await expect(assertChannelAccess(author("A12B34C5D"), "private-author-A12B34C5D-extra")).rejects.toMatchObject({
      status: 403,
    });
  });
});
