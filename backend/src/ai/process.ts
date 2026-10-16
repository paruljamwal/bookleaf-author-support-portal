import { getEnv } from "../config/env.js";
import { AiUsageModel } from "../models/AiUsage.js";
import { AuthorModel } from "../models/Author.js";
import { BookModel } from "../models/Book.js";
import { TicketModel } from "../models/Ticket.js";
import { logger } from "../lib/logger.js";
import { policyForCategory, scenarioForTicket } from "./knowledge-base.js";
import { classifyHeuristically } from "./heuristic.js";
import { guardDraft } from "./guard.js";
import { OpenAiCompatibleProvider } from "./openai-provider.js";
import {
  classificationSchema,
  draftSchema,
  normalizeClassification,
  parseModelJson,
  sanitizePolicyBasis,
  type ClassificationOutput,
} from "./output.js";
import {
  buildClassificationMessages,
  buildDraftMessages,
  type DraftPromptInput,
} from "./prompts.js";
import { AiProviderError, type AiProvider } from "./provider.js";
import type { AuthorBook, DecisionSource, TicketCategory, TicketPriority } from "@bookleaf/shared";
import { PRIORITY_RANK } from "@bookleaf/shared";
import { toAuthorBook } from "../services/dto.js";

let providerOverride: AiProvider | null = null;

export function setAiProviderForTests(provider: AiProvider | null): void {
  providerOverride = provider;
}

function provider(): AiProvider {
  return providerOverride ?? new OpenAiCompatibleProvider();
}

async function recordUsage(input: {
  ticketId: string;
  operation: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number;
  success: boolean;
  errorCode: string | null;
}): Promise<void> {
  await AiUsageModel.create({
    ticketPublicId: input.ticketId,
    operation: input.operation,
    model: input.model,
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
    latencyMs: input.latencyMs,
    success: input.success,
    errorCode: input.errorCode,
  });
}

export async function classifyWithProvider(
  subject: string,
  description: string,
  bookStatus: string | null,
  ticketId = "unscoped",
): Promise<{ output: ClassificationOutput; model: string; source: DecisionSource }> {
  const started = Date.now();
  try {
    const result = await provider().complete({
      operation: "classify",
      messages: buildClassificationMessages({ subject, description, bookStatus }),
      maxTokens: 180,
      temperature: 0.1,
    });
    let parsed: unknown;
    try {
      parsed = parseModelJson(result.content);
    } catch {
      throw new AiProviderError("INVALID_OUTPUT", "The language model returned malformed JSON.");
    }
    const output = classificationSchema.safeParse(normalizeClassification(parsed));
    if (!output.success) {
      throw new AiProviderError(
        "INVALID_OUTPUT",
        "The language model returned an unsupported classification.",
      );
    }
    await recordUsage({
      ticketId,
      operation: "classify",
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      latencyMs: Date.now() - started,
      success: true,
      errorCode: null,
    }).catch(() => undefined);
    return { output: output.data, model: result.model, source: "AI" };
  } catch (error) {
    const code = error instanceof AiProviderError ? error.code : "UPSTREAM";
    logger.warn("classification provider failed", { code });
    await recordUsage({
      ticketId,
      operation: "classify",
      model: getEnv().AI_MODEL,
      promptTokens: null,
      completionTokens: null,
      latencyMs: Date.now() - started,
      success: false,
      errorCode: code,
    }).catch(() => undefined);
    throw error;
  }
}

export function buildFallbackDraft(input: DraftPromptInput): {
  response: string;
  policyBasis: string[];
  requiresHumanVerification: true;
} {
  const sections = policyForCategory(input.category).filter(
    (section) => section.id !== "company" && section.id !== "tone",
  );
  const policyText = sections.flatMap((section) => section.points).join(" ");
  const scenario = scenarioForTicket(input);
  const bookLine = input.book
    ? `Our records for "${input.book.title}" show status "${input.book.status}", royalty paid of ₹${input.book.royaltyPaid}, and royalty pending of ₹${input.book.royaltyPending}. Last payout date on file: ${input.book.lastRoyaltyPayoutDate ?? "none"}.`
    : "This is an account-level query, so it is not tied to one book.";
  return {
    response: [
      `Hello ${input.authorName}, thank you for writing to us about "${input.subject}". We have noted your concern.`,
      policyText || "We will review this against your account and the relevant BookLeaf policy.",
      bookLine,
      scenario?.safeNextStep ??
        "Our team needs to verify the operational details before confirming a payment date, reprint, stock update, or metadata change. We will follow up within 48 hours with the next step.",
    ].join("\n\n"),
    policyBasis: sections.map((section) => section.id),
    requiresHumanVerification: true,
  };
}

