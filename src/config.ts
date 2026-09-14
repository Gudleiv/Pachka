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

/**
 * Снимок адреса на момент загрузки модуля. Читать `location` позже нельзя:
 * supabase-js вырезает из него `?code=` сразу после обмена, а `cleanUrl()`
 * убирает остальное — приглашение к тому моменту уже не найти.
 */
const INITIAL_SEARCH = location.search;
const INITIAL_HASH = location.hash;

const INVITE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JOIN_RE = /\/join\/([^/?#]+)/i;

/** Приглашение из адреса: `?invite=<guid>` или `#/join/<guid>`. */
function rawInvite(): string | null {
  const q = new URLSearchParams(INITIAL_SEARCH).get('invite');
  const raw = q ?? JOIN_RE.exec(INITIAL_HASH)?.[1];
  if (!raw) return null;
  try {
    // Браузер процент-кодирует хеш: в сообщении об ошибке хочется видеть
    // исходную ссылку, а не `%3Cinvite_code%3E`.
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * GUID приглашения из адреса. Хеш-форма удобна тем, что GitHub Pages отдаёт
 * её без SPA-фолбэка.
 */
export function inviteFromUrl(): string | null {
  const raw = rawInvite();
  return raw && INVITE_RE.test(raw) ? raw.toLowerCase() : null;
}

/**
 * Ссылка-приглашение в адресе есть, но GUID в ней не настоящий — например,
 * в чат улетел шаблон вида `#/join/<invite_code>`. Без этой проверки такой
 * заход неотличим от захода вообще без приглашения.
 */
export function brokenInviteInUrl(): string | null {
  const raw = rawInvite();
  return raw && !INVITE_RE.test(raw) ? raw : null;
}

/**
 * Текст ошибки, с которой Supabase вернул нас после Discord. PKCE кладёт её
 * в query, неявный поток — в хеш; без этого сорванный вход выглядит просто
 * как «ты не в пачке».
 */
export function oauthErrorFromUrl(): string | null {
  for (const part of [INITIAL_SEARCH, INITIAL_HASH]) {
    const p = new URLSearchParams(part.replace(/^[?#]/, ''));
    const msg = p.get('error_description') ?? p.get('error');
    if (msg) return msg;
  }
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
