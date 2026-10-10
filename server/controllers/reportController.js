import { buildDateRangeFilter, todayRange, yesterdayRange, dateKey } from "../utils/dateRange.js";
import { computeCashPools } from "../utils/cashPools.js";
import Sale from "../models/Sale.js";
import Expense from "../models/Expense.js";
import Stock from "../models/Stock.js";
import KhulaBatch from "../models/KhulaBatch.js";
import Customer from "../models/Customer.js";
import Wapsi from "../models/Wapsi.js";
import Payment from "../models/Payment.js";
import CashHandover from "../models/CashHandover.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const startOfRange = (range, refDate = new Date()) => {
  const d = new Date(refDate);
  d.setHours(0, 0, 0, 0);
  if (range === "daily") return d;
  if (range === "weekly") {
    const day = d.getDay(); // 0 Sun ... 6 Sat
    const diff = (day + 6) % 7; // days since Monday
    d.setDate(d.getDate() - diff);
    return d;
  }
  if (range === "monthly") {
    d.setDate(1);
    return d;
  }
  if (range === "yearly") {
    d.setMonth(0, 1);
    return d;
  }
  return d;
};

export const summary = asyncHandler(async (req, res) => {
  const { range = "daily" } = req.query;
  const from = startOfRange(range);
  const to = new Date();

  const sales = await Sale.find({ createdAt: { $gte: from, $lte: to }, cancelled: false });
  const expenses = await Expense.find({ createdAt: { $gte: from, $lte: to } });
  const wapsi = await Wapsi.find({ createdAt: { $gte: from, $lte: to } });

  const cashSales = sales.filter((s) => s.paymentType === "cash").reduce((sum, s) => sum + s.total, 0);
  const creditSales = sales.filter((s) => s.paymentType === "credit").reduce((sum, s) => sum + s.total, 0);
  const totalSales = cashSales + creditSales;
  const rideCharges = sales.reduce((sum, s) => sum + (s.rideCharge || 0), 0);

  const expenseByCategory = {};
  let totalExpense = 0;
  for (const e of expenses) {
    expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + e.amount;
    totalExpense += e.amount;
  }

  const khulaBoriSold = sales.reduce(
    (sum, s) => sum + s.items.filter((i) => i.itemType === "khula").length,
    0
  );
  const boriSold = sales.reduce(
    (sum, s) => sum + s.items.filter((i) => i.itemType === "bori").reduce((a, i) => a + i.quantityBori, 0),
    0
  );
  const wapsiCash = wapsi.reduce((sum, w) => sum + (w.cashReturned || 0), 0);

  res.json({
    range,
    from,
    to,
    invoiceCount: sales.length,
    cashSales,
    creditSales,
    totalSales,
    rideCharges,
    totalExpense,
    expenseByCategory,
    netCash: cashSales - totalExpense,
    boriSold,
    khulaLineItemsSold: khulaBoriSold,
    wapsiCount: wapsi.length,
    wapsiCash,
  });
});

// Data points for a trend chart - last N buckets depending on range
export const salesTrend = asyncHandler(async (req, res) => {
  const { range = "daily" } = req.query; // daily->last 7 days, weekly->last 6 weeks, monthly->last 6 months, yearly->last 5 years
  const now = new Date();
  let buckets = [];

  if (range === "daily") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      buckets.push({ label: d.toLocaleDateString("en-GB", { weekday: "short" }), from: d, to: next });
    }
  } else if (range === "monthly") {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      buckets.push({ label: d.toLocaleDateString("en-GB", { month: "short" }), from: d, to: next });
    }
  } else if (range === "yearly") {
    for (let i = 4; i >= 0; i--) {
      const d = new Date(now.getFullYear() - i, 0, 1);
      const next = new Date(now.getFullYear() - i + 1, 0, 1);
      buckets.push({ label: String(d.getFullYear()), from: d, to: next });
    }
  } else {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 7);
      buckets.push({ label: `Wk ${6 - i}`, from: d, to: next });
    }
  }

  const results = [];
  for (const b of buckets) {
    const sales = await Sale.find({ createdAt: { $gte: b.from, $lt: b.to }, cancelled: false });
    const cash = sales.filter((s) => s.paymentType === "cash").reduce((sum, s) => sum + s.total, 0);
    const credit = sales.filter((s) => s.paymentType === "credit").reduce((sum, s) => sum + s.total, 0);
    results.push({ label: b.label, cash, credit, total: cash + credit });
  }
  res.json(results);
});

