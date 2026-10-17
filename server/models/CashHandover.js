import mongoose from "mongoose";

const cashHandoverSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    // Which pool this handover was taken from.
    source: { type: String, enum: ["cash", "account"], default: "cash" },
    account: { type: mongoose.Schema.Types.ObjectId, ref: "BankAccount" }, // when source is "account"
    // Asim's bank account the money went into (cash deposited at the bank, or a transfer).
    // Empty = cash given to Asim in hand.
    toAccount: { type: mongoose.Schema.Types.ObjectId, ref: "BankAccount" },
    note: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default mongoose.model("CashHandover", cashHandoverSchema);
