'use strict';

/**
 * StrausTube — переиспользуемые элементы интерфейса:
 * тосты, модальные окна, карточки видео, панель комментариев и т.п.
 */
(function (global) {
  const S = (global.StrausTube = global.StrausTube || {});
  const U = S.util;

  /* ---------- Уведомления ---------- */

  const toastRoot = () => U.qs('#toast-root');

  function toast(message, kind) {
    const root = toastRoot();
    if (!root) return;
    const node = U.el('div', {
      class: 'toast' + (kind ? ' toast--' + kind : ''),
      text: String(message),
      attrs: { role: 'status' },
    });
    root.appendChild(node);
    global.setTimeout(() => node.remove(), 3600);
  }

  /* ---------- Модальные окна ---------- */

  const overlayRoot = () => U.qs('#overlay-root');

  /**
   * openModal({ title, body: Node|string, actions: [{label, kind, onClick, close}], wide })
   * Возвращает функцию закрытия. Esc и клик по фону закрывают окно.
   */
  function openModal(options) {
    const opts = options || {};
    const root = overlayRoot();
    if (!root) return () => {};

    const modal = U.el('div', { class: 'modal' + (opts.wide ? ' modal--wide' : ''), attrs: { role: 'dialog', 'aria-modal': 'true' } });
    if (opts.title) {
      const head = U.el('div', { class: 'modal__head' });
      head.appendChild(U.el('h2', { class: 'modal__title', text: opts.title }));
      head.appendChild(
        U.el('button', {
          class: 'icon-btn',
          attrs: { type: 'button', 'aria-label': 'Закрыть окно' },
          on: { click: () => close() },
          children: [U.icon('close')],
        })
      );
      modal.appendChild(head);
    }

    const body = U.el('div', { class: 'modal__body' });
    if (typeof opts.body === 'string') body.appendChild(U.el('p', { class: 'modal__text', text: opts.body }));
    else if (opts.body) body.appendChild(opts.body);
    modal.appendChild(body);

    if (opts.actions && opts.actions.length) {
      const actions = U.el('div', { class: 'modal__actions' });
      for (const action of opts.actions) {
        actions.appendChild(
          U.el('button', {
            class: 'btn' + (action.kind ? ' btn--' + action.kind : ''),
            attrs: { type: 'button' },
            text: action.label,
            on: {
              click: (event) => {
                const shouldClose = !action.onClick || action.onClick(event) !== false;
                if (action.close !== false && shouldClose) close();
              },
            },
          })
        );
      }
      modal.appendChild(actions);
    }

    const overlay = U.el('div', {
      class: 'overlay',
      on: {
        mousedown: (event) => {
          if (event.target === overlay) close();
        },
      },
    });
    overlay.appendChild(modal);

    const previousFocus = document.activeElement;
    const onKeydown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener('keydown', onKeydown);

    function close() {
      document.removeEventListener('keydown', onKeydown);
      overlay.remove();
      if (previousFocus && previousFocus.focus) previousFocus.focus();
    }

    root.appendChild(overlay);
    const focusTarget = modal.querySelector('input, textarea, button');
    if (focusTarget) focusTarget.focus();
    return close;
  }

  function confirmDialog(options) {
    const opts = options || {};
    return new Promise((resolve) => {
      openModal({
        title: opts.title || 'Подтвердите действие',
        body: opts.message || '',
        actions: [
          { label: opts.cancelLabel || 'Отмена', kind: 'ghost', onClick: () => resolve(false) },
          { label: opts.confirmLabel || 'Подтвердить', kind: opts.danger ? 'danger' : 'primary', onClick: () => resolve(true) },
        ],
      });
    });
  }

  /* ---------- Мелкие детали ---------- */

  function avatarNode(user, size) {
    const px = size || 36;
    const src = S.media.avatarOf(user);
    if (src) {
      return U.el('img', {
        class: 'avatar',
        attrs: { src, alt: user ? 'Аватар канала «' + user.name + '»' : 'Аватар', width: px, height: px, loading: 'lazy' },
        props: { style: `width:${px}px;height:${px}px` },
      });
    }
    return U.el('span', {
      class: 'avatar',
      props: { style: `width:${px}px;height:${px};display:grid;place-items:center;font-weight:600` },
      text: U.initials(user ? user.name : '?'),
    });
  }

  function link(href, content, className) {
    const node = U.el('a', { class: className, attrs: { href } });
    node.setAttribute('data-link', '');
    if (typeof content === 'string') node.textContent = content;
    else if (content) node.appendChild(content);
    return node;
  }

  /* ---------- Карточка видео (лента) ---------- */

  function videoCard(video) {
    const author = S.store.findUser(video.authorId);
    const cover = S.media.coverOf(video);
    const card = U.el('article', { class: 'card' });

    const thumb = link('#/watch/' + video.id, null, 'card__thumb');
    if (cover) {
      thumb.appendChild(
        U.el('img', {
          attrs: { src: cover, alt: 'Обложка видео «' + video.title + '»', loading: 'lazy' },
          on: { error: (event) => { event.currentTarget.remove(); } },
        })
      );
    } else {
      thumb.classList.add('card__thumb--empty');
      thumb.textContent = 'Без обложки';
    }
    if (video.duration) {
      thumb.appendChild(U.el('span', { class: 'card__duration', text: U.formatDuration(video.duration) }));
    }
    card.appendChild(thumb);

    const body = U.el('div', { class: 'card__body' });
    const avatarLink = link('#/channel/' + video.authorId, avatarNode(author, 36), 'card__avatars');
    body.appendChild(avatarLink);

    const meta = U.el('div', { class: 'card__meta-wrap' });
    meta.appendChild(link('#/watch/' + video.id, U.el('h3', { class: 'card__title', text: video.title })));
    const metaLine = U.el('div', { class: 'card__meta' });
    metaLine.appendChild(link('#/channel/' + video.authorId, author ? author.name : 'Удалённый канал'));
    metaLine.appendChild(U.el('div', { text: `${U.pluralizeView(video.views || 0)} · ${U.timeAgo(video.createdAt)}` }));
    meta.appendChild(metaLine);
    body.appendChild(meta);
    card.appendChild(body);

    return card;
  }

  function videoGrid(videos, emptyTitle, emptyText, emptyAction) {
    if (!videos.length) {
      return emptyNode(emptyTitle || 'Пока пусто', emptyText || 'Здесь появятся видео.', emptyAction);
    }
    const grid = U.el('div', { class: 'grid' });
    for (const video of videos) grid.appendChild(videoCard(video));
    return grid;
  }

  function emptyNode(title, text, actionNode) {
    const node = U.el('div', { class: 'empty' });
    node.appendChild(U.el('div', { class: 'empty__title', text: title }));
    if (text) node.appendChild(U.el('div', { text }));
    if (actionNode) {
      const wrap = U.el('div', { props: { style: 'margin-top:16px;display:flex;justify-content:center' } });
      wrap.appendChild(actionNode);
      node.appendChild(wrap);
    }
    return node;
  }

  /* ---------- Комментарии ---------- */

  function commentNode(comment) {
    const author = S.store.findUser(comment.authorId);
    const me = S.store.currentUser();
    const canEdit = Boolean(me && (me.id === comment.authorId || S.store.isAdmin()));

    const node = U.el('div', { class: 'comment' });
    node.appendChild(
      author
        ? link('#/channel/' + author.id, avatarNode(author, 40))
        : avatarNode(null, 40)
    );

    const body = U.el('div', { class: 'comment__body' });
    const head = U.el('div', { class: 'comment__head' });
    if (author) head.appendChild(link('#/channel/' + author.id, U.el('span', { class: 'comment__author', text: author.name })));
    else head.appendChild(U.el('span', { class: 'comment__author', text: 'Удалённый канал' }));
    head.appendChild(U.el('span', { class: 'comment__time', text: U.timeAgo(comment.createdAt) + (comment.editedAt ? ' (изменён)' : '') }));
    if (author && author.role === 'moderator') head.appendChild(U.el('span', { class: 'comment__badge', text: 'модератор' }));
    body.appendChild(head);

    const text = U.el('p', { class: 'comment__text', text: comment.text });
    body.appendChild(text);

    const actions = U.el('div', { class: 'comment__actions' });
    if (canEdit) {
      actions.appendChild(
        U.el('button', {
          attrs: { type: 'button' },
          text: 'Изменить',
          on: {
            click: () => {
              const input = U.el('textarea', { class: 'textarea', value: comment.text });
              const close = openModal({
                title: 'Изменить комментарий',
                body: input,
                actions: [
                  { label: 'Отмена', kind: 'ghost' },
                  {
                    label: 'Сохранить',
                    kind: 'primary',
                    onClick: () => {
                      try {
                        S.store.updateComment(comment.id, input.value);
                        toast('Комментарий обновлён', 'ok');
                      } catch (error) {
                        toast(error.message, 'error');
                        return false;
                      }
                      return true;
                    },
                  },
                ],
              });
              return close;
            },
          },
        })
      );
      actions.appendChild(
        U.el('button', {
          attrs: { type: 'button' },
          text: 'Удалить',
          on: {
            click: async () => {
              const ok = await confirmDialog({
                title: 'Удалить комментарий?',
                message: 'Действие нельзя отменить.',
                confirmLabel: 'Удалить',
                danger: true,
              });
              if (!ok) return;
              S.store.removeComment(comment.id);
              toast('Комментарий удалён', 'ok');
            },
          },
        })
      );
    }
    if (actions.childNodes.length) body.appendChild(actions);

    node.appendChild(body);
    return node;
  }

  function commentsSection(video) {
    const me = S.store.currentUser();
    const comments = S.store.listComments(video.id);
    const section = U.el('section', { class: 'comments' });

    const head = U.el('div', { class: 'comments__head' });
    head.appendChild(U.el('h2', { class: 'comments__count', text: U.pluralizeComment(comments.length) }));
    section.appendChild(head);

    if (me) {
      const form = U.el('form', { class: 'comment-form' });
      form.appendChild(avatarNode(me, 40));
      const fields = U.el('div', { class: 'comment-form__fields' });
      const input = U.el('input', {
        attrs: { type: 'text', placeholder: 'Введите комментарий…', 'aria-label': 'Текст комментария', maxlength: '2000' },
      });
      fields.appendChild(input);
      const row = U.el('div', { class: 'comment-form__row' });
      row.appendChild(U.el('button', { class: 'btn btn--ghost btn--sm', attrs: { type: 'reset' }, text: 'Отмена' }));
      row.appendChild(U.el('button', { class: 'btn btn--primary btn--sm', attrs: { type: 'submit' }, text: 'Отправить' }));
      fields.appendChild(row);
      form.appendChild(fields);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        try {
          S.store.addComment(video.id, input.value);
          input.value = '';
          S.app.render();
        } catch (error) {
          toast(error.message, 'error');
        }
      });
      form.addEventListener('reset', () => {
        input.value = '';
      });
      section.appendChild(form);
    } else {
      const note = U.el('div', { class: 'hint-text', props: { style: 'margin-bottom:24px' } });
      note.appendChild(document.createTextNode('Чтобы оставить комментарий, '));
      note.appendChild(link('#/login', 'войдите в аккаунт'));
      note.appendChild(document.createTextNode('.'));
      section.appendChild(note);
    }

    if (!comments.length) {
      section.appendChild(emptyNode('Комментариев пока нет', 'Станьте первым, кто выскажется об этом видео.'));
      return section;
    }
    for (const comment of comments) section.appendChild(commentNode(comment));
    return section;
  }

  /* ---------- Выбор аватара ---------- */

  /**
   * Универсальный редактор аватара: локальный файл (превращается в data:URL)
   * либо ссылка https. Используется и в профиле, и в панели модерации.
   */
  function avatarPicker(current, onChange) {
    let value = current || '';

    const wrap = U.el('div');
    const previewRow = U.el('div', { props: { style: 'display:flex;align-items:center;gap:16px;margin-bottom:16px' } });
    const preview = U.el('img', {
      class: 'avatar',
      attrs: { alt: 'Предпросмотр аватара', width: 72, height: 72 },
      props: { style: 'width:72px;height:72px;border:1px solid var(--border)' },
    });
    const previewWrap = U.el('div');
    previewWrap.appendChild(preview);
    previewRow.appendChild(previewWrap);

    const fileInput = U.el('input', {
      attrs: { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', class: 'sr-only' },
    });
    const urlInput = U.el('input', {
      class: 'input',
      attrs: { type: 'url', placeholder: 'https://example.com/avatar.jpg', maxlength: '500' },
    });

    function refresh() {
      const src = value || S.media.makeAvatar('?', '#7e57c2');
      preview.src = src;
    }

    const controls = U.el('div', { props: { style: 'flex:1;min-width:0' } });
    const buttons = U.el('div', { props: { style: 'display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap' } });
    buttons.appendChild(
      U.el('button', {
        class: 'btn btn--ghost btn--sm',
        attrs: { type: 'button' },
        text: 'Загрузить файл',
        on: { click: () => fileInput.click() },
      })
    );
    buttons.appendChild(
      U.el('button', {
        class: 'btn btn--ghost btn--sm',
        attrs: { type: 'button' },
        text: 'Сбросить',
        on: {
          click: () => {
            value = '';
            urlInput.value = '';
            refresh();
            onChange(value);
          },
        },
      })
    );
    controls.appendChild(buttons);
    controls.appendChild(urlInput);
    controls.appendChild(
      U.el('p', { class: 'field__hint', text: 'Файл не отправляется в сеть — он сохраняется как локальная копия. Можно вставить и ссылку https.' })
    );
    controls.appendChild(fileInput);
    previewRow.appendChild(controls);
    wrap.appendChild(previewRow);

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (file.size > 3 * 1024 * 1024) {
        toast('Файл больше 3 МБ. Сожмите изображение и попробуйте снова.', 'error');
        fileInput.value = '';
        return;
      }
      S.media.readFileAsDataUrl(file).then((dataUrl) => {
        value = dataUrl;
        urlInput.value = '';
        refresh();
        onChange(value);
      });
    });

    urlInput.addEventListener('change', () => {
      const safe = U.safeHttpUrl(urlInput.value);
      if (urlInput.value && !safe) {
        toast('Ссылка должна начинаться с https:// или http://', 'error');
        urlInput.value = '';
        return;
      }
      value = safe;
      refresh();
      onChange(value);
    });

    preview.addEventListener('error', () => {
      preview.src = S.media.makeAvatar('?', '#7e57c2');
    });

    refresh();
    return { node: wrap, getValue: () => value };
  }

  S.ui = {
    toast,
    openModal,
    avatarPicker,
    confirmDialog,
    avatarNode,
    link,
    videoCard,
    videoGrid,
    emptyNode,
    commentsSection,
    commentNode,
  };
})(window);
