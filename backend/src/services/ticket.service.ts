import { subject } from "@casl/ability";
import type {
  AdminDashboard,
  AdminTicketDetail,
  AdminTicketSummary,
  AuthorTicketDetail,
  CreateTicketInput,
  Paginated,
  SaveDraftInput,
  TicketQueueQuery,
  TicketSummary,
  UpdateTicketInput,
} from "@bookleaf/shared";
import { PRIORITY_RANK, STATUS_RANK } from "@bookleaf/shared";
import mongoose from "mongoose";
import { getEnv } from "../config/env.js";
import { assertCanReadOwned, type RequestActor } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { AuthorModel } from "../models/Author.js";
import { BookModel } from "../models/Book.js";
import { MessageModel } from "../models/Message.js";
import { nextTicketId } from "../models/Counter.js";
import { TicketModel } from "../models/Ticket.js";
import { processTicketAi } from "../ai/process.js";
import { publishTicketEvent } from "../realtime/publish.js";
import {
  toAdminTicketDetail,
  toAdminTicketSummary,
  toAuthorTicketDetail,
  toTicketSummary,
} from "./dto.js";

function authorScope(actor: RequestActor): string {
  if (actor.role !== "AUTHOR" || !actor.authorPublicId) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to that action.");
  }
  return actor.authorPublicId;
}

function assertAdmin(actor: RequestActor): void {
  if (actor.role !== "ADMIN" || actor.ability.cannot("update", "AdminArea")) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to that action.");
  }
}

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

function istDayBound(isoDate: string, endOfDay: boolean): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new AppError(400, "VALIDATION_ERROR", "Use a real YYYY-MM-DD date.");
  }
  const utc = endOfDay
    ? Date.UTC(year, month - 1, day, 23, 59, 59, 999)
    : Date.UTC(year, month - 1, day);
  return new Date(utc - IST_OFFSET_MS);
}

async function authorVisibleMessages(ticketObjectId: unknown) {
  return MessageModel.find({ ticket: ticketObjectId, visibility: "AUTHOR_VISIBLE" }).sort({
    createdAt: 1,
  });
}

export async function createTicket(
  actor: RequestActor,
  input: CreateTicketInput,
): Promise<AuthorTicketDetail> {
  if (actor.ability.cannot("create", "Ticket")) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to that action.");
  }
  const authorPublicId = authorScope(actor);
  const author = await AuthorModel.findOne({ authorId: authorPublicId });
  if (!author) throw new AppError(404, "NOT_FOUND", "That author profile was not found.");

  let bookPublicId: string | null = null;
  let bookTitle: string | null = null;
  let bookId: typeof author._id | null = null;
  if (input.bookId) {
    const book = await BookModel.findOne({ bookId: input.bookId, authorPublicId });
    if (
      !book ||
      actor.ability.cannot("read", subject("Book", { authorPublicId: book.authorPublicId }))
    ) {
      throw new AppError(404, "NOT_FOUND", "That book was not found on your account.");
    }
    bookPublicId = book.bookId;
    bookTitle = book.title;
    bookId = book._id;
  }

  const ticket = await TicketModel.create({
    ticketId: await nextTicketId(),
    author: author._id,
    authorPublicId,
    authorName: author.name,
    book: bookId,
    bookPublicId,
    bookTitle,
    subject: input.subject,
    description: input.description,
    status: "OPEN",
    statusRank: STATUS_RANK.OPEN,
    priorityRank: 5,
    aiProcessingState: "PENDING",
  });

  await publishTicketEvent({
    name: "ticket.created",
    ticketId: ticket.ticketId,
    authorPublicId,
    status: ticket.status,
    category: null,
    priority: null,
    updatedAt: ticket.updatedAt.toISOString(),
  });

  if (getEnv().AI_AUTO_PROCESS === "true") {
    setImmediate(() => {
      void processTicketAi(ticket.ticketId, { classify: true, draft: true }).catch(
        (error: unknown) => {
          logger.error("background ticket processing failed", {
            ticketId: ticket.ticketId,
            name: error instanceof Error ? error.name : "Error",
          });
        },
      );
    });
  }

  return toAuthorTicketDetail(ticket, []);
}

export async function listAuthorTickets(actor: RequestActor): Promise<TicketSummary[]> {
  const authorPublicId = authorScope(actor);
  const tickets = await TicketModel.find({ authorPublicId }).sort({ updatedAt: -1 }).limit(100);
  return tickets
    .filter((ticket) =>
      actor.ability.can("read", subject("Ticket", { authorPublicId: ticket.authorPublicId })),
    )
    .map(toTicketSummary);
}

