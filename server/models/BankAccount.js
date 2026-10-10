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
  },
  { timestamps: true }
);

export default mongoose.model("BankAccount", bankAccountSchema);
