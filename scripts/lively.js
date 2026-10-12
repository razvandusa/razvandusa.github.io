// Lively widgets — headings type themselves out, paragraphs flow in word by
// word, tags pop in, and numbers count up as each block scrolls into view.
// Pause the looping card scenes, the hero and the marquee while they are off
// screen, so nothing animates (or forces layout) where you can't see it.
(function () {
  if (!window.IntersectionObserver) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.target.classList.toggle("is-paused", !e.isIntersecting);
  }, { rootMargin: "120px 0px" });
  document.querySelectorAll(".project-media, .hero, .marquee").forEach((el) => io.observe(el));
})();

(function () {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const TYPE_MS = 26;   // per character
  const WORD_MS = 14;   // per word

  // wrap every character (typing) or word (flowing) in a span, keeping the
  // original markup — <em>, <br>, links — intact
  function split(el, mode) {
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    let i = 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (!node.textContent.trim()) continue;
      const frag = document.createDocumentFragment();
      for (const part of node.textContent.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) { frag.append(part); continue; }
        const word = document.createElement("span");
        word.className = mode === "type" ? "lv-word" : "lv-w";
        word.setAttribute("aria-hidden", "true");
        if (mode === "type") {
          for (const ch of part) {
            const c = document.createElement("span");
            c.className = "lv-ch";
            c.style.setProperty("--i", i++);
            c.textContent = ch;
            word.append(c);
          }
        } else {
          word.style.setProperty("--i", i++);
          word.textContent = part;
        }
        frag.append(word);
      }
      node.replaceWith(frag);
    }
    return i;
  }

  function typeIn(el) {
    split(el, "type");
    el.classList.add("lv-type");
    const chars = [...el.querySelectorAll(".lv-ch")];
    // one zero-width caret, moved along by the script — it never takes up
    // space, so the line doesn't shift and nothing is left behind
    const caret = document.createElement("span");
    caret.className = "lv-caret";
    caret.setAttribute("aria-hidden", "true");
    return () => {
      let i = 0;
      const timer = setInterval(() => {
        chars[i].classList.add("lv-in");
        chars[i].after(caret);
        if (++i < chars.length) return;
        clearInterval(timer);
        caret.classList.add("lv-blink");
        setTimeout(() => caret.remove(), 1800);
      }, TYPE_MS);
    };
  }

  function flowIn(el) {
    const n = split(el, "flow");
    el.classList.add("lv-flow");
    // long paragraphs speed up so nothing takes more than ~1s to settle
    el.style.setProperty("--lv-step", Math.min(WORD_MS, 1000 / Math.max(n, 1)) + "ms");
    return () => el.classList.add("lv-on");
  }

  function popIn(list) {
    list.classList.add("lv-pop");
    [...list.children].forEach((li, i) => li.style.setProperty("--i", i));
    return () => list.classList.add("lv-on");
  }

  function countUp(el) {
    const raw = el.textContent.trim();
    const target = parseFloat(raw);
    if (isNaN(target)) return () => {};
    const pad = /^0\d/.test(raw) ? raw.length : 0;
    const fmt = (v) => String(Math.round(v)).padStart(pad, "0");
    el.style.minWidth = el.offsetWidth ? el.offsetWidth + "px" : "";
    el.textContent = fmt(0);
    return () => {
      const dur = 1400;
      const t0 = performance.now();
      (function tick(now) {
        const k = Math.min(1, (now - t0) / dur);
        el.textContent = fmt(target * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    };
  }

  const jobs = new Map();
  const add = (sel, make) =>
    document.querySelectorAll(sel).forEach((el) => jobs.set(el, make(el)));

  add(".hero-title, .section-title, .project-title a", typeIn);
  add(".hero-sub, .project-desc, .about-lead", flowIn);
  add(".project-tags", popIn);
  add(".project-index, [data-count]", countUp);

  function start(el) {
    const run = jobs.get(el);
    if (!run) return;
    jobs.delete(el);
    io.unobserve(el);
    // wait for the block's own blur-in reveal to get going
    setTimeout(run, 220);
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) start(e.target);
      }
    },
    { threshold: 0.35, rootMargin: "0px 0px -6% 0px" }
  );
  jobs.forEach((_, el) => io.observe(el));

  // a fast scroll can skip past a block without it ever registering as
  // visible — start anything that is already above the fold
  let queued = false;
  addEventListener("scroll", () => {
    if (queued || !jobs.size) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      jobs.forEach((_, el) => {
        if (el.getBoundingClientRect().top < innerHeight * 0.9) start(el);
      });
    });
  }, { passive: true });

  // glass widgets lean toward the cursor, with a glint that follows it
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const MAX = 7; // degrees
  document
    .querySelectorAll(".project-media, .project-info, .about-lead, .about-facts, .stat, .contact-links")
    .forEach((card) => {
      card.classList.add("lv-tilt");
      let frame = 0;
      card.addEventListener("pointermove", (e) => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const r = card.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width;   // 0..1
          const y = (e.clientY - r.top) / r.height;
          card.style.setProperty("--ry", ((x - 0.5) * 2 * MAX).toFixed(2) + "deg");
          card.style.setProperty("--rx", ((0.5 - y) * 2 * MAX).toFixed(2) + "deg");
          card.style.setProperty("--px", (x - 0.5).toFixed(3));
          card.style.setProperty("--py", (y - 0.5).toFixed(3));
          card.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
          card.style.setProperty("--my", (y * 100).toFixed(1) + "%");
          card.classList.add("is-tilting");
        });
      });
      card.addEventListener("pointerleave", () => {
        cancelAnimationFrame(frame);
        card.classList.remove("is-tilting");
      });
    });
})();
