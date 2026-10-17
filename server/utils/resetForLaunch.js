import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import Sale from "../models/Sale.js";
import Customer from "../models/Customer.js";
import Payment from "../models/Payment.js";
import Expense from "../models/Expense.js";
import CashHandover from "../models/CashHandover.js";
import Wapsi from "../models/Wapsi.js";
import StockTransaction from "../models/StockTransaction.js";
import KhulaBatch from "../models/KhulaBatch.js";
import Counter from "../models/Counter.js";
import CommissionPayout from "../models/CommissionPayout.js";
import Stock from "../models/Stock.js";
import ChangeLog from "../models/ChangeLog.js";

// Clears the test data you entered while trying the app, so you can start real work cleanly.
//
//   npm run reset-launch          -> shows what WOULD be deleted, changes nothing
//   npm run reset-launch -- --yes -> actually does it
//
// KEEPS (your setup): logins, rice types, bank accounts, commission salesmen & their %,
//                     salary names, rent types.
// CLEARS: every bill, customer/khata, payment, expense, return, cash handover, commission
//         payout, khula batch, stock movement and change record. Stock quantities AND purchase prices go back to 0
//         (so you re-enter real stock). Invoice numbers and daily bill numbers start again from 1.
//
// Add --full to also wipe the settings above and drop the entire database (then run `npm run seed`).

const args = process.argv.slice(2);
const confirmed = args.includes("--yes");
const full = args.includes("--full");

const run = async () => {
  await connectDB();
  const db = mongoose.connection.name;

  const counts = {
    "Bills": await Sale.countDocuments(),
    "Customers (khata)": await Customer.countDocuments(),
    "Credit payments": await Payment.countDocuments(),
    "Expenses": await Expense.countDocuments(),
    "Returns (wapsi)": await Wapsi.countDocuments(),
    "Cash handovers": await CashHandover.countDocuments(),
    "Commission payouts": await CommissionPayout.countDocuments(),
    "Khula batches": await KhulaBatch.countDocuments(),
    "Stock movements": await StockTransaction.countDocuments(),
    "Change records": await ChangeLog.countDocuments(),
  };

  console.log(`\nDatabase: ${db}`);
  console.log(full ? "Mode: FULL WIPE (drops the whole database)\n" : "Mode: clear test data, keep your setup\n");
  for (const [label, n] of Object.entries(counts)) console.log(`  ${label.padEnd(20)} ${n}`);

  if (!confirmed) {
    console.log("\nNothing was changed. To really do this, run it again with --yes");
    await mongoose.connection.close();
    process.exit(0);
    return; // never fall through to the deletions below, whatever happens to process.exit
  }

  if (full) {
    await mongoose.connection.dropDatabase();
    console.log("\nDatabase dropped. Now run:  npm run seed");
  } else {
    await Promise.all([
      Sale.deleteMany({}),
      Customer.deleteMany({}),
      Payment.deleteMany({}),
      Expense.deleteMany({}),
      Wapsi.deleteMany({}),
      CashHandover.deleteMany({}),
      CommissionPayout.deleteMany({}),
      KhulaBatch.deleteMany({}),
      StockTransaction.deleteMany({}),
      ChangeLog.deleteMany({}),
      Counter.deleteMany({}),
    ]);
    await Stock.updateMany({}, { $set: { quantity: 0, lastPricePerBori: 0 } });
    console.log("\nDone. Test data cleared, stock set to 0, numbering restarted at 1. Your setup was kept.");
    console.log("Next: log in as admin and add your REAL opening stock (with real purchase prices).");
  }

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
