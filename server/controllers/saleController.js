import { buildDateRangeFilter, dateKey } from "../utils/dateRange.js";
import Sale from "../models/Sale.js";
import Customer from "../models/Customer.js";
import KhulaBatch from "../models/KhulaBatch.js";
import Stock from "../models/Stock.js";
import RiceType from "../models/RiceType.js";
import StockTransaction from "../models/StockTransaction.js";
import Expense from "../models/Expense.js";
import CommissionAgent from "../models/CommissionAgent.js";
import { nextSequence } from "../models/Counter.js";
import { asyncHandler } from "../middleware/errorHandler.js";

// Applies the stock/khula-effects of a set of sale items (used on create and on revert).
// direction: 1 to deduct stock (a sale happening), -1 to restore stock (reverting an edit/cancel)
const applyItemEffects = async (items, userId, direction = 1) => {
  const preparedItems = [];
  for (const raw of items) {
    const { itemType, riceTypeId, boriSize, khulaBatchId, quantityGrams, quantityBori, pricePerUnit } = raw;
    const riceType = await RiceType.findById(riceTypeId);
    if (!riceType) throw Object.assign(new Error("Rice type not found"), { statusCode: 404 });

    if (itemType === "khula") {
      if (!khulaBatchId || !quantityGrams || quantityGrams <= 0) {
        throw Object.assign(new Error("Khula batch and quantity are required"), { statusCode: 400 });
      }
      const batch = await KhulaBatch.findById(khulaBatchId);
      if (!batch) throw Object.assign(new Error("Khula batch not found"), { statusCode: 404 });

      if (direction === 1) {
        if (batch.status !== "ACTIVE") {
          throw Object.assign(new Error(`This Khula batch is ${batch.status.toLowerCase()}, cannot sell from it`), {
            statusCode: 400,
          });
        }
        if (batch.remainingGrams < quantityGrams) {
          throw Object.assign(
            new Error(`Not enough loose rice remaining in this Khula batch (only ${batch.remainingGrams}g left)`),
            { statusCode: 400 }
          );
        }
        batch.remainingGrams -= quantityGrams;
      } else {
        batch.remainingGrams = Math.min(batch.totalGrams, batch.remainingGrams + quantityGrams);
        if (batch.status !== "ACTIVE") batch.status = "ACTIVE";
      }
      await batch.save();

      const total = (quantityGrams / 1000) * Number(pricePerUnit);

      // Cost snapshot for profit reporting - from that rice/size's last purchase price.
      const stockForCost = await Stock.findOne({ riceType: riceType._id, boriSize: batch.boriSize });
      const costPerKg = stockForCost && batch.boriSize ? (stockForCost.lastPricePerBori || 0) / batch.boriSize : 0;
      const itemCost = (quantityGrams / 1000) * costPerKg;

      preparedItems.push({
        itemType: "khula",
        riceType: riceType._id,
        riceTypeName: riceType.name,
        boriSize: batch.boriSize,
        khulaBatch: batch._id,
        quantityGrams,
        pricePerUnit: Number(pricePerUnit),
        total,
        purchaseCostPerUnit: costPerKg,
        itemCost,
      });
    } else if (itemType === "bori") {
      if (!boriSize || !quantityBori || quantityBori <= 0) {
        throw Object.assign(new Error("Bori size and quantity are required"), { statusCode: 400 });
      }
      const stock = await Stock.findOne({ riceType: riceTypeId, boriSize });
      if (!stock) throw Object.assign(new Error("Stock record not found for this rice/size"), { statusCode: 404 });

      if (direction === 1) {
        if (stock.quantity < quantityBori) {
          throw Object.assign(new Error(`Not enough ${boriSize}KG bori in stock (only ${stock.quantity} left)`), {
            statusCode: 400,
          });
        }
        stock.quantity -= quantityBori;
      } else {
        stock.quantity += quantityBori;
      }
      await stock.save();

      await StockTransaction.create({
        riceType: riceType._id,
        boriSize,
        type: direction === 1 ? "SOLD_BORI" : "ADJUSTMENT",
        quantity: quantityBori,
        pricePerBori: pricePerUnit,
        note: direction === 1 ? "Sold in Bori" : "Reverted due to invoice edit/cancel",
        createdBy: userId,
      });

      const total = quantityBori * Number(pricePerUnit);
      const itemCost = quantityBori * (stock.lastPricePerBori || 0);

      preparedItems.push({
        itemType: "bori",
        riceType: riceType._id,
        riceTypeName: riceType.name,
        boriSize: Number(boriSize),
        quantityBori,
        pricePerUnit: Number(pricePerUnit),
        total,
        purchaseCostPerUnit: stock.lastPricePerBori || 0,
        itemCost,
      });
    } else {
      throw Object.assign(new Error("Invalid item type"), { statusCode: 400 });
    }
  }
  return preparedItems;
};

