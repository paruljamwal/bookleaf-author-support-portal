import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { ROLES } from "@bookleaf/shared";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
    author: { type: Schema.Types.ObjectId, ref: "Author", default: null },
    authorPublicId: { type: String, default: null, index: true },
    tokenVersion: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };
export const UserModel = mongoose.model("User", userSchema);
