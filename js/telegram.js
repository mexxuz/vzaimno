/* Прослойка между приложением и Telegram.
   Внутри Telegram — берёт тему, кнопку «Назад», вибрацию и подписанные данные входа.
   В обычном браузере — всё то же самое работает заглушками, чтобы прототип открывался везде. */
(function () {
  const wa = window.Telegram && window.Telegram.WebApp;
  const inTelegram = !!(wa && wa.initData);

  /* Тему выбирает само приложение (светлая, тёмная — для мужчин), а не Telegram.
     Здесь только перекрашиваем шапку и фон Telegram под текущую тему. */
  function applyTheme() {
    if (inTelegram) {
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
      try { wa.setHeaderColor(bg); wa.setBackgroundColor(bg); wa.setBottomBarColor && wa.setBottomBarColor(bg); } catch (_) {}
    }
  }

  const TG = {
    inTelegram,

    init() {
      if (!inTelegram) return;
      wa.ready();
      wa.expand();
      // Иначе свайп карточки вниз сворачивает всё приложение
      if (wa.disableVerticalSwipes) wa.disableVerticalSwipes();
      // Спросить подтверждение перед закрытием, если человек что-то печатает
      if (wa.enableClosingConfirmation) wa.enableClosingConfirmation();
      applyTheme();
    },

    applyTheme,

    /* dark = true — тёмная тема, false — светлая (основная) */
    setTheme(dark) {
      const want = dark ? "dark" : "light";
      if (document.documentElement.dataset.theme === want) return;
      document.documentElement.dataset.theme = want;
      applyTheme();
    },

    /* Язык интерфейса Telegram — только чтобы выбрать язык по умолчанию */
    userLang() {
      try { return (wa && wa.initDataUnsafe && wa.initDataUnsafe.user && wa.initDataUnsafe.user.language_code) || navigator.language.slice(0, 2); }
      catch (_) { return "ru"; }
    },

    /* Подписанная строка входа. Её отправляют на сервер как есть,
       а сервер проверяет подпись (server/app/security/telegram_auth.py).
       Данным initDataUnsafe на клиенте доверять нельзя — их можно подделать. */
    authHeader() {
      return inTelegram ? "tma " + wa.initData : null;
    },

    back(show, onClick) {
      if (!inTelegram) return;
      wa.BackButton.offClick(TG._backHandler || (() => {}));
      if (show) {
        TG._backHandler = onClick;
        wa.BackButton.onClick(onClick);
        wa.BackButton.show();
      } else {
        wa.BackButton.hide();
      }
    },

    haptic(kind) {
      if (!inTelegram || !wa.HapticFeedback) return;
      if (kind === "success" || kind === "warning" || kind === "error") wa.HapticFeedback.notificationOccurred(kind);
      else if (kind === "select") wa.HapticFeedback.selectionChanged();
      else wa.HapticFeedback.impactOccurred(kind || "light");
    },

    /* Оплата звёздами Telegram. Счёт создаёт сервер (createInvoiceLink),
       клиент только открывает его. */
    openInvoice(url, cb) {
      if (inTelegram && url) wa.openInvoice(url, cb);
      else cb && cb("demo");
    },

    /* Поделиться планом встречи с другом — через штатное окно Telegram */
    shareText(text) {
      const url = "https://t.me/share/url?url=" + encodeURIComponent(" ") + "&text=" + encodeURIComponent(text);
      if (inTelegram) wa.openTelegramLink(url);
      else window.open(url, "_blank", "noopener");
    },
  };

  window.TG = TG;
})();
