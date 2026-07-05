import mongoose, { InferSchemaType, Model, Schema } from "mongoose";

const documentVersionSchema = new Schema(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true
    },
    snapshot: { type: Buffer, required: true },
    content: {
      type: String,
      required: true
    },
    createEmail:{
      type: String,
      required: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export type DocumentVersionRecord = InferSchemaType<
  typeof documentVersionSchema
> & {
  _id: mongoose.Types.ObjectId;
};

export const DocumentVersion: Model<DocumentVersionRecord> =
  mongoose.models.DocumentVersion ||
  mongoose.model<DocumentVersionRecord>(
    "DocumentVersion",
    documentVersionSchema
  );
