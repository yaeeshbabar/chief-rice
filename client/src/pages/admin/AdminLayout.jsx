import { Outlet } from "react-router-dom";
import {
  Banknote,
  BookOpen,
  ChartColumn,
  ClipboardList,
  HandCoins,
  History,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  TrendingUp,
  Undo2,
  Wallet,
} from "lucide-react";
import Layout from "../../components/Layout.jsx";

const navGroups = [
  {
    items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true }],
  },
  {
    label: "Sales",
    items: [
      { to: "/admin/invoices", label: "Invoices", icon: Receipt },
      { to: "/admin/sales-report", label: "Sales report", icon: ChartColumn },
      { to: "/admin/khata", label: "Khata (credit)", icon: BookOpen },
      { to: "/admin/payments", label: "Collections", icon: HandCoins },
    ],
  },
  {
    label: "Stock",
    items: [
      { to: "/admin/stock", label: "Stock", icon: Package },
      { to: "/admin/khula-report", label: "Khula record", icon: ClipboardList },
      { to: "/admin/wapsi", label: "Wapsi (returns)", icon: Undo2 },
    ],
  },
  {
    label: "Money",
    items: [
      { to: "/admin/expenses", label: "Expenses", icon: Wallet },
      { to: "/admin/cash", label: "Cash handling", icon: Banknote },
      { to: "/admin/profit", label: "Profit & commission", icon: TrendingUp },
    ],
  },
  {
    label: "Admin",
    items: [
      { to: "/admin/changes", label: "Changes report", icon: History },
      { to: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

const AdminLayout = () => (
  <Layout panel="Admin" navGroups={navGroups}>
    <Outlet />
  </Layout>
);

export default AdminLayout;
