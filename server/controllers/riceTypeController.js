import RiceType from "../models/RiceType.js";
import Stock from "../models/Stock.js";
import Sale from "../models/Sale.js";
import Wapsi from "../models/Wapsi.js";
import Expense from "../models/Expense.js";
import KhulaBatch from "../models/KhulaBatch.js";
import StockTransaction from "../models/StockTransaction.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { logChange, kgText, requireReason } from "../utils/changeLog.js";
import { escapeRegex } from "../utils/escapeRegex.js";

const sameNameFilter = (name) => ({ name: new RegExp(`^${escapeRegex(name.trim())}$`, "i") });

export const listRiceTypes = asyncHandler(async (req, res) => {
  const { includeInactive } = req.query;
  const filter = { deleted: { $ne: true } };
  if (!includeInactive) filter.active = true;
  const types = await RiceType.find(filter).sort({ name: 1 });
  res.json(types);
});

const ensureStockRows = async (riceTypeId) => {
  for (const boriSize of [25, 50]) {
    const exists = await Stock.findOne({ riceType: riceTypeId, boriSize });
    if (!exists) await Stock.create({ riceType: riceTypeId, boriSize, quantity: 0 });
  }
};

export const createRiceType = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: "Rice type name is required" });
  const exists = await RiceType.findOne(sameNameFilter(name));
  if (exists && !exists.deleted) return res.status(400).json({ message: "This rice type already exists" });

  // Adding back a name that was deleted earlier brings the old type (and its history) back.
  if (exists && exists.deleted) {
    exists.deleted = false;
    exists.deletedAt = undefined;
    exists.active = true;
    exists.name = name.trim();
    await exists.save();
    await ensureStockRows(exists._id);
    await logChange(req, { area: "rice-type", action: "restore", summary: `Rice type "${exists.name}" added back`, after: { name: exists.name } });
    return res.status(201).json(exists);
  }

  const type = await RiceType.create({ name: name.trim() });
  // Pre-create stock rows for both bori sizes so admin can stock them immediately
  await ensureStockRows(type._id);
  res.status(201).json(type);
});

export const updateRiceType = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, active, reason } = req.body;
  const type = await RiceType.findById(id);
  if (!type || type.deleted) return res.status(404).json({ message: "Rice type not found" });

  if (name !== undefined && name.trim() !== type.name) {
    if (!name.trim()) return res.status(400).json({ message: "Rice type name is required" });
    const clash = await RiceType.findOne({ ...sameNameFilter(name), _id: { $ne: type._id } });
    if (clash) {
      return res.status(400).json({
        message: clash.deleted
          ? `"${clash.name}" was deleted earlier. Add it again from "Rice type" to bring it back.`
          : "Another rice type already has this name",
      });
    }
    const oldName = type.name;
    type.name = name.trim();
    await type.save();
    await logChange(req, {
      area: "rice-type",
      action: "rename",
      summary: `Rice type renamed from "${oldName}" to "${type.name}"`,
      reason: reason || "",
      before: { name: oldName },
      after: { name: type.name },
    });
  }

  if (typeof active === "boolean" && active !== type.active) {
    type.active = active;
    await type.save();
    await logChange(req, {
      area: "rice-type",
      action: active ? "turn-on" : "turn-off",
      summary: `Rice type "${type.name}" turned ${active ? "on" : "off"}`,
    });
  }

  res.json(type);
});

// Deletes a rice type safely:
//  - blocked while any bori or khula of it is left (sell or correct those first)
//  - if it was ever used (bills, returns, stock history...) it is hidden, not erased
//  - if it was never used, it is removed completely
export const deleteRiceType = asyncHandler(async (req, res) => {
  const reason = requireReason(req.body?.reason);
  const type = await RiceType.findById(req.params.id);
  if (!type || type.deleted) return res.status(404).json({ message: "Rice type not found" });

  const stockRows = await Stock.find({ riceType: type._id });
  const bagsLeft = stockRows.reduce((sum, s) => sum + (s.quantity || 0), 0);
  if (bagsLeft > 0) {
    return res.status(400).json({
      message: `${type.name} still has ${bagsLeft} bori in main stock. Sell them or correct the count to 0 first.`,
    });
  }
  const activeKhula = await KhulaBatch.find({ riceType: type._id, status: "ACTIVE" });
  const gramsLeft = activeKhula.reduce((sum, b) => sum + (b.remainingGrams || 0), 0);
  if (gramsLeft > 0) {
    return res.status(400).json({
      message: `${type.name} still has ${kgText(gramsLeft)} in khula. Sell it or mark the khula empty first.`,
    });
  }

  const [usedInSales, usedInWapsi, usedInExpenses, usedInKhula, usedInStock] = await Promise.all([
    Sale.exists({ "items.riceType": type._id }),
    Wapsi.exists({ $or: [{ riceType: type._id }, { "items.riceType": type._id }] }),
    Expense.exists({ relatedRiceType: type._id }),
    KhulaBatch.exists({ riceType: type._id }),
    StockTransaction.exists({ riceType: type._id }),
  ]);
  const hasHistory = Boolean(usedInSales || usedInWapsi || usedInExpenses || usedInKhula || usedInStock);

  if (hasHistory) {
    type.deleted = true;
    type.deletedAt = new Date();
    type.active = false;
    await type.save();
  } else {
    await Stock.deleteMany({ riceType: type._id });
    await type.deleteOne();
  }

  await logChange(req, {
    area: "rice-type",
    action: "delete",
    summary: hasHistory
      ? `Rice type "${type.name}" deleted (hidden; its old bills and records are kept)`
      : `Rice type "${type.name}" deleted`,
    reason,
    before: { name: type.name },
  });
  res.json({ message: hasHistory ? "Rice type deleted. Its old records are kept." : "Rice type deleted" });
});
