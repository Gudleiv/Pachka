-- Создание пачки. Выполнить после schema.sql и подставить свои значения.
-- starts_at — дата и время старта: выводятся на странице над названием пачки.
-- Ещё не договорились — ставь null, тогда строки на странице не будет.
insert into public.packs (slug, title, game, cover_url, starts_at, window_start, window_days)
values (
  'valheim', 'Valheim', 'Valheim',
  'https://img2.storyblok.com/fit-in/1920x1080/f/157036/3200x1834/1391ca065a/valheim-campfire.png',
  '2026-09-25 19:00', '2026-09-18', 30
)
-- Повторный запуск не плодит пачку, а обновляет её карточку.
on conflict (slug) do update set
  title = excluded.title,
  game = excluded.game,
  cover_url = excluded.cover_url,
  starts_at = excluded.starts_at,
  window_start = excluded.window_start,
  window_days = excluded.window_days;

-- GUID приглашения — его и кидаем в Discord:
--   https://<юзер>.github.io/<репо>/#/join/<invite_code>
select slug, invite_code from public.packs where slug = 'valheim';