export const stockOverview = asyncHandler(async (req, res) => {
  const stock = await Stock.find().populate("riceType", "name active").sort({ "riceType.name": 1 });
  const khula = await KhulaBatch.find({ status: "ACTIVE" }).populate("riceType", "name").sort({ createdAt: -1 });
  const totalStockValue = stock.reduce((sum, s) => sum + s.quantity * (s.lastPricePerBori || 0), 0);
  const totalBags = stock.reduce((sum, s) => sum + s.quantity, 0);
  res.json({ stock, khula, totalStockValue, totalBags });
});

export const khataOverview = asyncHandler(async (req, res) => {
  const customers = await Customer.find({ balance: { $gt: 0 } }).sort({ balance: -1 });
  const totalOutstanding = customers.reduce((sum, c) => sum + c.balance, 0);
  res.json({ customers, totalOutstanding });
});

// Cash physically expected in the store drawer + salesman's own bank account right now.
export const cashInStore = asyncHandler(async (req, res) => {
  const pools = await computeCashPools();
  res.json(pools);
});

// Full sales report: pass ?quick=today|yesterday or from/to, optional paymentType to filter the
// displayed list - but cash/credit/combined totals are always computed from the whole date range.
export const salesReport = asyncHandler(async (req, res) => {
  const { from, to, quick, paymentType } = req.query;
  let range = buildDateRangeFilter(from, to);
  if (!range && quick === "today") range = todayRange();
  if (!range && quick === "yesterday") range = yesterdayRange();

  const filter = { cancelled: false };
  if (range) filter.createdAt = range;

  const allSales = await Sale.find(filter)
    .populate("customer", "name shopName")
    .populate("createdBy", "name role")
    .populate("account", "bankName ownerType ownerName")
    .sort({ createdAt: -1 });

  const cashSales = allSales.filter((s) => s.paymentType === "cash");
  const creditSales = allSales.filter((s) => s.paymentType === "credit");

  const sumOf = (arr) => arr.reduce((sum, s) => sum + s.total, 0);

  const displayed = paymentType === "cash" ? cashSales : paymentType === "credit" ? creditSales : allSales;

  res.json({
    sales: displayed,
    totals: {
      combinedTotal: sumOf(allSales),
      combinedCount: allSales.length,
      cashTotal: sumOf(cashSales),
      cashCount: cashSales.length,
      creditTotal: sumOf(creditSales),
      creditCount: creditSales.length,
    },
  });
});

