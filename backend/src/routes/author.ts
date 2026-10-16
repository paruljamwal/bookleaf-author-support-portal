import { Router } from "express";
import type { Request } from "express";
import { subject } from "@casl/ability";
import { bookIdSchema, createTicketSchema, ticketIdSchema } from "@bookleaf/shared";
import { asyncHandler } from "../lib/async.js";
import { AppError } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { getAuthorBook, getAuthorDashboard, listAuthorBooks } from "../services/book.service.js";
import { createTicket, getAuthorTicket, listAuthorTickets } from "../services/ticket.service.js";

export const authorRouter = Router();

authorRouter.use(requireAuth, (req, _res, next) => {
  const authorPublicId = req.actor?.authorPublicId;
  if (!authorPublicId || req.actor?.ability.cannot("read", subject("Book", { authorPublicId }))) {
    next(new AppError(403, "FORBIDDEN", "You do not have access to that action."));
    return;
  }
  next();
});

function actor(req: Request) {
  if (!req.actor) throw new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return req.actor;
}

authorRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    res.json(await getAuthorDashboard(actor(req)));
  }),
);

authorRouter.get(
  "/books",
  asyncHandler(async (req, res) => {
    res.json({ items: await listAuthorBooks(actor(req)) });
  }),
);

authorRouter.get(
  "/books/:bookId",
  asyncHandler(async (req, res) => {
    const params = bookIdSchema.parse(req.params);
    res.json(await getAuthorBook(actor(req), params.bookId));
  }),
);

authorRouter.get(
  "/tickets",
  asyncHandler(async (req, res) => {
    res.json({ items: await listAuthorTickets(actor(req)) });
  }),
);

authorRouter.post(
  "/tickets",
  asyncHandler(async (req, res) => {
    const body = createTicketSchema.parse(req.body);
    const ticket = await createTicket(actor(req), body);
    res.status(201).json(ticket);
  }),
);

authorRouter.get(
  "/tickets/:ticketId",
  asyncHandler(async (req, res) => {
    const params = ticketIdSchema.parse(req.params);
    res.json(await getAuthorTicket(actor(req), params.ticketId));
  }),
);
