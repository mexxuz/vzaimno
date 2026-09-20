/* Иконки: линейные, 24×24, толщина 2. Цвет — currentColor. */
(function () {
  const p = (d, extra = "") =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;

  window.I = {
    heart: p('<path d="M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.8 3.8 4.5 7.2 4.5c2 0 3.5 1.1 4.8 2.9 1.3-1.8 2.8-2.9 4.8-2.9 3.4 0 5.6 3.3 4.4 6.7-1.7 4.7-9.2 9.3-9.2 9.3z"/>'),
    heartFill: p('<path fill="currentColor" d="M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.8 3.8 4.5 7.2 4.5c2 0 3.5 1.1 4.8 2.9 1.3-1.8 2.8-2.9 4.8-2.9 3.4 0 5.6 3.3 4.4 6.7-1.7 4.7-9.2 9.3-9.2 9.3z"/>'),
    female: p('<circle cx="12" cy="9" r="5.5"/><path d="M12 14.5V22M8.5 18.5h7"/>'),
    male: p('<circle cx="10" cy="14" r="5.5"/><path d="M14 10l6.5-6.5M15 3.5h5.5V9"/>'),
    x: p('<path d="M6 6l12 12M18 6L6 18"/>'),
    star: p('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>'),
    undo: p('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>'),
    sliders: p('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
    // анкета: карточка с человечком и строчками — «открыть анкету целиком»
    idCard: p('<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="8.5" cy="10.5" r="2"/><path d="M5.5 16c.6-1.5 1.7-2.3 3-2.3s2.4.8 3 2.3M14 10h4M14 13.5h3"/>'),
    // облачко с сердцем — «симпатия с сообщением» (не путать с чатом)
    chatHeart: p('<path d="M20 12a8 8 0 01-11.6 7.1L4 20l1-4.1A8 8 0 1120 12z"/><path fill="currentColor" stroke="none" d="M12 15.6s-3.4-2-4.1-4.1c-.5-1.5.5-3 2-3 .9 0 1.6.5 2.1 1.3.5-.8 1.2-1.3 2.1-1.3 1.5 0 2.5 1.5 2 3-.7 2.1-4.1 4.1-4.1 4.1z"/>'),
    chat: p('<path d="M20 12a8 8 0 01-11.6 7.1L4 20l1-4.1A8 8 0 1120 12z"/>'),
    user: p('<circle cx="12" cy="8" r="4"/><path d="M4 20.5c1.4-3.5 4.4-5.5 8-5.5s6.6 2 8 5.5"/>'),
    cards: p('<rect x="6" y="3" width="12" height="17" rx="3"/><path d="M3 7v11a3 3 0 003 3h9"/>'),
    shield: p('<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z"/>'),
    shieldCheck: p('<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'),
    verified: p('<path fill="currentColor" stroke="none" d="M12 1.8l2.4 1.8 3-.2.9 2.8 2.5 1.7-1 2.9 1 2.8-2.5 1.8-.9 2.8-3-.2L12 20l-2.4-1.8-3 .2-.9-2.8-2.5-1.8 1-2.8-1-2.9 2.5-1.7.9-2.8 3 .2z"/><path stroke="#fff" d="M8.3 11l2.5 2.5 4.9-5"/>'),
    pin: p('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
    right: p('<path d="M9 5l7 7-7 7"/>'),
    left: p('<path d="M15 5l-7 7 7 7"/>'),
    more: p('<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>'),
    // отправить: стрелка вверх, чуть толще остальных — главное действие в переписке
    send: p('<path stroke-width="2.6" d="M12 19.5V5M5.5 11.5L12 5l6.5 6.5"/>'),
    camera: p('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
    lock: p('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/>'),
    eyeOff: p('<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0112 5c5.5 0 9 7 9 7a16.7 16.7 0 01-2.6 3.6M6.5 6.6C4.2 8.2 3 12 3 12s3.5 7 9 7c1.6 0 3-.4 4.3-1.1"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/>'),
    eye: p('<path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z"/><circle cx="12" cy="12" r="3"/>'),
    flag: p('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
    ban: p('<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>'),
    trash: p('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    download: p('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
    bell: p('<path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 004 0"/>'),
    help: p('<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>'),
    plus: p('<path d="M12 5v14M5 12h14"/>'),
    sparkle: p('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>'),
    info: p('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><circle cx="12" cy="8" r=".6" fill="currentColor"/>'),
    alert: p('<path d="M12 4l9 16H3z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>'),
    image: p('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-9 8.5"/>'),
    target: p('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>'),
    ruler: p('<path d="M4 16L16 4l4 4L8 20z"/><path d="M8 12l2 2M11 9l2 2M14 6l2 2"/>'),
    clock: p('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    share: p('<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>'),
    phone: p('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a1.5 1.5 0 01-1.6 1.5A16.5 16.5 0 013.5 5.6 1.5 1.5 0 015 4z"/>'),
    unlink: p('<path d="M9 17H7a5 5 0 010-10h2M15 7h2a5 5 0 014 7.9M8 12h3M3 3l18 18"/>'),
    book: p('<path d="M4 5a2 2 0 012-2h13v15H6a2 2 0 00-2 2z"/><path d="M4 20a2 2 0 002 2h13v-4"/>'),
    key: p('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>'),
    globe: p('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.3 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.3-3.5-8.5s1-5.9 3.5-8.5z"/>'),
    briefcase: p('<rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><path d="M9 7.5V5.5a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 5.5v2M3.5 12.5h17"/>'),
    calendar: p('<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><circle cx="12" cy="15" r="1.3" fill="currentColor"/>'),
    hand: p('<path d="M8 13V5.5a1.5 1.5 0 013 0V11M11 10.5V4a1.5 1.5 0 013 0v6.5M14 10.5V5.5a1.5 1.5 0 013 0V14a7 7 0 01-7 7h-.5a6 6 0 01-5-2.7L3 15.5a1.5 1.5 0 012.5-1.7L8 16"/>'),
  };

  /* Знак «Лента»: сердце из двух линий — фиолетовой и розовой, два человека.
     Внизу линии перекрещиваются, как завязанная лента. */
  window.I.lens = (cls = "lens-mark") =>
    `<svg class="${cls}" viewBox="0 0 64 44" aria-hidden="true"><path class="h-l" pathLength="1" d="M32 12C30 7.5 26.5 5 22.5 5C16.5 5 12.5 10 13.5 17C15 26.5 25.5 33.5 36 41"/><path class="h-r" pathLength="1" d="M32 12C34 7.5 37.5 5 41.5 5C47.5 5 51.5 10 50.5 17C49 26.5 38.5 33.5 28 41"/></svg>`;
})();
