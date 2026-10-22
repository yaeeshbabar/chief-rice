import Sale from "../models/Sale.js";
import Payment from "../models/Payment.js";
import Expense from "../models/Expense.js";
import Wapsi from "../models/Wapsi.js";
import CashHandover from "../models/CashHandover.js";
import BankAccount from "../models/BankAccount.js";
import CommissionPayout from "../models/CommissionPayout.js";
import { wapsiCashOut } from "./wapsiItems.js";

// Computes what should physically/actually be sitting in the two pools the
// salesman can hand over from: the cash counter, and the salesman's own bank
// account. Money that customers or creditors paid straight into an Asim-owned
// account never passes through either pool, so it's excluded here even though
// it's still recorded for balances, payment history, and profit.
export const computeCashPools = async () => {
  const [sales, payments, expenses, wapsi, handovers, accounts, commissionPayouts] = await Promise.all([
    Sale.find({ paymentType: "cash", cancelled: false }).select("total paymentMethod account"),
    Payment.find().select("amount paymentMethod account directToAsim"),
    Expense.find().select("amount"),
    Wapsi.find().select("cashReturned balanceAdjustment refundTo"),
    CashHandover.find().select("amount source"),
    BankAccount.find().select("ownerType"),
    CommissionPayout.find().select("amount"),
  ]);

  const accountOwnerType = new Map(accounts.map((a) => [String(a._id), a.ownerType]));
  const isAsimAccount = (accountId) => accountId && accountOwnerType.get(String(accountId)) === "asim";

  const cashSales = sales.filter((s) => (s.paymentMethod || "cash") === "cash");
  const salesmanAccountSales = sales.filter((s) => s.paymentMethod === "online" && !isAsimAccount(s.account));

  const cashPayments = payments.filter((p) => !p.directToAsim && (p.paymentMethod || "cash") === "cash");
  const salesmanAccountPayments = payments.filter(
    (p) => !p.directToAsim && p.paymentMethod === "online" && !isAsimAccount(p.account)
  );

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalWapsiCash = wapsi.reduce((sum, w) => sum + wapsiCashOut(w), 0);
  const cashHandedOver = handovers.filter((h) => h.source !== "account").reduce((sum, h) => sum + h.amount, 0);
  const accountHandedOver = handovers.filter((h) => h.source === "account").reduce((sum, h) => sum + h.amount, 0);

  const cashIn = cashSales.reduce((sum, s) => sum + s.total, 0) + cashPayments.reduce((sum, p) => sum + p.amount, 0);
  const accountIn = salesmanAccountSales.reduce((sum, s) => sum + s.total, 0) + salesmanAccountPayments.reduce((sum, p) => sum + p.amount, 0);

  const totalCommissionPaid = commissionPayouts.reduce((sum, c) => sum + c.amount, 0);

  const cashInCounter = cashIn - totalExpenses - totalWapsiCash - cashHandedOver - totalCommissionPaid;
  const cashInSalesmanAccount = accountIn - accountHandedOver;

  return {
    cashInCounter,
    cashInSalesmanAccount,
    totalInStore: cashInCounter + cashInSalesmanAccount,
    breakdown: {
      totalCashSales: cashSales.reduce((sum, s) => sum + s.total, 0),
      totalCashPaymentsCollected: cashPayments.reduce((sum, p) => sum + p.amount, 0),
      totalAccountSales: salesmanAccountSales.reduce((sum, s) => sum + s.total, 0),
      totalAccountPaymentsCollected: salesmanAccountPayments.reduce((sum, p) => sum + p.amount, 0),
      totalExpenses,
      totalWapsiCash,
      cashHandedOver,
      accountHandedOver,
      totalCommissionPaid,
    },
  };
};
