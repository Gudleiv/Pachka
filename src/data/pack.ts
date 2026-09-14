/**
 * Конфиг пачки. В этой версии создание пачек отсутствует: значения зашиты
 * и служат фолбэком, когда бэкенд не сконфигурирован. При работе через
 * Supabase эти же поля приезжают из таблицы `packs`.
 */
export interface PackConfig {
  id: string;
  title: string;
  game: string;
  coverUrl: string | null;
  /** Первый день окна планирования, YYYY-MM-DD. */
  windowStart: string;
  windowDays: number;
}

export const FALLBACK_PACK: PackConfig = {
  id: 'valheim-demo',
  title: 'Valheim',
  game: 'Valheim',
  coverUrl: null,
  windowStart: '2026-09-18',
  windowDays: 30,
};
