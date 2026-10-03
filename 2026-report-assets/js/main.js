(function () {
  const toast = document.getElementById("toast");
  let toastTimer;

  function showToast(message) {
    toast.textContent = message;
    toast.classList.remove("opacity-0", "translate-y-4");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.add("opacity-0", "translate-y-4");
    }, 2500);
  }

  async function copyLink(url) {
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied to clipboard");
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  // Share report: native share sheet on supported devices, clipboard otherwise.
  document.querySelectorAll("[data-share]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const data = {
        title: document.title,
        text: "Getting PaidRight — the PaidHR Compensation Intelligence Report 2026",
        url: window.location.href,
      };

      if (navigator.share) {
        try {
          await navigator.share(data);
        } catch (err) {
          if (err.name !== "AbortError") copyLink(data.url);
        }
      } else {
        copyLink(data.url);
      }
    });
  });

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Download: gated behind the HubSpot form. Both "Download PaidRight Report" buttons open the same
  // modal; the native <dialog> gives us a focus trap, Escape-to-close and an inert background for free.
  const downloadModal = document.getElementById("download-modal");
  if (downloadModal) {
    let opener = null;
    const REPORT_URL =
      "https://www.dropbox.com/scl/fi/w71kit9b0veqez4gse344/THE-PAIDHR-COMPENSATION-INTELLIGENCE-REPORT-2026.pdf?rlkey=xkkf0n97uj8ylirdoou9utg61&st=9n1ak6q6&e=1&dl=1";

    // The form is created once, the first time the modal opens — not at page load, so nothing is
    // fetched from HubSpot until someone actually wants the report.
    let hsFormStarted = false;
    function startHsForm() {
      if (hsFormStarted) return;
      if (!(window.hbspt && window.hbspt.forms)) {
        setTimeout(startHsForm, 150); // forms/v2.js is still loading; try again shortly
        return;
      }
      hsFormStarted = true;
      const target = downloadModal.querySelector("#hubspot-form-target");
      const loading = downloadModal.querySelector("[data-hs-loading]");
      const success = downloadModal.querySelector("[data-hs-success]");
      let redirected = false;
      const goToReport = () => {
        if (redirected) return;
        redirected = true;
        if (success) {
          target.hidden = true;
          success.hidden = false;
        }
        setTimeout(() => (window.location.href = REPORT_URL), success && !reduceMotion ? 1100 : 0);
      };

      // On this portal, hbspt.forms.create()'s onFormReady/onFormSubmitted callbacks are never
      // actually invoked (confirmed: they get serialised into inert data- attributes instead), and
      // redirectUrl navigates only the iframe itself, not this page — which would otherwise leave
      // Dropbox trying to render inside a 480px-wide box. So instead: watch for the iframe HubSpot
      // inserts (removes the spinner once it exists), then watch *that iframe's own* load event —
      // cross-origin-safe even though we can't read its contents. The first load is the form itself;
      // any load after that means it navigated away (to redirectUrl, after a real submission), which
      // is the one reliable, cross-origin-safe submission signal available here — at that instant we
      // take over navigation ourselves so the report opens in the full page, not the small iframe.
      const watchIframe = new MutationObserver(() => {
        const iframe = target.querySelector("iframe");
        if (!iframe) return;
        watchIframe.disconnect();
        loading?.remove();
        let loadCount = 0;
        iframe.addEventListener("load", () => {
          loadCount += 1;
          if (loadCount > 1) goToReport();
        });
      });
      watchIframe.observe(target, { childList: true, subtree: true });

      window.hbspt.forms.create({
        region: "eu1",
        portalId: "26055346",
        formId: "9b0ce4b6-9649-4f03-8015-6ec2856106ff",
        target: "#hubspot-form-target",
        redirectUrl: REPORT_URL,
      });
    }

    const openModal = () => {
      opener = document.activeElement;
      downloadModal.showModal();
      requestAnimationFrame(() => downloadModal.classList.add("is-open"));
      startHsForm();
    };

    const closeModal = () => {
      if (!downloadModal.open) return;
      downloadModal.classList.remove("is-open");
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        downloadModal.removeEventListener("transitionend", finish);
        downloadModal.close();
        opener?.focus();
      };
      if (reduceMotion) finish();
      else {
        downloadModal.addEventListener("transitionend", finish);
        setTimeout(finish, 350); // safety net if the transition never fires
      }
    };

    document.querySelectorAll("[data-download]").forEach((btn) => btn.addEventListener("click", openModal));
    downloadModal.querySelectorAll("[data-modal-close]").forEach((btn) => btn.addEventListener("click", closeModal));
    // Clicking the ::backdrop fires a click on the dialog itself (nothing else inside it fills the whole box)
    downloadModal.addEventListener("click", (e) => {
      if (e.target === downloadModal) closeModal();
    });
    // The dialog's own Escape-to-close fires "cancel" before "close"; animate it the same way as our buttons
    downloadModal.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeModal();
    });
  }

  // Split headings into words for the word-by-word reveal. Words inside a coloured span
  // (text-brand / text-mint / text-sun) also get the shimmer.
  const ACCENT = /\btext-(brand|mint|sun)\b/;
  document.querySelectorAll("[data-words]").forEach((heading) => {
    let wi = 0;
    const walk = (node, accentColor) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const cls = child.getAttribute("class") || "";
          const next = ACCENT.test(cls) ? getComputedStyle(child).color : /\btext-white\b/.test(cls) ? null : accentColor;
          walk(child, next);
          return;
        }
        if (child.nodeType !== Node.TEXT_NODE || !child.textContent.trim()) return;
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            frag.append(" ");
            return;
          }
          const outer = document.createElement("span");
          outer.className = accentColor ? "w w-accent" : "w";
          const inner = document.createElement("span");
          inner.textContent = part;
          outer.style.setProperty("--wi", wi++);
          if (accentColor) inner.style.setProperty("--c", accentColor);
          outer.append(inner);
          frag.append(outer);
        });
        child.replaceWith(frag);
      });
    };
    heading.setAttribute("aria-label", heading.textContent.replace(/\s+/g, " ").trim());
    walk(heading, null);
    [...heading.children].forEach((c) => c.setAttribute("aria-hidden", "true"));
  });


  // Scroll reveal + trigger count-ups when their card comes into view.
  const revealEls = document.querySelectorAll("[data-reveal]");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        // Elements entering together (e.g. a row of cards) are staggered in reading order.
        // Anything already scrolled past (fast scroll, End key, anchor jump) is shown straight away.
        entries
          .filter((entry) => !entry.isIntersecting && entry.boundingClientRect.bottom < 0)
          .forEach((entry) => {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          });
        entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
          .forEach((entry, i) => {
            const el = entry.target;
            el.style.setProperty("--reveal-delay", `${Math.min(i, 5) * 120}ms`);
            el.classList.add("is-visible");
            observer.unobserve(el);
          });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    revealEls.forEach((el) => observer.observe(el));

    // Content at the very end of the page may never reach the trigger line, so reveal it once the bottom is hit.
    const revealAtBottom = () => {
      if (window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 4) return;
      document.querySelectorAll("[data-reveal]:not(.is-visible)").forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight) {
          el.classList.add("is-visible");
          observer.unobserve(el);
        }
      });
    };
    let bottomQueued = false;
    window.addEventListener(
      "scroll",
      () => {
        if (bottomQueued) return;
        bottomQueued = true;
        requestAnimationFrame(() => {
          bottomQueued = false;
          revealAtBottom();
        });
      },
      { passive: true }
    );
  }

  // Run the hero bar loop only while the hero is on screen.
  const loops = document.querySelectorAll("[data-hero]");
  if ("IntersectionObserver" in window) {
    const loopObserver = new IntersectionObserver((entries) =>
      entries.forEach((e) => e.target.toggleAttribute("data-playing", e.isIntersecting))
    );
    loops.forEach((el) => loopObserver.observe(el));
  } else {
    loops.forEach((el) => el.setAttribute("data-playing", ""));
  }

  // Card hover: lift + tilt towards the cursor, glow follows the pointer. Desktop pointers only.
  if (!reduceMotion && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    const MAX_TILT = 5;
    document.querySelectorAll("[data-tilt]").forEach((card) => {
      let frame = 0;
      card.addEventListener("pointerenter", () => {
        if (card.hasAttribute("data-reveal") && !card.classList.contains("is-visible")) return;
        card.classList.add("is-hovering");
        card.style.transition = "transform 0.35s ease-out, box-shadow 0.6s ease";
      });
      card.addEventListener("pointermove", (e) => {
        if (!card.classList.contains("is-hovering")) return;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const r = card.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width;
          const py = (e.clientY - r.top) / r.height;
          card.style.setProperty("--mx", `${px * 100}%`);
          card.style.setProperty("--my", `${py * 100}%`);
          card.style.transform = `perspective(900px) rotateX(${(0.5 - py) * MAX_TILT}deg) rotateY(${(px - 0.5) * MAX_TILT}deg) translateY(-4px)`;
        });
      });
      card.addEventListener("pointerleave", () => {
        cancelAnimationFrame(frame);
        card.classList.remove("is-hovering");
        card.style.transition = "transform 0.9s cubic-bezier(0.25, 0.8, 0.3, 1), box-shadow 0.6s ease";
        card.style.transform = "";
      });
    });
  }

  // Scroll-linked motion: hero copy eases up and fades as you leave the hero,
  // big images drift against the scroll.
  if (!reduceMotion) {
    const heroContent = document.querySelector("[data-hero-content]");
    const drifters = [...document.querySelectorAll("[data-drift]")];
    let ticking = false;

    const update = () => {
      ticking = false;
      const vh = window.innerHeight;
      const y = window.scrollY;

      if (heroContent && y < vh * 1.5) {
        heroContent.style.translate = `0 ${Math.round(y * -0.12)}px`;
        heroContent.style.opacity = Math.max(0, 1 - y / (vh * 0.9)).toFixed(3);
      }

      drifters.forEach((img) => {
        const box = img.parentElement.getBoundingClientRect();
        if (box.bottom < 0 || box.top > vh) return;
        // -1 when the box is entering at the bottom, +1 when leaving at the top
        const p = Math.max(-1, Math.min(1, (vh / 2 - (box.top + box.height / 2)) / (vh / 2 + box.height / 2)));
        img.style.translate = `0 ${Math.round(p * box.height * 0.06)}px`;
      });
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  }

  // Subscribe form
  const form = document.querySelector("[data-subscribe]");
  const formError = document.querySelector("[data-subscribe-error]");
  if (form) {
    const input = form.querySelector("input[type=email]");
    const setError = (msg) => {
      formError.textContent = msg;
      formError.classList.toggle("hidden", !msg);
      input.setAttribute("aria-invalid", msg ? "true" : "false");
    };

    input.addEventListener("input", () => setError(""));

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        setError("Please enter a valid work email address.");
        input.focus();
        return;
      }
      // TODO: send `email` to the newsletter backend here.
      setError("");
      form.reset();
      showToast("Thanks! We'll send you the next report first.");
    });
  }

  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
})();
