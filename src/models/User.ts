import mongoose, { InferSchemaType, Model, Schema } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 320,
      index: true
    },
    passwordHash: { type: String, required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export type UserDocument = InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const User: Model<UserDocument> =
  mongoose.models.User || mongoose.model<UserDocument>("User", userSchema);
