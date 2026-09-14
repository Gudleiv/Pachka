-- Создание пачки. Выполнить после schema.sql и подставить свои значения.
insert into public.packs (slug, title, game, cover_url, window_start, window_days)
values ('valheim', 'Valheim', 'Valheim', null, '2026-09-18', 30)
on conflict (slug) do nothing;

-- GUID приглашения — его и кидаем в Discord:
--   https://<юзер>.github.io/<репо>/#/join/<invite_code>
select slug, invite_code from public.packs where slug = 'valheim';
