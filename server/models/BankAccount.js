import mongoose from "mongoose";

const bankAccountSchema = new mongoose.Schema(
  {
    ownerType: { type: String, enum: ["asim", "salesman"], required: true },
    ownerName: { type: String, required: true }, // display name on the account
    bankName: { type: String, required: true },
    accountTitle: { type: String, required: true },
    accountNumber: { type: String, required: true },
    iban: { type: String, default: "" },
    branchCode: { type: String, default: "" },
    active: { type: Boolean, default: true },
    // Deleted accounts that old bills/payments still point to are hidden, not erased.
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("BankAccount", bankAccountSchema);
