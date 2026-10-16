import mongoose, { Schema, type InferSchemaType } from "mongoose";

const authorSchema = new Schema(
  {
    authorId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    city: { type: String, default: "" },
    joinedDate: { type: String, required: true },
  },
  { timestamps: true },
);

export type AuthorDocument = InferSchemaType<typeof authorSchema> & { _id: mongoose.Types.ObjectId };
export const AuthorModel = mongoose.model("Author", authorSchema);
