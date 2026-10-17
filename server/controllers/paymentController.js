import { buildDateRangeFilter, todayRange, yesterdayRange } from "../utils/dateRange.js";
import Payment from "../models/Payment.js";
import Customer from "../models/Customer.js";
import BankAccount from "../models/BankAccount.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { logChange, rs, accountText, requireReason } from "../utils/changeLog.js";
import { accountProblem } from "../utils/accountCheck.js";

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
  if (method === "online") {
    const accountError = await accountProblem(accountId);
    if (accountError) return res.status(400).json({ message: accountError });
  }
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

const paymentText = (p) => {
  const how = p.paymentMethod === "online" ? accountText(p.account) || "Online" : "Cash";
  return `${rs(p.amount)} ${how}`;
};

// Fix a payment that was entered wrong (amount, cash/online, account or note).
// The customer's balance moves by the difference.
export const updatePayment = asyncHandler(async (req, res) => {
  const reason = requireReason(req.body?.reason);
  const payment = await Payment.findById(req.params.id).populate("account", "bankName ownerType ownerName");
  if (!payment) return res.status(404).json({ message: "Payment not found" });
  const customer = await Customer.findById(payment.customer);
  if (!customer) return res.status(404).json({ message: "Customer not found" });

  const amount = req.body.amount !== undefined ? Number(req.body.amount) : payment.amount;
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "Enter a valid payment amount" });
  const owedBefore = customer.balance + payment.amount;
  if (amount > owedBefore) {
    return res.status(400).json({
      message: `Payment (${rs(amount)}) is more than what ${customer.name} owed before it (${rs(owedBefore)})`,
    });
  }

  const method = req.body.paymentMethod ? (req.body.paymentMethod === "online" ? "online" : "cash") : payment.paymentMethod;
  let account = null;
  if (method === "online") {
    const accountId = req.body.accountId !== undefined ? req.body.accountId : payment.account?._id;
    const accountError = await accountProblem(accountId, payment.account?._id);
    if (accountError) return res.status(400).json({ message: accountError });
    if (accountId) {
      account = await BankAccount.findById(accountId);
      if (!account) return res.status(404).json({ message: "Account not found" });
    }
  }

  const beforeText = paymentText(payment);
  const before = { amount: payment.amount, paymentMethod: payment.paymentMethod, account: accountText(payment.account), note: payment.note };

  customer.balance = owedBefore - amount;
  await customer.save();

  payment.amount = amount;
  payment.paymentMethod = method;
  payment.account = account ? account._id : undefined;
  payment.directToAsim = account?.ownerType === "asim";
  if (req.body.note !== undefined) payment.note = req.body.note;
  payment.edited = true;
  await payment.save();
  await payment.populate([
    { path: "createdBy", select: "name role" },
    { path: "account", select: "bankName accountTitle ownerName ownerType" },
  ]);

  await logChange(req, {
    area: "payment",
    action: "edit",
    summary: `Payment from ${customer.name} corrected: ${beforeText} → ${paymentText(payment)}`,
    reason,
    before,
    after: { amount: payment.amount, paymentMethod: payment.paymentMethod, account: accountText(payment.account), note: payment.note },
  });
  res.json({ payment, customer });
});

// Delete a payment entered by mistake: the amount goes back onto the customer's balance.
export const deletePayment = asyncHandler(async (req, res) => {
  const reason = requireReason(req.body?.reason);
  const payment = await Payment.findById(req.params.id).populate("account", "bankName ownerType ownerName");
  if (!payment) return res.status(404).json({ message: "Payment not found" });
  const customer = await Customer.findById(payment.customer);
  if (customer) {
    customer.balance += payment.amount;
    await customer.save();
  }
  await payment.deleteOne();
  await logChange(req, {
    area: "payment",
    action: "delete",
    summary: `Payment of ${paymentText(payment)} from ${customer?.name || "a customer"} deleted`,
    reason,
    before: { ...payment.toObject(), account: accountText(payment.account), customerName: customer?.name || "" },
  });
  res.json({ message: "Payment deleted", customer });
});
