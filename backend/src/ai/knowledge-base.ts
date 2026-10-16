import type { TicketCategory, TicketPriority } from "@bookleaf/shared";

export interface PolicySection {
  id: string;
  title: string;
  categories: TicketCategory[];
  points: string[];
}

export interface SampleScenario {
  category: TicketCategory;
  priority: TicketPriority;
  query: string;
  guidance: string;
  safeNextStep: string;
}

export interface CalibrationExample {
  category: TicketCategory;
  priority: TicketPriority;
  query: string;
}

export const POLICY_SECTIONS: PolicySection[] = [
  {
    id: "company",
    title: "Company overview",
    categories: [
      "ROYALTY_PAYMENTS",
      "ISBN_METADATA",
      "PRINTING_QUALITY",
      "DISTRIBUTION_AVAILABILITY",
      "BOOK_STATUS_PRODUCTION",
      "GENERAL_INQUIRY",
    ],
    points: [
      "BookLeaf Publishing is a self-publishing company operating in India and the US.",
      "Packages are Standard Free (no upfront cost) and Bestseller Breakthrough (premium, with marketing and distribution add-ons).",
      "BookLeaf handles cover design, typesetting, ISBN assignment, printing, distribution, and royalty management.",
      "The in-house printing facility and warehouse are in Delhi. Print partners include Repro India and Epitome Books.",
    ],
  },
  {
    id: "royalty",
    title: "Royalty policy",
    categories: ["ROYALTY_PAYMENTS"],
    points: [
      "Authors receive 80% of net profit and BookLeaf retains 20%.",
      "Net profit is MRP minus printing cost, platform commission, and shipping.",
      "Royalties are calculated quarterly and paid within 45 days of the quarter ending.",
      "The minimum payout is ₹1,000. Amounts below that roll over to the next quarter.",
      "Payouts are bank transfers to the account linked in the author dashboard.",
      "Authors can view a platform-wise royalty breakdown in the dashboard.",
    ],
  },
  {
    id: "isbn",
    title: "ISBN policy",
    categories: ["ISBN_METADATA"],
    points: [
      "Every BookLeaf book receives a unique ISBN assigned by BookLeaf.",
      "ISBNs are registered under BookLeaf's publisher imprint.",
      "Authors who want an ISBN under their own imprint must obtain it independently.",
      "ISBN errors such as duplicates or the wrong book being linked are high priority and are escalated to production.",
    ],
  },
  {
    id: "printing",
    title: "Printing and quality",
    categories: ["PRINTING_QUALITY"],
    points: [
      "In-house printing handles most orders. Overflow or special formats go to Repro India or Epitome Books.",
      "Standard print turnaround is 5–7 business days from order confirmation.",
      "Verified quality defects, including misprints, binding defects, and color inconsistency, qualify for a free reprint.",
      "The author may need to share photos of the defective copy before the reprint is approved.",
    ],
  },
  {
    id: "distribution",
    title: "Distribution and availability",
    categories: ["DISTRIBUTION_AVAILABILITY"],
    points: [
      "Books are listed on Amazon India, Flipkart, Amazon US, Amazon UK, and the BookLeaf Store.",
      "New listings typically go live within 7–10 business days after publication is complete.",
      "An unavailable listing is usually a stock sync issue. The team can trigger a re-sync, which usually completes within 24–48 hours.",
    ],
  },
  {
    id: "production",
    title: "Production stages",
    categories: ["BOOK_STATUS_PRODUCTION"],
    points: [
      "Stages are: Manuscript Received, Editing (if opted), Cover Design, Typesetting, Proofreading, ISBN Assignment, Printing, Distribution Setup, then Published & Live.",
      "Authors are updated at each stage by email.",
      "Delays commonly happen at Cover Design while waiting for author approval, and at Proofreading during revision rounds.",
    ],
  },
  {
    id: "metadata",
    title: "Metadata updates",
    categories: ["GENERAL_INQUIRY"],
    points: [
      "Metadata updates, including a live book description, can be submitted through the dashboard or by emailing the BookLeaf team.",
      "Platform changes typically reflect within 3–5 business days.",
    ],
  },
  {
    id: "tone",
    title: "Communication tone",
    categories: [
      "ROYALTY_PAYMENTS",
      "ISBN_METADATA",
      "PRINTING_QUALITY",
      "DISTRIBUTION_AVAILABILITY",
      "BOOK_STATUS_PRODUCTION",
      "GENERAL_INQUIRY",
    ],
    points: [
      "Be empathetic and professional. Authors are partners.",
      "Acknowledge the concern before explaining the policy.",
      "Use specific numbers, dates, and statuses only when they are present in the supplied account data.",
      "If BookLeaf is at fault, say so directly.",
      "When investigation is required, give a clear timeline such as a follow-up within 48 hours.",
      "End with a clear next step.",
    ],
  },
];

