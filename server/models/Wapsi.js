import mongoose from "mongoose";

// One returned thing: bori go back into main stock, khula into that rice type's khula.
const wapsiItemSchema = new mongoose.Schema(
  {
    itemType: { type: String, enum: ["khula", "bori"], required: true },
    riceType: { type: mongoose.Schema.Types.ObjectId, ref: "RiceType", required: true },
    riceTypeName: { type: String, required: true },
    boriSize: { type: Number, enum: [25, 50] },
    quantityGrams: { type: Number },
    quantityBori: { type: Number },
    // Khula returns go back into that type's khula as their own lot.
    khulaBatch: { type: mongoose.Schema.Types.ObjectId, ref: "KhulaBatch" },
  },
  { _id: false }
);

const wapsiSchema = new mongoose.Schema(
  {
    originalSale: { type: mongoose.Schema.Types.ObjectId, ref: "Sale" },
    // Everything returned in one go (bori and khula together).
    items: { type: [wapsiItemSchema], default: undefined },

    // Returns recorded before several items were possible keep their one item here.
    itemType: { type: String, enum: ["khula", "bori"] },
    riceType: { type: mongoose.Schema.Types.ObjectId, ref: "RiceType" },
    riceTypeName: { type: String },
    boriSize: { type: Number, enum: [25, 50] },
    quantityGrams: { type: Number },
    quantityBori: { type: Number },
    khulaBatch: { type: mongoose.Schema.Types.ObjectId, ref: "KhulaBatch" },

    // How the money went back: "cash" (paid from the counter) or "khata" (cut from a creditor's
    // balance). Older returns have no value here.
    refundTo: { type: String, enum: ["cash", "khata"] },
    amount: { type: Number, default: 0 }, // money given back, either way
    cashReturned: { type: Number, default: 0 }, // cash paid out of the counter
    // When the return reduced a customer's khata, whose and by how much.
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    balanceAdjustment: { type: Number, default: 0 },
    reason: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Wapsi", wapsiSchema);
