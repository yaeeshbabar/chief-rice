import { buildDateRangeFilter } from "../utils/dateRange.js";
import KhulaBatch from "../models/KhulaBatch.js";
import Stock from "../models/Stock.js";
import StockTransaction from "../models/StockTransaction.js";
import RiceType from "../models/RiceType.js";
import Sale from "../models/Sale.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { buildKhulaPools } from "../utils/khulaPools.js";
import { logChange, kgText, shortText, rs, requireReason } from "../utils/changeLog.js";

// Loose rice per rice type, with the lots inside each (for the khula containers).
export const khulaSummary = asyncHandler(async (req, res) => {
  res.json(await buildKhulaPools());
});

export const listKhulaBatches = asyncHandler(async (req, res) => {
  const { status, riceType } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (riceType) filter.riceType = riceType;
  const batches = await KhulaBatch.find(filter)
    .populate("riceType", "name")
    .populate("openedBy", "name")
    .sort({ createdAt: -1 });
  res.json(batches);
});

// Open a new bori into Khula (loose) stock - moves 1 bori out of main Stock.
// The bori is weighed first: khula gets the real weight, and whatever is missing from the
// bag size is saved on the lot as shortfall (e.g. 25 KG bori weighs 24,700 g = 300 g short).
export const openKhulaBatch = asyncHandler(async (req, res) => {
  const { riceTypeId } = req.body;
  const boriSize = Number(req.body.boriSize);
  const weighedGrams = Math.round(Number(req.body.weighedGrams));
  if (!riceTypeId || ![25, 50].includes(boriSize)) {
    return res.status(400).json({ message: "Rice type and bori size are required" });
  }
  const bagGrams = boriSize * 1000;
  if (!Number.isFinite(weighedGrams) || weighedGrams <= 0) {
    return res.status(400).json({ message: "Weigh the bori and enter its exact weight in grams (e.g. 24700)" });
  }
  if (weighedGrams > bagGrams * 1.1) {
    return res.status(400).json({
      message: `${weighedGrams.toLocaleString("en-US")} g is too much for a ${boriSize} KG bori. Check the weight (in grams, e.g. ${(bagGrams - 300).toLocaleString("en-US")}).`,
    });
  }
  const stock = await Stock.findOne({ riceType: riceTypeId, boriSize });
  if (!stock || stock.quantity < 1) {
    return res.status(400).json({ message: "No bori of this type/size available in main stock" });
  }

  stock.quantity -= 1;
  await stock.save();

  const shortGrams = bagGrams - weighedGrams;
  const batch = await KhulaBatch.create({
    riceType: riceTypeId,
    source: "BORI",
    boriSize,
    totalGrams: weighedGrams,
    remainingGrams: weighedGrams,
    openingShortGrams: shortGrams,
    openedBy: req.user._id,
  });

  const weightNote =
    shortGrams > 0 ? `${shortText(shortGrams)} short` : shortGrams < 0 ? `${shortText(shortGrams)} extra` : "exact weight";
  await StockTransaction.create({
    riceType: riceTypeId,
    boriSize,
    type: "OPENED_TO_KHULA",
    quantity: 1,
    note: `Bori opened for loose (Khula) sale, weighed ${kgText(weighedGrams)} (${weightNote})`,
    createdBy: req.user._id,
  });

  const populated = await batch.populate("riceType", "name");
  res.status(201).json(populated);
});

export const closeKhulaBatch = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body; // status: 'OVER' | 'FINISHED'
  if (!["OVER", "FINISHED"].includes(status)) {
    return res.status(400).json({ message: "Status must be OVER or FINISHED" });
  }
  const batch = await KhulaBatch.findById(id);
  if (!batch) return res.status(404).json({ message: "Khula batch not found" });
  if (batch.status !== "ACTIVE") {
    return res.status(400).json({ message: "This batch is already closed" });
  }
  batch.shortfallGrams = batch.remainingGrams;
  batch.status = status;
  batch.closedBy = req.user._id;
  batch.closedAt = new Date();
  if (note) batch.note = note;
  if (status === "OVER") batch.remainingGrams = 0;
  await batch.save();
  res.json(batch);
});

// Khula record for both panels: every lot opened or closed in the dates, with its two
// shortfalls - when the bori was opened (weighed less than its size) and when the batch was
// ended (rice the system still showed). Totals only count what was recorded in the dates.
export const shortageReport = asyncHandler(async (req, res) => {
  const { from, to, riceType, salesman } = req.query;
  const range = buildDateRangeFilter(from, to);
  const and = [];
  if (range) and.push({ $or: [{ createdAt: range }, { closedAt: range }] });
  if (riceType) and.push({ riceType });
  if (salesman) and.push({ $or: [{ openedBy: salesman }, { closedBy: salesman }] });

  const batches = await KhulaBatch.find(and.length ? { $and: and } : {})
    .populate("riceType", "name")
    .populate("openedBy", "name")
    .populate("closedBy", "name")
    .sort({ createdAt: -1 });

  const inRange = (date) =>
    !range || (date && (!range.$gte || date >= range.$gte) && (!range.$lte || date <= range.$lte));
  const opened = batches.filter((b) => inRange(b.createdAt));
  const closed = batches.filter((b) => b.status !== "ACTIVE" && inRange(b.closedAt));
  const weighed = opened.filter((b) => (b.source || "BORI") === "BORI");

  const openingShortGrams = weighed.reduce((sum, b) => sum + (b.openingShortGrams || 0), 0);
  const endingShortGrams = closed.reduce((sum, b) => sum + (b.shortfallGrams || 0), 0);

  res.json({
    batches,
    summary: {
      openedCount: opened.length,
      boriOpenedCount: weighed.length,
      closedCount: closed.length,
      overCount: closed.filter((b) => b.status === "OVER").length,
      finishedCount: closed.filter((b) => b.status === "FINISHED").length,
      openingShortGrams,
      endingShortGrams,
      totalShortGrams: openingShortGrams + endingShortGrams,
      // kept for older screens
      totalBatches: closed.length,
      totalShortfallGrams: openingShortGrams + endingShortGrams,
    },
  });
});

