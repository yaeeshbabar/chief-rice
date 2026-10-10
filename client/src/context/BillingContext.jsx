import { createContext, useContext, useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "crt_draft_bills_v3";

// Bills no longer carry a stored "Bill N" label - the number shown on each tab is always
// just that bill's position in the array (see NewSale.jsx). That guarantees two things at
// once: no two open tabs can ever show the same number, and closing/cancelling one tab
// automatically renumbers the rest with no gaps (closing tab 5 of 6 makes the old tab 6
// become tab 5), which is exactly how a stack of paper bills would renumber themselves.
const makeBlankBill = () => ({
  id: `bill_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  cart: [],
  paymentType: "cash",
  rideCharge: "",
  selectedCustomerId: "",
  addingNewCustomer: false,
  newCustomer: { name: "", shopName: "", phone: "", address: "" },
});

const loadInitial = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.bills) && parsed.bills.length) return parsed;
    }
  } catch {
    // ignore corrupt storage
  }
  const first = makeBlankBill();
  return { bills: [first], activeId: first.id };
};

const BillingContext = createContext(null);

export const BillingProvider = ({ children }) => {
  const [state, setState] = useState(loadInitial);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const activeBill = state.bills.find((b) => b.id === state.activeId) || state.bills[0];

  const updateActiveBill = useCallback((patch) => {
    setState((s) => ({
      ...s,
      bills: s.bills.map((b) =>
        b.id === s.activeId ? { ...b, ...(typeof patch === "function" ? patch(b) : patch) } : b
      ),
    }));
  }, []);

  const addBill = useCallback(() => {
    setState((s) => {
      const bill = makeBlankBill();
      return { bills: [...s.bills, bill], activeId: bill.id };
    });
  }, []);

  const switchBill = useCallback((id) => {
    setState((s) => ({ ...s, activeId: id }));
  }, []);

  const closeBill = useCallback((id) => {
    setState((s) => {
      const remaining = s.bills.filter((b) => b.id !== id);
      if (!remaining.length) {
        const fresh = makeBlankBill();
        return { bills: [fresh], activeId: fresh.id };
      }
      const activeId = s.activeId === id ? remaining[0].id : s.activeId;
      return { ...s, bills: remaining, activeId };
    });
  }, []);

  const resetActiveBill = useCallback(() => {
    setState((s) => ({
      ...s,
      bills: s.bills.map((b) => (b.id === s.activeId ? { ...makeBlankBill(), id: b.id } : b)),
    }));
  }, []);

  return (
    <BillingContext.Provider
      value={{
        bills: state.bills,
        activeBill,
        activeId: state.activeId,
        updateActiveBill,
        addBill,
        switchBill,
        closeBill,
        resetActiveBill,
      }}
    >
      {children}
    </BillingContext.Provider>
  );
};

export const useBilling = () => useContext(BillingContext);
