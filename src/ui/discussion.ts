import { button, clear, el } from '../lib/dom';
import { plural } from '../lib/plural';
import type { Post } from '../backend/types';
import { avatar, fogRule, kicker, panelHeading, PANEL_CLASS } from './shared';

export interface DiscussionHandlers {
  submit(text: string): void;
  edit(id: string, text: string): void;
  remove(id: string): void;
  toggleVote(id: string, next: boolean): void;
}

export interface DiscussionView {
  node: HTMLElement;
  paint(posts: Post[]): void;
}

const FIELD_STYLE =
  'width:100%; box-sizing:border-box; resize:vertical; padding:12px 14px;' +
  ' border-radius:var(--radius-sm); border:1px solid var(--color-divider);' +
  ' background:rgba(15,18,23,0.8); color:var(--color-text); font-family:var(--font-body);' +
  ' font-size:14px; line-height:1.5';

/** Действие над своим сообщением: подчёркнутая ссылка, а не кнопка. */
function action(text: string, color: string, onClick: () => void): HTMLButtonElement {
  return button({
    text,
    style:
      `padding:4px 0; border:0; background:none; cursor:pointer; font:inherit; font-size:12px; color:${color};` +
      ' text-decoration:underline; text-underline-offset:3px',
    on: { click: onClick },
  });
}

/**
 * Лента обсуждения: моды, правила, договорённости. Своё сообщение автор
 * может поправить — тогда рядом появляется пометка «отредактировано» — или
 * удалить; чужие закрыты и здесь, и в политиках базы.
 */
