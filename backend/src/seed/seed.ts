import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getEnv } from "../config/env.js";
import { hashPassword } from "../auth/password.js";
import { AuthorModel } from "../models/Author.js";
import { BookModel } from "../models/Book.js";
import { UserModel } from "../models/User.js";

const bookSchema = z
  .object({
    book_id: z.string().min(1),
    title: z.string().min(1),
    isbn: z.string().nullable().optional(),
    genre: z.string().nullable().optional(),
    publication_date: z.string().nullable().optional(),
    status: z.string().min(1),
    mrp: z.number().nullable().optional(),
    author_royalty_per_copy: z.number().nullable().optional(),
    total_copies_sold: z.number(),
    total_royalty_earned: z.number(),
    royalty_paid: z.number(),
    royalty_pending: z.number(),
    last_royalty_payout_date: z.string().nullable().optional(),
    print_partner: z.string().nullable().optional(),
    available_on: z.array(z.string()).optional(),
  })
  .strict();

const authorSchema = z
  .object({
    author_id: z.string().min(1),
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(1),
    city: z.string().min(1),
    joined_date: z.string().min(1),
    books: z.array(bookSchema),
  })
  .strict();

const datasetSchema = z.object({ authors: z.array(authorSchema).min(1) }).strict();

export interface SeedReport {
  authors: number;
  books: number;
  users: number;
  dataPath: string;
}

export function resolveSeedPath(): string {
  const env = getEnv();
  const candidates = [
    env.SEED_DATA_PATH,
    path.resolve(process.cwd(), "docs/reference/FULLSTACK-SAMPLEDATA (1).json"),
    path.resolve(process.cwd(), "docs/reference/bookleaf_sample_data.json"),
    path.resolve(process.cwd(), "../docs/reference/FULLSTACK-SAMPLEDATA (1).json"),
    path.resolve(process.cwd(), "../docs/reference/bookleaf_sample_data.json"),
  ].filter((candidate) => candidate.length > 0);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`Sample dataset was not found. Checked: ${candidates.join(", ")}`);
  }
  return found;
}

