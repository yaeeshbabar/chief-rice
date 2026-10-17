import mongoose from "mongoose";

// One row for every correction made in the app (rename, edit, delete, stock count fix...),
// so the owner can always see what changed, who changed it and why.
const changeLogSchema = new mongoose.Schema(
  {
    // rice-type | stock | khula | payment | wapsi | handover | commission | expense | customer | settings
    area: { type: String, required: true },
    action: { type: String, required: true }, // add | edit | delete | adjust | rename | undo | close | restore ...
    summary: { type: String, required: true }, // plain sentence shown in the Changes Report
    reason: { type: String, default: "" },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("ChangeLog", changeLogSchema);
