import mongoose from "mongoose";

const wapsiSchema = new mongoose.Schema(
  {
    originalSale: { type: mongoose.Schema.Types.ObjectId, ref: "Sale" },
    itemType: { type: String, enum: ["khula", "bori"], required: true },
    riceType: { type: mongoose.Schema.Types.ObjectId, ref: "RiceType", required: true },
    riceTypeName: { type: String, required: true },
    boriSize: { type: Number, enum: [25, 50] },
    quantityGrams: { type: Number },
    quantityBori: { type: Number },
    cashReturned: { type: Number, default: 0 },
    reason: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Wapsi", wapsiSchema);