export async function seedDatabase(dataPath = resolveSeedPath()): Promise<SeedReport> {
  const env = getEnv();
  const raw = JSON.parse(readFileSync(dataPath, "utf8")) as unknown;
  const parsed = datasetSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Sample dataset is invalid. ${details}`);
  }

  const authors = parsed.data.authors;
  const books = authors.flatMap((author) => author.books);
  if (authors.length !== 10 || books.length !== 18) {
    throw new Error(
      `Expected 10 authors and 18 books. Found ${authors.length} authors and ${books.length} books.`,
    );
  }
  const authorIds = new Set(authors.map((author) => author.author_id));
  const bookIds = new Set(books.map((book) => book.book_id));
  const emails = new Set(authors.map((author) => author.email.toLowerCase()));
  if (
    authorIds.size !== authors.length ||
    bookIds.size !== books.length ||
    emails.size !== authors.length
  ) {
    throw new Error("Sample dataset contains duplicate author ids, book ids, or emails.");
  }

  const adminEmail = env.DEMO_ADMIN_EMAIL.toLowerCase();
  if (emails.has(adminEmail)) {
    throw new Error("The demo admin email matches an author in the dataset.");
  }

  const authorPasswordHash = await hashPassword(env.DEMO_AUTHOR_PASSWORD);
  const adminPasswordHash = await hashPassword(env.DEMO_ADMIN_PASSWORD);

  for (const author of authors) {
    const email = author.email.toLowerCase();
    const saved = await AuthorModel.findOneAndUpdate(
      { authorId: author.author_id },
      {
        $set: {
          authorId: author.author_id,
          name: author.name,
          email,
          phone: author.phone,
          city: author.city,
          joinedDate: author.joined_date,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    );
    if (!saved) throw new Error(`Could not save author ${author.author_id}.`);

    await upsertAuthorUser({
      authorPublicId: author.author_id,
      email,
      name: author.name,
      authorObjectId: saved._id,
      passwordHash: authorPasswordHash,
    });

    for (const book of author.books) {
      const savedBook = await BookModel.findOneAndUpdate(
        { bookId: book.book_id },
        {
          $set: {
            bookId: book.book_id,
            author: saved._id,
            authorPublicId: author.author_id,
            title: book.title,
            isbn: book.isbn ?? null,
            genre: book.genre ?? null,
            publicationDate: book.publication_date ?? null,
            status: book.status,
            mrp: book.mrp ?? null,
            authorRoyaltyPerCopy: book.author_royalty_per_copy ?? null,
            totalCopiesSold: book.total_copies_sold,
            totalRoyaltyEarned: book.total_royalty_earned,
            royaltyPaid: book.royalty_paid,
            royaltyPending: book.royalty_pending,
            lastRoyaltyPayoutDate: book.last_royalty_payout_date ?? null,
            printPartner: book.print_partner ?? null,
            availableOn: book.available_on ?? [],
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
      );
      if (!savedBook) throw new Error(`Could not save book ${book.book_id}.`);
    }
  }

  await upsertAdminUser(adminEmail, adminPasswordHash);

  const report = await verifySeed(authorIds, bookIds, adminEmail);
  return { ...report, dataPath };
}

async function upsertAuthorUser(input: {
  authorPublicId: string;
  email: string;
  name: string;
  authorObjectId: unknown;
  passwordHash: string;
}): Promise<void> {
  const byAuthor = await UserModel.findOne({ authorPublicId: input.authorPublicId });
  const byEmail = await UserModel.findOne({ email: input.email });
  if (byAuthor && byEmail && !byAuthor._id.equals(byEmail._id)) {
    throw new Error(
      `Author ${input.authorPublicId} cannot take ${input.email} because another account already uses it.`,
    );
  }
  if (byEmail?.role === "ADMIN" || byAuthor?.role === "ADMIN") {
    throw new Error(`Refusing to turn the admin account into author ${input.authorPublicId}.`);
  }
  if (byEmail?.authorPublicId && byEmail.authorPublicId !== input.authorPublicId) {
    throw new Error(`Email ${input.email} already belongs to ${byEmail.authorPublicId}.`);
  }
  const existing = byAuthor ?? byEmail;
  const saved = await UserModel.findOneAndUpdate(
    existing ? { _id: existing._id } : { authorPublicId: input.authorPublicId },
    {
      $set: {
        email: input.email,
        passwordHash: input.passwordHash,
        name: input.name,
        role: "AUTHOR",
        author: input.authorObjectId,
        authorPublicId: input.authorPublicId,
      },
      $setOnInsert: { tokenVersion: 0 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
  );
  if (!saved) throw new Error(`Could not save the account for ${input.authorPublicId}.`);
}

async function upsertAdminUser(email: string, passwordHash: string): Promise<void> {
  const byRole = await UserModel.findOne({ role: "ADMIN" });
  const byEmail = await UserModel.findOne({ email });
  if (byRole && byEmail && !byRole._id.equals(byEmail._id)) {
    throw new Error(`Demo admin email ${email} is already used by another account.`);
  }
  if (byEmail && byEmail.role !== "ADMIN") {
    throw new Error(`Demo admin email ${email} belongs to an author account.`);
  }
  const existing = byRole ?? byEmail;
  const saved = await UserModel.findOneAndUpdate(
    existing ? { _id: existing._id } : { email, role: "ADMIN" },
    {
      $set: {
        email,
        passwordHash,
        name: "BookLeaf Support",
        role: "ADMIN",
        author: null,
        authorPublicId: null,
      },
      $setOnInsert: { tokenVersion: 0 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
  );
  if (!saved) throw new Error("Could not save the demo admin account.");
}

async function verifySeed(
  authorIds: Set<string>,
  bookIds: Set<string>,
  adminEmail: string,
): Promise<Pick<SeedReport, "authors" | "books" | "users">> {
  const [authors, books, users] = await Promise.all([
    AuthorModel.find(),
    BookModel.find(),
    UserModel.find(),
  ]);
  if (books.length !== 18) {
    throw new Error(`Seed verification failed. Books: ${books.length}.`);
  }
  const authorByPublicId = new Map(authors.map((author) => [author.authorId, author]));
  for (const authorId of authorIds) {
    if (!authorByPublicId.has(authorId)) throw new Error(`Missing author ${authorId}.`);
  }
  for (const bookId of bookIds) {
    if (!books.some((book) => book.bookId === bookId)) throw new Error(`Missing book ${bookId}.`);
  }
  for (const book of books) {
    const author = authorByPublicId.get(book.authorPublicId);
    if (!author || !book.author.equals(author._id)) {
      throw new Error(`Book ${book.bookId} is not linked to author ${book.authorPublicId}.`);
    }
  }
  const authorUsers = users.filter((user) => user.role === "AUTHOR");
  const adminUsers = users.filter((user) => user.role === "ADMIN");
  const sampleAuthorUsers = authorUsers.filter(
    (user) => user.authorPublicId && authorIds.has(user.authorPublicId),
  );
  if (sampleAuthorUsers.length !== 10 || adminUsers.length !== 1) {
    throw new Error(
      `Expected 10 sample author accounts and 1 admin. Found ${sampleAuthorUsers.length} sample authors and ${adminUsers.length} admins.`,
    );
  }
  for (const user of authorUsers) {
    const author = user.authorPublicId ? authorByPublicId.get(user.authorPublicId) : undefined;
    if (!author || !user.author?.equals(author._id) || user.email !== author.email) {
      throw new Error(
        `Author account ${user.email} does not match ${user.authorPublicId ?? "an author"}.`,
      );
    }
  }
  const admin = adminUsers[0];
  if (!admin || admin.email !== adminEmail || admin.authorPublicId || admin.author) {
    throw new Error("Demo admin account is not linked correctly.");
  }
  return { authors: authors.length, books: books.length, users: users.length };
}
