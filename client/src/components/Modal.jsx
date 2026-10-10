import { X } from "lucide-react";

const Modal = ({ open, onClose, title, children, wide = false }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-[var(--overlay)] p-3 sm:p-6 overflow-y-auto">
      <div role="dialog" aria-modal="true" aria-label={title} className={`modal-panel w-full ${wide ? "max-w-3xl" : "max-w-md"} my-6`}>
        <div className="flex items-center justify-between gap-3 pl-5 pr-3 py-3 border-b border-[var(--line)]">
          <h3 className="text-base font-semibold tracking-tight text-[var(--ink)]">{title}</h3>
          <button onClick={onClose} className="icon-btn" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
