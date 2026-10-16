import { describe, expect, it } from "vitest";
import type { AuthorBook } from "@bookleaf/shared";
import { TICKET_CATEGORIES } from "@bookleaf/shared";
import { guardDraft, toPlainText } from "./guard.js";
import {
  POLICY_SECTIONS,
  SAMPLE_SCENARIOS,
  calibrationExamples,
  policyForCategory,
  scenarioForTicket,
} from "./knowledge-base.js";
import { normalizeClassification, parseModelJson, sanitizePolicyBasis } from "./output.js";
import { buildClassificationMessages, buildDraftMessages } from "./prompts.js";
import { buildFallbackDraft } from "./process.js";

const FORBIDDEN = [
  "re-sync has been",
  "have triggered",
  "reprint has been approved",
  "payment has been processed",
  "payment was sent",
  "we have paid",
  "we have updated",
  "next payout date is",
  "investigation is complete",
  "your book has been published",
];

const book: AuthorBook = {
  bookId: "BK015",
  title: "The Moonlit Verandah",
  isbn: "978-93-0000000-0",
  genre: "Fiction",
  publicationDate: null,
  status: "In Production - Typesetting",
  mrp: null,
  authorRoyaltyPerCopy: null,
  totalCopiesSold: 0,
  totalRoyaltyEarned: 0,
  royaltyPaid: 0,
  royaltyPending: 0,
  lastRoyaltyPayoutDate: null,
  printPartner: null,
  availableOn: [],
};

function draftFor(query: string, category: (typeof SAMPLE_SCENARIOS)[number]["category"]) {
  return buildFallbackDraft({
    authorName: "Priya Sharma",
    subject: query.slice(0, 80),
    description: query,
    category,
    priority: "MEDIUM",
    status: "OPEN",
    book,
  });
}

describe("knowledge base coverage", () => {
  it("gives every category the company and tone sections plus a specific policy", () => {
    for (const category of TICKET_CATEGORIES) {
      const ids = policyForCategory(category).map((section) => section.id);
      expect(ids).toContain("company");
      expect(ids).toContain("tone");
      expect(ids.filter((id) => id !== "company" && id !== "tone").length).toBeGreaterThan(0);
    }
  });

  it("keeps the seven assignment scenarios and labels the priority contrasts", () => {
    expect(SAMPLE_SCENARIOS).toHaveLength(7);
    const examples = calibrationExamples();
    expect(examples).toHaveLength(9);
    expect(examples.find((item) => item.query.includes("6 months"))?.priority).toBe("CRITICAL");
    expect(examples.find((item) => item.query.includes("author bio"))?.priority).toBe("LOW");
  });

  it.each(SAMPLE_SCENARIOS)("selects the matching sample for $category", (scenario) => {
    const match = scenarioForTicket({
      category: scenario.category,
      subject: scenario.query,
      description: scenario.query,
    });
    expect(match?.query).toBe(scenario.query);
    expect(match?.priority).toBe(scenario.priority);
  });
});

describe("prompt budgets", () => {
  it("labels calibration examples without sending the full knowledge base", () => {
    const messages = buildClassificationMessages({
      subject: "Help",
      description: "I have a question about my book.",
      bookStatus: null,
    });
    const system = messages[0]?.content ?? "";
    const size = messages.reduce((total, message) => total + message.content.length, 0);
    expect(size).toBeLessThan(4500);
    expect(system).toContain("ROYALTY_PAYMENTS / HIGH");
    expect(system).toContain("ISBN_METADATA / HIGH");
    expect(system).toContain("PRINTING_QUALITY / HIGH");
    expect(system).toContain("DISTRIBUTION_AVAILABILITY / HIGH");
    expect(system).toContain("BOOK_STATUS_PRODUCTION / MEDIUM");
    expect(system).toContain("GENERAL_INQUIRY / LOW");
    expect(system).toContain("ROYALTY_PAYMENTS / CRITICAL");
    expect(system).not.toContain("Epitome Books");
    expect(system).not.toContain("₹1,000");
    expect(system).not.toContain("free reprint");
  });

  it("uses the low-royalty sample instead of the unpaid-royalty sample", () => {
    const low = SAMPLE_SCENARIOS[1];
    const unpaid = SAMPLE_SCENARIOS[0];
    if (!low || !unpaid) throw new Error("Missing royalty samples.");
    const messages = buildDraftMessages({
      authorName: "Priya Sharma",
      subject: "Royalty amount",
      description: low.query,
      category: "ROYALTY_PAYMENTS",
      priority: "MEDIUM",
      status: "OPEN",
      book,
    });
    const system = messages[0]?.content ?? "";
    expect(system).toContain("80% of net profit");
    expect(system).toContain("line-by-line breakdown");
    expect(system).not.toContain("linked bank details");
    expect(system).not.toContain("free reprint");
    expect(system).toContain(low.safeNextStep);
    expect(system).not.toContain(unpaid.safeNextStep);
  });

  it("keeps category prompts on the relevant policy", () => {
    const isbn =
      buildDraftMessages({
        authorName: "Vikram Joshi",
        subject: "ISBN",
        description: SAMPLE_SCENARIOS[2]?.query ?? "",
        category: "ISBN_METADATA",
        priority: "HIGH",
        status: "OPEN",
        book,
      })[0]?.content ?? "";
    expect(isbn).toContain("escalated to production");
    expect(isbn).not.toContain("3–5 business days");
    expect(isbn).not.toContain("80% of net profit");

    const distribution =
      buildDraftMessages({
        authorName: "Priya Sharma",
        subject: "Unavailable",
        description: SAMPLE_SCENARIOS[4]?.query ?? "",
        category: "DISTRIBUTION_AVAILABILITY",
        priority: "HIGH",
        status: "OPEN",
        book,
      })[0]?.content ?? "";
    expect(distribution).toContain("24–48 hours");
    expect(distribution).toContain("has already been triggered");
    expect(distribution).not.toContain("free reprint");

    const production =
      buildDraftMessages({
        authorName: "Sneha Kulkarni",
        subject: "Typesetting",
        description: SAMPLE_SCENARIOS[5]?.query ?? "",
        category: "BOOK_STATUS_PRODUCTION",
        priority: "MEDIUM",
        status: "OPEN",
        book,
      })[0]?.content ?? "";
    expect(production).toContain("Typesetting");
    expect(production).toContain("Cover Design");
    expect(production).not.toContain("free reprint");
    expect(
      POLICY_SECTIONS.find((section) => section.id === "production")?.points.join(" "),
    ).toContain("Proofreading");
  });
});

