export const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const;
export const MON = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'] as const;
export const MON_FULL = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
] as const;

export interface DayCell {
  /** YYYY-MM-DD */
  key: string;
  date: Date;
  /** 0 = понедельник … 6 = воскресенье. */
  dow: number;
}

export function dayKey(d: Date): string {
  return (
    d.getFullYear() +
    '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + String(d.getDate()).padStart(2, '0')
  );
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

/** Окно планирования: `days` подряд идущих дат начиная с `startKey`. */
export function buildDayList(startKey: string, days: number): DayCell[] {
  const start = parseDayKey(startKey);
  const out: DayCell[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    out.push({ key: dayKey(d), date: d, dow: (d.getDay() + 6) % 7 });
  }
  return out;
}

/** «18 сен, пт» — заголовок редактора часов. */
export function shortDate(d: Date, dow: number): string {
  return `${d.getDate()} ${MON[d.getMonth()]}, ${WD[dow]}`;
}

/** «18 сентября — 17 октября 2026» — подпись окна планирования. */
export function windowLabel(list: DayCell[]): string {
  const first = list[0], last = list[list.length - 1];
  if (!first || !last) return '';
  return `${first.date.getDate()} ${MON_FULL[first.date.getMonth()]} — ` +
    `${last.date.getDate()} ${MON_FULL[last.date.getMonth()]} ${last.date.getFullYear()}`;
}

/**
 * «25 сен 2026 19:00» — момент старта пачки. Значение наивное: и в базе, и
 * здесь это настенные часы, как день с часами доступности, поэтому разбираем
 * строку сами, а не через `Date` — иначе браузер сдвинет её на свой пояс.
 * Ничего не похожего на дату со временем на страницу не пускаем.
 */
export function startLabel(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  const [, y, mon, day, hh, mm] = m;
  const month = MON[Number(mon) - 1];
  if (!month) return null;
  return `${Number(day)} ${month} ${y} ${hh}:${mm}`;
}

/** Метка блока тепловой карты: «20:00–22:00». */
export function blockLabel(b: number): string {
  return `${String(b * 2).padStart(2, '0')}:00–${String((b * 2 + 2) % 24).padStart(2, '0')}:00`;
}

export function tzLabel(): string {
  const off = -new Date().getTimezoneOffset() / 60;
  const sign = off >= 0 ? '+' : '−';
  const abs = Math.abs(off);
  const hh = Math.floor(abs);
  const mm = Math.round((abs - hh) * 60);
  return 'GMT' + sign + hh + (mm ? ':' + String(mm).padStart(2, '0') : '');
}

export function tzZone(): string {
  try {
    return (Intl.DateTimeFormat().resolvedOptions().timeZone || '').replace(/_/g, ' ');
  } catch {
    return '';
  }
}
