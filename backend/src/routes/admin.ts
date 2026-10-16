import { Router } from "express";
import { messageBodySchema, saveDraftSchema, ticketIdSchema, ticketQueueQuerySchema, updateTicketSchema } from "@bookleaf/shared";
import { asyncHandler } from "../lib/async.js";
import { AppError } from "../lib/errors.js";
import { requireAbility, requireAuth } from "../middleware/auth.js";
import {
  addInternalNote,
  assignTicketToSelf,
  getAdminDashboard,
  getAdminTicket,
  listAdminTickets,
  regenerateDraft,
  rerunClassification,
  saveDraft,
  sendReply,
  updateAdminTicket,
} from "../services/ticket.service.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAbility("read", "AdminArea"));

function actor(req: Express.Request) {
  if (!req.actor) throw new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return req.actor;
}

adminRouter.get(
  "/dashboard",
  asyncHandler(async (_req, res) => {
    res.json(await getAdminDashboard());
  }),
);

adminRouter.get(
  "/tickets",
  asyncHandler(async (req, res) => {
    const query = ticketQueueQuerySchema.parse(req.query);
    res.json(await listAdminTickets(query));
  }),
);

adminRouter.get(
  "/tickets/:ticketId",
  asyncHandler(async (req, res) => {
    const params = ticketIdSchema.parse(req.params);
    res.json(await getAdminTicket(params.ticketId));
  }),
);

adminRouter.patch(
  "/tickets/:ticketId",
  requireAbility("update", "AdminArea"),
  asyncHandler(async (req, res) => {
    const params = ticketIdSchema.parse(req.params);
    const body = updateTicketSchema.parse(req.body);
    res.json(await updateAdminTicket(params.ticketId, body));
  }),
);

adminRouter.post(
  "/tickets/:ticketId/assign",
  requireAbility("update", "AdminArea"),
  asyncHandler(async (req, res) => {
    const params = ticketIdSchema.parse(req.params);
    res.json(await assignTicketToSelf(actor(req), params.ticketId));
  }),
);

adminRouter.post(
  "/tickets/:ticketId/notes",
  requireAbility("create", "InternalNote"),
  asyncHandler(async (req, res) => {
    const params = ticketIdSchema.parse(req.params);
    const body = messageBodySchema.parse(req.body);
    res.status(201).json(await addInternalNote(actor(req), params.ticketId, body.body));
  }),
);

adminRouter.post(
  "/tickets/:ticketId/replies",
  requireAbility("update", "AdminArea"),
  asyncHandler(async (req, res) => {
    const params = ticketIdSchema.parse(req.params);
    const body = messageBodySchema.parse(req.body);
    res.status(201).json(await sendReply(actor(req), params.ticketId, body.body));
  }),
);

adminRouter.post(
  "/tickets/:ticketId/draft",
  requireAbility("update", "AdminArea"),
  asyncHandler(async (req, res) => {
    const params = ticketIdSchema.parse(req.params);
    res.json(await regenerateDraft(params.ticketId));
  }),
);

adminRouter.patch(
  "/tickets/:ticketId/draft",
  requireAbility("update", "AdminArea"),
  asyncHandler(async (req, res) => {
    const params = ticketIdSchema.parse(req.params);
    const body = saveDraftSchema.parse(req.body);
    res.json(await saveDraft(params.ticketId, body));
  }),
);

adminRouter.post(
  "/tickets/:ticketId/classify",
  requireAbility("update", "AdminArea"),
  asyncHandler(async (req, res) => {
    const params = ticketIdSchema.parse(req.params);
    res.json(await rerunClassification(params.ticketId));
  }),
);