export async function getAuthorTicket(
  actor: RequestActor,
  ticketId: string,
): Promise<AuthorTicketDetail> {
  const authorPublicId = authorScope(actor);
  const ticket = await TicketModel.findOne({ ticketId, authorPublicId });
  if (!ticket) throw new AppError(404, "NOT_FOUND", "That ticket was not found.");
  assertCanReadOwned(actor, "Ticket", { authorPublicId: ticket.authorPublicId });
  const messages = (await authorVisibleMessages(ticket._id)).filter(
    (message) =>
      message.visibility === "AUTHOR_VISIBLE" &&
      actor.ability.can(
        "read",
        subject("Reply", {
          authorPublicId: ticket.authorPublicId,
          visibility: "AUTHOR_VISIBLE",
        }),
      ),
  );
  return toAuthorTicketDetail(ticket, messages);
}

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const [
    totalTickets,
    openTickets,
    inProgressTickets,
    highOrCriticalTickets,
    resolvedTickets,
    urgent,
  ] = await Promise.all([
    TicketModel.countDocuments({}),
    TicketModel.countDocuments({ status: "OPEN" }),
    TicketModel.countDocuments({ status: "IN_PROGRESS" }),
    TicketModel.countDocuments({
      priority: { $in: ["HIGH", "CRITICAL"] },
      status: { $in: ["OPEN", "IN_PROGRESS"] },
    }),
    TicketModel.countDocuments({ status: "RESOLVED" }),
    TicketModel.find({ status: { $in: ["OPEN", "IN_PROGRESS"] } })
      .sort({ priorityRank: 1, createdAt: 1 })
      .limit(5),
  ]);
  return {
    totalTickets,
    openTickets,
    inProgressTickets,
    highOrCriticalTickets,
    resolvedTickets,
    urgentTickets: urgent.map(toAdminTicketSummary),
  };
}

export async function listAdminTickets(
  query: TicketQueueQuery,
): Promise<Paginated<AdminTicketSummary>> {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.category) filter.category = query.category;
  if (query.priority) filter.priority = query.priority;
  if (query.dateFrom || query.dateTo) {
    const createdAt: Record<string, Date> = {};
    if (query.dateFrom) createdAt.$gte = istDayBound(query.dateFrom, false);
    if (query.dateTo) createdAt.$lte = istDayBound(query.dateTo, true);
    filter.createdAt = createdAt;
  }
  const [total, items] = await Promise.all([
    TicketModel.countDocuments(filter),
    TicketModel.find(filter)
      .sort({ statusRank: 1, priorityRank: 1, createdAt: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
  ]);
  return { items: items.map(toAdminTicketSummary), page: query.page, limit: query.limit, total };
}

async function loadAdminTicket(ticketId: string): Promise<AdminTicketDetail> {
  const ticket = await TicketModel.findOne({ ticketId });
  if (!ticket) throw new AppError(404, "NOT_FOUND", "That ticket was not found.");
  const [author, book, replies, internalNotes] = await Promise.all([
    AuthorModel.findOne({ authorId: ticket.authorPublicId }),
    ticket.bookPublicId
      ? BookModel.findOne({ bookId: ticket.bookPublicId })
      : Promise.resolve(null),
    MessageModel.find({ ticket: ticket._id, visibility: "AUTHOR_VISIBLE" }).sort({ createdAt: 1 }),
    MessageModel.find({ ticket: ticket._id, visibility: "INTERNAL" }).sort({ createdAt: 1 }),
  ]);
  if (!author) throw new AppError(404, "NOT_FOUND", "That ticket was not found.");
  return toAdminTicketDetail(ticket, author, book, replies, internalNotes);
}

export async function getAdminTicket(ticketId: string): Promise<AdminTicketDetail> {
  return loadAdminTicket(ticketId);
}

async function emitUpdate(ticketId: string): Promise<void> {
  const ticket = await TicketModel.findOne({ ticketId });
  if (!ticket) return;
  await publishTicketEvent({
    name: "ticket.updated",
    ticketId: ticket.ticketId,
    authorPublicId: ticket.authorPublicId,
    status: ticket.status,
    category: ticket.category ?? null,
    priority: ticket.priority ?? null,
    updatedAt: ticket.updatedAt.toISOString(),
  });
}

export async function updateAdminTicket(
  ticketId: string,
  input: UpdateTicketInput,
): Promise<AdminTicketDetail> {
  const ticket = await TicketModel.findOne({ ticketId });
  if (!ticket) throw new AppError(404, "NOT_FOUND", "That ticket was not found.");
  if (input.category) {
    ticket.category = input.category;
    ticket.categorySource = "ADMIN";
  }
  if (input.priority) {
    ticket.priority = input.priority;
    ticket.prioritySource = "ADMIN";
    ticket.priorityRank = PRIORITY_RANK[input.priority];
  }
  if (input.status) {
    ticket.status = input.status;
    ticket.statusRank = STATUS_RANK[input.status];
  }
  await ticket.save();
  await emitUpdate(ticket.ticketId);
  return loadAdminTicket(ticket.ticketId);
}

export async function assignTicketToSelf(
  actor: RequestActor,
  ticketId: string,
): Promise<AdminTicketDetail> {
  assertAdmin(actor);
  const ticket = await TicketModel.findOne({ ticketId });
  if (!ticket) throw new AppError(404, "NOT_FOUND", "That ticket was not found.");
  ticket.assignee = new mongoose.Types.ObjectId(actor.id);
  ticket.assigneeName = actor.name;
  if (ticket.status === "OPEN") {
    ticket.status = "IN_PROGRESS";
    ticket.statusRank = STATUS_RANK.IN_PROGRESS;
  }
  await ticket.save();
  await emitUpdate(ticket.ticketId);
  return loadAdminTicket(ticket.ticketId);
}

export async function addInternalNote(
  actor: RequestActor,
  ticketId: string,
  body: string,
): Promise<AdminTicketDetail> {
  if (actor.role !== "ADMIN" || actor.ability.cannot("create", "InternalNote")) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to that action.");
  }
  const ticket = await TicketModel.findOne({ ticketId });
  if (!ticket) throw new AppError(404, "NOT_FOUND", "That ticket was not found.");
  await MessageModel.create({
    ticket: ticket._id,
    ticketPublicId: ticket.ticketId,
    authorPublicId: ticket.authorPublicId,
    senderUser: actor.id,
    senderName: actor.name,
    senderRole: actor.role,
    body,
    visibility: "INTERNAL",
  });
  await publishTicketEvent({
    name: "ticket.note.added",
    ticketId: ticket.ticketId,
    authorPublicId: ticket.authorPublicId,
    status: ticket.status,
    category: ticket.category ?? null,
    priority: ticket.priority ?? null,
    updatedAt: new Date().toISOString(),
  });
  return loadAdminTicket(ticket.ticketId);
}

