import { buildDateRangeFilter } from "../utils/dateRange.js";
import Wapsi from "../models/Wapsi.js";
import Stock from "../models/Stock.js";
import KhulaBatch from "../models/KhulaBatch.js";
import RiceType from "../models/RiceType.js";
import Customer from "../models/Customer.js";
import Sale from "../models/Sale.js";
import StockTransaction from "../models/StockTransaction.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { currentCostPerKg } from "../utils/khulaPools.js";
import { logChange, kgText, rs, requireReason } from "../utils/changeLog.js";

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

  let khulaBatch = null;
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
    if (!quantityGrams || Number(quantityGrams) <= 0) return res.status(400).json({ message: "Quantity is required" });
    // Returned loose rice is added to this type's khula as its own lot, so it always counts
    // (e.g. 75 KG in khula + 4 KG returned = 79 KG).
    khulaBatch = await KhulaBatch.create({
      riceType: riceTypeId,
      source: "RETURN",
      totalGrams: Number(quantityGrams),
      remainingGrams: Number(quantityGrams),
      costPerKg: await currentCostPerKg(riceTypeId),
      openedBy: req.user._id,
      note: reason || "Returned by customer",
    });
  } else {
    return res.status(400).json({ message: "Invalid item type" });
  }

  let customerId;
  let balanceAdjustment = 0;
  if (originalSaleId && adjustCustomerBalance) {
    const sale = await Sale.findById(originalSaleId);
    if (sale && sale.customer) {
      const customer = await Customer.findById(sale.customer);
      if (customer) {
        balanceAdjustment = Number(cashReturned || 0);
        customer.balance -= balanceAdjustment;
        await customer.save();
        customerId = customer._id;
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
    khulaBatch: khulaBatch?._id,
    customer: customerId,
    balanceAdjustment,
    createdBy: req.user._id,
  });
  if (khulaBatch) {
    khulaBatch.wapsi = wapsi._id;
    await khulaBatch.save();
  }

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

// Undo a return that was recorded by mistake: the rice comes back out of stock/khula and
// any khata change is reversed. Blocked if the returned rice has already been sold again.
export const deleteWapsi = asyncHandler(async (req, res) => {
  const reason = requireReason(req.body?.reason);
  const wapsi = await Wapsi.findById(req.params.id);
  if (!wapsi) return res.status(404).json({ message: "Return not found" });

  if (wapsi.itemType === "bori") {
    const stock = await Stock.findOne({ riceType: wapsi.riceType, boriSize: wapsi.boriSize });
    if (!stock || stock.quantity < wapsi.quantityBori) {
      return res.status(400).json({ message: "These returned bori have already been sold or opened, so the return can't be undone" });
    }
    stock.quantity -= wapsi.quantityBori;
    await stock.save();
    await StockTransaction.create({
      riceType: wapsi.riceType,
      boriSize: wapsi.boriSize,
      type: "ADJUSTMENT",
      quantity: wapsi.quantityBori,
      note: `Return undone: ${reason}`,
      createdBy: req.user._id,
    });
  } else {
    const grams = wapsi.quantityGrams || 0;
    const active = await KhulaBatch.find({ riceType: wapsi.riceType, status: "ACTIVE" }).sort({ createdAt: 1 });
    const available = active.reduce((sum, b) => sum + b.remainingGrams, 0);
    if (available < grams) {
      return res.status(400).json({ message: "This returned rice has already been sold again, so the return can't be undone" });
    }
    // Take it back from the return's own lot first, then from the oldest lots.
    const ordered = [
      ...active.filter((b) => String(b._id) === String(wapsi.khulaBatch)),
      ...active.filter((b) => String(b._id) !== String(wapsi.khulaBatch)),
    ];
    let need = grams;
    for (const b of ordered) {
      if (need <= 0) break;
      const take = Math.min(b.remainingGrams, need);
      if (take <= 0) continue;
      b.remainingGrams -= take;
      need -= take;
      const isOwnUntouchedLot = String(b._id) === String(wapsi.khulaBatch) && b.remainingGrams === 0 && b.totalGrams === take;
      if (isOwnUntouchedLot) {
        await b.deleteOne();
      } else {
        if (b.remainingGrams === 0) {
          b.status = "FINISHED";
          b.closedAt = new Date();
          b.closedBy = req.user._id;
        }
        await b.save();
      }
    }
  }

  if (wapsi.balanceAdjustment > 0 && wapsi.customer) {
    const customer = await Customer.findById(wapsi.customer);
    if (customer) {
      customer.balance += wapsi.balanceAdjustment;
      await customer.save();
    }
  }

  await wapsi.deleteOne();
  const qty = wapsi.itemType === "bori" ? `${wapsi.quantityBori} × ${wapsi.boriSize}KG bori` : kgText(wapsi.quantityGrams);
  await logChange(req, {
    area: "wapsi",
    action: "undo",
    summary: `Return undone: ${qty} ${wapsi.riceTypeName}, ${rs(wapsi.cashReturned)} refund${wapsi.balanceAdjustment > 0 ? " (khata put back)" : ""}`,
    reason,
    before: wapsi.toObject(),
  });
  res.json({ message: "Return undone" });
});
