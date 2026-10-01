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

  // Download: until a real file is wired up, let the user know instead of jumping to "#".
  document.querySelectorAll("[data-download]").forEach((link) => {
    link.addEventListener("click", (e) => {
      if (link.getAttribute("href") === "#") {
        e.preventDefault();
        showToast("The report will be available to download soon");
      }
    });
  });

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Count-up for stat numbers. The final value is already in the HTML, so no-JS users see it too.
  function countUp(el) {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    // One formatter per counter: building it is the expensive part, and tick() runs every frame
    const nf = new Intl.NumberFormat("en-NG", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const format = (n) => prefix + nf.format(n) + suffix;
    const duration = 1900;
    const start = performance.now();

    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = format(target * eased);
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
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

  // Hero: kick off the headline word reveal on load.
  const hero = document.querySelector("[data-hero]");
  if (hero) {
    hero.querySelector("h1[data-words]")?.style.setProperty("--reveal-delay", "150ms");
    requestAnimationFrame(() => hero.classList.add("is-visible"));
  }

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
            entry.target.querySelectorAll("[data-count]").forEach(countUp);
            observer.unobserve(entry.target);
          });
        entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
          .forEach((entry, i) => {
            const el = entry.target;
            el.style.setProperty("--reveal-delay", `${Math.min(i, 5) * 120}ms`);
            el.classList.add("is-visible");
            setTimeout(() => el.querySelectorAll("[data-count]").forEach(countUp), Math.min(i, 5) * 120);
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