describe("fallback drafts", () => {
  it.each(SAMPLE_SCENARIOS)("stays inside confirmed facts for $category", (scenario) => {
    const draft = draftFor(scenario.query, scenario.category);
    const text = draft.response.toLowerCase();
    expect(draft.requiresHumanVerification).toBe(true);
    expect(draft.response).toContain(scenario.safeNextStep);
    expect(draft.response).toContain("In Production - Typesetting");
    expect(draft.response).toContain("₹0");
    expect(text).toContain("none");
    for (const phrase of FORBIDDEN) {
      expect(text).not.toContain(phrase);
    }
  });

  it("quotes a payout date only when that date is on file", () => {
    const draft = buildFallbackDraft({
      authorName: "Priya Sharma",
      subject: "Royalty",
      description: SAMPLE_SCENARIOS[0]?.query ?? "",
      category: "ROYALTY_PAYMENTS",
      priority: "HIGH",
      status: "OPEN",
      book: {
        ...book,
        status: "Published",
        royaltyPaid: 8400,
        royaltyPending: 3570,
        lastRoyaltyPayoutDate: "2024-06-30",
      },
    });
    expect(draft.response).toContain("2024-06-30");
    expect(draft.response).toContain("₹8400");
    expect(draft.response.toLowerCase()).not.toContain("next payout date is");
    expect(draft.response).toContain("No payout date is available until that check is done.");
  });
});

describe("structured output and claim guard", () => {
  it("parses fenced and prefixed JSON and normalizes labels", () => {
    const fenced = parseModelJson(
      '```json\n{"category":"LOW","priority":"LOW","reasoningSummary":"Routine."}\n```',
    );
    expect(fenced).toMatchObject({ category: "LOW" });
    const prefixed = parseModelJson(
      'Here is the result: {"category":"Printing & Quality","priority":"high","reasoningSummary":"Print defect."}',
    );
    expect(normalizeClassification(prefixed)).toMatchObject({
      category: "PRINTING_QUALITY",
      priority: "HIGH",
    });
    expect(() => parseModelJson("no object here")).toThrow();
    expect(
      sanitizePolicyBasis(["Royalty policy", "invented", "printing"], ["royalty", "printing"]),
    ).toEqual(["royalty", "printing"]);
    expect(sanitizePolicyBasis(["not-a-policy"], ["tone"])).toEqual(["tone"]);
  });

  it("removes unconfirmed actions and keeps confirmed status and payout dates", () => {
    const claimed = guardDraft(
      "Hello Priya. The payment has been processed. We have triggered a re-sync. The reprint is approved. Your next payout date is 15 January 2026. We updated the description.",
    );
    expect(claimed.flagged).toBe(true);
    expect(claimed.text.toLowerCase()).not.toContain("payment has been processed");
    expect(claimed.text.toLowerCase()).not.toContain("triggered a re-sync");
    expect(claimed.text.toLowerCase()).not.toContain("reprint is approved");
    expect(claimed.text.toLowerCase()).not.toContain("15 january 2026");
    expect(claimed.text.toLowerCase()).not.toContain("updated the description");
    expect(claimed.text.toLowerCase()).toContain("verify the operational details");

    const quoted = guardDraft("Last payout date on file: 2024-06-30. Your book is published.", {
      bookStatus: "Published & Live",
      lastRoyaltyPayoutDate: "2024-06-30",
    });
    expect(quoted.flagged).toBe(false);
    expect(quoted.text).toContain("2024-06-30");
    expect(quoted.text).toContain("Your book is published.");

    const early = guardDraft("Your book has been published.", {
      bookStatus: "In Production - Typesetting",
    });
    expect(early.flagged).toBe(true);
    expect(early.text.toLowerCase()).not.toContain("has been published");
    expect(toPlainText("<p>Hello <strong>there</strong></p>")).toBe("Hello there");

    const policy = guardDraft(
      "Verified defects qualify for a free reprint before the reprint is approved. A re-sync has not been triggered.",
    );
    expect(policy.flagged).toBe(false);
  });
});
