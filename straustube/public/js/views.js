'use strict';

/**
 * StrausTube — страницы приложения.
 * Каждая функция возвращает готовый DOM-узел; пользовательский текст
 * попадает в разметку только через textContent (никаких innerHTML).
 */
(function (global) {
  const S = (global.StrausTube = global.StrausTube || {});
  const U = S.util;
  const UI = S.ui;

  const viewedThisSession = new Set();

  /* =====================================================================
     Главная лента
     ===================================================================== */

  function homeView(params) {
    const category = params && params.get('category') ? params.get('category') : 'all';
    const wrap = U.el('div');

    const chips = U.el('div', { class: 'chips', attrs: { role: 'tablist', 'aria-label': 'Категории' } });
    for (const item of S.media.CATEGORIES) {
      chips.appendChild(
        U.el('button', {
          class: 'chip' + (item.id === category ? ' active' : ''),
          attrs: { type: 'button', role: 'tab', 'aria-selected': item.id === category ? 'true' : 'false' },
          text: item.label,
          on: {
            click: () => {
              S.app.navigate(item.id === 'all' ? '#/' : '#/?category=' + item.id);
            },
          },
        })
      );
    }
    wrap.appendChild(chips);

    const videos = S.store.listVideos({ category, sort: 'newest' });
    if (!videos.length) {
      const action = UI.link('#/upload', 'Загрузить первое видео', 'btn btn--primary');
      wrap.appendChild(UI.videoGrid([], 'В этой категории пока пусто', 'Попробуйте другую категорию или загрузите своё видео.', action));
      return wrap;
    }
    wrap.appendChild(UI.videoGrid(videos));
    return wrap;
  }

  /* =====================================================================
     Просмотр видео
     ===================================================================== */

  function watchView(params) {
    const video = S.store.findVideo(params.id);
    if (!video) return notFoundView('Видео не найдено', 'Возможно, автор удалил этот ролик.');

    const me = S.store.currentUser();
    const author = S.store.findUser(video.authorId);
    const wrap = U.el('div', { class: 'watch' });

    const main = U.el('div');
    main.appendChild(playerNode(video));
    main.appendChild(U.el('h1', { class: 'watch__title', text: video.title }));

    /* Полоса канала и действия */
    const strip = U.el('div', { class: 'channel-strip' });
    const identity = U.el('div', { class: 'channel-strip__id' });
    if (author) {
      identity.appendChild(UI.link('#/channel/' + author.id, UI.avatarNode(author, 40)));
    } else {
      identity.appendChild(UI.avatarNode(null, 40));
    }
    const idText = U.el('div');
    idText.appendChild(UI.link('#/channel/' + video.authorId, U.el('div', { class: 'channel-strip__name', text: author ? author.name : 'Удалённый канал' })));
    if (author) {
      const stats = S.store.userStats(author.id);
      idText.appendChild(U.el('div', { class: 'channel-strip__subs', text: U.pluralizeSub(stats.subs) }));
    }
    identity.appendChild(idText);
    strip.appendChild(identity);

    const actions = U.el('div', { class: 'channel-strip__actions' });
    actions.appendChild(likeGroup(video));
    actions.appendChild(shareButton(video));
    actions.appendChild(moreButton(video));
    strip.appendChild(actions);
    main.appendChild(strip);

    /* Описание */
    const description = U.el('div', { class: 'description' + ((video.description || '').length > 220 ? ' is-clamped' : '') });
    description.appendChild(
      U.el('div', {
        class: 'description__meta',
        text: `${U.pluralizeView(video.views || 0)} · ${U.formatDate(video.createdAt)}` + (video.editedAt ? ' · изменено' : ''),
      })
    );
    description.appendChild(U.el('div', { text: video.description || 'Описание не добавлено.' }));
    main.appendChild(description);

    if ((video.description || '').length > 220) {
      const toggle = U.el('button', { class: 'link-btn', attrs: { type: 'button' }, text: 'Ещё' });
      toggle.addEventListener('click', () => {
        const clamped = description.classList.toggle('is-clamped');
        toggle.textContent = clamped ? 'Ещё' : 'Свернуть';
      });
      main.appendChild(toggle);
    }

    main.appendChild(UI.commentsSection(video));
    wrap.appendChild(main);

    /* Рекомендации */
    const aside = U.el('aside');
    aside.appendChild(U.el('h2', { props: { style: 'font-size:16px;margin:4px 0 14px' }, text: 'Похожие видео' }));
    const recommended = recommend(video, 8);
    if (!recommended.length) aside.appendChild(U.el('p', { class: 'hint-text', text: 'Пока нет других роликов.' }));
    for (const other of recommended) aside.appendChild(compactCard(other));
    wrap.appendChild(aside);

    return wrap;
  }

  function recommend(video, limit) {
    const all = S.store.listVideos({ excludeId: video.id, sort: 'popular' });
    const sameCategory = all.filter((item) => item.category === video.category);
    const rest = all.filter((item) => item.category !== video.category);
    return sameCategory.concat(rest).slice(0, limit);
  }

  function compactCard(video) {
    const wrap = UI.link('#/watch/' + video.id, null, 'row');
    const cover = S.media.coverOf(video, 'small') || S.media.coverOf(video);
    const thumb = U.el('div', { class: 'row__thumb' });
    if (cover) {
      thumb.appendChild(
        U.el('img', { attrs: { src: cover, alt: '', loading: 'lazy' } })
      );
    }
    if (video.duration) thumb.appendChild(U.el('span', { class: 'card__duration', text: U.formatDuration(video.duration) }));
    wrap.appendChild(thumb);

    const info = U.el('div');
    info.appendChild(U.el('h3', { class: 'row__title', text: video.title }));
    const author = S.store.findUser(video.authorId);
    info.appendChild(U.el('p', { class: 'row__meta', text: author ? author.name : 'Удалённый канал' }));
    info.appendChild(U.el('p', { class: 'row__meta', text: `${U.pluralizeView(video.views || 0)} · ${U.timeAgo(video.createdAt)}` }));
    wrap.appendChild(info);
    wrap.appendChild(U.el('div'));
    return wrap;
  }

  function playerNode(video) {
    const wrap = U.el('div', { class: 'player' });
    const source = resolveSource(video);

    if (source.kind === 'file') {
      const player = U.el('video', {
        attrs: {
          controls: 'controls',
          preload: 'metadata',
          playsinline: 'playsinline',
          poster: source.poster || '',
        },
      });
      player.src = source.url;
      player.addEventListener('play', () => {
        if (viewedThisSession.has(video.id)) return;
        viewedThisSession.add(video.id);
        S.store.addView(video.id);
      });
      player.addEventListener('error', () => {
        const note = U.el('div', {
          class: 'player__error',
          text: 'Браузер не смог воспроизвести этот файл. Проверьте, что ссылка ведёт на mp4/webm и доступна по https.',
        });
        wrap.appendChild(note);
      });
      wrap.appendChild(player);
      return wrap;
    }

    if (source.kind === 'external') {
      const placeholder = U.el('div', { class: 'player__placeholder' });
      const box = U.el('div');
      box.appendChild(U.el('div', { props: { style: 'font-weight:600;margin-bottom:6px' }, text: 'Внешний источник: ' + source.provider }));
      box.appendChild(
        U.el('p', {
          props: { style: 'margin:0 0 16px' },
          text: 'StrausTube не встраивает сторонние плееры и не подгружает чужие скрипты. Откройте источник в новой вкладке, если ему доверяете.',
        })
      );
      box.appendChild(
        U.el('a', {
          class: 'btn btn--primary',
          attrs: { href: source.url, target: '_blank', rel: 'noopener noreferrer nofollow', text: 'Открыть источник' },
        })
      );
      placeholder.appendChild(box);
      wrap.appendChild(placeholder);
      return wrap;
    }

    const placeholder = U.el('div', { class: 'player__placeholder' });
    const box = U.el('div');
    box.appendChild(U.el('div', { props: { style: 'font-weight:600;margin-bottom:6px' }, text: 'Файл видео не прикреплён' }));
    box.appendChild(
      U.el('p', {
        props: { style: 'margin:0 0 16px' },
        text: 'Это демонстрационная запись: у неё есть обложка, описание и комментарии, но нет видеодорожки.',
      })
    );
    if (S.store.currentUser() && S.store.currentUser().id === video.authorId) {
      const link = UI.link('#/manage/' + video.id, 'Прикрепить файл видео', 'btn btn--primary');
      box.appendChild(link);
    }
    placeholder.appendChild(box);
    wrap.appendChild(placeholder);
    return wrap;
  }

  /** Определяет, что именно показывать в плеере. */
  function resolveSource(video) {
    if (video.mediaUrl) {
      // Локальный файл, сохранённый браузером как data-URL: воспроизводим напрямую.
      if (/^data:(video|audio)\//i.test(video.mediaUrl)) {
        return { kind: 'file', url: video.mediaUrl, poster: S.media.coverOf(video) };
      }
      const safe = U.safeHttpUrl(video.mediaUrl);
      if (safe) {
        const parsed = S.media.parseMediaInput(safe);
        if (parsed && parsed.kind === 'youtube') {
          return { kind: 'external', provider: 'YouTube', url: safe };
        }
        if (parsed && parsed.kind === 'file') {
          return { kind: 'file', url: safe, poster: S.media.coverOf(video) };
        }
        return { kind: 'external', provider: parsed ? parsed.provider : 'внешний сайт', url: safe };
      }
    }
    return { kind: 'missing' };
  }

  function likeGroup(video) {
    const me = S.store.currentUser();
    const mine = S.store.myLike(video.id, me ? me.id : null);
    const group = U.el('div', { class: 'like-group' });

    const likeBtn = U.el('button', {
      attrs: {
        type: 'button',
        'aria-pressed': mine === 'like' ? 'true' : 'false',
        'aria-label': 'Нравится',
        title: 'Нравится',
      },
    });
    likeBtn.appendChild(U.icon('like'));
    likeBtn.appendChild(U.el('span', { text: U.formatCount(S.store.countLikes(video.id, 'like')) }));
    likeBtn.addEventListener('click', () => {
      try {
        S.store.toggleLike(video.id, 'like');
        S.app.render();
      } catch (error) {
        UI.toast(error.message, 'error');
      }
    });

    const dislikeBtn = U.el('button', {
      attrs: {
        type: 'button',
        'aria-pressed': mine === 'dislike' ? 'true' : 'false',
        'aria-label': 'Не нравится',
        title: 'Не нравится',
      },
    });
    dislikeBtn.appendChild(U.icon('dislike'));
    dislikeBtn.appendChild(U.el('span', { text: U.formatCount(S.store.countLikes(video.id, 'dislike')) }));
    dislikeBtn.addEventListener('click', () => {
      try {
        S.store.toggleLike(video.id, 'dislike');
        S.app.render();
      } catch (error) {
        UI.toast(error.message, 'error');
      }
    });

    group.appendChild(likeBtn);
    group.appendChild(U.el('span', { class: 'like-group__sep' }));
    group.appendChild(dislikeBtn);
    return group;
  }

  function subscribeButton(channelId) {
    const me = S.store.currentUser();
    const stats = S.store.userStats(channelId);
    if (me && me.id === channelId) {
      return UI.link('#/settings', 'Редактировать профиль', 'btn');
    }
    const subscribed = S.store.isSubscribed(channelId, me ? me.id : null);
    const button = U.el('button', {
      class: 'btn' + (subscribed ? ' btn--ghost' : ' btn--primary'),
      attrs: { type: 'button' },
      text: subscribed ? 'Вы подписаны' : 'Подписаться',
    });
    button.addEventListener('click', () => {
      try {
        const now = S.store.toggleSubscribe(channelId);
        UI.toast(now ? 'Подписка оформлена' : 'Подписка отменена', 'ok');
        S.app.render();
      } catch (error) {
        UI.toast(error.message, 'error');
      }
    });
    const wrap = U.el('div', { props: { style: 'display:flex;gap:10px;align-items:center' } });
    wrap.appendChild(button);
    wrap.appendChild(U.el('span', { class: 'hint-text', text: U.pluralizeSub(stats.subs) }));
    return wrap;
  }

  function shareButton(video) {
    const button = U.el('button', { class: 'btn' });
    button.appendChild(U.icon('share'));
    button.appendChild(U.el('span', { text: 'Поделиться' }));
    button.addEventListener('click', async () => {
      const url = global.location.origin + global.location.pathname + '#/watch/' + video.id;
      const text = video.title + ' — StrausTube';
      try {
        if (navigator.share) {
          await navigator.share({ title: video.title, text, url });
          return;
        }
        await navigator.clipboard.writeText(url);
        UI.toast('Ссылка скопирована', 'ok');
      } catch (_error) {
        const input = U.el('input', { class: 'input', value: url, attrs: { readonly: 'readonly' } });
        UI.openModal({
          title: 'Ссылка на видео',
          body: input,
          actions: [{ label: 'Готово', kind: 'primary' }],
        });
        input.select();
      }
    });
    return button;
  }

  function moreButton(video) {
    const me = S.store.currentUser();
    const canManage = S.store.isAdmin() || (me && me.id === video.authorId);
    const button = U.el('button', { class: 'icon-btn', attrs: { type: 'button', 'aria-label': 'Ещё действия' } });
    button.appendChild(U.icon('dots'));
    button.addEventListener('click', () => {
      const body = U.el('div');
      body.appendChild(
        U.el('button', {
          class: 'menu__item',
          attrs: { type: 'button' },
          text: 'Сообщить о нарушении',
          on: {
            click: () => {
              UI.toast('Жалоба сохранена локально. Модерация StrausTube — это вы сами.', 'ok');
            },
          },
        })
      );
      if (canManage) {
        body.appendChild(
          U.el('button', {
            class: 'menu__item',
            attrs: { type: 'button' },
            text: 'Изменить видео',
            on: {
              click: () => {
                S.app.navigate('#/manage/' + video.id);
              },
            },
          })
        );
        body.appendChild(
          U.el('button', {
            class: 'menu__item menu__item--muted',
            attrs: { type: 'button' },
            text: 'Удалить видео',
            on: {
              click: async () => {
                const ok = await UI.confirmDialog({
                  title: 'Удалить видео?',
                  message: '«' + video.title + '» исчезнет из библиотеки.',
                  confirmLabel: 'Удалить',
                  danger: true,
                });
                if (!ok) return;
                S.store.removeVideo(video.id);
                UI.toast('Видео удалено', 'ok');
                S.app.navigate('#/');
              },
            },
          })
        );
      }
      UI.openModal({ title: 'Действия', body });
    });
    return button;
  }

  /* =====================================================================
     Канал
     ===================================================================== */

  function channelView(params) {
    const user = S.store.findUser(params.id);
    if (!user) return notFoundView('Канал не найден', 'Профиль мог быть удалён.');

    const me = S.store.currentUser();
    const isMine = Boolean(me && me.id === user.id);
    const stats = S.store.userStats(user.id);
    const tab = params.get('tab') || 'videos';
    const wrap = U.el('div');

    wrap.appendChild(U.el('div', { class: 'channel-banner' }));

    const head = U.el('div', { class: 'channel-head' });
    head.appendChild(UI.avatarNode(user, 128));

    const info = U.el('div', { class: 'channel-head__info' });
    const titleRow = U.el('div', { props: { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap' } });
    titleRow.appendChild(U.el('h1', { class: 'channel-head__title', text: user.name }));
    if (user.role === 'moderator') titleRow.appendChild(U.el('span', { class: 'badge', text: 'модератор' }));
    if (user.demo) titleRow.appendChild(U.el('span', { class: 'badge', text: 'демо-канал' }));
    info.appendChild(titleRow);
    info.appendChild(
      U.el('div', {
        class: 'channel-head__meta',
        text: `${user.handle} · ${U.pluralizeSub(stats.subs)} · ${U.pluralizeVideo(stats.videos)}`,
      })
    );
    if (user.bio) info.appendChild(U.el('p', { class: 'channel-head__bio', text: user.bio }));
    head.appendChild(info);

    const actions = U.el('div', { class: 'channel-head__actions' });
    actions.appendChild(subscribeButton(user.id));
    if (isMine) actions.appendChild(UI.link('#/upload', 'Загрузить видео', 'btn btn--primary'));
    if (isMine) actions.appendChild(UI.link('#/settings', 'Настройки', 'btn btn--ghost'));
    head.appendChild(actions);
    wrap.appendChild(head);

    const tabs = U.el('div', { class: 'tabs' });
    tabs.appendChild(
      U.el('button', {
        class: 'tab' + (tab === 'videos' ? ' active' : ''),
        attrs: { type: 'button' },
        text: 'Видео',
        on: { click: () => S.app.navigate('#/channel/' + user.id) },
      })
    );
    tabs.appendChild(
      U.el('button', {
        class: 'tab' + (tab === 'about' ? ' active' : ''),
        attrs: { type: 'button' },
        text: 'О канале',
        on: { click: () => S.app.navigate('#/channel/' + user.id + '?tab=about') },
      })
    );
    if (isMine) {
      tabs.appendChild(
        U.el('button', {
          class: 'tab' + (tab === 'manage' ? ' active' : ''),
          attrs: { type: 'button' },
          text: 'Управление',
          on: { click: () => S.app.navigate('#/channel/' + user.id + '?tab=manage') },
        })
      );
    }
    wrap.appendChild(tabs);

    if (tab === 'about') {
      const list = U.el('dl', { class: 'about-list' });
      const rows = [
        ['Канал', user.name],
        ['Никнейм', user.handle],
        ['Подписчики', U.formatCount(stats.subs)],
        ['Видео', U.formatCount(stats.videos)],
        ['Просмотры', U.formatCount(stats.views)],
        ['Отметки «Нравится»', U.formatCount(stats.likes)],
        ['На StrausTube с', U.formatDate(user.createdAt)],
      ];
      for (const [label, value] of rows) {
        const item = U.el('div');
        item.appendChild(U.el('dt', { text: label }));
        item.appendChild(U.el('dd', { props: { style: 'margin:0' }, text: value }));
        list.appendChild(item);
      }
      wrap.appendChild(list);
      if (user.bio) {
        wrap.appendChild(U.el('h2', { props: { style: 'font-size:16px;margin:24px 0 8px' }, text: 'Описание' }));
        wrap.appendChild(U.el('p', { props: { style: 'white-space:pre-wrap;color:var(--text-dim);max-width:720px' }, text: user.bio }));
      }
      return wrap;
    }

    const videos = S.store.listVideos({ authorId: user.id });

    if (tab === 'manage') {
      wrap.appendChild(manageList(videos));
      return wrap;
    }

    if (!videos.length) {
      const action = isMine ? UI.link('#/upload', 'Загрузить видео', 'btn btn--primary') : null;
      wrap.appendChild(
        UI.emptyNode(
          'На канале пока нет видео',
          isMine ? 'Загрузите первый ролик — он появится здесь.' : 'Загляните позже.',
          action
        )
      );
      return wrap;
    }
    wrap.appendChild(UI.videoGrid(videos));
    return wrap;
  }

  function manageList(videos) {
    const wrap = U.el('div');
    if (!videos.length) return UI.emptyNode('Видео нет', 'Загрузите первый ролик, чтобы управлять им здесь.');

    const rows = U.el('div', { class: 'rows' });
    for (const video of videos) {
      const row = U.el('div', { class: 'row' });
      const thumb = U.el('div', { class: 'row__thumb' });
      const cover = S.media.coverOf(video);
      if (cover) thumb.appendChild(U.el('img', { attrs: { src: cover, alt: '' } }));
      row.appendChild(thumb);

      const info = U.el('div');
      info.appendChild(U.el('h3', { class: 'row__title', text: video.title }));
      info.appendChild(
        U.el('p', {
          class: 'row__meta',
          text: `${S.media.categoryLabel(video.category)} · ${U.pluralizeView(video.views || 0)} · ${U.formatCount(S.store.countLikes(video.id, 'like'))} лайков · ${U.timeAgo(video.createdAt)}`,
        })
      );
      row.appendChild(info);

      const actions = U.el('div', { class: 'row__actions' });
      actions.appendChild(UI.link('#/watch/' + video.id, 'Открыть', 'btn btn--ghost btn--sm'));
      actions.appendChild(UI.link('#/manage/' + video.id, 'Изменить', 'btn btn--ghost btn--sm'));
      actions.appendChild(
        U.el('button', {
          class: 'btn btn--danger btn--sm',
          attrs: { type: 'button' },
          text: 'Удалить',
          on: {
            click: async () => {
              const ok = await UI.confirmDialog({
                title: 'Удалить видео?',
                message: '«' + video.title + '» будет удалено вместе с комментариями.',
                confirmLabel: 'Удалить',
                danger: true,
              });
              if (!ok) return;
              S.store.removeVideo(video.id);
              UI.toast('Видео удалено', 'ok');
              S.app.render();
            },
          },
        })
      );
      row.appendChild(actions);
      rows.appendChild(row);
    }
    wrap.appendChild(rows);
    return wrap;
  }

  /* =====================================================================
     Загрузка видео
     ===================================================================== */

  function uploadView() {
    const me = S.store.currentUser();
    if (!me) {
      return authRequired('Чтобы загрузить видео, войдите в аккаунт.');
    }

    const wrap = U.el('div', { class: 'page' });
    wrap.appendChild(U.el('h1', { class: 'page__title', text: 'Загрузка видео' }));
    wrap.appendChild(
      U.el('p', {
        class: 'hint-text',
        props: { style: 'margin:-8px 0 20px' },
        text: 'Файл обрабатывается в браузере и сохраняется локально (localStorage). Сервер не участвует: StrausTube — клиентское приложение.',
      })
    );

    const layout = U.el('div', { class: 'upload-grid' });
    const form = U.el('form', { class: 'card-panel' });

    const titleInput = U.el('input', { class: 'input', attrs: { maxlength: '140', placeholder: 'Например: «Утро в лесу: медленная съёмка»' } });
    const descInput = U.el('textarea', { class: 'textarea', attrs: { maxlength: '5000', placeholder: 'Расскажите, о чём ролик' } });
    const categorySelect = U.el('select', { class: 'select' });
    for (const item of S.media.CATEGORIES) {
      if (item.id === 'all') continue;
      categorySelect.appendChild(U.el('option', { value: item.id, text: item.label }));
    }

    form.appendChild(field('Название', titleInput, 'От 3 до 140 символов.'));
    form.appendChild(field('Описание', descInput, 'До 5000 символов.'));

    /* Файл видео */
    const mediaUrlInput = U.el('input', { class: 'input', attrs: { type: 'url', placeholder: 'https://example.com/video.mp4', maxlength: '500' } });
    const mediaFileInput = U.el('input', { class: 'sr-only', attrs: { type: 'file', accept: 'video/mp4,video/webm,video/ogg,video/quicktime' } });
    const dropzone = U.el('div', { class: 'dropzone' });
    dropzone.appendChild(U.el('div', { text: 'Перетащите mp4/webm сюда или' }));
    dropzone.appendChild(
      U.el('button', {
        class: 'btn btn--ghost btn--sm',
        props: { style: 'margin-top:10px' },
        attrs: { type: 'button' },
        text: 'Выбрать файл',
        on: { click: () => mediaFileInput.click() },
      })
    );
    dropzone.appendChild(mediaFileInput);
    dropzone.appendChild(U.el('p', { class: 'field__hint', text: 'Локальный файл превращается в data-URL и хранится в браузере. Большие ролики (>3 МБ) лучше указать ссылкой.' }));

    let selectedMedia = null; // { kind: 'file'|'link', value, provider?, duration }

    function applyFile(file) {
      if (!file) return;
      if (!/^video\//.test(file.type)) {
        UI.toast('Нужен видеофайл (mp4, webm, ogg или mov).', 'error');
        return;
      }
      if (file.size > 3.5 * 1024 * 1024) {
        UI.toast('Файл больше 3,5 МБ — браузерное хранилище может переполниться. Лучше использовать ссылку.', 'error');
      }
      S.media.readFileAsDataUrl(file).then(async (dataUrl) => {
        selectedMedia = { kind: 'file', value: dataUrl, provider: file.name };
        mediaUrlInput.value = '';
        const duration = await S.media.probeDuration(dataUrl);
        selectedMedia.duration = duration;
        dropzone.querySelector('[data-media-status]').textContent =
          'Выбран файл: ' + file.name + ' (' + Math.round(file.size / 1024) + ' КБ' + (duration ? ', ' + U.formatDuration(duration) : '') + ')';
      });
    }

    dropzone.appendChild(U.el('p', { class: 'field__hint', attrs: { 'data-media-status': '' }, text: 'Файл не выбран.' }));
    dropzone.addEventListener('dragover', (event) => {
      event.preventDefault();
      dropzone.classList.add('is-over');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-over'));
    dropzone.addEventListener('drop', (event) => {
      event.preventDefault();
      dropzone.classList.remove('is-over');
      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      applyFile(file);
    });
    mediaFileInput.addEventListener('change', () => applyFile(mediaFileInput.files && mediaFileInput.files[0]));

    mediaUrlInput.addEventListener('change', async () => {
      const input = mediaUrlInput.value.trim();
      if (!input) {
        selectedMedia = null;
        return;
      }
      const safe = U.safeHttpUrl(input);
      if (!safe) {
        UI.toast('Ссылка должна начинаться с https:// или http://', 'error');
        mediaUrlInput.value = '';
        return;
      }
      const parsed = S.media.parseMediaInput(safe);
      if (parsed.kind === 'youtube' || parsed.kind === 'page') {
        UI.toast('Сторонние плееры не встраиваются: видео откроется как внешняя ссылка.', 'ok');
        selectedMedia = { kind: 'embed', value: safe, provider: parsed.provider, duration: 0 };
        return;
      }
      selectedMedia = { kind: 'link', value: safe, provider: parsed.provider, duration: 0 };
      const duration = await S.media.probeDuration(safe);
      if (selectedMedia && selectedMedia.value === safe) selectedMedia.duration = duration;
      dropzone.querySelector('[data-media-status]').textContent = 'Ссылка: ' + safe + (duration ? ' (' + U.formatDuration(duration) + ')' : '');
    });

    form.appendChild(field('Ссылка на видео', mediaUrlInput, 'Прямая ссылка на mp4/webm воспроизводится в плеере StrausTube.'));
    form.appendChild(field('Файл видео', dropzone));

    /* Обложка */
    const coverUrlInput = U.el('input', { class: 'input', attrs: { placeholder: 'assets/demo/cover-light.jpg или https://…', maxlength: '500' } });
    const coverFileInput = U.el('input', { class: 'sr-only', attrs: { type: 'file', accept: 'image/png,image/jpeg,image/webp' } });
    const coverButtons = U.el('div', { props: { style: 'display:flex;gap:10px;flex-wrap:wrap;margin-top:10px' } });
    coverButtons.appendChild(
      U.el('button', {
        class: 'btn btn--ghost btn--sm',
        attrs: { type: 'button' },
        text: 'Загрузить файл обложки',
        on: { click: () => coverFileInput.click() },
      })
    );
    coverButtons.appendChild(
      U.el('button', {
        class: 'btn btn--ghost btn--sm',
        attrs: { type: 'button' },
        text: 'Нарисовать автоматически',
        on: {
          click: () => {
            const preview = U.qs('[data-cover-preview]', wrap);
            const data = S.media.makeCover(titleInput.value || 'Новое видео', me.name);
            preview.src = data;
            coverFileInput.dataset.dataUrl = '';
            coverUrlInput.value = '';
            coverState.data = data;
            UI.toast('Обложка нарисована на canvas', 'ok');
          },
        },
      })
    );
    const coverState = { data: '' };
    coverFileInput.addEventListener('change', () => {
      const file = coverFileInput.files && coverFileInput.files[0];
      if (!file) return;
      S.media.readFileAsDataUrl(file).then((dataUrl) => {
        coverState.data = dataUrl;
        coverUrlInput.value = '';
        U.qs('[data-cover-preview]', wrap).src = dataUrl;
      });
    });
    const coverField = field('Обложка', coverUrlInput, 'Оставьте пустым — StrausTube нарисует обложку автоматически.');
    coverField.appendChild(coverButtons);
    coverField.appendChild(coverFileInput);
    form.appendChild(coverField);

    form.appendChild(field('Категория', categorySelect));

    const submit = U.el('button', { class: 'btn btn--primary', attrs: { type: 'submit' }, text: 'Опубликовать' });
    const clear = U.el('button', { class: 'btn btn--ghost', attrs: { type: 'reset' }, text: 'Очистить' });
    const actionRow = U.el('div', { class: 'form-actions' });
    actionRow.appendChild(submit);
    actionRow.appendChild(clear);
    form.appendChild(actionRow);
    layout.appendChild(form);

    /* Предпросмотр */
    const previewCol = U.el('div');
    previewCol.appendChild(U.el('h2', { props: { style: 'font-size:15px;margin:0 0 10px' }, text: 'Предпросмотр' }));
    const previewBox = U.el('div', { class: 'preview-box' });
    const previewImg = U.el('img', { attrs: { 'data-cover-preview': '', alt: 'Предпросмотр обложки' } });
    previewImg.addEventListener('error', () => {
      previewImg.removeAttribute('src');
    });
    const emptyHint = U.el('div', { text: 'Обложка появится здесь' });
    previewBox.appendChild(emptyHint);
    previewBox.appendChild(previewImg);
    previewCol.appendChild(previewBox);
    previewCol.appendChild(
      U.el('p', { class: 'hint-text', props: { style: 'margin-top:10px' }, text: 'Так карточка видео будет выглядеть в ленте.' })
    );
    layout.appendChild(previewCol);

    function refreshPreview() {
      const url = coverUrlInput.value.trim();
      if (coverState.data) {
        previewImg.src = coverState.data;
      } else if (url) {
        const safe = U.safeHttpUrl(url);
        if (safe) previewImg.src = safe;
        else {
          previewImg.removeAttribute('src');
          return;
        }
      } else {
        previewImg.removeAttribute('src');
        return;
      }
      emptyHint.style.display = 'none';
      previewImg.style.display = 'block';
    }
    previewImg.style.display = 'none';
    coverUrlInput.addEventListener('change', refreshPreview);
    titleInput.addEventListener('input', () => {
      if (!coverState.data && !coverUrlInput.value.trim()) return;
      refreshPreview();
    });

    form.addEventListener('reset', () => {
      selectedMedia = null;
      coverState.data = '';
      previewImg.removeAttribute('src');
      previewImg.style.display = 'none';
      emptyHint.style.display = '';
      dropzone.querySelector('[data-media-status]').textContent = 'Файл не выбран.';
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const title = titleInput.value.trim();
      if (title.length < 3) {
        UI.toast('Придумайте название (минимум 3 символа).', 'error');
        titleInput.focus();
        return;
      }
      let mediaUrl = '';
      let duration = 0;
      if (selectedMedia) {
        if (selectedMedia.kind === 'file') {
          mediaUrl = selectedMedia.value;
        } else {
          mediaUrl = selectedMedia.value;
        }
        duration = selectedMedia.duration || 0;
      }
      let coverUrl = coverUrlInput.value.trim();
      const coverSafe = coverUrl ? U.safeHttpUrl(coverUrl) : '';
      if (coverUrl && !coverSafe) {
        UI.toast('Ссылка на обложку должна начинаться с https:// или http://', 'error');
        return;
      }
      coverUrl = coverSafe || '';

      if (!coverState.data && !coverUrl) {
        coverState.data = S.media.makeCover(title, me.name);
      }

      submit.disabled = true;
      try {
        const video = S.store.createVideo({
          title,
          description: descInput.value,
          category: categorySelect.value,
          coverUrl,
          coverData: coverState.data || '',
          mediaUrl,
          duration,
        });
        UI.toast('Видео опубликовано', 'ok');
        S.app.navigate('#/watch/' + video.id);
      } catch (error) {
        UI.toast(error.message, 'error');
        submit.disabled = false;
      }
    });

    wrap.appendChild(layout);
    return wrap;
  }

  /* =====================================================================
     Редактирование видео (свой ролик)
     ===================================================================== */

  function manageView(params) {
    const me = S.store.currentUser();
    const video = S.store.findVideo(params.id);
    if (!video) return notFoundView('Видео не найдено', 'Возможно, оно уже удалено.');
    if (!me || (me.id !== video.authorId && !S.store.isAdmin())) {
      return notFoundView('Нет доступа', 'Редактировать видео может только его автор.');
    }

    const wrap = U.el('div', { class: 'page' });
    wrap.appendChild(U.el('div', { class: 'breadcrumb' }));
    wrap.querySelector('.breadcrumb').appendChild(UI.link('#/watch/' + video.id, '← К видео'));
    wrap.appendChild(U.el('h1', { class: 'page__title', text: 'Редактирование видео' }));

    const panel = U.el('div', { class: 'card-panel' });
    const titleInput = U.el('input', { class: 'input', value: video.title, attrs: { maxlength: '140' } });
    const descInput = U.el('textarea', { class: 'textarea', value: video.description || '', attrs: { maxlength: '5000' } });
    const categorySelect = U.el('select', { class: 'select' });
    for (const item of S.media.CATEGORIES) {
      if (item.id === 'all') continue;
      const option = U.el('option', { value: item.id, text: item.label });
      if (item.id === video.category) option.selected = true;
      categorySelect.appendChild(option);
    }
    const coverInput = U.el('input', { class: 'input', value: video.coverUrl && !video.coverData ? video.coverUrl : '', attrs: { maxlength: '500', placeholder: 'assets/demo/cover-light.jpg или https://…' } });
    const mediaInput = U.el('input', { class: 'input', value: video.mediaUrl && !video.mediaUrl.startsWith('data:') ? video.mediaUrl : '', attrs: { maxlength: '500', placeholder: 'https://…/video.mp4' } });

    panel.appendChild(field('Название', titleInput));
    panel.appendChild(field('Описание', descInput));
    panel.appendChild(field('Категория', categorySelect));
    panel.appendChild(field('Обложка', coverInput, 'Пусто — обложка будет нарисована автоматически.'));
    panel.appendChild(field('Файл видео', mediaInput, 'Прямая ссылка на mp4/webm.'));

    const actions = U.el('div', { class: 'form-actions' });
    actions.appendChild(
      U.el('button', {
        class: 'btn btn--primary',
        attrs: { type: 'button' },
        text: 'Сохранить',
        on: {
          click: () => {
            try {
              S.store.updateVideo(video.id, {
                title: titleInput.value,
                description: descInput.value,
                category: categorySelect.value,
                coverUrl: coverInput.value.trim(),
                mediaUrl: mediaInput.value.trim(),
              });
              UI.toast('Изменения сохранены', 'ok');
              S.app.navigate('#/watch/' + video.id);
            } catch (error) {
              UI.toast(error.message, 'error');
            }
          },
        },
      })
    );
    actions.appendChild(UI.link('#/watch/' + video.id, 'Отмена', 'btn btn--ghost'));
    actions.appendChild(
      U.el('button', {
        class: 'btn btn--danger',
        attrs: { type: 'button' },
        text: 'Удалить видео',
        on: {
          click: async () => {
            const ok = await UI.confirmDialog({
              title: 'Удалить видео?',
              message: 'Действие нельзя отменить.',
              confirmLabel: 'Удалить',
              danger: true,
            });
            if (!ok) return;
            S.store.removeVideo(video.id);
            UI.toast('Видео удалено', 'ok');
            S.app.navigate('#/');
          },
        },
      })
    );
    panel.appendChild(actions);
    wrap.appendChild(panel);
    return wrap;
  }

  /* =====================================================================
     Вход и регистрация
     ===================================================================== */

  function loginView() {
    const me = S.store.currentUser();
    if (me) {
      return alreadyAuthed(me);
    }
    const wrap = U.el('div', { class: 'page', props: { style: 'max-width:520px' } });
    wrap.appendChild(U.el('h1', { class: 'page__title', text: 'Вход в StrausTube' }));
    wrap.appendChild(
      U.el('p', {
        class: 'hint-text',
        props: { style: 'margin:-8px 0 20px' },
        text: 'Это локальный видеохостинг: аккаунты существуют только в вашем браузере и никуда не отправляются.',
      })
    );

    const panel = U.el('div', { class: 'card-panel' });
    const form = U.el('form');

    const nameInput = U.el('input', { class: 'input', attrs: { type: 'text', autocomplete: 'username', placeholder: 'Никнейм', maxlength: '40', required: 'required' } });
    const passInput = U.el('input', { class: 'input', attrs: { type: 'password', autocomplete: 'current-password', placeholder: 'Пароль', maxlength: '128', required: 'required' } });
    const remember = U.el('input', { attrs: { type: 'checkbox', id: 'remember-me' } });
    const rememberWrap = U.el('label', { props: { style: 'display:flex;gap:8px;align-items:center;color:var(--text-dim);font-size:13px' } });
    rememberWrap.appendChild(remember);
    rememberWrap.appendChild(document.createTextNode('Запомнить меня на этом устройстве'));

    form.appendChild(field('Никнейм', nameInput));
    form.appendChild(field('Пароль', passInput));
    form.appendChild(field('', rememberWrap));

    const error = U.el('p', { class: 'error-text', props: { style: 'min-height:18px' } });
    form.appendChild(error);

    const submit = U.el('button', { class: 'btn btn--primary btn--block', attrs: { type: 'submit' }, text: 'Войти' });
    form.appendChild(submit);

    const switchRow = U.el('p', { class: 'hint-text', props: { style: 'margin:16px 0 0' } });
    switchRow.appendChild(document.createTextNode('Нет аккаунта? '));
    switchRow.appendChild(UI.link('#/register', 'Зарегистрируйтесь'));
    form.appendChild(switchRow);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      error.textContent = '';
      submit.disabled = true;
      submit.textContent = 'Проверяем…';
      try {
        const user = await S.store.authenticate(nameInput.value, passInput.value);
        S.store.setSession(user.id, remember.checked);
        UI.toast('С возвращением, ' + user.name + '!', 'ok');
        S.app.navigate('#/');
        S.app.render();
      } catch (err) {
        error.textContent = err.message;
      } finally {
        submit.disabled = false;
        submit.textContent = 'Войти';
      }
    });

    panel.appendChild(form);
    wrap.appendChild(panel);

    /* Подсказка с демо-доступом: честная, открытая, без «приманок». */
    const demo = U.el('div', { class: 'card-panel', props: { style: 'margin-top:20px' } });
    demo.appendChild(U.el('h2', { props: { style: 'font-size:15px;margin:0 0 8px' }, text: 'Демо-доступ' }));
    demo.appendChild(
      U.el('p', {
        class: 'hint-text',
        props: { style: 'margin:0 0 12px' },
        text: 'В комплект входят пять демо-каналов с общим паролем. Вход в них ничего не меняет в ваших данных.',
      })
    );
    const demoRow = U.el('div', { class: 'form-actions' });
    for (const preset of S.seed.users.slice(0, 3)) {
      demoRow.appendChild(
        U.el('button', {
          class: 'btn btn--ghost btn--sm',
          attrs: { type: 'button' },
          text: preset.name,
          on: {
            click: () => {
              nameInput.value = preset.name;
              passInput.value = S.seed.DEMO_PASSWORD;
              form.dispatchEvent(new Event('submit', { cancelable: true }));
            },
          },
        })
      );
    }
    demo.appendChild(demoRow);
    demo.appendChild(U.el('p', { class: 'field__hint', text: 'Пароль демо-каналов: ' + S.seed.DEMO_PASSWORD }));
    wrap.appendChild(demo);

    return wrap;
  }

  function registerView() {
    const me = S.store.currentUser();
    if (me) return alreadyAuthed(me);

    const wrap = U.el('div', { class: 'page', props: { style: 'max-width:560px' } });
    wrap.appendChild(U.el('h1', { class: 'page__title', text: 'Создание канала' }));

    const panel = U.el('div', { class: 'card-panel' });
    const form = U.el('form');

    const nameInput = U.el('input', { class: 'input', attrs: { type: 'text', autocomplete: 'username', placeholder: 'Никнейм', maxlength: '40', required: 'required' } });
    const passInput = U.el('input', { class: 'input', attrs: { type: 'password', autocomplete: 'new-password', placeholder: 'Пароль', minlength: '4', maxlength: '128', required: 'required' } });
    const pass2Input = U.el('input', { class: 'input', attrs: { type: 'password', autocomplete: 'new-password', placeholder: 'Пароль ещё раз', minlength: '4', maxlength: '128', required: 'required' } });
    const bioInput = U.el('textarea', { class: 'textarea', attrs: { maxlength: '400', placeholder: 'Пара слов о канале (необязательно)' } });
    const picker = UI.avatarPicker('', () => {});

    form.appendChild(field('Никнейм', nameInput, 'От 2 до 40 символов. Имя видно другим пользователям.'));
    form.appendChild(field('Пароль', passInput, 'Минимум 4 символа. Хранится в виде производного ключа, а не открытым текстом.'));
    form.appendChild(field('Подтверждение пароля', pass2Input));
    form.appendChild(field('Описание канала', bioInput));
    form.appendChild(field('Аватар', picker.node));

    const error = U.el('p', { class: 'error-text', props: { style: 'min-height:18px' } });
    form.appendChild(error);
    form.appendChild(U.el('button', { class: 'btn btn--primary btn--block', attrs: { type: 'submit' }, text: 'Создать канал' }));

    const switchRow = U.el('p', { class: 'hint-text', props: { style: 'margin:16px 0 0' } });
    switchRow.appendChild(document.createTextNode('Уже есть аккаунт? '));
    switchRow.appendChild(UI.link('#/login', 'Войти'));
    form.appendChild(switchRow);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      error.textContent = '';
      if (passInput.value !== pass2Input.value) {
        error.textContent = 'Пароли не совпадают.';
        return;
      }
      try {
        const user = await S.store.register({
          name: nameInput.value,
          password: passInput.value,
          avatar: picker.getValue(),
          bio: bioInput.value,
        });
        S.store.setSession(user.id, true);
        UI.toast('Канал создан. Добро пожаловать!', 'ok');
        S.app.navigate('#/');
        S.app.render();
      } catch (err) {
        error.textContent = err.message;
      }
    });

    panel.appendChild(form);
    wrap.appendChild(panel);
    return wrap;
  }

  function alreadyAuthed(user) {
    const wrap = U.el('div', { class: 'page', props: { style: 'max-width:520px' } });
    wrap.appendChild(U.el('h1', { class: 'page__title', text: 'Вы уже вошли' }));
    const panel = U.el('div', { class: 'card-panel' });
    const row = U.el('div', { props: { style: 'display:flex;gap:16px;align-items:center;margin-bottom:16px' } });
    row.appendChild(UI.avatarNode(user, 56));
    const info = U.el('div');
    info.appendChild(U.el('div', { props: { style: 'font-weight:600' }, text: user.name }));
    info.appendChild(U.el('div', { class: 'hint-text', text: user.handle }));
    row.appendChild(info);
    panel.appendChild(row);
    const actions = U.el('div', { class: 'form-actions' });
    actions.appendChild(UI.link('#/channel/' + user.id, 'Мой канал', 'btn btn--primary'));
    actions.appendChild(UI.link('#/settings', 'Настройки', 'btn btn--ghost'));
    actions.appendChild(
      U.el('button', {
        class: 'btn btn--ghost',
        attrs: { type: 'button' },
        text: 'Сменить аккаунт',
        on: {
          click: () => {
            S.store.clearSession();
            S.app.navigate('#/login');
            S.app.render();
          },
        },
      })
    );
    panel.appendChild(actions);
    wrap.appendChild(panel);
    return wrap;
  }

  function authRequired(message) {
    const wrap = U.el('div', { class: 'page', props: { style: 'max-width:520px' } });
    const panel = U.el('div', { class: 'card-panel' });
    panel.appendChild(U.el('h1', { props: { style: 'font-size:20px;margin:0 0 10px' }, text: 'Нужен аккаунт' }));
    panel.appendChild(U.el('p', { class: 'hint-text', text: message }));
    const actions = U.el('div', { class: 'form-actions' });
    actions.appendChild(UI.link('#/login', 'Войти', 'btn btn--primary'));
    actions.appendChild(UI.link('#/register', 'Создать канал', 'btn btn--ghost'));
    panel.appendChild(actions);
    wrap.appendChild(panel);
    return wrap;
  }

  /* =====================================================================
     Подписки, профиль, настройки, поиск
     ===================================================================== */

  function subscriptionsView() {
    const me = S.store.currentUser();
    if (!me) return authRequired('Подписки доступны после входа в аккаунт.');

    const wrap = U.el('div');
    wrap.appendChild(U.el('h1', { class: 'page__title', text: 'Подписки' }));
    const channels = S.store.listSubscriptions(me.id);

    if (!channels.length) {
      wrap.appendChild(
        UI.emptyNode('Вы пока ни на кого не подписаны', 'Откройте любой канал и нажмите «Подписаться».', UI.link('#/', 'Смотреть ленту', 'btn btn--primary'))
      );
      return wrap;
    }

    const rows = U.el('div', { class: 'rows' });
    for (const channel of channels) {
      const stats = S.store.userStats(channel.id);
      const row = U.el('div', { class: 'row', props: { style: 'grid-template-columns:auto minmax(0,1fr) auto' } });
      row.appendChild(UI.avatarNode(channel, 72));
      const info = U.el('div');
      info.appendChild(UI.link('#/channel/' + channel.id, U.el('h3', { class: 'row__title', text: channel.name })));
      info.appendChild(U.el('p', { class: 'row__meta', text: U.pluralizeSub(stats.subs) + ' · ' + U.pluralizeVideo(stats.videos) }));
      row.appendChild(info);
      const actions = U.el('div', { class: 'row__actions' });
      actions.appendChild(UI.link('#/channel/' + channel.id, 'Открыть канал', 'btn btn--ghost btn--sm'));
      row.appendChild(actions);
      rows.appendChild(row);
    }
    wrap.appendChild(rows);

    const latest = S.store
      .listVideos()
      .filter((video) => channels.some((channel) => channel.id === video.authorId))
      .slice(0, 8);
    if (latest.length) {
      wrap.appendChild(U.el('h2', { class: 'page__title', props: { style: 'margin-top:32px' }, text: 'Новое у ваших каналов' }));
      wrap.appendChild(UI.videoGrid(latest));
    }
    return wrap;
  }

  function profileView() {
    const me = S.store.currentUser();
    if (!me) return authRequired('Профиль доступен после входа.');
    return channelView({ id: me.id, get: () => null });
  }

  function likedView() {
    const me = S.store.currentUser();
    if (!me) return authRequired('Отмеченные видео доступны после входа.');

    const wrap = U.el('div');
    wrap.appendChild(U.el('h1', { class: 'page__title', text: 'Понравившиеся видео' }));
    const videos = S.store.listLikedVideos(me.id);
    if (!videos.length) {
      wrap.appendChild(UI.emptyNode('Здесь пока пусто', 'Нажимайте «Нравится» под роликами — они появятся в этом списке.', UI.link('#/', 'К ленте', 'btn btn--primary')));
      return wrap;
    }
    wrap.appendChild(UI.videoGrid(videos));
    return wrap;
  }

  function historyView() {
    const mine = S.store.listVideos().slice(0, 24);
    const wrap = U.el('div');
    wrap.appendChild(U.el('h1', { class: 'page__title', text: 'Недавно в библиотеке' }));
    wrap.appendChild(UI.videoGrid(mine, 'Библиотека пуста', 'Загрузите первое видео.'));
    return wrap;
  }

  function settingsView() {
    const me = S.store.currentUser();
    if (!me) return authRequired('Настройки доступны после входа.');

    const wrap = U.el('div', { class: 'page' });
    wrap.appendChild(U.el('h1', { class: 'page__title', text: 'Настройки профиля' }));

    /* Профиль */
    const profilePanel = U.el('div', { class: 'card-panel' });
    profilePanel.appendChild(U.el('h2', { props: { style: 'font-size:16px;margin:0 0 16px' }, text: 'Профиль' }));
    const nameInput = U.el('input', { class: 'input', value: me.name, attrs: { maxlength: '40' } });
    const bioInput = U.el('textarea', { class: 'textarea', value: me.bio || '', attrs: { maxlength: '400' } });
    const picker = UI.avatarPicker(me.avatar, () => {});

    profilePanel.appendChild(field('Имя канала', nameInput));
    profilePanel.appendChild(field('Описание', bioInput));
    profilePanel.appendChild(field('Аватар', picker.node));
    const saveRow = U.el('div', { class: 'form-actions' });
    saveRow.appendChild(
      U.el('button', {
        class: 'btn btn--primary',
        attrs: { type: 'button' },
        text: 'Сохранить профиль',
        on: {
          click: () => {
            try {
              S.store.renameUser(me.id, nameInput.value);
              S.store.setBio(me.id, bioInput.value);
              S.store.setAvatar(me.id, picker.getValue());
              UI.toast('Профиль обновлён', 'ok');
              S.app.render();
            } catch (error) {
              UI.toast(error.message, 'error');
            }
          },
        },
      })
    );
    profilePanel.appendChild(saveRow);
    wrap.appendChild(profilePanel);

    /* Внешний вид */
    const themePanel = U.el('div', { class: 'card-panel', props: { style: 'margin-top:20px' } });
    themePanel.appendChild(U.el('h2', { props: { style: 'font-size:16px;margin:0 0 12px' }, text: 'Внешний вид' }));
    const themeRow = U.el('div', { class: 'form-actions' });
    const currentTheme = S.store.getTheme();
    const themes = [['system', 'Как в системе'], ['dark', 'Тёмная'], ['light', 'Светлая']];
    for (const [value, label] of themes) {
      themeRow.appendChild(
        U.el('button', {
          class: 'btn ' + (currentTheme === value ? 'btn--primary' : 'btn--ghost'),
          attrs: { type: 'button' },
          text: label,
          on: {
            click: () => {
              S.store.setTheme(value);
              UI.toast('Тема: ' + label.toLowerCase(), 'ok');
              S.app.render();
            },
          },
        })
      );
    }
    themePanel.appendChild(themeRow);
    wrap.appendChild(themePanel);

    /* Аккаунт */
    const accountPanel = U.el('div', { class: 'card-panel', props: { style: 'margin-top:20px' } });
    accountPanel.appendChild(U.el('h2', { props: { style: 'font-size:16px;margin:0 0 12px' }, text: 'Аккаунт' }));
    accountPanel.appendChild(
      U.el('p', {
        class: 'hint-text',
        text: 'Вы вошли как ' + me.name + '. Данные StrausTube хранятся только в этом браузере — выйдите, чтобы войти под другим аккаунтом.',
      })
    );
    const accountRow = U.el('div', { class: 'form-actions' });
    accountRow.appendChild(
      U.el('button', {
        class: 'btn btn--ghost',
        attrs: { type: 'button' },
        text: 'Выйти',
        on: {
          click: () => {
            S.store.clearSession();
            UI.toast('Вы вышли из аккаунта', 'ok');
            S.app.navigate('#/');
            S.app.render();
          },
        },
      })
    );
    accountRow.appendChild(
      U.el('button', {
        class: 'btn btn--danger',
        attrs: { type: 'button' },
        text: 'Удалить аккаунт и видео',
        on: {
          click: async () => {
            const ok = await UI.confirmDialog({
              title: 'Удалить аккаунт?',
              message: 'Канал, его ролики, комментарии и подписки будут удалены из этого браузера безвозвратно.',
              confirmLabel: 'Удалить аккаунт',
              danger: true,
            });
            if (!ok) return;
            S.store.removeUser(me.id);
            UI.toast('Аккаунт удалён', 'ok');
            S.app.navigate('#/');
            S.app.render();
          },
        },
      })
    );
    accountPanel.appendChild(accountRow);
    wrap.appendChild(accountPanel);

    /* О приложении */
    const aboutPanel = U.el('div', { class: 'card-panel', props: { style: 'margin-top:20px' } });
    aboutPanel.appendChild(U.el('h2', { props: { style: 'font-size:16px;margin:0 0 12px' }, text: 'О StrausTube' }));
    aboutPanel.appendChild(
      U.el('p', {
        class: 'hint-text',
        props: { style: 'margin:0' },
        text: 'StrausTube — демонстрационный видеохостинг. Он не собирает аналитику, не отправляет данные на сервер, не использует сторонние скрипты и рекламу. Всё содержимое создаётся и хранится локально.',
      })
    );
    wrap.appendChild(aboutPanel);
    return wrap;
  }

  function searchView(params) {
    const query = (params.get('q') || '').trim();
    const wrap = U.el('div');
    wrap.appendChild(U.el('h1', { class: 'page__title', text: query ? 'Результаты: «' + query + '»' : 'Поиск' }));

    if (!query) {
      wrap.appendChild(UI.emptyNode('Введите запрос', 'Ищите по названиям роликов, описаниям и каналам.'));
      return wrap;
    }

    const found = S.store.search(query);
    if (!found.videos.length && !found.users.length) {
      wrap.appendChild(
        UI.emptyNode('Ничего не нашлось', 'Попробуйте другой запрос или посмотрите ленту.', UI.link('#/', 'На главную', 'btn btn--primary'))
      );
      return wrap;
    }

    if (found.users.length) {
      wrap.appendChild(U.el('h2', { props: { style: 'font-size:16px;margin:0 0 12px' }, text: 'Каналы' }));
      const rows = U.el('div', { class: 'rows', props: { style: 'margin-bottom:28px' } });
      for (const user of found.users) {
        const row = U.el('div', { class: 'row', props: { style: 'grid-template-columns:auto minmax(0,1fr) auto' } });
        row.appendChild(UI.avatarNode(user, 56));
        const info = U.el('div');
        info.appendChild(UI.link('#/channel/' + user.id, U.el('h3', { class: 'row__title', text: user.name })));
        info.appendChild(U.el('p', { class: 'row__meta', text: user.handle + ' · ' + U.pluralizeSub(S.store.userStats(user.id).subs) }));
        row.appendChild(info);
        const actions = U.el('div', { class: 'row__actions' });
        actions.appendChild(UI.link('#/channel/' + user.id, 'Открыть', 'btn btn--ghost btn--sm'));
        row.appendChild(actions);
        rows.appendChild(row);
      }
      wrap.appendChild(rows);
    }

    if (found.videos.length) {
      wrap.appendChild(U.el('h2', { props: { style: 'font-size:16px;margin:0 0 12px' }, text: 'Видео' }));
      wrap.appendChild(UI.videoGrid(found.videos));
    }
    return wrap;
  }

  function notFoundView(title, text) {
    const wrap = U.el('div', { class: 'page' });
    wrap.appendChild(
      UI.emptyNode(title || 'Страница не найдена', text || 'Проверьте адрес или вернитесь к ленте.', UI.link('#/', 'На главную', 'btn btn--primary'))
    );
    return wrap;
  }

  function field(label, control, hint) {
    const wrap = U.el('label', { class: 'field' });
    if (label) wrap.appendChild(U.el('span', { class: 'field__label', text: label }));
    wrap.appendChild(control);
    if (hint) wrap.appendChild(U.el('span', { class: 'field__hint', text: hint }));
    return wrap;
  }

  S.views = {
    homeView, watchView, channelView, uploadView, manageView,
    loginView, registerView, subscriptionsView, profileView, likedView,
    historyView, settingsView, searchView, notFoundView,
    playerNode, compactCard, subscribeButton,
  };
})(window);
