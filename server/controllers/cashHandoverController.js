import { buildDateRangeFilter } from "../utils/dateRange.js";
import { computeCashPools } from "../utils/cashPools.js";
import CashHandover from "../models/CashHandover.js";
import BankAccount from "../models/BankAccount.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { logChange, rs, accountText, requireReason } from "../utils/changeLog.js";
import { accountProblem } from "../utils/accountCheck.js";

// "Cash counter → in hand", "Cash counter → Asim Account (UBL)", "Salesman Account (Meezan) → Asim Account (MCB)"
const handoverText = (h) => {
  const from = h.source === "account" ? accountText(h.account) || "salesman account" : "cash counter";
  const to = h.toAccount ? accountText(h.toAccount) || "Asim's bank" : h.source === "account" ? "Asim's bank" : "in hand";
  return `from ${from}, ${h.toAccount || h.source === "account" ? "into" : "given"} ${to}`;
};

export const createHandover = asyncHandler(async (req, res) => {
  const { amount, source, accountId, toAccountId, note } = req.body;
  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ message: "Enter a valid amount" });
  }
  const handoverSource = source === "account" ? "account" : "cash";
  if (handoverSource === "account") {
    const accountError = await accountProblem(accountId);
    if (accountError) return res.status(400).json({ message: accountError });
  }
  // Where the money went: Asim's hand, or one of Asim's bank accounts. Money from the salesman's
  // account always goes into a bank account.
  let toAccount;
  if (handoverSource === "account" || toAccountId) {
    if (!toAccountId) return res.status(400).json({ message: "Pick which of Asim's accounts the money went into" });
    const target = await BankAccount.findById(toAccountId).catch(() => null);
    if (!target || target.ownerType !== "asim" || target.deleted || !target.active) {
      return res.status(400).json({ message: "Pick one of Asim's bank accounts that is switched on" });
    }
    toAccount = target._id;
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
    toAccount,
    note: note || "",
    createdBy: req.user._id,
  });
  await handover.populate([
    { path: "createdBy", select: "name role" },
    { path: "account", select: "bankName accountTitle ownerType" },
    { path: "toAccount", select: "bankName accountTitle accountNumber ownerType" },
  ]);
  res.status(201).json(handover);
});

export const listHandovers = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const filter = {};
  const range = buildDateRangeFilter(from, to);
  if (range) filter.createdAt = range;
  const handovers = await CashHandover.find(filter)
    .populate("createdBy", "name role")
    .populate("account", "bankName accountTitle ownerType")
    .populate("toAccount", "bankName accountTitle accountNumber ownerType")
    .sort({ createdAt: -1 });
  res.json(handovers);
});

// Undo a handover entered by mistake. The money counts as back in the counter / salesman
// account; enter the right handover again if needed.
export const deleteHandover = asyncHandler(async (req, res) => {
  const reason = requireReason(req.body?.reason);
  const handover = await CashHandover.findById(req.params.id)
    .populate("account", "bankName ownerType ownerName")
    .populate("toAccount", "bankName ownerType ownerName");
  if (!handover) return res.status(404).json({ message: "Handover not found" });
  await handover.deleteOne();
  await logChange(req, {
    area: "handover",
    action: "undo",
    summary: `Handover of ${rs(handover.amount)} to Asim (${handoverText(handover)}) undone`,
    reason,
    before: { ...handover.toObject(), account: accountText(handover.account), toAccount: accountText(handover.toAccount) },
  });
  res.json({ message: "Handover undone" });
});
