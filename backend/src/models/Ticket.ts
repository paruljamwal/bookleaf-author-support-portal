import mongoose, { Schema, type InferSchemaType } from "mongoose";
import {
  AI_STATES,
  DECISION_SOURCES,
  TICKET_STATUSES,
  UNSET_PRIORITY_RANK,
} from "@bookleaf/shared";

const draftSchema = new Schema(
  {
    response: { type: String, required: true },
    policyBasis: { type: [String], default: [] },
    requiresHumanVerification: { type: Boolean, required: true },
    generatedAt: { type: Date, required: true },
    source: { type: String, enum: DECISION_SOURCES, required: true },
    editedByAdmin: { type: Boolean, required: true, default: false },
  },
  { _id: false },
);

const ticketSchema = new Schema(
  {
    ticketId: { type: String, required: true, unique: true },
    author: { type: Schema.Types.ObjectId, ref: "Author", required: true },
    authorPublicId: { type: String, required: true },
    authorName: { type: String, required: true },
    book: { type: Schema.Types.ObjectId, ref: "Book", default: null },
    bookPublicId: { type: String, default: null },
    bookTitle: { type: String, default: null },
    subject: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, default: null },
    aiCategory: { type: String, default: null },
    categorySource: { type: String, default: null },
    priority: { type: String, default: null },
    aiPriority: { type: String, default: null },
    prioritySource: { type: String, default: null },
    priorityRank: { type: Number, required: true, default: UNSET_PRIORITY_RANK },
    status: { type: String, enum: TICKET_STATUSES, required: true, default: "OPEN" },
    statusRank: { type: Number, required: true, default: 1 },
    assignee: { type: Schema.Types.ObjectId, ref: "User", default: null },
    assigneeName: { type: String, default: null },
    aiProcessingState: { type: String, enum: AI_STATES, required: true, default: "PENDING" },
    aiFailureMessage: { type: String, default: null },
    reasoningSummary: { type: String, default: null },
    draft: { type: draftSchema, default: null },
  },
  { timestamps: true },
);

ticketSchema.index({ authorPublicId: 1, createdAt: -1 });
ticketSchema.index({ createdAt: 1 });
ticketSchema.index({ status: 1, category: 1, priority: 1, createdAt: 1 });
ticketSchema.index({ statusRank: 1, priorityRank: 1, createdAt: 1 });
ticketSchema.index({ assignee: 1 });

export type TicketDocument = InferSchemaType<typeof ticketSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
export const TicketModel = mongoose.model("Ticket", ticketSchema);
