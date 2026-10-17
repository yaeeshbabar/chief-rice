import { buildDateRangeFilter } from "../utils/dateRange.js";
import { computeCashPools } from "../utils/cashPools.js";
import CashHandover from "../models/CashHandover.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { logChange, rs, accountText, requireReason } from "../utils/changeLog.js";
import { accountProblem } from "../utils/accountCheck.js";

export const createHandover = asyncHandler(async (req, res) => {
  const { amount, source, accountId, note } = req.body;
  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ message: "Enter a valid amount" });
  }
  const handoverSource = source === "account" ? "account" : "cash";
  if (handoverSource === "account") {
    const accountError = await accountProblem(accountId);
    if (accountError) return res.status(400).json({ message: accountError });
  }

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

// Undo a handover entered by mistake. The money counts as back in the counter / salesman
// account; enter the right handover again if needed.
export const deleteHandover = asyncHandler(async (req, res) => {
  const reason = requireReason(req.body?.reason);
  const handover = await CashHandover.findById(req.params.id).populate("account", "bankName ownerType ownerName");
  if (!handover) return res.status(404).json({ message: "Handover not found" });
  await handover.deleteOne();
  const from = handover.source === "account" ? accountText(handover.account) || "salesman account" : "cash counter";
  await logChange(req, {
    area: "handover",
    action: "undo",
    summary: `Handover of ${rs(handover.amount)} to Asim (from ${from}) undone`,
    reason,
    before: { ...handover.toObject(), account: accountText(handover.account) },
  });
  res.json({ message: "Handover undone" });
});
