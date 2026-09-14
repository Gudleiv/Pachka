import './styles.css';
import { createBackend } from './backend';
import type { SupabaseBackend } from './backend/supabase';
import { HAS_SUPABASE, inviteFromUrl } from './config';
import { FALLBACK_PACK } from './data/pack';
import { el } from './lib/dom';
import { mountApp } from './app';
import { createHeader, createNotice } from './ui/chrome';

const root = document.getElementById('app');
if (!root) throw new Error('Не найден контейнер #app');

function screen(...nodes: Node[]): void {
  root!.replaceChildren(
    createHeader(FALLBACK_PACK.game, null, null),
    el('main', { style: 'max-width:1120px; margin:0 auto; padding:60px 26px' }, nodes),
  );
}

/** Полоса-предупреждение о демо-режиме поверх страницы. */
function demoBanner(): HTMLElement {
  return el('div', {
    style:
      'padding:10px 26px; font-size:12px; color:#dcb98a; text-align:center;' +
      ' border-bottom:1px solid var(--color-divider); background:rgba(200,160,106,0.10)',
    text: 'Демо-режим: ответы пачки сгенерированы, твои — сохраняются только в этом браузере. Вход через Discord появится после настройки Supabase.',
  });
}

async function main(): Promise<void> {
  const backend = await createBackend();
  await backend.init();

  if (!backend.needsAuth) {
    const snapshot = await backend.load();
    root!.append(demoBanner());
    mountApp(root!, backend, snapshot);
    return;
  }

  const invite = inviteFromUrl();
  const auth = await backend.getAuthState();

  if (auth.status === 'anonymous') {
    const preview = invite ? await (backend as SupabaseBackend).invitePreview(invite) : null;
    screen(
      createNotice({
        title: preview ? `Тебя зовут в пачку: ${preview.title}` : 'Вход в пачку',
        text: invite
          ? 'Войди через Discord — и попадёшь в опрос сбора. Ссылка-приглашение уже распознана.'
          : 'Опрос открывается только по ссылке-приглашению. Попроси её у того, кто собирает пачку, либо войди, если уже состоишь в ней.',
        action: { label: 'Войти через Discord', onClick: () => void backend.signIn() },
      }),
    );
    return;
  }

  if (auth.status === 'not-a-member') {
    screen(
      createNotice({
        title: 'Нужна ссылка-приглашение',
        text: `${auth.member.displayName}, ты вошёл через Discord, но не состоишь ни в одной пачке. ` +
          'Открой ссылку с GUID приглашения — она добавит тебя в опрос.',
        action: { label: 'Выйти', onClick: () => void backend.signOut().then(() => location.reload()) },
      }),
    );
    return;
  }

  const snapshot = await backend.load();
  mountApp(root!, backend, snapshot);
}

main().catch((err: unknown) => {
  const detail = err instanceof Error ? err.message : String(err);
  screen(
    createNotice({
      title: 'Не удалось открыть опрос',
      text: HAS_SUPABASE
        ? `Бэкенд не ответил: ${detail}`
        : `Страница не загрузилась: ${detail}`,
      action: { label: 'Обновить', onClick: () => location.reload() },
    }),
  );
});
