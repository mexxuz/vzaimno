/* Связь мини-приложения с сервером.
   Каждый запрос несёт подписанные данные Telegram — сервер проверяет подпись
   и так узнаёт, кто это. В браузере на этом же компьютере для проверки
   можно открыть ?dev=1&uid=1 (работает только при прямом адресе 127.0.0.1). */
(function () {
  const qs = new URLSearchParams(location.search);

  function auth() {
    const h = window.TG && TG.authHeader();
    if (h) return h;
    if (qs.has("dev")) return "dev " + (qs.get("uid") || "1");
    return null;
  }

  async function call(method, path, body) {
    const headers = { Authorization: auth() || "" };
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
    const res = await fetch(path, { method, headers, body: payload });
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
    get: (p) => call("GET", p),
    post: (p, b) => call("POST", p, b === undefined ? {} : b),
    patch: (p, b) => call("PATCH", p, b),
    del: (p) => call("DELETE", p),
  };
})();
