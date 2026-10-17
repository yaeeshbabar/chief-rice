import api from "../api/axios.js";
import ReasonModal from "./ReasonModal.jsx";
import { formatDateTime, formatGrams, formatMoney } from "../utils/format.js";

// Undo a return entered by mistake: the rice comes out of stock / khula again, and any
// khata change is reversed. Blocked if that rice has already been sold again.
const UndoWapsiModal = ({ target, onClose, onDone }) => (
  <ReasonModal
    open={!!target}
    onClose={onClose}
    title="Undo this return?"
    confirmLabel="Undo return"
    danger
    placeholder="e.g. entered the wrong quantity"
    onConfirm={async (reason) => {
      await api.delete(`/wapsi/${target._id}`, { data: { reason } });
      onClose();
      onDone();
    }}
  >
    {target && (
      <>
        <p>
          {target.itemType === "khula" ? formatGrams(target.quantityGrams) : `${target.quantityBori} × ${target.boriSize}KG bori`}{" "}
          {target.riceTypeName}, {formatMoney(target.cashReturned)} returned, on {formatDateTime(target.createdAt)}.
        </p>
        <p>
          The rice is taken back out of {target.itemType === "khula" ? "khula" : "main stock"}
          {target.balanceAdjustment > 0 ? " and the customer's khata goes back up" : ""}. To fix it, undo and record it again.
        </p>
      </>
    )}
  </ReasonModal>
);

export default UndoWapsiModal;
