import { describe, expect, it } from "vitest";
import { classifyHeuristically } from "./heuristic.js";

const scenarios = [
  {
    name: "royalties unpaid for four months",
    subject: "No royalty yet",
    description:
      "I published my book 4 months ago and still haven't received any royalty. What's going on?",
    category: "ROYALTY_PAYMENTS",
    priority: "HIGH",
  },
  {
    name: "royalty amount seems low",
    subject: "Royalty looks low",
    description: "My royalty amount seems too low. I sold 200 copies but only received ₹3,000.",
    category: "ROYALTY_PAYMENTS",
    priority: "MEDIUM",
  },
  {
    name: "isbn mismatch",
    subject: "ISBN does not match",
    description: "My book is showing a different ISBN on Amazon than what's on the physical copy.",
    category: "ISBN_METADATA",
    priority: "HIGH",
  },
  {
    name: "print quality",
    subject: "Poor author copies",
    description:
      "I received my author copies and the print quality is terrible. The images are blurry and pages are misaligned.",
    category: "PRINTING_QUALITY",
    priority: "HIGH",
  },
  {
    name: "amazon unavailable",
    subject: "Unavailable on Amazon",
    description: 'My book is published but it is showing as "Currently Unavailable" on Amazon.',
    category: "DISTRIBUTION_AVAILABILITY",
    priority: "HIGH",
  },
  {
    name: "typesetting delay",
    subject: "Still in typesetting",
    description: "It's been 3 weeks and my book is still in typesetting. When will it be done?",
    category: "BOOK_STATUS_PRODUCTION",
    priority: "MEDIUM",
  },
  {
    name: "live description update",
    subject: "Update Amazon description",
    description: "Can I update the description of my book on Amazon after it's already live?",
    category: "GENERAL_INQUIRY",
    priority: "LOW",
  },
] as const;

describe("classification rubric", () => {
  it.each(scenarios)("classifies $name", (scenario) => {
    const result = classifyHeuristically(scenario.subject, scenario.description);
    expect(result.category).toBe(scenario.category);
    expect(result.priority).toBe(scenario.priority);
  });

  it("treats six months without royalties as critical and a bio update as low", () => {
    const overdue = classifyHeuristically(
      "Missing royalties",
      "I haven't received any royalty for 6 months.",
    );
    const bio = classifyHeuristically("Author bio", "Can I update my author bio?");
    expect(overdue.category).toBe("ROYALTY_PAYMENTS");
    expect(overdue.priority).toBe("CRITICAL");
    expect(bio.category).toBe("GENERAL_INQUIRY");
    expect(bio.priority).toBe("LOW");
  });
});
