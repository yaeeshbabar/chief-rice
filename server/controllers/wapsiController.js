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
import { computeCashPools } from "../utils/cashPools.js";
import { logChange, rs, requireReason } from "../utils/changeLog.js";
import { wapsiItems, wapsiItemText, wapsiRefund } from "../utils/wapsiItems.js";

const isGiven = (value) => value !== undefined && value !== null && value !== "";
// "Rehman Traders' khata", "Imran's khata"
const whose = (name) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);
const fail = (res, status, message) => res.status(status).json({ message });

// A return: several bori and khula items at once. The money goes back either in cash (out of the
// counter) or off a creditor's khata. Bori go back into main stock, khula into that type's khula.
// Everything is checked first, so a return that can't go through changes nothing.
export const createWapsi = asyncHandler(async (req, res) => {
  const body = req.body || {};
  // Older screens sent one item with "cashReturned"; newer ones send a list of items.
  const listGiven = Array.isArray(body.items) && body.items.length > 0;
  const rawItems = listGiven
    ? body.items
    : body.itemType
      ? [{ itemType: body.itemType, riceTypeId: body.riceTypeId, boriSize: body.boriSize, quantityGrams: body.quantityGrams, quantityBori: body.quantityBori }]
      : [];
  if (!rawItems.length) return fail(res, 400, "Add at least one bori or khula item");
  if (rawItems.length > 30) return fail(res, 400, "Too many items in one return");

  let refundTo = body.refundTo === "khata" ? "khata" : "cash";
  const amount = Number(isGiven(body.amount) ? body.amount : body.cashReturned || 0);
  if (!Number.isFinite(amount) || amount < 0) return fail(res, 400, "Enter a valid amount");
  const reason = String(body.reason || "").trim();

  let originalSale = null;
  if (isGiven(body.originalSaleId)) {
    originalSale = await Sale.findById(body.originalSaleId).catch(() => null);
    if (!originalSale) return fail(res, 404, "Invoice not found");
  }
  let customerId = body.customerId;
  // Older screens: "reduce this customer's khata" on a linked credit bill.
  if (!listGiven && body.adjustCustomerBalance && originalSale?.customer) {
    refundTo = "khata";
    customerId = originalSale.customer;
  }

  // Check every item
  const items = [];
  for (const raw of rawItems) {
    const riceType = await RiceType.findById(raw.riceTypeId).catch(() => null);
    if (!riceType) return fail(res, 404, "Rice type not found");
    if (raw.itemType === "bori") {
      const size = Number(raw.boriSize);
      const qty = Number(raw.quantityBori);
      if (![25, 50].includes(size)) return fail(res, 400, "Pick 25 KG or 50 KG bori");
      if (!Number.isInteger(qty) || qty < 1) return fail(res, 400, `Enter how many ${riceType.name} bori came back`);
      items.push({ itemType: "bori", riceType: riceType._id, riceTypeName: riceType.name, boriSize: size, quantityBori: qty });
    } else if (raw.itemType === "khula") {
      const grams = Math.round(Number(raw.quantityGrams));
      if (!Number.isFinite(grams) || grams <= 0) return fail(res, 400, `Enter the ${riceType.name} khula weight in grams`);
      items.push({ itemType: "khula", riceType: riceType._id, riceTypeName: riceType.name, quantityGrams: grams });
    } else {
      return fail(res, 400, "Each item must be bori or khula");
    }
  }

  // Check the money
  let customer = null;
  if (refundTo === "khata") {
    if (!isGiven(customerId)) return fail(res, 400, "Pick the creditor");
    customer = await Customer.findById(customerId).catch(() => null);
    if (!customer) return fail(res, 404, "Creditor not found");
    if (amount > customer.balance + 0.001) {
      return fail(res, 400, `${customer.name} owes only ${rs(customer.balance)}, so ${rs(amount)} can't be cut from the khata`);
    }
  } else if (amount > 0) {
    const pools = await computeCashPools();
    if (amount > pools.cashInCounter + 0.001) {
      return fail(res, 400, `Only ${rs(Math.max(0, pools.cashInCounter))} is in the cash counter`);
    }
  }

  // Apply
  const wapsi = new Wapsi({
    originalSale: originalSale?._id,
    refundTo,
    amount,
    cashReturned: refundTo === "cash" ? amount : 0,
    customer: customer?._id,
    balanceAdjustment: refundTo === "khata" ? amount : 0,
    reason,
    createdBy: req.user._id,
  });
  for (const item of items) {
    if (item.itemType === "bori") {
      let stock = await Stock.findOne({ riceType: item.riceType, boriSize: item.boriSize });
      if (!stock) stock = await Stock.create({ riceType: item.riceType, boriSize: item.boriSize, quantity: 0 });
      stock.quantity += item.quantityBori;
      await stock.save();
      await StockTransaction.create({
        riceType: item.riceType,
        boriSize: item.boriSize,
        type: "WAPSI_IN",
        quantity: item.quantityBori,
        note: reason || "Bori returned by customer",
        createdBy: req.user._id,
      });
    } else {
      // Returned loose rice is its own lot in that type's khula (75 KG + 4 KG returned = 79 KG).
      const batch = await KhulaBatch.create({
        riceType: item.riceType,
        source: "RETURN",
        totalGrams: item.quantityGrams,
        remainingGrams: item.quantityGrams,
        costPerKg: await currentCostPerKg(item.riceType),
        openedBy: req.user._id,
        note: reason || "Returned by customer",
        wapsi: wapsi._id,
      });
      item.khulaBatch = batch._id;
    }
  }
  wapsi.items = items;
  if (customer && amount > 0) {
    customer.balance -= amount;
    await customer.save();
  }
  await wapsi.save();

  const populated = await Wapsi.findById(wapsi._id)
    .populate("createdBy", "name role")
    .populate("customer", "name")
    .populate("originalSale", "invoiceNumber");
  res.status(201).json(populated);
});

