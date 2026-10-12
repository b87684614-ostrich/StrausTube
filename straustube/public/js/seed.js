'use strict';

/**
 * StrausTube — демонстрационные данные.
 *
 * При первом запуске в localStorage создаётся небольшая «галерея»:
 * несколько каналов, роликов, комментариев и подписок. Все медиа лежат
 * в /assets/demo и сгенерированы локально — внешних источников нет.
 * Демо можно удалить в любой момент из меню профиля.
 */
(function (global) {
  const S = (global.StrausTube = global.StrausTube || {});

  const DEMO_PASSWORD = 'anya1234';
  const ADMIN_KEY = 'straus-vq7f-iwvy';
  const ADMIN_KEY_HINT = 'straus-____-____';

  const USERS = [
    {
      ref: 'anya', name: 'Аня Орлова', handle: '@anya', accent: '#7e57c2',
      bio: 'Собираю спокойные визуальные зарисовки. Фьорды, дождь, лоу-фай — всё для тихих вечеров.',
      subsBase: 1482, days: 420,
    },
    {
      ref: 'kirill', name: 'Кирилл Ветров', handle: '@kirill', accent: '#0f9d58',
      bio: 'Снимаю природу и рассказываю, как это устроено изнутри. Экспедиции, свет, ветер и терпение.',
      subsBase: 20340, days: 900,
    },
    {
      ref: 'mira', name: 'Мира Соколова', handle: '@mira', accent: '#ff8a00',
      bio: 'Режиссёр короткого метра. Люблю неон, ночные города и монтаж, который незаметен.',
      subsBase: 8940, days: 610,
    },
    {
      ref: 'teo', name: 'Тео Ларсен', handle: '@teo', accent: '#2196f3',
      bio: 'Техно-канал: серверы, железо, домашние студии. Объясняю без снобизма.',
      subsBase: 32680, days: 1100,
    },
    {
      ref: 'nika', name: 'Ника Белова', handle: '@nika', accent: '#e91e63',
      bio: 'Абстракции, градиенты и паки визуалов для монтажа. Всё из моей мастерской.',
      subsBase: 5230, days: 240,
    },
  ];

  const VIDEOS = [
    {
      ref: 'v-fjord', author: 'anya', title: 'Закат над фьордом: минута спокойствия',
      category: 'nature', cover: 'clip-fjord.jpg', media: 'clip-fjord.mp4', duration: 45,
      views: 1284, baseLikes: 214, baseDislikes: 3, days: 12,
      description: 'Одна минута, чтобы выдохнуть. Небо над фьордом меняет цвет каждые несколько секунд — я записал это медленно, без музыки и спешки.\n\nТаймкоды:\n0:00 — первые лучи\n0:20 — пик цвета\n0:38 — синяя дымка\n\nСнято локально, смонтировано в той же комнате, где я это публикую.',
    },
    {
      ref: 'v-aurora', author: 'kirill', title: 'Северное сияние: как рождается зелёный свет',
      category: 'nature', cover: 'clip-waves.jpg', media: 'clip-waves.mp4', duration: 45,
      views: 4521, baseLikes: 731, baseDislikes: 12, days: 34,
      description: 'Разбираю вулканическую природу полярного сияния простыми словами и показываю, как зелёный, бирюзовый и фиолетовый слои появляются на разной высоте.\n\nЕсли хотите глубже — напишите в комментариях, соберу отдельный выпуск про солнечный ветер.',
    },
    {
      ref: 'v-neon', author: 'mira', title: 'Неоновая ночь: визуальный джем',
      category: 'music', cover: 'clip-neon.jpg', media: 'clip-neon.mp4', duration: 45,
      views: 3102, baseLikes: 512, baseDislikes: 40, days: 5,
      description: 'Ночной город, розовый и голубой свет, ритм 96 BPM. Это заготовка для клипа — если понравится, сделаю полную версию с текстом.\n\nВсе цвета — из двух источников: лампа за окном и маленький неоновый знак на стене.',
    },
    {
      ref: 'v-light', author: 'kirill', title: 'Цвет и свет: три схемы освещения для съёмки',
      category: 'education', cover: 'cover-light.jpg', duration: 734,
      views: 2765, baseLikes: 402, baseDislikes: 8, days: 61,
      description: 'Показываю три схемы, которыми пользуюсь каждый день: жёсткий контровой свет, мягкий ключ через диффузор и отражённый свет от белой стены.\n\n0:00 — зачем вообще думать про свет\n1:40 — схема «окно»\n6:10 — контровой контур\n10:20 — рефлекс от стены\n12:14 — сравнение кадров',
    },
    {
      ref: 'v-lofi', author: 'anya', title: 'Лоу-фай для учёбы: спокойные 40 минут',
      category: 'music', cover: 'cover-lofi.jpg', duration: 2410,
      views: 8934, baseLikes: 1520, baseDislikes: 26, days: 88,
      description: 'Подборка спокойных битов для работы и учёбы. Каждый трек записан на маленькой домашней студии, поэтому звучит чуть шероховато — так и задумано.',
    },
    {
      ref: 'v-editing', author: 'mira', title: 'Монтаж: как склеить сцену незаметно',
      category: 'education', cover: 'cover-editing.jpg', duration: 986,
      views: 1620, baseLikes: 233, baseDislikes: 7, days: 19,
      description: 'Приём «по движению»: если камера в одном кадре уходит влево, второй кадр должен продолжить движение. Показываю на реальном примере и разбираю четыре ошибки.',
    },
    {
      ref: 'v-server', author: 'teo', title: 'Домашний медиасервер: сборка за один вечер',
      category: 'tech', cover: 'cover-server.jpg', duration: 1455,
      views: 2210, baseLikes: 341, baseDislikes: 11, days: 44,
      description: 'Корпус на 4 диска, тихие вентиляторы, минимальная ОС и немного терпения. Собрал за вечер, рассказываю, что пригодилось, а что лежит без дела.',
    },
    {
      ref: 'v-abstract', author: 'nika', title: 'Абстрактные переходы: пак визуалов',
      category: 'other', cover: 'cover-abstract.jpg', duration: 623,
      views: 640, baseLikes: 88, baseDislikes: 5, days: 8,
      description: 'Двенадцать мягких переходов: градиенты, дым, световые пятна. Показываю, как применить их в монтаже и не перегрузить картинку.',
    },
    {
      ref: 'v-rain', author: 'teo', title: 'Дождь в городе: саундскейп для сна',
      category: 'music', cover: 'cover-rain.jpg', duration: 3600,
      views: 7412, baseLikes: 1104, baseDislikes: 18, days: 130,
      description: 'Час дождя на жестяном козырьке и тихий гул города под ним. Записал с двух микрофонов на балконе, обработал минимально.',
    },
    {
      ref: 'v-first', author: 'nika', title: 'Мой первый ролик: тестовый прогон',
      category: 'tech', duration: 214,
      views: 132, baseLikes: 14, baseDislikes: 0, days: 2,
      description: 'Пробую платформу: загружаю короткий тест без обложки, чтобы посмотреть, как всё устроено. Если читаете это — привет!',
    },
    {
      ref: 'v-mistakes', author: 'teo', title: 'Пять ошибок новичков в монтаже',
      category: 'education', duration: 812,
      views: 980, baseLikes: 150, baseDislikes: 9, days: 26,
      description: 'Пять привычек, которые видно в первых десяти секундах ролика: звук громче картинки, отсутствие пауз, слишком много переходов и ещё две.',
    },
  ];

  const COMMENTS = [
    { video: 'v-fjord', author: 'kirill', days: 9, text: 'Спокойствие — именно то слово. Второй раз включаю, чтобы просто посидеть у окна.' },
    { video: 'v-fjord', author: 'mira', days: 7, text: 'Цвет на 0:20 — отличный выбор момента. Хочется распечатать кадр и повесить на стену.' },
    { video: 'v-fjord', author: 'nika', days: 3, text: 'А можно исходный кадр? Хочу попробовать сделать свою обложку в этой палитре.' },
    { video: 'v-aurora', author: 'anya', days: 28, text: 'Наконец понятно, почему слои на разной высоте. Объяснение про солнечный ветер — лучшее, что я слышала.' },
    { video: 'v-aurora', author: 'teo', days: 20, text: 'Добавь, пожалуйста, про прогноз по Kp-индексу. Было бы полезно для съёмок.' },
    { video: 'v-neon', author: 'kirill', days: 4, text: 'Ритм держится всю минуту, не отпускает. Полную версию — да, пожалуйста.' },
    { video: 'v-light', author: 'mira', days: 61, text: 'Схема «окно» — то, что я искала для интервью. Спасибо за разбор!' },
    { video: 'v-light', author: 'teo', days: 40, text: 'Двенадцатая минута стоит всего ролика. Сравнение кадров очень наглядно.' },
    { video: 'v-lofi', author: 'nika', days: 60, text: 'Идеально для черчения. Третий трек — любимый.' },
    { video: 'v-lofi', author: 'kirill', days: 51, text: 'Шероховатость — это плюс, не убирай её в следующих подборках.' },
    { video: 'v-editing', author: 'anya', days: 15, text: 'Про движение камеры в одну сторону — забрала в заметки, работает.' },
    { video: 'v-server', author: 'kirill', days: 30, text: 'Тихие вентиляторы — ключевая деталь. У меня в шкафу так и стоит, никто не замечает.' },
    { video: 'v-rain', author: 'mira', days: 100, text: 'Под этот ролик засыпаю уже месяц. Спасибо за обработку без «эффектов дождя».' },
    { video: 'v-mistakes', author: 'nika', days: 12, text: 'Первая ошибка — буквально про меня. Переслушала с начала и поправила свой последний ролик.' },
  ];

  const SUBSCRIPTIONS = [
    { user: 'anya', channel: 'kirill' },
    { user: 'anya', channel: 'teo' },
    { user: 'kirill', channel: 'anya' },
    { user: 'kirill', channel: 'mira' },
    { user: 'mira', channel: 'teo' },
    { user: 'teo', channel: 'anya' },
    { user: 'nika', channel: 'anya' },
    { user: 'nika', channel: 'mira' },
  ];

  const LIKES = {
    'v-fjord': ['kirill', 'mira', 'nika'],
    'v-aurora': ['anya', 'teo'],
    'v-neon': ['kirill', 'teo'],
    'v-light': ['mira', 'teo'],
    'v-lofi': ['kirill', 'nika'],
    'v-server': ['kirill'],
    'v-rain': ['mira'],
  };

  function isoDaysAgo(days, hourOffset) {
    const date = new Date();
    date.setDate(date.getDate() - Number(days || 0));
    date.setHours(12 + (hourOffset || 0) % 9, 20, 0, 0);
    return date.toISOString();
  }

  function asset(name) {
    return 'assets/demo/' + name;
  }

  async function seedIfNeeded(force) {
    const store = S.store;
    const existing = store.getDb();
    if (!force && existing.users.length > 0) return false;

    const db = store.emptyDb();
    const refMap = new Map();

    // Пользователи. Пароль у демо-каналов общий и открыто указан в подсказке входа.
    for (const preset of USERS) {
      const salt = 'demo-salt-' + preset.ref;
      const hash = await store.derivePassword(DEMO_PASSWORD, salt, store.KDF.iterations);
      const user = {
        id: 'u-demo-' + preset.ref,
        name: preset.name,
        handle: preset.handle,
        accent: preset.accent,
        avatar: '',
        bio: preset.bio,
        role: preset.ref === 'teo' ? 'moderator' : 'user',
        salt,
        hash,
        iterations: store.KDF.iterations,
        subsBase: preset.subsBase,
        createdAt: isoDaysAgo(preset.days, 0),
        demo: true,
      };
      db.users.push(user);
      refMap.set(preset.ref, user.id);
    }

    for (const preset of VIDEOS) {
      const video = {
        id: 'v-demo-' + preset.ref.replace(/^v-/, ''),
        title: preset.title,
        description: preset.description,
        category: preset.category,
        authorId: refMap.get(preset.author),
        coverUrl: preset.cover ? asset(preset.cover) : '',
        coverData: '',
        mediaUrl: preset.media ? asset(preset.media) : '',
        posterUrl: '',
        duration: preset.duration || 0,
        views: preset.views || 0,
        baseLikes: preset.baseLikes || 0,
        baseDislikes: preset.baseDislikes || 0,
        createdAt: isoDaysAgo(preset.days, 2),
        editedAt: null,
        demo: true,
      };
      db.videos.push(video);
      refMap.set(preset.ref, video.id);
    }

    let commentIndex = 0;
    for (const preset of COMMENTS) {
      const videoId = refMap.get(preset.video);
      const authorId = refMap.get(preset.author);
      if (!videoId || !authorId) continue; // пропускаем некорректные записи
      commentIndex += 1;
      db.comments.push({
        id: 'c-demo-' + commentIndex,
        videoId,
        authorId,
        text: preset.text,
        createdAt: isoDaysAgo(preset.days, commentIndex),
        editedAt: null,
      });
    }

    for (const preset of SUBSCRIPTIONS) {
      const userId = refMap.get(preset.user);
      const channelId = refMap.get(preset.channel);
      if (!userId || !channelId) continue;
      db.subs.push({ userId, channelId, createdAt: isoDaysAgo(30, 1) });
    }

    for (const videoRef of Object.keys(LIKES)) {
      const videoId = refMap.get(videoRef);
      if (!videoId) continue;
      for (const userIdRef of LIKES[videoRef]) {
        const userId = refMap.get(userIdRef);
        if (!userId) continue;
        db.likes.push({ videoId, userId, kind: 'like', createdAt: isoDaysAgo(5, 3) });
      }
    }

    db.meta = { createdAt: new Date().toISOString(), seeded: true, demoPassword: DEMO_PASSWORD };
    store.setDb(db, false);
    return true;
  }

  S.seed = {
    DEMO_PASSWORD,
    ADMIN_KEY,
    ADMIN_KEY_HINT,
    DEMO_ACCOUNT: { name: USERS[0].name, password: DEMO_PASSWORD },
    seedIfNeeded,
    users: USERS,
  };
})(window);
