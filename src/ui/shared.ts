import { el } from '../lib/dom';

export const ACCENT = 'var(--color-accent)';

/** Панель страницы: поля сжимаются на телефоне, поэтому стиль в styles.css. */
export const PANEL_CLASS = 'panel';

/** «Туманная линия» — разделитель, тающий к краям панели. */
export function fogRule(): HTMLElement {
  return el('div', {
    style:
      'height:1px; background:linear-gradient(to right, transparent,' +
      ' var(--color-divider) 48px, var(--color-divider) calc(100% - 48px), transparent)',
  });
}

export function kicker(text: string): HTMLElement {
  return el('span', {
    style: 'font-size:11px; letter-spacing:0.2em; color:var(--color-accent-300); text-transform:uppercase',
    text,
  });
}

export function panelHeading(text: string): HTMLElement {
  return el('h2', { style: 'margin:4px 0 2px; font-size:24px', text });
}

export function panelSub(text: string): HTMLElement {
  return el('span', { style: 'font-size:13px; color:#8b93a1', text });
}

/** Бейдж с числом голосов пачки; при нуле скрыт. */
export function voteBadge(): HTMLElement {
  return el('span', {
    title: 'голосов в пачке',
    style:
      'display:none; margin-left:auto; flex:none; align-items:center; justify-content:center;' +
      ' min-width:24px; height:22px; padding:0 7px; border-radius:11px;' +
      ' font-family:var(--font-heading); font-size:12px',
  });
}

export function paintVoteBadge(node: HTMLElement, votes: number, picked: boolean): void {
  if (votes <= 0) {
    node.style.display = 'none';
    return;
  }
  node.style.display = 'inline-flex';
  node.textContent = String(votes);
  node.style.background = picked ? 'rgba(200,160,106,0.26)' : 'rgba(255,255,255,0.05)';
  node.style.borderColor = picked ? 'var(--color-accent-600)' : 'var(--color-divider)';
  node.style.border = `1px solid ${picked ? 'var(--color-accent-600)' : 'var(--color-divider)'}`;
  node.style.color = picked ? 'var(--color-accent-100)' : '#8b93a1';
}

/** Круглый аватар с инициалом или картинкой профиля Discord. */
export function avatar(name: string, url: string | null, size = 28): HTMLElement {
  const base =
    `flex:none; width:${size}px; height:${size}px; border-radius:50%;` +
    ' background:var(--color-accent-800); border:1px solid var(--color-accent-600);' +
    ' display:grid; place-items:center; overflow:hidden;' +
    ` font-family:var(--font-heading); font-size:${size <= 28 ? 12 : 14}px; color:var(--color-accent-100)`;
  if (url) {
    const wrap = el('span', { style: base });
    wrap.append(
      el('img', {
        attrs: { src: url, alt: name, loading: 'lazy' },
        style: 'width:100%; height:100%; object-fit:cover',
      }),
    );
    return wrap;
  }
  return el('span', { style: base, text: name.charAt(0).toUpperCase() });
}
