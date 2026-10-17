import { buildDateRangeFilter } from "../utils/dateRange.js";
import Expense from "../models/Expense.js";
import Stock from "../models/Stock.js";
import StockTransaction from "../models/StockTransaction.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { logChange, rs, requireReason } from "../utils/changeLog.js";

const isRiceBags = (category, subCategory) => category === "Asim Kharcha Khata" && subCategory === "Rice Bags";

// Deducts bori from main stock for a "Rice Bags" personal-use expense.
const deductStockForRiceBags = async (riceTypeId, boriSize, quantityBori, userId, note) => {
  const stock = await Stock.findOne({ riceType: riceTypeId, boriSize });
  if (!stock || stock.quantity < quantityBori) {
    throw Object.assign(
      new Error(`Not enough ${boriSize}KG bori in stock to take ${quantityBori} for personal use (only ${stock?.quantity || 0} available)`),
      { statusCode: 400 }
    );
  }
  stock.quantity -= quantityBori;
  await stock.save();
  await StockTransaction.create({
    riceType: riceTypeId,
    boriSize,
    type: "ASIM_PERSONAL_USE",
    quantity: quantityBori,
    note: note || "Taken for Asim's personal use (Rice Bags expense)",
    createdBy: userId,
  });
};

// Reverses a previous Rice Bags stock deduction (used on edit/delete).
const restoreStockForRiceBags = async (riceTypeId, boriSize, quantityBori, userId) => {
  if (!riceTypeId || !boriSize || !quantityBori) return;
  let stock = await Stock.findOne({ riceType: riceTypeId, boriSize });
  if (!stock) stock = await Stock.create({ riceType: riceTypeId, boriSize, quantity: 0 });
  stock.quantity += quantityBori;
  await stock.save();
  await StockTransaction.create({
    riceType: riceTypeId,
    boriSize,
    type: "ADJUSTMENT",
    quantity: quantityBori,
    note: "Reverted Rice Bags personal-use expense (edited or deleted)",
    createdBy: userId,
  });
};

export const createExpense = asyncHandler(async (req, res) => {
  const { category, subCategory, amount, description, riceTypeId, boriSize, quantityBori } = req.body;
  const validCategories = ["Dukan Kharch Khata", "Asim Kharcha Khata", "Salary"];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ message: "Invalid expense category" });
  }
  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ message: "A valid amount is required" });
  }

  const expenseData = {
    category,
    subCategory: subCategory || "",
    amount: Number(amount),
    description: description || "",
    createdBy: req.user._id,
  };

  if (isRiceBags(category, subCategory)) {
    if (!riceTypeId || !boriSize || !quantityBori) {
      return res.status(400).json({ message: "Select rice type, bori size and quantity for Rice Bags" });
    }
    await deductStockForRiceBags(riceTypeId, boriSize, Number(quantityBori), req.user._id);
    expenseData.relatedRiceType = riceTypeId;
    expenseData.relatedBoriSize = Number(boriSize);
    expenseData.relatedQuantityBori = Number(quantityBori);
  }

  const expense = await Expense.create(expenseData);
  const populated = await expense.populate([
    { path: "createdBy", select: "name role" },
    { path: "relatedRiceType", select: "name" },
  ]);
  res.status(201).json(populated);
});

export const listExpenses = asyncHandler(async (req, res) => {
  const { category, createdBy } = req.query;
  const filter = {};
  const range = buildDateRangeFilter(req.query.from, req.query.to);
  if (range) filter.createdAt = range;
  if (category) filter.category = category;
  if (createdBy) filter.createdBy = createdBy;
  const expenses = await Expense.find(filter)
    .populate("createdBy", "name role")
    .populate("relatedRiceType", "name")
    .sort({ createdAt: -1 });
  res.json(expenses);
});

const expenseText = (e) => {
  const what = e.subCategory ? `${e.category} / ${e.subCategory}` : e.category;
  const bags = e.relatedQuantityBori
    ? ` (${e.relatedQuantityBori} × ${e.relatedBoriSize}KG ${e.relatedRiceType?.name || "rice"})`
    : "";
  return `${what} ${rs(e.amount)}${bags}`;
};
const expenseSnapshot = (e) => ({
  category: e.category,
  subCategory: e.subCategory,
  amount: e.amount,
  description: e.description,
  riceTypeName: e.relatedRiceType?.name || "",
  boriSize: e.relatedBoriSize,
  quantityBori: e.relatedQuantityBori,
});
const RIDE_FROM_BILL = "This delivery cost comes from a bill. Change it by editing that bill.";

