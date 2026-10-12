'use strict';

/**
 * StrausTube — утилиты общего назначения.
 * Никаких сетевых запросов и eval: только работа с DOM, форматированием
 * и локальным хранилищем браузера.
 */
(function (global) {
  const S = (global.StrausTube = global.StrausTube || {});

  /* ---------- Безопасный DOM ---------- */

  /**
   * createElement('div', {class:'x', text:'...', attrs:{}, children:[]})
   * Важно: текст и атрибуты всегда передаются через textContent /
   * setAttribute — HTML-строки из пользовательских данных не вставляются.
   */
  function el(tag, options) {
    const opts = options || {};
    const node = document.createElement(tag);
    if (typeof opts === 'string') opts.text = opts;

    if (opts.class) node.className = opts.class;
    if (opts.id) node.id = opts.id;
    if (opts.text != null) node.textContent = String(opts.text);
    if (opts.value != null) node.value = opts.value;

    if (opts.attrs) {
      for (const key of Object.keys(opts.attrs)) {
        const value = opts.attrs[key];
        if (value == null || value === false) continue;
        node.setAttribute(key, String(value));
      }
    }
    if (opts.props) Object.assign(node, opts.props);
    if (opts.on) {
      for (const type of Object.keys(opts.on)) node.addEventListener(type, opts.on[type]);
    }
    if (opts.children) {
      for (const child of [].concat(opts.children)) {
        if (child == null) continue;
        node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
      }
    }
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function svg(pathData, options) {
    const opts = options || {};
    const node = document.createElementNS(SVG_NS, 'svg');
    node.setAttribute('viewBox', opts.viewBox || '0 0 24 24');
    node.setAttribute('aria-hidden', 'true');
    node.setAttribute('focusable', 'false');
    if (opts.fill) node.setAttribute('fill', opts.fill);
    if (opts.strokeWidth) node.setAttribute('stroke-width', String(opts.strokeWidth));
    for (const d of [].concat(pathData)) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      node.appendChild(path);
    }
    return node;
  }

  /** Набор иконок интерфейса (только геометрия, без внешних ресурсов). */
  const ICONS = {
    home: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
    trending: 'M4 16.5 9.5 11l3.5 3.5L20 7M20 7h-5M20 7v5',
    subs: 'M4 8h16M4 12h10M4 16h7M17 16l4 2.5V9l-4 2.5z',
    you: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM10 9.5l5 2.5-5 2.5z',
    upload: 'M12 19V5M5 12l7-7 7 7',
    like: 'M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zm0 0 4.2-7.4A2 2 0 0 1 14.9 5l-.7 4.5H19a2 2 0 0 1 2 2.4l-1.2 6A2 2 0 0 1 17.8 20H7',
    dislike: 'M17 13V4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1zm0 0-4.2 7.4A2 2 0 0 1 9.1 19l.7-4.5H5a2 2 0 0 1-2-2.4l1.2-6A2 2 0 0 1 6.2 4H17',
    comment: 'M21 12a8 8 0 0 1-8 8H7l-4 3 1.2-4.2A8 8 0 1 1 21 12z',
    share: 'M8.7 10.7 15 7.4m0 9.2-6.3-3.3M18 4a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM6 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM18 15a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
    dots: 'M12 6.5v.01M12 12v.01M12 17.5v.01',
    chevronLeft: 'M15 5l-7 7 7 7',
    chevronRight: 'M9 5l7 7-7 7',
    search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM16.5 16.5 21 21',
    edit: 'M4 20h4l10-10-4-4L4 16zM14 6l4 4',
    trash: 'M5 7h14M10 7V5h4v2M6 7l1 13h10l1-13M10 11v6M14 11v6',
    logout: 'M15 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h9M18 8l4 4-4 4M22 12H10',
    switch: 'M4 8h13l-3-3M20 16H7l3 3',
    eye: 'M12 5c5 0 9 4.5 9 7s-4 7-9 7-9-4.5-9-7 4-7 9-7zM12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
    shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z',
    users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 5.2a3.5 3.5 0 0 1 0 6.6M18 20a6.4 6.4 0 0 0-2-4.6',
    film: 'M4 5h16v14H4zM8 5v14M16 5v14M4 9.5h4M4 14.5h4M16 9.5h4M16 14.5h4',
    sun: 'M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zM12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
    moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z',
    link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
    info: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 8.5v.01M12 11v6',
    lock: 'M6 11h12v9H6zM8.5 11V7.8a3.5 3.5 0 0 1 7 0V11',
    check: 'M4 12.5 9 17.5 20 6.5',
    close: 'M6 6l12 12M18 6 6 18',
    plus: 'M12 5v14M5 12h14',
    save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6',
  };

  function icon(name, className) {
    const node = svg(ICONS[name] || ICONS.info, {});
    if (className) node.setAttribute('class', className);
    return node;
  }

  /* ---------- Текст и числа ---------- */

  function plural(n, one, few, many) {
    const value = Math.abs(Math.round(n)) % 100;
    const tail = value % 10;
    if (value > 10 && value < 20) return many;
    if (tail > 1 && tail < 5) return few;
    if (tail === 1) return one;
    return many;
  }

  function formatCount(n) {
    if (n == null || Number.isNaN(n)) return '0';
    if (n < 1000) return String(n);
    if (n < 1e6) {
      const v = n / 1000;
      return (v < 10 ? v.toFixed(1).replace('.', ',') : Math.round(v)) + ' тыс.';
    }
    const m = n / 1e6;
    return (m < 10 ? m.toFixed(1).replace('.', ',') : Math.round(m)) + ' млн';
  }

  function pluralizeView(n) {
    return formatCount(n) + ' ' + plural(n, 'просмотр', 'просмотра', 'просмотров');
  }

  function pluralizeSub(n) {
    return formatCount(n) + ' ' + plural(n, 'подписчик', 'подписчика', 'подписчиков');
  }

  function pluralizeComment(n) {
    return formatCount(n) + ' ' + plural(n, 'комментарий', 'комментария', 'комментариев');
  }

  function pluralizeVideo(n) {
    return formatCount(n) + ' ' + plural(n, 'видео', 'видео', 'видео');
  }

  function pluralizeLike(n) {
    return formatCount(n) + ' ' + plural(n, 'отметка «Нравится»', 'отметки «Нравится»', 'отметок «Нравится»');
  }

  const RU_MONTHS = ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];

  function formatDate(iso) {
    const date = toDate(iso);
    if (!date) return '';
    return date.getDate() + ' ' + RU_MONTHS[date.getMonth()] + ' ' + date.getFullYear();
  }

  function timeAgo(iso) {
    const date = toDate(iso);
    if (!date) return '';
    const diff = Date.now() - date.getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'только что';
    if (min < 60) return min + ' мин назад';
    const hours = Math.floor(min / 60);
    if (hours < 24) return hours + ' ' + plural(hours, 'час', 'часа', 'часов') + ' назад';
    const days = Math.floor(hours / 24);
    if (days < 30) return days + ' ' + plural(days, 'день', 'дня', 'дней') + ' назад';
    const months = Math.floor(days / 30);
    if (months < 12) return months + ' ' + plural(months, 'месяц', 'месяца', 'месяцев') + ' назад';
    const years = Math.floor(months / 12);
    return years + ' ' + plural(years, 'год', 'года', 'лет') + ' назад';
  }

  function toDate(iso) {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '';
    const total = Math.round(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (v) => String(v).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  function initials(name) {
    const parts = String(name || '?').trim().split(/[\s_-]+/).filter(Boolean);
    const first = parts[0] ? parts[0][0] : '?';
    const second = parts[1] ? parts[1][0] : '';
    return (first + second).toUpperCase();
  }

  function slugify(text) {
    const map = {
      а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
      к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
      х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
    };
    return String(text || '')
      .toLowerCase()
      .split('')
      .map((ch) => (map[ch] != null ? map[ch] : ch))
      .join('')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  function shortId(length) {
    const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
    const bytes = new Uint8Array(length || 8);
    (global.crypto || global.msCrypto).getRandomValues(bytes);
    let out = '';
    for (const byte of bytes) out += alphabet[byte % alphabet.length];
    return out;
  }

  function uid(prefix) {
    return (prefix ? prefix + '-' : '') + Date.now().toString(36) + '-' + shortId(6);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function escapeRegExp(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* ---------- Безопасные адреса ---------- */

  /**
   * Разрешаем только http(s)-ссылки без учётных данных в URL.
   * Это защита от javascript:, data: и подобных схем, а не фильтр контента.
   */
  function safeHttpUrl(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    try {
      const url = new URL(trimmed, global.location.origin);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
      if (url.username || url.password) return '';
      return url.href;
    } catch (_error) {
      return '';
    }
  }

  function isSameOrigin(url) {
    try {
      return new URL(url, global.location.origin).origin === global.location.origin;
    } catch (_error) {
      return false;
    }
  }

  S.util = {
    el, clear, qs, svg, icon, ICONS,
    plural, formatCount, pluralizeView, pluralizeSub, pluralizeComment, pluralizeVideo, pluralizeLike,
    formatDate, timeAgo, formatDuration, toDate,
    initials, slugify, shortId, uid, clamp, escapeRegExp, safeHttpUrl, isSameOrigin,
  };
})(window);
