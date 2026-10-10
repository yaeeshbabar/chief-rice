import { buildDateRangeFilter, todayRange, yesterdayRange } from "../utils/dateRange.js";
import Payment from "../models/Payment.js";
import Customer from "../models/Customer.js";
import BankAccount from "../models/BankAccount.js";
import { asyncHandler } from "../middleware/errorHandler.js";

export const listPaymentsForCustomer = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ customer: req.params.id })
    .populate("createdBy", "name role")
    .populate("account", "bankName accountTitle ownerName ownerType")
    .sort({ createdAt: -1 });
  res.json(payments);
});

export const createPayment = asyncHandler(async (req, res) => {
  const { amount, note, paymentMethod, accountId } = req.body;
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.status(404).json({ message: "Customer not found" });
  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ message: "Enter a valid payment amount" });
  }
  if (Number(amount) > customer.balance) {
    return res.status(400).json({
      message: `Payment (Rs ${amount}) is more than the outstanding balance (Rs ${customer.balance})`,
    });
  }

  let directToAsim = false;
  const method = paymentMethod === "online" ? "online" : "cash";
  if (method === "online" && accountId) {
    const account = await BankAccount.findById(accountId);
    directToAsim = account?.ownerType === "asim";
  }

  customer.balance -= Number(amount);
  await customer.save();

  const payment = await Payment.create({
    customer: customer._id,
    amount: Number(amount),
    paymentMethod: method,
    account: method === "online" ? accountId : undefined,
    directToAsim,
    note: note || "",
    createdBy: req.user._id,
  });

  const populated = await payment.populate([
    { path: "createdBy", select: "name role" },
    { path: "account", select: "bankName accountTitle ownerName ownerType" },
  ]);
  res.status(201).json({ payment: populated, customer });
});

export const listAllPayments = asyncHandler(async (req, res) => {
  const { from, to, quick } = req.query;
  const filter = {};
  let range = buildDateRangeFilter(from, to);
  if (!range && quick === "today") range = todayRange();
  if (!range && quick === "yesterday") range = yesterdayRange();
  if (range) filter.createdAt = range;
  const payments = await Payment.find(filter)
    .populate("customer", "name shopName")
    .populate("createdBy", "name role")
    .populate("account", "bankName accountTitle ownerName ownerType")
    .sort({ createdAt: -1 });
  const total = payments.reduce((sum, p) => sum + p.amount, 0);
  res.json({ payments, total, count: payments.length });
});
