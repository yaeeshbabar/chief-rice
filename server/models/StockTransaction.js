import mongoose from "mongoose";

const stockTransactionSchema = new mongoose.Schema(
  {
    riceType: { type: mongoose.Schema.Types.ObjectId, ref: "RiceType", required: true },
    boriSize: { type: Number, enum: [25, 50], required: true },
    type: {
      type: String,
      enum: ["STOCK_IN", "OPENED_TO_KHULA", "SOLD_BORI", "WAPSI_IN", "ADJUSTMENT", "ASIM_PERSONAL_USE"],
      required: true,
    },
    quantity: { type: Number, required: true }, // number of bori affected
    pricePerBori: { type: Number, default: 0 },
    note: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("StockTransaction", stockTransactionSchema);
