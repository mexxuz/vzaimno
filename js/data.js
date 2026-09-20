/* Демо-данные для прототипа: Ташкент. Люди вымышленные, фото — цветные заглушки.
   Пока тестируем только на русском — и тексты анкет тоже на русском.
   Начала фраз (prompts), интересы и цели — ключи, их переводит i18n.js.
   В рабочей версии всё это приходит с сервера. */
(function () {
  const palettes = [
    ["#6a4cf5", "#ff9f5a"], ["#2b6f8f", "#9fd8c6"], ["#8a3b6e", "#f4a6b8"],
    ["#3d2e5c", "#7fb5ff"], ["#b0513a", "#f5c56b"], ["#256b52", "#c7e37a"],
    ["#5a3fb0", "#f08bc5"], ["#1f4d7a", "#ffb38a"],
  ];

  // Анкеты женщин — их видят мужчины
  const women = [
    {
      id: "w1", work: "mirabad", g: "f", name: "Малика", age: 26, km: 2, verified: true, online: true,
      note: "Спорим, ташкентский плов лучше? 🙂",
      goal: "family", height: 165, job: "Врач-стоматолог", likedMe: true, photos: [0, 2, 6],
      prompts: [
        ["sunday", "плов у родителей, потом прогулка по Анхору и кофе где-нибудь на Сайилгохе."],
        ["laugh", "начать спорить, чей плов лучше — ташкентский или самаркандский."],
      ],
      interests: ["plov", "cinema", "walks", "coffee", "books"],
    },
    {
      id: "w2", work: "yunusabad", g: "f", name: "Дилноза", age: 28, km: 5, verified: true, online: false,
      goal: "serious", height: 170, job: "IT-менеджер проектов", likedMe: false, photos: [1, 5],
      prompts: [
        ["seek", "не боится ранних подъёмов и умеет заваривать хороший кофе."],
        ["weekend", "в Чимгане или в книжном магазине."],
      ],
      interests: ["running", "mountains", "books", "coffee", "it"],
    },
    {
      id: "w3", work: "mirabad", g: "f", name: "Камила", age: 24, km: 1, verified: false, online: true,
      goal: "undecided", height: null, job: "Студентка", likedMe: false, photos: [6, 3, 4],
      prompts: [["bet", "я знаю лучшую самсу в радиусе трёх станций метро."]],
      interests: ["boardgames", "standup", "walks", "games"],
    },
    {
      id: "w4", work: "chilanzar", g: "f", name: "Нигора", age: 29, km: 8, verified: true, online: false,
      goal: "family", height: 162, job: "Учитель английского", likedMe: true, photos: [4, 0],
      prompts: [
        ["green", "человек, который не стесняется сказать «не знаю»."],
        ["sunday", "завтрак с семьёй, потом прогулка по площади Мустакиллик."],
      ],
      interests: ["languages", "cooking", "travel", "cinema"],
    },
    {
      id: "w5", work: "yakkasaray", g: "f", name: "Севара", age: 25, km: 3, verified: true, online: true,
      goal: "serious", height: 160, job: "Иллюстратор", likedMe: false, photos: [7, 2],
      prompts: [["bold", "уехала рисовать в Хиву на месяц. Рассветы там — отдельный вид искусства."]],
      interests: ["drawing", "cats", "travel", "museums"],
    },
  ];

  // Анкеты мужчин — их видят женщины
  const men = [
    {
      id: "m1", work: "mirabad", g: "m", name: "Жасур", age: 29, km: 2, verified: true, online: true,
      note: "Тоже люблю Анхор по вечерам. Какой плов, по-твоему, лучший в Ташкенте?",
      goal: "family", height: 180, job: "Инженер-строитель", likedMe: true, photos: [3, 1, 7],
      prompts: [
        ["sunday", "футбол с друзьями утром, потом плов в Беш-Козоне."],
        ["seek", "любит горы и не боится выезжать в Чимган в пять утра."],
      ],
      interests: ["football", "mountains", "plov", "cinema", "travel"],
    },
    {
      id: "m2", work: "mirzo", g: "m", name: "Бобур", age: 31, km: 6, verified: true, online: false,
      goal: "serious", height: 176, job: "Программист", likedMe: false, photos: [5, 0],
      prompts: [["weekend", "на велосипеде в сторону Богишамала или дома за пловом."]],
      interests: ["it", "cycling", "cooking", "games"],
    },
    {
      id: "m3", work: "mirabad", g: "m", name: "Шерзод", age: 27, km: 1, verified: false, online: true,
      goal: "undecided", height: 184, job: "Фотограф", likedMe: false, photos: [7, 4],
      prompts: [["bet", "сниму ваш лучший портрет прямо на Бродвее."]],
      interests: ["photo", "walks", "music", "coffee"],
    },
    {
      id: "m4", work: "shayhan", g: "m", name: "Отабек", age: 30, km: 9, verified: true, online: false,
      note: "Вижу, вы учите языки. Я сейчас мучаю испанский — есть советы?",
      goal: "family", height: 178, job: "Врач", likedMe: true, photos: [2, 6],
      prompts: [["green", "уважает родителей и имеет своё мнение."]],
      interests: ["books", "running", "travel", "languages"],
    },
    {
      id: "m5", work: "yunusabad", g: "m", name: "Санжар", age: 26, km: 4, verified: true, online: true,
      goal: "serious", height: 181, job: "Маркетолог", likedMe: false, photos: [1, 3],
      prompts: [["laugh", "вспомнить, как я пытался говорить по-узбекски с бабушкой из Ферганы."]],
      interests: ["standup", "cinema", "football", "dance"],
    },
  ];

  // Отметили анкету, но в ленту ещё не попадали: только во «Входящих»
  const extraIncoming = {
    f: [
      { id: "m6", work: "sergeli", g: "m", name: "Дамир", age: 34, km: 12, verified: false, online: true, likedMe: true,
        note: "Привет красотка, дай номер", goal: "undecided", height: 175, job: "Предприниматель", photos: [4, 6],
        prompts: [["bet", "угадаю ваш знак зодиака с трёх раз."]], interests: ["cinema", "travel"] },
      { id: "m7", work: "mirabad", g: "m", name: "Ильдар", age: 28, km: 3, verified: true, online: false, likedMe: true,
        goal: "family", height: 183, job: "Инженер-электрик", photos: [5, 1],
        prompts: [["sunday", "горы с утра, вечером — ужин с родителями."]], interests: ["mountains", "books", "cooking", "cinema"] },
    ],
    m: [],
  };

  const me = {
    m: { name: "Азиз", age: 29, photos: [3, 1], goal: "family", height: 182, job: "Инженер",
         interests: ["cinema", "coffee", "travel", "running", "plov"],
         prompts: [["sunday", "велосипед до Ботанического сада, потом готовлю что-нибудь новое."]] },
    f: { name: "Мадина", age: 26, photos: [2, 6], goal: "serious", height: 164, job: "Дизайнер",
         interests: ["cinema", "coffee", "travel", "books", "walks"],
         prompts: [["sunday", "завтрак на террасе, книга и долгая прогулка по Анхору."]] },
    city: "Ташкент",
    completeness: 70,
  };

  const matches = {
    m: [{ id: "n1", g: "f", name: "Лола", age: 27, photos: [5], verified: true }],
    f: [{ id: "n2", g: "m", name: "Фаррух", age: 28, photos: [7], verified: true }],
  };

  const scamText = "Я тут редко бываю, пиши мне лучше сюда: t.me/+invest_uz — расскажу, как я зарабатываю на крипте 💸";

  const chats = {
    m: [
      { id: "c4", g: "f", name: "Ксения", age: 27, photos: [7], verified: true, online: false, unread: 0, expires: 5, messages: [
        { from: "me", text: "Привет! Ты тоже была в Хиве? Как тебе рассветы?", time: "18:10" },
      ] },
      { id: "c5", g: "f", name: "Зарина", age: 25, photos: [2], verified: true, online: false, unread: 0, herFirst: true, expires: 7, messages: [] },
      { id: "c1", g: "f", name: "Гулнора", age: 27, photos: [0], verified: true, online: true, unread: 2, messages: [
        { from: "them", text: "Привет! Видела, ты тоже любишь старое кино 🙂", time: "19:02" },
        { from: "me", text: "Привет! Да, недавно пересматривал «Ташкент — город хлебный»", time: "19:05" },
        { from: "them", text: "В субботу в парке будет кино под открытым небом", time: "19:06" },
        { from: "them", type: "photo", sensitive: true, time: "19:07" },
      ] },
      { id: "c2", g: "f", name: "Кристина", age: 30, photos: [4], verified: false, online: false, unread: 1, messages: [
        { from: "them", text: "Привет, ты такой милый 😍", time: "12:40" },
        { from: "them", text: scamText, time: "12:41", flagged: "scam" },
      ] },
      { id: "c3", g: "f", name: "Шахноза", age: 26, photos: [1], verified: true, online: false, unread: 0, messages: [
        { from: "me", text: "Тогда до четверга! Кофейня на Сайилгохе, 19:30", time: "16.09" },
        { from: "them", text: "Договорились ☕", time: "16.09" },
      ] },
    ],
    f: [
      { id: "c4", g: "m", name: "Рустам", age: 30, photos: [5], verified: true, online: true, unread: 1, expires: 6, messages: [
        { from: "them", text: "Привет! Увидел, что ты любишь книги. Что сейчас читаешь?", time: "18:40" },
      ] },
      { id: "c1", g: "m", name: "Тимур", age: 29, photos: [3], verified: true, online: true, unread: 2, messages: [
        { from: "them", text: "Привет! Вижу, ты тоже любишь старое кино 🙂", time: "19:02" },
        { from: "me", text: "Привет! Да, недавно пересматривала «Ташкент — город хлебный»", time: "19:05" },
        { from: "them", text: "В субботу в парке будет кино под открытым небом", time: "19:06" },
        { from: "them", type: "photo", sensitive: true, time: "19:07" },
        { from: "them", type: "meet", day: "weekend", slot: "late", place: "city", status: "wait", time: "19:08" },
      ] },
      { id: "c2", g: "m", name: "Алекс", age: 33, photos: [4], verified: false, online: false, unread: 1, messages: [
        { from: "them", text: "Привет, ты очень красивая 😍", time: "12:40" },
        { from: "them", text: scamText, time: "12:41", flagged: "scam" },
      ] },
      { id: "c3", g: "m", name: "Улугбек", age: 28, photos: [1], verified: true, online: false, unread: 1, tg: "@ulugbek_demo", messages: [
        { from: "me", text: "Тогда до четверга! Кофейня на Сайилгохе, 19:30", time: "16.09" },
        { from: "them", text: "Договорились ☕", time: "16.09" },
        { from: "them", type: "contact", status: "wait", time: "16.09" },
      ] },
    ],
  };

  const likesCount = 12;
  const goals = ["family", "serious", "friends", "undecided"];
  const interestsAll = ["cinema", "music", "coffee", "travel", "running", "yoga", "boardgames", "books", "cooking", "plov",
    "museums", "standup", "football", "cycling", "cats", "dogs", "photo", "theatre", "mountains", "dance", "languages", "games", "drawing", "walks", "it"];
  const prompts = ["sunday", "seek", "bet", "laugh", "weekend", "bold", "green"];

  // Районы Ташкента: для «рядом с работой» храним только район, не адрес
  const districts = ["almazar", "bektemir", "mirabad", "mirzo", "sergeli", "uchtepa", "chilanzar",
    "shayhan", "yunusabad", "yakkasaray", "yashnabad", "yangihayot"];
  // Людные общественные места для предложения встречи
  const places = ["amir", "city", "broadway", "botanic"];
  const DAILY_LIKES = 25;
  const PICKS = 5;

  window.DATA = { palettes, women, men, extraIncoming, me, matches, chats, likesCount, goals, interestsAll, prompts, districts, places, DAILY_LIKES, PICKS };
})();
