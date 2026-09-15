import { blockLabel, shortDate, WD, type DayCell } from '../lib/dates';
import { clear, el } from '../lib/dom';
import { avatar, fogRule, PANEL_CLASS } from './shared';

const ROW_STYLE = 'display:grid; grid-template-columns:78px repeat(var(--cols), minmax(20px,1fr)); gap:3px; min-width:790px';

/** Выходные в шапке — красноватым: иначе они неотличимы от «тут кто-то есть». */
const WEEKEND = 'var(--blood-300)';

/** Вечерние блоки подписаны контрастнее — по ним чаще всего и читают карту. */
function labelWeight(b: number): boolean {
  return b >= 8 && b <= 11;
}

function fill(k: number): string {
  return `rgba(200,160,106,${(0.08 + k * 0.72).toFixed(3)})`;
}

/** Строка подсказки: кто отметил этот блок и до скольки он в этот день. */
export interface CellPerson {
  name: string;
  avatarUrl: string | null;
  /** Отрезок, в который попал этот блок: «18:00–00:00». */
  hours: string;
  /** Это ты — строка подсвечена, как и рамка своих часов на карте. */
  mine: boolean;
}

export interface HeatmapDeps {
  /**
   * Кто отмечен в этом блоке. Спрашиваем на наведении, а не на отрисовке:
   * заранее это 360 списков, из которых смотрят один.
   */
  who(block: number, dayIndex: number): CellPerson[];
}

export interface HeatmapView {
  node: HTMLElement;
  /**
   * @param counts   counts[block][dayIndex] — сколько человек свободно
   * @param mine     mine[block][dayIndex] — попадают ли сюда твои часы
   * @param total    размер пачки, знаменатель заливки
   */
  paint(counts: number[][], mine: boolean[][], total: number): void;
}

