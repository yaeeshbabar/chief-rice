import { buildDateRangeFilter } from "../utils/dateRange.js";
import { computeCashPools } from "../utils/cashPools.js";
import CashHandover from "../models/CashHandover.js";
import { asyncHandler } from "../middleware/errorHandler.js";

export const createHandover = asyncHandler(async (req, res) => {
  const { amount, source, accountId, note } = req.body;
  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ message: "Enter a valid amount" });
  }
  const handoverSource = source === "account" ? "account" : "cash";

  // Never let a handover push a pool below zero - there's no money to hand over if the drawer/account is empty.
  const pools = await computeCashPools();
  const available = handoverSource === "account" ? pools.cashInSalesmanAccount : pools.cashInCounter;
  if (Number(amount) > available) {
    const poolLabel = handoverSource === "account" ? "the salesman account" : "the cash counter";
    return res.status(400).json({
      message: `Cannot hand over Rs ${Number(amount).toLocaleString()} - only Rs ${available.toLocaleString()} is currently available in ${poolLabel}.`,
    });
  }

  const handover = await CashHandover.create({
    amount: Number(amount),
    source: handoverSource,
    account: handoverSource === "account" ? accountId : undefined,
    note: note || "",
    createdBy: req.user._id,
  });
  const populated = await handover.populate("createdBy", "name role");
  const result = populated.toObject ? populated.toObject() : { ...populated };
  // Allowed, but tell them: part of this cash was set aside for salesman commission.
  if (handoverSource === "cash" && Number(amount) > pools.freeCashInCounter) {
    result.warning =
      `Recorded. Note: only Rs ${Math.max(0, Math.round(pools.freeCashInCounter)).toLocaleString()} of the counter cash was free - ` +
      `this handover also used money reserved for salesman commission (Rs ${Math.round(pools.commissionReserved).toLocaleString()} still owed to them).`;
  }
  res.status(201).json(result);
});

export const listHandovers = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const filter = {};
  const range = buildDateRangeFilter(from, to);
  if (range) filter.createdAt = range;
  const handovers = await CashHandover.find(filter)
    .populate("createdBy", "name role")
    .populate("account", "bankName accountTitle")
    .sort({ createdAt: -1 });
  res.json(handovers);
});