// Deletes any previous ride-cost Expense for this sale and creates a fresh one if needed.
// Recreating rather than patching avoids drift across repeated edits.
const syncRideExpense = async (sale, rideCost, userId) => {
  if (sale.relatedRideExpense) {
    await Expense.findByIdAndDelete(sale.relatedRideExpense);
    sale.relatedRideExpense = undefined;
  }
  if (rideCost > 0) {
    const expense = await Expense.create({
      category: "Dukan Kharch Khata",
      subCategory: "Ride",
      amount: rideCost,
      description: `Delivery for Invoice #${sale.invoiceNumber} (store expense, not charged to customer)`,
      relatedSale: sale._id,
      createdBy: userId,
    });
    sale.relatedRideExpense = expense._id;
  }
};

const computeCommission = async (commissionAgentId, profitBeforeCommission) => {
  if (!commissionAgentId || profitBeforeCommission <= 0) {
    return { commissionAgent: undefined, commissionPercent: 0, commissionAmount: 0 };
  }
  const agent = await CommissionAgent.findById(commissionAgentId);
  if (!agent) return { commissionAgent: undefined, commissionPercent: 0, commissionAmount: 0 };
  const commissionAmount = (profitBeforeCommission * agent.percentage) / 100;
  return { commissionAgent: agent._id, commissionPercent: agent.percentage, commissionAmount };
};

const snapshotOf = (sale, action, changedBy, note) => ({
  items: sale.items,
  paymentType: sale.paymentType,
  customer: sale.customer,
  customerName: sale._customerName || "",
  rideCost: sale.rideCost,
  commissionAgentName: sale._commissionAgentName || "",
  commissionAmount: sale.commissionAmount,
  subtotal: sale.subtotal,
  total: sale.total,
  profit: sale.profit,
  changedBy,
  action,
  note: note || "",
});

export const createSale = asyncHandler(async (req, res) => {
  const { items, paymentType, customerId, newCustomer, rideCost, commissionAgentId, paymentMethod, accountId } =
    req.body;
  if (!items || !items.length) return res.status(400).json({ message: "At least one item is required" });
  if (!["cash", "credit"].includes(paymentType)) {
    return res.status(400).json({ message: "Payment type must be cash or credit" });
  }

  let customer = null;
  if (paymentType === "credit") {
    if (customerId) {
      customer = await Customer.findById(customerId);
      if (!customer) return res.status(404).json({ message: "Customer not found" });
    } else if (newCustomer && newCustomer.name) {
      customer = await Customer.create({
        name: newCustomer.name.trim(),
        shopName: newCustomer.shopName || "",
        phone: newCustomer.phone || "",
        address: newCustomer.address || "",
        createdBy: req.user._id,
      });
    } else {
      return res.status(400).json({ message: "Select an existing customer or add a new one for credit sale" });
    }
  }

  const preparedItems = await applyItemEffects(items, req.user._id, 1);
  const subtotal = preparedItems.reduce((sum, i) => sum + i.total, 0);
  const costOfGoods = preparedItems.reduce((sum, i) => sum + i.itemCost, 0);
  const total = subtotal; // Ride is never charged to the customer.
  const rideCostValue = Number(rideCost || 0);

  const profitBeforeCommission = subtotal - costOfGoods - rideCostValue;
  const { commissionAgent, commissionPercent, commissionAmount } = await computeCommission(
    commissionAgentId,
    profitBeforeCommission
  );
  const profit = profitBeforeCommission - commissionAmount;

  if (customer) {
    customer.balance += total;
    await customer.save();
  }

  const invoiceNumber = await nextSequence("invoice");
  const billDateKey = dateKey();
  const dailyBillNumber = await nextSequence(`daily-bill-${billDateKey}`);

  const sale = await Sale.create({
    invoiceNumber,
    dailyBillNumber,
    billDateKey,
    items: preparedItems,
    paymentType,
    paymentMethod: paymentType === "cash" ? paymentMethod || "cash" : undefined,
    account: paymentType === "cash" && paymentMethod === "online" ? accountId : undefined,
    customer: customer ? customer._id : undefined,
    rideCost: rideCostValue,
    commissionAgent,
    commissionPercent,
    commissionAmount,
    costOfGoods,
    profit,
    subtotal,
    total,
    createdBy: req.user._id,
  });

  await syncRideExpense(sale, rideCostValue, req.user._id);
  await sale.save();

  const populated = await Sale.findById(sale._id)
    .populate("customer")
    .populate("createdBy", "name role")
    .populate("commissionAgent", "name percentage")
    .populate("account", "bankName accountTitle accountNumber ownerName ownerType")
    .populate("items.riceType", "name");

  res.status(201).json(populated);
});

