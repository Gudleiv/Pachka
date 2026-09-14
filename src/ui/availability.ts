import { shortDate, WD, MON, type DayCell } from '../lib/dates';
import { button, el } from '../lib/dom';
import { plural } from '../lib/plural';
import { ACCENT, fogRule, kicker, panelHeading, panelSub, PANEL_STYLE } from './shared';

export interface AvailabilityHandlers {
  /** Клик по дню: отметить с часами по умолчанию либо снять, если день уже активен. */
  pickDay(key: string): void;
  setHour(hour: number, on: boolean): void;
  applyPreset(dows: number[], hours: number[]): void;
  copyToSelected(): void;
  clearAll(): void;
}

export interface AvailabilityState {
  days: Record<string, number[]>;
  active: string;
}

export interface AvailabilityView {
  node: HTMLElement;
  paint(state: AvailabilityState): void;
}

const PRESETS: { label: string; dows: number[]; hours: number[] }[] = [
  { label: 'Пятницы с 20:00', dows: [4], hours: [20, 21, 22, 23] },
  { label: 'Выходные с 16:00', dows: [5, 6], hours: [16, 17, 18, 19, 20, 21, 22] },
  { label: 'Будни 21:00–00:00', dows: [0, 1, 2, 3, 4], hours: [21, 22, 23] },
];

const DEFAULT_HOURS = [20, 21, 22, 23];
export { DEFAULT_HOURS };

interface DayNode {
  cell: HTMLButtonElement;
  num: HTMLElement;
  sub: HTMLElement;
  dot: HTMLElement;
  day: DayCell;
}

