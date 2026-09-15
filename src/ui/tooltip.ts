import { clear, el } from '../lib/dom';
import { avatar } from './shared';

/** Строка подсказки: участник пачки и, если есть, что уточнить справа. */
export interface TipRow {
  name: string;
  avatarUrl: string | null;
  /** Правая колонка: часы на карте; у голосов её нет. */
  note?: string;
  /** Это ты — строка подсвечена. */
  mine: boolean;
}

/**
 * Длинный список режется: прокрутить подсказку нельзя (она не ловит указатель),
 * так что вместо молча обрезанного хвоста показываем, сколько ещё людей.
 */
const MAX_ROWS = 10;

export interface TipContent {
  head: string;
  rows: TipRow[];
}

export interface TooltipView {
  /** Кладётся в ту же панель: `position:fixed`, места в потоке не занимает. */
  node: HTMLElement;
  /** Перерисовать открытую подсказку: состав под ней мог измениться. */
  refresh(): void;
}

/**
 * Мгновенная подсказка со списком участников. Родной `title` тут не годится:
 * он появляется через паузу, а по карте и по голосам водят бегло. Эта
 * показывается сразу, умеет аватары и не перехватывает клики
 * (`pointer-events:none`), поэтому висит поверх, ничему не мешая.
 *
 * `read` получает элемент под указателем — тот, что подошёл под `selector`
 * внутри `scope`, — и возвращает содержимое или `null`, если показывать нечего.
 */
export function createTooltip(
  scope: HTMLElement,
  selector: string,
  read: (target: HTMLElement) => TipContent | null,
): TooltipView {
  const head = el('span', { style: 'font-size:11px; letter-spacing:0.04em; color:#8b93a1; text-wrap:pretty' });
  const list = el('div', { style: 'display:flex; flex-direction:column; gap:7px' });
  const node = el(
    'div',
    {
      style:
        'position:fixed; left:0; top:0; z-index:50; display:none; pointer-events:none;' +
        ' flex-direction:column; gap:8px; min-width:180px; max-width:288px; padding:10px 12px;' +
        ' border:1px solid var(--color-accent-700); border-radius:var(--radius-md);' +
        ' background:rgba(18,21,27,0.97); box-shadow:0 12px 28px rgba(0,0,0,0.55)',
      attrs: { role: 'tooltip' },
    },
    [head, list],
  );

  let anchor: HTMLElement | null = null;

  function place(): void {
    if (!anchor) return;
    const a = anchor.getBoundingClientRect();
    const t = node.getBoundingClientRect();
    const pad = 8;
    const left = Math.min(Math.max(pad, a.left + a.width / 2 - t.width / 2), window.innerWidth - t.width - pad);
    // Над элементом, чтобы не закрывать соседние справа; не влезло — под ним.
    let top = a.top - t.height - 8;
    if (top < pad) top = a.bottom + 8;
    top = Math.min(top, window.innerHeight - t.height - pad);
    node.style.left = `${Math.round(left)}px`;
    node.style.top = `${Math.round(Math.max(pad, top))}px`;
  }

  function hide(): void {
    anchor = null;
    node.style.display = 'none';
  }

  function show(target: HTMLElement): void {
    const content = read(target);
    // Показывать нечего — молчим, а не выводим пустую рамку.
    if (!content) return hide();

    anchor = target;
    head.textContent = content.head;
    clear(list);
    const rows = content.rows.length > MAX_ROWS ? content.rows.slice(0, MAX_ROWS - 1) : content.rows;
    for (const row of rows) {
      list.append(
        el('div', { style: 'display:flex; align-items:center; gap:8px' }, [
          avatar(row.name, row.avatarUrl, 22),
          el('span', {
            style:
              'flex:1 1 auto; min-width:0; font-size:12px; overflow:hidden; text-overflow:ellipsis;' +
              ` white-space:nowrap; color:${row.mine ? 'var(--color-accent-100)' : 'var(--color-text)'}`,
            text: row.name,
          }),
          row.note
            ? el('span', {
                style: 'flex:none; font-size:11px; color:var(--color-accent-300); white-space:nowrap',
                text: row.note,
              })
            : null,
        ]),
      );
    }
    if (rows.length < content.rows.length) {
      list.append(el('span', {
        style: 'padding-left:30px; font-size:11px; color:#7b8390',
        text: `и ещё ${content.rows.length - rows.length}`,
      }));
    }
    node.style.display = 'flex';
    place();
  }

  const hit = (target: EventTarget | null): HTMLElement | null =>
    target instanceof Element ? target.closest<HTMLElement>(selector) : null;

  // Палец, в отличие от мыши, «уходит» сразу после касания: браузер шлёт
  // pointerleave на отпускании. Поэтому на тач подсказку закрывает не уход
  // указателя, а следующее касание — мимо или по тому же элементу.
  let byTouch = false;

  scope.addEventListener('pointerover', (e) => {
    const target = hit(e.target);
    if (!target) return hide();
    if (target === anchor) return;
    byTouch = e.pointerType === 'touch';
    show(target);
  });
  scope.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'touch') hide();
  });
  document.addEventListener('pointerdown', (e) => {
    const target = hit(e.target);
    if (!target) return hide();
    // Открывшее подсказку касание приходит сюда сразу за pointerover — оно её
    // не закрывает, закрывает следующее.
    if (target === anchor && e.pointerType === 'touch' && !byTouch) hide();
    byTouch = false;
  });
  // Всё, что двигает элемент, двигает и подсказку, иначе она от него отвяжется.
  scope.addEventListener('scroll', place, { passive: true });
  window.addEventListener('scroll', place, { passive: true, capture: true });
  window.addEventListener('resize', hide);

  return {
    node,
    refresh() {
      if (anchor) show(anchor);
    },
  };
}
