/**
 * Минимальный хелпер разметки. Стили задаются строкой, чтобы значения
 * из дизайн-макета переносились дословно, без промежуточного слоя.
 *
 * Текст ставится только через `text` — это `textContent`. Разметкой строку
 * не вставить, и добавлять такую возможность не нужно: всё, что печатают
 * участники, попадает на страницу через этот хелпер.
 */
type Child = Node | string | null | undefined | false;

export interface ElOpts {
  class?: string;
  style?: string;
  text?: string;
  title?: string;
  type?: 'button' | 'submit' | 'reset';
  rows?: number;
  placeholder?: string;
  attrs?: Record<string, string>;
  on?: Partial<Record<keyof HTMLElementEventMap, (e: never) => void>>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: ElOpts = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.style) node.setAttribute('style', opts.style);
  if (opts.title) node.title = opts.title;
  if (opts.text !== undefined) node.textContent = opts.text;
  if (opts.type && node instanceof HTMLButtonElement) node.type = opts.type;
  if (opts.rows !== undefined && node instanceof HTMLTextAreaElement) node.rows = opts.rows;
  if (opts.placeholder !== undefined && node instanceof HTMLTextAreaElement) node.placeholder = opts.placeholder;
  if (opts.attrs) for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, v);
  if (opts.on) {
    for (const [name, fn] of Object.entries(opts.on)) {
      if (fn) node.addEventListener(name, fn as EventListener);
    }
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c);
  }
  return node;
}

/** Кнопка без дефолтного submit-поведения — весь UI построен на них. */
export function button(opts: ElOpts = {}, children: Child[] = []): HTMLButtonElement {
  return el('button', { ...opts, type: 'button' }, children);
}

export function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Точечное обновление стиля: перерисовываем состояние, не пересоздавая узлы. */
export function setStyles(node: HTMLElement, styles: Record<string, string>): void {
  for (const [k, v] of Object.entries(styles)) node.style.setProperty(k, v);
}
