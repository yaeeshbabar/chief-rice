import mongoose from "mongoose";

// Represents one bori opened up for loose (khula) sale.
const khulaBatchSchema = new mongoose.Schema(
  {
    riceType: { type: mongoose.Schema.Types.ObjectId, ref: "RiceType", required: true },
    boriSize: { type: Number, enum: [25, 50], required: true }, // KG of the bori that was opened
    totalGrams: { type: Number, required: true }, // boriSize * 1000
    remainingGrams: { type: Number, required: true },
    status: { type: String, enum: ["ACTIVE", "OVER", "FINISHED"], default: "ACTIVE" },
    // Grams that the system still counted as unsold when this batch was closed.
    // For "OVER" this is the real-world shortage (measurement loss); for "FINISHED"
    // it should be ~0. Kept for shortage reporting across time.
    shortfallGrams: { type: Number, default: 0 },
    // OVER = salesman closed it early because measurement ran out in real life before system reached 0
    openedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    closedAt: { type: Date },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("KhulaBatch", khulaBatchSchema);
