/* Кадрирование фотографии перед отправкой.

   Карточка в ленте почти вдвое выше своей ширины, а телефон снимает заметно
   «квадратнее». Если просто залить снимок, края обрежутся сами — и человек
   узнает об этом, только увидев свою анкету. Поэтому выбор кадра отдаём ему:
   он двигает и приближает снимок в рамке и сразу видит, что попадёт в ленту.

   Храним кадр 4:5 — он одинаково хорошо ложится и в карточку ленты (там видна
   средняя часть по ширине), и в анкету, и в плитки симпатий. */
(function () {
  const RATIO = 4 / 5;        // что сохраняем: ширина к высоте
  const FEED = 343 / 672;     // пропорции карточки в ленте
  const OUT_W = 1080;         // сторона готового файла (сервер ужимает до 1600)
  const MIN_SIDE = 480;       // мельче — в карточке будет мыло
  const MAX_ZOOM = 4;

  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ img, url });
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad_image")); };
      img.src = url;
    });
  }

  /* Открывает экран кадрирования. Возвращает готовый файл или null, если человек
     передумал; строку "small" — если снимок слишком мелкий, "bad" — если браузер
     не смог его открыть (битый файл или формат, который телефон не читает). */
  async function open(file, texts) {
    const t = texts || {};
    let data;
    try { data = await loadImage(file); } catch { return "bad"; }
    const { img, url } = data;
    if (Math.min(img.naturalWidth, img.naturalHeight) < MIN_SIDE) {
      URL.revokeObjectURL(url);
      return "small";
    }

    const wrap = document.createElement("div");
    wrap.className = "cropper";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.innerHTML = `
      <header class="cropper__bar">
        <button class="btn btn--ghost btn--sm" data-x="cancel">${t.cancel || "Отмена"}</button>
        <h2 class="cropper__title t-sm">${t.title || "Кадр"}</h2>
        <button class="btn btn--primary btn--sm" data-x="done">${t.done || "Готово"}</button>
      </header>
      <div class="cropper__stage">
        <div class="cropper__frame" style="--feed:${(FEED / RATIO * 100).toFixed(2)}%">
          <img alt="" draggable="false">
          <div class="cropper__feed"><span class="badge badge--glass">${t.feed || "Видно в ленте"}</span></div>
        </div>
      </div>
      <div class="cropper__tools">
        <label class="cropper__zoom">
          <span class="sr-only">${t.zoom || "Приближение"}</span>
          <input class="range" type="range" min="100" max="${MAX_ZOOM * 100}" value="100" step="1">
        </label>
        <p class="cropper__hint t-muted t-sm">${t.hint || ""}</p>
      </div>`;
    document.body.appendChild(wrap);
    document.body.classList.add("is-locked");

    const frame = wrap.querySelector(".cropper__frame");
    const el = wrap.querySelector(".cropper__frame img");
    const zoom = wrap.querySelector("input[type=range]");
    el.src = url;

    const nw = img.naturalWidth, nh = img.naturalHeight;
    let fw = 0, fh = 0, base = 1, scale = 1, tx = 0, ty = 0;

    function measure() {
      const r = frame.getBoundingClientRect();
      fw = r.width; fh = r.height;
      base = Math.max(fw / nw, fh / nh);          // снимок всегда закрывает рамку
      el.style.width = nw + "px";
      el.style.height = nh + "px";
    }
    function paint() {
      const limX = Math.max(0, (nw * scale - fw) / 2);
      const limY = Math.max(0, (nh * scale - fh) / 2);
      tx = clamp(tx, -limX, limX);
      ty = clamp(ty, -limY, limY);
      el.style.transform = `translate(-50%, -50%) translate(${tx}px, ${ty}px) scale(${scale})`;
    }
    function setZoom(z, ox, oy) {
      const next = base * clamp(z, 1, MAX_ZOOM);
      // точка под пальцем (или под курсором) остаётся на месте
      const k = next / scale;
      tx = (tx - (ox || 0)) * k + (ox || 0);
      ty = (ty - (oy || 0)) * k + (oy || 0);
      scale = next;
      zoom.value = Math.round((scale / base) * 100);
      paint();
    }

    measure();
    scale = base;
    paint();
    const onResize = () => { const z = scale / base; measure(); scale = base * z; paint(); };
    window.addEventListener("resize", onResize);

    /* ---- перетаскивание и щипок ---- */
    const points = new Map();
    let startDist = 0, startScale = 1;
    frame.addEventListener("pointerdown", (e) => {
      frame.setPointerCapture(e.pointerId);
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (points.size === 2) {
        const [a, b] = [...points.values()];
        startDist = Math.hypot(a.x - b.x, a.y - b.y);
        startScale = scale;
      }
    });
    frame.addEventListener("pointermove", (e) => {
      if (!points.has(e.pointerId)) return;
      const prev = points.get(e.pointerId);
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (points.size === 1) {
        tx += e.clientX - prev.x;
        ty += e.clientY - prev.y;
        paint();
      } else if (points.size === 2) {
        const [a, b] = [...points.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (startDist) setZoom((startScale / base) * (dist / startDist));
      }
    });
    const drop = (e) => { points.delete(e.pointerId); startDist = 0; };
    frame.addEventListener("pointerup", drop);
    frame.addEventListener("pointercancel", drop);
    frame.addEventListener("wheel", (e) => {
      e.preventDefault();
      const r = frame.getBoundingClientRect();
      setZoom((scale / base) * (e.deltaY < 0 ? 1.12 : 1 / 1.12),
              e.clientX - r.left - fw / 2, e.clientY - r.top - fh / 2);
    }, { passive: false });
    zoom.addEventListener("input", () => setZoom(+zoom.value / 100));

    /* ---- готово ---- */
    function cut() {
      const sw = fw / scale, sh = fh / scale;
      const sx = nw / 2 - tx / scale - sw / 2;
      const sy = nh / 2 - ty / scale - sh / 2;
      const canvas = document.createElement("canvas");
      canvas.width = OUT_W;
      canvas.height = Math.round(OUT_W / RATIO);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9));
    }

    return new Promise((resolve) => {
      const close = (value) => {
        window.removeEventListener("resize", onResize);
        document.removeEventListener("keydown", onKey);
        document.body.classList.remove("is-locked");
        URL.revokeObjectURL(url);
        wrap.remove();
        resolve(value);
      };
      const onKey = (e) => { if (e.key === "Escape") close(null); };
      document.addEventListener("keydown", onKey);
      wrap.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-x]");
        if (!b) return;
        if (b.dataset.x === "cancel") return close(null);
        b.disabled = true;
        const blob = await cut();
        close(blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : null);
      });
    });
  }

  window.Crop = { open, RATIO, FEED };
})();
