import mongoose from "mongoose";

// One doc per (riceType, boriSize) combination - the main godown inventory in sealed bori.
const stockSchema = new mongoose.Schema(
  {
    riceType: { type: mongoose.Schema.Types.ObjectId, ref: "RiceType", required: true },
    boriSize: { type: Number, enum: [25, 50], required: true },
    quantity: { type: Number, default: 0 }, // number of bori bags in stock
    lastPricePerBori: { type: Number, default: 0 },
  },
  { timestamps: true }
);

stockSchema.index({ riceType: 1, boriSize: 1 }, { unique: true });

export default mongoose.model("Stock", stockSchema);
