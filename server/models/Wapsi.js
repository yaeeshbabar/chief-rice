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
    // Khula returns go back into that type's khula as their own lot.
    khulaBatch: { type: mongoose.Schema.Types.ObjectId, ref: "KhulaBatch" },
    // When the return reduced a customer's khata instead of (or as well as) cash, how much.
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    balanceAdjustment: { type: Number, default: 0 },
    reason: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Wapsi", wapsiSchema);
