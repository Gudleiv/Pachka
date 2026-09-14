import { blockLabel, MON, type DayCell } from '../lib/dates';
import { el } from '../lib/dom';
import { fogRule, PANEL_CLASS } from './shared';

const ROW_STYLE = 'display:grid; grid-template-columns:78px repeat(var(--cols), minmax(20px,1fr)); gap:3px; min-width:790px';

/** Вечерние блоки подписаны контрастнее — по ним чаще всего и читают карту. */
function labelWeight(b: number): boolean {
  return b >= 8 && b <= 11;
}

function fill(k: number): string {
  return `rgba(200,160,106,${(0.08 + k * 0.72).toFixed(3)})`;
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

export function createHeatmap(days: DayCell[]): HeatmapView {
  const cells: HTMLElement[][] = [];
  const matrix = el('div', {
    style: 'display:flex; flex-direction:column; gap:3px; overflow-x:auto; padding-bottom:4px',
  });
  matrix.style.setProperty('--cols', String(days.length));

  const head = el('div', { style: ROW_STYLE }, [el('span')]);
  for (const d of days) {
    head.append(
      el('span', {
        style: `font-size:9px; text-align:center; color:${d.dow >= 5 ? '#c3c8d2' : '#6d7481'}`,
        text: String(d.date.getDate()),
      }),
    );
  }
  matrix.append(head);

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
        cell.title = `${d.date.getDate()} ${MON[d.date.getMonth()]}, ${blockLabel(b)} — ${n} из ${total}`;
      }
    }
  }

  return { node, paint };
}
