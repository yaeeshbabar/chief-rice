import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Login from "./pages/Login.jsx";
import CustomerDetail from "./pages/CustomerDetail.jsx";
import Cash from "./pages/Cash.jsx";
import KhulaReport from "./pages/KhulaReport.jsx";
import SalesReport from "./pages/SalesReport.jsx";
import Payments from "./pages/Payments.jsx";
import ChangesReport from "./pages/ChangesReport.jsx";
import ProfitReport from "./pages/ProfitReport.jsx";

import AdminLayout from "./pages/admin/AdminLayout.jsx";
import AdminDashboard from "./pages/admin/Dashboard.jsx";
import AdminStock from "./pages/admin/Stock.jsx";
import AdminKhata from "./pages/admin/Khata.jsx";
import AdminInvoices from "./pages/admin/Invoices.jsx";
import AdminExpenses from "./pages/admin/Expenses.jsx";
import AdminWapsi from "./pages/admin/Wapsi.jsx";
import AdminSettings from "./pages/admin/Settings.jsx";
import InvoiceView from "./pages/InvoiceView.jsx";

import SalesmanLayout from "./pages/salesman/SalesmanLayout.jsx";
import NewSale from "./pages/salesman/NewSale.jsx";
import SalesmanKhula from "./pages/salesman/Khula.jsx";
import SalesmanInvoices from "./pages/salesman/Invoices.jsx";
import SalesmanExpenses from "./pages/salesman/Expenses.jsx";
import SalesmanWapsi from "./pages/salesman/Wapsi.jsx";
import SalesmanReports from "./pages/salesman/Reports.jsx";
import SalesmanCreditors from "./pages/salesman/Creditors.jsx";

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={user.role === "admin" ? "/admin" : "/salesman"} replace /> : <Login />}
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute role="admin">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="stock" element={<AdminStock />} />
        <Route path="khata" element={<AdminKhata />} />
        <Route path="khata/:id" element={<CustomerDetail role="admin" />} />
        <Route path="invoices" element={<AdminInvoices />} />
        <Route path="invoices/:id" element={<InvoiceView role="admin" />} />
        <Route path="expenses" element={<AdminExpenses />} />
        <Route path="wapsi" element={<AdminWapsi />} />
        <Route path="cash" element={<Cash />} />
        <Route path="khula-report" element={<KhulaReport />} />
        <Route path="sales-report" element={<SalesReport role="admin" />} />
        <Route path="payments" element={<Payments role="admin" />} />
        <Route path="changes" element={<ChangesReport role="admin" />} />
        <Route path="profit" element={<ProfitReport />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      <Route
        path="/salesman"
        element={
          <ProtectedRoute role="salesman">
            <SalesmanLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<NewSale />} />
        <Route path="khula" element={<SalesmanKhula />} />
        <Route path="creditors" element={<SalesmanCreditors />} />
        <Route path="creditors/:id" element={<CustomerDetail role="salesman" />} />
        <Route path="invoices" element={<SalesmanInvoices />} />
        <Route path="invoices/:id" element={<InvoiceView role="salesman" />} />
        <Route path="expenses" element={<SalesmanExpenses />} />
        <Route path="wapsi" element={<SalesmanWapsi />} />
        <Route path="cash" element={<Cash />} />
        <Route path="khula-report" element={<KhulaReport />} />
        <Route path="sales-report" element={<SalesReport role="salesman" />} />
        <Route path="payments" element={<Payments role="salesman" />} />
        <Route path="changes" element={<ChangesReport role="salesman" />} />
        <Route path="profit" element={<ProfitReport />} />
        <Route path="reports" element={<SalesmanReports />} />
      </Route>

      <Route path="/" element={<Navigate to={user ? (user.role === "admin" ? "/admin" : "/salesman") : "/login"} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
