import express from "express";
import cors from "cors";
import morgan from "morgan";

import authRoutes from "./routes/authRoutes.js";
import riceTypeRoutes from "./routes/riceTypeRoutes.js";
import stockRoutes from "./routes/stockRoutes.js";
import khulaRoutes from "./routes/khulaRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import saleRoutes from "./routes/saleRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";
import expenseOptionRoutes from "./routes/expenseOptionRoutes.js";
import wapsiRoutes from "./routes/wapsiRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import cashHandoverRoutes from "./routes/cashHandoverRoutes.js";
import bankAccountRoutes from "./routes/bankAccountRoutes.js";
import commissionAgentRoutes from "./routes/commissionAgentRoutes.js";
import commissionPayoutRoutes from "./routes/commissionPayoutRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import changeLogRoutes from "./routes/changeLogRoutes.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (req, res) => res.json({ status: "ok", app: "Chief Rice Trader" }));

app.use("/api/auth", authRoutes);
app.use("/api/rice-types", riceTypeRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/khula", khulaRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/expense-options", expenseOptionRoutes);
app.use("/api/wapsi", wapsiRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/cash-handovers", cashHandoverRoutes);
app.use("/api/bank-accounts", bankAccountRoutes);
app.use("/api/commission-agents", commissionAgentRoutes);
app.use("/api/commission-payouts", commissionPayoutRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/change-log", changeLogRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