async function draftWithProvider(
  input: DraftPromptInput,
  ticketId: string,
): Promise<{
  response: string;
  policyBasis: string[];
  requiresHumanVerification: boolean;
  source: DecisionSource;
  model: string;
}> {
  if (!getEnv().AI_API_KEY && !providerOverride) {
    await recordUsage({
      ticketId,
      operation: "draft",
      model: "fallback",
      promptTokens: null,
      completionTokens: null,
      latencyMs: 0,
      success: false,
      errorCode: "UPSTREAM",
    }).catch(() => undefined);
    const fallback = buildFallbackDraft(input);
    return { ...fallback, source: "FALLBACK", model: "fallback" };
  }
  const started = Date.now();
  try {
    const result = await provider().complete({
      operation: "draft",
      messages: buildDraftMessages(input),
      maxTokens: 500,
      temperature: 0.2,
    });
    let parsed: unknown;
    try {
      parsed = parseModelJson(result.content);
    } catch {
      throw new AiProviderError("INVALID_OUTPUT", "The language model returned malformed JSON.");
    }
    const output = draftSchema.safeParse(parsed);
    if (!output.success)
      throw new AiProviderError("INVALID_OUTPUT", "The draft did not match the required format.");
    const allowedBasis = policyForCategory(input.category).map((section) => section.id);
    const guarded = guardDraft(output.data.draftResponse, {
      bookStatus: input.book?.status ?? null,
      lastRoyaltyPayoutDate: input.book?.lastRoyaltyPayoutDate ?? null,
    });
    await recordUsage({
      ticketId,
      operation: "draft",
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      latencyMs: Date.now() - started,
      success: true,
      errorCode: null,
    }).catch(() => undefined);
    if (guarded.text.length < 40) {
      const fallback = buildFallbackDraft(input);
      return { ...fallback, source: "FALLBACK", model: "fallback" };
    }
    return {
      response: guarded.text,
      policyBasis: sanitizePolicyBasis(output.data.policyBasis, allowedBasis),
      requiresHumanVerification: output.data.requiresHumanVerification || guarded.flagged,
      source: "AI",
      model: result.model,
    };
  } catch (error) {
    const code = error instanceof AiProviderError ? error.code : "UPSTREAM";
    logger.warn("draft provider failed", { code });
    await recordUsage({
      ticketId,
      operation: "draft",
      model: getEnv().AI_MODEL,
      promptTokens: null,
      completionTokens: null,
      latencyMs: Date.now() - started,
      success: false,
      errorCode: code,
    }).catch(() => undefined);
    const fallback = buildFallbackDraft(input);
    return { ...fallback, source: "FALLBACK", model: "fallback" };
  }
}

async function loadBook(bookPublicId: string | null): Promise<AuthorBook | null> {
  if (!bookPublicId) return null;
  const book = await BookModel.findOne({ bookId: bookPublicId });
  return book ? toAuthorBook(book) : null;
}

