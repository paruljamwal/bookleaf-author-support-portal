const ACTION_CLAIMS: RegExp[] = [
  /re-?sync has (already )?(been )?(completed|triggered|started|finished)/i,
  /\b(have|has|already) (triggered|completed|started|finished) (a |the )?re-?sync/i,
  /\breprint has been approved\b/i,
  /(?<!before )\bthe reprint is approved\b/i,
  /\byour reprint is approved\b/i,
  /\bwe (have )?(already )?approved (the |your )?reprint\b/i,
  /\b(payment|payout) has been (processed|sent|completed|released)\b/i,
  /\b(payment|payout|royalt\w*) (was|were) (processed|sent|completed|released|paid)\b/i,
  /\bwe (have )?(already )?(paid|processed|released|sent) (your )?(royalt|payment|payout)/i,
  /\bnext payout (date )?is\b/i,
  /\b(we )?(have )?(already )?(updated|changed|corrected) (the |your )?(metadata|description|isbn|listing)\b/i,
  /\binvestigation (is|has been) (now )?(complete|completed|finished)\b/i,
];

const PUBLICATION_CLAIM =
  /\byour book (is|has been) (now )?(published|printed|distributed|live)\b/i;

const DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/g;

export interface GuardContext {
  bookStatus?: string | null;
  lastRoyaltyPayoutDate?: string | null;
}

export function toPlainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/\s+\n/g, "\n")
    .trim();
}

function statusAllowsPublicationClaim(status: string | null | undefined): boolean {
  if (!status) return false;
  return /published|live/i.test(status);
}

function inventedPaymentDate(
  sentence: string,
  lastRoyaltyPayoutDate: string | null | undefined,
): boolean {
  if (!/\b(payout|payment|paid)\b/i.test(sentence)) return false;
  const dates = sentence.match(DATE_PATTERN) ?? [];
  if (dates.length === 0) return false;
  if (/\bnext payout\b/i.test(sentence)) return true;
  if (!lastRoyaltyPayoutDate) return true;
  return dates.some(
    (date) => date !== lastRoyaltyPayoutDate && !sentence.includes(lastRoyaltyPayoutDate),
  );
}

function isUnsupported(sentence: string, context: GuardContext): boolean {
  if (ACTION_CLAIMS.some((pattern) => pattern.test(sentence))) return true;
  if (inventedPaymentDate(sentence, context.lastRoyaltyPayoutDate)) return true;
  return PUBLICATION_CLAIM.test(sentence) && !statusAllowsPublicationClaim(context.bookStatus);
}

export function guardDraft(
  draft: string,
  context: GuardContext = {},
): { text: string; flagged: boolean } {
  const sentences = toPlainText(draft)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const kept = sentences.filter((sentence) => !isUnsupported(sentence, context));
  const flagged = kept.length !== sentences.length;
  const text = flagged
    ? `${kept.join(" ")}\n\nOur team still needs to verify the operational details before confirming any payment, reprint, stock update, or metadata change. We will follow up within 48 hours.`
    : kept.join(" ");
  return { text: text.trim(), flagged };
}