export function createHeatmap(days: DayCell[], deps: HeatmapDeps): HeatmapView {
  const cells: HTMLElement[][] = [];
  const matrix = el('div', {
    style: 'display:flex; flex-direction:column; gap:3px; overflow-x:auto; padding-bottom:4px',
  });
  matrix.style.setProperty('--cols', String(days.length));

  // Шапка в две строки: день недели и число. Одними числами карта не читалась —
  // серое и светлое можно было принять за «тут кто-то отметился», а не за выходной.
  const dows = el('div', { style: ROW_STYLE }, [el('span')]);
  const head = el('div', { style: ROW_STYLE }, [el('span')]);
  for (const d of days) {
    const weekend = d.dow >= 5;
    dows.append(
      el('span', {
        style: `font-size:9px; letter-spacing:0.04em; text-align:center; color:${weekend ? WEEKEND : '#6d7481'}`,
        text: WD[d.dow],
      }),
    );
    head.append(
      el('span', {
        style: `font-size:9px; text-align:center; color:${weekend ? WEEKEND : '#9aa2b0'}`,
        text: String(d.date.getDate()),
      }),
    );
  }
  matrix.append(dows, head);

  for (let b = 0; b < 12; b++) {
    const row = el('div', { style: ROW_STYLE }, [
      el('span', {
        style:
          'font-size:10px; letter-spacing:0.02em; text-align:right; padding-right:4px; align-self:center;' +
          ` color:${labelWeight(b) ? '#c3c8d2' : '#6d7481'}`,
        text: blockLabel(b),
      }),
    ]);
    const rowCells: HTMLElement[] = [];
    for (let i = 0; i < days.length; i++) {
      const cell = el('span', {
        style: 'display:grid; place-items:center; height:17px; border-radius:2px; font-size:9px',
        attrs: { 'data-b': String(b), 'data-i': String(i) },
      });
      rowCells.push(cell);
      row.append(cell);
    }
    cells.push(rowCells);
    matrix.append(row);
  }

  const legend = el('div', { style: 'display:flex; align-items:center; gap:10px; flex-wrap:wrap' }, [
    el('span', { style: 'font-size:11px; color:#7b8390', text: 'Никого' }),
    el(
      'span',
      { style: 'display:flex; gap:3px' },
      [0, 0.25, 0.5, 0.75, 1].map((k) =>
        el('span', {
          style: `width:22px; height:12px; border-radius:2px; background:${k === 0 ? 'rgba(255,255,255,0.02)' : fill(k)}`,
        }),
      ),
    ),
    el('span', { style: 'font-size:11px; color:#7b8390', text: 'Все' }),
    el('span', { style: 'margin-left:14px; display:flex; align-items:center; gap:6px; font-size:11px; color:#7b8390' }, [
      el('span', { style: 'width:12px; height:12px; border-radius:2px; box-shadow:inset 0 0 0 1px rgba(125,153,99,0.9)' }),
      'твои часы',
    ]),
  ]);

  // ——— подсказка по ячейке ———
  // Родной `title` тут не годится: он появляется через паузу, а в карте
  // наводят бегло, по десятку ячеек подряд. Своя всплывашка показывается
  // сразу и умеет аватары. Клики она не перехватывает (pointer-events:none),
  // поэтому висит поверх карты, не мешая протяжке.
  const tipHead = el('span', { style: 'font-size:11px; letter-spacing:0.04em; color:#8b93a1; white-space:nowrap' });
  const tipList = el('div', {
    style: 'display:flex; flex-direction:column; gap:7px; max-height:246px; overflow-y:auto',
  });
  const tip = el(
    'div',
    {
      style:
        'position:fixed; left:0; top:0; z-index:50; display:none; pointer-events:none;' +
        ' flex-direction:column; gap:8px; min-width:180px; max-width:288px; padding:10px 12px;' +
        ' border:1px solid var(--color-accent-700); border-radius:var(--radius-md);' +
        ' background:rgba(18,21,27,0.97); box-shadow:0 12px 28px rgba(0,0,0,0.55)',
      attrs: { role: 'tooltip' },
    },
    [tipHead, tipList],
  );

  let hovered: HTMLElement | null = null;

  function place(cell: HTMLElement): void {
    const c = cell.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const pad = 8;
    const left = Math.min(Math.max(pad, c.left + c.width / 2 - t.width / 2), window.innerWidth - t.width - pad);
    // Над ячейкой, чтобы не закрывать соседние справа; не влезло — под ней.
    let top = c.top - t.height - 8;
    if (top < pad) top = c.bottom + 8;
    top = Math.min(top, window.innerHeight - t.height - pad);
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(Math.max(pad, top))}px`;
  }

  function hide(): void {
    hovered = null;
    tip.style.display = 'none';
  }

  function show(cell: HTMLElement): void {
    const b = Number(cell.dataset['b']);
    const i = Number(cell.dataset['i']);
    const people = deps.who(b, i);
    // Пустая ячейка молчит: показывать «никого» — только мешать.
    if (!people.length) return hide();

    hovered = cell;
    const d = days[i]!;
    tipHead.textContent = `${shortDate(d.date, d.dow)} · ${blockLabel(b)}`;
    clear(tipList);
    for (const person of people) {
      tipList.append(
        el('div', { style: 'display:flex; align-items:center; gap:8px' }, [
          avatar(person.name, person.avatarUrl, 22),
          el('span', {
            style:
              'flex:1 1 auto; min-width:0; font-size:12px; overflow:hidden; text-overflow:ellipsis;' +
              ` white-space:nowrap; color:${person.mine ? 'var(--color-accent-100)' : 'var(--color-text)'}`,
            text: person.name,
          }),
          el('span', {
            style: 'flex:none; font-size:11px; color:var(--color-accent-300); white-space:nowrap',
            text: person.hours,
          }),
        ]),
      );
    }
    tip.style.display = 'flex';
    place(cell);
  }

  const cellAt = (target: EventTarget | null): HTMLElement | null =>
    target instanceof Element ? target.closest<HTMLElement>('[data-b]') : null;

  // Палец, в отличие от мыши, «уходит» с ячейки сразу после касания: браузер
  // на отпускании шлёт pointerleave. Поэтому на тач подсказку закрывает не уход
  // пальца, а следующее касание — мимо карты или по той же ячейке.
  let byTouch = false;

  matrix.addEventListener('pointerover', (e) => {
    const cell = cellAt(e.target);
    if (!cell) return hide();
    if (cell === hovered) return;
    byTouch = e.pointerType === 'touch';
    show(cell);
  });
  matrix.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'touch') hide();
  });
  document.addEventListener('pointerdown', (e) => {
    const cell = cellAt(e.target);
    if (!cell) return hide();
    // Открывшее подсказку касание приходит сюда сразу за pointerover — оно её
    // не закрывает, закрывает следующее.
    if (cell === hovered && e.pointerType === 'touch' && !byTouch) hide();
    byTouch = false;
  });
  // Карта и страница ездят вместе с подсказкой, иначе она отвязывается от ячейки.
  const follow = () => {
    if (hovered) place(hovered);
  };
  matrix.addEventListener('scroll', follow, { passive: true });
  window.addEventListener('scroll', follow, { passive: true, capture: true });
  window.addEventListener('resize', hide);

  const node = el('section', { class: PANEL_CLASS }, [
    el('div', { style: 'display:flex; align-items:flex-end; gap:14px; flex-wrap:wrap' }, [
      el('div', { style: 'margin-right:auto' }, [
        el('h2', { style: 'margin:0 0 2px; font-size:24px', text: 'Когда сходится пачка' }),
        el('span', { style: 'font-size:13px; color:#8b93a1', text: 'Блоки по 2 часа' }),
      ]),
    ]),
    fogRule(),
    matrix,
    legend,
    tip,
  ]);

  function paint(counts: number[][], mine: boolean[][], total: number): void {
    for (let b = 0; b < 12; b++) {
      for (let i = 0; i < days.length; i++) {
        const cell = cells[b]![i]!;
        const n = counts[b]![i]!;
        const k = total > 0 ? n / total : 0;
        cell.textContent = n > 0 ? String(n) : '';
        cell.style.background = n === 0 ? 'rgba(255,255,255,0.02)' : fill(k);
        cell.style.color = k > 0.5 ? '#1a1207' : n > 0 ? 'var(--color-accent-100)' : 'transparent';
        cell.style.boxShadow = mine[b]![i]! ? 'inset 0 0 0 1px rgba(125,153,99,0.9)' : 'none';
        const d = days[i]!;
        // Не `title`: родная подсказка перебивала бы свою. Скринридеру текст
        // при этом остаётся.
        cell.setAttribute('aria-label', `${shortDate(d.date, d.dow)}, ${blockLabel(b)} — ${n} из ${total}`);
      }
    }
    // Открытая подсказка (на телефоне она переживает правку часов) не должна
    // показывать состав, которого уже нет.
    if (hovered) show(hovered);
  }

  return { node, paint };
}
