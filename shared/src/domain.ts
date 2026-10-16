export const ROLES = ["AUTHOR", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const TICKET_CATEGORIES = [
  "ROYALTY_PAYMENTS",
  "ISBN_METADATA",
  "PRINTING_QUALITY",
  "DISTRIBUTION_AVAILABILITY",
  "BOOK_STATUS_PRODUCTION",
  "GENERAL_INQUIRY",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  ROYALTY_PAYMENTS: "Royalty & Payments",
  ISBN_METADATA: "ISBN & Metadata Issues",
  PRINTING_QUALITY: "Printing & Quality",
  DISTRIBUTION_AVAILABILITY: "Distribution & Availability",
  BOOK_STATUS_PRODUCTION: "Book Status & Production Updates",
  GENERAL_INQUIRY: "General Inquiry",
};

export const TICKET_PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const PRIORITY_RANK: Record<TicketPriority, number> = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
};
export const UNSET_PRIORITY_RANK = 5;

export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const STATUS_RANK: Record<TicketStatus, number> = {
  OPEN: 1,
  IN_PROGRESS: 2,
  RESOLVED: 3,
  CLOSED: 4,
};

export const DECISION_SOURCES = ["AI", "ADMIN", "FALLBACK"] as const;
export type DecisionSource = (typeof DECISION_SOURCES)[number];

export const AI_STATES = ["PENDING", "COMPLETED", "FALLBACK", "FAILED"] as const;
export type AiProcessingState = (typeof AI_STATES)[number];

export const MESSAGE_VISIBILITIES = ["AUTHOR_VISIBLE", "INTERNAL"] as const;
export type MessageVisibility = (typeof MESSAGE_VISIBILITIES)[number];

export const REALTIME_EVENTS = [
  "ticket.created",
  "ticket.updated",
  "ticket.reply.added",
  "ticket.note.added",
] as const;
export type RealtimeEventName = (typeof REALTIME_EVENTS)[number];

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  authorPublicId: string | null;
}

export interface AuthorBook {
  bookId: string;
  title: string;
  isbn: string | null;
  genre: string | null;
  publicationDate: string | null;
  status: string;
  mrp: number | null;
  authorRoyaltyPerCopy: number | null;
  totalCopiesSold: number;
  totalRoyaltyEarned: number;
  royaltyPaid: number;
  royaltyPending: number;
  lastRoyaltyPayoutDate: string | null;
  printPartner: string | null;
  availableOn: string[];
}

export interface AuthorProfile {
  authorId: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  joinedDate: string;
}

export interface AuthorDashboard {
  author: AuthorProfile;
  totalBooks: number;
  publishedBooks: number;
  booksInProduction: number;
  openTickets: number;
  pendingRoyalties: number;
  recentTickets: TicketSummary[];
}

export interface TicketSummary {
  ticketId: string;
  subject: string;
  bookId: string | null;
  bookTitle: string | null;
  category: TicketCategory | null;
  priority: TicketPriority | null;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessage {
  id: string;
  senderName: string;
  senderRole: Role;
  body: string;
  createdAt: string;
}

export interface AuthorTicketDetail extends TicketSummary {
  description: string;
  messages: TicketMessage[];
}

export interface AdminTicketSummary extends TicketSummary {
  authorId: string;
  authorName: string;
  assigneeName: string | null;
  aiProcessingState: AiProcessingState;
}

export interface TicketDraft {
  response: string;
  policyBasis: string[];
  requiresHumanVerification: boolean;
  generatedAt: string;
  source: DecisionSource;
  editedByAdmin: boolean;
}

export interface AdminTicketDetail extends AdminTicketSummary {
  description: string;
  authorEmail: string;
  authorCity: string;
  book: AuthorBook | null;
  aiCategory: TicketCategory | null;
  categorySource: DecisionSource | null;
  aiPriority: TicketPriority | null;
  prioritySource: DecisionSource | null;
  aiFailureMessage: string | null;
  reasoningSummary: string | null;
  draft: TicketDraft | null;
  replies: TicketMessage[];
  internalNotes: TicketMessage[];
}

export interface AdminDashboard {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  highOrCriticalTickets: number;
  resolvedTickets: number;
  urgentTickets: AdminTicketSummary[];
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { path: string; message: string }[];
  };
}

export function isPublishedStatus(status: string): boolean {
  return status.toLowerCase().startsWith("published");
}

export function isInProductionStatus(status: string): boolean {
  return status.toLowerCase().includes("production");
}
