import BankAccount from "../models/BankAccount.js";

// New money can only go into a bank account that is on the list (not switched off or deleted),
// e.g. a page left open before the account was deleted. An old record that already points to
// an account keeps it when it is edited.
export const accountProblem = async (accountId, currentId) => {
  if (!accountId) return "";
  if (currentId && String(accountId) === String(currentId)) return "";
  const account = await BankAccount.findById(accountId).catch(() => null);
  if (!account || account.deleted || !account.active) return "This bank account is turned off or deleted. Pick another.";
  return "";
};
