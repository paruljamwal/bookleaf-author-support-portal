import {
  CATEGORY_LABELS,
  TICKET_CATEGORIES,
  type AuthorBook,
  type TicketCategory,
  type TicketPriority,
} from "@bookleaf/shared";
import { calibrationExamples, policyForCategory, scenarioForTicket } from "./knowledge-base.js";

export interface ClassificationPromptInput {
  subject: string;
  description: string;
  bookStatus: string | null;
}

export interface DraftPromptInput {
  authorName: string;
  subject: string;
  description: string;
  category: TicketCategory | null;
  priority: TicketPriority | null;
  status: string;
  book: AuthorBook | null;
}

function categoryList(): string {
  return TICKET_CATEGORIES.map((category) => `${category}: ${CATEGORY_LABELS[category]}`).join(
    "\n",
  );
}

export function buildClassificationMessages(input: ClassificationPromptInput): {
  role: "system" | "user";
  content: string;
}[] {
  const examples = calibrationExamples()
    .map((scenario) => `- "${scenario.query}" => ${scenario.category} / ${scenario.priority}`)
    .join("\n");
  const system = [
    "You classify BookLeaf author support tickets. Return JSON only with keys category, priority, and reasoningSummary.",
    "category must be exactly one of:",
    categoryList(),
    "priority must be exactly one of CRITICAL, HIGH, MEDIUM, LOW.",
    "Rubric: CRITICAL means royalties are unpaid for about 6 months or longer, or a confirmed payment failure is already outside the quarterly cycle plus the 45-day window. HIGH means ISBN mismatches, print defects, a live book showing unavailable, or royalties unpaid for roughly 3 to 5 months. MEDIUM means a royalty calculation question, a production-status question, or an issue that needs investigation but is not blocking sales today. LOW means a routine how-to such as an author bio or a simple metadata update.",
    "Use the whole ticket, not a single keyword. reasoningSummary must be one sentence under 400 characters.",
    "Calibration examples. Use the same category and priority for tickets that match them:",
    examples,
  ].join("\n");

  const user = [
    `Subject: ${input.subject}`,
    `Description: ${input.description}`,
    input.bookStatus ? `Book status on file: ${input.bookStatus}` : "Book: general account query",
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

function bookFacts(book: AuthorBook | null): string {
  if (!book) return "No specific book was selected.";
  const lines = [
    `Title: ${book.title}`,
    `Status: ${book.status}`,
    `ISBN: ${book.isbn ?? "not on file"}`,
    `Genre: ${book.genre ?? "not on file"}`,
    `Publication date: ${book.publicationDate ?? "not on file"}`,
    `MRP: ${book.mrp === null ? "not on file" : book.mrp}`,
    `Copies sold: ${book.totalCopiesSold}`,
    `Royalty earned: ${book.totalRoyaltyEarned}`,
    `Royalty paid: ${book.royaltyPaid}`,
    `Royalty pending: ${book.royaltyPending}`,
    `Last royalty payout date: ${book.lastRoyaltyPayoutDate ?? "none on file"}`,
    `Print partner: ${book.printPartner ?? "not on file"}`,
    `Available on: ${book.availableOn.length > 0 ? book.availableOn.join(", ") : "not listed"}`,
  ];
  return lines.join("\n");
}

export function buildDraftMessages(
  input: DraftPromptInput,
): { role: "system" | "user"; content: string }[] {
  const sections = policyForCategory(input.category);
  const policy = sections
    .map((section) => `${section.title}\n${section.points.map((point) => `- ${point}`).join("\n")}`)
    .join("\n\n");
  const example = scenarioForTicket(input);
  const allowedIds = sections.map((section) => section.id).join(", ");
  const system = [
    "You draft a BookLeaf author support reply for an admin to review. The draft is not sent automatically.",
    "Return JSON only with keys draftResponse, policyBasis, and requiresHumanVerification.",
    `policyBasis is an array of ids chosen only from: ${allowedIds}.`,
    "requiresHumanVerification is true when a payment date, reprint, stock re-sync, metadata change, or production completion still needs a person to confirm it.",
    "Do not invent royalty payment dates, payment confirmations, production progress, completed stock re-syncs, completed investigations, reprint approvals, or metadata changes.",
    "A policy that says the team can trigger a re-sync, or that a reprint is available after verification, is not permission to say that action has already happened.",
    "Quote a date, amount, ISBN, or status only when that exact value appears in the account facts. Zero is a real amount. A missing payout date means none is on file.",
    "If a fact is missing, say the team needs to verify it.",
    "Write plain text, not HTML. Acknowledge the concern, explain the relevant policy, and end with a next step.",
    "Policy context:",
    policy,
    example ? `Sample guidance for this kind of ticket: ${example.guidance}` : "",
    example ? `Safe next step to adapt, without adding actions: ${example.safeNextStep}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const user = [
    `Author name: ${input.authorName}`,
    `Ticket status: ${input.status}`,
    `Category: ${input.category ?? "unclassified"}`,
    `Priority: ${input.priority ?? "unset"}`,
    `Subject: ${input.subject}`,
    `Description: ${input.description}`,
    "Account facts:",
    bookFacts(input.book),
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
