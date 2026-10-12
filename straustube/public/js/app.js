'use strict';

/**
 * StrausTube — точка входа: маршрутизация, шапка, боковое меню,
 * горячая комбинация S + Tab для служебной панели и инициализация.
 */
(function (global) {
  const S = (global.StrausTube = global.StrausTube || {});
  const U = S.util;
  const UI = S.ui;
  const V = S.views;

  let accountMenu = null;
  let sArmed = false;

  /* =====================================================================
     Маршрутизация
     ===================================================================== */

  function parseRoute() {
    const hash = global.location.hash.replace(/^#/, '') || '/';
    const [pathPart, queryPart] = hash.split('?');
    const segments = pathPart.split('/').filter(Boolean);
    return {
      segments,
      params: new URLSearchParams(queryPart || ''),
    };
  }

  function navigate(hash) {
    const next = hash.startsWith('#') ? hash : '#' + hash;
    if (global.location.hash === next) render();
    else global.location.hash = next;
  }

  function resolve(route) {
    const [first, second] = route.segments;
    const params = route.params;
    params.id = second || '';

    switch (first) {
      case undefined:
        return { view: 'home', title: 'Главная' };
      case 'watch':
        return { view: 'watch', title: 'Просмотр', requireId: true };
      case 'channel':
        return { view: 'channel', title: 'Канал', requireId: true };
      case 'upload':
        return { view: 'upload', title: 'Загрузка' };
      case 'manage':
        return { view: 'manage', title: 'Редактирование', requireId: true };
      case 'login':
        return { view: 'login', title: 'Вход' };
      case 'register':
        return { view: 'register', title: 'Регистрация' };
      case 'subscriptions':
        return { view: 'subscriptions', title: 'Подписки' };
      case 'profile':
        return { view: 'profile', title: 'Мой профиль' };
      case 'liked':
        return { view: 'liked', title: 'Понравившиеся' };
      case 'history':
        return { view: 'history', title: 'Недавние' };
      case 'settings':
        return { view: 'settings', title: 'Настройки' };
      case 'search':
        return { view: 'search', title: 'Поиск' };
      default:
        return { view: 'notfound', title: 'Не найдено' };
    }
  }

  /* =====================================================================
     Отрисовка
     ===================================================================== */

  function render() {
    const me = S.store.currentUser();
    const route = parseRoute();
    const target = resolve(route);

    renderAccount(me);
    renderSidebar(me, route);

    const main = U.qs('#main');
    if (!main) return;
    U.clear(main);

    let node;
    switch (target.view) {
      case 'home': node = V.homeView(route.params); break;
      case 'watch': node = route.params.id ? V.watchView(route.params) : V.notFoundView('Видео не найдено', 'Выберите ролик в ленте.'); break;
      case 'channel': node = route.params.id ? V.channelView(route.params) : V.notFoundView('Канал не найден', 'Выберите канал в ленте.'); break;
      case 'upload': node = V.uploadView(); break;
      case 'manage': node = route.params.id ? V.manageView(route.params) : V.notFoundView('Видео не найдено', 'Выберите ролик для редактирования.'); break;
      case 'login': node = V.loginView(); break;
      case 'register': node = V.registerView(); break;
      case 'subscriptions': node = V.subscriptionsView(); break;
      case 'profile': node = V.profileView(); break;
      case 'liked': node = V.likedView(); break;
      case 'history': node = V.historyView(); break;
      case 'settings': node = V.settingsView(); break;
      case 'search': node = V.searchView(route.params); break;
      default: node = V.notFoundView('Страница не найдена', 'Проверьте адрес или вернитесь в ленту.');
    }

    main.appendChild(node);
    document.title = target.title === 'Главная' ? 'StrausTube — видеохостинг' : target.title + ' — StrausTube';

    const searchInput = U.qs('#search-input');
    if (searchInput && !searchInput.value) searchInput.value = route.view === 'search' ? (route.params.get('q') || '') : '';

    if (route.view === 'watch') {
      global.scrollTo({ top: 0, behavior: 'auto' });
    }
  }

  /* =====================================================================
     Шапка: аккаунт и поиск
     ===================================================================== */

  function renderAccount(me) {
    const slot = U.qs('#account-slot');
    if (!slot) return;
    U.clear(slot);
    closeAccountMenu(false);

    if (!me) {
      slot.appendChild(UI.link('#/login', 'Войти', 'btn btn--ghost'));
      return;
    }

    const button = U.el('button', {
      class: 'avatar-btn',
      attrs: { type: 'button', 'aria-label': 'Меню аккаунта: ' + me.name, 'aria-haspopup': 'menu', 'aria-expanded': 'false' },
      children: [UI.avatarNode(me, 32)],
    });
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleAccountMenu(me, button);
    });
    slot.appendChild(button);
  }

  function toggleAccountMenu(me, anchor) {
    if (accountMenu) {
      closeAccountMenu(true);
      return;
    }
    const menu = U.el('div', { class: 'menu', attrs: { role: 'menu' } });

    const head = U.el('div', { class: 'menu__head' });
    head.appendChild(UI.avatarNode(me, 40));
    const info = U.el('div');
    info.appendChild(U.el('div', { class: 'menu__name', text: me.name }));
    info.appendChild(U.el('div', { class: 'menu__meta', text: me.handle }));
    head.appendChild(info);
    menu.appendChild(head);
    menu.appendChild(U.el('div', { class: 'menu__sep' }));

    const items = [
      ['Мой канал', 'you', () => navigate('#/channel/' + me.id)],
      ['Понравившиеся', 'like', () => navigate('#/liked')],
      ['Настройки', 'edit', () => navigate('#/settings')],
      ['Сменить аккаунт', 'switch', () => openAccountSwitcher(me)],
      [S.store.getTheme() === 'light' ? 'Тёмная тема' : 'Светлая тема', 'moon', () => {
        S.store.setTheme(S.store.getTheme() === 'light' ? 'dark' : 'light');
        render();
      }],
      ['Выйти', 'logout', () => {
        S.store.clearSession();
        UI.toast('Вы вышли из аккаунта', 'ok');
        navigate('#/');
        render();
      }],
    ];

    for (const [label, iconName, action] of items) {
      const item = U.el('button', { class: 'menu__item', attrs: { type: 'button', role: 'menuitem' } });
      item.appendChild(U.icon(iconName));
      item.appendChild(U.el('span', { text: label }));
      item.addEventListener('click', () => {
        closeAccountMenu(true);
        action();
      });
      menu.appendChild(item);
    }

    U.qs('.topbar').appendChild(menu);
    accountMenu = menu;
    anchor.setAttribute('aria-expanded', 'true');

    const onDocumentClick = (event) => {
      if (menu.contains(event.target)) return;
      closeAccountMenu(true);
    };
    setTimeout(() => document.addEventListener('click', onDocumentClick), 0);
    menu._onDocumentClick = onDocumentClick;
  }

  function closeAccountMenu(restoreFocus) {
    if (!accountMenu) return;
    if (accountMenu._onDocumentClick) {
      document.removeEventListener('click', accountMenu._onDocumentClick);
    }
    accountMenu.remove();
    accountMenu = null;
    const button = U.qs('#account-slot .avatar-btn');
    if (button) {
      button.setAttribute('aria-expanded', 'false');
      if (restoreFocus) button.focus();
    }
  }

  /** Список локальных аккаунтов: быстрое переключение без ввода пароля для уже открытых сессий. */
  function openAccountSwitcher(me) {
    const users = S.store.getDb().users.slice();
    const body = U.el('div');
    body.appendChild(
      U.el('p', {
        class: 'hint-text',
        props: { style: 'margin:0 0 12px' },
        text: 'Аккаунты этого браузера. Для входа под другим профилем нужен его пароль.',
      })
    );

    for (const user of users) {
      const row = U.el('div', {
        props: { style: 'display:flex;gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--border)' },
      });
      row.appendChild(UI.avatarNode(user, 40));
      const info = U.el('div', { props: { style: 'flex:1;min-width:0' } });
      info.appendChild(U.el('div', { props: { style: 'font-weight:600' }, text: user.name }));
      info.appendChild(U.el('div', { class: 'hint-text', text: user.handle + (user.id === me.id ? ' · активный' : '') }));
      row.appendChild(info);
      if (user.id !== me.id) {
        row.appendChild(
          U.el('button', {
            class: 'btn btn--ghost btn--sm',
            attrs: { type: 'button' },
            text: 'Выбрать',
            on: {
              click: () => {
                close();
                // Смена аккаунта: сначала выходим из текущего, иначе страница
                // входа покажет «Вы уже вошли». Пароль нужен, он не подставляется.
                S.store.clearSession();
                navigate('#/login');
                UI.toast('Введите пароль профиля «' + user.name + '»', 'ok');
                global.setTimeout(() => {
                  const input = U.qs('#main input[autocomplete="username"]');
                  if (input) {
                    input.value = user.name;
                    input.focus();
                  }
                }, 60);
              },
            },
          })
        );
      }
      body.appendChild(row);
    }

    const more = U.el('div', { class: 'form-actions' });
    more.appendChild(UI.link('#/register', 'Создать новый канал', 'btn btn--primary btn--sm'));
    body.appendChild(more);

    const close = UI.openModal({ title: 'Аккаунты устройства', body });
    return close;
  }

  /* =====================================================================
     Боковое меню
     ===================================================================== */

  function renderSidebar(me, route) {
    const nav = U.qs('#sidebar-nav');
    const subs = U.qs('#sidebar-subs');
    const subsList = U.qs('#sidebar-subs-list');
    if (!nav || !subs || !subsList) return;
    U.clear(nav);
    U.clear(subsList);

    const current = route.segments[0] || '';

    const items = [
      { label: 'Главная', icon: 'home', href: '#/', match: '' },
      { label: 'Подписки', icon: 'subs', href: '#/subscriptions', match: 'subscriptions' },
      me
        ? { label: 'Мой канал', icon: 'you', href: '#/channel/' + me.id, match: 'channel', avatar: me }
        : { label: 'Войти', icon: 'you', href: '#/login', match: 'login' },
      { label: 'Понравившиеся', icon: 'like', href: '#/liked', match: 'liked' },
      { label: 'Недавние', icon: 'film', href: '#/history', match: 'history' },
      { label: 'Настройки', icon: 'edit', href: '#/settings', match: 'settings' },
    ];

    for (const item of items) {
      const node = U.el('a', {
        class: 'nav__item' + (item.match === current ? ' active' : ''),
        attrs: { href: item.href, 'data-link': '' },
      });
      if (item.avatar) node.appendChild(UI.avatarNode(item.avatar, 24));
      else node.appendChild(U.icon(item.icon));
      node.appendChild(U.el('span', { class: 'nav__label', text: item.label }));
      nav.appendChild(node);
    }

    const themeItem = U.el('button', { class: 'nav__item', attrs: { type: 'button' } });
    themeItem.appendChild(U.icon(S.store.getTheme() === 'light' ? 'moon' : 'sun'));
    themeItem.appendChild(
      U.el('span', { class: 'nav__label', text: S.store.getTheme() === 'light' ? 'Тёмная тема' : 'Светлая тема' })
    );
    themeItem.addEventListener('click', () => {
      S.store.setTheme(S.store.getTheme() === 'light' ? 'dark' : 'light');
      render();
    });
    nav.appendChild(themeItem);

    const channels = me ? S.store.listSubscriptions(me.id) : [];
    if (!channels.length) {
      subs.hidden = !me;
      if (me) {
        subsList.appendChild(
          U.el('p', { class: 'hint-text', props: { style: 'padding:0 12px' }, text: 'Подписок пока нет.' })
        );
      }
      return;
    }
    subs.hidden = false;
    for (const channel of channels) {
      const node = U.el('a', { class: 'nav__item', attrs: { href: '#/channel/' + channel.id, 'data-link': '' } });
      node.appendChild(UI.avatarNode(channel, 24));
      node.appendChild(U.el('span', { class: 'nav__label', text: channel.name }));
      subsList.appendChild(node);
    }
  }

  /* =====================================================================
     Глобальные события
     ===================================================================== */

  function isTypingTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  function wireGlobalShortcuts() {
    document.addEventListener('keydown', (event) => {
      /* Служебная комбинация: S (зажата) + Tab. В полях ввода не срабатывает. */
      if (event.code === 'KeyS' && !event.repeat && !isTypingTarget(event.target) && !event.ctrlKey && !event.metaKey && !event.altKey) {
        sArmed = true;
      }
      if (event.key === 'Tab' && sArmed && !isTypingTarget(event.target)) {
        event.preventDefault();
        sArmed = false;
        S.admin.toggle();
        return;
      }
      if (event.key === 'Escape') {
        if (accountMenu) closeAccountMenu(true);
        else if (S.admin.isOpen()) S.admin.closePanel();
      }
    });

    document.addEventListener('keyup', (event) => {
      if (event.code === 'KeyS') sArmed = false;
    });

    window.addEventListener('blur', () => {
      sArmed = false;
    });
  }

  function wireHeader() {
    const form = U.qs('#form-search');
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const input = U.qs('#search-input');
        const query = input ? input.value.trim() : '';
        navigate('#/search?q=' + encodeURIComponent(query));
      });
    }

    const menuButton = U.qs('#btn-menu');
    const sidebar = U.qs('#sidebar');
    if (menuButton && sidebar) {
      menuButton.addEventListener('click', () => {
        const collapsed = sidebar.classList.toggle('collapsed');
        sidebar.classList.toggle('open', !collapsed && global.innerWidth <= 900);
        menuButton.setAttribute('aria-pressed', collapsed ? 'true' : 'false');
      });
    }

    window.addEventListener('hashchange', () => {
      closeAccountMenu(false);
      const sidebar = U.qs('#sidebar');
      if (sidebar && global.innerWidth <= 900) sidebar.classList.remove('open');
      render();
    });

    window.addEventListener('resize', () => {
      const sidebar = U.qs('#sidebar');
      if (sidebar && global.innerWidth > 900) sidebar.classList.remove('open');
    });
  }

  /* =====================================================================
     Запуск
     ===================================================================== */

  function mountAdminRoot() {
    const root = U.el('div', {
      class: 'admin-root',
      id: 'admin-root',
      attrs: { hidden: 'hidden', role: 'dialog', 'aria-label': 'Служебная панель модерации' },
    });
    document.body.appendChild(root);
    S.admin.mount(root);
    return root;
  }

  async function boot() {
    S.store.setTheme(S.store.getTheme());

    try {
      await S.seed.seedIfNeeded(false);
    } catch (error) {
      console.warn('[StrausTube] Демо-данные не загружены:', error.message);
    }

    const app = U.qs('#app');
    if (app) app.hidden = false;

    wireHeader();
    wireGlobalShortcuts();
    mountAdminRoot();

    S.store.onChange(() => { /* хранилище изменилось — интерфейс обновляется точечно */ });

    render();
  }

  S.app = {
    render,
    navigate,
    boot,
    parseRoute,
    closeAccountMenu,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
