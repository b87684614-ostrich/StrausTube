'use strict';

/**
 * StrausTube — локальное хранилище.
 *
 * Все данные приложения (аккаунты, видео, лайки, комментарии, подписки)
 * живут в localStorage браузера пользователя. Серверная часть не используется
 * и не существует: приложение целиком клиентское.
 *
 * Пароли пользователей не сохраняются в открытом виде: хранится только
 * соль + производный ключ (многократный SHA-256), а сами проверки выполняются
 * локально через Web Crypto API.
 */
(function (global) {
  const S = (global.StrausTube = global.StrausTube || {});
  const U = S.util;

  const DB_KEY = 'straustube.db.v1';
  const SESSION_KEY = 'straustube.session.v1';
  const ADMIN_KEY = 'straustube.admin.v1';
  const THEME_KEY = 'straustube.theme.v1';
  const DB_VERSION = 1;

  /* ---------------------------------------------------------------------
     Парольная функция (публичная соль: это локальная песочница, а не сервер)
     --------------------------------------------------------------------- */

  const KDF = {
    saltLength: 16,
    iterations: 1500,
    adminPublicSalt: 'straustube.admin.v1',
    adminExpectedHash: 'e81a4272738e1b518c3b07446202aa3d328bfa3f7730edb793733b80cd33e76f',
    adminKeyHint: 'straus-____-____',
  };

  const encoder = new TextEncoder();

  function bytesToHex(buffer) {
    const bytes = new Uint8Array(buffer);
    let out = '';
    for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
    return out;
  }

  function hexToBytes(hex) {
    const clean = String(hex).replace(/[^0-9a-f]/gi, '');
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i += 1) out[i] = parseInt(clean.substr(i * 2, 2), 16);
    return out;
  }

  async function sha256Hex(text) {
    const digest = await global.crypto.subtle.digest('SHA-256', encoder.encode(text));
    return bytesToHex(digest);
  }

  /**
   * Производная функция для пароля:
   *   key = SHA256^N(salt | password)
   * Работает только локально, выполняется за десятки миллисекунд.
   */
  async function derivePassword(password, saltHex, iterations) {
    const rounds = iterations || KDF.iterations;
    let hash = await sha256Hex(`${saltHex}|${password}`);
    for (let i = 0; i < rounds; i += 1) hash = await sha256Hex(`${hash}|${saltHex}`);
    return hash;
  }

  function randomSalt() {
    const bytes = new Uint8Array(KDF.saltLength);
    global.crypto.getRandomValues(bytes);
    return bytesToHex(bytes);
  }

  function timingSafeEqual(a, b) {
    const left = String(a);
    const right = String(b);
    if (left.length !== right.length) return false;
    let diff = 0;
    for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
    return diff === 0;
  }

  /* ---------------------------------------------------------------------
     База
     --------------------------------------------------------------------- */

  const listeners = new Set();

  function emptyDb() {
    return {
      version: DB_VERSION,
      users: [],
      videos: [],
      comments: [],
      likes: [],
      subs: [],
      logs: [],
      meta: { createdAt: new Date().toISOString(), seeded: false },
    };
  }

  function readJson(key, fallback) {
    try {
      const raw = global.localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (error) {
      console.warn('[StrausTube] Не удалось прочитать локальные данные:', error.message);
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('[StrausTube] Не удалось сохранить локальные данные:', error.message);
      S.ui && S.ui.toast('Локальное хранилище переполнено. Удалите крупные видео или файлы.', 'error');
      return false;
    }
  }

  function normalize(db) {
    const base = emptyDb();
    const out = Object.assign(base, db);
    for (const key of ['users', 'videos', 'comments', 'likes', 'subs', 'logs']) {
      if (!Array.isArray(out[key])) out[key] = [];
    }
    return out;
  }

  function loadDb() {
    const raw = readJson(DB_KEY, null);
    if (!raw) return null;
    const db = normalize(raw);
    if (db.version !== DB_VERSION || !Array.isArray(db.users)) return null;
    return db;
  }

  let db = loadDb();

  function getDb() {
    if (!db) {
      db = emptyDb();
      saveDb();
    }
    return db;
  }

  function saveDb() {
    if (!db) return;
    writeJson(DB_KEY, db);
    emit();
  }

  function emit() {
    for (const listener of listeners) {
      try {
        listener(db);
      } catch (error) {
        console.warn('[StrausTube] Ошибка подписчика хранилища:', error.message);
      }
    }
  }

  function onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  /* ---------------------------------------------------------------------
     Пользователи
     --------------------------------------------------------------------- */

  function normalizeUsername(name) {
    return String(name || '').trim().toLowerCase();
  }

  function findUser(id) {
    return getDb().users.find((user) => user.id === id) || null;
  }

  function findUserByName(name) {
    const needle = normalizeUsername(name);
    return getDb().users.find((user) => normalizeUsername(user.name) === needle) || null;
  }

  function publicUser(user) {
    if (!user) return null;
    const stats = userStats(user.id);
    return {
      id: user.id,
      name: user.name,
      handle: user.handle,
      avatar: user.avatar,
      bio: user.bio || '',
      role: user.role || 'user',
      createdAt: user.createdAt,
      stats,
    };
  }

  function userStats(userId) {
    const database = getDb();
    const user = findUser(userId);
    const videos = database.videos.filter((video) => video.authorId === userId);
    const views = videos.reduce((sum, video) => sum + (video.views || 0), 0);
    const realSubs = database.subs.filter((sub) => sub.channelId === userId).length;
    const subs = (user && user.subsBase ? user.subsBase : 0) + realSubs;
    const likes = videos.reduce((sum, video) => sum + countLikes(video.id, 'like'), 0);
    return { videos: videos.length, views, subs, likes, realSubs };
  }

  function setSubsBase(userId, value) {
    const user = findUser(userId);
    if (!user) throw new Error('Пользователь не найден.');
    user.subsBase = Math.max(0, Number(value) || 0);
    saveDb();
    return user;
  }

  async function register({ name, password, avatar, bio }) {
    const cleanName = String(name || '').trim();
    if (cleanName.length < 2) throw new Error('Имя должно содержать не меньше 2 символов.');
    if (cleanName.length > 40) throw new Error('Имя слишком длинное (максимум 40 символов).');
    if (String(password || '').length < 4) throw new Error('Пароль должен содержать не меньше 4 символов.');
    if (String(password).length > 128) throw new Error('Пароль слишком длинный.');
    if (findUserByName(cleanName)) throw new Error('Такое имя уже занято. Попробуйте другое.');

    const salt = randomSalt();
    const hash = await derivePassword(password, salt);
    const user = {
      id: U.uid('u'),
      name: cleanName,
      handle: '@' + (U.slugify(cleanName) || U.shortId(6)),
      avatar: avatar || '',
      bio: bio || '',
      role: 'user',
      salt,
      hash,
      iterations: KDF.iterations,
      createdAt: new Date().toISOString(),
    };
    getDb().users.push(user);
    saveDb();
    return user;
  }

  async function authenticate(name, password) {
    const user = findUserByName(name);
    // Одинаковая формулировка ошибки: не подсказываем, что именно неверно.
    if (!user) throw new Error('Неверное имя пользователя или пароль.');
    const hash = await derivePassword(password, user.salt, user.iterations);
    if (!timingSafeEqual(hash, user.hash)) throw new Error('Неверное имя пользователя или пароль.');
    return user;
  }

  async function renameUser(userId, name) {
    const user = findUser(userId);
    if (!user) throw new Error('Пользователь не найден.');
    const cleanName = String(name || '').trim();
    if (cleanName.length < 2) throw new Error('Имя должно содержать не меньше 2 символов.');
    const clash = findUserByName(cleanName);
    if (clash && clash.id !== userId) throw new Error('Такое имя уже занято.');
    user.name = cleanName;
    user.handle = '@' + (U.slugify(cleanName) || U.shortId(6));
    saveDb();
    return user;
  }

  function setAvatar(userId, dataUrl) {
    const user = findUser(userId);
    if (!user) throw new Error('Пользователь не найден.');
    user.avatar = dataUrl || '';
    saveDb();
    return user;
  }

  function setBio(userId, bio) {
    const user = findUser(userId);
    if (!user) throw new Error('Пользователь не найден.');
    user.bio = String(bio || '').slice(0, 400);
    saveDb();
    return user;
  }

  function removeUser(userId) {
    const database = getDb();
    const user = findUser(userId);
    if (!user) return;
    database.users = database.users.filter((item) => item.id !== userId);
    database.videos = database.videos.filter((video) => video.authorId !== userId);
    database.comments = database.comments.filter(
      (comment) => comment.authorId !== userId && comment.targetUserId !== userId
    );
    database.likes = database.likes.filter((like) => like.userId !== userId);
    database.subs = database.subs.filter((sub) => sub.userId !== userId && sub.channelId !== userId);
    if (getSessionId() === userId) clearSession();
    saveDb();
  }

  /* ---------------------------------------------------------------------
     Сессия

     Если браузер запрещает доступ к хранилищу (приватный режим,
     изолированный iframe), сессия всё равно работает — она держится
     в памяти вкладки до перезагрузки страницы.
     --------------------------------------------------------------------- */

  const memorySession = { value: null };

  function getSessionId() {
    try {
      const stored = global.sessionStorage.getItem(SESSION_KEY) || global.localStorage.getItem(SESSION_KEY);
      if (stored) return stored;
    } catch (error) {
      /* хранилище недоступно — используем память */
    }
    return memorySession.value;
  }

  function setSession(userId, remember) {
    memorySession.value = userId;
    try {
      global.sessionStorage.setItem(SESSION_KEY, userId);
      if (remember) global.localStorage.setItem(SESSION_KEY, userId);
      else global.localStorage.removeItem(SESSION_KEY);
    } catch (error) {
      console.info('[StrausTube] Хранилище недоступно, сессия хранится в памяти вкладки.');
    }
  }

  function clearSession() {
    memorySession.value = null;
    try {
      global.sessionStorage.removeItem(SESSION_KEY);
      global.localStorage.removeItem(SESSION_KEY);
    } catch (error) {
      /* ignore */
    }
  }

  function currentUser() {
    const id = getSessionId();
    const user = id ? findUser(id) : null;
    if (id && !user) clearSession();
    return user;
  }

  /* ---------------------------------------------------------------------
     Видео
     --------------------------------------------------------------------- */

  function listVideos(filter) {
    const opts = filter || {};
    let items = getDb().videos.slice();
    if (opts.authorId) items = items.filter((video) => video.authorId === opts.authorId);
    if (opts.excludeId) items = items.filter((video) => video.id !== opts.excludeId);
    if (opts.category && opts.category !== 'all') {
      items = items.filter((video) => video.category === opts.category);
    }
    if (opts.query) {
      const needle = String(opts.query).toLowerCase();
      items = items.filter((video) => {
        const haystack = [video.title, video.description, authorName(video.authorId)]
          .join(' ')
          .toLowerCase();
        return haystack.includes(needle);
      });
    }
    if (opts.sort === 'popular') {
      items.sort((a, b) => (b.views || 0) - (a.views || 0));
    } else if (opts.sort === 'oldest') {
      items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else {
      items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return items;
  }

  function findVideo(id) {
    return getDb().videos.find((video) => video.id === id) || null;
  }

  function authorName(authorId) {
    const user = findUser(authorId);
    return user ? user.name : 'Удалённый канал';
  }

  function createVideo(payload) {
    const user = currentUser();
    if (!user) throw new Error('Сначала войдите в аккаунт.');
    const title = String(payload.title || '').trim();
    if (title.length < 3) throw new Error('Название должно содержать не меньше 3 символов.');
    if (title.length > 140) throw new Error('Название слишком длинное (максимум 140 символов).');

    const video = {
      id: U.uid('v'),
      title,
      description: String(payload.description || '').slice(0, 5000),
      category: payload.category || 'other',
      authorId: payload.authorId || user.id,
      coverUrl: payload.coverUrl || '',
      coverData: payload.coverData || '',
      mediaUrl: payload.mediaUrl || '',
      posterUrl: payload.posterUrl || '',
      duration: Number(payload.duration) || 0,
      views: 0,
      createdAt: new Date().toISOString(),
      editedAt: null,
    };
    getDb().videos.push(video);
    saveDb();
    return video;
  }

  function updateVideo(id, patch) {
    const video = findVideo(id);
    if (!video) throw new Error('Видео не найдено.');
    const allowed = ['title', 'description', 'category', 'coverUrl', 'coverData', 'mediaUrl', 'duration'];
    for (const key of allowed) {
      if (patch[key] === undefined) continue;
      if (key === 'title') {
        const title = String(patch.title).trim();
        if (title.length < 3) throw new Error('Название должно содержать не меньше 3 символов.');
        video.title = title.slice(0, 140);
      } else if (key === 'description') {
        video.description = String(patch.description).slice(0, 5000);
      } else {
        video[key] = patch[key];
      }
    }
    video.editedAt = new Date().toISOString();
    saveDb();
    return video;
  }

  function removeVideo(id) {
    const database = getDb();
    database.videos = database.videos.filter((video) => video.id !== id);
    database.comments = database.comments.filter((comment) => comment.videoId !== id);
    database.likes = database.likes.filter((like) => like.videoId !== id);
    saveDb();
  }

  function transferVideo(videoId, authorId) {
    const video = findVideo(videoId);
    if (!video) throw new Error('Видео не найдено.');
    if (!findUser(authorId)) throw new Error('Канал не найден.');
    video.authorId = authorId;
    saveDb();
    return video;
  }

  function addView(id) {
    const video = findVideo(id);
    if (!video) return;
    video.views = (video.views || 0) + 1;
    saveDb();
  }

  /* ---------------------------------------------------------------------
     Лайки, подписки, комментарии
     --------------------------------------------------------------------- */

  /**
   * Число отметок = стартовое значение ролика (для правдоподобной витрины)
   * плюс реальные отметки пользователей этого браузера.
   */
  function countLikes(videoId, kind) {
    const video = findVideo(videoId);
    const base = video ? Number(kind === 'like' ? video.baseLikes : video.baseDislikes) || 0 : 0;
    const real = getDb().likes.filter(
      (like) => like.videoId === videoId && like.kind === kind
    ).length;
    return base + real;
  }

  function myLike(videoId, userId) {
    if (!userId) return null;
    const found = getDb().likes.find((like) => like.videoId === videoId && like.userId === userId);
    return found ? found.kind : null;
  }

  function toggleLike(videoId, kind) {
    const user = currentUser();
    if (!user) throw new Error('Войдите в аккаунт, чтобы оценивать видео.');
    const database = getDb();
    const index = database.likes.findIndex(
      (like) => like.videoId === videoId && like.userId === user.id
    );
    if (index >= 0 && database.likes[index].kind === kind) {
      database.likes.splice(index, 1);
      saveDb();
      return null;
    }
    if (index >= 0) database.likes[index].kind = kind;
    else database.likes.push({ videoId, userId: user.id, kind, createdAt: new Date().toISOString() });
    saveDb();
    return kind;
  }

  function isSubscribed(channelId, userId) {
    if (!userId) return false;
    return getDb().subs.some((sub) => sub.channelId === channelId && sub.userId === userId);
  }

  function toggleSubscribe(channelId) {
    const user = currentUser();
    if (!user) throw new Error('Войдите в аккаунт, чтобы подписываться на каналы.');
    if (user.id === channelId) throw new Error('На свой канал подписаться нельзя.');
    const database = getDb();
    const index = database.subs.findIndex(
      (sub) => sub.channelId === channelId && sub.userId === user.id
    );
    if (index >= 0) {
      database.subs.splice(index, 1);
      saveDb();
      return false;
    }
    database.subs.push({ channelId, userId: user.id, createdAt: new Date().toISOString() });
    saveDb();
    return true;
  }

  function listSubscriptions(userId) {
    const database = getDb();
    return database.subs
      .filter((sub) => sub.userId === userId)
      .map((sub) => findUser(sub.channelId))
      .filter(Boolean);
  }

  function listComments(videoId) {
    return getDb()
      .comments.filter((comment) => comment.videoId === videoId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function countComments(videoId) {
    return getDb().comments.filter((comment) => comment.videoId === videoId).length;
  }

  function addComment(videoId, text) {
    const user = currentUser();
    if (!user) throw new Error('Войдите в аккаунт, чтобы комментировать.');
    const clean = String(text || '').trim();
    if (!clean) throw new Error('Комментарий не может быть пустым.');
    const comment = {
      id: U.uid('c'),
      videoId,
      authorId: user.id,
      text: clean.slice(0, 2000),
      createdAt: new Date().toISOString(),
      editedAt: null,
    };
    getDb().comments.push(comment);
    saveDb();
    return comment;
  }

  function updateComment(commentId, text) {
    const comment = getDb().comments.find((item) => item.id === commentId);
    if (!comment) throw new Error('Комментарий не найден.');
    const clean = String(text || '').trim();
    if (!clean) throw new Error('Комментарий не может быть пустым.');
    comment.text = clean.slice(0, 2000);
    comment.editedAt = new Date().toISOString();
    saveDb();
    return comment;
  }

  function removeComment(commentId) {
    const database = getDb();
    database.comments = database.comments.filter((comment) => comment.id !== commentId);
    saveDb();
  }

  function listLikedVideos(userId) {
    const database = getDb();
    const likedIds = new Set(
      database.likes.filter((like) => like.userId === userId && like.kind === 'like').map((like) => like.videoId)
    );
    return database.videos.filter((video) => likedIds.has(video.id));
  }

  /* ---------------------------------------------------------------------
     Режим модератора
     --------------------------------------------------------------------- */

  const memoryAdmin = { value: false };

  function isAdmin() {
    try {
      if (global.sessionStorage.getItem(ADMIN_KEY) === 'granted') return true;
    } catch (error) {
      /* хранилище недоступно — используем память */
    }
    return memoryAdmin.value;
  }

  function setAdmin(value) {
    memoryAdmin.value = Boolean(value);
    try {
      if (value) global.sessionStorage.setItem(ADMIN_KEY, 'granted');
      else global.sessionStorage.removeItem(ADMIN_KEY);
    } catch (error) {
      /* ignore */
    }
  }

  async function adminUnlock(key) {
    const normalized = String(key || '').trim().toLowerCase();
    if (!normalized) return false;
    const hash = await derivePassword(normalized, KDF.adminPublicSalt, KDF.iterations);
    const ok = timingSafeEqual(hash, KDF.adminExpectedHash);
    if (ok) setAdmin(true);
    return ok;
  }

  function requireAdmin() {
    if (!isAdmin()) throw new Error('Режим модератора не активирован.');
  }

  function adminImpersonate(userId) {
    requireAdmin();
    const user = findUser(userId);
    if (!user) throw new Error('Пользователь не найден.');
    setSession(user.id, false);
    return user;
  }

  function adminImpersonateStop() {
    clearSession();
  }

  function adminCreateUser(payload) {
    requireAdmin();
    const name = String(payload.name || '').trim();
    if (name.length < 2) throw new Error('Имя должно содержать не меньше 2 символов.');
    if (findUserByName(name)) throw new Error('Такое имя уже занято.');
    const user = {
      id: U.uid('u'),
      name,
      handle: '@' + (U.slugify(name) || U.shortId(6)),
      avatar: payload.avatar || '',
      bio: String(payload.bio || '').slice(0, 400),
      role: payload.role === 'moderator' ? 'moderator' : 'user',
      salt: '',
      hash: '',
      iterations: 0,
      createdAt: new Date().toISOString(),
      createdByModerator: true,
    };
    getDb().users.push(user);
    saveDb();
    return user;
  }

  function adminSetRole(userId, role) {
    requireAdmin();
    const user = findUser(userId);
    if (!user) throw new Error('Пользователь не найден.');
    user.role = role === 'moderator' ? 'moderator' : 'user';
    saveDb();
    return user;
  }

  /* ---------------------------------------------------------------------
     Служебное: поиск, статистика, тема, экспорт
     --------------------------------------------------------------------- */

  function search(query) {
    const needle = String(query || '').trim().toLowerCase();
    if (!needle) return { videos: [], users: [] };
    const database = getDb();
    return {
      videos: database.videos.filter((video) =>
        [video.title, video.description].join(' ').toLowerCase().includes(needle)
      ),
      users: database.users.filter((user) =>
        [user.name, user.handle, user.bio || ''].join(' ').toLowerCase().includes(needle)
      ),
    };
  }

  function globalStats() {
    const database = getDb();
    return {
      users: database.users.length,
      videos: database.videos.length,
      comments: database.comments.length,
      likes: database.likes.length,
      views: database.videos.reduce((sum, video) => sum + (video.views || 0), 0),
      subs: database.subs.length,
    };
  }

  function getTheme() {
    try {
      const stored = global.localStorage.getItem(THEME_KEY);
      return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch (error) {
      return 'system';
    }
  }

  function setTheme(theme) {
    try {
      if (theme === 'system') {
        global.localStorage.removeItem(THEME_KEY);
        document.documentElement.removeAttribute('data-theme');
      } else {
        global.localStorage.setItem(THEME_KEY, theme);
        document.documentElement.setAttribute('data-theme', theme);
      }
    } catch (error) {
      /* ignore */
    }
  }

  function exportDb() {
    return JSON.stringify(getDb(), null, 2);
  }

  function importDb(json, options) {
    const opts = options || {};
    const parsed = JSON.parse(json);
    if (!parsed || !Array.isArray(parsed.users) || !Array.isArray(parsed.videos)) {
      throw new Error('Файл не похож на резервную копию StrausTube.');
    }
    const next = normalize(parsed);
    setDb(next, opts.clearSession !== false);
    return globalStats();
  }

  function setDb(next, clearCurrentSession) {
    db = normalize(next);
    saveDb();
    if (clearCurrentSession) clearSession();
  }

  function resetAll() {
    db = emptyDb();
    try {
      global.localStorage.removeItem(DB_KEY);
    } catch (error) {
      /* ignore */
    }
    clearSession();
    setAdmin(false);
    saveDb();
  }

  function adminPatchVideo(id, patch) {
    requireAdmin();
    const video = findVideo(id);
    if (!video) throw new Error('Видео не найдено.');
    const data = patch || {};
    if (data.title !== undefined) {
      const title = String(data.title).trim();
      if (title.length < 3) throw new Error('Название должно содержать не меньше 3 символов.');
      video.title = title.slice(0, 140);
    }
    if (data.description !== undefined) video.description = String(data.description).slice(0, 5000);
    if (data.category !== undefined) video.category = String(data.category);
    if (data.coverUrl !== undefined) video.coverUrl = String(data.coverUrl).trim();
    if (data.mediaUrl !== undefined) video.mediaUrl = String(data.mediaUrl).trim();
    if (data.duration !== undefined) video.duration = Math.max(0, Number(data.duration) || 0);
    if (data.views !== undefined) video.views = Math.max(0, Number(data.views) || 0);
    if (data.baseLikes !== undefined) video.baseLikes = Math.max(0, Number(data.baseLikes) || 0);
    if (data.baseDislikes !== undefined) {
      video.baseDislikes = Math.max(0, Number(data.baseDislikes) || 0);
    }
    if (data.authorId !== undefined) {
      if (!findUser(String(data.authorId))) throw new Error('Канал не найден.');
      video.authorId = String(data.authorId);
    }
    video.editedAt = new Date().toISOString();
    saveDb();
    return video;
  }

  function adminSetSubsBase(userId, value) {
    requireAdmin();
    return setSubsBase(userId, value);
  }

  /* ---------------------------------------------------------------------
     Журнал действий модератора
     --------------------------------------------------------------------- */

  function logAction(action, details) {
    requireAdmin();
    const actor = currentUser();
    const database = getDb();
    database.logs.unshift({
      id: U.uid('log'),
      action: String(action),
      details: String(details || ''),
      actor: actor ? actor.name : 'локальный модератор',
      at: new Date().toISOString(),
    });
    if (database.logs.length > 200) database.logs.length = 200;
    saveDb();
  }

  function listLogs() {
    return getDb().logs.slice(0, 120);
  }

  S.store = {
    DB_KEY, SESSION_KEY, KDF,
    getDb, saveDb, onChange, emptyDb, setDb,
    register, authenticate, renameUser, setAvatar, setBio, removeUser, setSubsBase,
    findUser, findUserByName, publicUser, userStats, normalizeUsername,
    getSessionId, setSession, clearSession, currentUser,
    listVideos, findVideo, createVideo, updateVideo, removeVideo, transferVideo, addView, authorName,
    countLikes, myLike, toggleLike, isSubscribed, toggleSubscribe, listSubscriptions,
    listComments, countComments, addComment, updateComment, removeComment, listLikedVideos,
    isAdmin, setAdmin, adminUnlock, requireAdmin, adminImpersonate, adminImpersonateStop,
    adminCreateUser, adminSetRole, adminPatchVideo, adminSetSubsBase, logAction, listLogs,
    search, globalStats, getTheme, setTheme, exportDb, importDb, resetAll,
    derivePassword, sha256Hex,
  };
})(window);
