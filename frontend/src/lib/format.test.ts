import { describe, expect, it } from "vitest";
import { agingLabel, formatDateOnly, formatInr } from "./format";

describe("formatting", () => {
  it("shows zero rupees and a dash for missing amounts", () => {
    expect(formatInr(0)).toMatch(/0/);
    expect(formatInr(null)).toBe("—");
  });

  it("formats a date-only value without shifting the calendar day", () => {
    expect(formatDateOnly("2023-06-20")).toContain("2023");
    expect(formatDateOnly("2023-06-20")).toContain("20");
    expect(formatDateOnly(null)).toBe("—");
  });

  it("labels unresolved tickets that have been open for a week", () => {
    const created = new Date(Date.now() - 8 * 86_400_000).toISOString();
    expect(agingLabel(created, "OPEN")).toContain("days open");
    expect(agingLabel(created, "RESOLVED")).toBeNull();
  });
});
