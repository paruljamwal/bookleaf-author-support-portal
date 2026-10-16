import { z } from "zod";
import {
  CATEGORY_LABELS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  type TicketCategory,
} from "@bookleaf/shared";
import { POLICY_SECTIONS } from "./knowledge-base.js";

export const classificationSchema = z.object({
  category: z.enum(TICKET_CATEGORIES),
  priority: z.enum(TICKET_PRIORITIES),
  reasoningSummary: z.string().trim().min(1).max(500),
});

export const draftSchema = z.object({
  draftResponse: z.string().trim().min(40).max(5000),
  policyBasis: z.array(z.string().trim().min(1).max(80)).max(8),
  requiresHumanVerification: z.boolean(),
});

export type ClassificationOutput = z.infer<typeof classificationSchema>;
export type DraftOutput = z.infer<typeof draftSchema>;

const POLICY_IDS = new Set(POLICY_SECTIONS.map((section) => section.id));
const POLICY_TITLES = new Map(
  POLICY_SECTIONS.map((section) => [section.title.toLowerCase(), section.id]),
);

export function parseModelJson(content: string): unknown {
  const trimmed = content
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start)
      throw new SyntaxError("The model response did not contain JSON.");
    return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
  }
}

export function normalizeClassification(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  const record = { ...(value as Record<string, unknown>) };
  if (typeof record.category === "string") record.category = normalizeCategory(record.category);
  if (typeof record.priority === "string") record.priority = normalizePriority(record.priority);
  if (typeof record.reasoningSummary === "string")
    record.reasoningSummary = record.reasoningSummary.trim().slice(0, 500);
  return record;
}

function normalizeCategory(raw: string): string {
  const trimmed = raw.trim();
  const fromLabel = (Object.entries(CATEGORY_LABELS) as [TicketCategory, string][]).find(
    ([, label]) => label.toLowerCase() === trimmed.toLowerCase(),
  );
  if (fromLabel) return fromLabel[0];
  const compact = trimmed
    .toUpperCase()
    .replace(/[^A-Z]+/g, "_")
    .replace(/^_|_$/g, "");
  return (TICKET_CATEGORIES as readonly string[]).includes(compact) ? compact : trimmed;
}

function normalizePriority(raw: string): string {
  const compact = raw.trim().toUpperCase();
  return (TICKET_PRIORITIES as readonly string[]).includes(compact) ? compact : raw.trim();
}

export function sanitizePolicyBasis(values: string[], allowed: readonly string[]): string[] {
  const allowedIds = new Set(allowed);
  const cleaned = values
    .map((value) => {
      const trimmed = value.trim();
      if (POLICY_IDS.has(trimmed) && allowedIds.has(trimmed)) return trimmed;
      const fromTitle = POLICY_TITLES.get(trimmed.toLowerCase());
      if (fromTitle && allowedIds.has(fromTitle)) return fromTitle;
      return null;
    })
    .filter((value): value is string => value !== null);
  const unique = [...new Set(cleaned)];
  return unique.length > 0 ? unique : [...allowedIds];
}
