import { buildDateRangeFilter } from "../utils/dateRange.js";
import mongoose from "mongoose";
import KhulaBatch from "../models/KhulaBatch.js";
import Stock from "../models/Stock.js";
import StockTransaction from "../models/StockTransaction.js";
import { asyncHandler } from "../middleware/errorHandler.js";

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

// Open a new bori into Khula (loose) stock - moves 1 bori out of main Stock
export const openKhulaBatch = asyncHandler(async (req, res) => {
  const { riceTypeId, boriSize } = req.body;
  if (!riceTypeId || !boriSize) {
    return res.status(400).json({ message: "Rice type and bori size are required" });
  }
  const stock = await Stock.findOne({ riceType: riceTypeId, boriSize });
  if (!stock || stock.quantity < 1) {
    return res.status(400).json({ message: "No bori of this type/size available in main stock" });
  }

  stock.quantity -= 1;
  await stock.save();

  const totalGrams = Number(boriSize) * 1000;
  const batch = await KhulaBatch.create({
    riceType: riceTypeId,
    boriSize,
    totalGrams,
    remainingGrams: totalGrams,
    openedBy: req.user._id,
  });

  await StockTransaction.create({
    riceType: riceTypeId,
    boriSize,
    type: "OPENED_TO_KHULA",
    quantity: 1,
    note: "Bori opened for loose (Khula) sale",
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

// Full history of closed batches for the shortage/utilization report - both panels can see this.
export const shortageReport = asyncHandler(async (req, res) => {
  const { from, to, riceType, salesman } = req.query;
  const filter = { status: { $in: ["OVER", "FINISHED"] } };
  const range = buildDateRangeFilter(from, to);
  if (range) filter.closedAt = range;
  if (riceType) filter.riceType = riceType;
  if (salesman) filter.closedBy = salesman;

  const batches = await KhulaBatch.find(filter)
    .populate("riceType", "name")
    .populate("openedBy", "name")
    .populate("closedBy", "name")
    .sort({ closedAt: -1 });

  const totalShortfallGrams = batches.reduce((sum, b) => sum + (b.shortfallGrams || 0), 0);
  const overCount = batches.filter((b) => b.status === "OVER").length;
  const finishedCount = batches.filter((b) => b.status === "FINISHED").length;

  res.json({
    batches,
    summary: {
      totalBatches: batches.length,
      overCount,
      finishedCount,
      totalShortfallGrams,
    },
  });
});
