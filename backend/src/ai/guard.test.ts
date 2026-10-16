import { describe, expect, it } from "vitest";
import { guardDraft, toPlainText } from "./guard.js";
import { policyForCategory } from "./knowledge-base.js";
import { buildClassificationMessages, buildDraftMessages } from "./prompts.js";

describe("draft guard", () => {
  it("removes unsupported operational claims", () => {
    const guarded = guardDraft(
      "Hello Priya. The payment has been processed. We have triggered a re-sync. The reprint is approved.",
    );
    expect(guarded.flagged).toBe(true);
    expect(guarded.text.toLowerCase()).not.toContain("payment has been processed");
    expect(guarded.text.toLowerCase()).not.toContain("re-sync");
    expect(guarded.text.toLowerCase()).toContain("verify the operational details");
  });

  it("strips html", () => {
    expect(toPlainText("<p>Hello <strong>there</strong></p>")).toBe("Hello there");
  });
});

describe("prompt context", () => {
  it("sends royalty policy without the printing section", () => {
    const messages = buildDraftMessages({
      authorName: "Priya Sharma",
      subject: "Royalty",
      description: "I have not received royalties.",
      category: "ROYALTY_PAYMENTS",
      priority: "HIGH",
      status: "OPEN",
      book: null,
    });
    const system = messages[0]?.content ?? "";
    expect(system).toContain("Do not invent");
    expect(system).toContain("80% of net profit");
    expect(system).not.toContain("free reprint");
    expect(policyForCategory("ROYALTY_PAYMENTS").map((section) => section.id)).toEqual(
      expect.arrayContaining(["company", "tone", "royalty"]),
    );
    expect(policyForCategory("ROYALTY_PAYMENTS").map((section) => section.id)).not.toContain(
      "printing",
    );
  });

  it("includes the calibration scenarios in classification", () => {
    const messages = buildClassificationMessages({
      subject: "Help",
      description: "I have a question.",
      bookStatus: null,
    });
    const system = messages[0]?.content ?? "";
    expect(system).toContain("4 months ago");
    expect(system).toContain("different ISBN");
    expect(system).toContain("typesetting");
    expect(system).toContain("CRITICAL");
  });
});
