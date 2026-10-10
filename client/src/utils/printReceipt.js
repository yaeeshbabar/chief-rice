// Prints either the 80mm thermal receipt or the full A4 invoice.
//
// Browsers ignore "size: 80mm auto", so for the thermal roll we measure the receipt's real
// height and ask for an exact 80mm x <height>mm page. That prints one clean receipt of exactly
// the right length - no blank paper wasted, no second page.
export function printInvoice(mode) {
  document.body.setAttribute("data-print", mode);
  const style = document.createElement("style");
  style.id = "print-page-style";

  if (mode === "thermal") {
    const receipt = document.querySelector(".thermal-receipt");
    let heightMm = 200;
    if (receipt) {
      const prev = receipt.getAttribute("style");
      receipt.style.cssText = "display:block;position:absolute;visibility:hidden;left:-9999px;top:0;";
      heightMm = Math.ceil((receipt.getBoundingClientRect().height * 25.4) / 96) + 6;
      if (prev === null) receipt.removeAttribute("style");
      else receipt.setAttribute("style", prev);
    }
    style.textContent = `@page { size: 80mm ${heightMm}mm; margin: 0; }`;
  } else {
    style.textContent = "@page { size: A4; margin: 10mm; }";
  }
  document.head.appendChild(style);

  const cleanup = () => {
    document.body.removeAttribute("data-print");
    style.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}
