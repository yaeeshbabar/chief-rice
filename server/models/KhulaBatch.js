import mongoose from "mongoose";

// Loose (khula) rice is kept per rice type. Each batch is one lot that went into that
// type's khula: a bori that was opened, loose rice added by admin, or rice a customer
// returned. Sales take from the oldest batch first, and the khula page shows the total.
const khulaBatchSchema = new mongoose.Schema(
  {
    riceType: { type: mongoose.Schema.Types.ObjectId, ref: "RiceType", required: true },
    // BORI = a bori opened from main stock, LOOSE = loose rice added by admin, RETURN = customer return
    source: { type: String, enum: ["BORI", "LOOSE", "RETURN"], default: "BORI" },
    boriSize: { type: Number, enum: [25, 50] }, // KG of the bori that was opened (BORI only)
    // What went in: for an opened bori this is the weight on the scale, not the bag size.
    totalGrams: { type: Number, required: true },
    // Opened bori are weighed. Bag size minus the weight, e.g. 25,000 - 24,700 = 300 g short.
    // Negative when the bag weighed more than its size.
    openingShortGrams: { type: Number, default: 0 },
    remainingGrams: { type: Number, required: true },
    // Purchase cost per KG for LOOSE and RETURN lots (BORI lots use the bori's purchase price).
    costPerKg: { type: Number, default: 0 },
    wapsi: { type: mongoose.Schema.Types.ObjectId, ref: "Wapsi" }, // RETURN lots: the return record
    status: { type: String, enum: ["ACTIVE", "OVER", "FINISHED"], default: "ACTIVE" },
    // Grams that the system still counted as unsold when this batch was closed.
    // For "OVER" this is the real-world shortage (measurement loss); for "FINISHED"
    // it should be ~0. Kept for shortage reporting across time.
    shortfallGrams: { type: Number, default: 0 },
    // OVER = closed early because measurement ran out in real life before system reached 0
    openedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    closedAt: { type: Date },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("KhulaBatch", khulaBatchSchema);
