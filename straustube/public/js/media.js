'use strict';

/**
 * StrausTube — работа с медиа на клиенте.
 *
 * Здесь нет ни загрузки на сервер, ни сторонних библиотек:
 *  - файлы читаются через FileReader и превращаются в локальные blob:/data:-адреса;
 *  - длительность ролика определяется метаданными самого <video>;
 *  - обложка по умолчанию рисуется на <canvas>.
 * Ничего не покидает браузер пользователя.
 */
(function (global) {
  const S = (global.StrausTube = global.StrausTube || {});
  const U = S.util;

  const CATEGORIES = [
    { id: 'all', label: 'Все' },
    { id: 'music', label: 'Музыка' },
    { id: 'games', label: 'Игры' },
    { id: 'education', label: 'Обучение' },
    { id: 'tech', label: 'Технологии' },
    { id: 'nature', label: 'Природа' },
    { id: 'humor', label: 'Юмор' },
    { id: 'other', label: 'Другое' },
  ];

  function categoryLabel(id) {
    const found = CATEGORIES.find((item) => item.id === id);
    return found ? found.label : 'Другое';
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Не удалось прочитать файл.'));
      reader.readAsDataURL(file);
    });
  }

  function probeDuration(src) {
    return new Promise((resolve) => {
      if (!src) {
        resolve(0);
        return;
      }
      const probe = document.createElement('video');
      probe.preload = 'metadata';
      probe.muted = true;
      const finish = (value) => {
        probe.removeAttribute('src');
        probe.load();
        resolve(Number.isFinite(value) ? value : 0);
      };
      probe.onloadedmetadata = () => finish(probe.duration);
      probe.onerror = () => finish(0);
      probe.src = src;
      global.setTimeout(() => finish(probe.duration || 0), 8000);
    });
  }

  /** Рисует обложку-заглушку с инициалами канала на canvas. */
  function makeCover(title, channelName, accent) {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    const color = accent || '#ff0033';

    const gradient = ctx.createLinearGradient(0, 0, 640, 360);
    gradient.addColorStop(0, '#1b1c22');
    gradient.addColorStop(1, color);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 640, 360);

    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#ffffff';
    for (let i = -360; i < 640; i += 120) {
      ctx.save();
      ctx.translate(i, 0);
      ctx.rotate(-0.35);
      ctx.fillRect(0, -200, 34, 800);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(0, 250, 640, 110);

    ctx.fillStyle = '#ffffff';
    ctx.font = '600 28px system-ui, Arial, sans-serif';
    const titleText = String(title || 'Видео StrausTube').slice(0, 34);
    ctx.fillText(titleText, 28, 296);

    ctx.font = '400 16px system-ui, Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.78)';
    ctx.fillText(String(channelName || 'StrausTube'), 28, 328);

    return canvas.toDataURL('image/jpeg', 0.75);
  }

  function coverOf(video, size) {
    const user = S.store.findUser(video.authorId);
    const accent = user && user.accent ? user.accent : '#ff0033';
    if (video.coverData) return video.coverData;
    if (video.coverUrl) return U.safeHttpUrl(video.coverUrl) || '';
    if (size === 'small') return '';
    return makeCover(video.title, user ? user.name : 'StrausTube', accent);
  }

  function avatarOf(user) {
    if (!user) return '';
    if (user.avatar) return user.avatar;
    return makeAvatar(user.name, user.accent);
  }

  const avatarCache = new Map();

  function makeAvatar(name, accent) {
    const key = (name || '?') + '|' + (accent || '');
    if (avatarCache.has(key)) return avatarCache.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 160, 160);
    gradient.addColorStop(0, accent || '#7e57c2');
    gradient.addColorStop(1, '#22232a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 160, 160);
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.font = '700 70px system-ui, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(U.initials(name), 80, 86);
    const data = canvas.toDataURL('image/jpeg', 0.8);
    avatarCache.set(key, data);
    return data;
  }

  /** Разбирает вставленную ссылку: страница YouTube или прямой файл. */
  function parseMediaInput(raw) {
    const url = U.safeHttpUrl(raw);
    if (!url) return null;
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const filePattern = /\.(mp4|webm|ogg|ogv|mov|m4v|m3u8)(\?|$)/i;

    if ((host === 'youtube.com' || host === 'm.youtube.com') && parsed.searchParams.get('v')) {
      return { kind: 'youtube', provider: 'YouTube', id: parsed.searchParams.get('v') };
    }
    if (host === 'youtu.be' && parsed.pathname.length > 1) {
      return { kind: 'youtube', provider: 'YouTube', id: parsed.pathname.slice(1) };
    }
    if (filePattern.test(parsed.pathname)) {
      return { kind: 'file', provider: parsed.hostname, url };
    }
    return { kind: 'page', provider: parsed.hostname, url };
  }

  function isSafeMediaUrl(url) {
    return Boolean(U.safeHttpUrl(url));
  }

  S.media = {
    CATEGORIES, categoryLabel,
    readFileAsDataUrl, probeDuration, makeCover, makeAvatar, coverOf, avatarOf,
    parseMediaInput, isSafeMediaUrl,
  };
})(window);
