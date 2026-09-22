/* Связь мини-приложения с сервером.
   Приложение живёт на постоянном адресе (страница на GitHub Pages), а сервер —
   на временном: его адрес лежит рядом со страницей в файле ../server.json, сервер
   сам вписывает его туда при каждом запуске. Если приложение открыто прямо с сервера
   (127.0.0.1 или временный адрес, путь /app/), сервер — это тот же адрес.
   Каждый запрос несёт подписанные данные Telegram — сервер проверяет подпись
   и так узнаёт, кто это. В браузере на этом же компьютере для проверки
   можно открыть ?dev=1&uid=1 (работает только при прямом адресе 127.0.0.1). */
(function () {
  const qs = new URLSearchParams(location.search);
  // Открыто с самого сервера: путь /app/… и это не страница GitHub
  const SELF_HOSTED = /^\/app\//.test(location.pathname) && !/github\.io$/.test(location.hostname);
  const SERVER_FILE = new URL("../server.json", location.href).href;
  let base = SELF_HOSTED ? location.origin : "";

  // Узнать адрес сервера. Метка времени в адресе — чтобы не получить старый файл из кэша
  async function discover() {
    if (SELF_HOSTED) return base;
    try {
      const r = await fetch(SERVER_FILE + "?t=" + Date.now(), { cache: "no-store" });
      const j = await r.json();
      if (j && j.server) base = String(j.server).replace(/\/$/, "");
    } catch (_) { /* нет файла — значит, сервера нет, приложение покажет ошибку при первом запросе */ }
    return base;
  }
  let ready = discover();

  function auth() {
    const h = window.TG && TG.authHeader();
    if (h) return h;
    if (qs.has("dev")) return "dev " + (qs.get("uid") || "1");
    return null;
  }

  async function call(method, path, body, retried) {
    await ready;
    const headers = { Authorization: auth() || "" };
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
    let res;
    try {
      res = await fetch(base + path, { method, headers, body: payload });
    } catch (e) {
      // Сервер не отвечает: возможно, он перезапустился и сменил адрес —
      // перечитываем server.json и пробуем ещё раз, один раз
      if (!retried && !SELF_HOSTED) { ready = discover(); return call(method, path, body, true); }
      throw e;
    }
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      const err = new Error((data && data.error) || "http_" + res.status);
      err.status = res.status;
      err.code = (data && data.error) || "";
      throw err;
    }
    return data;
  }

  window.API = {
    hasAuth: () => !!auth(),
    ready: () => ready,
    // Полный адрес для ссылок, которые сервер отдаёт относительными (фото)
    url: (p) => (/^https?:/.test(p) ? p : base + p),
    get: (p) => call("GET", p),
    post: (p, b) => call("POST", p, b === undefined ? {} : b),
    patch: (p, b) => call("PATCH", p, b),
    del: (p) => call("DELETE", p),
  };
})();
