import mongoose from "mongoose";

// Admin-managed dropdown option lists, e.g. type: "salaryPerson" -> ["Ali", "Kashif"]
// or type: "rentType" -> ["Store Rent", "House Rent", "House 2 Rent"]
const expenseOptionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["salaryPerson", "rentType"], required: true },
    name: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

expenseOptionSchema.index({ type: 1, name: 1 }, { unique: true });

export default mongoose.model("ExpenseOption", expenseOptionSchema);
