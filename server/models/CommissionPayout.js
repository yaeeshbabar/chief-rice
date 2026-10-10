import mongoose from "mongoose";

// Cash handed to a commission salesman out of the counter. Commission is already deducted
// from profit at sale time, so a payout is NOT an extra expense for profit purposes - it only
// settles what is owed, and it reduces the cash sitting in the counter.
const commissionPayoutSchema = new mongoose.Schema(
  {
    agent: { type: mongoose.Schema.Types.ObjectId, ref: "CommissionAgent", required: true },
    agentName: { type: String, required: true }, // snapshot so history survives renames
    amount: { type: Number, required: true },
    note: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default mongoose.model("CommissionPayout", commissionPayoutSchema);
