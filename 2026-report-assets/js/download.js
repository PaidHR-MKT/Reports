(function () {
  const form = document.querySelector("[data-dl-form]");
  if (!form) return;

  const steps = [...form.querySelectorAll("[data-step]")];
  const formView = document.querySelector("[data-form-view]");
  const successView = document.querySelector("[data-success-view]");
  const backHome = document.querySelector("[data-back-home]");
  const stepLabel = form.querySelector("[data-step-label]");
  const stepHint = form.querySelector("[data-step-hint]");
  const bar = form.querySelector("[data-bar]");
  const progress = bar.parentElement;
  const prevBtn = form.querySelector("[data-prev]");
  const nextBtn = form.querySelector("[data-next]");
  const nextLabel = form.querySelector("[data-next-label]");
  const nextArrow = form.querySelector("[data-next-arrow]");
  const nextSpinner = form.querySelector("[data-next-spinner]");
  const formError = form.querySelector("[data-form-error]");

  const HINTS = ["Your details", "Almost there"];
  const FIELD_STEP = { firstname: 1, lastname: 1, email: 1, phone: 2, category: 2, company: 2 };
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const field = (name) => form.elements[name];
  const value = (name) => field(name).value.trim();

  // Each rule returns an error message, or "" when the value is fine.
  const RULES = {
    firstname: () => (value("firstname") ? "" : "Enter your first name."),
    lastname: () => (value("lastname") ? "" : "Enter your last name."),
    email: () => {
      if (!value("email")) return "Enter your work email.";
      return EMAIL_RE.test(value("email")) ? "" : "Enter a valid email address.";
    },
    phone: () => {
      if (!value("phone")) return "Enter your phone number.";
      const digits = phoneE164().replace(/\D/g, "");
      return digits.length >= 8 && digits.length <= 15 ? "" : "Enter a valid phone number.";
    },
    category: () => (value("category") ? "" : "Choose the category that fits you."),
    company: () => (value("company") ? "" : "Enter your company name."),
  };

  // "0801 234 5678" + NG → +2348012345678. A number typed with its own "+" prefix is left alone.
  function phoneE164() {
    const raw = value("phone");
    const digits = raw.replace(/\D/g, "");
    if (raw.startsWith("+")) return "+" + digits;
    return field("dialcode").value + digits.replace(/^0+/, "");
  }

  function setError(name, message) {
    const input = field(name);
    const el = form.querySelector(`[data-error-for="${name}"]`);
    if (message) {
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", el.id || (el.id = `dl-error-${name}`));
      el.textContent = message;
      el.hidden = false;
    } else {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
      el.hidden = true;
    }
  }

  // Validates every field on a step, flags the bad ones, and focuses the first.
  function validateStep(n) {
    let firstBad = null;
    for (const name of Object.keys(RULES)) {
      if (FIELD_STEP[name] !== n) continue;
      const message = RULES[name]();
      setError(name, message);
      if (message && !firstBad) firstBad = field(name);
    }
    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  let current = 1;
  function showStep(n, { focus = true } = {}) {
    current = n;
    steps.forEach((el) => {
      el.hidden = Number(el.dataset.step) !== n;
    });
    stepLabel.textContent = `Step ${n} of 2`;
    stepHint.textContent = HINTS[n - 1];
    bar.style.width = `${n * 50}%`;
    progress.setAttribute("aria-valuenow", String(n));
    prevBtn.hidden = n === 1;
    nextLabel.textContent = n === 1 ? "Continue" : "Get the report";
    if (backHome) backHome.hidden = n !== 1;
    hideFormError();
    if (focus) steps[n - 1].querySelector("input").focus();
  }

  function showFormError(message) {
    formError.textContent = message;
    formError.hidden = false;
  }
  function hideFormError() {
    formError.hidden = true;
  }

  function setSending(sending) {
    nextBtn.disabled = sending;
    prevBtn.disabled = sending;
    nextSpinner.hidden = !sending;
    nextArrow.hidden = sending;
    nextLabel.textContent = sending ? "Sending…" : "Get the report";
  }

  const modal = document.querySelector("[data-report-modal]");

  // The report opens in a new tab from a real click on the button, so browsers never block it as a popup.
  function showSuccess(reportUrl) {
    const title = `Thank you, ${value("firstname")}.`;
    document.querySelector("[data-success-title]").textContent = title;
    document.querySelector("[data-modal-title]").textContent = title;
    document.querySelector("[data-success-link]").href = reportUrl;
    document.querySelector("[data-modal-link]").href = reportUrl;
    formView.hidden = true;
    successView.hidden = false;
    if (backHome) backHome.hidden = false;
    if (modal && modal.showModal) modal.showModal();
    else successView.focus({ preventScroll: true });
  }

  if (modal) {
    modal.querySelector("[data-modal-close]").addEventListener("click", () => modal.close());
    modal.querySelector("[data-modal-link]").addEventListener("click", () => modal.close());
    // Clicking the dimmed backdrop (the dialog element itself) closes it too.
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.close();
    });
  }

  async function submit() {
    // Re-check both steps: step 2 can be reached with step 1 edited or autofilled afterwards.
    if (!validateStep(1)) {
      showStep(1, { focus: false });
      validateStep(1);
      return;
    }
    if (!validateStep(2)) return;

    const reportUrl = form.dataset.reportUrl;
    // A filled honeypot means a bot: look successful, send nothing.
    if (field("website").value) return showSuccess(reportUrl);

    setSending(true);
    hideFormError();
    try {
      const res = await fetch(form.dataset.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstname: value("firstname"),
          lastname: value("lastname"),
          email: value("email"),
          phone: phoneE164(),
          category: value("category"),
          company: value("company"),
          pageUri: window.location.href,
          pageName: document.title,
        }),
      });
      if (res.status === 400) {
        // The server's own validation disagreed with ours: show its messages on the fields they belong to.
        const { errors = {} } = await res.json().catch(() => ({}));
        const names = Object.keys(errors).filter((name) => name in FIELD_STEP);
        if (names.length) {
          showStep(Math.min(...names.map((name) => FIELD_STEP[name])), { focus: false });
          names.forEach((name) => setError(name, errors[name]));
          field(names[0]).focus();
          setSending(false);
          nextLabel.textContent = current === 1 ? "Continue" : "Get the report";
          return;
        }
      }
      if (!res.ok) throw new Error(`Submit failed: ${res.status}`);
      showSuccess(reportUrl);
    } catch (err) {
      setSending(false);
      showFormError("Something went wrong sending your details. Please check your connection and try again.");
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (current === 1) {
      if (validateStep(1)) showStep(2);
    } else {
      submit();
    }
  });
  prevBtn.addEventListener("click", () => showStep(1));

  // Clear a field's error as soon as the visitor starts fixing it.
  form.addEventListener("input", (e) => {
    const name = e.target.name;
    if (name in RULES && e.target.getAttribute("aria-invalid")) setError(name, "");
  });
  form.addEventListener("change", (e) => {
    if (e.target.name === "category" && e.target.getAttribute("aria-invalid")) setError("category", "");
  });

  showStep(1, { focus: false });
})();
