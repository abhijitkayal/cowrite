import mongoose, { InferSchemaType, Model, Schema } from "mongoose";

const documentSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    yjsState: { type: Buffer, required: true, default: Buffer.alloc(0) }
  },
  { timestamps: true }
);

export type DocumentRecord = InferSchemaType<typeof documentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Document: Model<DocumentRecord> =
  mongoose.models.Document ||
  mongoose.model<DocumentRecord>("Document", documentSchema);