export const SAMPLE_SCENARIOS: SampleScenario[] = [
  {
    category: "ROYALTY_PAYMENTS",
    priority: "HIGH",
    query:
      "I published my book 4 months ago and still haven't received any royalty. What's going on?",
    guidance:
      "Acknowledge the wait. Explain the quarterly cycle and the 45-day payout window. Mention linked bank details as something to verify. Do not invent a payout date. If the records show the payment is overdue, commit to a 48-hour follow-up.",
    safeNextStep:
      "Please confirm the bank account in your dashboard is current. We will check whether this balance is still inside the 45-day window and follow up within 48 hours. No payout date is available until that check is done.",
  },
  {
    category: "ROYALTY_PAYMENTS",
    priority: "MEDIUM",
    query: "My royalty amount seems too low. I sold 200 copies but only received ₹3,000.",
    guidance:
      "Explain net profit as MRP minus printing, platform commission, and shipping. Offer a line-by-line breakdown. Do not be defensive.",
    safeNextStep:
      "We can prepare a line-by-line breakdown of MRP, printing cost, platform commission, and shipping. This reply does not recalculate the royalty.",
  },
  {
    category: "ISBN_METADATA",
    priority: "HIGH",
    query: "My book is showing a different ISBN on Amazon than what's on the physical copy.",
    guidance:
      "Treat this as high priority. Acknowledge the data issue and say it will be escalated to production. Give a 48-hour follow-up timeline. Do not claim the ISBN has already been corrected.",
    safeNextStep:
      "We will escalate this ISBN mismatch to production and follow up within 48 hours. No correction has been made.",
  },
  {
    category: "PRINTING_QUALITY",
    priority: "HIGH",
    query:
      "I received my author copies and the print quality is terrible. The images are blurry and pages are misaligned.",
    guidance:
      "Apologise sincerely. Ask for photos of the defective copies. Explain that a free reprint is arranged after verification, with a 5–7 business day turnaround once approved. Do not say the reprint is already approved.",
    safeNextStep:
      "Please send photos of the defective copies. A free reprint is available only after verification, and the 5–7 business day turnaround starts after approval. A reprint approval is not on file.",
  },
  {
    category: "DISTRIBUTION_AVAILABILITY",
    priority: "HIGH",
    query: 'My book is published but it is showing as "Currently Unavailable" on Amazon.',
    guidance:
      "Explain that this is typically a stock sync issue and that the team can trigger a re-sync expected within 24–48 hours. Do not claim the re-sync has already been triggered or completed.",
    safeNextStep:
      "A stock re-sync can be triggered and usually finishes within 24–48 hours. A re-sync has not been triggered.",
  },
  {
    category: "BOOK_STATUS_PRODUCTION",
    priority: "MEDIUM",
    query: "It's been 3 weeks and my book is still in typesetting. When will it be done?",
    guidance:
      "Use the actual production status from the account data. Be honest about a delay and frame the next step collaboratively. Do not invent a completion date or claim a stage is finished.",
    safeNextStep:
      "The status quoted above is the status on file. We will confirm the next production step with you. No completion date is on file.",
  },
  {
    category: "GENERAL_INQUIRY",
    priority: "LOW",
    query: "Can I update the description of my book on Amazon after it's already live?",
    guidance:
      "Confirm that metadata updates can be submitted through the dashboard or by email. Changes typically reflect within 3–5 business days. Do not claim the description has already been changed.",
    safeNextStep:
      "You can submit the new description in the dashboard or by email. Platforms typically reflect metadata updates within 3–5 business days. No description change has been made.",
  },
];

const EXTRA_CALIBRATION: CalibrationExample[] = [
  {
    category: "ROYALTY_PAYMENTS",
    priority: "CRITICAL",
    query: "I haven't received any royalty for 6 months.",
  },
  {
    category: "GENERAL_INQUIRY",
    priority: "LOW",
    query: "Can I update my author bio?",
  },
];

export function calibrationExamples(): CalibrationExample[] {
  return [
    ...SAMPLE_SCENARIOS.map(({ category, priority, query }) => ({ category, priority, query })),
    ...EXTRA_CALIBRATION,
  ];
}

const ALWAYS_INCLUDED = new Set(["company", "tone"]);

export function policyForCategory(category: TicketCategory | null): PolicySection[] {
  return POLICY_SECTIONS.filter((section) => {
    if (ALWAYS_INCLUDED.has(section.id)) return true;
    if (!category) return section.id === "metadata";
    return (
      section.categories.includes(category) && section.id !== "company" && section.id !== "tone"
    );
  });
}

function keywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function wordsMatch(left: string, right: string): boolean {
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  return shorter.length >= 5 && longer.startsWith(shorter);
}

function overlapScore(ticketText: string, query: string): number {
  const ticketWords = keywords(ticketText);
  const queryWords = keywords(query);
  let score = 0;
  for (const word of queryWords) {
    if (ticketWords.some((candidate) => wordsMatch(candidate, word))) score += 1;
  }
  return score;
}

export function scenarioForCategory(category: TicketCategory | null): SampleScenario | null {
  if (!category) return null;
  return SAMPLE_SCENARIOS.find((scenario) => scenario.category === category) ?? null;
}

/**
 * Royalty has two samples with different next steps. Pick the sample whose
 * wording overlaps the ticket, instead of always using the first one.
 */
export function scenarioForTicket(input: {
  category: TicketCategory | null;
  subject: string;
  description: string;
}): SampleScenario | null {
  const pool = input.category
    ? SAMPLE_SCENARIOS.filter((scenario) => scenario.category === input.category)
    : SAMPLE_SCENARIOS;
  const first = pool[0];
  if (!first) return null;
  if (pool.length === 1) return first;
  const text = `${input.subject}\n${input.description}`;
  return pool.reduce((best, scenario) =>
    overlapScore(text, scenario.query) > overlapScore(text, best.query) ? scenario : best,
  );
}
