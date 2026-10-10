import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import Sale from "../models/Sale.js";
import Stock from "../models/Stock.js";
import CommissionAgent from "../models/CommissionAgent.js";

// This app's profit/commission calculation was rewritten more than once while it was
// being built. Any bill made before the current logic existed is still sitting in the
// database with whatever profit/cost numbers were computed at the time - which can be
// wrong or missing entirely. This script walks every existing bill and recalculates its
// cost of goods, profit, and commission using TODAY's stock prices and commission rates,
// then saves the corrected numbers back onto that same bill. It never changes what the
// customer was charged (subtotal/total) or any stock quantities - only the internal
// cost/profit bookkeeping.

const run = async () => {
  await connectDB();

  const sales = await Sale.find({ cancelled: false }).populate("commissionAgent");
  console.log(`Found ${sales.length} active bill(s) to check.\n`);

  let fixedCount = 0;
  let unchangedCount = 0;

  for (const sale of sales) {
    let costOfGoods = 0;
    const newItems = [];

    for (const item of sale.items) {
      let purchaseCostPerUnit = 0;
      let itemCost = 0;

      if (item.itemType === "bori") {
        const stock = await Stock.findOne({ riceType: item.riceType, boriSize: item.boriSize });
        purchaseCostPerUnit = stock?.lastPricePerBori || 0;
        itemCost = item.quantityBori * purchaseCostPerUnit;
      } else if (item.itemType === "khula") {
        const stock = await Stock.findOne({ riceType: item.riceType, boriSize: item.boriSize });
        purchaseCostPerUnit = stock && item.boriSize ? (stock.lastPricePerBori || 0) / item.boriSize : 0;
        itemCost = (item.quantityGrams / 1000) * purchaseCostPerUnit;
      }

      costOfGoods += itemCost;
      newItems.push({ ...item.toObject(), purchaseCostPerUnit, itemCost });
    }

    const rideCost = sale.rideCost || 0;
    const profitBeforeCommission = sale.subtotal - costOfGoods - rideCost;

    let commissionPercent = 0;
    let commissionAmount = 0;
    if (sale.commissionAgent && profitBeforeCommission > 0) {
      commissionPercent = sale.commissionAgent.percentage;
      commissionAmount = (profitBeforeCommission * commissionPercent) / 100;
    }
    const profit = profitBeforeCommission - commissionAmount;

    const changed =
      Math.round(costOfGoods) !== Math.round(sale.costOfGoods || 0) ||
      Math.round(profit) !== Math.round(sale.profit || 0) ||
      Math.round(commissionAmount) !== Math.round(sale.commissionAmount || 0);

    if (changed) {
      console.log(
        `Invoice #${sale.invoiceNumber}: costOfGoods ${sale.costOfGoods || 0} -> ${Math.round(costOfGoods)}, ` +
          `profit ${sale.profit || 0} -> ${Math.round(profit)}, commission ${sale.commissionAmount || 0} -> ${Math.round(commissionAmount)}`
      );
      sale.items = newItems;
      sale.costOfGoods = costOfGoods;
      sale.commissionPercent = commissionPercent;
      sale.commissionAmount = commissionAmount;
      sale.profit = profit;
      await sale.save();
      fixedCount++;
    } else {
      unchangedCount++;
    }
  }

  console.log(`\nDone. Fixed ${fixedCount} bill(s), ${unchangedCount} were already correct.`);
  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
