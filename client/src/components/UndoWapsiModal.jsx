import api from "../api/axios.js";
import ReasonModal from "./ReasonModal.jsx";
import { formatDateTime } from "../utils/format.js";
import { returnItems, returnItemsText, returnMoneyText } from "../utils/wapsi.js";

// Undo a return entered by mistake: everything comes out of stock / khula again, and a khata cut
// goes back on. Blocked if that rice has already been sold again.
const UndoWapsiModal = ({ target, onClose, onDone }) => {
  const items = target ? returnItems(target) : [];
  const places = [
    items.some((i) => i.itemType === "bori") && "main stock",
    items.some((i) => i.itemType === "khula") && "khula",
  ].filter(Boolean);
  return (
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
            {returnItemsText(target)}, {returnMoneyText(target)}, on {formatDateTime(target.createdAt)}.
          </p>
          <p>
            It comes back out of {places.join(" and ")}
            {target.balanceAdjustment > 0 ? ", and the khata goes back up" : ""}.
          </p>
        </>
      )}
    </ReasonModal>
  );
};

export default UndoWapsiModal;
