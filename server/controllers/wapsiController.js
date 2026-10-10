import { buildDateRangeFilter } from "../utils/dateRange.js";
import Wapsi from "../models/Wapsi.js";
import Stock from "../models/Stock.js";
import KhulaBatch from "../models/KhulaBatch.js";
import RiceType from "../models/RiceType.js";
import Customer from "../models/Customer.js";
import Sale from "../models/Sale.js";
import StockTransaction from "../models/StockTransaction.js";
import { asyncHandler } from "../middleware/errorHandler.js";

export const createWapsi = asyncHandler(async (req, res) => {
  const {
    originalSaleId,
    itemType,
    riceTypeId,
    boriSize,
    quantityGrams,
    quantityBori,
    cashReturned,
    reason,
    adjustCustomerBalance,
  } = req.body;

  const riceType = await RiceType.findById(riceTypeId);
  if (!riceType) return res.status(404).json({ message: "Rice type not found" });

  if (itemType === "bori") {
    if (!boriSize || !quantityBori) {
      return res.status(400).json({ message: "Bori size and quantity are required" });
    }
    let stock = await Stock.findOne({ riceType: riceTypeId, boriSize });
    if (!stock) stock = await Stock.create({ riceType: riceTypeId, boriSize, quantity: 0 });
    stock.quantity += Number(quantityBori);
    await stock.save();
    await StockTransaction.create({
      riceType: riceTypeId,
      boriSize,
      type: "WAPSI_IN",
      quantity: Number(quantityBori),
      note: reason || "Bori returned by customer",
      createdBy: req.user._id,
    });
  } else if (itemType === "khula") {
    if (!quantityGrams) return res.status(400).json({ message: "Quantity is required" });
    const activeBatch = await KhulaBatch.findOne({ riceType: riceTypeId, status: "ACTIVE" }).sort({ createdAt: -1 });
    if (activeBatch) {
      activeBatch.remainingGrams = Math.min(activeBatch.totalGrams, activeBatch.remainingGrams + Number(quantityGrams));
      await activeBatch.save();
    }
  } else {
    return res.status(400).json({ message: "Invalid item type" });
  }

  if (originalSaleId && adjustCustomerBalance) {
    const sale = await Sale.findById(originalSaleId);
    if (sale && sale.customer) {
      const customer = await Customer.findById(sale.customer);
      if (customer) {
        customer.balance -= Number(cashReturned || 0);
        await customer.save();
      }
    }
  }

  const wapsi = await Wapsi.create({
    originalSale: originalSaleId || undefined,
    itemType,
    riceType: riceTypeId,
    riceTypeName: riceType.name,
    boriSize: boriSize || undefined,
    quantityGrams: quantityGrams || undefined,
    quantityBori: quantityBori || undefined,
    cashReturned: Number(cashReturned || 0),
    reason: reason || "",
    createdBy: req.user._id,
  });

  const populated = await wapsi.populate("createdBy", "name role");
  res.status(201).json(populated);
});

export const listWapsi = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const filter = {};
  const range = buildDateRangeFilter(from, to);
  if (range) filter.createdAt = range;
  const records = await Wapsi.find(filter)
    .populate("createdBy", "name role")
    .populate("originalSale", "invoiceNumber")
    .sort({ createdAt: -1 });
  res.json(records);
});
