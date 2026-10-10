import { Outlet } from "react-router-dom";
import {
  Banknote,
  BookOpen,
  ChartColumn,
  ChartPie,
  ClipboardList,
  HandCoins,
  History,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Undo2,
  Wallet,
  Wheat,
} from "lucide-react";
import Layout from "../../components/Layout.jsx";

const navGroups = [
  {
    items: [{ to: "/salesman", label: "New sale", icon: ShoppingCart, end: true }],
  },
  {
    label: "Sales",
    items: [
      { to: "/salesman/invoices", label: "My bills", icon: Receipt },
      { to: "/salesman/sales-report", label: "Sales report", icon: ChartColumn },
      { to: "/salesman/creditors", label: "Creditors", icon: BookOpen },
      { to: "/salesman/payments", label: "Collections", icon: HandCoins },
    ],
  },
  {
    label: "Stock",
    items: [
      { to: "/salesman/khula", label: "Khula stock", icon: Wheat },
      { to: "/salesman/khula-report", label: "Khula record", icon: ClipboardList },
      { to: "/salesman/wapsi", label: "Wapsi (return)", icon: Undo2 },
    ],
  },
  {
    label: "Money",
    items: [
      { to: "/salesman/expenses", label: "Extra expense", icon: Wallet },
      { to: "/salesman/cash", label: "Cash handling", icon: Banknote },
      { to: "/salesman/profit", label: "Profit & commission", icon: TrendingUp },
    ],
  },
  {
    label: "Reports",
    items: [
      { to: "/salesman/reports", label: "Reports", icon: ChartPie },
      { to: "/salesman/changes", label: "Changes report", icon: History },
    ],
  },
];

const SalesmanLayout = () => (
  <Layout panel="Salesman" navGroups={navGroups}>
    <Outlet />
  </Layout>
);

export default SalesmanLayout;
