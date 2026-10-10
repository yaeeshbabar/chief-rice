import mongoose from "mongoose";

const commissionAgentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    percentage: { type: Number, required: true, min: 0, max: 100 }, // % of PROFIT, not sale price
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("CommissionAgent", commissionAgentSchema);
