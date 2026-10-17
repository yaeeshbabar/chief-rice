import { buildDateRangeFilter } from "../utils/dateRange.js";
import Stock from "../models/Stock.js";
import StockTransaction from "../models/StockTransaction.js";
import RiceType from "../models/RiceType.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { logChange, rs, requireReason } from "../utils/changeLog.js";

// Deleted rice types are hidden, unless bori of that type came back later (e.g. an old bill
// was cancelled) - then the row stays visible so no stock is ever invisible.
export const visibleStock = (rows) => rows.filter((s) => s.riceType && (!s.riceType.deleted || s.quantity > 0));

export const listStock = asyncHandler(async (req, res) => {
  const stock = await Stock.find().populate("riceType", "name active deleted").sort({ "riceType.name": 1 });
  res.json(visibleStock(stock));
});

const findOrCreateStock = async (riceTypeId, boriSize) => {
  let stock = await Stock.findOne({ riceType: riceTypeId, boriSize });
  if (!stock) stock = await Stock.create({ riceType: riceTypeId, boriSize, quantity: 0 });
  return stock;
};

// The purchase price used for profit is always the price of the latest stock-in entry
// that hasn't been deleted - recalculated whenever an entry is corrected or removed.
const refreshLastPrice = async (riceTypeId, boriSize) => {
  const stock = await Stock.findOne({ riceType: riceTypeId, boriSize });
  if (!stock) return;
  const latest = await StockTransaction.findOne({
    riceType: riceTypeId,
    boriSize,
    type: "STOCK_IN",
    deleted: { $ne: true },
  }).sort({ createdAt: -1 });
  stock.lastPricePerBori = latest ? latest.pricePerBori || 0 : 0;
  await stock.save();
};

const typeName = async (riceTypeId) => (await RiceType.findById(riceTypeId))?.name || "Unknown";

// Admin only: add new bori bags coming into the main godown
export const addStock = asyncHandler(async (req, res) => {
  const { riceTypeId, boriSize, quantity, pricePerBori, note } = req.body;
  if (!riceTypeId || !boriSize || !quantity) {
    return res.status(400).json({ message: "Rice type, bori size and quantity are required" });
  }
  if (!pricePerBori || Number(pricePerBori) <= 0) {
    return res.status(400).json({
      message: "Purchase price per bori is required - it's used to calculate profit on every sale.",
    });
  }
  const type = await RiceType.findById(riceTypeId);
  if (!type || type.deleted) return res.status(404).json({ message: "Rice type not found" });

  const stock = await findOrCreateStock(riceTypeId, boriSize);
  stock.quantity += Number(quantity);
  stock.lastPricePerBori = Number(pricePerBori);
  await stock.save();

  await StockTransaction.create({
    riceType: riceTypeId,
    boriSize,
    type: "STOCK_IN",
    quantity: Number(quantity),
    pricePerBori: Number(pricePerBori),
    note: note || "",
    createdBy: req.user._id,
  });

  const populated = await stock.populate("riceType", "name");
  res.status(201).json(populated);
});

export const listTransactions = asyncHandler(async (req, res) => {
  const { riceType, from, to, type } = req.query;
  const filter = {};
  if (riceType) filter.riceType = riceType;
  if (type) filter.type = type;
  const range = buildDateRangeFilter(from, to);
  if (range) filter.createdAt = range;
  const txns = await StockTransaction.find(filter)
    .populate("riceType", "name")
    .populate("createdBy", "name role")
    .populate("deletedBy", "name")
    .populate("history.changedBy", "name")
    .sort({ createdAt: -1 })
    .limit(500);
  res.json(txns);
});

