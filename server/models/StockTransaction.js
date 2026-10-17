import mongoose from "mongoose";

// The earlier values of a stock-in entry, kept every time it is corrected.
const stockEntryVersionSchema = new mongoose.Schema(
  {
    riceType: { type: mongoose.Schema.Types.ObjectId, ref: "RiceType" },
    riceTypeName: String,
    boriSize: Number,
    quantity: Number,
    pricePerBori: Number,
    note: String,
    reason: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

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

    // For count corrections (ADJUSTMENT): the bag count before and after.
    quantityBefore: { type: Number },
    quantityAfter: { type: Number },

    // A wrong stock-in entry can be corrected or deleted; every change is kept.
    edited: { type: Boolean, default: false },
    history: { type: [stockEntryVersionSchema], default: [] },
    deleted: { type: Boolean, default: false },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date },
    deleteReason: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("StockTransaction", stockTransactionSchema);
