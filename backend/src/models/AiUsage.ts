import mongoose, { Schema } from "mongoose";

const aiUsageSchema = new Schema(
  {
    ticketPublicId: { type: String, default: null, index: true },
    operation: { type: String, required: true },
    model: { type: String, required: true },
    promptTokens: { type: Number, default: null },
    completionTokens: { type: Number, default: null },
    latencyMs: { type: Number, required: true },
    success: { type: Boolean, required: true },
    errorCode: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const AiUsageModel = mongoose.model("AiUsage", aiUsageSchema);