// Admin only: correct a stock-in entry that was typed wrong (rice type, bori size,
// number of bori or price). The bags are moved/adjusted and the old values are kept.
export const updateStockEntry = asyncHandler(async (req, res) => {
  const reason = requireReason(req.body.reason);
  const txn = await StockTransaction.findById(req.params.id);
  if (!txn || txn.deleted) return res.status(404).json({ message: "Stock entry not found" });
  if (txn.type !== "STOCK_IN") {
    return res.status(400).json({ message: "Only stock-in entries can be edited. Use 'Correct count' for other fixes." });
  }

  const newRiceTypeId = req.body.riceTypeId || String(txn.riceType);
  const newBoriSize = Number(req.body.boriSize || txn.boriSize);
  const newQuantity = req.body.quantity !== undefined ? Number(req.body.quantity) : txn.quantity;
  const newPrice = req.body.pricePerBori !== undefined ? Number(req.body.pricePerBori) : txn.pricePerBori;
  const newNote = req.body.note !== undefined ? req.body.note : txn.note;

  if (![25, 50].includes(newBoriSize)) return res.status(400).json({ message: "Bori size must be 25 or 50 KG" });
  if (!Number.isFinite(newQuantity) || newQuantity < 1) return res.status(400).json({ message: "Number of bori must be at least 1" });
  if (!Number.isFinite(newPrice) || newPrice <= 0) {
    return res.status(400).json({ message: "Purchase price per bori is required - it's used to calculate profit." });
  }
  const newType = await RiceType.findById(newRiceTypeId);
  if (!newType || newType.deleted) return res.status(404).json({ message: "Rice type not found" });

  const oldStock = await findOrCreateStock(txn.riceType, txn.boriSize);
  const sameRow = String(txn.riceType) === String(newRiceTypeId) && txn.boriSize === newBoriSize;
  const oldTypeName = await typeName(txn.riceType);

  if (sameRow) {
    const after = oldStock.quantity - txn.quantity + newQuantity;
    if (after < 0) {
      return res.status(400).json({
        message: `Only ${oldStock.quantity} of these bori are left (the rest were sold or opened), so this entry can't go below ${txn.quantity - oldStock.quantity}.`,
      });
    }
    oldStock.quantity = after;
    await oldStock.save();
  } else {
    if (oldStock.quantity < txn.quantity) {
      return res.status(400).json({
        message: `Only ${oldStock.quantity} ${oldTypeName} ${txn.boriSize}KG bori are left (the rest were sold or opened), so this entry can't be moved.`,
      });
    }
    oldStock.quantity -= txn.quantity;
    await oldStock.save();
    const newStock = await findOrCreateStock(newRiceTypeId, newBoriSize);
    newStock.quantity += newQuantity;
    await newStock.save();
  }

  const before = {
    riceType: txn.riceType,
    riceTypeName: oldTypeName,
    boriSize: txn.boriSize,
    quantity: txn.quantity,
    pricePerBori: txn.pricePerBori,
    note: txn.note,
  };
  txn.history.push({ ...before, reason, changedBy: req.user._id, changedAt: new Date() });
  txn.riceType = newRiceTypeId;
  txn.boriSize = newBoriSize;
  txn.quantity = newQuantity;
  txn.pricePerBori = newPrice;
  txn.note = newNote;
  txn.edited = true;
  await txn.save();

  await refreshLastPrice(before.riceType, before.boriSize);
  if (!sameRow) await refreshLastPrice(newRiceTypeId, newBoriSize);

  const after = { riceTypeName: newType.name, boriSize: newBoriSize, quantity: newQuantity, pricePerBori: newPrice, note: newNote };
  await logChange(req, {
    area: "stock",
    action: "edit",
    summary:
      `Stock entry corrected: ${before.quantity} × ${before.riceTypeName} ${before.boriSize}KG @ ${rs(before.pricePerBori)} ` +
      `→ ${newQuantity} × ${newType.name} ${newBoriSize}KG @ ${rs(newPrice)}`,
    reason,
    before,
    after,
  });

  const populated = await txn.populate([
    { path: "riceType", select: "name" },
    { path: "createdBy", select: "name role" },
  ]);
  res.json(populated);
});

// Admin only: delete a stock-in entry that should never have been added.
export const deleteStockEntry = asyncHandler(async (req, res) => {
  const reason = requireReason(req.body?.reason);
  const txn = await StockTransaction.findById(req.params.id);
  if (!txn || txn.deleted) return res.status(404).json({ message: "Stock entry not found" });
  if (txn.type !== "STOCK_IN") return res.status(400).json({ message: "Only stock-in entries can be deleted" });

  const stock = await findOrCreateStock(txn.riceType, txn.boriSize);
  const name = await typeName(txn.riceType);
  if (stock.quantity < txn.quantity) {
    return res.status(400).json({
      message: `Only ${stock.quantity} ${name} ${txn.boriSize}KG bori are left (the rest were sold or opened), so this entry can't be deleted. Correct the count instead.`,
    });
  }
  stock.quantity -= txn.quantity;
  await stock.save();

  txn.deleted = true;
  txn.deletedBy = req.user._id;
  txn.deletedAt = new Date();
  txn.deleteReason = reason;
  await txn.save();
  await refreshLastPrice(txn.riceType, txn.boriSize);

  await logChange(req, {
    area: "stock",
    action: "delete",
    summary: `Stock entry deleted: ${txn.quantity} × ${name} ${txn.boriSize}KG @ ${rs(txn.pricePerBori)}`,
    reason,
    before: { riceTypeName: name, boriSize: txn.boriSize, quantity: txn.quantity, pricePerBori: txn.pricePerBori, note: txn.note },
  });
  res.json({ message: "Stock entry deleted" });
});

// Admin only: set the real bag count after a physical count, damage, etc.
export const adjustStock = asyncHandler(async (req, res) => {
  const reason = requireReason(req.body.reason);
  const { riceTypeId, boriSize } = req.body;
  const newQuantity = Number(req.body.newQuantity);
  if (!riceTypeId || ![25, 50].includes(Number(boriSize))) {
    return res.status(400).json({ message: "Rice type and bori size are required" });
  }
  if (!Number.isInteger(newQuantity) || newQuantity < 0) {
    return res.status(400).json({ message: "Enter the correct number of bori (0 or more)" });
  }
  // Deleted types are allowed here so bags that came back to one can still be counted.
  const type = await RiceType.findById(riceTypeId);
  if (!type) return res.status(404).json({ message: "Rice type not found" });

  const stock = await findOrCreateStock(riceTypeId, Number(boriSize));
  const before = stock.quantity;
  if (before === newQuantity) return res.status(400).json({ message: "The count is already " + before });
  stock.quantity = newQuantity;
  await stock.save();

  await StockTransaction.create({
    riceType: riceTypeId,
    boriSize: Number(boriSize),
    type: "ADJUSTMENT",
    quantity: Math.abs(newQuantity - before),
    quantityBefore: before,
    quantityAfter: newQuantity,
    note: reason,
    createdBy: req.user._id,
  });

  await logChange(req, {
    area: "stock",
    action: "adjust",
    summary: `${type.name} ${boriSize}KG bori count corrected from ${before} to ${newQuantity}`,
    reason,
    before: { quantity: before },
    after: { quantity: newQuantity },
  });

  const populated = await stock.populate("riceType", "name");
  res.json(populated);
});
