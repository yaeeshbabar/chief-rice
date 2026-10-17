import { useEffect, useState } from "react";
import api from "../api/axios.js";

// A single dropdown that clearly separates "Salesman Account" (shown as one
// simple option since there's only ever one) from Asim's several bank accounts.
const AccountSelect = ({ value, onChange, className = "field-input" }) => {
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    api.get("/bank-accounts").then((res) => setAccounts(res.data));
  }, []);

  const salesmanAccounts = accounts.filter((a) => a.ownerType === "salesman");
  const asimAccounts = accounts.filter((a) => a.ownerType === "asim");

  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select account money was received into</option>
      {salesmanAccounts.length > 0 && (
        <optgroup label="Salesman">
          {salesmanAccounts.length === 1 ? (
            <option value={salesmanAccounts[0]._id}>Salesman account</option>
          ) : (
            salesmanAccounts.map((a) => (
              <option key={a._id} value={a._id}>
                {a.ownerName} — {a.bankName}
              </option>
            ))
          )}
        </optgroup>
      )}
      {asimAccounts.length > 0 && (
        <optgroup label="Asim's accounts">
          {asimAccounts.map((a) => (
            <option key={a._id} value={a._id}>
              {a.bankName} — {a.accountNumber}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
};

export default AccountSelect;
