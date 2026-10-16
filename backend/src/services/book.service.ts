import { subject } from "@casl/ability";
import type { AuthorBook, AuthorDashboard } from "@bookleaf/shared";
import { isInProductionStatus, isPublishedStatus } from "@bookleaf/shared";
import { assertCanReadOwned, type RequestActor } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import { AuthorModel } from "../models/Author.js";
import { BookModel } from "../models/Book.js";
import { TicketModel } from "../models/Ticket.js";
import { toAuthorBook, toTicketSummary } from "./dto.js";

function assertAuthor(actor: RequestActor): string {
  if (actor.role !== "AUTHOR" || !actor.authorPublicId) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to that action.");
  }
  return actor.authorPublicId;
}

export async function listAuthorBooks(actor: RequestActor): Promise<AuthorBook[]> {
  const authorPublicId = assertAuthor(actor);
  const books = await BookModel.find({ authorPublicId }).sort({ title: 1 });
  return books
    .filter((book) =>
      actor.ability.can("read", subject("Book", { authorPublicId: book.authorPublicId })),
    )
    .map(toAuthorBook);
}

export async function getAuthorBook(actor: RequestActor, bookId: string): Promise<AuthorBook> {
  const authorPublicId = assertAuthor(actor);
  const book = await BookModel.findOne({ bookId, authorPublicId });
  if (!book) throw new AppError(404, "NOT_FOUND", "That book was not found.");
  assertCanReadOwned(actor, "Book", { authorPublicId: book.authorPublicId });
  return toAuthorBook(book);
}

export async function getAuthorDashboard(actor: RequestActor): Promise<AuthorDashboard> {
  const authorPublicId = assertAuthor(actor);
  const author = await AuthorModel.findOne({ authorId: authorPublicId });
  if (!author) throw new AppError(404, "NOT_FOUND", "That author profile was not found.");
  const books = await BookModel.find({ authorPublicId });
  const recent = await TicketModel.find({ authorPublicId }).sort({ updatedAt: -1 }).limit(5);
  const openTickets = await TicketModel.countDocuments({
    authorPublicId,
    status: { $in: ["OPEN", "IN_PROGRESS"] },
  });
  return {
    author: {
      authorId: author.authorId,
      name: author.name,
      email: author.email,
      phone: author.phone,
      city: author.city,
      joinedDate: author.joinedDate,
    },
    totalBooks: books.length,
    publishedBooks: books.filter((book) => isPublishedStatus(book.status)).length,
    booksInProduction: books.filter((book) => isInProductionStatus(book.status)).length,
    openTickets,
    pendingRoyalties: books.reduce((sum, book) => sum + book.royaltyPending, 0),
    recentTickets: recent.map(toTicketSummary),
  };
}
