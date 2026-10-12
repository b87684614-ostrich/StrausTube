'use strict';

/**
 * StrausTube — служебная панель модерации.
 *
 * Панель не является частью публичного интерфейса: она не появляется в меню,
 * не индексируется (robots.txt) и монтируется только на время сессии
 * модератора. Доступ открывается секретной комбинацией S + Tab; действия
 * внутри дополнительно защищены локальным ключом модератора.
 *
 * ВАЖНО: приложение полностью клиентское, данные лежат в localStorage
 * браузера. Любой «админ-доступ» здесь — это инструмент удобства для
 * владельца устройства, а не удалённая система управления. Владелец
 * браузера в любом случае имеет физический доступ к своим данным.
 */
(function (global) {
  const S = (global.StrausTube = global.StrausTube || {});
  const U = S.util;

  const PREV_SESSION_KEY = 'straustube.admin.prev';

  const TABS = [
    { id: 'dashboard', label: 'Обзор' },
    { id: 'videos', label: 'Видео' },
    { id: 'users', label: 'Пользователи' },
    { id: 'comments', label: 'Комментарии' },
    { id: 'logs', label: 'Журнал' },
    { id: 'data', label: 'Данные' },
  ];

  let root = null;
  let panelOpen = false;
  let activeTab = 'dashboard';
  let videoQuery = '';
  let userQuery = '';

  /* ---------- Монтирование ---------- */

  function mount(element) {
    root = element;
    render();
  }

  function isOpen() {
    return panelOpen;
  }

  function openPanel() {
    if (!root) return;
    panelOpen = true;
    root.hidden = false;
    document.body.style.overflow = 'hidden';
    render();
    const focusable = root.querySelector('input, button');
    if (focusable) focusable.focus();
  }

  function closePanel() {
    if (!root) return;
    panelOpen = false;
    root.hidden = true;
    document.body.style.overflow = '';
  }

  function toggle() {
    if (panelOpen) closePanel();
    else openPanel();
  }

  function render() {
    if (!root || !panelOpen) return;
    U.clear(root);
    if (!S.store.isAdmin()) {
      root.appendChild(gateView());
      return;
    }
    root.appendChild(adminBar());
    const body = U.el('div', { class: 'admin-body' });
    body.appendChild(tabContent());
    root.appendChild(body);
  }

  /* ---------- Экран блокировки ---------- */

  function gateView() {
    const wrap = U.el('div', { class: 'locked-panel' });
    wrap.appendChild(U.el('div', { class: 'locked-panel__icon', text: '\u{1F510}' }));
    wrap.appendChild(U.el('h2', { props: { style: 'margin:0 0 8px' }, text: 'Служебный доступ' }));
    wrap.appendChild(
      U.el('p', {
        class: 'hint-text',
        text: 'Раздел предназначен для модерации локальной библиотеки StrausTube. Введите ключ доступа.',
      })
    );

    const input = U.el('input', {
      class: 'input',
      attrs: { type: 'password', placeholder: 'straus-____-____', autocomplete: 'off', maxlength: '64' },
      props: { style: 'margin:16px 0 8px;text-align:center' },
    });
    const error = U.el('p', { class: 'error-text', props: { style: 'min-height:18px' } });
    const button = U.el('button', {
      class: 'btn btn--primary btn--block',
      attrs: { type: 'button' },
      text: 'Войти',
    });

    async function submit() {
      error.textContent = '';
      button.disabled = true;
      button.textContent = 'Проверка…';
      const ok = await S.store.adminUnlock(input.value);
      button.disabled = false;
      button.textContent = 'Войти';
      if (!ok) {
        error.textContent = 'Ключ не подошёл.';
        input.value = '';
        input.focus();
        return;
      }
      try {
        S.store.logAction('Вход в панель модерации', S.store.currentUser() ? S.store.currentUser().name : 'гость');
      } catch (_error) { /* журнал доступен только после входа */ }
      render();
    }

    button.addEventListener('click', submit);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') submit();
    });

    const form = U.el('div', { class: 'card-panel' });
    form.appendChild(input);
    form.appendChild(error);
    form.appendChild(button);
    form.appendChild(
      U.el('button', {
        class: 'btn btn--ghost btn--block',
        props: { style: 'margin-top:10px' },
        attrs: { type: 'button' },
        text: 'Выйти из раздела',
        on: { click: () => closePanel() },
      })
    );
    wrap.appendChild(form);
    return wrap;
  }

  /* ---------- Верхняя строка панели ---------- */

  function adminBar() {
    const bar = U.el('div', { class: 'admin-bar' });
    const me = S.store.currentUser();
    const title = U.el('div', { class: 'admin-bar__title' });
    title.appendChild(document.createTextNode('Панель модерации '));
    title.appendChild(U.el('span', { text: 'StrausTube' }));
    bar.appendChild(title);

    const tabs = U.el('div', { class: 'admin-tabs' });
    for (const tab of TABS) {
      tabs.appendChild(
        U.el('button', {
          class: 'admin-tab' + (activeTab === tab.id ? ' active' : ''),
          attrs: { type: 'button' },
          text: tab.label,
          on: {
            click: () => {
              activeTab = tab.id;
              render();
            },
          },
        })
      );
    }
    bar.appendChild(tabs);

    const spacer = U.el('div', { class: 'admin-bar__spacer' });
    bar.appendChild(spacer);

    const prev = readPrevSession();
    if (prev && me && prev !== me.id && S.store.findUser(prev)) {
      const prevUser = S.store.findUser(prev);
      bar.appendChild(
        U.el('button', {
          class: 'btn btn--ghost btn--sm',
          attrs: { type: 'button' },
          text: 'Вернуться к «' + prevUser.name + '»',
          on: { click: stopImpersonation },
        })
      );
    }
    if (me) {
      bar.appendChild(U.el('span', { class: 'badge', text: 'под профилем: ' + me.name }));
    }
    bar.appendChild(U.el('span', { class: 'admin-bar__hint', text: 'S+Tab — открыть/скрыть · Esc — скрыть' }));
    bar.appendChild(
      U.el('button', {
        class: 'btn btn--ghost btn--sm',
        attrs: { type: 'button' },
        text: 'Скрыть панель',
        on: { click: () => closePanel() },
      })
    );
    return bar;
  }

  function tabContent() {
    switch (activeTab) {
      case 'videos': return videosTab();
      case 'users': return usersTab();
      case 'comments': return commentsTab();
      case 'logs': return logsTab();
      case 'data': return dataTab();
      default: return dashboardTab();
    }
  }

  /* ---------- Обзор ---------- */

  function dashboardTab() {
    const wrap = U.el('div');
    const stats = S.store.globalStats();

    const grid = U.el('div', { class: 'stats' });
    const cards = [
      ['Пользователи', stats.users],
      ['Видео', stats.videos],
      ['Просмотры', stats.views],
      ['Комментарии', stats.comments],
      ['Отметки «Нравится»', stats.likes],
      ['Подписки', stats.subs],
    ];
    for (const [label, value] of cards) {
      const card = U.el('div', { class: 'stat' });
      card.appendChild(U.el('div', { class: 'stat__value', text: U.formatCount(value) }));
      card.appendChild(U.el('div', { class: 'stat__label', text: label }));
      grid.appendChild(card);
    }
    wrap.appendChild(grid);

    const info = U.el('div', { class: 'card-panel', props: { style: 'margin-bottom:20px' } });
    info.appendChild(U.el('h3', { props: { style: 'margin:0 0 8px' }, text: 'Как это работает' }));
    info.appendChild(
      U.el('p', {
        class: 'hint-text',
        props: { style: 'margin:0' },
        text: 'StrausTube работает целиком в браузере: аккаунты, видео, комментарии и подписки хранятся в localStorage. Сервер ничего не знает о ваших данных, поэтому резервную копию удобно держать в разделе «Данные».',
      })
    );
    wrap.appendChild(info);

    const recent = U.el('div');
    recent.appendChild(U.el('h3', { props: { style: 'margin:0 0 12px' }, text: 'Последние действия' }));
    recent.appendChild(logsList(8));
    wrap.appendChild(recent);

    return wrap;
  }

  /* ---------- Видео ---------- */

  function videosTab() {
    const wrap = U.el('div');
    const toolbar = U.el('div', { props: { style: 'display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px' } });
    const search = U.el('input', {
      class: 'input',
      attrs: { type: 'search', placeholder: 'Поиск по названию, описанию или каналу', maxlength: '80' },
      props: { style: 'max-width:420px' },
      value: videoQuery,
    });
    search.addEventListener('input', () => {
      videoQuery = search.value;
      render();
    });
    toolbar.appendChild(search);
    toolbar.appendChild(
      U.el('button', {
        class: 'btn btn--ghost',
        attrs: { type: 'button' },
        text: 'Обновить',
        on: { click: () => render() },
      })
    );
    wrap.appendChild(toolbar);
    const videos = S.store.listVideos({ query: videoQuery });
    wrap.appendChild(videoTable(videos));
    return wrap;
  }

  function videoTable(videos) {
    if (!videos.length) return S.ui.emptyNode('Видео не найдены', 'Попробуйте изменить запрос.');

    const table = U.el('table', { class: 'table' });
    const thead = U.el('thead');
    const headRow = U.el('tr');
    for (const label of ['Видео', 'Канал', 'Категория', 'Просмотры', 'Лайки', 'Дата', 'Действия']) {
      headRow.appendChild(U.el('th', { text: label }));
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = U.el('tbody');
    for (const video of videos) {
      const row = U.el('tr');
      const titleCell = U.el('td');
      titleCell.appendChild(
        U.el('div', { props: { style: 'display:flex;gap:10px;align-items:center' } })
      );
      const titleWrap = titleCell.firstChild;
      const cover = S.media.coverOf(video, 'small');
      if (cover) {
        titleWrap.appendChild(
          U.el('img', {
            attrs: { src: cover, alt: '', width: 64, height: 36 },
            props: { style: 'width:64px;height:36px;object-fit:cover;border-radius:6px;flex:none' },
          })
        );
      }
      titleWrap.appendChild(
        U.el('div', {
          props: { style: 'min-width:0' },
          children: [U.el('div', { props: { style: 'font-weight:600' }, text: video.title })],
        })
      );
      row.appendChild(titleCell);

      const authorCell = U.el('td');
      const author = S.store.findUser(video.authorId);
      authorCell.textContent = author ? author.name : '—';
      row.appendChild(authorCell);

      row.appendChild(U.el('td', { text: S.media.categoryLabel(video.category) }));
      row.appendChild(U.el('td', { text: U.formatCount(video.views || 0) }));
      row.appendChild(U.el('td', { text: U.formatCount(S.store.countLikes(video.id, 'like')) }));
      row.appendChild(U.el('td', { text: U.formatDate(video.createdAt) }));

      const actions = U.el('div', { class: 'cell-actions' });
      actions.appendChild(
        U.el('button', {
          class: 'btn btn--ghost btn--sm',
          attrs: { type: 'button' },
          text: 'Изменить',
          on: { click: () => openVideoEditor(video) },
        })
      );
      actions.appendChild(
        U.el('button', {
          class: 'btn btn--ghost btn--sm',
          attrs: { type: 'button' },
          text: 'Открыть',
          on: {
            click: () => {
              closePanel();
              S.app.navigate('#/watch/' + video.id);
            },
          },
        })
      );
      actions.appendChild(
        U.el('button', {
          class: 'btn btn--danger btn--sm',
          attrs: { type: 'button' },
          text: 'Удалить',
          on: {
            click: async () => {
              const ok = await S.ui.confirmDialog({
                title: 'Удалить видео?',
                message: '«' + video.title + '» будет удалено вместе с комментариями и отметками.',
                confirmLabel: 'Удалить',
                danger: true,
              });
              if (!ok) return;
              try {
                S.store.requireAdmin();
                S.store.removeVideo(video.id);
                S.store.logAction('Удалено видео', video.title);
                S.ui.toast('Видео удалено', 'ok');
                render();
              } catch (error) {
                S.ui.toast(error.message, 'error');
              }
            },
          },
        })
      );
      const cell = U.el('td');
      cell.appendChild(actions);
      row.appendChild(cell);
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    return table;
  }

  function openVideoEditor(video) {
    const users = S.store.getDb().users.slice();
    const form = U.el('form');

    const titleField = field('Название', U.el('input', { class: 'input', value: video.title, attrs: { maxlength: '140' } }));
    const descField = field('Описание', U.el('textarea', { class: 'textarea', value: video.description || '' }));
    const categorySelect = U.el('select', { class: 'select' });
    for (const category of S.media.CATEGORIES) {
      if (category.id === 'all') continue;
      const option = U.el('option', { value: category.id, text: category.label });
      if (video.category === category.id) option.selected = true;
      categorySelect.appendChild(option);
    }
    const authorSelect = U.el('select', { class: 'select' });
    for (const user of users) {
      const option = U.el('option', { value: user.id, text: user.name });
      if (user.id === video.authorId) option.selected = true;
      authorSelect.appendChild(option);
    }

    const coverInput = U.el('input', { class: 'input', value: video.coverUrl || '', attrs: { placeholder: 'assets/demo/cover-light.jpg или https://…' } });
    const mediaInput = U.el('input', { class: 'input', value: video.mediaUrl || '', attrs: { placeholder: 'ссылка на mp4/webm или оставьте пустым' } });
    const durationInput = U.el('input', { class: 'input', attrs: { type: 'number', min: '0', step: '1' }, value: String(video.duration || 0) });
    const viewsInput = U.el('input', { class: 'input', attrs: { type: 'number', min: '0', step: '1' }, value: String(video.views || 0) });
    const likesInput = U.el('input', { class: 'input', attrs: { type: 'number', min: '0', step: '1' }, value: String(video.baseLikes || 0) });
    const dislikesInput = U.el('input', { class: 'input', attrs: { type: 'number', min: '0', step: '1' }, value: String(video.baseDislikes || 0) });

    form.appendChild(titleField);
    form.appendChild(descField);
    const row1 = U.el('div', { class: 'form-row' });
    row1.appendChild(field('Категория', categorySelect));
    row1.appendChild(field('Канал', authorSelect));
    form.appendChild(row1);
    form.appendChild(field('Обложка', coverInput));
    form.appendChild(field('Файл видео', mediaInput));
    const row2 = U.el('div', { class: 'form-row' });
    row2.appendChild(field('Длительность, сек', durationInput));
    row2.appendChild(field('Просмотры', viewsInput));
    form.appendChild(row2);
    const row3 = U.el('div', { class: 'form-row' });
    row3.appendChild(field('Стартовые лайки', likesInput));
    row3.appendChild(field('Стартовые дизлайки', dislikesInput));
    form.appendChild(row3);

    S.ui.openModal({
      title: 'Редактирование видео',
      wide: true,
      body: form,
      actions: [
        { label: 'Отмена', kind: 'ghost' },
        {
          label: 'Сохранить',
          kind: 'primary',
          onClick: () => {
            try {
              S.store.adminPatchVideo(video.id, {
                title: titleField.querySelector('input').value,
                description: descField.querySelector('textarea').value,
                category: categorySelect.value,
                authorId: authorSelect.value,
                coverUrl: coverInput.value,
                mediaUrl: mediaInput.value,
                duration: Number(durationInput.value),
                views: Number(viewsInput.value),
                baseLikes: Number(likesInput.value),
                baseDislikes: Number(dislikesInput.value),
              });
              S.store.logAction('Изменено видео', video.title);
              S.ui.toast('Видео сохранено', 'ok');
              render();
            } catch (error) {
              S.ui.toast(error.message, 'error');
              return false;
            }
            return true;
          },
        },
      ],
    });
  }

  /* ---------- Пользователи ---------- */

  function usersTab() {
    const wrap = U.el('div');
    const toolbar = U.el('div', { props: { style: 'display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px' } });
    const search = U.el('input', {
      class: 'input',
      attrs: { type: 'search', placeholder: 'Поиск по имени или описанию', maxlength: '80' },
      props: { style: 'max-width:360px' },
      value: userQuery,
    });
    search.addEventListener('input', () => {
      userQuery = search.value;
      render();
    });
    toolbar.appendChild(search);
    toolbar.appendChild(
      U.el('button', {
        class: 'btn btn--primary',
        attrs: { type: 'button' },
        text: 'Создать профиль',
        on: { click: () => openUserCreator() },
      })
    );
    wrap.appendChild(toolbar);

    const needle = userQuery.trim().toLowerCase();
    const users = S.store.getDb().users.filter((user) => {
      if (!needle) return true;
      return [user.name, user.handle, user.bio || ''].join(' ').toLowerCase().includes(needle);
    });
    wrap.appendChild(userTable(users));
    return wrap;
  }

  function userTable(users) {
    if (!users.length) return S.ui.emptyNode('Пользователи не найдены', 'Измените запрос или создайте новый профиль.');

    const table = U.el('table', { class: 'table' });
    const headRow = U.el('tr');
    for (const label of ['Профиль', 'Роль', 'Видео', 'Просмотры', 'Подписчики', 'Регистрация', 'Действия']) {
      headRow.appendChild(U.el('th', { text: label }));
    }
    const thead = U.el('thead');
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = U.el('tbody');
    for (const user of users) {
      const stats = S.store.userStats(user.id);
      const row = U.el('tr');

      const profileCell = U.el('td');
      const profileWrap = U.el('div', { props: { style: 'display:flex;gap:12px;align-items:center' } });
      profileWrap.appendChild(S.ui.avatarNode(user, 36));
      const nameWrap = U.el('div');
      nameWrap.appendChild(U.el('div', { props: { style: 'font-weight:600' }, text: user.name }));
      nameWrap.appendChild(U.el('div', { class: 'hint-text', text: user.handle + (user.demo ? ' · демо' : '') }));
      profileWrap.appendChild(nameWrap);
      profileCell.appendChild(profileWrap);
      row.appendChild(profileCell);

      row.appendChild(U.el('td', { text: user.role === 'moderator' ? 'модератор' : 'пользователь' }));
      row.appendChild(U.el('td', { text: String(stats.videos) }));
      row.appendChild(U.el('td', { text: U.formatCount(stats.views) }));
      row.appendChild(U.el('td', { text: U.formatCount(stats.subs) }));
      row.appendChild(U.el('td', { text: U.formatDate(user.createdAt) }));

      const actions = U.el('div', { class: 'cell-actions' });
      actions.appendChild(
        U.el('button', {
          class: 'btn btn--ghost btn--sm',
          attrs: { type: 'button' },
          text: 'Войти под профилем',
          on: { click: () => impersonate(user.id) },
        })
      );
      actions.appendChild(
        U.el('button', {
          class: 'btn btn--ghost btn--sm',
          attrs: { type: 'button' },
          text: 'Изменить',
          on: { click: () => openUserEditor(user) },
        })
      );
      actions.appendChild(
        U.el('button', {
          class: 'btn btn--ghost btn--sm',
          attrs: { type: 'button' },
          text: 'Канал',
          on: {
            click: () => {
              closePanel();
              S.app.navigate('#/channel/' + user.id);
            },
          },
        })
      );
      actions.appendChild(
        U.el('button', {
          class: 'btn btn--danger btn--sm',
          attrs: { type: 'button' },
          text: 'Удалить',
          on: {
            click: async () => {
              const ok = await S.ui.confirmDialog({
                title: 'Удалить профиль?',
                message: 'Профиль «' + user.name + '», его видео, комментарии и подписки будут удалены безвозвратно.',
                confirmLabel: 'Удалить',
                danger: true,
              });
              if (!ok) return;
              try {
                S.store.requireAdmin();
                S.store.removeUser(user.id);
                S.store.logAction('Удалён профиль', user.name);
                S.ui.toast('Профиль удалён', 'ok');
                render();
              } catch (error) {
                S.ui.toast(error.message, 'error');
              }
            },
          },
        })
      );
      const cell = U.el('td');
      cell.appendChild(actions);
      row.appendChild(cell);
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    return table;
  }

  function openUserEditor(user) {
    const form = U.el('form');

    const nameInput = U.el('input', { class: 'input', value: user.name, attrs: { maxlength: '40' } });
    const bioInput = U.el('textarea', { class: 'textarea', value: user.bio || '', attrs: { maxlength: '400' } });
    const roleSelect = U.el('select', { class: 'select' });
    roleSelect.appendChild(U.el('option', { value: 'user', text: 'Пользователь' }));
    roleSelect.appendChild(U.el('option', { value: 'moderator', text: 'Модератор' }));
    roleSelect.value = user.role === 'moderator' ? 'moderator' : 'user';
    const subsInput = U.el('input', {
      class: 'input',
      attrs: { type: 'number', min: '0', step: '1' },
      value: String(user.subsBase || 0),
    });
    const handleInput = U.el('input', { class: 'input', value: user.handle || '', attrs: { maxlength: '40' } });

    form.appendChild(field('Имя канала', nameInput));
    const row = U.el('div', { class: 'form-row' });
    row.appendChild(field('Никнейм (@…)', handleInput));
    row.appendChild(field('Роль', roleSelect));
    form.appendChild(row);
    form.appendChild(field('Описание канала', bioInput));
    form.appendChild(field('Стартовые подписчики', subsInput));

    const picker = S.ui.avatarPicker(user.avatar, () => {});
    form.appendChild(field('Аватар', picker.node));

    S.ui.openModal({
      title: 'Профиль «' + user.name + '»',
      wide: true,
      body: form,
      actions: [
        { label: 'Отмена', kind: 'ghost' },
        {
          label: 'Сохранить',
          kind: 'primary',
          onClick: () => {
            try {
              S.store.requireAdmin();
              S.store.renameUser(user.id, nameInput.value);
              const handle = handleInput.value.trim();
              const target = S.store.findUser(user.id);
              if (handle) target.handle = handle.startsWith('@') ? handle : '@' + handle;
              S.store.setBio(user.id, bioInput.value);
              S.store.setAvatar(user.id, picker.getValue());
              S.store.adminSetRole(user.id, roleSelect.value);
              S.store.adminSetSubsBase(user.id, Number(subsInput.value));
              S.store.logAction('Изменён профиль', user.name + ' → ' + nameInput.value);
              S.ui.toast('Профиль обновлён', 'ok');
              render();
              S.app.render();
            } catch (error) {
              S.ui.toast(error.message, 'error');
              return false;
            }
            return true;
          },
        },
      ],
    });
  }

  function openUserCreator() {
    const form = U.el('form');
    const nameInput = U.el('input', { class: 'input', attrs: { maxlength: '40', placeholder: 'Имя канала' } });
    const bioInput = U.el('textarea', { class: 'textarea', attrs: { maxlength: '400', placeholder: 'Коротко о канале' } });
    const roleSelect = U.el('select', { class: 'select' });
    roleSelect.appendChild(U.el('option', { value: 'user', text: 'Пользователь' }));
    roleSelect.appendChild(U.el('option', { value: 'moderator', text: 'Модератор' }));
    const picker = S.ui.avatarPicker('', () => {});

    form.appendChild(field('Имя канала', nameInput));
    form.appendChild(field('Описание', bioInput));
    form.appendChild(field('Роль', roleSelect));
    form.appendChild(field('Аватар', picker.node));
    form.appendChild(
      U.el('p', {
        class: 'field__hint',
        text: 'Профиль создаётся без пароля: войти в него можно отсюда кнопкой «Войти под профилем».',
      })
    );

    S.ui.openModal({
      title: 'Новый профиль',
      wide: true,
      body: form,
      actions: [
        { label: 'Отмена', kind: 'ghost' },
        {
          label: 'Создать',
          kind: 'primary',
          onClick: () => {
            try {
              const user = S.store.adminCreateUser({
                name: nameInput.value,
                bio: bioInput.value,
                avatar: picker.getValue(),
                role: roleSelect.value,
              });
              S.store.logAction('Создан профиль', user.name);
              S.ui.toast('Профиль создан', 'ok');
              render();
            } catch (error) {
              S.ui.toast(error.message, 'error');
              return false;
            }
            return true;
          },
        },
      ],
    });
  }

  /* ---------- Комментарии ---------- */

  function commentsTab() {
    const wrap = U.el('div');
    const comments = S.store.getDb().comments.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (!comments.length) return S.ui.emptyNode('Комментариев нет', 'Здесь появятся сообщения пользователей.');

    const table = U.el('table', { class: 'table' });
    const headRow = U.el('tr');
    for (const label of ['Комментарий', 'Автор', 'Видео', 'Дата', 'Действия']) headRow.appendChild(U.el('th', { text: label }));
    const thead = U.el('thead');
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = U.el('tbody');
    for (const comment of comments) {
      const author = S.store.findUser(comment.authorId);
      const video = S.store.findVideo(comment.videoId);
      const row = U.el('tr');
      row.appendChild(U.el('td', { text: comment.text }));

      const authorCell = U.el('td');
      authorCell.textContent = author ? author.name : 'удалён';
      row.appendChild(authorCell);

      const videoCell = U.el('td');
      videoCell.textContent = video ? video.title : 'видео удалено';
      row.appendChild(videoCell);
      row.appendChild(U.el('td', { text: U.timeAgo(comment.createdAt) }));

      const actions = U.el('div', { class: 'cell-actions' });
      actions.appendChild(
        U.el('button', {
          class: 'btn btn--ghost btn--sm',
          attrs: { type: 'button' },
          text: 'Изменить',
          on: {
            click: () => {
              const textarea = U.el('textarea', { class: 'textarea', value: comment.text });
              S.ui.openModal({
                title: 'Изменить комментарий',
                body: textarea,
                actions: [
                  { label: 'Отмена', kind: 'ghost' },
                  {
                    label: 'Сохранить',
                    kind: 'primary',
                    onClick: () => {
                      try {
                        S.store.requireAdmin();
                        S.store.updateComment(comment.id, textarea.value);
                        S.store.logAction('Изменён комментарий', comment.id);
                        S.ui.toast('Комментарий обновлён', 'ok');
                        render();
                      } catch (error) {
                        S.ui.toast(error.message, 'error');
                        return false;
                      }
                      return true;
                    },
                  },
                ],
              });
            },
          },
        })
      );
      actions.appendChild(
        U.el('button', {
          class: 'btn btn--danger btn--sm',
          attrs: { type: 'button' },
          text: 'Удалить',
          on: {
            click: async () => {
              const ok = await S.ui.confirmDialog({
                title: 'Удалить комментарий?',
                message: 'Сообщение будет удалено для всех.',
                confirmLabel: 'Удалить',
                danger: true,
              });
              if (!ok) return;
              try {
                S.store.requireAdmin();
                S.store.removeComment(comment.id);
                S.store.logAction('Удалён комментарий', comment.text.slice(0, 60));
                S.ui.toast('Комментарий удалён', 'ok');
                render();
              } catch (error) {
                S.ui.toast(error.message, 'error');
              }
            },
          },
        })
      );
      const cell = U.el('td');
      cell.appendChild(actions);
      row.appendChild(cell);
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    return table;
  }

  /* ---------- Журнал ---------- */

  function logsTab() {
    const wrap = U.el('div');
    wrap.appendChild(U.el('h3', { props: { style: 'margin:0 0 12px' }, text: 'Журнал действий' }));
    wrap.appendChild(logsList(120));
    return wrap;
  }

  function logsList(limit) {
    const logs = S.store.listLogs().slice(0, limit || 20);
    if (!logs.length) return S.ui.emptyNode('Журнал пуст', 'Здесь появятся действия модерации.');
    const list = U.el('div', { class: 'rows' });
    for (const entry of logs) {
      const item = U.el('div', {
        props: { style: 'display:flex;gap:12px;align-items:baseline;padding:10px 12px;border:1px solid var(--border);border-radius:10px' },
      });
      item.appendChild(U.el('span', { class: 'badge', text: U.timeAgo(entry.at) }));
      item.appendChild(U.el('span', { props: { style: 'font-weight:600' }, text: entry.action }));
      item.appendChild(U.el('span', { class: 'hint-text', text: entry.details }));
      item.appendChild(U.el('span', { class: 'hint-text', props: { style: 'margin-left:auto' }, text: entry.actor }));
      list.appendChild(item);
    }
    return list;
  }

  /* ---------- Данные ---------- */

  function dataTab() {
    const wrap = U.el('div');
    const panel = U.el('div', { class: 'card-panel' });

    panel.appendChild(U.el('h3', { props: { style: 'margin:0 0 8px' }, text: 'Резервная копия' }));
    panel.appendChild(
      U.el('p', {
        class: 'hint-text',
        text: 'Экспорт сохраняет всю библиотеку StrausTube в JSON-файл на вашем устройстве. Импорт заменяет локальные данные содержимым файла.',
      })
    );
    const row = U.el('div', { class: 'form-actions' });

    row.appendChild(
      U.el('button', {
        class: 'btn btn--ghost',
        attrs: { type: 'button' },
        text: 'Экспорт JSON',
        on: {
          click: () => {
            try {
              const blob = new Blob([S.store.exportDb()], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = 'straustube-backup-' + new Date().toISOString().slice(0, 10) + '.json';
              document.body.appendChild(anchor);
              anchor.click();
              anchor.remove();
              setTimeout(() => URL.revokeObjectURL(url), 4000);
              S.store.logAction('Экспорт данных', 'JSON');
            } catch (error) {
              S.ui.toast(error.message, 'error');
            }
          },
        },
      })
    );

    const importInput = U.el('input', { class: 'sr-only', attrs: { type: 'file', accept: 'application/json,.json' } });
    importInput.addEventListener('change', () => {
      const file = importInput.files && importInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const stats = S.store.importDb(String(reader.result || ''));
          S.ui.toast('Импортировано: ' + U.pluralizeVideo(stats.videos) + ', профилей ' + stats.users, 'ok');
          render();
        } catch (error) {
          S.ui.toast('Не удалось импортировать: ' + error.message, 'error');
        }
      };
      reader.readAsText(file);
      importInput.value = '';
    });
    row.appendChild(
      U.el('button', {
        class: 'btn btn--ghost',
        attrs: { type: 'button' },
        text: 'Импорт JSON',
        on: { click: () => importInput.click() },
      })
    );
    row.appendChild(importInput);
    panel.appendChild(row);
    wrap.appendChild(panel);

    const demoPanel = U.el('div', { class: 'card-panel', props: { style: 'margin-top:20px' } });
    demoPanel.appendChild(U.el('h3', { props: { style: 'margin:0 0 8px' }, text: 'Демонстрационная библиотека' }));
    demoPanel.appendChild(
      U.el('p', {
        class: 'hint-text',
        text: 'Пересоздаёт демо-каналы и ролики из комплекта поставки. Личные аккаунты, созданные вручную, при этом не удаляются.',
      })
    );
    demoPanel.appendChild(
      U.el('button', {
        class: 'btn btn--ghost',
        attrs: { type: 'button' },
        text: 'Догрузить демо-данные',
        on: {
          click: async () => {
            const ok = await S.ui.confirmDialog({
              title: 'Догрузить демо-данные?',
              message: 'Демо-каналы и ролики будут добавлены заново (или пересозданы, если уже есть).',
              confirmLabel: 'Догрузить',
            });
            if (!ok) return;
            await S.seed.seedIfNeeded(true);
            S.store.setAdmin(true);
            S.ui.toast('Демо-данные восстановлены', 'ok');
            render();
          },
        },
      })
    );
    wrap.appendChild(demoPanel);

    const dangerPanel = U.el('div', { class: 'card-panel', props: { style: 'margin-top:20px' } });
    dangerPanel.appendChild(U.el('h3', { props: { style: 'margin:0 0 8px' }, text: 'Очистка' }));
    dangerPanel.appendChild(
      U.el('p', {
        class: 'hint-text',
        text: 'Полный сброс удаляет из localStorage браузера аккаунты, видео, комментарии, подписки и настройки StrausTube.',
      })
    );
    dangerPanel.appendChild(
      U.el('button', {
        class: 'btn btn--danger',
        attrs: { type: 'button' },
        text: 'Сбросить все данные',
        on: {
          click: async () => {
            const ok = await S.ui.confirmDialog({
              title: 'Сбросить все данные?',
              message: 'Это действие необратимо. Сначала можно сделать экспорт JSON.',
              confirmLabel: 'Сбросить',
              danger: true,
            });
            if (!ok) return;
            S.store.resetAll();
            closePanel();
            S.ui.toast('Все локальные данные удалены', 'ok');
            S.app.render();
          },
        },
      })
    );
    wrap.appendChild(dangerPanel);
    return wrap;
  }

  /* ---------- Вход под профилем ---------- */

  function readPrevSession() {
    try {
      return global.sessionStorage.getItem(PREV_SESSION_KEY);
    } catch (error) {
      return null;
    }
  }

  function writePrevSession(value) {
    try {
      if (value) global.sessionStorage.setItem(PREV_SESSION_KEY, value);
      else global.sessionStorage.removeItem(PREV_SESSION_KEY);
    } catch (error) {
      /* ignore */
    }
  }

  function impersonate(userId) {
    const user = S.store.findUser(userId);
    if (!user) return;
    try {
      const previous = S.store.getSessionId();
      writePrevSession(previous && previous !== userId ? previous : '');
      S.store.adminImpersonate(userId);
      S.store.logAction('Вход под профилем', user.name);
      S.ui.toast('Вы вошли под профилем «' + user.name + '»', 'ok');
      closePanel();
      S.app.navigate('#/');
      S.app.render();
    } catch (error) {
      S.ui.toast(error.message, 'error');
    }
  }

  function stopImpersonation() {
    const previous = readPrevSession();
    writePrevSession('');
    if (previous && S.store.findUser(previous)) {
      S.store.setSession(previous, false);
      S.ui.toast('Возврат к профилю «' + S.store.findUser(previous).name + '»', 'ok');
    } else {
      S.store.clearSession();
      S.ui.toast('Сессия завершена', 'ok');
    }
    S.app.render();
    render();
  }

  /* ---------- Вспомогательное ---------- */

  function field(label, control) {
    const wrap = U.el('label', { class: 'field' });
    wrap.appendChild(U.el('span', { class: 'field__label', text: label }));
    wrap.appendChild(control);
    return wrap;
  }

  S.admin = {
    mount, render, openPanel, closePanel, toggle, isOpen,
    impersonate, stopImpersonation,
  };
})(window);
