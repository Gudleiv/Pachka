/**
 * Конфигурация сборки. Все значения публичные: anon-ключ Supabase рассчитан
 * на то, что он лежит в клиенте, доступ ограничивают RLS-политики в БД.
 * Пусто — страница поднимается в локальном демо-режиме без бэкенда.
 */
const env = import.meta.env;

export const SUPABASE_URL: string = (env.VITE_SUPABASE_URL ?? '').trim();
export const SUPABASE_ANON_KEY: string = (env.VITE_SUPABASE_ANON_KEY ?? '').trim();
/** Пачка по умолчанию для участника, пришедшего без ссылки-приглашения. */
export const PACK_SLUG: string = (env.VITE_PACK_SLUG ?? '').trim();

export const HAS_SUPABASE: boolean = SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '';

const INVITE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GUID приглашения из адреса: `?invite=<guid>` или `#/join/<guid>`.
 * Хеш-форма удобна тем, что GitHub Pages отдаёт её без SPA-фолбэка.
 */
export function inviteFromUrl(): string | null {
  const q = new URL(location.href).searchParams.get('invite');
  if (q && INVITE_RE.test(q)) return q.toLowerCase();
  const m = /#\/join\/([0-9a-f-]+)/i.exec(location.hash);
  if (m?.[1] && INVITE_RE.test(m[1])) return m[1].toLowerCase();
  return null;
}

/** Адрес возврата после Discord: та же страница без query и хеша. */
export function redirectTarget(): string {
  return location.origin + location.pathname;
}

/** Убирает служебные параметры из адресной строки, не перезагружая страницу. */
export function cleanUrl(): void {
  history.replaceState(null, '', redirectTarget());
}
