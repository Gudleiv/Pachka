-- Создание пачки. Выполнить после schema.sql и подставить свои значения.
insert into public.packs (slug, title, game, cover_url, window_start, window_days)
values (
  'valheim', 'Valheim', 'Valheim',
  'https://img2.storyblok.com/fit-in/1920x1080/f/157036/3200x1834/1391ca065a/valheim-campfire.png',
  '2026-09-18', 30
)
-- Повторный запуск не плодит пачку, а обновляет её карточку.
on conflict (slug) do update set
  title = excluded.title,
  game = excluded.game,
  cover_url = excluded.cover_url,
  window_start = excluded.window_start,
  window_days = excluded.window_days;

-- GUID приглашения — его и кидаем в Discord:
--   https://<юзер>.github.io/<репо>/#/join/<invite_code>
select slug, invite_code from public.packs where slug = 'valheim';