export const listSales = asyncHandler(async (req, res) => {
  const { from, to, paymentType, customer, createdBy, itemType, invoiceNumber } = req.query;
  const filter = { cancelled: false };
  const range = buildDateRangeFilter(from, to);
  if (range) filter.createdAt = range;
  if (paymentType) filter.paymentType = paymentType;
  if (customer) filter.customer = customer;
  if (createdBy) filter.createdBy = createdBy;
  if (itemType) filter["items.itemType"] = itemType;
  if (invoiceNumber) filter.invoiceNumber = Number(invoiceNumber);

  const sales = await Sale.find(filter)
    .populate("customer", "name shopName phone")
    .populate("createdBy", "name role")
    .populate("commissionAgent", "name percentage")
    .populate("account", "bankName ownerType ownerName")
    .sort({ createdAt: -1 });
  res.json(sales);
});

export const getSale = asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id)
    .populate("customer")
    .populate("createdBy", "name role")
    .populate("commissionAgent", "name percentage")
    .populate("account", "bankName accountTitle accountNumber ownerName ownerType")
    .populate("items.riceType", "name")
    .populate("cancelledBy", "name")
    .populate("previousVersions.changedBy", "name")
    .populate("previousVersions.customer", "name");
  if (!sale) return res.status(404).json({ message: "Invoice not found" });
  res.json(sale);
});

// Salesman/admin can fix mistakes: rice type, quantity, price, customer, ride cost, commission.
// Reverts old stock/khula/balance effects, snapshots the pre-edit state, then reapplies fresh.
export const updateSale = asyncHandler(async (req, res) => {
  const { items, paymentType, customerId, newCustomer, rideCost, commissionAgentId, paymentMethod, accountId, editNote } =
    req.body;
  const sale = await Sale.findById(req.params.id).populate("customer", "name");
  if (!sale) return res.status(404).json({ message: "Invoice not found" });
  if (sale.cancelled) return res.status(400).json({ message: "This invoice was cancelled" });

  // Snapshot BEFORE any change is applied.
  sale._customerName = sale.customer?.name || "";
  const agentBefore = sale.commissionAgent ? await CommissionAgent.findById(sale.commissionAgent) : null;
  sale._commissionAgentName = agentBefore?.name || "";
  sale.previousVersions.push(snapshotOf(sale, "edit", req.user._id, editNote));

  // Revert old customer balance effect
  if (sale.customer) {
    const oldCustomer = await Customer.findById(sale.customer._id || sale.customer);
    if (oldCustomer) {
      oldCustomer.balance -= sale.total;
      await oldCustomer.save();
    }
  }
  // Revert old stock/khula effects
  const revertItems = sale.items.map((i) => ({
    itemType: i.itemType,
    riceTypeId: i.riceType,
    boriSize: i.boriSize,
    khulaBatchId: i.khulaBatch,
    quantityGrams: i.quantityGrams,
    quantityBori: i.quantityBori,
    pricePerUnit: i.pricePerUnit,
  }));
  await applyItemEffects(revertItems, req.user._id, -1);

  // Apply new items/effects
  let customer = null;
  const newPaymentType = paymentType || sale.paymentType;
  if (newPaymentType === "credit") {
    if (customerId) {
      customer = await Customer.findById(customerId);
      if (!customer) return res.status(404).json({ message: "Customer not found" });
    } else if (newCustomer && newCustomer.name) {
      customer = await Customer.create({
        name: newCustomer.name.trim(),
        shopName: newCustomer.shopName || "",
        phone: newCustomer.phone || "",
        address: newCustomer.address || "",
        createdBy: req.user._id,
      });
    } else if (sale.customer) {
      customer = await Customer.findById(sale.customer._id || sale.customer);
    } else {
      return res.status(400).json({ message: "Select a customer for credit sale" });
    }
  }

  const newItems = items && items.length ? items : revertItems;
  const preparedItems = await applyItemEffects(newItems, req.user._id, 1);
  const subtotal = preparedItems.reduce((sum, i) => sum + i.total, 0);
  const costOfGoods = preparedItems.reduce((sum, i) => sum + i.itemCost, 0);
  const total = subtotal;
  const rideCostValue = Number(rideCost ?? sale.rideCost ?? 0);

  const profitBeforeCommission = subtotal - costOfGoods - rideCostValue;
  const newCommissionAgentId = commissionAgentId !== undefined ? commissionAgentId : sale.commissionAgent;
  const { commissionAgent, commissionPercent, commissionAmount } = await computeCommission(
    newCommissionAgentId,
    profitBeforeCommission
  );
  const profit = profitBeforeCommission - commissionAmount;

  if (customer) {
    customer.balance += total;
    await customer.save();
  }

  sale.items = preparedItems;
  sale.paymentType = newPaymentType;
  sale.paymentMethod = newPaymentType === "cash" ? paymentMethod || sale.paymentMethod || "cash" : undefined;
  sale.account = newPaymentType === "cash" && (paymentMethod || sale.paymentMethod) === "online" ? accountId || sale.account : undefined;
  sale.customer = customer ? customer._id : undefined;
  sale.rideCost = rideCostValue;
  sale.commissionAgent = commissionAgent;
  sale.commissionPercent = commissionPercent;
  sale.commissionAmount = commissionAmount;
  sale.costOfGoods = costOfGoods;
  sale.profit = profit;
  sale.subtotal = subtotal;
  sale.total = total;
  sale.edited = true;

  await syncRideExpense(sale, rideCostValue, req.user._id);
  await sale.save();

  const populated = await Sale.findById(sale._id)
    .populate("customer")
    .populate("createdBy", "name role")
    .populate("commissionAgent", "name percentage")
    .populate("account", "bankName accountTitle accountNumber ownerName ownerType")
    .populate("items.riceType", "name");
  res.json(populated);
});

