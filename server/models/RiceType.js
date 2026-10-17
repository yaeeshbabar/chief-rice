import mongoose from "mongoose";

const riceTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    active: { type: Boolean, default: true },
    // A deleted type that has sales history is hidden everywhere instead of being erased,
    // so old bills and reports still show the right name.
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("RiceType", riceTypeSchema);
