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
  /**
   * Дата и время старта, `YYYY-MM-DDTHH:MM`, или `null`, если ещё не
   * договорились. Часового пояса нет намеренно: как и часы доступности, это
   * настенное время — у всех в пачке одно и то же «в семь вечера».
   */
  startsAt: string | null;
  /** Первый день окна планирования, YYYY-MM-DD. */
  windowStart: string;
  windowDays: number;
}

export const FALLBACK_PACK: PackConfig = {
  id: 'valheim-demo',
  title: 'Valheim',
  game: 'Valheim',
  coverUrl:
    'https://img2.storyblok.com/fit-in/1920x1080/f/157036/3200x1834/1391ca065a/valheim-campfire.png',
  startsAt: '2026-09-25T19:00',
  windowStart: '2026-09-18',
  windowDays: 30,
};
