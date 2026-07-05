import mongoose, { InferSchemaType, Model, Schema } from "mongoose";
import { roles } from "@/lib/constants";

const documentMemberSchema = new Schema(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    userEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 320,
      index: true
    },
    role: { type: String, enum: roles, required: true }
  },
  { timestamps: false }
);

documentMemberSchema.index({ documentId: 1, userId: 1 }, { unique: true });

export type DocumentMemberRecord = InferSchemaType<
  typeof documentMemberSchema
> & {
  _id: mongoose.Types.ObjectId;
};

export const DocumentMember: Model<DocumentMemberRecord> =
  mongoose.models.DocumentMember ||
  mongoose.model<DocumentMemberRecord>(
    "DocumentMember",
    documentMemberSchema
  );
