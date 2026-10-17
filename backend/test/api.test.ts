import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import type { Express } from "express";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AiProviderError, type AiProvider } from "../src/ai/provider.js";
import { setAiProviderForTests } from "../src/ai/process.js";
import { resetEnvCache } from "../src/config/env.js";
import { AiUsageModel } from "../src/models/AiUsage.js";
import { AuthorModel } from "../src/models/Author.js";
import { BookModel } from "../src/models/Book.js";
import { CounterModel } from "../src/models/Counter.js";
import { MessageModel } from "../src/models/Message.js";
import { TicketModel } from "../src/models/Ticket.js";
import { UserModel } from "../src/models/User.js";
import { verifyPassword } from "../src/auth/password.js";
import { clearDeliveredEvents, deliveredEvents } from "../src/realtime/publish.js";

let mongo: MongoMemoryServer;
let app: Express;

function providerReturning(content: string): AiProvider {
  return {
    name: "mock",
    async complete() {
      return { content, model: "mock", promptTokens: 12, completionTokens: 8 };
    },
  };
}

async function csrf(agent: ReturnType<typeof request.agent>): Promise<string> {
  const response = await agent.get("/api/v1/auth/csrf");
  return response.body.csrfToken as string;
}

async function login(email: string, password: string) {
  const agent = request.agent(app);
  const token = await csrf(agent);
  const response = await agent
    .post("/api/v1/auth/login")
    .set("X-CSRF-Token", token)
    .send({ email, password });
  return { agent, token, response };
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.NODE_ENV = "test";
  process.env.MONGODB_URI = mongo.getUri();
  process.env.JWT_ACCESS_SECRET = "test-access-secret-which-is-long-enough";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-which-is-long-enough";
  process.env.AI_AUTO_PROCESS = "false";
  process.env.AI_API_KEY = "";
  process.env.COOKIE_SECURE = "false";
  process.env.CORS_ORIGIN =
    "http://localhost:5173,https://bookleaf-author-support-portal.netlify.app";
  process.env.DEMO_AUTHOR_PASSWORD = "BookLeaf#Author1";
  process.env.DEMO_ADMIN_PASSWORD = "BookLeaf#Admin1";
  process.env.DEMO_ADMIN_EMAIL = "ops@bookleaf.demo";
  process.env.LOG_LEVEL = "error";
  resetEnvCache();
  await mongoose.connect(process.env.MONGODB_URI);
  const { createApp } = await import("../src/app.js");
  const { seedDatabase } = await import("../src/seed/seed.js");
  app = createApp();
  await seedDatabase();
}, 120_000);

