import { subject } from "@casl/ability";
import { defineAbilityFor } from "@bookleaf/shared";
import { describe, expect, it } from "vitest";

describe("abilities", () => {
  const author = defineAbilityFor({ role: "AUTHOR", authorPublicId: "AUTH001" });
  const admin = defineAbilityFor({ role: "ADMIN", authorPublicId: null });

  it("lets an author read only their own books and tickets", () => {
    expect(author.can("read", subject("Book", { authorPublicId: "AUTH001" }))).toBe(true);
    expect(author.can("read", subject("Book", { authorPublicId: "AUTH002" }))).toBe(false);
    expect(author.can("read", subject("Ticket", { authorPublicId: "AUTH001" }))).toBe(true);
    expect(author.can("read", subject("Ticket", { authorPublicId: "AUTH002" }))).toBe(false);
    expect(author.can("create", "Ticket")).toBe(true);
    expect(
      author.can("read", subject("Reply", { authorPublicId: "AUTH001", visibility: "AUTHOR_VISIBLE" as const })),
    ).toBe(true);
    expect(author.can("read", subject("Reply", { authorPublicId: "AUTH001", visibility: "INTERNAL" as const }))).toBe(
      false,
    );
    expect(author.can("create", "InternalNote")).toBe(false);
    expect(author.can("read", "AdminArea")).toBe(false);
  });

  it("lets an admin manage support operations", () => {
    expect(admin.can("read", "AdminArea")).toBe(true);
    expect(admin.can("update", "AdminArea")).toBe(true);
    expect(admin.can("create", "InternalNote")).toBe(true);
    expect(admin.can("read", subject("Ticket", { authorPublicId: "AUTH009" }))).toBe(true);
  });
});
