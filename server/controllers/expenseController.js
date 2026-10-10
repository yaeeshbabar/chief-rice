import { buildDateRangeFilter } from "../utils/dateRange.js";
import Expense from "../models/Expense.js";
import Stock from "../models/Stock.js";
import StockTransaction from "../models/StockTransaction.js";
import { asyncHandler } from "../middleware/errorHandler.js";

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

export const updateExpense = asyncHandler(async (req, res) => {
  const { category, subCategory, amount, description, riceTypeId, boriSize, quantityBori } = req.body;
  const expense = await Expense.findById(req.params.id);
  if (!expense) return res.status(404).json({ message: "Expense not found" });

  const validCategories = ["Dukan Kharch Khata", "Asim Kharcha Khata", "Salary"];
  const newCategory = category || expense.category;
  const newSubCategory = subCategory !== undefined ? subCategory : expense.subCategory;
  if (category && !validCategories.includes(category)) {
    return res.status(400).json({ message: "Invalid expense category" });
  }

  const wasRiceBags = isRiceBags(expense.category, expense.subCategory);
  const isNowRiceBags = isRiceBags(newCategory, newSubCategory);

  // Revert the old stock effect if it was (or is changing away from / changing quantity of) Rice Bags.
  if (wasRiceBags) {
    await restoreStockForRiceBags(
      expense.relatedRiceType,
      expense.relatedBoriSize,
      expense.relatedQuantityBori,
      req.user._id
    );
    expense.relatedRiceType = undefined;
    expense.relatedBoriSize = undefined;
    expense.relatedQuantityBori = undefined;
  }

  if (isNowRiceBags) {
    const finalRiceTypeId = riceTypeId || expense.relatedRiceType;
    const finalBoriSize = boriSize || expense.relatedBoriSize;
    const finalQuantityBori = quantityBori !== undefined ? Number(quantityBori) : expense.relatedQuantityBori;
    if (!finalRiceTypeId || !finalBoriSize || !finalQuantityBori) {
      return res.status(400).json({ message: "Select rice type, bori size and quantity for Rice Bags" });
    }
    await deductStockForRiceBags(finalRiceTypeId, finalBoriSize, finalQuantityBori, req.user._id, "Rice Bags expense updated");
    expense.relatedRiceType = finalRiceTypeId;
    expense.relatedBoriSize = finalBoriSize;
    expense.relatedQuantityBori = finalQuantityBori;
  }

  if (category) expense.category = category;
  if (subCategory !== undefined) expense.subCategory = subCategory;
  if (amount !== undefined) {
    if (Number(amount) <= 0) return res.status(400).json({ message: "A valid amount is required" });
    expense.amount = Number(amount);
  }
  if (description !== undefined) expense.description = description;

  await expense.save();
  const populated = await expense.populate([
    { path: "createdBy", select: "name role" },
    { path: "relatedRiceType", select: "name" },
  ]);
  res.json(populated);
});

export const deleteExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) return res.status(404).json({ message: "Expense not found" });
  if (isRiceBags(expense.category, expense.subCategory)) {
    await restoreStockForRiceBags(expense.relatedRiceType, expense.relatedBoriSize, expense.relatedQuantityBori, req.user._id);
  }
  await expense.deleteOne();
  res.json({ message: "Expense removed" });
});
