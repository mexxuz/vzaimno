/* Анимации интерфейса «Взаимно».
   Приёмы взяты как идеи из библиотек Amicro (MIT), React Bits и 21st.dev
   и сделаны заново без React и без их кода — см. miniapp/CREDITS.md.
   Если в системе включено «уменьшить движение», всё это отключается. */
(function () {
  const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const raf = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));

  /* ---------- Искры (Click Spark) ---------- */
  function spark(el, colors = ["#f0508c", "#8b45e8", "#ff9fc2", "#c4a2f5"]) {
    if (!el || reduce()) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const n = 12;
    for (let i = 0; i < n; i++) {
      const s = document.createElement("span");
      s.className = "mx-spark";
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.3;
      const d = r.width * 0.75 + Math.random() * 26;
      s.style.cssText = `left:${cx}px;top:${cy}px;background:${colors[i % colors.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;--rot:${(a * 180) / Math.PI}deg`;
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 700);
    }
    el.classList.remove("mx-beat"); void el.offsetWidth; el.classList.add("mx-beat");
  }

  /* ---------- Тряска (Shake) ---------- */
  function shake(el) {
    if (!el || reduce()) return;
    el.classList.remove("mx-shake"); void el.offsetWidth; el.classList.add("mx-shake");
    setTimeout(() => el.classList.remove("mx-shake"), 500);
  }

  /* ---------- Текст: буквы с пружиной (Split Text) и слова из размытия (Blur Text) ---------- */
  function splitLetters(el) {
    if (!el || reduce() || el.dataset.mxSplit) return;
    el.dataset.mxSplit = "1";
    el.classList.add("mx-split");
    const text = el.textContent;
    el.setAttribute("aria-label", text);
    el.innerHTML = [...text].map((ch, i) => `<span class="mx-letter" aria-hidden="true" style="--i:${i}">${ch === " " ? "&nbsp;" : ch}</span>`).join("");
    paintSplit(el);
  }
  /* Переход «фиолетовый → розовый» идёт через всё выделенное слово,
     хотя буквы и слова анимируются по отдельности: каждой части — свой отрезок */
  function paintSplit(em) {
    const parts = [...em.querySelectorAll(".mx-word, .mx-letter")];
    const total = parts.reduce((n, p) => n + p.textContent.length, 0) || 1;
    let done = 0;
    parts.forEach((p) => {
      // первая треть — чистый фиолетовый, дальше плавно в розовый (как --brand-grad)
      const at = (x) => Math.max(0, (x / total - .35) / .65).toFixed(3);
      p.style.setProperty("--a", at(done));
      done += p.textContent.length;
      p.style.setProperty("--b", at(done));
    });
  }
  function blurWords(el) {
    if (!el || reduce() || el.dataset.mxBlur) return;
    el.dataset.mxBlur = "1";
    el.querySelectorAll("em").forEach((em) => em.classList.add("mx-split"));
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((ch) => {
        if (ch.nodeType === 3) {
          const frag = document.createDocumentFragment();
          ch.textContent.split(/(\s+)/).forEach((w) => {
            if (!w) return;
            if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
            const s = document.createElement("span");
            s.className = "mx-word"; s.style.setProperty("--i", i++); s.textContent = w;
            frag.appendChild(s);
          });
          ch.replaceWith(frag);
        } else if (ch.nodeType === 1) walk(ch);
      });
    };
    walk(el);
    el.querySelectorAll("em.mx-split").forEach(paintSplit);
  }

  /* ---------- Счёт числа (Count Up) ---------- */
  const lastCount = {};
  function countUp(root) {
    root.querySelectorAll("[data-count]").forEach((el) => {
      const key = el.dataset.count, to = +el.textContent;
      const from = lastCount[key];
      lastCount[key] = to;
      if (from === undefined || from === to || reduce()) return;
      const t0 = performance.now(), dur = 600;
      el.classList.add("mx-counting");
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(from + (to - from) * e);
        if (k < 1) requestAnimationFrame(step); else el.classList.remove("mx-counting");
      };
      requestAnimationFrame(step);
    });
  }

  /* ---------- Пульс новых счётчиков в меню (Pulse) ---------- */
  const lastBadge = {};
  function pulseBadges(root) {
    root.querySelectorAll(".tabbar a").forEach((a) => {
      const c = a.querySelector(".counter");
      const key = a.getAttribute("href"), n = c ? parseInt(c.textContent, 10) || 0 : 0;
      if (c && lastBadge[key] !== undefined && n > lastBadge[key] && !reduce()) c.classList.add("mx-pulse");
      lastBadge[key] = n;
    });
  }

  /* ---------- Переезжающая подсветка в переключателях (Rubber Segment) ----------
     Размер и положение подсветки задаются долями ширины (номер кнопки и их число),
     а не замером в пикселях: так она всегда совпадает с кнопкой, даже если шрифт
     догрузился позже или экран повернули. */
  const lastSeg = {};
  function segments(root) {
    root.querySelectorAll(".segmented").forEach((seg, idx) => {
      const btns = [...seg.querySelectorAll(":scope > button")];
      const i = btns.findIndex((b) => b.getAttribute("aria-pressed") === "true");
      if (i < 0) return;
      const key = (seg.id || seg.dataset.actSeg || "seg") + ":" + idx + ":" + location.hash;
      seg.classList.add("mx-seg");
      seg.style.setProperty("--n", btns.length);
      let ind = seg.querySelector(".mx-seg__ind");
      if (!ind) { ind = document.createElement("span"); ind.className = "mx-seg__ind"; seg.prepend(ind); }
      const prev = lastSeg[key];
      if (prev !== undefined && prev !== i && !reduce()) {
        ind.style.transition = "none"; seg.style.setProperty("--i", prev);
        raf(() => { ind.style.transition = ""; seg.style.setProperty("--i", i); });
      } else seg.style.setProperty("--i", i);
      lastSeg[key] = i;
    });
  }

  /* ---------- Появление экрана по очереди (Animated Content) ---------- */
  function enter(root) {
    if (reduce()) return;
    const main = root.querySelector("main");
    if (!main) return;
    [...main.children].slice(0, 8).forEach((ch, i) => {
      ch.style.setProperty("--i", i);
      ch.classList.add("mx-enter");
      setTimeout(() => ch.classList.remove("mx-enter"), 700 + i * 60);
    });
  }

  /* ---------- Удержание для необратимых действий (Hold Button) ---------- */
  const HOLD_MS = 1400;
  document.addEventListener("pointerdown", (e) => {
    const b = e.target.closest("[data-hold]");
    if (!b) return;
    b.classList.add("mx-holding");
    b.style.setProperty("--hold", HOLD_MS + "ms");
    const timer = setTimeout(() => {
      b.classList.remove("mx-holding");
      if (window.TG) TG.haptic("heavy");
      b.dispatchEvent(new CustomEvent("hold-done", { bubbles: true }));
    }, HOLD_MS);
    const stop = () => { clearTimeout(timer); b.classList.remove("mx-holding"); };
    b.addEventListener("pointerup", stop, { once: true });
    b.addEventListener("pointerleave", stop, { once: true });
    b.addEventListener("pointercancel", stop, { once: true });
  });

  /* ---------- Уведомление можно смахнуть (Swipe Toast) ---------- */
  document.addEventListener("pointerdown", (e) => {
    const t = e.target.closest(".toast");
    if (!t) return;
    const x0 = e.clientX;
    const move = (ev) => { t.style.transform = `translateX(calc(-50% + ${ev.clientX - x0}px))`; t.style.opacity = 1 - Math.min(1, Math.abs(ev.clientX - x0) / 160); };
    const up = (ev) => {
      document.removeEventListener("pointermove", move);
      if (Math.abs(ev.clientX - x0) > 80) t.remove(); else { t.style.transform = ""; t.style.opacity = ""; }
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up, { once: true });
  });

  /* ---------- Нажатие на заблокированное поле ввода — встряхнуть ---------- */
  document.addEventListener("click", (e) => {
    const lock = e.target.closest(".composer--locked");
    if (lock) { shake(lock); if (window.TG) TG.haptic("warning"); }
  });

  /* ---------- Вызывается после каждой отрисовки ---------- */
  function afterRender(routeChanged) {
    const app = document.getElementById("app");
    segments(app);
    countUp(app);
    pulseBadges(app);
    if (routeChanged) {
      enter(app);
      const title = app.querySelector(".welcome .t-d1, .feed-title");
      if (title) blurWords(title);
    }
  }

  window.Motion = { spark, shake, splitLetters, blurWords, afterRender };
})();
