import mongoose, { Schema } from "mongoose";

const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

export const CounterModel = mongoose.model("Counter", counterSchema);

export async function nextTicketId(): Promise<string> {
  const counter = await CounterModel.findOneAndUpdate(
    { _id: "ticket" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  if (!counter) throw new Error("Could not allocate a ticket id.");
  return `TKT-${String(counter.seq).padStart(4, "0")}`;
}
