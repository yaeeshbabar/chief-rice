import BankAccount from "../models/BankAccount.js";
import { asyncHandler } from "../middleware/errorHandler.js";

export const listBankAccounts = asyncHandler(async (req, res) => {
  const { ownerType, includeInactive } = req.query;
  const filter = {};
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
  const account = await BankAccount.create({
    ownerType,
    ownerName,
    bankName,
    accountTitle,
    accountNumber,
    iban: iban || "",
    branchCode: branchCode || "",
  });
  res.status(201).json(account);
});

export const updateBankAccount = asyncHandler(async (req, res) => {
  const account = await BankAccount.findById(req.params.id);
  if (!account) return res.status(404).json({ message: "Account not found" });
  const fields = ["ownerType", "ownerName", "bankName", "accountTitle", "accountNumber", "iban", "branchCode", "active"];
  for (const f of fields) {
    if (req.body[f] !== undefined) account[f] = req.body[f];
  }
  await account.save();
  res.json(account);
});
