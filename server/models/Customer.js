import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    shopName: { type: String, default: "" },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    balance: { type: Number, default: 0 }, // outstanding credit owed (Rs)
    // Money already owed before the customer was added to the app (old paper khata).
    // It is part of `balance`; kept separately so the khata page can show it.
    openingBalance: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

customerSchema.index({ name: "text", shopName: "text", phone: "text" });

export default mongoose.model("Customer", customerSchema);
