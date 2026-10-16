import mongoose, { Schema, type InferSchemaType } from "mongoose";

const bookSchema = new Schema(
  {
    bookId: { type: String, required: true, unique: true },
    author: { type: Schema.Types.ObjectId, ref: "Author", required: true, index: true },
    authorPublicId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    isbn: { type: String, default: null },
    genre: { type: String, default: null },
    publicationDate: { type: String, default: null },
    status: { type: String, required: true },
    mrp: { type: Number, default: null },
    authorRoyaltyPerCopy: { type: Number, default: null },
    totalCopiesSold: { type: Number, required: true },
    totalRoyaltyEarned: { type: Number, required: true },
    royaltyPaid: { type: Number, required: true },
    royaltyPending: { type: Number, required: true },
    lastRoyaltyPayoutDate: { type: String, default: null },
    printPartner: { type: String, default: null },
    availableOn: { type: [String], default: [] },
  },
  { timestamps: true },
);

bookSchema.index({ authorPublicId: 1, title: 1 });

export type BookDocument = InferSchemaType<typeof bookSchema> & { _id: mongoose.Types.ObjectId };
export const BookModel = mongoose.model("Book", bookSchema);
