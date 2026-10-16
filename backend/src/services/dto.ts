import type {
  AdminTicketDetail,
  AdminTicketSummary,
  AuthorBook,
  AuthorTicketDetail,
  TicketCategory,
  TicketMessage,
  TicketPriority,
  TicketStatus,
  TicketSummary,
} from "@bookleaf/shared";
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from "@bookleaf/shared";
import type { BookDocument } from "../models/Book.js";
import type { MessageDocument } from "../models/Message.js";
import type { TicketDocument } from "../models/Ticket.js";

function asCategory(value: string | null | undefined): TicketCategory | null {
  if (!value) return null;
  return TICKET_CATEGORIES.includes(value as TicketCategory) ? (value as TicketCategory) : null;
}

function asPriority(value: string | null | undefined): TicketPriority | null {
  if (!value) return null;
  return TICKET_PRIORITIES.includes(value as TicketPriority) ? (value as TicketPriority) : null;
}

function asStatus(value: string): TicketStatus {
  if (TICKET_STATUSES.includes(value as TicketStatus)) return value as TicketStatus;
  return "OPEN";
}

export function toAuthorBook(book: BookDocument): AuthorBook {
  return {
    bookId: book.bookId,
    title: book.title,
    isbn: book.isbn ?? null,
    genre: book.genre ?? null,
    publicationDate: book.publicationDate ?? null,
    status: book.status,
    mrp: book.mrp ?? null,
    authorRoyaltyPerCopy: book.authorRoyaltyPerCopy ?? null,
    totalCopiesSold: book.totalCopiesSold,
    totalRoyaltyEarned: book.totalRoyaltyEarned,
    royaltyPaid: book.royaltyPaid,
    royaltyPending: book.royaltyPending,
    lastRoyaltyPayoutDate: book.lastRoyaltyPayoutDate ?? null,
    printPartner: book.printPartner ?? null,
    availableOn: book.availableOn ?? [],
  };
}

export function toMessage(message: MessageDocument): TicketMessage {
  return {
    id: message._id.toString(),
    senderName: message.senderName,
    senderRole: message.senderRole,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
  };
}

export function toTicketSummary(ticket: TicketDocument): TicketSummary {
  return {
    ticketId: ticket.ticketId,
    subject: ticket.subject,
    bookId: ticket.bookPublicId ?? null,
    bookTitle: ticket.bookTitle ?? null,
    category: asCategory(ticket.category),
    priority: asPriority(ticket.priority),
    status: asStatus(ticket.status),
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

export function toAdminTicketSummary(ticket: TicketDocument): AdminTicketSummary {
  return {
    ...toTicketSummary(ticket),
    authorId: ticket.authorPublicId,
    authorName: ticket.authorName,
    assigneeName: ticket.assigneeName ?? null,
    aiProcessingState: ticket.aiProcessingState,
  };
}

export function toAuthorTicketDetail(ticket: TicketDocument, messages: MessageDocument[]): AuthorTicketDetail {
  return {
    ...toTicketSummary(ticket),
    description: ticket.description,
    messages: messages.map(toMessage),
  };
}

export function toAdminTicketDetail(
  ticket: TicketDocument,
  author: { email: string; city: string },
  book: BookDocument | null,
  replies: MessageDocument[],
  internalNotes: MessageDocument[],
): AdminTicketDetail {
  const summary = toAdminTicketSummary(ticket);
  return {
    ...summary,
    description: ticket.description,
    authorEmail: author.email,
    authorCity: author.city,
    book: book ? toAuthorBook(book) : null,
    aiCategory: asCategory(ticket.aiCategory),
    categorySource: ticket.categorySource === "AI" || ticket.categorySource === "ADMIN" || ticket.categorySource === "FALLBACK"
      ? ticket.categorySource
      : null,
    aiPriority: asPriority(ticket.aiPriority),
    prioritySource: ticket.prioritySource === "AI" || ticket.prioritySource === "ADMIN" || ticket.prioritySource === "FALLBACK"
      ? ticket.prioritySource
      : null,
    aiFailureMessage: ticket.aiFailureMessage ?? null,
    reasoningSummary: ticket.reasoningSummary ?? null,
    draft: ticket.draft
      ? {
          response: ticket.draft.response,
          policyBasis: ticket.draft.policyBasis ?? [],
          requiresHumanVerification: ticket.draft.requiresHumanVerification,
          generatedAt: ticket.draft.generatedAt.toISOString(),
          source: ticket.draft.source,
          editedByAdmin: ticket.draft.editedByAdmin,
        }
      : null,
    replies: replies.map(toMessage),
    internalNotes: internalNotes.map(toMessage),
  };
}
