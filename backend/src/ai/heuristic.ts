import { type TicketCategory, type TicketPriority } from "@bookleaf/shared";

export interface ClassificationSignals {
  category: TicketCategory;
  priority: TicketPriority;
  reasoningSummary: string;
}

interface Scores {
  royalty: number;
  isbn: number;
  printing: number;
  distribution: number;
  production: number;
  general: number;
}

function includesAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function unpaidMonths(text: string): number | null {
  const match = /(\d+)\s*(month|months)/.exec(text);
  if (!match) return null;
  if (!includesAny(text, ["royalt", "payment", "payout", "paid"])) return null;
  return Number(match[1]);
}

/**
 * Conservative suggestion used only when the language model is unavailable.
 * It scores several signals and is labeled FALLBACK in the ticket record.
 */
export function classifyHeuristically(subject: string, description: string): ClassificationSignals {
  const text = `${subject}\n${description}`.toLowerCase();
  const months = unpaidMonths(text);
  const scores: Scores = {
    royalty: 0,
    isbn: 0,
    printing: 0,
    distribution: 0,
    production: 0,
    general: 0,
  };

  if (includesAny(text, ["royalt", "payout", "payment", "paid", "₹", "rs "])) scores.royalty += 3;
  if (months !== null) scores.royalty += 2;
  if (includesAny(text, ["isbn"])) scores.isbn += 4;
  if (includesAny(text, ["metadata", "description", "author bio", "bio"])) scores.general += 2;
  if (includesAny(text, ["different isbn", "wrong isbn", "isbn on amazon"])) scores.isbn += 2;
  if (
    includesAny(text, [
      "print quality",
      "misprint",
      "blurry",
      "misaligned",
      "binding",
      "author copies",
    ])
  ) {
    scores.printing += 4;
  }
  if (includesAny(text, ["unavailable", "out of stock", "not listed", "amazon", "flipkart"])) {
    scores.distribution += 2;
  }
  if (includesAny(text, ["currently unavailable", "showing as unavailable", "not available"])) {
    scores.distribution += 3;
  }
  if (
    includesAny(text, ["typesetting", "cover design", "proofread", "in production", "manuscript"])
  ) {
    scores.production += 4;
  }
  if (
    includesAny(text, [
      "update the description",
      "update my author bio",
      "how do i",
      "can i update",
    ])
  ) {
    scores.general += 3;
  }

  const ranked = Object.entries(scores).sort((left, right) => right[1] - left[1]);
  const winner = ranked[0]?.[0] ?? "general";
  const topScore = ranked[0]?.[1] ?? 0;
  const category = categoryFromWinner(winner, topScore);

  let priority: TicketPriority = "MEDIUM";
  if (category === "ROYALTY_PAYMENTS" && months !== null && months >= 6) priority = "CRITICAL";
  else if (
    category === "ISBN_METADATA" &&
    includesAny(text, ["different", "wrong", "error", "mismatch"])
  ) {
    priority = "HIGH";
  } else if (category === "PRINTING_QUALITY") priority = "HIGH";
  else if (
    category === "DISTRIBUTION_AVAILABILITY" &&
    includesAny(text, ["unavailable", "not available"])
  ) {
    priority = "HIGH";
  } else if (category === "ROYALTY_PAYMENTS" && months !== null && months >= 3) priority = "HIGH";
  else if (category === "ROYALTY_PAYMENTS") priority = "MEDIUM";
  else if (category === "BOOK_STATUS_PRODUCTION") priority = "MEDIUM";
  else if (category === "GENERAL_INQUIRY") priority = "LOW";

  return {
    category,
    priority,
    reasoningSummary: `Fallback rubric matched ${category.toLowerCase().replaceAll("_", " ")} with ${priority.toLowerCase()} priority from the ticket wording.`,
  };
}

function categoryFromWinner(winner: string, score: number): TicketCategory {
  if (score <= 0) return "GENERAL_INQUIRY";
  if (winner === "royalty") return "ROYALTY_PAYMENTS";
  if (winner === "isbn") return "ISBN_METADATA";
  if (winner === "printing") return "PRINTING_QUALITY";
  if (winner === "distribution") return "DISTRIBUTION_AVAILABILITY";
  if (winner === "production") return "BOOK_STATUS_PRODUCTION";
  return "GENERAL_INQUIRY";
}