export async function processTicketAi(
  ticketId: string,
  options: { classify?: boolean; draft?: boolean; forceDraft?: boolean } = {},
): Promise<void> {
  const classify = options.classify ?? true;
  const draft = options.draft ?? false;
  try {
    const ticket = await TicketModel.findOne({ ticketId });
    if (!ticket) return;
    const author = await AuthorModel.findOne({ authorId: ticket.authorPublicId });
    const book = await loadBook(ticket.bookPublicId ?? null);
    let category = (ticket.category as TicketCategory | null) ?? null;
    let priority = (ticket.priority as TicketPriority | null) ?? null;
    let reasoning = ticket.reasoningSummary ?? null;
    let processing: "COMPLETED" | "FALLBACK" | "FAILED" = "COMPLETED";
    let failureMessage: string | null = null;

    if (classify) {
      let source: DecisionSource = "AI";
      let output: ClassificationOutput;
      try {
        if (!getEnv().AI_API_KEY && !providerOverride) {
          await recordUsage({
            ticketId,
            operation: "classify",
            model: "fallback",
            promptTokens: null,
            completionTokens: null,
            latencyMs: 0,
            success: false,
            errorCode: "UPSTREAM",
          }).catch(() => undefined);
          throw new AiProviderError("UPSTREAM", "The language model is not configured.");
        }
        const result = await classifyWithProvider(
          ticket.subject,
          ticket.description,
          book?.status ?? null,
          ticket.ticketId,
        );
        output = result.output;
        source = result.source;
      } catch (error) {
        const code = error instanceof AiProviderError ? error.code : "UPSTREAM";
        logger.warn("using classification fallback", { ticketId, code });
        output = classifyHeuristically(ticket.subject, ticket.description);
        source = "FALLBACK";
        processing = "FALLBACK";
        failureMessage =
          "The language model is unavailable. This category is a local Knowledge Base fallback, not a live AI result, and can be changed.";
      }

      category = output.category;
      priority = output.priority;
      reasoning = output.reasoningSummary;

      if (ticket.categorySource !== "ADMIN") {
        await TicketModel.updateOne(
          { ticketId, categorySource: { $ne: "ADMIN" } },
          {
            $set: {
              category: output.category,
              categorySource: source,
            },
          },
        );
      }
      if (ticket.prioritySource !== "ADMIN") {
        await TicketModel.updateOne(
          { ticketId, prioritySource: { $ne: "ADMIN" } },
          {
            $set: {
              priority: output.priority,
              prioritySource: source,
              priorityRank: PRIORITY_RANK[output.priority],
            },
          },
        );
      }
      await TicketModel.updateOne(
        { ticketId },
        {
          $set: {
            reasoningSummary: output.reasoningSummary,
            aiProcessingState: processing,
            aiFailureMessage: failureMessage,
          },
        },
      );
      if (output.category) {
        await TicketModel.updateOne(
          { ticketId, aiCategory: null },
          { $set: { aiCategory: output.category } },
        );
      }
      if (output.priority) {
        await TicketModel.updateOne(
          { ticketId, aiPriority: null },
          { $set: { aiPriority: output.priority } },
        );
      }
    }

    const current = await TicketModel.findOne({ ticketId });
    if (!current) return;
    if (draft && (options.forceDraft || !current.draft?.editedByAdmin)) {
      const draftInput: DraftPromptInput = {
        authorName: author?.name ?? ticket.authorName,
        subject: ticket.subject,
        description: ticket.description,
        category: (current.category as TicketCategory | null) ?? category,
        priority: (current.priority as TicketPriority | null) ?? priority,
        status: current.status,
        book,
      };
      const generated = await draftWithProvider(draftInput, ticketId);
      await TicketModel.updateOne(
        options.forceDraft
          ? { ticketId }
          : { ticketId, $or: [{ draft: null }, { "draft.editedByAdmin": false }] },
        {
          $set: {
            draft: {
              response: generated.response,
              policyBasis: generated.policyBasis,
              requiresHumanVerification: generated.requiresHumanVerification,
              generatedAt: new Date(),
              source: generated.source,
              editedByAdmin: false,
            },
            ...(generated.source === "FALLBACK" && current.aiProcessingState === "PENDING"
              ? {
                  aiProcessingState: "FALLBACK",
                  aiFailureMessage:
                    "This draft was prepared from the Knowledge Base fallback, not a live model. Review it before sending.",
                }
              : {}),
          },
        },
      );
    }

    if (reasoning && !classify) {
      await TicketModel.updateOne({ ticketId }, { $set: { reasoningSummary: reasoning } });
    }
  } catch (error) {
    logger.error("ticket ai processing failed", {
      ticketId,
      name: error instanceof Error ? error.name : "Error",
    });
    await TicketModel.updateOne(
      { ticketId, aiProcessingState: "PENDING" },
      {
        $set: {
          aiProcessingState: "FAILED",
          aiFailureMessage:
            "Automatic classification is unavailable. Set the category and priority manually.",
        },
      },
    );
  }
}
