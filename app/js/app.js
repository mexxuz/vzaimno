/* «Взаимно» — прототип мини-приложения. Ташкент, русский и узбекский.
   Экраны переключаются по адресу после # (например, #/feed).
   Состояние живёт только в памяти вкладки: прототип не сохраняет на устройстве
   ничего, кроме выбранного языка. Пары — только мужчина и женщина. */
(function () {
  const D = window.DATA;
  const I = window.I;
  const { t } = window.I18N;
  const app = document.getElementById("app");
  // Рабочий режим — внутри Telegram (или ?dev=1 на этом компьютере). ?demo — всегда демо-данные
  const qs = new URLSearchParams(location.search);
  // На витрине (GitHub Pages) сервера нет — там всегда демо-режим
  const SHOWCASE = /github\.io$/.test(location.hostname);
  const LIVE = !qs.has("demo") && !SHOWCASE && window.API && API.hasAuth();

  /* ---------------- Состояние ---------------- */
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const fresh = (gender = "m") => ({
    onboarded: false,
    gender,
    queue: LIVE ? [] : clone(gender === "m" ? D.women : D.men),
    history: [],
    liked: [],
    photoIdx: 0,
    matches: LIVE ? [] : clone(D.matches[gender]),
    chats: LIVE ? [] : clone(D.chats[gender]),
    live: { me: null, incoming: [], cache: {}, pending: {}, picksLeft: 0, known: null, loaded: {} },
    blocked: [],
    plus: false,
    verified: false,
    // проверка селфи: none → (жест) → pending → verified | rejected (с причиной)
    verify: { status: "none", gesture: null, reason: "" },
    revealed: {},
    filters: { ageMin: 22, ageMax: 35, dist: 25, onlyVerified: false, goals: ["family", "serious"] },
    privacy: { pause: false, incognito: false, hideAge: false, hideDist: false, online: true, receipts: true,
      firstMove: "any",                 // кто начинает переписку: any — любой, me — только я
      verifiedOnly: gender === "f" },   // девушек по умолчанию видят только проверенные
    notif: { pairs: true, messages: true, picks: true, meet: true, quiet: true, likes: "digest" },
    inboxDone: [],                      // входящие, на которые уже ответили
    inboxVerified: gender === "f",      // во входящих показывать только проверенных
    setup: { name: "", birth: "", gender: "", goal: "", photos: 0, prompt: D.prompts[0], answer: "", interests: [], geo: "", city: "", work: "",
      files: [], previews: [], coords: null },
    likesTab: "in",
    likesLeft: D.DAILY_LIKES,   // одинаково для всех, Plus не снимает
    feedMode: "picks",           // вечером открываем с подборки дня
    picks: null,                 // id анкет подборки, считаются один раз в день
    near: "both",
    plan: "month",
  });
  let S = fresh();
  // Адрес с ?demo открывает прототип сразу на ленте, без заполнения анкеты
  if (new URLSearchParams(location.search).has("demo")) { S.onboarded = true; S.setup.work = "mirabad"; }

  const ME = () => {
    if (LIVE && S.live.me) return { ...S.live.me };
    const base = { ...D.me[S.gender] }, s = S.setup;
    if (s.name.trim()) base.name = s.name.trim();
    if (s.goal) base.goal = s.goal;
    if (s.interests.length) base.interests = s.interests;
    return base;
  };
  const pool = () => [...D.women, ...D.men, ...D.extraIncoming.f, ...D.extraIncoming.m];

  /* ---------------- Помощники ---------------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const go = (h) => { location.hash = h; };
  const pal = (i) => D.palettes[i % D.palettes.length];
  const photo = (i, cls = "") => {
    if (typeof i === "string") return `<div class="photo photo--img ${cls}" style="background-image:url('${i}')"></div>`;
    const [a, b] = pal(i || 0); return `<div class="photo ${cls}" style="--p1:${a};--p2:${b}"></div>`; };
  const avatar = (p, cls = "", online = false) =>
    `<div class="avatar ${cls}">${photo(p.photos[0])}${online ? '<span class="avatar__online"></span>' : ""}</div>`;
  const vBadge = (g) => `<span class="badge badge--verified">${I.verified}${t("verified", null, g)}</span>`;
  const findProfile = (id) => [...S.queue, ...S.history, ...(LIVE ? [...S.live.incoming, ...Object.values(S.live.cache).filter(Boolean)] : pool())].find((p) => p.id === id);
  const unreadTotal = () => S.chats.reduce((n, c) => n + (c.unread || 0), 0);
  const km = (n) => (typeof n === "string" ? n : "≈ " + (n < 2 ? "< 2 " : n + " ") + t("km"));
  const goal = (k) => t("goal_" + k);
  const interest = (k) => t("i_" + k);
  const promptLabel = (k) => t("pr_" + k);

  /* ---------- Дата рождения: свой выбор «барабанами» вместо календаря браузера ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const ageOf = (iso) => {
    if (!iso) return 0;
    const [y, m, d] = iso.split("-").map(Number), n = new Date();
    return n.getFullYear() - y - (n.getMonth() + 1 < m || (n.getMonth() + 1 === m && n.getDate() < d) ? 1 : 0);
  };
  const yearsWord = (n) => {
    const a = n % 10, b = n % 100;
    return t(a === 1 && b !== 11 ? "age_1" : a >= 2 && a <= 4 && (b < 12 || b > 14) ? "age_2" : "age_5", { n });
  };
  const fmtBirth = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${t("months_gen").split(",")[m - 1]} ${y}`; };
  const daysIn = (y, m) => new Date(y, m, 0).getDate();

  function openBirthPicker(iso, onDone) {
    const H = 44;                                   // высота строки барабана
    const now = new Date(), maxY = now.getFullYear() - 18, minY = now.getFullYear() - 80;
    const [y0, m0, d0] = iso ? iso.split("-").map(Number) : [now.getFullYear() - 25, 1, 1];
    const val = { d: d0, m: m0, y: y0 };
    const years = [];
    for (let v = maxY; v >= minY; v--) years.push(v);
    const items = (list) => list.map((it) => `<div class="wheel__item" data-v="${it.v}">${it.t}</div>`).join("");
    const dayList = () => Array.from({ length: daysIn(val.y, val.m) }, (_, i) => ({ v: i + 1, t: i + 1 }));
    const col = (key, list, label) => `<div class="wheel" data-col="${key}" tabindex="0" role="listbox" aria-label="${label}">${items(list)}</div>`;
    openSheet(`
      <h2 class="t-h">${t("s1_birth")}</h2>
      <p class="t-sm bp-age" id="bp-age"></p>
      <div class="wheels">
        <div class="wheels__band" aria-hidden="true"></div>
        ${col("d", dayList(), t("bp_day"))}
        ${col("m", t("months").split(",").map((x, i) => ({ v: i + 1, t: x })), t("bp_month"))}
        ${col("y", years.map((v) => ({ v, t: v })), t("bp_year"))}
      </div>
      <p class="field__hint field__error" id="bp-err" hidden>${t("s1_err")}</p>
      <p class="field__hint">${t("s1_hint")}</p>
      <button class="btn btn--primary btn--block" id="bp-done" style="margin-top:16px">${t("done")}</button>`,
      (sh) => {
        const cols = { d: sh.querySelector('[data-col="d"]'), m: sh.querySelector('[data-col="m"]'), y: sh.querySelector('[data-col="y"]') };
        const out = () => `${val.y}-${pad(val.m)}-${pad(val.d)}`;
        const list = (k) => [...cols[k].querySelectorAll(".wheel__item")];
        const update = () => {
          const a = ageOf(out()), bad = a < 18;
          sh.querySelector("#bp-age").innerHTML = t("bp_age", { a: `<b>${yearsWord(a)}</b>` });
          sh.querySelector("#bp-err").hidden = !bad;
          sh.querySelector("#bp-done").disabled = bad;
          Object.keys(cols).forEach((k) => list(k).forEach((it) => it.classList.toggle("is-on", +it.dataset.v === val[k])));
        };
        const scrollTo = (k, smooth) => {
          const i = Math.max(0, list(k).findIndex((it) => +it.dataset.v === val[k]));
          cols[k].scrollTo({ top: i * H, behavior: smooth ? "smooth" : "auto" });
        };
        const rebuildDays = () => {                  // в феврале и коротких месяцах — меньше дней
          const max = daysIn(val.y, val.m);
          if (val.d > max) val.d = max;
          if (list("d").length !== max) { cols.d.innerHTML = items(dayList()); scrollTo("d"); }
        };
        Object.entries(cols).forEach(([k, c]) => {
          let timer;
          c.addEventListener("scroll", () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
              const all = list(k), i = Math.min(all.length - 1, Math.max(0, Math.round(c.scrollTop / H)));
              const v = +all[i].dataset.v;
              if (v !== val[k]) { val[k] = v; TG.haptic("select"); if (k !== "d") rebuildDays(); }
              update();
            }, 90);
          }, { passive: true });
          c.addEventListener("click", (e) => {
            const it = e.target.closest(".wheel__item");
            if (it) { val[k] = +it.dataset.v; if (k !== "d") rebuildDays(); scrollTo(k, true); update(); }
          });
          c.addEventListener("keydown", (e) => {
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
            e.preventDefault();
            const all = list(k), i = all.findIndex((it) => +it.dataset.v === val[k]);
            const j = Math.min(all.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)));
            val[k] = +all[j].dataset.v; if (k !== "d") rebuildDays(); scrollTo(k, true); update();
          });
        });
        requestAnimationFrame(() => { Object.keys(cols).forEach((k) => scrollTo(k)); update(); });
        sh.querySelector("#bp-done").onclick = () => { closeSheet(); onDone(out()); };
      });
  }

  // action = { label, act } — кнопка прямо в сообщении (например, «Вернуть» после «дальше»)
  function toast(text, action) {
    document.querySelectorAll(".toast").forEach((x) => x.remove());
    const el = document.createElement("div");
    el.className = "toast" + (action ? " toast--action" : "");
    el.setAttribute("role", "status");
    el.textContent = text;
    if (action) {
      const b = document.createElement("button");
      b.className = "toast__btn"; b.dataset.act = action.act; b.textContent = action.label;
      b.addEventListener("click", () => el.remove());
      el.appendChild(b);
    }
    document.body.appendChild(el);
    setTimeout(() => el.remove(), action ? 4500 : 2800);
  }

  function openSheet(html, mount) {
    closeSheet();
    const wrap = document.createElement("div");
    wrap.id = "sheet";
    wrap.innerHTML = `<div class="scrim" data-act="closeSheet"></div>
      <div class="sheet" role="dialog" aria-modal="true"><div class="sheet__grip"></div>${html}</div>`;
    document.body.appendChild(wrap);
    const first = wrap.querySelector(".sheet button, .sheet input, .sheet textarea");
    first && first.focus({ preventScroll: true });
    mount && mount(wrap.querySelector(".sheet"));
  }
  function closeSheet() { const s = document.getElementById("sheet"); s && s.remove(); }

  const topbar = (title, { back = true, right = "", display = false } = {}) => `
    <header class="topbar ${back ? "topbar--back" : ""}">
      ${back ? `<button class="icon-btn" data-act="back" aria-label="${t("back")}">${I.left}</button>` : ""}
      <h1 class="topbar__title ${display ? "t-d1" : ""}">${title}</h1>${right}
    </header>`;

  const sub = (s) => (s ? `<span class="row__sub" style="display:block">${s}</span>` : "");
  const switchRow = (key, title, subText, { icon = "", badge = "" } = {}) => `
    <label class="row">
      ${icon ? `<span class="row__icon">${icon}</span>` : ""}
      <span class="row__body"><span class="row__title">${title} ${badge}</span>${sub(subText)}</span>
      <span class="switch"><input type="checkbox" data-priv="${key}" ${S.privacy[key] ? "checked" : ""}><span class="switch__track"></span></span>
    </label>`;
  const linkRow = (href, icon, title, subText = "") => `
    <a class="row" href="${href}"><span class="row__icon">${icon}</span>
      <span class="row__body"><span class="row__title">${title}</span>${sub(subText)}</span><span class="row__chev">${I.right}</span></a>`;
  const actRow = (act, icon, title, subText = "", iconMod = "", arg = "") => `
    <button class="row" data-act="${act}" ${arg ? `data-arg="${esc(arg)}"` : ""}>
      <span class="row__icon ${iconMod}">${icon}</span>
      <span class="row__body"><span class="row__title">${title}</span>${sub(subText)}</span></button>`;
  const infoRow = (icon, title, subText = "") => `
    <div class="row"><span class="row__icon row__icon--safe">${icon}</span><span class="row__body"><span class="row__title">${title}</span>${sub(subText)}</span></div>`;
  const langSwitch = () => !I18N.multi ? "" : `
    <div class="segmented lang-switch" data-act-seg="lang" role="group" aria-label="${t("lang")}">
      <button aria-pressed="${I18N.lang === "ru"}" data-val="ru">${t("lang_ru")}</button>
      <button aria-pressed="${I18N.lang === "uz"}" data-val="uz">${t("lang_uz")}</button>
    </div>`;

  /* ================================================================
     ЭКРАНЫ
     ================================================================ */

  function vWelcome() {
    const link = (arg, text) => `<a href="#" data-act="doc" data-arg="${arg}">${text}</a>`;
    return {
      html: `
      <main class="screen welcome">
        <div class="welcome__top"><div class="logo">${I.lens()}${t("brand")}</div>${langSwitch()}</div>
        <div class="welcome__hero" aria-hidden="true">
          <div class="ribbon ribbon--a"><span>${(t("ribbon") + " ♥ " + t("ribbon_city") + " ♥ ").repeat(5)}</span></div>
          <div class="ribbon ribbon--b"><span>${(t("ribbon") + " ♥ " + t("ribbon_city") + " ♥ ").repeat(5)}</span></div>
          <div class="welcome__badge">${I.lens("lens-mark welcome__lens")}</div>
        </div>
        <h1 class="t-d1">${t("w_title")}</h1>
        <p class="t-muted welcome__lead">${t("w_lead")}</p>
        <ul class="trust">
          <li><span class="row__icon row__icon--safe">${I.heart}</span><span><b>${t("w_t4_b")}</b> ${t("w_t4")}</span></li>
          <li><span class="row__icon row__icon--safe">${I.lock}</span><span><b>${t("w_t1_b")}</b> ${t("w_t1")}</span></li>
          <li><span class="row__icon row__icon--safe">${I.pin}</span><span><b>${t("w_t2_b")}</b> ${t("w_t2")}</span></li>
          <li><span class="row__icon row__icon--safe">${I.eyeOff}</span><span><b>${t("w_t3_b")}</b> ${t("w_t3")}</span></li>
        </ul>
        <div class="consents">
          <label class="check"><input type="checkbox" id="c-age"><span>${t("w_age")}</span></label>
          <label class="check"><input type="checkbox" id="c-rules"><span>${t("w_rules", { rules: link("rules", t("rules_link")), pd: link("privacy", t("pd_link")) })}</span></label>
        </div>
        <button class="btn btn--primary btn--block btn--go" id="start" disabled><span>${t("w_start")}</span><span class="btn__arrow">${I.right}</span></button>
      </main>`,
      mount() {
        const a = document.getElementById("c-age"), r = document.getElementById("c-rules"), b = document.getElementById("start");
        const upd = () => { b.disabled = !(a.checked && r.checked); };
        a.onchange = r.onchange = upd;
        b.onclick = () => go("#/setup/1");
      },
    };
  }

  /* ---------- Создание анкеты: 5 шагов ---------- */
  const STEPS = 5;   // имя+дата+пол · цель · фото · о себе · где искать
  // Заполнен ли шаг. Нужна, чтобы нельзя было попасть на шаг дальше, чем заполнено:
  // после перезагрузки страницы введённое пропадает, а адрес шага остаётся
  function stepDone(k) {
    const s = S.setup;
    if (k === 1) return !!(s.name.trim() && s.birth && ageOf(s.birth) >= 18 && (s.gender === "f" || s.gender === "m"));
    if (k === 2) return !!s.goal;
    if (k === 3) return (LIVE ? s.files.length : s.photos) > 0;
    if (k === 4) return s.interests.length >= 3;
    return true;
  }
  function vSetup(n) {
    n = Math.min(Math.max(+n, 1), STEPS);
    for (let k = 1; k < n; k++) if (!stepDone(k)) { history.replaceState(null, "", `#/setup/${k}`); n = k; break; }
    const s = S.setup;
    let body = "", ok = true;
    const option = (act, val, title, subText, checked) => `
      <button class="option" role="radio" aria-checked="${checked}" data-act="${act}" data-arg="${val}">
        <span><b>${title}</b><span class="t-sm t-muted">${subText}</span></span><span class="option__dot"></span></button>`;

    if (n === 1) {
      body = `
        <h1 class="t-d1">${t("s1_title")}</h1>
        <div class="field"><label class="field__label" for="f-name">${t("s1_name")}</label>
          <input class="input" id="f-name" maxlength="30" autocomplete="given-name" value="${esc(s.name)}" placeholder="${t("s1_name_ph")}"></div>
        <div class="field"><span class="field__label" id="l-birth">${t("s1_birth")}</span>
          <button type="button" class="input date-field ${s.birth ? "" : "is-empty"}" id="f-birth" aria-labelledby="l-birth">
            <span class="date-field__value">${s.birth ? fmtBirth(s.birth) : t("bp_ph")}</span>
            ${s.birth ? `<span class="date-field__age">${yearsWord(ageOf(s.birth))}</span>` : ""}
            ${I.calendar}
          </button>
          <span class="field__hint">${t("s1_hint")}</span>
          <span class="field__hint field__error" id="f-err" hidden>${t("s1_err")}</span></div>
        <div class="field"><span class="field__label">${t("s2_i_am")}</span>
          <div class="gender-pick" id="f-gender" role="radiogroup">
            <button type="button" class="gender-pick__opt gender-pick__opt--f" role="radio" aria-checked="${s.gender === "f"}" data-val="f"><span class="gender-pick__icon">${I.female}</span>${t("female")}</button>
            <button type="button" class="gender-pick__opt gender-pick__opt--m" role="radio" aria-checked="${s.gender === "m"}" data-val="m"><span class="gender-pick__icon">${I.male}</span>${t("male")}</button></div>
          ${s.gender ? `<span class="field__hint">${s.gender === "f" ? t("s2_hint_f_safe") : t("s2_hint_m")}</span>` : ""}</div>`;
    } else if (n === 2) {
      ok = !!s.goal;
      body = `
        <h1 class="t-d1">${t("s3_title")}</h1>
        <p class="t-muted">${t("s3_lead")}</p>
        <div class="options" role="radiogroup">${D.goals.map((g) => option("setGoal", g, goal(g), t("goal_" + g + "_sub"), s.goal === g)).join("")}</div>`;
    } else if (n === 3) {
      const count = LIVE ? s.files.length : s.photos;
      ok = count > 0;
      body = `
        <h1 class="t-d1">${t("s4_title")}</h1>
        <p class="t-muted">${t("s4_lead")}</p>
        <div class="photo-grid">
          ${Array.from({ length: 6 }, (_, i) => i < count
            ? `<div class="photo-slot is-filled">${LIVE ? photo(s.previews[i]) : photo(i + 3)}<button class="photo-slot__del" data-act="delPhoto" data-arg="${i}" aria-label="${t("del_photo")}">${I.x}</button>${i === 0 ? `<span class="badge badge--glass photo-slot__main">${t("photo_main")}</span>` : ""}</div>`
            : `<button class="photo-slot" data-act="addPhoto" aria-label="${t("add_photo")}">${I.plus}</button>`).join("")}
        </div>
        <input type="file" id="photo-input" accept="image/*" multiple hidden>
        <div class="group">${switchRow("incognito", t("s4_incog"), t("s4_incog_sub"), { icon: I.eyeOff })}</div>
        <div class="notice notice--safe">${I.shieldCheck}<span>${t("s4_notice")}</span></div>`;
    } else if (n === 4) {
      ok = s.interests.length >= 3;
      body = `
        <h1 class="t-d1">${t("s5_title")}</h1>
        <p class="t-muted">${t("s5_lead")}</p>
        <div class="field"><label class="field__label" for="f-prompt">${t("s5_prompt")}</label>
          <select class="select" id="f-prompt">${D.prompts.map((p) => `<option value="${p}" ${p === s.prompt ? "selected" : ""}>${promptLabel(p)}</option>`).join("")}</select></div>
        <div class="field"><label class="field__label" for="f-answer">${t("s5_answer")}</label>
          <textarea class="textarea" id="f-answer" maxlength="150" placeholder="${t("s5_ph")}">${esc(s.answer)}</textarea>
          <span class="field__hint">${t("s5_hint")}</span></div>
        <div class="field"><span class="field__label">${t("s6_title")}</span>
          <span class="field__hint">${t("s6_lead")}</span></div>
        <div class="chips">${D.interestsAll.map((x) => `<button class="chip" data-act="toggleInterest" data-arg="${x}" aria-pressed="${s.interests.includes(x)}">${interest(x)}</button>`).join("")}</div>
        <p class="t-sm t-muted" aria-live="polite">${t("s6_count", { n: s.interests.length })}</p>`;
    } else if (n === 5) {
      ok = s.geo === "gps" || (s.geo === "city" && s.city.trim().length > 1);
      body = `
        <h1 class="t-d1">${t("s7_title")}</h1>
        <div class="options" role="radiogroup">
          ${option("setGeo", "gps", t("s7_gps"), t("s7_gps_sub"), s.geo === "gps")}
          ${option("setGeo", "city", t("s7_city"), t("s7_city_sub"), s.geo === "city")}
        </div>
        ${s.geo === "city" ? `<div class="field"><label class="field__label" for="f-city">${t("s7_city_label")}</label><input class="input" id="f-city" value="${esc(s.city)}" placeholder="${t("s7_city_ph")}"></div>` : ""}
        <div class="notice notice--safe">${I.pin}<span>${t("s7_notice")}</span></div>
        <div class="field"><label class="field__label" for="f-work">${t("s7_work")}</label>
          <select class="select" id="f-work"><option value="">${t("s7_work_none")}</option>
            ${D.districts.map((d) => `<option value="${d}" ${s.work === d ? "selected" : ""}>${t("dist_" + d)}</option>`).join("")}</select>
          <span class="field__hint">${t("s7_work_hint")}</span></div>`;
    }

    return {
      html: `
      <main class="screen setup">
        <header class="setup__head">
          <button class="icon-btn" data-act="back" aria-label="${t("back")}">${I.left}</button>
          <div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="${STEPS}" aria-valuenow="${n}" aria-label="${t("step_of", { n, total: STEPS })}"><span style="width:${(n / STEPS) * 100}%"></span></div>
          <span class="t-xs t-muted">${n}/${STEPS}</span>
        </header>
        <div class="setup__body">${body}</div>
        <div class="setup__foot"><button class="btn btn--primary btn--block" id="next" ${ok ? "" : "disabled"}>${n === STEPS ? t("done") : t("next")}</button></div>
      </main>`,
      mount() {
        const next = document.getElementById("next");
        if (n === 1) {
          const nm = document.getElementById("f-name"), bd = document.getElementById("f-birth"), err = document.getElementById("f-err");
          const check = () => {
            s.name = nm.value;
            const age = ageOf(s.birth);
            const was = err.hidden;
            err.hidden = !s.birth || age >= 18;
            if (was && !err.hidden && window.Motion) Motion.shake(bd);
            next.disabled = !(s.name.trim() && s.birth && age >= 18 && s.gender);
          };
          nm.oninput = check;
          bd.onclick = () => openBirthPicker(s.birth, (iso) => { s.birth = iso; render(); });
          check();
        }
        if (n === 1) document.getElementById("f-gender").onclick = (e) => {
          const b = e.target.closest("button"); if (!b || s.gender === b.dataset.val) return;
          s.gender = b.dataset.val;
          // Смена темы — плавным перетеканием, а не миганием
          const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
          if (document.startViewTransition && !calm) document.startViewTransition(render); else render();
        };
        if (n === 4) {
          document.getElementById("f-prompt").onchange = (e) => { s.prompt = e.target.value; };
          document.getElementById("f-answer").oninput = (e) => { s.answer = e.target.value; };
        }
        const pi = document.getElementById("photo-input");
        if (pi) pi.onchange = () => {
          for (const f of pi.files) if (s.files.length < 6) { s.files.push(f); s.previews.push(URL.createObjectURL(f)); }
          render();
        };
        if (n === 5) document.getElementById("f-work").onchange = (e) => { s.work = e.target.value; };
        if (n === 5 && s.geo === "city") {
          const c = document.getElementById("f-city");
          c.oninput = () => { s.city = c.value; next.disabled = c.value.trim().length < 2; };
        }
        next.onclick = () => {
          if (n < STEPS) return go(`#/setup/${n + 1}`);
          if (LIVE) { next.disabled = true; next.textContent = t("live_uploading"); return L.createProfile(); }
          // Лента и чаты — людей противоположного пола
          const keep = { setup: S.setup, privacy: { ...S.privacy, verifiedOnly: s.gender === "f" } };
          S = { ...fresh(s.gender), ...keep, onboarded: true };
          TG.haptic("success");
          go("#/feed");
          toast(t("setup_done"));
        };
      },
    };
  }

  /* ---------- Лента ---------- */
  function cardHTML(p, top) {
    const picksLeft = LIVE ? S.live.picksLeft : picksQueue().length;
    const idx = top ? Math.min(S.photoIdx, p.photos.length - 1) : 0;
    const pr = p.prompts[0];
    return `
      <article class="card ${top ? "" : "card--next"}" ${top ? 'id="top-card"' : 'aria-hidden="true"'}>
        ${photo(p.photos[idx])}
        <div class="card__bars">${p.photos.map((_, i) => `<span class="${i === idx ? "is-on" : ""}"></span>`).join("")}</div>
        ${top ? `<button class="card__tap card__tap--prev" data-act="photoPrev" aria-label="${t("prev_photo")}"></button>
                 <button class="card__tap card__tap--next" data-act="photoNext" aria-label="${t("next_photo")}"></button>` : ""}
        <div class="card__top">${top && S.feedMode === "picks" && picksLeft ? `<span class="badge badge--glass badge--picks" title="${t("picks_note")}">${I.sparkle}${t("picks_title")} · ${picksLeft}</span>` : ""}${p.isDemo ? `<span class="badge badge--glass">${t("demo_badge")}</span>` : ""}${nearWork(p) ? `<span class="badge badge--glass">${I.briefcase}${t("near_work_short")}</span>` : ""}${p.online ? `<span class="badge badge--glass"><i class="dot"></i>${t("online")}</span>` : ""}</div>
        <div class="stamp stamp--like">${t("stamp_like")}</div><div class="stamp stamp--pass">${t("stamp_pass")}</div>
        <div class="card__info">
          <div class="card__name" ${top ? `data-act="openProfile" data-arg="${p.id}" role="button" tabindex="0" aria-label="${t("open_full")}"` : ""}><h2 class="t-d2">${esc(p.name)}</h2><span class="t-d2" style="font-weight:400;opacity:.85">${p.age}</span>${p.verified ? `<span class="card__check" title="${t("verified", null, p.g)}" aria-label="${t("verified", null, p.g)}">${I.verified}</span>` : ""}</div>
          <div class="card__meta">${p.km != null ? `<span>${I.pin}${km(p.km)}</span>` : ""}<span>${I.target}${goal(p.goal)}</span></div>
          ${top && S.feedMode === "picks" ? `<div class="card__why">${I.sparkle}<span>${whyOf(p).slice(0, 3).join(" · ")}</span></div>` : ""}
        </div>
      </article>`;
  }

  const visibleQueue = () => S.queue.filter((p) => !S.blocked.includes(p.id) && (!S.filters.onlyVerified || p.verified));

  /* Подборка дня: насколько анкета подходит и почему — причины показываем человеку.
     Тот же расчёт на сервере: server/app/matching/picks.py */
  function score(p) {
    const me = ME(), why = [];
    let sc = 0;
    if (p.goal === me.goal) { sc += 3; why.push(t("why_goal")); }
    const shared = p.interests.filter((x) => me.interests.includes(x)).length;
    if (shared) { sc += Math.min(shared, 3); why.push(t("why_interests", { n: shared })); }
    if (Math.abs(p.age - me.age) <= 4) { sc += 1; why.push(t("why_age")); }
    if (S.setup.work && p.work === S.setup.work) { sc += 2; why.push(t("why_work")); }
    if (p.verified) { sc += 1; why.push(t("why_verified", null, p.g)); }
    return { sc, why };
  }
  const whyOf = (p) => (p.why
    ? p.why.map((k) => (k.startsWith("interests:") ? t("why_interests", { n: k.split(":")[1] })
      : k === "verified" ? t("why_verified", null, p.g) : t("why_" + k)))
    : score(p).why);
  function picksQueue() {
    if (!S.picks) S.picks = visibleQueue().map((p) => ({ id: p.id, sc: score(p).sc })).sort((a, b) => b.sc - a.sc).slice(0, D.PICKS).map((x) => x.id);
    return visibleQueue().filter((p) => S.picks.includes(p.id)).sort((a, b) => S.picks.indexOf(a.id) - S.picks.indexOf(b.id));
  }
  /* Входящие: кто отметил меня. Решение за мной, на «нет» человек ничего не узнаёт */
  const incomingAll = () => LIVE ? S.live.incoming.filter((p) => !S.inboxDone.includes(p.id)) : [...(S.gender === "m" ? D.women : D.men).filter((p) => p.likedMe), ...D.extraIncoming[S.gender]]
    .filter((p) => !S.inboxDone.includes(p.id) && !S.blocked.includes(p.id) && !S.chats.some((c) => c.profileId === p.id))
    .sort((a, b) => score(b).sc - score(a).sc);
  const incoming = () => incomingAll().filter((p) => !S.inboxVerified || p.verified);
  const isIncoming = (id) => incomingAll().some((p) => p.id === id);

  function acceptIncoming(p) {
    if (LIVE) return L.decide(p, "yes");
    S.inboxDone.push(p.id);
    const chatId = "c-" + p.id;
    if (!S.chats.find((c) => c.id === chatId)) {
      S.chats.unshift({ id: chatId, g: p.g, name: p.name, age: p.age, photos: p.photos, verified: p.verified, online: p.online, unread: 0,
        profileId: p.id, expires: 7, messages: p.note ? [{ from: "them", text: p.note, time: "18:00" }] : [] });
    }
    showMatch(p, null, true);
  }

  /* Состояние переписки: кто и что может отправить */
  function chatState(c) {
    const mine = c.messages.filter((m) => m.from === "me").length;
    const theirs = c.messages.filter((m) => m.from === "them").length;
    if (!c.messages.length && c.herFirst) return "herFirst";
    if (!c.messages.length && S.gender === "f" && S.privacy.firstMove === "me") return "meFirst";
    if (!c.messages.length) return "empty";
    if (mine && !theirs) return "waitReply";
    if (theirs && !mine) return "pending";
    return "open";
  }

  // Через сколько обновятся симпатии: новые — в полночь по Ташкенту (UTC+5)
  function resetIn() {
    const now = Date.now(), tz = 5 * 3600e3;
    const next = Math.floor((now + tz) / 86400e3 + 1) * 86400e3 - tz;
    const min = Math.ceil((next - now) / 60e3);
    return min >= 60 ? t("in_hours", { n: Math.floor(min / 60) }) : t("in_minutes", { n: min });
  }
  const currentQueue = () => (LIVE ? S.queue : S.feedMode === "picks" ? picksQueue() : visibleQueue());
  const nearWork = (p) => p.nearWork ?? (S.setup.work && p.work === S.setup.work);

  function vFeed() {
    const q = currentQueue();
    const picksLeft = LIVE ? S.live.picksLeft : picksQueue().length;
    const sub = "";   // всё управление лентой — в одной строке шапки, чтобы фото досталось больше места
    const bindMode = () => {};
    // Шапки нет: фото начинается от самого верха. Что было в шапке, живёт на своих местах:
    // «Подборка дня · N» — метка на фото, остаток симпатий — цифра на сердце, фильтры — в правом вырезе.
    const head = `<h1 class="sr-only">${S.feedMode === "picks" ? t("picks_title") : t("mode_all")}</h1>`;
    const filtersBtn = `<button class="action action--sm" data-act="goto" data-arg="#/filters" aria-label="${t("filters_btn")}">${I.sliders}</button>`;
    if (S.privacy.pause) {
      return { html: `${head}<main class="screen"><div class="empty">${I.lens()}<h2 class="t-h">${t("paused_title")}</h2>
        <p class="t-muted t-sm">${t("paused_text")}</p>
        <button class="btn btn--primary" data-act="unpause">${t("unpause")}</button></div></main>` };
    }
    if (!q.length && S.feedMode === "picks") {
      // Подборка кончилась — карточка-переход прямо в колоде, дальше та же лента со всеми анкетами
      return { html: `${head}<main class="screen feed"><div class="deck"><article class="card card--break">
        ${I.lens("lens-mark card--break__mark")}
        <h2 class="t-d2">${t("picks_done_title")}</h2>
        <p>${t("picks_done_text")}</p>
        <button class="btn btn--primary btn--block" data-act="feedAll">${t("picks_continue")}</button>
      </article></div></main>` };
    }
    if (!q.length) {
      return { mount: bindMode, html: `${head}<main class="screen">${sub}<div class="empty">${I.lens()}<h2 class="t-h">${t("empty_feed_title")}</h2>
        <p class="t-muted t-sm">${t("empty_feed_text")}</p>
        <button class="btn btn--secondary" data-act="goto" data-arg="#/filters">${t("change_filters")}</button>
        <button class="btn btn--ghost" data-act="resetDeck">${t("reset_deck")}</button></div></main>` };
    }
    return {
      html: `${head}
      <main class="screen feed">
        ${modBanner()}
        ${sub}
        <div class="deck">${q[1] ? cardHTML(q[1], false) : ""}${cardHTML(q[0], true)}
          <!-- кнопки в вырезах карточки, как на референсе.
               Справа сверху — про этого человека: написать с симпатией, открыть анкету целиком.
               Снизу — только решение: «дальше» и «нравится»; кнопки наполовину свисают ниже карточки.
               «Вернуть» не висит всегда — появляется в сообщении сразу после «дальше». -->
          <div class="deck-notch deck-notch--side">
            ${filtersBtn}
            <button class="action action--sm action--super ${S.likesLeft > 0 ? "" : "action--spent"}" data-act="note" aria-label="${t("note_aria")}">${I.chatHeart}</button>
            <button class="action action--sm" data-act="openProfile" data-arg="${q[0].id}" aria-label="${t("open_full")}">${I.idCard}</button>
          </div>
          <div class="deck-notch deck-notch--bottom">
            <button class="action action--pass" data-act="pass" aria-label="${t("stamp_pass")}">${I.x}</button>
            ${S.likesLeft > 0
              ? `<button class="action action--like" data-act="like" aria-label="${t("like_aria")}. ${t("likes_left", { n: S.likesLeft, max: D.DAILY_LIKES })}">${I.heartFill}<span class="action__count" data-count="likes">${S.likesLeft}</span></button>`
              // симпатии кончились: сердце серое, вместо цифры — через сколько вернутся
              : `<button class="action action--like action--spent" data-act="like" aria-label="${t("likes_spent_aria", { t: resetIn() })}">${I.heartFill}<span class="action__count">${resetIn()}</span></button>`}
          </div>
        </div>
      </main>`,
      mount() { bindMode(); mountSwipe(); },
    };
  }

  function mountSwipe() {
    const card = document.getElementById("top-card");
    if (!card) return;
    const likeS = card.querySelector(".stamp--like"), passS = card.querySelector(".stamp--pass");
    let x0 = 0, y0 = 0, dx = 0, dy = 0, down = false, dragging = false;

    card.addEventListener("pointerdown", (e) => { down = true; dragging = false; x0 = e.clientX; y0 = e.clientY; dx = dy = 0; });
    card.addEventListener("pointermove", (e) => {
      if (!down) return;
      dx = e.clientX - x0; dy = e.clientY - y0;
      if (!dragging && Math.hypot(dx, dy) > 8) { dragging = true; card.setPointerCapture(e.pointerId); card.style.transition = "none"; }
      if (!dragging) return;
      card.style.transform = `translate(${dx}px, ${dy * 0.3}px) rotate(${dx / 18}deg)`;
      likeS.style.opacity = Math.max(0, Math.min(1, dx / 90));
      passS.style.opacity = Math.max(0, Math.min(1, -dx / 90));
    });
    const end = () => {
      if (!down) return; down = false;
      if (!dragging) return;
      if (Math.abs(dx) > 110) decide(dx > 0 ? "like" : "pass");
      else {
        card.style.transition = "transform var(--dur-slow) var(--ease-spring)";
        card.style.transform = ""; likeS.style.opacity = passS.style.opacity = 0;
      }
    };
    card.addEventListener("pointerup", end);
    card.addEventListener("pointercancel", end);
    // Клик после перетаскивания не должен листать фото
    card.addEventListener("click", (e) => { if (dragging) { e.stopPropagation(); e.preventDefault(); } }, true);
  }

  function decide(kind, note) {
    const p = currentQueue()[0];
    if (!p) return;
    if (kind === "like" && S.likesLeft <= 0) return limitSheet();
    const card = document.getElementById("top-card");
    TG.haptic(kind === "like" ? "medium" : "light");
    if (kind === "like" && window.Motion) Motion.spark(document.querySelector(".action--like"));
    const finish = () => {
      S.queue = S.queue.filter((x) => x.id !== p.id);
      S.history.push(p);
      S.photoIdx = 0;
      if (LIVE) return L.swipe(p, kind, note);
      if (kind === "like") {
        S.likesLeft -= 1;
        S.liked.push(p.id);
        if (p.likedMe) return showMatch(p, note);
        if (note) toast(t("note_sent", { name: p.name }));
      }
      // «Вернуть» появляется ровно тогда, когда может понадобиться, — сразу после «дальше»
      if (kind === "pass") toast(t("passed_toast", { name: p.name }, p.g), { label: t("undo_btn"), act: "undo" });
      if (location.hash === "#/feed") render(); else go("#/feed");
    };
    if (!card || location.hash !== "#/feed") return finish();
    const dir = kind === "like" ? 1 : -1;
    card.querySelector(kind === "like" ? ".stamp--like" : ".stamp--pass").style.opacity = 1;
    card.style.transition = "transform 320ms var(--ease-out), opacity 320ms";
    card.style.transform = `translate(${dir * 140}%, 30px) rotate(${dir * 22}deg)`;
    card.style.opacity = "0";
    setTimeout(finish, 260);
  }

  /* ---------- Совпадение: момент «Взаимно» ---------- */
  function showMatch(p, note, fromInbox, liveChatId) {
    const chatId = liveChatId || "c-" + p.id;
    if (!LIVE && !S.chats.find((c) => c.id === chatId)) {
      S.chats.unshift({ id: chatId, g: p.g, name: p.name, age: p.age, photos: p.photos, verified: p.verified, online: p.online, unread: 0, profileId: p.id,
        messages: note ? [{ from: "me", text: note, time: new Date().toTimeString().slice(0, 5) }] : [] });
    }
    TG.haptic("success");
    const el = document.createElement("div");
    el.className = "match";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", t("match_aria"));
    el.innerHTML = `
      <div class="match__pair" aria-hidden="true">
        <div class="match__ph match__ph--a">${photo((ME().photos || [])[0])}</div>
        <div class="match__ph match__ph--b">${photo((p.photos || [])[0])}</div>
        <span class="match__heart">${I.heartFill}</span>
      </div>
      <p class="t-hero match__word"><em>${t("match_word")}!</em></p>
      <p class="match__sub">${fromInbox ? (p.note ? t("match_inbox_note", { name: esc(p.name) }, p.g) : t("match_inbox")) : t("match_sub", { name: esc(p.name) }, p.g)}</p>
      <div class="match__btns">
        <button class="btn btn--like btn--block" data-act="matchChat" data-arg="${chatId}">${t("match_write")}</button>
        <button class="btn btn--block match__later" data-act="matchClose">${t("match_later")}</button>
      </div>`;
    document.querySelector(".match")?.remove();
    document.body.appendChild(el);
    window.Motion && Motion.splitLetters(el.querySelector(".match__word em"));
    el.querySelector(".btn").focus({ preventScroll: true });
    render();
  }

  /* ---------- Анкета целиком ---------- */
  function vProfile(id) {
    const isMe = id === "me";
    const me = ME();
    const p = isMe ? { ...me, id: "me", g: S.gender, verified: S.verified } : findProfile(id);
    if (!p && LIVE && S.live.cache[id] === undefined) { L.profile(id); return vLoading(); }
    if (!p) return vNotFound();
    const shared = isMe ? [] : p.interests.filter((x) => me.interests.includes(x));
    const top = currentQueue()[0];
    const inQueue = !!top && top.id === p.id;
    const blocks = [];
    p.photos.forEach((ph, i) => {
      blocks.push(`<div class="pv__photo">${photo(ph)}</div>`);
      if (p.prompts[i]) blocks.push(`<div class="pv__prompt"><span class="t-label">${promptLabel(p.prompts[i][0])}</span><p class="t-h">${esc(p.prompts[i][1])}</p></div>`);
      if (i === 0) blocks.push(`
        <div class="pv__facts">
          <span class="chip chip--static">${I.target}${goal(p.goal)}</span>
          ${p.height ? `<span class="chip chip--static">${I.ruler}${p.height} ${t("cm")}</span>` : ""}
          ${p.job ? `<span class="chip chip--static">${esc(p.job)}</span>` : ""}
          ${!isMe && p.km ? `<span class="chip chip--static">${I.pin}${km(p.km)}</span>` : ""}
        </div>`);
    });
    return {
      html: `
      ${topbar(isMe ? t("pv_me_title") : "", { right: isMe ? "" : `<button class="icon-btn" data-act="profileMenu" data-arg="${p.id}" aria-label="${t("pv_menu_aria")}">${I.more}</button>` })}
      <main class="screen pv ${inQueue || isIncoming(p.id) ? "pv--actions" : ""}">
        ${isMe ? `<div class="notice notice--safe">${I.lock}<span>${t("pv_me_notice")}</span></div>` : ""}
        <div class="pv__head">
          <h1 class="t-d1">${esc(p.name)}<span class="pv__age">${isMe && S.privacy.hideAge ? "" : ", " + p.age}</span></h1>
          ${p.verified ? vBadge(p.g) : isMe ? `<a class="badge badge--accent" href="#/verify">${I.shield}${t("get_verified")}</a>` : ""}
        </div>
        ${blocks.join("")}
        <div class="pv__prompt">
          <span class="t-label">${t("interests")}${shared.length ? " · " + t("shared", { n: shared.length }) : ""}</span>
          <div class="chips">${p.interests.map((x) => `<span class="chip chip--static ${shared.includes(x) ? "chip--shared" : ""}">${interest(x)}</span>`).join("")}</div>
        </div>
        ${isMe ? "" : `<div class="group pv__safety">
          ${actRow("report", I.flag, t("report_on", { name: esc(p.name) }), t("report_anon"), "row__icon--danger", p.id)}
          ${actRow("block", I.ban, t("block"), t("block_sub"), "", p.id)}
        </div>`}
      </main>
      ${!inQueue && isIncoming(p.id) ? `<div class="pv__float">
        <button class="action action--pass" data-act="inboxNo" data-arg="${p.id}" aria-label="${t("inbox_no")}">${I.x}</button>
        <button class="action action--like" data-act="inboxYes" data-arg="${p.id}" aria-label="${t("inbox_yes")}">${I.heartFill}</button></div>` : ""}
      ${inQueue ? `<div class="pv__float">
        <button class="action action--pass" data-act="pass" aria-label="${t("stamp_pass")}">${I.x}</button>
        <button class="action action--like" data-act="like" aria-label="${t("like_aria")}">${I.heartFill}</button></div>` : ""}`,
    };
  }

  /* ---------- Симпатии: входящие ---------- */
  function inboxCard(p) {
    // цель уже написана рядом — в причинах её не повторяем
    const why = whyOf(p).filter((x) => x !== t("why_goal")).slice(0, 3).join(", ");
    return `
      <article class="inbox-card">
        <a class="inbox-card__main" href="#/u/${p.id}">
          <div class="avatar avatar--lg">${photo(p.photos[0])}</div>
          <span class="inbox-card__who">
            <b class="t-h">${esc(p.name)}, ${p.age}</b>
            ${p.verified ? vBadge(p.g) : `<span class="badge" style="background:var(--surface-2);color:var(--text-muted)">${I.shield}${t("not_verified", null, p.g)}</span>`}
            <span class="t-xs t-muted">${goal(p.goal)}${why ? " · " + why : ""}</span>
          </span>
        </a>
        ${p.note ? `<blockquote class="inbox-card__note"><span class="t-label">${t("inbox_note", null, p.g)}</span>${esc(p.note)}</blockquote>` : ""}
        <div class="inbox-card__actions">
          <button class="btn btn--secondary" data-act="inboxNo" data-arg="${p.id}">${I.x}${t("inbox_no")}</button>
          <button class="btn btn--like" data-act="inboxYes" data-arg="${p.id}">${I.heartFill}${t("inbox_yes")}</button>
        </div>
      </article>`;
  }

  function vLikes() {
    const tabIn = S.likesTab === "in";
    let body;
    if (tabIn) {
      const list = incoming();
      const hidden = incomingAll().length - list.length;
      body = `
        <div class="notice notice--safe">${I.shieldCheck}<span>${S.gender === "f" ? t("inbox_lead") : t("inbox_lead_m")}</span></div>
        <div class="inbox-filter">
          <button class="chip" data-act="inboxVerified" aria-pressed="${S.inboxVerified}">${I.verified}${t("inbox_only_verified")}</button>
          ${hidden ? `<span class="t-xs t-muted">${t("inbox_hidden", { n: hidden })}</span>` : ""}
        </div>
        ${list.length ? list.map(inboxCard).join("") : `<div class="empty">${I.lens()}<p class="t-muted t-sm">${t("inbox_empty")}</p></div>`}`;
    } else {
      const mine = S.liked.map(findProfile).filter(Boolean);
      body = mine.length
        ? `<div class="group">${mine.map((p) => `<a class="row" href="#/u/${p.id}">${avatar(p, "avatar--sm")}<span class="row__body"><span class="row__title">${esc(p.name)}, ${p.age}</span>${sub(t("likes_wait"))}</span><span class="row__chev">${I.right}</span></a>`).join("")}</div>`
        : `<div class="empty">${I.lens()}<p class="t-muted t-sm">${t("likes_out_empty")}</p><button class="btn btn--secondary" data-act="goto" data-arg="#/feed">${t("open_feed")}</button></div>`;
    }
    return {
      html: `${topbar(t("likes_title"), { back: false, display: true })}
      <main class="screen stack">
        <div class="segmented" id="likes-seg">
          <button aria-pressed="${tabIn}" data-val="in">${t("inbox_tab", { n: incoming().length })}</button>
          <button aria-pressed="${!tabIn}" data-val="out">${t("inbox_out")}</button>
        </div>
        ${body}
      </main>`,
      mount() {
        document.getElementById("likes-seg").onclick = (e) => { const b = e.target.closest("button"); if (b) { S.likesTab = b.dataset.val; render(); } };
      },
    };
  }

  /* ---------- Чаты ---------- */
  function vChats() {
    const newPairs = S.matches.filter((m) => !S.blocked.includes(m.id));
    const chats = S.chats.filter((c) => !S.blocked.includes(c.id));
    const preview = (c) => {
      const m = c.messages[c.messages.length - 1];
      if (!m) return t("new_pair_preview");
      if (m.type === "photo") return t("photo");
      if (m.type === "meet") return t("meet_card");
      return (m.from === "me" ? t("you") : "") + m.text;
    };
    return {
      html: `${topbar(t("chats_title"), { back: false, display: true })}
      <main class="screen stack">
        ${newPairs.length ? `<section><h2 class="t-label" style="margin-bottom:10px">${t("new_pairs")}</h2>
          <div class="pairs">${newPairs.map((m) => `<button class="pair" data-act="openPair" data-arg="${m.id}">
            <span class="pair__ring">${avatar(m)}</span><span class="t-xs">${esc(m.name)}</span></button>`).join("")}</div></section>` : ""}
        ${chats.length ? `<section><h2 class="t-label" style="margin-bottom:10px">${t("messages")}</h2><div class="group">
          ${chats.map((c) => `<a class="row chat-row" href="#/chat/${c.id}">
            ${avatar(c, "", c.online)}
            <span class="row__body">
              <span class="row__title">${esc(c.name)} ${c.verified ? `<span class="inline-v">${I.verified}</span>` : ""}</span>
              ${c.expires && (LIVE || chatState(c) !== "open") ? `<span class="t-xs chat-row__exp">${I.clock}${t("pair_expires", { n: c.expires })}</span>` : ""}
              <span class="row__sub chat-row__preview">${c.messages.some((m) => m.flagged) ? `<span class="warn-dot">${I.alert}</span>` : ""}${esc(preview(c))}</span>
            </span>
            <span class="chat-row__side"><span class="t-xs t-muted">${c.messages.length ? c.messages[c.messages.length - 1].time : ""}</span>${c.unread ? `<span class="counter">${c.unread}</span>` : ""}</span>
          </a>`).join("")}</div></section>`
          : `<div class="empty">${I.lens()}<h2 class="t-h">${t("chats_empty_title")}</h2><p class="t-muted t-sm">${t("chats_empty_text")}</p><button class="btn btn--primary" data-act="goto" data-arg="#/feed">${t("see_profiles")}</button></div>`}
      </main>`,
    };
  }

  /* ---------- Переписка ----------
     Те же правила проверяет сервер (server/app/moderation/text_guard.py). */
  const RX = {
    phone: /(\+?998[\s\-(]*\d{2}[\s\-)]*\d{3}[\s-]*\d{2}[\s-]*\d{2}|(\+7|\b8)[\s\-(]*\d{3}[\s\-)]*\d{3}[\s-]*\d{2}[\s-]*\d{2})/,
    card: /\b(?:\d[ -]?){16}\b/,
    link: /(https?:\/\/|t\.me\/|wa\.me\/|@[a-z0-9_]{4,})/i,
    // Грубость: не блокируем, а просим перечитать. Список дополняет модерация
    rude: /(дур[аы]\b|дурак|туп(ая|ой|ица)|сук[аи]|шлюх|идиот|урод|жирн|овца|коз[её]л|мразь|шалав)/i,
  };

  function vChat(id) {
    const c = S.chats.find((x) => x.id === id);
    if (!c && LIVE) { L.chats().then(() => { if (S.chats.find((x) => x.id === id)) render(); }); return vLoading(); }
    if (!c) return vNotFound();
    if (LIVE && !S.live.loaded[id]) { S.live.loaded[id] = true; L.chat(id); }
    c.unread = 0;
    const prof = c.profileId && findProfile(c.profileId);
    if (LIVE && !prof && c.profileId && S.live.cache[c.profileId] === undefined) L.profile(c.profileId).then(() => onScreen("#/chat/" + id) && rerenderKeepInput());
    const starters = prof
      ? prof.prompts.map((pr) => t("starter_about", { p: promptLabel(pr[0]).replace(/[—…]\s*$/, "").trim() }))
      : [t("starter_default")];
    const st = chatState(c);
    const locked = st === "herFirst" || st === "waitReply";
    const msgs = c.messages.map((m, i) => {
      const ref = `${id}:${i}`;
      if (m.type === "contact") {
        const ok = m.status === "ok", no = m.status === "declined", ask = m.from === "them" && m.status === "wait";
        return `<div class="msg msg--${m.from}"><div class="bubble bubble--meet ${ok ? "is-ok" : ""}">
          <span class="bubble--meet__head">${I.key}${t("contact_card")}</span>
          <b>${m.from === "me" ? t("contact_offer_me") : t("contact_offer_them", { name: esc(c.name) }, c.g)}</b>
          ${ask ? `<span class="t-xs t-muted bubble__hint">${t("contact_hint")}</span>
            <button class="btn btn--sm btn--primary bubble__main" data-act="contactAccept" data-arg="${ref}">${t("contact_accept")}</button>
            <span class="bubble__btns"><button class="btn btn--sm btn--secondary" data-act="contactDecline" data-arg="${ref}">${t("contact_decline")}</button></span>` : ""}
          ${ok ? `<span class="bubble--meet__status">${I.shieldCheck}${t("contact_done")}</span><span>${t("contact_their", { u: esc(c.tg || "@" + "vzaimno_demo") })}</span>` : ""}
          ${no ? `<span class="bubble--meet__status">${t("contact_declined")}</span>` : ""}
          ${m.from === "me" && m.status === "wait" ? `<span class="bubble--meet__status">${I.clock}${t("meet_wait")}</span>` : ""}
        </div><span class="msg__time">${m.time}</span></div>`;
      }
      if (m.type === "meet") {
        const ok = m.status === "ok", no = m.status === "declined", ask = m.from === "them" && m.status === "wait";
        return `<div class="msg msg--${m.from}"><div class="bubble bubble--meet ${ok ? "is-ok" : ""}">
          <span class="bubble--meet__head">${I.calendar}${m.from === "them" ? t("meet_offer_them") : t("meet_card")}</span>
          <b>${t("day_" + m.day)} · ${t("time_" + m.slot)}</b>
          <span>${I.pin}${t("pl_" + m.place)}</span>
          ${ask ? `<button class="btn btn--sm btn--primary bubble__main" data-act="meetAccept" data-arg="${ref}">${t("contact_accept")}</button>
            <span class="bubble__btns"><button class="btn btn--sm btn--secondary" data-act="meetCounter" data-arg="${ref}">${t("meet_counter")}</button>
            <button class="btn btn--sm btn--secondary" data-act="meetDecline" data-arg="${ref}">${t("meet_decline")}</button></span>`
            : `<span class="bubble--meet__status">${ok ? I.shieldCheck : I.clock}${ok ? t("meet_ok") : no ? t("meet_declined") : t("meet_wait")}</span>`}
          ${ok ? `<button class="btn btn--sm btn--secondary" data-act="sharePlanMeet" data-arg="${id}:${i}">${I.share}${t("s_share")}</button>` : ""}
        </div><span class="msg__time">${m.time}</span></div>
        ${ok ? `<p class="t-xs t-muted msg__hint">${t("meet_share_hint")}</p>` : ""}`;
      }
      if (m.type === "photo") {
        const shown = S.revealed[id + i];
        return `<div class="msg msg--${m.from}"><div class="bubble bubble--photo">
          ${photo(c.photos[0] + 3, shown ? "" : "photo--blur")}
          ${shown ? "" : `<div class="bubble__cover">${I.eyeOff}<span class="t-sm">${t("sensitive")}</span>
            <button class="btn btn--sm btn--secondary" data-act="reveal" data-arg="${id + i}">${t("show")}</button></div>`}
        </div><span class="msg__time">${m.time}</span></div>`;
      }
      return `<div class="msg msg--${m.from}"><div class="bubble">${esc(m.text)}</div><span class="msg__time">${m.time}</span></div>
        ${m.flagged === "scam" ? `<div class="notice notice--warn msg__flag">${I.alert}<span><b>${t("scam_title")}</b> ${t("scam_text")}
          <span class="msg__flag-btns"><button class="btn btn--sm btn--danger" data-act="report" data-arg="${c.id}">${t("report")}</button></span></span></div>` : ""}`;
    }).join("");

    const moreBtn = `<button type="button" class="icon-btn composer__more" data-act="chatMenu" data-arg="${c.id}" aria-label="${t("chat_menu_aria")}">${I.plus}</button>`;
    return {
      // Всё, что можно сделать в переписке, — одна кнопка «+» слева от поля ввода:
      // встреча, обмен Telegram, анкета, а ниже — удалить пару, пожаловаться, заблокировать
      html: `
      <header class="topbar topbar--back chat-head">
        <button class="icon-btn" data-act="back" aria-label="${t("back")}">${I.left}</button>
        <a class="chat-head__who" ${prof ? `href="#/u/${prof.id}"` : ""}>${avatar(c, "avatar--sm", c.online)}
          <span><b>${esc(c.name)}</b> ${c.verified ? `<span class="inline-v">${I.verified}</span>` : ""}<span class="t-xs t-muted" style="display:block">${c.online ? t("online_status") : t("recently", null, c.g)}</span></span></a>
      </header>
      <main class="screen chat" id="chat-scroll">
        <div class="notice notice--safe t-xs chat__safe">${I.lock}<span>${t("chat_safe", { name: esc(c.name) })}
          ${c.tg && (LIVE || c.messages.some((m) => m.type === "contact" && m.status === "ok")) ? `<b class="chat__tg">${t("contact_their", { u: esc(c.tg) })}</b>`
            : st === "open" ? `<button class="chat__share" data-act="contactOffer" data-arg="${c.id}">${I.key}${t("contact_btn")}</button>`
            : `<span class="chat__share-later">${t("contact_later")}</span>`}</span></div>
        ${c.verified ? "" : `<div class="notice notice--accent t-xs">${I.info}<span>${t("chat_unverified", { name: esc(c.name) }, c.g)}</span></div>`}
        ${c.expires && st !== "open" ? `<p class="t-xs t-muted chat__expires">${I.clock}${t("pair_expires", { n: c.expires })}</p>` : ""}
        ${msgs}
        ${st === "pending" ? `<div class="notice notice--accent t-xs">${I.info}<span>${t("rule_pending", { name: esc(c.name) }, c.g)}
          <span class="msg__flag-btns"><button class="btn btn--sm btn--secondary" data-act="unmatch" data-arg="${c.id}">${t("unmatch")}</button></span></span></div>` : ""}
        ${st === "empty" || st === "meFirst" ? `<div class="chat__start">
          ${st === "meFirst" ? `<p class="t-sm">${t("rule_me_first", { name: esc(c.name) })}</p>` : ""}
          <p class="t-sm t-muted">${t("starter_intro")}</p>
          <div class="chips">${starters.map((x) => `<button class="chip" data-act="starter">${esc(x)}</button>`).join("")}</div></div>` : ""}
      </main>
      ${locked ? `<div class="composer composer--locked">${moreBtn}${I.lock}<span class="t-xs">${st === "herFirst" ? t("rule_her_first", { name: esc(c.name) }) : t("rule_one_msg", null, S.gender)}</span></div>` : `
      <form class="composer" id="composer" autocomplete="off">
        ${moreBtn}
        <label class="sr-only" for="msg">${t("message")}</label>
        <input class="input" id="msg" placeholder="${t("message")}" maxlength="1000" enterkeyhint="send">
        <button class="action action--sm composer__send" aria-label="${t("send")}">${I.send}</button>
      </form>`}`,
      mount() {
        const sc = document.getElementById("chat-scroll");
        window.scrollTo(0, document.body.scrollHeight);
        const input = document.getElementById("msg");
        const form = document.getElementById("composer");
        if (!form) return;
        form.onsubmit = (e) => {
          e.preventDefault();
          const text = input.value.trim();
          if (!text) return;
          const wasFirst = !c.messages.length;
          const send = () => {
            if (LIVE) { closeSheet(); input.value = ""; return L.send(c.id, { kind: "text", text }); }
            c.messages.push({ from: "me", text, time: new Date().toTimeString().slice(0, 5) });
            closeSheet(); render(); TG.haptic("light");
            // Демо: новая пара отвечает на первое сообщение, чтобы можно было проверить переписку дальше
            if (wasFirst && c.profileId) setTimeout(() => {
              c.messages.push({ from: "them", text: t("demo_reply", null, c.g), time: new Date().toTimeString().slice(0, 5) });
              if (location.hash === "#/chat/" + c.id) render();
            }, 2200);
          };
          if (RX.rude.test(text)) {
            return openSheet(`
              <h2 class="t-h">${t("rude_title")}</h2>
              <p class="t-sm t-muted" style="margin:8px 0 16px">${t("rude_text")}</p>
              <button class="btn btn--primary btn--block" data-act="closeSheet">${t("rude_edit")}</button>
              <button class="btn btn--ghost btn--block" id="send-anyway">${t("rude_send")}</button>`,
              (sh) => { sh.querySelector("#send-anyway").onclick = send; });
          }
          const risk = RX.phone.test(text) ? "phone" : RX.card.test(text) ? "card" : RX.link.test(text) ? "link" : null;
          if (!risk) return send();
          openSheet(`
            <h2 class="t-h">${t("risky_title", { what: t("risk_" + risk) })}</h2>
            <p class="t-sm t-muted" style="margin:8px 0 16px">${t("risky_text")} ${risk === "card" ? t("risky_card") : t("risky_other")}</p>
            <button class="btn btn--primary btn--block" data-act="closeSheet">${t("dont_send")}</button>
            <button class="btn btn--ghost btn--block" id="send-anyway">${t("send_anyway")}</button>`,
            (sh) => { sh.querySelector("#send-anyway").onclick = send; });
        };
        sc && sc.addEventListener("click", (e) => {
          const b = e.target.closest('[data-act="starter"]');
          if (b) { input.value = b.textContent; input.focus(); }
        });
      },
    };
  }

  /* ---------- Мой профиль ---------- */
  function vMe() {
    const me = ME();
    return {
      html: `
      <div class="me-top">
        <section class="me-hero">
          ${photo((me.photos || [])[0])}
          <div class="me-hero__info">
            <h1 class="t-d1">${esc(me.name)}${S.privacy.hideAge ? "" : ", " + me.age}</h1>
            <p class="t-sm">${me.job ? esc(me.job) + " · " : ""}${S.setup.city.trim() ? esc(S.setup.city) : D.me.city}</p>
            ${S.verified ? vBadge(S.gender) : `<span class="badge badge--glass">${I.shield}${t("not_verified", null, S.gender)}</span>`}
          </div>
        </section>
        <a class="me-hero__edit" href="#/u/me" aria-label="${t("how_seen")}">${I.eye}</a>
      </div>
      <main class="screen stack me-body">
        ${modBanner()}
        <section class="stack-sm">
          <h2 class="t-h">${t("me_photos")}</h2>
          <div class="me-photos">
            ${(me.photos || []).map((ph) => `<div class="me-photos__item">${photo(ph)}</div>`).join("")}
            <button class="me-photos__add" data-act="demoOnly" aria-label="${t("add_photo")}">${I.plus}</button>
          </div>
        </section>
        <section class="stack-sm">
          <h2 class="t-h">${t("me_about")}</h2>
          <div class="chips">
            <span class="chip chip--static">${I.target}${goal(me.goal)}</span>
            ${me.height ? `<span class="chip chip--static">${I.ruler}${me.height} ${t("cm")}</span>` : ""}
            ${S.setup.work ? `<span class="chip chip--static">${I.briefcase}${t("dist_" + S.setup.work)}</span>` : ""}
          </div>
          ${(me.prompts || [])[0] ? `<div class="me-quote"><span class="t-label">${promptLabel(me.prompts[0][0])}</span><p>${esc(me.prompts[0][1])}</p></div>` : ""}
        </section>
        <div class="meter"><div class="meter__top"><span class="t-sm"><b>${t("filled", { n: D.me.completeness })}</b></span><a class="t-sm" href="#/u/me">${t("how_seen")}</a></div>
          <div class="progress"><span style="width:${D.me.completeness}%"></span></div>
          <span class="t-xs t-muted">${t("filled_hint")}</span></div>
        ${S.verified ? "" : `<a class="promo promo--safe" href="#/verify"><span class="row__icon row__icon--safe">${S.verify.status === "pending" ? I.clock : I.shieldCheck}</span>
          <span><b>${t(S.verify.status === "pending" ? "verify_pending" : "verify_promo")}</b><span class="t-sm t-muted" style="display:block">${t(S.verify.status === "pending" ? "verify_pending_sub" : "verify_promo_sub")}</span></span></a>`}
        ${S.plus ? `<div class="promo promo--plus"><span class="row__icon row__icon--accent">${I.sparkle}</span><span><b>${t("plus_on")}</b><span class="t-sm t-muted" style="display:block">${t("plus_until")}</span></span></div>`
          : `<a class="promo promo--plus" href="#/premium"><span class="row__icon row__icon--accent">${I.sparkle}</span>
          <span><b>Взаимно Plus</b><span class="t-sm t-muted" style="display:block">${t("plus_promo_sub")}</span></span></a>`}
        <div>
          <div class="group">
            ${linkRow("#/filters", I.sliders, t("row_filters"), t("row_filters_sub", { a: S.filters.ageMin, b: S.filters.ageMax, d: S.filters.dist }))}
            ${linkRow("#/privacy", I.lock, t("row_privacy"), t("row_privacy_sub"))}
            ${linkRow("#/safety", I.shield, t("row_safety"), t("row_safety_sub"))}
          </div>
          <div class="group">
            ${I18N.multi ? `<div class="row lang-row"><span class="row__icon">${I.globe}</span><span class="row__body"><span class="row__title">${t("lang")}</span></span>${langSwitch()}</div>` : ""}
            ${linkRow("#/notifications", I.bell, t("row_notif"), t("row_notif_sub"))}
            ${actRow("doc", I.book, t("row_rules"), "", "", "rules")}
            ${LIVE ? "" : actRow("resetDemo", I.undo, t("row_reset"))}
          </div>
        </div>
      </main>`,
    };
  }

  /* ---------- Фильтры ---------- */
  function vFilters() {
    const f = S.filters;
    return {
      html: `${topbar(t("f_title"))}
      <main class="screen stack">
        <section class="field">
          <div class="field__row"><span class="field__label">${t("f_age")}</span><output class="t-sm" id="o-age">${f.ageMin}–${f.ageMax}</output></div>
          <label class="t-xs t-muted" for="r-min">${t("f_from")}</label><input class="range" type="range" id="r-min" min="18" max="70" value="${f.ageMin}">
          <label class="t-xs t-muted" for="r-max">${t("f_to")}</label><input class="range" type="range" id="r-max" min="18" max="70" value="${f.ageMax}">
        </section>
        <section class="field">
          <div class="field__row"><label class="field__label" for="r-dist">${t("f_dist")}</label><output class="t-sm" id="o-dist">${t("f_dist_val", { d: f.dist })}</output></div>
          <input class="range" type="range" id="r-dist" min="1" max="100" value="${f.dist}">
        </section>
        ${S.setup.work ? `<section class="field"><span class="field__label">${t("f_near")}</span>
          <div class="segmented" id="f-near">
            ${["home", "work", "both"].map((v) => `<button aria-pressed="${S.near === v}" data-val="${v}">${t(v === "work" ? "near_work_opt" : "near_" + v)}</button>`).join("")}
          </div></section>` : ""}
        <section class="field"><span class="field__label">${t("f_goal")}</span>
          <div class="chips">${D.goals.map((g) => `<button class="chip" data-act="toggleGoal" data-arg="${g}" aria-pressed="${f.goals.includes(g)}">${goal(g)}</button>`).join("")}</div></section>
        <div class="group">
          <label class="row"><span class="row__icon row__icon--safe">${I.verified}</span>
            <span class="row__body"><span class="row__title">${t("f_verified")}</span>${sub(t("f_verified_sub"))}</span>
            <span class="switch"><input type="checkbox" id="f-ver" ${f.onlyVerified ? "checked" : ""}><span class="switch__track"></span></span></label>
        </div>
        <button class="btn btn--primary btn--block" data-act="applyFilters">${t("apply")}</button>
      </main>`,
      mount() {
        const mn = document.getElementById("r-min"), mx = document.getElementById("r-max"), ds = document.getElementById("r-dist");
        const upd = () => {
          if (+mn.value > +mx.value) mn.value = mx.value;
          f.ageMin = +mn.value; f.ageMax = +mx.value; f.dist = +ds.value;
          document.getElementById("o-age").textContent = `${f.ageMin}–${f.ageMax}`;
          document.getElementById("o-dist").textContent = t("f_dist_val", { d: f.dist });
        };
        mn.oninput = mx.oninput = ds.oninput = upd;
        document.getElementById("f-ver").onchange = (e) => { f.onlyVerified = e.target.checked; };
        const nr = document.getElementById("f-near");
        if (nr) nr.onclick = (e) => { const b = e.target.closest("button"); if (b) { S.near = b.dataset.val; render(); } };
      },
    };
  }

  /* ---------- Приватность и данные ---------- */
  function vPrivacy() {
    return {
      mount() {
        document.getElementById("p-first").onclick = (e) => { const b = e.target.closest("button"); if (b) { S.privacy.firstMove = b.dataset.val; if (LIVE) L.saveSettings({ privacy: S.privacy }); toast(t("saved")); render(); } };
      },
      html: `${topbar(t("p_title"))}
      <main class="screen stack">
        <div>
          <h2 class="t-label group__label">${t("p_vis")}</h2>
          <div class="group">
            <div class="row row--stack"><span class="row__body"><span class="row__title">${t("p_who")}</span>${sub(t("p_first_sub"))}</span>
              <div class="segmented" id="p-first">
                <button aria-pressed="${S.privacy.firstMove === "any"}" data-val="any">${t("p_first_any")}</button>
                <button aria-pressed="${S.privacy.firstMove === "me"}" data-val="me">${t("p_first_me")}</button>
              </div></div>
            ${switchRow("verifiedOnly", t("p_verified_only"), t("p_verified_only_sub"), { icon: I.verified })}
            ${switchRow("pause", t("p_pause"), t("p_pause_sub"), { icon: I.clock })}
            ${switchRow("incognito", t("p_incog"), t("p_incog_sub"), { icon: I.eyeOff })}
            ${switchRow("hideAge", t("p_hideAge"), t("p_hideAge_sub"))}
            ${switchRow("hideDist", t("p_hideDist"), "")}
            ${switchRow("online", t("p_online"), "")}
            ${switchRow("receipts", t("p_receipts"), "")}
          </div>
        </div>
        <div>
          <h2 class="t-label group__label">${t("p_never")}</h2>
          <div class="group">
            ${infoRow(I.lock, t("p_tg"))}
            ${infoRow(I.phone, t("p_phone"), t("p_phone_sub"))}
            ${infoRow(I.pin, t("p_geo"), t("p_geo_sub"))}
            ${infoRow(I.image, t("p_exif"), t("p_exif_sub"))}
          </div>
        </div>
        <div>
          <h2 class="t-label group__label">${t("p_data")}</h2>
          <div class="group">
            ${actRow("exportData", I.download, t("p_export"), t("p_export_sub"))}
            ${actRow("consents", I.book, t("p_consents"), t("p_consents_sub"))}
            ${actRow("deleteAccount", I.trash, t("p_delete"), t("p_delete_sub"), "row__icon--danger")}
          </div>
        </div>
      </main>`,
    };
  }

  /* ---------- Уведомления ---------- */
  function vNotif() {
    const n = S.notif;
    const sw = (key, title, subText = "") => `
      <label class="row"><span class="row__body"><span class="row__title">${title}</span>${sub(subText)}</span>
        <span class="switch"><input type="checkbox" data-notif="${key}" ${n[key] ? "checked" : ""}><span class="switch__track"></span></span></label>`;
    const botMsg = (text, btn) => `<div class="botmsg"><p>${text}</p>${btn ? `<span class="botmsg__btn">${btn}</span>` : ""}</div>`;
    return {
      html: `${topbar(t("notif_title"))}
      <main class="screen stack">
        <div class="notice notice--safe">${I.lock}<span>${t("notif_lead")}</span></div>
        <div class="group">
          ${sw("pairs", t("n_pairs"))}
          ${sw("messages", t("n_messages"))}
          ${sw("meet", t("n_meet"))}
          ${sw("picks", t("n_picks"))}
          <div class="row row--stack"><span class="row__body"><span class="row__title">${t("n_likes")}</span></span>
            <div class="segmented" id="n-likes">${["instant", "digest", "off"].map((v) => `<button aria-pressed="${n.likes === v}" data-val="${v}">${t("n_likes_" + v)}</button>`).join("")}</div></div>
          ${sw("quiet", t("n_quiet"), t("n_quiet_sub"))}
        </div>
        <div>
          <h2 class="t-label group__label">${t("n_preview")}</h2>
          <div class="botchat">
            <div class="botchat__head">${I.lens()}<b>${t("brand")}</b><span class="t-xs t-muted">бот</span></div>
            ${n.likes === "digest" ? botMsg(t("bot_digest"), t("bot_open")) : ""}
            ${n.pairs ? botMsg(t("bot_match"), t("bot_open")) : ""}
            ${n.messages ? botMsg(t("bot_msg"), t("bot_open")) : ""}
          </div>
        </div>
      </main>`,
      mount() {
        document.querySelectorAll("[data-notif]").forEach((inp) => inp.onchange = () => { n[inp.dataset.notif] = inp.checked; if (LIVE) L.saveSettings({ notif: n }); render(); });
        document.getElementById("n-likes").onclick = (e) => { const b = e.target.closest("button"); if (b) { n.likes = b.dataset.val; if (LIVE) L.saveSettings({ notif: n }); render(); } };
      },
    };
  }

  /* ---------- Центр безопасности ---------- */
  function vSafety() {
    const tip = (icon, title, s) => `<div class="row"><span class="row__icon">${icon}</span><span class="row__body"><span class="row__title">${title}</span>${sub(s)}</span></div>`;
    return {
      html: `${topbar(t("s_title"))}
      <main class="screen stack">
        <section class="safety-hero">
          <span class="safety-hero__icon">${I.shieldCheck}</span>
          <p class="t-sm">${t("s_hero")}</p>
        </section>
        <div>
          <h2 class="t-label group__label">${t("s_before")}</h2>
          <div class="group">
            ${tip(I.pin, t("s_public"), t("s_public_sub"))}
            ${tip(I.target, t("s_own"), t("s_own_sub"))}
            ${tip(I.alert, t("s_money"), t("s_money_sub"))}
            ${actRow("sharePlan", I.share, t("s_share"), t("s_share_sub"), "row__icon--accent")}
          </div>
        </div>
        <div>
          <h2 class="t-label group__label">${t("s_wrong")}</h2>
          <div class="group">
            <a class="row" href="tel:102"><span class="row__icon row__icon--danger">${I.phone}</span><span class="row__body"><span class="row__title">${t("s_police")}</span>${sub(t("s_police_sub"))}</span></a>
            <a class="row" href="tel:103"><span class="row__icon row__icon--danger">${I.phone}</span><span class="row__body"><span class="row__title">${t("s_ambulance")}</span></span></a>
            ${actRow("blockedList", I.ban, t("s_blocked"), S.blocked.length ? t("blocked_n", { n: S.blocked.length }) : t("blocked_none"))}
            ${actRow("howReport", I.flag, t("s_how"), t("s_how_sub"))}
          </div>
        </div>
        <div>
          <h2 class="t-label group__label">${t("s_protect")}</h2>
          <ul class="bullets t-sm">${["s_p1", "s_p2", "s_p3", "s_p4", "s_p5"].map((k) => `<li>${t(k)}</li>`).join("")}</ul>
        </div>
      </main>`,
    };
  }

  /* ---------- Проверка селфи ----------
     Жест выдаёт сервер (случайный), селфи смотрит модератор вручную, после решения снимок удаляется. */
  const DEMO_GESTURES = [["✌️", "Два пальца — «виктория» — у щеки"], ["👍", "Большой палец вверх"], ["✋", "Раскрытая ладонь рядом с лицом"], ["👌", "Жест «окей» у подбородка"]];
  function vVerify() {
    const v = S.verify;
    const status = S.verified ? "verified" : v.status;
    const art = (cls, extra = "") => `<div class="verify-art ${cls}">${I.lens("lens-mark verify-art__lens")}${extra}</div>`;
    let body;
    if (status === "verified") body = `
      ${art("is-done", `<span class="verify-art__hand">${I.verified}</span>`)}
      <h1 class="t-d1">${t("v_done_h")}</h1>
      <p class="t-muted">${t("v_done_sub")}</p>
      <button class="btn btn--primary btn--block" data-act="goto" data-arg="#/me">${t("to_profile")}</button>`;
    else if (status === "pending") body = `
      ${art("is-busy")}
      <h1 class="t-d1">${t("v_pending_h")}</h1>
      <p class="t-muted" role="status">${t("v_pending_sub")}</p>
      <button class="btn btn--secondary btn--block" data-act="goto" data-arg="#/me">${t("to_profile")}</button>`;
    else if (v.gesture) body = `
      <div class="gesture" aria-hidden="true"><span class="gesture__icon">${v.gesture.icon}</span></div>
      <h1 class="t-d1">${esc(v.gesture.text)}</h1>
      <p class="t-muted">${t("v_gesture_sub")}</p>
      <ul class="tips">${["v_tip1", "v_tip2", "v_tip3"].map((k) => `<li>${I.shieldCheck}<span>${t(k)}</span></li>`).join("")}</ul>
      <label class="btn btn--primary btn--block">${I.camera}${t("v_btn")}
        <input type="file" id="selfie-input" accept="image/*" capture="user" hidden></label>`;
    else body = `
      ${art("", `<span class="verify-art__hand">${I.hand}</span>`)}
      <h1 class="t-d1">${status === "rejected" ? t("v_rejected_h") : t("v_h")}</h1>
      ${status === "rejected" ? `<div class="notice notice--warn">${I.alert}<span>${t("v_rejected_why", { r: esc(v.reason || "") })}</span></div>` : ""}
      <ol class="steps">${["v_step1", "v_step2", "v_step3"].map((k, i) => `<li><span class="steps__n">${i + 1}</span><span>${t(k)}</span></li>`).join("")}</ol>
      <div class="notice notice--safe">${I.lock}<span>${t("v_notice")}</span></div>
      <button class="btn btn--primary btn--block" data-act="verifyStart">${status === "rejected" ? t("v_retry") : t("v_start")}</button>`;
    return {
      html: `${topbar(t("v_title"))}<main class="screen stack verify">${body}</main>`,
      mount() {
        const inp = document.getElementById("selfie-input");
        if (inp) inp.onchange = () => { if (inp.files[0]) ACT.verifySend(inp.files[0]); };
      },
    };
  }

  /* ---------- Plus ---------- */
  function vPremium() {
    const plans = [["week", 250, ""], ["month", 590, t("plan_popular")], ["quarter", 1290, "−27%"]];
    const cur = plans.find((p) => p[0] === S.plan);
    return {
      html: `${topbar("")}
      <main class="screen stack premium">
        <div class="premium__hero">${I.lens("lens-mark premium__lens")}<h1 class="t-d1">Взаимно Plus</h1>
          <p class="t-muted">${t("pr_lead")}</p></div>
        <ul class="perks">
          <li>${I.heart}<span>${t("pr_1")}</span></li>
          <li>${I.undo}<span>${t("pr_2")}</span></li>
          <li>${I.chatHeart}<span>${t("pr_4")}</span></li>
        </ul>
        <div class="plans" role="radiogroup" aria-label="${t("plans_aria")}">
          ${plans.map(([id, price, tag]) => `<button class="plan" role="radio" aria-checked="${S.plan === id}" data-act="setPlan" data-arg="${id}">
            ${tag ? `<span class="badge badge--like plan__tag">${tag}</span>` : ""}
            <span class="t-sm">${t("plan_" + id)}</span><b class="plan__price">${price} ⭐</b></button>`).join("")}
        </div>
        <button class="btn btn--like btn--block" data-act="buy">${t("pay", { n: cur[1] })}</button>
        <p class="t-xs t-muted premium__fine">${t("pr_fine")}</p>
      </main>`,
    };
  }

  function vNotFound() {
    return { html: `${topbar("")}<main class="screen"><div class="empty">${I.lens()}<h2 class="t-h">${t("nf_title")}</h2>
      <p class="t-muted t-sm">${t("nf_text")}</p>
      <button class="btn btn--secondary" data-act="goto" data-arg="#/feed">${t("to_feed")}</button></div></main>` };
  }

  /* ================================================================
     ШТОРКИ: жалоба, блокировка, план встречи
     ================================================================ */
  function openReport(targetId) {
    const reasons = ["fake", "scam", "abuse", "nsfw", "minor", "offline", "other"];
    openSheet(`
      <h2 class="t-h">${t("r_title")}</h2>
      <p class="t-sm t-muted" style="margin:4px 0 8px">${t("r_lead")}</p>
      <div role="radiogroup">${reasons.map((k) => `<label class="row radio-row"><input type="radio" name="reason" value="${k}"><span class="row__body">${t("r_" + k)}</span></label>`).join("")}</div>
      <div class="field" style="margin-top:12px"><label class="field__label" for="r-text">${t("r_details")}</label><textarea class="textarea" id="r-text" maxlength="500"></textarea></div>
      <label class="row" style="margin-top:4px"><span class="row__body"><span class="row__title">${t("r_block")}</span></span>
        <span class="switch"><input type="checkbox" id="r-block" checked><span class="switch__track"></span></span></label>
      <button class="btn btn--danger btn--block" id="r-send" disabled>${t("r_send")}</button>`,
      (sh) => {
        const send = sh.querySelector("#r-send");
        sh.querySelectorAll('input[name="reason"]').forEach((r) => r.onchange = () => { send.disabled = false; });
        send.onclick = () => {
          const block = sh.querySelector("#r-block").checked;
          closeSheet();
          if (LIVE) return L.report(targetId, sh.querySelector('input[name="reason"]:checked').value, sh.querySelector("#r-text").value.trim(), block);
          if (block) doBlock(targetId, true);
          toast(block ? t("r_sent_block") : t("r_sent"));
        };
      });
  }

  function doBlock(id, silent) {
    if (LIVE) return L.block(id, silent);
    S.blocked.push(id);
    const c = S.chats.find((x) => x.id === id || x.profileId === id);
    if (c) S.blocked.push(c.id);
    S.queue = S.queue.filter((p) => p.id !== id);
    TG.haptic("warning");
    if (!silent) toast(t("blocked_toast"));
    go(location.hash.startsWith("#/chat") ? "#/chats" : "#/feed");
  }

  function openSharePlan(name = "", where = "", when = "") {
    openSheet(`
      <h2 class="t-h">${t("sp_title")}</h2>
      <p class="t-sm t-muted" style="margin:4px 0 12px">${t("sp_lead")}</p>
      <div class="stack-sm">
        <div class="field"><label class="field__label" for="p-with">${t("sp_with")}</label><input class="input" id="p-with" value="${esc(name)}" placeholder="${t("sp_with_ph")}"></div>
        <div class="field"><label class="field__label" for="p-where">${t("sp_where")}</label><input class="input" id="p-where" value="${esc(where)}" placeholder="${t("sp_where_ph")}"></div>
        <div class="field"><label class="field__label" for="p-when">${t("sp_when")}</label><input class="input" id="p-when" value="${esc(when)}" placeholder="${t("sp_when_ph")}"></div>
      </div>
      <button class="btn btn--primary btn--block" id="p-send" style="margin-top:16px">${I.share}${t("sp_btn")}</button>`,
      (sh) => {
        sh.querySelector("#p-send").onclick = () => {
          const v = (id) => sh.querySelector(id).value.trim() || "—";
          TG.shareText(t("sp_text", { w: v("#p-with"), p: v("#p-where"), t: v("#p-when") }));
          closeSheet();
        };
      });
  }

  /* Предложить встречу: день, время и одно из людных мест */
  function openMeet(chatId) {
    const c = S.chats.find((x) => x.id === chatId);
    if (!c) return;
    const pick = { day: "tomorrow", slot: "evening", place: D.places[0] };
    const label = (key, v) => t(key === "day" ? "day_" + v : key === "slot" ? "time_" + v : "pl_" + v);
    const group = (key, vals, title) => `
      <div class="field"><span class="field__label">${title}</span>
        <div class="chips" data-group="${key}">${vals.map((v) => `<button class="chip" data-val="${v}" aria-pressed="${pick[key] === v}">${label(key, v)}</button>`).join("")}</div></div>`;
    openSheet(`
      <h2 class="t-h">${t("meet_btn")}</h2>
      <p class="t-sm t-muted" style="margin:4px 0 12px">${t("meet_lead", { name: esc(c.name) })}</p>
      <div class="stack-sm">
        ${group("day", ["today", "tomorrow", "weekend"], t("meet_day"))}
        ${group("slot", ["lunch", "evening", "late"], t("meet_time"))}
        ${group("place", D.places, t("meet_place"))}
        <span class="field__hint">${t("meet_places_hint")}</span>
      </div>
      <button class="btn btn--primary btn--block" id="m-send" style="margin-top:16px">${t("meet_send")}</button>`,
      (sh) => {
        sh.querySelectorAll("[data-group]").forEach((g) => g.onclick = (e) => {
          const b = e.target.closest("button"); if (!b) return;
          pick[g.dataset.group] = b.dataset.val;
          g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
        });
        sh.querySelector("#m-send").onclick = () => {
          if (LIVE) { closeSheet(); return L.send(c.id, { kind: "meet", ...pick }); }
          const msg = { from: "me", type: "meet", ...pick, status: "wait", time: new Date().toTimeString().slice(0, 5) };
          c.messages.push(msg);
          closeSheet(); TG.haptic("light");
          if (location.hash !== "#/chat/" + c.id) go("#/chat/" + c.id); else render();
          // Демо: собеседник соглашается через пару секунд
          setTimeout(() => {
            if (!S.chats.includes(c)) return;
            msg.status = "ok";
            TG.haptic("success");
            toast(t("meet_ok_toast", { name: c.name }, c.g));
            if (location.hash === "#/chat/" + c.id) render();
          }, 1800);
        };
      });
  }

  const msgAt = (ref) => { const [cid, i] = ref.split(":"); const c = S.chats.find((x) => x.id === cid); return c && c.messages[+i]; };

  const limitSheet = () => openSheet(`<h2 class="t-h">${t("limit_title")}</h2>
    <p class="t-sm t-muted" style="margin:8px 0 16px">${t("limit_text")}</p>
    <button class="btn btn--secondary btn--block" data-act="closeSheet">${t("understood")}</button>`);

  const confirmSheet = (title, text, yesAct, yesLabel, arg, noLabel) => openSheet(`
    <h2 class="t-h">${title}</h2>
    <p class="t-sm t-muted" style="margin:8px 0 16px">${text}</p>
    <button class="btn btn--danger btn--block" data-act="${yesAct}" data-arg="${esc(arg || "")}">${yesLabel}</button>
    <button class="btn btn--ghost btn--block" data-act="closeSheet">${noLabel}</button>`);

  /* ================================================================
     ДЕЙСТВИЯ (все нажатия с data-act)
     ================================================================ */
  const ACT = {
    back: () => (history.length > 1 ? history.back() : go("#/feed")),
    goto: (a) => go(a),
    closeSheet,
    doc: (a) => openSheet(`<h2 class="t-h">${a === "rules" ? t("doc_rules") : t("doc_pd")}</h2>
      <p class="t-sm t-muted" style="margin-top:8px">${t("doc_stub")}</p>
      <button class="btn btn--secondary btn--block" style="margin-top:16px" data-act="closeSheet">${t("understood")}</button>`),

    setGoal: (a) => { S.setup.goal = a; render(); },
    setGeo: (a) => {
      S.setup.geo = a;
      if (a === "gps" && LIVE && navigator.geolocation) navigator.geolocation.getCurrentPosition(
        (pos) => { S.setup.coords = { lat: pos.coords.latitude, lon: pos.coords.longitude }; },
        () => toast(t("live_geo_fail")), { timeout: 10000 });
      render();
    },
    addPhoto: () => {
      if (LIVE) return document.getElementById("photo-input").click();
      S.setup.photos = Math.min(6, S.setup.photos + 1); render();
    },
    delPhoto: (a) => {
      if (LIVE) { S.setup.files.splice(+a, 1); S.setup.previews.splice(+a, 1); return render(); }
      S.setup.photos = Math.max(0, S.setup.photos - 1); render();
    },
    toggleInterest: (a) => {
      const l = S.setup.interests;
      if (l.includes(a)) l.splice(l.indexOf(a), 1);
      else if (l.length < 7) l.push(a);
      else return toast(t("s6_max"));
      render();
    },

    photoPrev: () => { S.photoIdx = Math.max(0, S.photoIdx - 1); render(); },
    photoNext: () => { const p = currentQueue()[0]; S.photoIdx = Math.min(p.photos.length - 1, S.photoIdx + 1); render(); },
    openProfile: (a) => go("#/u/" + a),
    like: () => decide("like"),
    pass: () => decide("pass"),
    undo: () => {
      if (!S.plus) return openSheet(`<h2 class="t-h">${t("undo_title")}</h2><p class="t-sm t-muted" style="margin:8px 0 16px">${t("undo_text")}</p>
        <button class="btn btn--like btn--block" data-act="goto" data-arg="#/premium">${t("plus_more")}</button>`);
      const p = S.history.pop();
      if (!p) return toast(t("nothing_undo"));
      S.liked = S.liked.filter((x) => x !== p.id);
      S.queue.unshift(p); render();
    },
    note: () => {
      const p = currentQueue()[0];
      if (!p) return;
      if (S.likesLeft <= 0) return limitSheet();
      openSheet(`<h2 class="t-h">${t("note_title")}</h2>
        <p class="t-sm t-muted" style="margin:4px 0 12px">${t("note_lead", { name: esc(p.name) })}</p>
        <textarea class="textarea" id="n-text" maxlength="200" placeholder="${t("note_ph")}"></textarea>
        <button class="btn btn--primary btn--block" id="n-send" style="margin-top:12px" disabled>${t("note_send")}</button>`,
        (sh) => {
          const ta = sh.querySelector("#n-text"), b = sh.querySelector("#n-send");
          ta.oninput = () => { b.disabled = ta.value.trim().length < 2; };
          b.onclick = () => { const v = ta.value.trim(); closeSheet(); decide("like", v); };
        });
    },
    feedAll: () => { S.feedMode = "all"; if (LIVE) L.feed().then(render); else render(); },
    resetDeck: () => {
      if (LIVE) return L.feed().then(render); S.queue = clone(S.gender === "m" ? D.women : D.men).filter((p) => !S.blocked.includes(p.id)); S.history = []; render(); },
    unpause: () => { S.privacy.pause = false; if (LIVE) L.saveSettings({ privacy: S.privacy }); render(); toast(t("paused_off")); },

    matchChat: (a) => { document.querySelector(".match")?.remove(); go("#/chat/" + a); },
    matchClose: () => document.querySelector(".match")?.remove(),

    openPair: (a) => {
      const m = S.matches.find((x) => x.id === a);
      S.matches = S.matches.filter((x) => x.id !== a);
      S.chats.unshift({ id: "c-" + a, g: m.g, name: m.name, age: m.age, photos: m.photos, verified: m.verified, online: false, unread: 0, messages: [] });
      go("#/chat/c-" + a);
    },
    reveal: (a) => { S.revealed[a] = true; render(); },
    chatMenu: (a) => {
      const c = S.chats.find((x) => x.id === a);
      // сверху — что можно сделать вместе, ниже, через разделитель, — защита
      openSheet(`
        ${chatState(c) === "open" ? actRow("meet", I.calendar, t("meet_btn"), "", "row__icon--accent", a) : ""}
        ${chatState(c) === "open" ? actRow("contactOffer", I.key, t("contact_btn"), t("contact_sub"), "", a) : ""}
        ${actRow("sharePlan", I.share, t("s_share"), t("share_sub"), "", c.name)}
        ${c.profileId ? actRow("goto", I.idCard, t("open_profile"), "", "", "#/u/" + c.profileId) : ""}
        <div class="sheet__sep" role="separator"></div>
        ${actRow("unmatch", I.unlink, t("unmatch"), t("unmatch_sub"), "", a)}
        ${actRow("report", I.flag, t("report"), t("anon"), "row__icon--danger", a)}
        ${actRow("block", I.ban, t("block"), "", "", a)}`);
    },
    profileMenu: (a) => openSheet(`${actRow("report", I.flag, t("report"), t("anon"), "row__icon--danger", a)}${actRow("block", I.ban, t("block"), t("block_sub"), "", a)}`),
    unmatch: (a) => confirmSheet(t("unmatch_q"), t("unmatch_text"), "unmatchYes", t("unmatch"), a, t("keep")),
    unmatchYes: (a) => { if (LIVE) return L.unmatch(a); S.chats = S.chats.filter((c) => c.id !== a); go("#/chats"); toast(t("unmatch_done")); },
    report: (a) => openReport(a),
    block: (a) => confirmSheet(t("block_q"), t("block_text"), "blockYes", t("block"), a, t("cancel")),
    blockYes: (a) => doBlock(a),
    sharePlan: (a) => openSharePlan(a || ""),
    sharePlanMeet: (a) => {
      const [cid, i] = a.split(":");
      const c = S.chats.find((x) => x.id === cid), m = c && c.messages[+i];
      if (m) openSharePlan(c.name, t("pl_" + m.place), `${t("day_" + m.day)}, ${t("time_" + m.slot)}`);
    },
    meet: (a) => openMeet(a),
    inboxYes: (a) => { const p = findProfile(a); if (p) acceptIncoming(p); },
    inboxNo: (a) => { const p = findProfile(a); if (LIVE && p) return L.decide(p, "no"); S.inboxDone.push(a); TG.haptic("light"); toast(t("inbox_no_toast", { name: p ? p.name : "" })); go("#/likes"); render(); },
    inboxVerified: () => { S.inboxVerified = !S.inboxVerified; render(); },
    contactOffer: (a) => {
      const c = S.chats.find((x) => x.id === a); if (!c) return;
      if (LIVE) { toast(t("contact_sent_toast", { name: c.name })); return L.send(c.id, { kind: "contact" }); }
      const msg = { from: "me", type: "contact", status: "wait", time: new Date().toTimeString().slice(0, 5) };
      c.messages.push(msg); toast(t("contact_sent_toast", { name: c.name }));
      if (location.hash !== "#/chat/" + c.id) go("#/chat/" + c.id); else render();
      setTimeout(() => { msg.status = "ok"; if (location.hash === "#/chat/" + c.id) render(); }, 2000);
    },
    contactAccept: (a) => { if (LIVE) return L.respond(a, "accept"); const m = msgAt(a); if (m) { m.status = "ok"; TG.haptic("success"); render(); } },
    contactDecline: (a) => { if (LIVE) return L.respond(a, "decline"); const m = msgAt(a); if (m) { m.status = "declined"; render(); } },
    meetAccept: (a) => { if (LIVE) return L.respond(a, "accept"); const m = msgAt(a); if (m) { m.status = "ok"; TG.haptic("success"); toast(t("meet_ok")); render(); } },
    meetDecline: (a) => { if (LIVE) return L.respond(a, "decline"); const m = msgAt(a); if (m) { m.status = "declined"; toast(t("meet_declined_toast")); render(); } },
    meetCounter: (a) => { if (LIVE) return L.respond(a, "decline").then(() => openMeet(a.split(":")[0])); const m = msgAt(a); if (m) { m.status = "declined"; openMeet(a.split(":")[0]); } },
    blockedList: () => openSheet(`<h2 class="t-h">${t("s_blocked")}</h2><p class="t-sm t-muted" style="margin-top:8px">${S.blocked.length ? t("blocked_list_text") : t("blocked_empty")}</p>`),
    howReport: () => openSheet(`<h2 class="t-h">${t("s_how")}</h2><p class="t-sm t-muted" style="margin-top:8px">${t("how_report_text")}</p>`),

    applyFilters: () => {
      if (LIVE) return L.saveSettings({ filters: S.filters }).then(L.feed).then(() => { toast(t("applied")); go("#/feed"); render(); });
      toast(t("applied")); go("#/feed");
    },
    toggleGoal: (a) => { const g = S.filters.goals; g.includes(a) ? g.splice(g.indexOf(a), 1) : g.push(a); render(); },

    exportData: () => toast(t("export_toast")),
    consents: () => openSheet(`<h2 class="t-h">${t("p_consents")}</h2>
      <div class="group" style="margin:12px 0;background:var(--surface-2)">
        <div class="row"><span class="row__body"><span class="row__title">${t("c_pd")}</span>${sub(t("c_pd_sub"))}</span></div>
        <label class="row"><span class="row__body"><span class="row__title">${t("c_geo")}</span>${sub(t("c_geo_sub"))}</span><span class="switch"><input type="checkbox" checked><span class="switch__track"></span></span></label>
        <label class="row"><span class="row__body"><span class="row__title">${t("c_news")}</span></span><span class="switch"><input type="checkbox"><span class="switch__track"></span></span></label>
      </div>
      <p class="t-xs t-muted">${t("c_note")}</p>
      <button class="btn btn--ghost btn--block" data-act="deleteAccount">${t("c_revoke")}</button>`),
    deleteAccount: () => openSheet(`<h2 class="t-h">${t("d_title")}</h2>
      <ul class="bullets t-sm" style="margin:12px 0 16px">${["d1", "d2", "d3", "d4"].map((k) => `<li>${t(k)}</li>`).join("")}</ul>
      <button class="btn btn--danger btn--block" data-hold="deleteYes">${t("d_hold")}</button>
      <button class="btn btn--ghost btn--block" data-act="closeSheet">${t("d_keep")}</button>`),
    deleteYes: () => {
      if (LIVE) return API.del("/api/me").then(() => { S = fresh(); go("#/welcome"); render(); toast(t("d_done")); }).catch(() => toast(t("live_error")));
      S = fresh(); go("#/welcome"); toast(t("d_done")); },

    verifyStart: async () => {
      if (!LIVE) {   // прототип: жест выбираем сами
        const [icon, text] = DEMO_GESTURES[Math.floor(Math.random() * DEMO_GESTURES.length)];
        S.verify = { status: "none", gesture: { icon, text }, reason: "" }; return render();
      }
      try { const r = await API.post("/api/me/verify/start"); S.verify = { ...S.verify, gesture: r.gesture }; }
      catch (e) { toast(t("live_error")); }
      render();
    },
    verifySend: async (file) => {
      if (!LIVE) {   // прототип: «модератор» одобряет через несколько секунд, чтобы было видно весь путь
        S.verify = { status: "pending", gesture: null, reason: "" }; render();
        setTimeout(() => { S.verify.status = "verified"; S.verified = true; TG.haptic("success"); if (location.hash === "#/verify") render(); }, 4000);
        return;
      }
      const fd = new FormData(); fd.append("file", file);
      try { const r = await API.post("/api/me/verify", fd); S.verify = { ...r, gesture: null }; TG.haptic("success"); }
      catch (e) { toast(e.message === "no_gesture" ? t("v_expired") : e.message === "bad_photo" ? t("live_photo_bad") : t("live_error")); S.verify.gesture = null; }
      render();
    },
    setPlan: (a) => { S.plan = a; render(); },
    buy: () => LIVE ? toast(t("live_no_pay")) : TG.openInvoice(null, (status) => {
      if (status === "paid" || status === "demo") { S.plus = true; TG.haptic("success"); toast(t("plus_paid")); go("#/likes"); }
    }),

    demoOnly: () => toast(t("demo_only")),
    resetDemo: () => { S = fresh(); go("#/welcome"); },
  };

  document.addEventListener("click", (e) => {
    const seg = e.target.closest('[data-act-seg="lang"] button');
    if (seg) { I18N.setLang(seg.dataset.val); TG.haptic("select"); return render(); }
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const fn = ACT[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    if (el.closest("#sheet") && el.dataset.act !== "closeSheet") closeSheet();
    fn(el.dataset.arg);
  });
  document.addEventListener("change", (e) => {
    const inp = e.target.closest("[data-priv]");
    if (!inp) return;
    const k = inp.dataset.priv;
    S.privacy[k] = inp.checked;
    TG.haptic("select");
    if (LIVE && !location.hash.startsWith("#/setup")) L.saveSettings({ privacy: S.privacy });
    if (location.hash.startsWith("#/setup")) return;
    toast(k === "pause" ? t(inp.checked ? "paused_on" : "paused_off") : k === "incognito" ? t(inp.checked ? "incog_on" : "incog_off") : t("saved"));
  });
  // Необратимые действия подтверждаются удержанием кнопки (см. motion.js)
  document.addEventListener("hold-done", (e) => {
    const k = e.target.dataset.hold;
    closeSheet();
    if (ACT[k]) ACT[k]();
  });
  // Искры при «Взаимно» во входящих
  document.addEventListener("pointerdown", (e) => {
    const b = e.target.closest('[data-act="inboxYes"]');
    if (b && window.Motion) Motion.spark(b);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeSheet(); document.querySelector(".match")?.remove(); }
    if (location.hash === "#/feed" && !document.getElementById("sheet") && !e.target.closest("input, textarea")) {
      if (e.key === "ArrowRight") decide("like");
      if (e.key === "ArrowLeft") decide("pass");
    }
  });

  /* ================================================================
     РАБОЧИЙ РЕЖИМ: данные с сервера
     ================================================================ */
  const modBanner = () => (LIVE && S.live.state && S.live.state.hidden
    ? `<div class="notice notice--warn">${I.alert}<span>${t("mod_hidden", { r: esc(S.live.state.hiddenReason || "") })}</span></div>` : "");
  const vLoading = () => ({ html: `<main class="screen"><div class="empty">${I.lens("lens-mark welcome__lens")}<p class="t-muted t-sm">${t("live_loading")}</p></div></main>` });
  const ERR = {
    one_message_until_reply: () => t("rule_one_msg", null, S.gender),
    needs_conversation: () => t("live_needs_conv"),
    daily_likes_limit: () => t("limit_title"),
    restricted: () => t("mod_restricted", { d: S.live.state && S.live.state.restrictedUntil
      ? new Date(S.live.state.restrictedUntil * 1000).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) : "" }),
    banned: () => { setTimeout(() => L.boot(), 50); return t("mod_banned_title"); },
    contacts_in_note: () => t("live_contacts_note"),
    contacts_in_profile: () => t("live_contacts_note"),
  };
  const errText = (e) => (ERR[e && e.code] ? ERR[e.code]() : t("live_error"));
  const onScreen = (h) => location.hash === h;
  function rerenderKeepInput() {
    const inp = document.getElementById("msg");
    const v = inp ? inp.value : "", focused = inp && document.activeElement === inp;
    render();
    const again = document.getElementById("msg");
    if (again && v) again.value = v;
    if (again && focused) again.focus({ preventScroll: true });
  }

  const L = {
    applyMe(me) {
      S.gender = me.g;
      S.live.me = { name: me.name, age: me.age, photos: me.photos, goal: me.goal, interests: me.interests,
        height: me.height, job: me.job, prompts: me.prompts, city: me.city };
      S.verified = me.verified;
      S.privacy = { ...S.privacy, ...me.privacy };
      S.filters = { ...S.filters, ...me.filters };
      S.notif = { ...S.notif, ...me.notif };
      S.setup.work = me.work || "";
      S.setup.city = me.city || "";
      S.likesLeft = me.likesLeft;
      if (S.live.known === null) S.inboxVerified = S.gender === "f";
    },
    async boot() {
      app.innerHTML = vLoading().html;
      try {
        const r = await API.get("/api/me");
        S.live.state = r.state || {};
        S.verify = { ...S.verify, ...(r.verify || {}) };
        if (S.live.state.banned) {
          app.innerHTML = `<main class="screen"><div class="empty">${I.lens("lens-mark welcome__lens")}
            <h1 class="t-h">${t("mod_banned_title")}</h1>
            <p class="t-muted t-sm">${t("mod_banned_text", { r: esc(S.live.state.banReason || "") })}</p></div></main>`;
          return;
        }
        if (r.profile) {
          L.applyMe(r.profile);
          S.onboarded = true;
          await Promise.all([L.feed(), L.loadInbox(), L.chats()]);
          if (!location.hash || /^#\/(welcome|setup)/.test(location.hash)) location.hash = "#/feed";
        }
        render();
        setInterval(L.tick, 4000);
      } catch (e) {
        app.innerHTML = `<main class="screen"><div class="empty">${I.lens("lens-mark welcome__lens")}
          <h1 class="t-h">${t("live_auth_title")}</h1><p class="t-muted t-sm">${t("live_auth_text")}</p></div></main>`;
      }
    },
    async feed() {
      const r = await API.get("/api/feed?mode=" + S.feedMode);
      S.queue = r.items; S.live.picksLeft = r.picksLeft; S.likesLeft = r.likesLeft;
    },
    async loadInbox() {
      const r = await API.get("/api/inbox");
      S.live.incoming = r.items;
    },
    async chats() {
      const r = await API.get("/api/chats");
      const first = S.live.known === null;
      if (first) S.live.known = new Set();
      const fresh = [];
      S.chats = r.items.map((it) => {
        const old = S.chats.find((c) => c.id === it.id);
        if (!first && !S.live.known.has(it.id)) fresh.push(it);
        S.live.known.add(it.id);
        const messages = old && S.live.loaded[it.id] ? old.messages : it.last ? [it.last] : [];
        return { ...it, messages };
      });
      // Новая пара, которая появилась сама (другой человек ответил взаимностью) — показываем «Взаимно»
      if (fresh.length && !document.querySelector(".match") && !document.getElementById("sheet")) {
        const c = fresh[0];
        showMatch({ name: c.name, g: c.g, photos: c.photos }, null, false, c.id);
      }
    },
    async chat(id) {
      try {
        const r = await API.get("/api/chats/" + id);
        const i = S.chats.findIndex((c) => c.id === id);
        const before = i >= 0 ? JSON.stringify(S.chats[i].messages) : "";
        if (i >= 0) S.chats[i] = r; else S.chats.unshift(r);
        S.live.known && S.live.known.add(id);
        if (onScreen("#/chat/" + id) && before !== JSON.stringify(r.messages) && !document.getElementById("sheet")) rerenderKeepInput();
      } catch (e) {
        if (e.status === 404 && onScreen("#/chat/" + id)) { S.chats = S.chats.filter((c) => c.id !== id); go("#/chats"); }
      }
    },
    async swipe(p, kind, note) {
      try {
        const r = await API.post("/api/swipes", { target: p.id, action: kind, note: note || null });
        S.likesLeft = r.likesLeft;
        if (kind === "like") S.liked.push(p.id);
        if (S.queue.length < 3) await L.feed();
        if (r.match) {
          S.live.known && S.live.known.add(r.match);
          await L.chats();
          return showMatch(p, note, false, r.match);
        }
        if (note) toast(t("note_sent", { name: p.name }));
      } catch (e) {
        S.queue.unshift(p);
        if (e.code === "daily_likes_limit") limitSheet(); else toast(errText(e));
      }
      if (onScreen("#/feed")) render(); else go("#/feed");
    },
    async decide(p, decision) {
      try {
        const r = await API.post("/api/inbox/" + p.id, { decision });
        S.inboxDone.push(p.id);
        if (decision === "yes" && r.match) {
          S.live.known && S.live.known.add(r.match);
          await L.chats();
          return showMatch(p, null, true, r.match);
        }
        TG.haptic("light");
        toast(t("inbox_no_toast", { name: p.name }));
        go("#/likes"); render();
      } catch (e) { toast(errText(e)); }
    },
    async send(id, body) {
      try { await API.post("/api/chats/" + id + "/messages", body); TG.haptic("light"); }
      catch (e) { toast(errText(e)); }
      await L.chat(id);
      rerenderKeepInput();
    },
    async respond(ref, answer) {
      const m = msgAt(ref);
      if (!m) return;
      try { await API.post("/api/messages/" + m.id + "/respond", { answer }); if (answer === "accept") TG.haptic("success"); }
      catch (e) { toast(errText(e)); }
      await L.chat(ref.split(":")[0]);
      rerenderKeepInput();
    },
    async unmatch(id) {
      try { await API.del("/api/chats/" + id); } catch (e) { return toast(errText(e)); }
      S.chats = S.chats.filter((c) => c.id !== id);
      go("#/chats"); render(); toast(t("unmatch_done"));
    },
    forget(ref) {
      const c = S.chats.find((x) => x.id === ref || x.profileId === ref);
      S.chats = S.chats.filter((x) => x !== c);
      const pid = c ? c.profileId : ref;
      S.queue = S.queue.filter((p) => p.id !== pid);
      S.live.incoming = S.live.incoming.filter((p) => p.id !== pid);
    },
    async block(ref, silent) {
      try { await API.post("/api/blocks/" + ref); } catch (e) { return toast(errText(e)); }
      L.forget(ref);
      TG.haptic("warning");
      if (!silent) toast(t("blocked_toast"));
      go(location.hash.startsWith("#/chat") ? "#/chats" : "#/feed"); render();
    },
    async report(ref, reason, details, block) {
      try { await API.post("/api/reports", { target: ref, reason, details, block }); } catch (e) { return toast(errText(e)); }
      if (block) { L.forget(ref); go(location.hash.startsWith("#/chat") ? "#/chats" : "#/feed"); render(); }
      toast(block ? t("r_sent_block") : t("r_sent"));
    },
    async saveSettings(part) {
      try { const r = await API.patch("/api/me", part); if (r.profile) L.applyMe(r.profile); if (r.state) S.live.state = r.state; }
      catch (e) { toast(errText(e)); }
    },
    async profile(id) {
      if (S.live.pending[id]) return;
      S.live.pending[id] = true;
      try { S.live.cache[id] = await API.get("/api/profile/" + id); } catch (e) { S.live.cache[id] = null; }
      delete S.live.pending[id];
      if (onScreen("#/u/" + id)) render();
    },
    async createProfile() {
      const s = S.setup;
      const body = {
        name: s.name.trim(), birth: s.birth, gender: s.gender, goal: s.goal,
        prompts: s.answer.trim() ? [[s.prompt, s.answer.trim()]] : [],
        interests: s.interests, work: s.work || null, incognito: S.privacy.incognito,
        lat: s.geo === "gps" && s.coords ? s.coords.lat : null, lon: s.geo === "gps" && s.coords ? s.coords.lon : null,
        city: s.geo === "city" ? s.city.trim() : "Ташкент",
      };
      try {
        await API.post("/api/me", body);
        for (const f of s.files) {
          const fd = new FormData(); fd.append("file", f);
          try { await API.post("/api/me/photos", fd); } catch (e) { toast(t("live_photo_bad")); }
        }
        const r = await API.get("/api/me");
        L.applyMe(r.profile);
        S.onboarded = true;
        await Promise.all([L.feed(), L.loadInbox(), L.chats()]);
        TG.haptic("success");
        go("#/feed"); render();
        toast(t("setup_done_live"));   // модерации в тестовой версии пока нет — не обещаем её
      } catch (e) {
        toast(errText(e));
        render();
      }
    },
    // При переходе на экран — сразу свежие данные, не дожидаясь опроса
    async onRoute() {
      if (!S.onboarded) return;
      const h = location.hash;
      try {
        if (h === "#/chats") { await L.chats(); if (onScreen(h)) render(); }
        if (h === "#/likes") { await L.loadInbox(); if (onScreen(h)) render(); }
        if (h === "#/verify") {   // решение модератора могло прийти, пока экран был закрыт
          const v = await API.get("/api/me/verify");
          S.verify = { ...S.verify, ...v }; if (v.status === "verified") S.verified = true;
          if (onScreen(h)) render();
        }
        const cm = h.match(/^#\/chat\/([\w-]+)$/);
        if (cm) await L.chat(cm[1]);
      } catch (e) { /* покажем то, что есть */ }
    },
    n: 0,
    async tick() {
      if (document.hidden || !S.onboarded) return;
      L.n += 1;
      const h = location.hash;
      const m = h.match(/^#\/chat\/([\w-]+)$/);
      try {
        if (m) await L.chat(m[1]);
        if (L.n % 3 === 0) {
          await Promise.all([L.chats(), L.loadInbox()]);
          const typing = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
          if ((h === "#/chats" || h === "#/likes") && !typing && !document.getElementById("sheet")) render();
        }
      } catch (e) { /* сеть моргнула — попробуем в следующий раз */ }
    },
  };

  /* ================================================================
     МАРШРУТЫ
     ================================================================ */
  const TABS = [
    ["#/feed", "tab_feed", I.cards],
    ["#/likes", "tab_likes", I.heart, () => incoming().length],
    ["#/chats", "tab_chats", I.chat, unreadTotal],
    ["#/me", "tab_me", I.user],
  ];
  const ROUTES = [
    [/^\/welcome$/, vWelcome],
    [/^\/setup\/(\d)$/, vSetup],
    [/^\/feed$/, vFeed, true],
    [/^\/u\/(\w+)$/, vProfile],
    [/^\/likes$/, vLikes, true],
    [/^\/chats$/, vChats, true],
    [/^\/chat\/([\w-]+)$/, vChat],
    [/^\/me$/, vMe, true],
    [/^\/filters$/, vFilters],
    [/^\/privacy$/, vPrivacy],
    [/^\/safety$/, vSafety],
    [/^\/notifications$/, vNotif],
    [/^\/verify$/, vVerify],
    [/^\/premium$/, vPremium],
  ];

  let lastPath = "";
  function render() {
    // только сам экран: служебный хвост Telegram («&tgWebApp…») отбрасываем
    let path = (location.hash.match(/^#(\/[^?&#]*)/) || [])[1] || "/welcome";
    if (!S.onboarded && !/^\/(welcome|setup)/.test(path)) path = "/welcome";
    let view = null, arg, tab = false;
    for (const [rx, fn, isTab] of ROUTES) {
      const m = path.match(rx);
      if (m) { view = fn; arg = m[1]; tab = !!isTab; break; }
    }
    // Непонятный адрес — не «анкета недоступна», а просто лента (или начало, если анкеты ещё нет)
    if (!view) { history.replaceState(null, "", "#" + (S.onboarded ? "/feed" : "/welcome")); return render(); }
    const v = view(arg);
    const tabbar = tab ? `<nav class="tabbar" aria-label="${t("nav_aria")}">${TABS.map(([h, key, ic, cnt]) => {
      const n = cnt ? cnt() : 0;
      return `<a href="${h}" data-tab="${h.slice(2)}" ${"#" + path === h ? 'aria-current="page"' : ""}>${ic}<span>${t(key)}</span>${n ? `<span class="counter">${n > 99 ? "99+" : n}</span>` : ""}</a>`;
    }).join("")}</nav>` : "";
    // Основная тема светлая; тёмная — когда человек указал «Мужчина»
    TG.setTheme((S.onboarded ? S.gender : S.setup.gender) === "m");
    app.innerHTML = v.html + tabbar;
    app.classList.toggle("has-tabbar", tab);
    const changed = path !== lastPath;
    if (changed) { window.scrollTo(0, 0); closeSheet(); }
    lastPath = path;
    TG.back(!tab && path !== "/welcome", ACT.back);
    v.mount && v.mount();
    window.Motion && Motion.afterRender(changed);
  }

  I18N.setLang(I18N.initialLang(TG.userLang()));
  window.addEventListener("hashchange", () => { render(); if (LIVE) L.onRoute(); });
  // Telegram дописывает к адресу свои служебные данные (#tgWebAppData=… или …&tgWebAppVersion=…).
  // Данные входа он к этому моменту уже прочитал — оставляем в адресе только сам экран, например #/feed.
  (function cleanHash() {
    const raw = location.hash;
    const m = raw.match(/^#(\/[^?&#]*)/);
    const route = m ? m[1] : "";
    if (raw !== (route ? "#" + route : "")) history.replaceState(null, "", location.pathname + location.search + (route ? "#" + route : ""));
  })();
  TG.init();
  if (LIVE) L.boot(); else render();
})();