export function createAvailability(
  days: DayCell[],
  windowText: string,
  tz: string,
  handlers: AvailabilityHandlers,
): AvailabilityView {
  const summary = el('span', { style: 'font-size:13px; color:var(--color-accent-300)' });

  const presetRow = el(
    'div',
    { style: 'display:flex; gap:8px; flex-wrap:wrap' },
    PRESETS.map((p) =>
      button(
        { class: 'btn btn-secondary', style: 'font-size:13px', text: p.label, on: { click: () => handlers.applyPreset(p.dows, p.hours) } },
      ),
    ),
  );
  presetRow.append(
    button({ class: 'btn btn-ghost', style: 'font-size:13px; margin-left:auto', text: 'Очистить всё', on: { click: () => handlers.clearAll() } }),
  );

  const headRow = el(
    'div',
    { style: 'display:grid; grid-template-columns:repeat(7, minmax(0,1fr)); gap:6px' },
    WD.map((w) =>
      el('span', { style: 'font-size:11px; letter-spacing:0.08em; color:#7b8390; text-align:center; padding-bottom:2px', text: w }),
    ),
  );

  // Календарь: недели с понедельника, первая добита пустыми ячейками.
  const dayNodes: DayNode[] = [];
  const weeksWrap = el('div', { style: 'display:flex; flex-direction:column; gap:6px' });
  const weekStyle = 'display:grid; grid-template-columns:repeat(7, minmax(0,1fr)); gap:6px';
  const spacer = () => el('div', { style: 'visibility:hidden; min-height:62px' });

  let week = el('div', { style: weekStyle });
  let col = 0;
  for (let i = 0; i < (days[0]?.dow ?? 0); i++, col++) week.append(spacer());

  for (const day of days) {
    const num = el('span', { style: 'font-family:var(--font-heading); font-size:15px' });
    const sub = el('span', { style: 'font-size:10px; letter-spacing:0.06em' });
    const dot = el('span', { style: 'position:absolute; right:8px; top:8px; width:6px; height:6px; border-radius:50%' });
    const cell = button(
      {
        style:
          'position:relative; display:flex; flex-direction:column; align-items:flex-start; gap:4px;' +
          ' padding:8px 9px 9px; min-height:62px; cursor:pointer; font:inherit; text-align:left;' +
          ' border-radius:var(--radius-sm); border:1px solid var(--color-divider);' +
          ' transition:background 120ms, border-color 120ms',
        on: { click: () => handlers.pickDay(day.key) },
      },
      [num, sub, dot],
    );
    dayNodes.push({ cell, num, sub, dot, day });
    week.append(cell);
    if (++col === 7) {
      weeksWrap.append(week);
      week = el('div', { style: weekStyle });
      col = 0;
    }
  }
  if (col > 0) {
    while (col++ < 7) week.append(spacer());
    weeksWrap.append(week);
  }

  // Редактор часов активного дня.
  const activeTitle = el('span', { style: 'font-family:var(--font-heading); font-size:16px' });
  const activeHint = el('span', { style: 'font-size:12px; color:#8b93a1' });
  const hourNodes: HTMLButtonElement[] = [];
  const hourGrid = el('div', { style: 'display:grid; grid-template-columns:repeat(12, minmax(0,1fr)); gap:4px' });

  /** Режим протяжки: true — красим, false — стираем, null — протяжки нет. */
  let drag: boolean | null = null;
  /** Мышь уже отработала pointerdown — гасим последующий click, иначе двойное переключение. */
  let handledByPointer = false;

  const endDrag = () => {
    drag = null;
  };

  for (let h = 0; h < 24; h++) {
    const on = () => hourNodes[h]!.dataset['on'] === '1';
    const btn = button({
      style: 'height:38px; cursor:pointer; font:inherit; font-size:11px; border-radius:4px; transition:background 90ms',
      text: String(h).padStart(2, '0'),
      on: {
        pointerdown: (e: PointerEvent) => {
          if (e.pointerType !== 'mouse') return;
          handledByPointer = true;
          drag = !on();
          handlers.setHour(h, drag);
        },
        pointerenter: () => {
          if (drag !== null) handlers.setHour(h, drag);
        },
        pointerup: endDrag,
        click: () => {
          // Тач и клавиатура: переключение по клику, мышь уже обработана.
          if (handledByPointer) {
            handledByPointer = false;
            return;
          }
          handlers.setHour(h, !on());
        },
      },
    });
    hourNodes.push(btn);
    hourGrid.append(btn);
  }
  hourGrid.addEventListener('pointerleave', endDrag);
  window.addEventListener('pointerup', endDrag);

  const editor = el(
    'div',
    {
      style:
        'display:flex; flex-direction:column; gap:10px; padding:16px; margin-top:4px;' +
        ' border:1px solid var(--color-accent-800); border-radius:var(--radius-sm); background:rgba(74,58,38,0.16)',
    },
    [
      el('div', { style: 'display:flex; align-items:baseline; gap:10px; flex-wrap:wrap' }, [
        activeTitle,
        activeHint,
        button({
          class: 'btn btn-ghost',
          style: 'font-size:12px; margin-left:auto',
          text: 'Эти часы — во все отмеченные дни',
          on: { click: () => handlers.copyToSelected() },
        }),
      ]),
      hourGrid,
      el('span', {
        style: 'font-size:11px; color:#7b8390',
        text: 'Тяните мышью по часам. Повторный клик по отмеченному дню снимает его целиком.',
      }),
    ],
  );

  const node = el('section', { style: PANEL_STYLE }, [
    el('div', { style: 'display:flex; align-items:flex-end; gap:14px; flex-wrap:wrap' }, [
      el('div', { style: 'margin-right:auto' }, [
        kicker('Первое'),
        panelHeading('Когда сможешь играть'),
        panelSub(`${windowText} · часы в вашем поясе ${tz}`),
      ]),
      summary,
    ]),
    fogRule(),
    presetRow,
    headRow,
    weeksWrap,
    editor,
  ]);

  function paint(state: AvailabilityState): void {
    for (const { cell, num, sub, dot, day } of dayNodes) {
      const hrs = state.days[day.key] ?? [];
      const on = hrs.length > 0;
      const isActive = state.active === day.key;
      const weekend = day.dow >= 5;

      cell.style.background = on ? 'rgba(200,160,106,0.16)' : 'rgba(255,255,255,0.025)';
      cell.style.borderColor = isActive ? ACCENT : on ? 'var(--color-accent-700)' : 'var(--color-divider)';
      cell.setAttribute('aria-pressed', on ? 'true' : 'false');
      num.textContent = String(day.date.getDate());
      num.style.color = on ? 'var(--color-accent-100)' : weekend ? '#c3c8d2' : '#9aa2b0';
      sub.textContent = on
        ? `${WD[day.dow]} · ${hrs.length} ч`
        : `${WD[day.dow]} ${MON[day.date.getMonth()]}`;
      sub.style.color = on ? 'var(--color-accent-300)' : '#6d7481';
      dot.style.background = on ? ACCENT : 'transparent';
    }

    const activeHrs = state.days[state.active] ?? [];
    for (let h = 0; h < 24; h++) {
      const btn = hourNodes[h]!;
      const on = activeHrs.includes(h);
      btn.dataset['on'] = on ? '1' : '0';
      btn.style.background = on ? 'rgba(200,160,106,0.34)' : 'rgba(255,255,255,0.04)';
      btn.style.border = `1px solid ${on ? 'var(--color-accent-600)' : 'var(--color-divider)'}`;
      btn.style.color = on ? 'var(--color-accent-100)' : '#7b8390';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    const act = days.find((d) => d.key === state.active) ?? days[0]!;
    activeTitle.textContent = shortDate(act.date, act.dow);
    activeHint.textContent = activeHrs.length ? `${activeHrs.length} ч выбрано` : 'выберите часы';

    const keys = Object.keys(state.days);
    const totalHours = keys.reduce((n, k) => n + (state.days[k]?.length ?? 0), 0);
    summary.textContent = keys.length
      ? `${keys.length} ${plural(keys.length, ['день', 'дня', 'дней'])} · ` +
        `${totalHours} ${plural(totalHours, ['час', 'часа', 'часов'])} отмечено`
      : 'Пока ничего не отмечено';
  }

  return { node, paint };
}