// Admin only: put loose rice straight into a type's khula (e.g. 10 KG left over outside
// any bori). Needs a purchase cost per KG so profit on its sales stays correct.
export const addLooseRice = asyncHandler(async (req, res) => {
  const { riceTypeId, note } = req.body;
  const grams = Math.round(Number(req.body.kg) * 1000);
  const costPerKg = Number(req.body.costPerKg);
  const type = await RiceType.findById(riceTypeId);
  if (!type || type.deleted) return res.status(404).json({ message: "Rice type not found" });
  if (!Number.isFinite(grams) || grams <= 0) return res.status(400).json({ message: "Enter how many KG of loose rice" });
  if (!Number.isFinite(costPerKg) || costPerKg <= 0) {
    return res.status(400).json({ message: "Purchase cost per KG is required - it's used to calculate profit." });
  }

  const batch = await KhulaBatch.create({
    riceType: type._id,
    source: "LOOSE",
    totalGrams: grams,
    remainingGrams: grams,
    costPerKg,
    openedBy: req.user._id,
    note: note || "",
  });
  await logChange(req, {
    area: "khula",
    action: "add",
    summary: `${kgText(grams)} loose ${type.name} added to khula @ ${rs(costPerKg)}/KG`,
    reason: note || "",
    after: { riceTypeName: type.name, grams, costPerKg },
  });
  res.status(201).json(batch);
});

// End a rice type's khula batch: the khula is finished in real life, so all its lots are
// closed. Whatever the system still showed (e.g. 750 g) is recorded as shortfall ("over"),
// or "finished" if it was already 0.
export const markTypeEmpty = asyncHandler(async (req, res) => {
  const { riceTypeId, note } = req.body;
  const type = await RiceType.findById(riceTypeId);
  if (!type) return res.status(404).json({ message: "Rice type not found" });
  const batches = await KhulaBatch.find({ riceType: type._id, status: "ACTIVE" });
  if (!batches.length) return res.status(400).json({ message: `${type.name} has no khula right now` });

  let shortGrams = 0;
  for (const b of batches) {
    shortGrams += b.remainingGrams;
    b.shortfallGrams = b.remainingGrams;
    b.status = b.remainingGrams > 0 ? "OVER" : "FINISHED";
    b.remainingGrams = 0;
    b.closedBy = req.user._id;
    b.closedAt = new Date();
    if (note) b.note = note;
    await b.save();
  }
  await logChange(req, {
    area: "khula",
    action: "close",
    summary:
      shortGrams > 0
        ? `${type.name} khula batch ended early, ${shortText(shortGrams)} short`
        : `${type.name} khula batch ended (finished exactly)`,
    reason: note || "",
    before: { remainingGrams: shortGrams },
  });
  res.json({ message: "Khula closed", shortGrams });
});

// Undo a lot that was put into khula by mistake, as long as nothing has been sold from it.
// An opened bori goes back to main stock; loose rice (admin only) is simply removed.
export const undoKhulaBatch = asyncHandler(async (req, res) => {
  const reason = requireReason(req.body?.reason);
  const batch = await KhulaBatch.findById(req.params.id).populate("riceType", "name");
  if (!batch) return res.status(404).json({ message: "Khula lot not found" });
  if (batch.status !== "ACTIVE" || batch.remainingGrams !== batch.totalGrams) {
    return res.status(400).json({ message: "Some rice from this lot has already been sold, so it can't be undone" });
  }
  if (batch.source === "RETURN") {
    return res.status(400).json({ message: "This rice came from a return. Undo the return from the Wapsi page instead." });
  }
  if (batch.source === "LOOSE" && req.user.role !== "admin") {
    return res.status(403).json({ message: "Only admin can remove loose rice" });
  }
  const usedInBills = await Sale.exists({
    cancelled: false,
    $or: [{ "items.khulaBatch": batch._id }, { "items.khulaAllocations.batch": batch._id }],
  });
  if (usedInBills) {
    return res.status(400).json({ message: "A bill still uses rice from this lot, so it can't be undone" });
  }

  const name = batch.riceType?.name || "Unknown";
  if (batch.source !== "LOOSE" && batch.boriSize) {
    let stock = await Stock.findOne({ riceType: batch.riceType._id, boriSize: batch.boriSize });
    if (!stock) stock = await Stock.create({ riceType: batch.riceType._id, boriSize: batch.boriSize, quantity: 0 });
    stock.quantity += 1;
    await stock.save();
    await StockTransaction.create({
      riceType: batch.riceType._id,
      boriSize: batch.boriSize,
      type: "ADJUSTMENT",
      quantity: 1,
      note: `Bori put back from khula (opened by mistake): ${reason}`,
      createdBy: req.user._id,
    });
  }
  await batch.deleteOne();

  await logChange(req, {
    area: "khula",
    action: "undo",
    summary:
      batch.source === "LOOSE"
        ? `${kgText(batch.totalGrams)} loose ${name} removed from khula`
        : `${name} ${batch.boriSize}KG bori put back from khula to main stock`,
    reason,
    before: { riceTypeName: name, source: batch.source, boriSize: batch.boriSize, grams: batch.totalGrams },
  });
  res.json({ message: "Undone" });
});
