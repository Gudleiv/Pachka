import { button, el } from '../lib/dom';
import { tzLabel, tzZone } from '../lib/dates';
import type { Member } from '../backend/types';
import { avatar } from './shared';

/** Верхняя полоса: руна, вордмарк, игра, часовой пояс устройства и аватар. */
export function createHeader(game: string, me: Member | null, onSignOut: (() => void) | null): HTMLElement {
  const right = el('div', { style: 'margin-left:auto; display:flex; align-items:center; gap:10px' }, [
    el('span', {
      title: 'Часовой пояс вашего устройства',
      style:
        'display:inline-flex; align-items:center; gap:6px; padding:4px 9px; border-radius:12px;' +
        ' border:1px solid var(--color-divider); background:rgba(255,255,255,0.03);' +
        ' font-size:12px; color:#9aa2b0',
    }, [
      el('span', { style: 'color:var(--color-accent-300)', text: tzLabel() }),
      tzZone(),
    ]),
  ]);

  if (me) {
    right.append(avatar(me.displayName, me.avatarUrl));
    if (onSignOut) {
      right.append(
        button({ class: 'btn btn-ghost', style: 'font-size:12px', text: 'Выйти', on: { click: onSignOut } }),
      );
    }
  }

  return el('header', {
    style:
      'display:flex; align-items:center; gap:14px; padding:14px 26px;' +
      ' border-bottom:1px solid var(--color-divider); background:rgba(14,16,21,0.7)',
  }, [
    el('span', { style: 'font-family:var(--font-heading); font-size:20px; letter-spacing:0.14em; color:var(--color-accent-300)', text: 'ᚠ' }),
    el('span', { style: 'font-family:var(--font-heading); font-size:17px; letter-spacing:0.08em', text: 'ПАЧКА' }),
    el('span', { style: 'width:1px; height:20px; background:var(--color-divider)' }),
    el('span', { style: 'font-size:13px; color:#9aa2b0; letter-spacing:0.04em', text: game }),
    right,
  ]);
}

/** Обложка пачки: заголовок слева, арт справа. */
export function createCover(title: string, coverUrl: string | null): HTMLElement {
  const slot = el('div', {
    style:
      'position:relative; min-height:200px; border:1px solid var(--color-divider);' +
      ' border-radius:var(--radius-md); overflow:hidden; background:#0f1217',
  });
  if (coverUrl) {
    slot.append(el('img', {
      attrs: { src: coverUrl, alt: `Арт пачки: ${title}` },
      style: 'width:100%; height:100%; object-fit:cover; display:block',
    }));
  } else {
    slot.append(el('div', {
      style: 'position:absolute; inset:0; display:grid; place-items:center; font-size:12px; color:#6d7481; text-align:center; padding:16px',
      text: 'Арт пачки не задан',
    }));
  }

  return el('section', {
    style: 'display:grid; grid-template-columns:minmax(0,1.6fr) minmax(0,1fr); gap:22px; align-items:stretch',
  }, [
    el('div', { style: 'display:flex; flex-direction:column; gap:12px; justify-content:center' }, [
      el('h1', { style: 'margin:0; font-size:40px; line-height:1.08; text-wrap:pretty', text: title }),
    ]),
    slot,
  ]);
}

interface NoticeAction {
  label: string;
  onClick: () => void;
}

export interface NoticeOpts {
  title: string;
  text: string;
  action?: NoticeAction;
  /** Второстепенный выход из экрана: «Выйти» рядом с «Повторить». */
  secondary?: NoticeAction;
}

/** Экран входа / ошибки — та же панель, что и остальные блоки страницы. */
export function createNotice({ title, text, action, secondary }: NoticeOpts): HTMLElement {
  const box = el('section', {
    style:
      'display:flex; flex-direction:column; align-items:flex-start; gap:14px; padding:26px;' +
      ' border:1px solid var(--color-divider); border-radius:var(--radius-md);' +
      ' background:linear-gradient(180deg, rgba(26,30,38,0.9), rgba(18,21,27,0.9)); max-width:560px',
  }, [
    el('h1', { style: 'margin:0; font-size:28px; line-height:1.15; text-wrap:pretty', text: title }),
    el('p', { style: 'margin:0; font-size:14px; line-height:1.6; color:#8b93a1; text-wrap:pretty', text }),
  ]);

  if (action || secondary) {
    const row = el('div', { style: 'display:flex; flex-wrap:wrap; gap:10px' });
    if (action) {
      row.append(
        button({ class: 'btn btn-primary', style: 'height:40px; padding-inline:18px', text: action.label, on: { click: action.onClick } }),
      );
    }
    if (secondary) {
      row.append(
        button({ class: 'btn', style: 'height:40px; padding-inline:18px', text: secondary.label, on: { click: secondary.onClick } }),
      );
    }
    box.append(row);
  }
  return box;
}