export function createDiscussionPanel(meId: string, handlers: DiscussionHandlers): DiscussionView {
  const count = el('span', { style: 'font-size:13px; color:var(--color-accent-300)' });

  const input = el('textarea', {
    rows: 3,
    placeholder: 'Сообщение или предложение по моду',
    style: FIELD_STYLE,
  });

  const send = button({ class: 'btn btn-primary', style: 'margin-left:auto; height:38px', text: 'Отправить' });

  const syncSend = () => {
    const ok = input.value.trim().length > 0;
    send.style.opacity = ok ? '1' : '0.45';
    send.setAttribute('aria-disabled', ok ? 'false' : 'true');
  };
  input.addEventListener('input', syncSend);
  send.addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    syncSend();
    handlers.submit(text);
  });
  syncSend();

  const list = el('div', { style: 'display:flex; flex-direction:column; gap:8px' });

  const node = el('section', { class: PANEL_CLASS }, [
    el('div', { style: 'display:flex; align-items:flex-end; gap:14px; flex-wrap:wrap' }, [
      el('div', { style: 'margin-right:auto' }, [
        kicker('Третье'),
        panelHeading('Обсуждения, предложения по модам и пр.'),
      ]),
      count,
    ]),
    fogRule(),
    el('div', { style: 'display:flex; flex-direction:column; gap:10px' }, [
      input,
      el('div', { style: 'display:flex; align-items:center; gap:12px; flex-wrap:wrap' }, [send]),
    ]),
    list,
  ]);

  let posts: Post[] = [];
  /** Сообщение, открытое на правку, и его поле — поле переживает перерисовку. */
  let editing: string | null = null;
  let editor: HTMLTextAreaElement | null = null;
  /** Удаление в два касания: первое спрашивает, второе удаляет. */
  let confirming: string | null = null;

  function startEdit(post: Post): void {
    confirming = null;
    editing = post.id;
    editor = el('textarea', { rows: 3, style: FIELD_STYLE });
    editor.value = post.text;
    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') stopEdit();
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) commitEdit(post);
      else return;
      e.preventDefault();
      render();
    });
    render();
    editor.focus();
    editor.setSelectionRange(post.text.length, post.text.length);
  }

  function stopEdit(): void {
    editing = null;
    editor = null;
  }

  function commitEdit(post: Post): void {
    const text = editor?.value.trim() ?? '';
    stopEdit();
    // Пустой текст — это не правка, а удаление: сообщение оставляем как было.
    if (text && text !== post.text) handlers.edit(post.id, text);
  }

  function ownActions(post: Post): HTMLElement {
    const row = el('div', { style: 'display:flex; align-items:center; gap:14px; flex-wrap:wrap' });

    if (editing === post.id) {
      row.append(
        action('Сохранить', 'var(--color-accent-100)', () => {
          commitEdit(post);
          render();
        }),
        action('Отмена', '#8b93a1', () => {
          stopEdit();
          render();
        }),
      );
      return row;
    }

    if (confirming === post.id) {
      row.append(
        el('span', { style: 'font-size:12px; color:#8b93a1', text: 'Удалить?' }),
        action('Да', '#d98b7a', () => {
          confirming = null;
          handlers.remove(post.id);
        }),
        action('Нет', '#8b93a1', () => {
          confirming = null;
          render();
        }),
      );
      return row;
    }

    row.append(
      action('Изменить', '#8b93a1', () => startEdit(post)),
      action('Удалить', '#8b93a1', () => {
        confirming = post.id;
        render();
      }),
    );
    return row;
  }

  function row(post: Post): HTMLElement {
    const mine = post.authorId === meId;

    const like = button(
      {
        title: 'Поддержать',
        style:
          'display:flex; flex:none; align-items:center; gap:6px; margin-left:auto; padding:5px 10px;' +
          ' cursor:pointer; font:inherit; font-size:12px; border-radius:13px;' +
          ` border:1px solid ${post.mine ? 'var(--color-accent-600)' : 'var(--color-divider)'};` +
          ` background:${post.mine ? 'rgba(200,160,106,0.18)' : 'rgba(255,255,255,0.04)'};` +
          ` color:${post.mine ? 'var(--color-accent-100)' : '#8b93a1'};` +
          ' transition:background 120ms, border-color 120ms',
        on: { click: () => handlers.toggleVote(post.id, !post.mine) },
      },
      [el('span', { style: 'font-size:11px', text: 'ᛉ' }), String(post.likes)],
    );
    like.setAttribute('aria-pressed', post.mine ? 'true' : 'false');

    return el(
      'div',
      {
        style:
          'display:flex; align-items:flex-start; flex-wrap:wrap; gap:12px; padding:12px 14px;' +
          ' border-radius:var(--radius-sm); border:1px solid var(--color-divider);' +
          ' background:rgba(255,255,255,0.025)',
      },
      [
        avatar(post.authorName, post.authorAvatar),
        // На телефоне кнопке голоса не хватает места в строке — она
        // переносится вниз, а текст занимает всю ширину карточки.
        el('span', { style: 'display:flex; flex-direction:column; gap:3px; min-width:0; flex:1 1 200px' }, [
          el('span', { style: 'display:flex; align-items:baseline; gap:8px; flex-wrap:wrap' }, [
            el('span', { style: 'font-size:12px; color:var(--color-accent-300)', text: post.authorName }),
            // Когда именно правили — не показываем: в ленте важен сам факт.
            post.edited && el('span', { style: 'font-size:11px; color:#6f7787', text: 'отредактировано' }),
          ]),
          editing === post.id && editor
            ? editor
            : el('span', {
                style: 'font-size:14px; line-height:1.5; color:#c3c8d2; text-wrap:pretty; white-space:pre-wrap',
                text: post.text,
              }),
          mine && ownActions(post),
        ]),
        like,
      ],
    );
  }

  function render(): void {
    count.textContent = `${posts.length} ${plural(posts.length, ['сообщение', 'сообщения', 'сообщений'])}`;

    // Открытое поле правки могло уехать вместе с удалённым сообщением.
    if (editing && !posts.some((p) => p.id === editing)) stopEdit();
    if (confirming && !posts.some((p) => p.id === confirming)) confirming = null;

    const focused = editor !== null && document.activeElement === editor;
    const caret: [number, number] = editor ? [editor.selectionStart, editor.selectionEnd] : [0, 0];

    clear(list);
    if (!posts.length) {
      list.append(el('span', { style: 'font-size:13px; color:#8b93a1', text: 'Пока пусто. Начни обсуждение.' }));
      return;
    }
    for (const post of posts) list.append(row(post));

    // Перерисовка вынимает поле из документа, а вместе с ним — и фокус.
    if (focused && editor) {
      editor.focus();
      editor.setSelectionRange(caret[0], caret[1]);
    }
  }

  function paint(next: Post[]): void {
    posts = next;
    render();
  }

  return { node, paint };
}