// Cancel/delete a bill - reverts every effect but keeps a full audit trail (soft delete).
export const cancelSale = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const sale = await Sale.findById(req.params.id).populate("customer", "name");
  if (!sale) return res.status(404).json({ message: "Invoice not found" });
  if (sale.cancelled) return res.status(400).json({ message: "This invoice was already cancelled" });
  if (!reason || !reason.trim()) {
    return res.status(400).json({ message: "A reason is required to cancel/delete a bill" });
  }

  sale._customerName = sale.customer?.name || "";
  const agent = sale.commissionAgent ? await CommissionAgent.findById(sale.commissionAgent) : null;
  sale._commissionAgentName = agent?.name || "";
  sale.previousVersions.push(snapshotOf(sale, "cancel", req.user._id, reason));

  if (sale.customer) {
    const customer = await Customer.findById(sale.customer._id || sale.customer);
    if (customer) {
      customer.balance -= sale.total;
      await customer.save();
    }
  }

  const revertItems = sale.items.map((i) => ({
    itemType: i.itemType,
    riceTypeId: i.riceType,
    boriSize: i.boriSize,
    khulaBatchId: i.khulaBatch,
    quantityGrams: i.quantityGrams,
    quantityBori: i.quantityBori,
    pricePerUnit: i.pricePerUnit,
  }));
  await applyItemEffects(revertItems, req.user._id, -1);

  if (sale.relatedRideExpense) {
    await Expense.findByIdAndDelete(sale.relatedRideExpense);
    sale.relatedRideExpense = undefined;
  }

  sale.cancelled = true;
  sale.cancelReason = reason;
  sale.cancelledBy = req.user._id;
  sale.cancelledAt = new Date();
  await sale.save();

  res.json({ message: "Invoice cancelled and all effects reverted", sale });
});

// All edited or cancelled bills, with their full version history - for the Changes Report.
export const listChanges = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const filter = { $or: [{ edited: true }, { cancelled: true }] };
  const range = buildDateRangeFilter(from, to);
  if (range) filter.updatedAt = range;

  const sales = await Sale.find(filter)
    .populate("customer", "name")
    .populate("createdBy", "name role")
    .populate("cancelledBy", "name")
    .populate("previousVersions.changedBy", "name")
    .sort({ updatedAt: -1 });
  res.json(sales);
});
