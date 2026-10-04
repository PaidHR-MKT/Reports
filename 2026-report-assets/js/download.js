(function () {
  const frame = document.querySelector("[data-hs-frame]");
  if (!frame) return;
  const loading = document.querySelector("[data-hs-loading]");
  const success = document.querySelector("[data-hs-success]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const REPORT_URL =
    "https://www.dropbox.com/scl/fi/w71kit9b0veqez4gse344/THE-PAIDHR-COMPENSATION-INTELLIGENCE-REPORT-2026.pdf?rlkey=xkkf0n97uj8ylirdoou9utg61&st=9n1ak6q6&e=1&dl=1";

  // The iframe is cross-origin, so its contents can't be read. The first load is the form itself; any
  // later load means it navigated away (HubSpot's post-submit redirect), which is the one reliable
  // submission signal available. At that point we take over and send the whole page to the report.
  let loads = 0;
  let redirected = false;
  frame.addEventListener("load", () => {
    loads += 1;
    if (loads === 1 && loading) {
      // The form paints a beat after the frame's load event; keep the spinner up until it has.
      setTimeout(() => {
        loading.style.transition = "opacity 0.3s ease";
        loading.style.opacity = "0";
        setTimeout(() => loading.remove(), 320);
      }, 500);
    }
    if (loads < 2 || redirected) return;
    redirected = true;
    if (success) {
      frame.parentElement.hidden = true;
      success.hidden = false;
    }
    setTimeout(() => (window.location.href = REPORT_URL), success && !reduceMotion ? 900 : 0);
  });
})();
