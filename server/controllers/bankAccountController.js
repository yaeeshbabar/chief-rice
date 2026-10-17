import BankAccount from "../models/BankAccount.js";
import Sale from "../models/Sale.js";
import Payment from "../models/Payment.js";
import CashHandover from "../models/CashHandover.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { logChange, accountText, requireReason } from "../utils/changeLog.js";

export const listBankAccounts = asyncHandler(async (req, res) => {
  const { ownerType, includeInactive } = req.query;
  const filter = { deleted: { $ne: true } };
  if (ownerType) filter.ownerType = ownerType;
  if (!includeInactive) filter.active = true;
  const accounts = await BankAccount.find(filter).sort({ ownerType: 1, bankName: 1 });
  res.json(accounts);
});

export const createBankAccount = asyncHandler(async (req, res) => {
  const { ownerType, ownerName, bankName, accountTitle, accountNumber, iban, branchCode } = req.body;
  if (!ownerType || !ownerName || !bankName || !accountTitle || !accountNumber) {
    return res.status(400).json({ message: "Owner, bank name, account title and account number are required" });
  }
  if (!["asim", "salesman"].includes(ownerType)) return res.status(400).json({ message: "Owner must be Asim or salesman" });
  const account = await BankAccount.create({
    ownerType,
    ownerName: String(ownerName).trim(),
    bankName: String(bankName).trim(),
    accountTitle: String(accountTitle).trim(),
    accountNumber: String(accountNumber).trim(),
    iban: iban || "",
    branchCode: branchCode || "",
  });
  await logChange(req, { area: "settings", action: "add", summary: `Account ${accountText(account)} added` });
  res.status(201).json(account);
});

// Account numbers are kept short in the change log (last 4 digits only).
const maskNumber = (value) => {
  const text = String(value || "");
  return text.length > 4 ? `••••${text.slice(-4)}` : text;
};
const fieldLabels = {
  ownerType: "owner",
  ownerName: "owner name",
  bankName: "bank name",
  accountTitle: "account title",
  accountNumber: "account number",
  iban: "IBAN",
  branchCode: "branch code",
  active: "on/off",
};

export const updateBankAccount = asyncHandler(async (req, res) => {
  const account = await BankAccount.findById(req.params.id);
  if (!account || account.deleted) return res.status(404).json({ message: "Account not found" });
  const fields = Object.keys(fieldLabels);
  const required = ["ownerName", "bankName", "accountTitle", "accountNumber"];
  for (const f of required) {
    if (req.body[f] !== undefined && !String(req.body[f]).trim()) {
      return res.status(400).json({ message: `${fieldLabels[f][0].toUpperCase()}${fieldLabels[f].slice(1)} can't be empty` });
    }
  }
  if (req.body.ownerType !== undefined && !["asim", "salesman"].includes(req.body.ownerType)) {
    return res.status(400).json({ message: "Owner must be Asim or salesman" });
  }

  const beforeLabel = accountText(account);
  const before = {};
  const after = {};
  for (const f of fields) {
    if (req.body[f] === undefined) continue;
    const next = typeof req.body[f] === "string" ? req.body[f].trim() : req.body[f];
    if (String(account[f] ?? "") === String(next ?? "")) continue;
    const secret = f === "accountNumber" || f === "iban";
    before[f] = secret ? maskNumber(account[f]) : account[f];
    after[f] = secret ? maskNumber(next) : next;
    account[f] = next;
  }
  await account.save();

  const changed = Object.keys(after);
  if (changed.length) {
    const onlyToggle = changed.length === 1 && changed[0] === "active";
    await logChange(req, {
      area: "settings",
      action: onlyToggle ? (account.active ? "turn-on" : "turn-off") : "edit",
      summary: onlyToggle
        ? `Account ${beforeLabel} turned ${account.active ? "on" : "off"}`
        : `Account ${beforeLabel} details changed: ${changed.map((f) => fieldLabels[f]).join(", ")}`,
      reason: req.body.reason ? String(req.body.reason).trim() : "",
      before,
      after,
    });
  }
  res.json(account);
});

// Admin only: delete an account. If old bills, payments or handovers point to it, it is
// hidden from every list but kept, so those records still show the right bank.
export const deleteBankAccount = asyncHandler(async (req, res) => {
  const reason = requireReason(req.body?.reason);
  const account = await BankAccount.findById(req.params.id);
  if (!account || account.deleted) return res.status(404).json({ message: "Account not found" });
  const [sales, payments, handovers] = await Promise.all([
    Sale.exists({ account: account._id }),
    Payment.exists({ account: account._id }),
    CashHandover.exists({ account: account._id }),
  ]);
  const used = Boolean(sales || payments || handovers);
  const label = accountText(account);
  if (used) {
    account.deleted = true;
    account.deletedAt = new Date();
    account.active = false;
    await account.save();
  } else {
    await account.deleteOne();
  }
  await logChange(req, {
    area: "settings",
    action: "delete",
    summary: used ? `Account ${label} deleted (old bills and payments still show it)` : `Account ${label} deleted`,
    reason,
    before: { ownerType: account.ownerType, ownerName: account.ownerName, bankName: account.bankName, accountTitle: account.accountTitle },
  });
  res.json({ message: "Account deleted" });
});
