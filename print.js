(() => {
  let printed = false;

  function openPrintDialog() {
    if (printed) return;
    printed = true;
    window.focus();
    window.print();
  }

  document.querySelector('[data-print-trigger]')?.addEventListener('click', openPrintDialog);
  window.addEventListener('load', () => window.setTimeout(openPrintDialog, 150), { once: true });
  window.setTimeout(openPrintDialog, 4000);
})();
