// On phones, records show as one line each instead of a wide table: what it is and the amount on
// top, small details underneath. Every number is shown in full.
export const PhoneList = ({ children, empty, className = "" }) => {
  const hasRows = Array.isArray(children) ? children.flat().some(Boolean) : Boolean(children);
  return (
    <ul className={`divide-y divide-[var(--line)] ${className}`}>
      {children}
      {!hasRows && empty && <li className="py-8 px-4 text-center text-sm text-[var(--ink-muted)]">{empty}</li>}
    </ul>
  );
};

export const PhoneRow = ({ title, sub, meta, amount, amountSub, amountClass = "", actions, muted = false }) => (
  <li className={`flex items-start justify-between gap-3 px-4 py-3 text-sm ${muted ? "opacity-60" : ""}`}>
    <div className="min-w-0 flex-1">
      <div className="font-medium break-words">{title}</div>
      {sub && <div className="text-xs text-[var(--ink-muted)] mt-0.5 break-words">{sub}</div>}
      {meta && <div className="text-xs text-[var(--ink-faint)] mt-0.5">{meta}</div>}
    </div>
    {(amount !== undefined || actions) && (
      <div className="flex items-start gap-1 shrink-0">
        {amount !== undefined && (
          <div className="text-right">
            <div className={`font-semibold whitespace-nowrap ${amountClass}`}>{amount}</div>
            {amountSub && <div className="text-xs text-[var(--ink-muted)] whitespace-nowrap">{amountSub}</div>}
          </div>
        )}
        {actions && <div className="flex items-center -my-1 -mr-2">{actions}</div>}
      </div>
    )}
  </li>
);