// Full profit & loss statement for a period.
//   Sales profit  = revenue - cost of goods - ride/delivery on those sales - commission
//   Business net  = sales profit - shop expenses - salaries - net loss on returns
//   Owner take-home = business net - Asim's personal expenses
// Ride expenses that were auto-created from a sale are already inside "sales profit",
// so they are left out of shop expenses here to avoid counting them twice.
export const profitReport = asyncHandler(async (req, res) => {
  const { from, to, quick } = req.query;
  let range = buildDateRangeFilter(from, to);
  if (!range && quick === "today") range = todayRange();
  if (!range && quick === "yesterday") range = yesterdayRange();

  const filter = { cancelled: false };
  if (range) filter.createdAt = range;
  const rangeFilter = range ? { createdAt: range } : {};

  const [sales, expenses, wapsi, stockRows] = await Promise.all([
    Sale.find(filter).populate("commissionAgent", "name percentage"),
    Expense.find(rangeFilter),
    Wapsi.find(rangeFilter),
    Stock.find(),
  ]);

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const totalCostOfGoods = sales.reduce((sum, s) => sum + (s.costOfGoods || 0), 0);
  const totalRideCost = sales.reduce((sum, s) => sum + (s.rideCost || 0), 0);
  const totalCommission = sales.reduce((sum, s) => sum + (s.commissionAmount || 0), 0);
  const grossProfit = totalRevenue - totalCostOfGoods;
  const salesProfit = grossProfit - totalRideCost - totalCommission;

  // Commission earned per salesman in this period
  const commissionByAgent = {};
  for (const s of sales) {
    if (s.commissionAgent) {
      const name = s.commissionAgent.name;
      commissionByAgent[name] = (commissionByAgent[name] || 0) + (s.commissionAmount || 0);
    }
  }

  // Profit by rice type (item level: price - purchase cost) and by day
  const byRice = {};
  const byDay = {};
  for (const s of sales) {
    const day = dateKey(s.createdAt);
    byDay[day] = byDay[day] || { date: day, revenue: 0, profit: 0, bills: 0 };
    byDay[day].revenue += s.total;
    byDay[day].profit += (s.total - (s.costOfGoods || 0) - (s.rideCost || 0) - (s.commissionAmount || 0));
    byDay[day].bills += 1;
    for (const item of s.items) {
      const name = item.riceTypeName || "Unknown";
      byRice[name] = byRice[name] || { name, revenue: 0, cost: 0, kgSold: 0 };
      byRice[name].revenue += item.total || 0;
      byRice[name].cost += item.itemCost || 0;
      byRice[name].kgSold += item.itemType === "khula" ? (item.quantityGrams || 0) / 1000 : (item.quantityBori || 0) * (item.boriSize || 0);
    }
  }
  const profitByRice = Object.values(byRice)
    .map((r) => ({
      ...r,
      grossProfit: r.revenue - r.cost,
      margin: r.revenue > 0 ? ((r.revenue - r.cost) / r.revenue) * 100 : 0,
    }))
    .sort((a, b) => b.grossProfit - a.grossProfit);
  const dailyProfit = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));

  // Returns: cash refunded minus what the returned rice was worth at purchase cost
  const priceFor = (riceTypeId, size) => {
    const row = stockRows.find((r) => String(r.riceType) === String(riceTypeId) && r.boriSize === size);
    return row ? row.lastPricePerBori || 0 : 0;
  };
  let returnsRefund = 0;
  let returnsCostRecovered = 0;
  for (const w of wapsi) {
    returnsRefund += w.cashReturned || 0;
    if (w.itemType === "bori") {
      returnsCostRecovered += (w.quantityBori || 0) * priceFor(w.riceType, w.boriSize);
    } else {
      const size = priceFor(w.riceType, 25) > 0 ? 25 : 50;
      const perKg = priceFor(w.riceType, size) / size;
      returnsCostRecovered += ((w.quantityGrams || 0) / 1000) * perKg;
    }
  }
  const returnsNetLoss = returnsRefund - returnsCostRecovered;

  // Expenses
  const shopExpenses = {};
  const salaries = {};
  const personal = {};
  let shopTotal = 0, salaryTotal = 0, personalTotal = 0;
  for (const e of expenses) {
    const label = e.subCategory || e.category;
    if (e.category === "Dukan Kharch Khata") {
      if (e.relatedSale) continue; // already deducted inside sales profit
      shopExpenses[label] = (shopExpenses[label] || 0) + e.amount;
      shopTotal += e.amount;
    } else if (e.category === "Salary") {
      salaries[label] = (salaries[label] || 0) + e.amount;
      salaryTotal += e.amount;
    } else if (e.category === "Asim Kharcha Khata") {
      personal[label] = (personal[label] || 0) + e.amount;
      personalTotal += e.amount;
    }
  }
  const toList = (obj) => Object.entries(obj).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);

  const businessNetProfit = salesProfit - shopTotal - salaryTotal - returnsNetLoss;
  const ownerTakeHome = businessNetProfit - personalTotal;

  res.json({
    invoiceCount: sales.length,
    totalRevenue,
    totalCostOfGoods,
    grossProfit,
    grossMarginPercent: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
    totalRideCost,
    totalCommission,
    salesProfit,
    asimProfit: salesProfit, // kept for older screens
    shopExpensesTotal: shopTotal,
    shopExpenses: toList(shopExpenses),
    salaryTotal,
    salaries: toList(salaries),
    returnsRefund,
    returnsCostRecovered,
    returnsNetLoss,
    businessNetProfit,
    netMarginPercent: totalRevenue > 0 ? (businessNetProfit / totalRevenue) * 100 : 0,
    personalExpensesTotal: personalTotal,
    personalExpenses: toList(personal),
    ownerTakeHome,
    commissionByAgent,
    profitByRice,
    dailyProfit,
  });
});
