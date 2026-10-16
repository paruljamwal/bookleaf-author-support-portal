import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { MESSAGE_VISIBILITIES, ROLES } from "@bookleaf/shared";

const messageSchema = new Schema(
  {
    ticket: { type: Schema.Types.ObjectId, ref: "Ticket", required: true, index: true },
    ticketPublicId: { type: String, required: true },
    authorPublicId: { type: String, required: true, index: true },
    senderUser: { type: Schema.Types.ObjectId, ref: "User", required: true },
    senderName: { type: String, required: true },
    senderRole: { type: String, enum: ROLES, required: true },
    body: { type: String, required: true },
    visibility: { type: String, enum: MESSAGE_VISIBILITIES, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

messageSchema.index({ ticket: 1, visibility: 1, createdAt: 1 });

export type MessageDocument = InferSchemaType<typeof messageSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};
export const MessageModel = mongoose.model("Message", messageSchema);
