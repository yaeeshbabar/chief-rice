import { buildDateRangeFilter } from "../utils/dateRange.js";
import Stock from "../models/Stock.js";
import StockTransaction from "../models/StockTransaction.js";
import RiceType from "../models/RiceType.js";
import { asyncHandler } from "../middleware/errorHandler.js";

export const listStock = asyncHandler(async (req, res) => {
  const stock = await Stock.find().populate("riceType", "name active").sort({ "riceType.name": 1 });
  res.json(stock);
});

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
  if (!type) return res.status(404).json({ message: "Rice type not found" });

  let stock = await Stock.findOne({ riceType: riceTypeId, boriSize });
  if (!stock) stock = await Stock.create({ riceType: riceTypeId, boriSize, quantity: 0 });

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
    .sort({ createdAt: -1 })
    .limit(500);
  res.json(txns);
});
