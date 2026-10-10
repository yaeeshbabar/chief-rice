import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ["cash", "online"], default: "cash" },
    account: { type: mongoose.Schema.Types.ObjectId, ref: "BankAccount" }, // when paymentMethod is "online"
    // true when the customer paid straight into an Asim-owned account - that money
    // never passed through the salesman's cash drawer or account, so it must be
    // excluded from the cash-handling pools even though it still counts for
    // the customer's balance, payment history, and profit reporting.
    directToAsim: { type: Boolean, default: false },
    note: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Payment", paymentSchema);