export const updateExpense = asyncHandler(async (req, res) => {
  const { category, subCategory, amount, description, riceTypeId, boriSize, quantityBori, reason } = req.body;
  const expense = await Expense.findById(req.params.id).populate("relatedRiceType", "name");
  if (!expense) return res.status(404).json({ message: "Expense not found" });
  if (expense.relatedSale) return res.status(400).json({ message: RIDE_FROM_BILL });

  // Check everything first, so a change that can't go through doesn't touch stock.
  const validCategories = ["Dukan Kharch Khata", "Asim Kharcha Khata", "Salary"];
  const newCategory = category || expense.category;
  const newSubCategory = subCategory !== undefined ? subCategory : expense.subCategory;
  if (category && !validCategories.includes(category)) {
    return res.status(400).json({ message: "Invalid expense category" });
  }
  const newAmount = amount !== undefined ? Number(amount) : expense.amount;
  if (!Number.isFinite(newAmount) || newAmount <= 0) return res.status(400).json({ message: "A valid amount is required" });

  const wasRiceBags = isRiceBags(expense.category, expense.subCategory);
  const isNowRiceBags = isRiceBags(newCategory, newSubCategory);
  const oldTypeId = expense.relatedRiceType?._id || expense.relatedRiceType;

  let finalRiceTypeId, finalBoriSize, finalQuantityBori;
  if (isNowRiceBags) {
    finalRiceTypeId = riceTypeId || oldTypeId;
    finalBoriSize = Number(boriSize || expense.relatedBoriSize);
    finalQuantityBori = quantityBori !== undefined ? Number(quantityBori) : expense.relatedQuantityBori;
    if (!finalRiceTypeId || !finalBoriSize || !finalQuantityBori) {
      return res.status(400).json({ message: "Select rice type, bori size and quantity for Rice Bags" });
    }
    const stock = await Stock.findOne({ riceType: finalRiceTypeId, boriSize: finalBoriSize });
    const putBack =
      wasRiceBags && String(oldTypeId) === String(finalRiceTypeId) && expense.relatedBoriSize === finalBoriSize
        ? expense.relatedQuantityBori || 0
        : 0;
    const available = (stock?.quantity || 0) + putBack;
    if (available < finalQuantityBori) {
      return res.status(400).json({
        message: `Not enough ${finalBoriSize}KG bori in stock to take ${finalQuantityBori} for personal use (only ${available} available)`,
      });
    }
  }

  const beforeText = expenseText(expense);
  const before = expenseSnapshot(expense);

  // Put back the bags of the old Rice Bags entry, then take the new amount.
  if (wasRiceBags) {
    await restoreStockForRiceBags(oldTypeId, expense.relatedBoriSize, expense.relatedQuantityBori, req.user._id);
    expense.relatedRiceType = undefined;
    expense.relatedBoriSize = undefined;
    expense.relatedQuantityBori = undefined;
  }
  if (isNowRiceBags) {
    await deductStockForRiceBags(finalRiceTypeId, finalBoriSize, finalQuantityBori, req.user._id, "Rice Bags expense updated");
    expense.relatedRiceType = finalRiceTypeId;
    expense.relatedBoriSize = finalBoriSize;
    expense.relatedQuantityBori = finalQuantityBori;
  }

  expense.category = newCategory;
  expense.subCategory = newSubCategory;
  expense.amount = newAmount;
  if (description !== undefined) expense.description = description;

  await expense.save();
  const populated = await expense.populate([
    { path: "createdBy", select: "name role" },
    { path: "relatedRiceType", select: "name" },
  ]);
  const afterText = expenseText(populated);
  if (afterText !== beforeText || before.description !== populated.description) {
    await logChange(req, {
      area: "expense",
      action: "edit",
      summary: afterText !== beforeText ? `Expense corrected: ${beforeText} → ${afterText}` : `Expense note changed: ${afterText}`,
      reason: reason ? String(reason).trim() : "",
      before,
      after: expenseSnapshot(populated),
    });
  }
  res.json(populated);
});

export const deleteExpense = asyncHandler(async (req, res) => {
  const reason = requireReason(req.body?.reason);
  const expense = await Expense.findById(req.params.id).populate("relatedRiceType", "name");
  if (!expense) return res.status(404).json({ message: "Expense not found" });
  if (expense.relatedSale) return res.status(400).json({ message: RIDE_FROM_BILL });
  if (isRiceBags(expense.category, expense.subCategory)) {
    await restoreStockForRiceBags(
      expense.relatedRiceType?._id || expense.relatedRiceType,
      expense.relatedBoriSize,
      expense.relatedQuantityBori,
      req.user._id
    );
  }
  await expense.deleteOne();
  await logChange(req, {
    area: "expense",
    action: "delete",
    summary: `Expense deleted: ${expenseText(expense)}`,
    reason,
    before: expenseSnapshot(expense),
  });
  res.json({ message: "Expense removed" });
});