export const listWapsi = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const filter = {};
  const range = buildDateRangeFilter(from, to);
  if (range) filter.createdAt = range;
  const records = await Wapsi.find(filter)
    .populate("createdBy", "name role")
    .populate("customer", "name")
    .populate("originalSale", "invoiceNumber")
    .sort({ createdAt: -1 });
  res.json(records);
});

// Takes returned khula back out: from the return's own lot first, then the oldest lots.
const takeBackKhula = async (item, userId) => {
  const active = await KhulaBatch.find({ riceType: item.riceType, status: "ACTIVE" }).sort({ createdAt: 1 });
  const ordered = [
    ...active.filter((b) => String(b._id) === String(item.khulaBatch)),
    ...active.filter((b) => String(b._id) !== String(item.khulaBatch)),
  ];
  let need = item.quantityGrams || 0;
  for (const b of ordered) {
    if (need <= 0) break;
    const take = Math.min(b.remainingGrams, need);
    if (take <= 0) continue;
    b.remainingGrams -= take;
    need -= take;
    const isOwnUntouchedLot = String(b._id) === String(item.khulaBatch) && b.remainingGrams === 0 && b.totalGrams === take;
    if (isOwnUntouchedLot) {
      await b.deleteOne();
    } else {
      if (b.remainingGrams === 0) {
        b.status = "FINISHED";
        b.closedAt = new Date();
        b.closedBy = userId;
      }
      await b.save();
    }
  }
};

// Undo a return that was recorded by mistake: every item comes back out of stock/khula and the
// khata cut is reversed. Blocked if any of the returned rice has already been sold again.
export const deleteWapsi = asyncHandler(async (req, res) => {
  const reason = requireReason(req.body?.reason);
  const wapsi = await Wapsi.findById(req.params.id).populate("customer", "name");
  if (!wapsi) return fail(res, 404, "Return not found");
  const items = wapsiItems(wapsi);

  // Check first
  const boriNeed = new Map();
  const khulaNeed = new Map();
  for (const i of items) {
    if (i.itemType === "bori") {
      const key = `${i.riceType}|${i.boriSize}`;
      boriNeed.set(key, (boriNeed.get(key) || 0) + (i.quantityBori || 0));
    } else {
      const key = String(i.riceType);
      khulaNeed.set(key, (khulaNeed.get(key) || 0) + (i.quantityGrams || 0));
    }
  }
  for (const [key, qty] of boriNeed) {
    const [riceType, size] = key.split("|");
    const stock = await Stock.findOne({ riceType, boriSize: Number(size) });
    if (!stock || stock.quantity < qty) {
      return fail(res, 400, "These returned bori have already been sold or opened, so the return can't be undone");
    }
  }
  for (const [riceType, grams] of khulaNeed) {
    const active = await KhulaBatch.find({ riceType, status: "ACTIVE" });
    if (active.reduce((sum, b) => sum + b.remainingGrams, 0) < grams) {
      return fail(res, 400, "This returned rice has already been sold again, so the return can't be undone");
    }
  }

  // Undo
  for (const i of items) {
    if (i.itemType === "bori") {
      const stock = await Stock.findOne({ riceType: i.riceType, boriSize: i.boriSize });
      stock.quantity -= i.quantityBori;
      await stock.save();
      await StockTransaction.create({
        riceType: i.riceType,
        boriSize: i.boriSize,
        type: "ADJUSTMENT",
        quantity: i.quantityBori,
        note: `Return undone: ${reason}`,
        createdBy: req.user._id,
      });
    } else {
      await takeBackKhula(i, req.user._id);
    }
  }
  if (wapsi.balanceAdjustment > 0 && wapsi.customer) {
    const customer = await Customer.findById(wapsi.customer._id || wapsi.customer);
    if (customer) {
      customer.balance += wapsi.balanceAdjustment;
      await customer.save();
    }
  }

  await wapsi.deleteOne();
  const money =
    wapsi.refundTo === "khata" || wapsi.balanceAdjustment > 0
      ? `${rs(wapsi.balanceAdjustment || 0)} back on ${whose(wapsi.customer?.name || "the customer")} khata`
      : `${rs(wapsiRefund(wapsi))} cash refund`;
  await logChange(req, {
    area: "wapsi",
    action: "undo",
    summary: `Return undone: ${items.map(wapsiItemText).join(", ")}; ${money}`,
    reason,
    before: wapsi.toObject(),
  });
  res.json({ message: "Return undone" });
});
