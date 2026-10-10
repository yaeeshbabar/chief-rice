import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    // Top-level khata this expense belongs to.
    category: {
      type: String,
      enum: ["Dukan Kharch Khata", "Asim Kharcha Khata", "Salary"],
      required: true,
    },
    subCategory: { type: String, default: "" }, // e.g. Wifi, Rent, Cigarette, salesman name...
    amount: { type: Number, required: true },
    description: { type: String, default: "" },
    // Set when this is an "Asim Kharcha Khata > Rice Bags" expense - rice taken from
    // main stock for personal use, which must also reduce the actual inventory.
    relatedRiceType: { type: mongoose.Schema.Types.ObjectId, ref: "RiceType" },
    relatedBoriSize: { type: Number, enum: [25, 50] },
    relatedQuantityBori: { type: Number },
    // Set automatically when this expense was auto-created from a sale's ride cost.
    relatedSale: { type: mongoose.Schema.Types.ObjectId, ref: "Sale" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Expense", expenseSchema);
