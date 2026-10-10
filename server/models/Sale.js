import mongoose from "mongoose";

const saleItemSchema = new mongoose.Schema(
  {
    itemType: { type: String, enum: ["khula", "bori"], required: true },
    riceType: { type: mongoose.Schema.Types.ObjectId, ref: "RiceType", required: true },
    riceTypeName: { type: String, required: true }, // snapshot for invoice printing
    boriSize: { type: Number, enum: [25, 50] }, // for bori items, or which bori the khula batch came from
    khulaBatch: { type: mongoose.Schema.Types.ObjectId, ref: "KhulaBatch" },
    quantityGrams: { type: Number }, // for khula items
    quantityBori: { type: Number }, // for bori items
    pricePerUnit: { type: Number, required: true }, // per KG for khula, per bori for bori
    total: { type: Number, required: true },
    // Cost snapshot at time of sale, used for profit reporting. Per KG for khula,
    // per bori for bori - taken from that rice/size's last purchase price.
    purchaseCostPerUnit: { type: Number, default: 0 },
    itemCost: { type: Number, default: 0 },
  },
  { _id: false }
);

// A full snapshot of the sale, stored before every edit/cancel so changes are traceable.
const versionSnapshotSchema = new mongoose.Schema(
  {
    items: { type: [saleItemSchema], default: [] },
    paymentType: String,
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    customerName: String,
    rideCost: Number,
    commissionAgentName: String,
    commissionAmount: Number,
    subtotal: Number,
    total: Number,
    profit: Number,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    changedAt: { type: Date, default: Date.now },
    action: { type: String, enum: ["edit", "cancel"], default: "edit" },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: Number, required: true, unique: true },
    // Resets to 1 every calendar day - separate from the permanent invoiceNumber.
    // Not `required` so old invoices created before this field existed can still be edited/saved.
    dailyBillNumber: { type: Number, default: 0 },
    billDateKey: { type: String, default: "" }, // YYYY-MM-DD in server local time
    items: { type: [saleItemSchema], default: [] },
    paymentType: { type: String, enum: ["cash", "credit"], required: true },
    // How the immediate (cash-type) payment was actually received.
    paymentMethod: { type: String, enum: ["cash", "online"], default: "cash" },
    account: { type: mongoose.Schema.Types.ObjectId, ref: "BankAccount" }, // when paymentMethod is "online"
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },

    // Ride is a store-borne delivery cost, never charged to the customer -
    // it only reduces this sale's profit, and mirrors an Expense record.
    rideCost: { type: Number, default: 0 },
    relatedRideExpense: { type: mongoose.Schema.Types.ObjectId, ref: "Expense" },

    commissionAgent: { type: mongoose.Schema.Types.ObjectId, ref: "CommissionAgent" },
    commissionPercent: { type: Number, default: 0 },
    commissionAmount: { type: Number, default: 0 },

    costOfGoods: { type: Number, default: 0 },
    profit: { type: Number, default: 0 }, // Asim's profit on this sale, after ride + commission

    subtotal: { type: Number, required: true },
    total: { type: Number, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    edited: { type: Boolean, default: false },
    previousVersions: { type: [versionSnapshotSchema], default: [] },

    cancelled: { type: Boolean, default: false },
    cancelReason: { type: String, default: "" },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("Sale", saleSchema);
