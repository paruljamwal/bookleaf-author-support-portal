import { z } from "zod";
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from "./domain.js";

export const loginSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email address.").max(200),
    password: z.string().min(8, "Password must be at least 8 characters.").max(200),
  })
  .strict();
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name.").max(80),
    email: z.string().trim().email("Enter a valid email address.").max(200),
    password: z.string().min(8, "Password must be at least 8 characters.").max(200),
  })
  .strict();
export type RegisterInput = z.infer<typeof registerSchema>;

export const createTicketSchema = z
  .object({
    bookId: z.preprocess(
      (value) => (value === "" ? null : value),
      z.string().trim().min(1).max(40).nullable(),
    ),
    subject: z.string().trim().min(3, "Subject must be at least 3 characters.").max(140),
    description: z.string().trim().min(20, "Description must be at least 20 characters.").max(5000),
  })
  .strict();
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const updateTicketSchema = z
  .object({
    category: z.enum(TICKET_CATEGORIES).optional(),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    status: z.enum(TICKET_STATUSES).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.category !== undefined || value.priority !== undefined || value.status !== undefined,
    {
      message: "Choose a category, priority, or status to update.",
    },
  );
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

export const messageBodySchema = z
  .object({
    body: z.string().trim().min(2, "Write at least 2 characters.").max(5000),
  })
  .strict();
export type MessageBodyInput = z.infer<typeof messageBodySchema>;

export const saveDraftSchema = z
  .object({
    response: z.string().trim().min(20, "The draft needs at least 20 characters.").max(5000),
  })
  .strict();
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;

const optionalEnum = (values: readonly [string, ...string[]]) =>
  z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.enum(values).optional(),
  );

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const optionalDate = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.string().refine(isCalendarDate, "Use a real YYYY-MM-DD date.").optional(),
);

export const ticketQueueQuerySchema = z
  .object({
    status: optionalEnum(TICKET_STATUSES),
    category: optionalEnum(TICKET_CATEGORIES),
    priority: optionalEnum(TICKET_PRIORITIES),
    dateFrom: optionalDate,
    dateTo: optionalDate,
    page: z.coerce.number().int().min(1).max(200).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, {
    message: "The start date must be on or before the end date.",
    path: ["dateTo"],
  });
export type TicketQueueQuery = z.infer<typeof ticketQueueQuerySchema>;

export const ticketIdSchema = z.object({
  ticketId: z.string().regex(/^TKT-\d{4,}$/, "Ticket id is not valid."),
});

export const bookIdSchema = z.object({
  bookId: z.string().trim().min(1).max(40),
});