afterEach(async () => {
  await Promise.all([
    TicketModel.deleteMany({}),
    MessageModel.deleteMany({}),
    CounterModel.deleteMany({}),
    AiUsageModel.deleteMany({}),
  ]);
  clearDeliveredEvents();
  setAiProviderForTests(null);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe("authentication and author isolation", () => {
  it("rejects an unknown password and a missing session", async () => {
    const failed = await login("priya.sharma@email.com", "wrong-password-1");
    expect(failed.response.status).toBe(401);
    const me = await request(app).get("/api/v1/auth/me");
    expect(me.status).toBe(401);
  });

  it("signs in an author and hides another author's books", async () => {
    const { agent, response } = await login("priya.sharma@email.com", "BookLeaf#Author1");
    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe("AUTHOR");
    const books = await agent.get("/api/v1/author/books");
    expect(books.status).toBe(200);
    const titles = books.body.items.map((book: { title: string }) => book.title);
    expect(titles).toContain("Whispers of the Ganges");
    expect(titles).not.toContain("Code & Karma");
    const other = await agent.get("/api/v1/author/books/BK003");
    expect(other.status).toBe(404);
    const adminQueue = await agent.get("/api/v1/admin/tickets");
    expect(adminQueue.status).toBe(403);
  });

  it("keeps zero royalties and in-production books", async () => {
    const ananya = await login("ananya.reddy@email.com", "BookLeaf#Author1");
    const ananyaBooks = await ananya.agent.get("/api/v1/author/books");
    const between = ananyaBooks.body.items.find(
      (book: { bookId: string }) => book.bookId === "BK005",
    );
    expect(between.royaltyPaid).toBe(0);
    expect(between.royaltyPending).toBe(2546);
    const sneha = await login("sneha.kulkarni@email.com", "BookLeaf#Author1");
    const dashboard = await sneha.agent.get("/api/v1/author/dashboard");
    expect(dashboard.body.booksInProduction).toBe(1);
    const production = dashboard.body.totalBooks;
    expect(production).toBe(3);
    const books = await sneha.agent.get("/api/v1/author/books");
    const midnight = books.body.items.find((book: { bookId: string }) => book.bookId === "BK013");
    expect(midnight.status).toBe("In Production - Cover Design");
    expect(midnight.totalRoyaltyEarned).toBe(0);
    expect(midnight.publicationDate).toBeNull();
  });

  it("seeds the supplied author and book counts", async () => {
    expect(await AuthorModel.countDocuments()).toBe(10);
    expect(await BookModel.countDocuments()).toBe(18);
    expect(await UserModel.countDocuments()).toBe(11);
  });

  it("issues a CSRF cookie and rejects a missing or mismatched token", async () => {
    const agent = request.agent(app);
    const issued = await agent.get("/api/v1/auth/csrf");
    expect(issued.status).toBe(200);
    expect(issued.headers["content-type"]).toMatch(/application\/json/);
    expect(issued.body.csrfToken).toMatch(/^[a-f0-9]{64}$/);
    const setCookie = issued.headers["set-cookie"];
    const cookies = Array.isArray(setCookie) ? setCookie : [];
    const csrfCookie = cookies.find((cookie) => cookie.startsWith("bookleaf_csrf="));
    expect(csrfCookie).toContain(`bookleaf_csrf=${issued.body.csrfToken}`);
    expect(csrfCookie?.toLowerCase()).not.toContain("httponly");

    const missing = await request(app).post("/api/v1/auth/register").send({
      name: "No Token",
      email: "no.token@email.com",
      password: "Register#Pass1",
    });
    expect(missing.status).toBe(403);
    expect(missing.body.error.code).toBe("CSRF_REJECTED");
    expect(JSON.stringify(missing.body)).not.toMatch(/stack|passwordHash/i);

    const mismatched = await agent
      .post("/api/v1/auth/register")
      .set("X-CSRF-Token", "0".repeat(64))
      .send({
        name: "Bad Token",
        email: "bad.token@email.com",
        password: "Register#Pass1",
      });
    expect(mismatched.status).toBe(403);
    expect(mismatched.body.error.code).toBe("CSRF_REJECTED");
    expect(await UserModel.countDocuments({ email: { $in: ["no.token@email.com", "bad.token@email.com"] } })).toBe(0);
  });

  it("registers from the Netlify origin with a partitioned cross-site CSRF cookie", async () => {
    const origin = "https://bookleaf-author-support-portal.netlify.app";
    const host = "bookleaf-author-support-portal-api.onrender.com";
    const issued = await request(app).get("/api/v1/auth/csrf").set("Origin", origin).set("Host", host);
    expect(issued.status).toBe(200);
    expect(issued.headers["access-control-allow-origin"]).toBe(origin);
    expect(issued.headers["access-control-allow-credentials"]).toBe("true");
    const setCookie = issued.headers["set-cookie"];
    const cookies = Array.isArray(setCookie) ? setCookie : [];
    const csrfCookie = cookies.find((cookie) => cookie.startsWith("bookleaf_csrf="));
    expect(csrfCookie).toContain("SameSite=None");
    expect(csrfCookie?.toLowerCase()).toContain("secure");
    expect(csrfCookie).toContain("Partitioned");
    const token = issued.body.csrfToken as string;

    const created = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", origin)
      .set("Host", host)
      .set("X-CSRF-Token", token)
      .set("Cookie", `bookleaf_csrf=${token}`)
      .send({ name: "Cross Site", email: "cross.site@email.com", password: "Register#Pass1" });
    expect(created.status).toBe(201);
    expect(created.body.user.role).toBe("AUTHOR");

    const blocked = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", origin)
      .set("Host", host)
      .set("Cookie", `bookleaf_csrf=${token}`)
      .send({ name: "Missing Header", email: "missing.header@email.com", password: "Register#Pass1" });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("CSRF_REJECTED");

    const foreign = await request(app).get("/api/v1/auth/csrf").set("Origin", "https://evil.example").set("Host", host);
    expect(foreign.headers["access-control-allow-origin"]).toBeUndefined();
    const foreignCookies = Array.isArray(foreign.headers["set-cookie"]) ? foreign.headers["set-cookie"] : [];
    const foreignCookie = foreignCookies.find((cookie) => cookie.startsWith("bookleaf_csrf="));
    expect(foreignCookie).not.toContain("SameSite=None");
    expect(foreignCookie).not.toContain("Partitioned");

    await UserModel.deleteOne({ email: "cross.site@email.com" });
    await AuthorModel.deleteOne({ email: "cross.site@email.com" });
  });

  it("rejects login without a CSRF token", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({
      email: "priya.sharma@email.com",
      password: "BookLeaf#Author1",
    });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CSRF_REJECTED");
  });

  it("revokes a copied refresh token when the access cookie is already gone", async () => {
    const { token, response } = await login("priya.sharma@email.com", "BookLeaf#Author1");
    const setCookie = response.headers["set-cookie"];
    const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    const refresh = cookies.find((cookie) => cookie.startsWith("bookleaf_refresh="));
    expect(refresh).toBeTruthy();
    const refreshPair = refresh?.split(";")[0];
    const loggedOut = await request(app)
      .post("/api/v1/auth/logout")
      .set("X-CSRF-Token", token)
      .set("Cookie", [`bookleaf_csrf=${token}`, refreshPair ?? ""]);
    expect(loggedOut.status).toBe(200);
    const replay = await request(app)
      .post("/api/v1/auth/refresh")
      .set("X-CSRF-Token", token)
      .set("Cookie", [`bookleaf_csrf=${token}`, refreshPair ?? ""]);
    expect(replay.status).toBe(401);
  });

  it("updates the same accounts when seed runs again after an email change", async () => {
    await UserModel.updateOne(
      { authorPublicId: "AUTH001" },
      { $set: { email: "old-priya@email.com" } },
    );
    await UserModel.updateOne({ role: "ADMIN" }, { $set: { email: "old-admin@bookleaf.demo" } });
    const { seedDatabase } = await import("../src/seed/seed.js");
    await seedDatabase();
    expect(await UserModel.countDocuments()).toBe(11);
    expect(await UserModel.countDocuments({ authorPublicId: "AUTH001" })).toBe(1);
    expect((await UserModel.findOne({ authorPublicId: "AUTH001" }))?.email).toBe(
      "priya.sharma@email.com",
    );
    expect(await UserModel.countDocuments({ role: "ADMIN" })).toBe(1);
    expect((await UserModel.findOne({ role: "ADMIN" }))?.email).toBe("ops@bookleaf.demo");
    expect(await BookModel.countDocuments()).toBe(18);
  }, 60_000);
});

describe("ticket workflow", () => {
  it("creates a book ticket and a general ticket, and rejects a short description", async () => {
    const { agent, token } = await login("priya.sharma@email.com", "BookLeaf#Author1");
    const created = await agent.post("/api/v1/author/tickets").set("X-CSRF-Token", token).send({
      bookId: "BK001",
      subject: "Royalty pending",
      description: "I would like to understand the pending royalty on Whispers of the Ganges.",
    });
    expect(created.status).toBe(201);
    expect(created.body.bookId).toBe("BK001");
    expect(created.body.ticketId).toMatch(/^TKT-/);
    const general = await agent.post("/api/v1/author/tickets").set("X-CSRF-Token", token).send({
      bookId: null,
      subject: "Account question",
      description: "I need help updating the bank account linked to my author profile.",
    });
    expect(general.status).toBe(201);
    expect(general.body.bookId).toBeNull();
    const invalid = await agent.post("/api/v1/author/tickets").set("X-CSRF-Token", token).send({
      bookId: null,
      subject: "Hi",
      description: "Too short",
    });
    expect(invalid.status).toBe(400);
    const otherBook = await agent.post("/api/v1/author/tickets").set("X-CSRF-Token", token).send({
      bookId: "BK003",
      subject: "Not my book",
      description: "This description is long enough to pass validation checks.",
    });
    expect(otherBook.status).toBe(404);
    const assigned = await agent.post("/api/v1/author/tickets").set("X-CSRF-Token", token).send({
      bookId: "BK001",
      subject: "Royalty pending",
      description: "I would like to understand the pending royalty on Whispers of the Ganges.",
      status: "RESOLVED",
      authorPublicId: "AUTH002",
    });
    expect(assigned.status).toBe(400);
  });

  it("hides another author's ticket from the author API and the admin API", async () => {
    const priya = await login("priya.sharma@email.com", "BookLeaf#Author1");
    const created = await priya.agent
      .post("/api/v1/author/tickets")
      .set("X-CSRF-Token", priya.token)
      .send({
        bookId: "BK001",
        subject: "Royalty pending",
        description: "I would like to understand the pending royalty on Whispers of the Ganges.",
      });
    const rohit = await login("rohit.kapoor@email.com", "BookLeaf#Author1");
    const hidden = await rohit.agent.get(`/api/v1/author/tickets/${created.body.ticketId}`);
    expect(hidden.status).toBe(404);
    expect(JSON.stringify(hidden.body)).not.toContain("internalNotes");
    const adminRoute = await rohit.agent.get(`/api/v1/admin/tickets/${created.body.ticketId}`);
    expect(adminRoute.status).toBe(403);
    const patch = await rohit.agent
      .patch(`/api/v1/admin/tickets/${created.body.ticketId}`)
      .set("X-CSRF-Token", rohit.token)
      .send({ status: "CLOSED" });
    expect(patch.status).toBe(403);
  });

  it("keeps internal notes private and allows a manual reply when AI fails", async () => {
    const author = await login("priya.sharma@email.com", "BookLeaf#Author1");
    const created = await author.agent
      .post("/api/v1/author/tickets")
      .set("X-CSRF-Token", author.token)
      .send({
        bookId: "BK001",
        subject: "Where is my royalty",
        description: "I published my book 4 months ago and still haven't received any royalty.",
      });
    const ticketId = created.body.ticketId as string;
    setAiProviderForTests({
      name: "down",
      async complete() {
        throw new AiProviderError("TIMEOUT", "timed out");
      },
    });
    const { processTicketAi } = await import("../src/ai/process.js");
    await processTicketAi(ticketId, { classify: true, draft: true });
    const stored = await TicketModel.findOne({ ticketId });
    expect(stored?.aiProcessingState).toBe("FALLBACK");
    expect(stored?.category).toBe("ROYALTY_PAYMENTS");

    const admin = await login("ops@bookleaf.demo", "BookLeaf#Admin1");
    const note = await admin.agent
      .post(`/api/v1/admin/tickets/${ticketId}/notes`)
      .set("X-CSRF-Token", admin.token)
      .send({ body: "Check the payout ledger before replying." });
    expect(note.status).toBe(201);
    expect(note.body.internalNotes[0].body).toContain("payout ledger");
    const authorView = await author.agent.get(`/api/v1/author/tickets/${ticketId}`);
    expect(JSON.stringify(authorView.body)).not.toContain("payout ledger");
    const authorNote = await author.agent
      .post(`/api/v1/admin/tickets/${ticketId}/notes`)
      .set("X-CSRF-Token", author.token)
      .send({ body: "Authors should not write this." });
    expect(authorNote.status).toBe(403);

    const reply = await admin.agent
      .post(`/api/v1/admin/tickets/${ticketId}/replies`)
      .set("X-CSRF-Token", admin.token)
      .send({ body: "We are reviewing the quarterly ledger and will follow up within 48 hours." });
    expect(reply.status).toBe(201);
    const updatedAuthorView = await author.agent.get(`/api/v1/author/tickets/${ticketId}`);
    expect(updatedAuthorView.body.messages[0].body).toContain("48 hours");
    const noteEvent = deliveredEvents().find((event) => event.event === "ticket.note.added");
    expect(noteEvent?.channels).toEqual(["private-admin"]);
    const replyEvent = deliveredEvents().find((event) => event.event === "ticket.reply.added");
    expect(replyEvent?.channels).toContain("private-author-AUTH001");
    expect(replyEvent?.channels).not.toContain("private-author-AUTH002");
  });

  it("lets an admin update status, classification, and assignment without losing an override", async () => {
    const author = await login("rohit.kapoor@email.com", "BookLeaf#Author1");
    const created = await author.agent
      .post("/api/v1/author/tickets")
      .set("X-CSRF-Token", author.token)
      .send({
        bookId: null,
        subject: "Bio update",
        description: "Can I update my author bio on the book page?",
      });
    const ticketId = created.body.ticketId as string;
    const admin = await login("ops@bookleaf.demo", "BookLeaf#Admin1");
    const updated = await admin.agent
      .patch(`/api/v1/admin/tickets/${ticketId}`)
      .set("X-CSRF-Token", admin.token)
      .send({ category: "GENERAL_INQUIRY", priority: "LOW", status: "IN_PROGRESS" });
    expect(updated.status).toBe(200);
    expect(updated.body.categorySource).toBe("ADMIN");
    const assigned = await admin.agent
      .post(`/api/v1/admin/tickets/${ticketId}/assign`)
      .set("X-CSRF-Token", admin.token);
    expect(assigned.body.assigneeName).toBe("BookLeaf Support");
    setAiProviderForTests(
      providerReturning(
        JSON.stringify({
          category: "ROYALTY_PAYMENTS",
          priority: "CRITICAL",
          reasoningSummary: "The model guessed a royalty issue.",
        }),
      ),
    );
    const { processTicketAi } = await import("../src/ai/process.js");
    await processTicketAi(ticketId, { classify: true, draft: false });
    const stored = await TicketModel.findOne({ ticketId });
    expect(stored?.category).toBe("GENERAL_INQUIRY");
    expect(stored?.priority).toBe("LOW");
    expect(stored?.categorySource).toBe("ADMIN");
  });

  it("accepts valid model output and falls back on malformed output", async () => {
    const author = await login("meera.nair@email.com", "BookLeaf#Author1");
    const created = await author.agent
      .post("/api/v1/author/tickets")
      .set("X-CSRF-Token", author.token)
      .send({
        bookId: "BK008",
        subject: "Print issue",
        description: "The images in my author copies are blurry and the pages are misaligned.",
      });
    const ticketId = created.body.ticketId as string;
    setAiProviderForTests(providerReturning("not-json"));
    const { processTicketAi } = await import("../src/ai/process.js");
    await processTicketAi(ticketId, { classify: true, draft: true });
    const fallback = await TicketModel.findOne({ ticketId });
    expect(fallback?.aiProcessingState).toBe("FALLBACK");
    expect(fallback?.draft?.response).toContain("A reprint approval is not on file");
    expect(fallback?.draft?.response?.toLowerCase()).not.toContain("re-sync has been");

    await TicketModel.updateOne(
      { ticketId },
      {
        $set: {
          category: null,
          categorySource: null,
          aiCategory: null,
          priority: null,
          prioritySource: null,
          aiPriority: null,
          draft: null,
        },
      },
    );
    setAiProviderForTests(
      providerReturning(
        JSON.stringify({
          category: "PRINTING_QUALITY",
          priority: "HIGH",
          reasoningSummary: "The author reports a print defect.",
        }),
      ),
    );
    await processTicketAi(ticketId, { classify: true, draft: false });
    const classified = await TicketModel.findOne({ ticketId });
    expect(classified?.category).toBe("PRINTING_QUALITY");
    expect(classified?.priority).toBe("HIGH");
    expect(classified?.aiProcessingState).toBe("COMPLETED");
    const usage = await AiUsageModel.find({
      ticketPublicId: ticketId,
      operation: "classify",
      success: true,
    });
    expect(usage[0]?.promptTokens).toBe(12);
    expect(usage[0]?.completionTokens).toBe(8);
  });

  it("accepts labeled model output, keeps admin overrides, and keeps an edited draft", async () => {
    const author = await login("arjun.malhotra@email.com", "BookLeaf#Author1");
    const created = await author.agent
      .post("/api/v1/author/tickets")
      .set("X-CSRF-Token", author.token)
      .send({
        bookId: null,
        subject: "Print quality",
        description: "The images in my author copies are blurry and the pages are misaligned.",
      });
    const ticketId = created.body.ticketId as string;
    await TicketModel.updateOne(
      { ticketId },
      {
        $set: {
          category: "PRINTING_QUALITY",
          categorySource: "ADMIN",
          priority: "HIGH",
          prioritySource: "ADMIN",
          priorityRank: 2,
          aiCategory: "PRINTING_QUALITY",
          aiPriority: "HIGH",
          draft: {
            response: "Admin edited this reply so it stays on the ticket.",
            policyBasis: ["printing"],
            requiresHumanVerification: true,
            generatedAt: new Date(),
            source: "ADMIN",
            editedByAdmin: true,
          },
        },
      },
    );
    setAiProviderForTests(
      providerReturning(
        'Note: {"category":"Royalty & Payments","priority":"Critical","reasoningSummary":"The model tried to replace the admin decision."}',
      ),
    );
    const { processTicketAi } = await import("../src/ai/process.js");
    await processTicketAi(ticketId, { classify: true, draft: true });
    const stored = await TicketModel.findOne({ ticketId });
    expect(stored?.category).toBe("PRINTING_QUALITY");
    expect(stored?.priority).toBe("HIGH");
    expect(stored?.categorySource).toBe("ADMIN");
    expect(stored?.prioritySource).toBe("ADMIN");
    expect(stored?.aiCategory).toBe("PRINTING_QUALITY");
    expect(stored?.draft?.response).toContain("Admin edited this reply");
    expect(stored?.draft?.editedByAdmin).toBe(true);

    await TicketModel.updateOne(
      { ticketId },
      {
        $set: {
          category: null,
          categorySource: null,
          priority: null,
          prioritySource: null,
          aiCategory: null,
          aiPriority: null,
          draft: null,
        },
      },
    );
    setAiProviderForTests(
      providerReturning(
        JSON.stringify({
          category: "Printing & Quality",
          priority: "High",
          reasoningSummary: "The author reports a print defect.",
        }),
      ),
    );
    await processTicketAi(ticketId, { classify: true, draft: false });
    const normalized = await TicketModel.findOne({ ticketId });
    expect(normalized?.category).toBe("PRINTING_QUALITY");
    expect(normalized?.priority).toBe("HIGH");
    expect(normalized?.aiProcessingState).toBe("COMPLETED");
  });

  it("filters the admin queue", async () => {
    const author = await login("vikram.joshi@email.com", "BookLeaf#Author1");
    const created = await author.agent
      .post("/api/v1/author/tickets")
      .set("X-CSRF-Token", author.token)
      .send({
        bookId: "BK006",
        subject: "ISBN mismatch",
        description: "My book is showing a different ISBN on Amazon than the physical copy.",
      });
    const admin = await login("ops@bookleaf.demo", "BookLeaf#Admin1");
    await admin.agent
      .patch(`/api/v1/admin/tickets/${created.body.ticketId}`)
      .set("X-CSRF-Token", admin.token)
      .send({ category: "ISBN_METADATA", priority: "HIGH", status: "OPEN" });
    const queue = await admin.agent.get(
      "/api/v1/admin/tickets?category=ISBN_METADATA&priority=HIGH&status=OPEN",
    );
    expect(queue.status).toBe(200);
    expect(queue.body.total).toBe(1);
    expect(queue.body.items[0].authorId).toBe("AUTH004");
    const dashboard = await admin.agent.get("/api/v1/admin/dashboard");
    expect(dashboard.body.totalTickets).toBe(1);
    expect(dashboard.body.highOrCriticalTickets).toBe(1);

    const impossible = await admin.agent.get("/api/v1/admin/tickets?dateFrom=2026-02-31");
    expect(impossible.status).toBe(400);
    const reversed = await admin.agent.get(
      "/api/v1/admin/tickets?dateFrom=2026-10-20&dateTo=2026-10-01",
    );
    expect(reversed.status).toBe(400);
    const extra = await admin.agent
      .patch(`/api/v1/admin/tickets/${created.body.ticketId}`)
      .set("X-CSRF-Token", admin.token)
      .send({ status: "OPEN", authorPublicId: "AUTH001" });
    expect(extra.status).toBe(400);

    await TicketModel.collection.updateOne(
      { ticketId: created.body.ticketId },
      { $set: { createdAt: new Date("2026-10-15T19:30:00.000Z") } },
    );
    const istDay = await admin.agent.get(
      "/api/v1/admin/tickets?dateFrom=2026-10-16&dateTo=2026-10-16",
    );
    expect(istDay.body.total).toBe(1);
    const previousUtcDay = await admin.agent.get(
      "/api/v1/admin/tickets?dateFrom=2026-10-15&dateTo=2026-10-15",
    );
    expect(previousUtcDay.body.total).toBe(0);
  });
});

describe("author registration", () => {
  const email = "new.author@email.com";
  const password = "Register#Pass1";

  afterEach(async () => {
    await UserModel.deleteOne({ email });
    await AuthorModel.deleteOne({ email });
  });

  it("creates an author account, stores a hash, and signs in", async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);
    const created = await agent.post("/api/v1/auth/register").set("X-CSRF-Token", token).send({
      name: "New Author",
      email: "New.Author@email.com",
      password,
    });
    expect(created.status).toBe(201);
    expect(created.body.user.role).toBe("AUTHOR");
    expect(created.body.user.email).toBe(email);
    expect(created.body.user.authorPublicId).toMatch(/^A[0-9A-F]{8}$/);
    expect(JSON.stringify(created.body)).not.toContain(password);
    const stored = await UserModel.findOne({ email }).select("+passwordHash");
    expect(stored?.role).toBe("AUTHOR");
    expect(stored?.passwordHash).not.toBe(password);
    expect(stored?.passwordHash.startsWith("$2")).toBe(true);
    expect(await verifyPassword(password, stored?.passwordHash ?? "")).toBe(true);
    const me = await agent.get("/api/v1/auth/me");
    expect(me.body.user.role).toBe("AUTHOR");
    const dashboard = await agent.get("/api/v1/author/dashboard");
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.totalBooks).toBe(0);
    const books = await agent.get("/api/v1/author/books");
    expect(books.body.items).toEqual([]);
    expect((await agent.get("/api/v1/author/books/BK001")).status).toBe(404);
    expect((await agent.get("/api/v1/admin/tickets")).status).toBe(403);
    const demo = await login("priya.sharma@email.com", "BookLeaf#Author1");
    expect(demo.response.status).toBe(200);
    expect(await UserModel.countDocuments({ role: "ADMIN" })).toBe(1);
  });

  it("rejects a duplicate normalized email", async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);
    const first = await agent.post("/api/v1/auth/register").set("X-CSRF-Token", token).send({
      name: "New Author",
      email,
      password,
    });
    expect(first.status).toBe(201);
    const secondToken = await csrf(agent);
    const second = await agent.post("/api/v1/auth/register").set("X-CSRF-Token", secondToken).send({
      name: "Someone Else",
      email: "NEW.AUTHOR@email.com",
      password: "Another#Pass1",
    });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("CONFLICT");
    expect(await UserModel.countDocuments({ email })).toBe(1);
    const seeded = await agent.post("/api/v1/auth/register").set("X-CSRF-Token", secondToken).send({
      name: "Priya Sharma",
      email: "PRIYA.SHARMA@email.com",
      password,
    });
    expect(seeded.status).toBe(409);
    const demo = await login("priya.sharma@email.com", "BookLeaf#Author1");
    expect(demo.response.status).toBe(200);
  });

  it("rejects invalid input and a submitted role", async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);
    const invalid = await agent.post("/api/v1/auth/register").set("X-CSRF-Token", token).send({
      name: "A",
      email: "not-an-email",
      password: "short",
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
    const escalated = await agent.post("/api/v1/auth/register").set("X-CSRF-Token", token).send({
      name: "New Author",
      email,
      password,
      role: "ADMIN",
    });
    expect(escalated.status).toBe(400);
    expect(await UserModel.countDocuments({ email })).toBe(0);
    expect(await UserModel.countDocuments({ role: "ADMIN" })).toBe(1);
  });
});