export async function sendReply(
  actor: RequestActor,
  ticketId: string,
  body: string,
): Promise<AdminTicketDetail> {
  assertAdmin(actor);
  const ticket = await TicketModel.findOne({ ticketId });
  if (!ticket) throw new AppError(404, "NOT_FOUND", "That ticket was not found.");
  const message = await MessageModel.create({
    ticket: ticket._id,
    ticketPublicId: ticket.ticketId,
    authorPublicId: ticket.authorPublicId,
    senderUser: actor.id,
    senderName: actor.name,
    senderRole: "ADMIN",
    body,
    visibility: "AUTHOR_VISIBLE",
  });
  if (ticket.status === "OPEN") {
    ticket.status = "IN_PROGRESS";
    ticket.statusRank = STATUS_RANK.IN_PROGRESS;
    await ticket.save();
  }
  await publishTicketEvent({
    name: "ticket.reply.added",
    ticketId: ticket.ticketId,
    authorPublicId: ticket.authorPublicId,
    status: ticket.status,
    category: ticket.category ?? null,
    priority: ticket.priority ?? null,
    updatedAt: message.createdAt.toISOString(),
  });
  return loadAdminTicket(ticket.ticketId);
}

export async function saveDraft(
  ticketId: string,
  input: SaveDraftInput,
): Promise<AdminTicketDetail> {
  const ticket = await TicketModel.findOne({ ticketId });
  if (!ticket) throw new AppError(404, "NOT_FOUND", "That ticket was not found.");
  ticket.draft = {
    response: input.response,
    policyBasis: ticket.draft?.policyBasis ?? [],
    requiresHumanVerification: true,
    generatedAt: ticket.draft?.generatedAt ?? new Date(),
    source: ticket.draft?.source ?? "ADMIN",
    editedByAdmin: true,
  };
  await ticket.save();
  return loadAdminTicket(ticket.ticketId);
}

export async function regenerateDraft(ticketId: string): Promise<AdminTicketDetail> {
  const ticket = await TicketModel.findOne({ ticketId });
  if (!ticket) throw new AppError(404, "NOT_FOUND", "That ticket was not found.");
  await processTicketAi(ticketId, { classify: false, draft: true, forceDraft: true });
  return loadAdminTicket(ticketId);
}

export async function rerunClassification(ticketId: string): Promise<AdminTicketDetail> {
  const ticket = await TicketModel.findOne({ ticketId });
  if (!ticket) throw new AppError(404, "NOT_FOUND", "That ticket was not found.");
  await processTicketAi(ticketId, { classify: true, draft: false });
  return loadAdminTicket(ticketId);
}
