\set ON_ERROR_STOP on
\pset footer off

-- Пользователи и пачка
insert into auth.users values ('11111111-1111-1111-1111-111111111111','alice@x'),
                              ('22222222-2222-2222-2222-222222222222','bob@x'),
                              ('33333333-3333-3333-3333-333333333333','carol@x');
insert into public.packs (slug,title,game,window_start,window_days)
values ('valheim','Valheim','Valheim','2026-09-18',30);

\set alice '11111111-1111-1111-1111-111111111111'
\set bob   '22222222-2222-2222-2222-222222222222'
\set carol '33333333-3333-3333-3333-333333333333'
select invite_code as inv from public.packs where slug='valheim' \gset

\echo '--- 1. anon видит только превью пачки по GUID ---'
update auth._ctx set uid=null, jwt='{}';
set role anon;
select 'preview:' || coalesce((select title from public.pack_preview(:'inv')), 'НЕТ') as r;
select 'preview_by_wrong_guid:' || coalesce((select title from public.pack_preview('00000000-0000-0000-0000-000000000000')), 'НЕТ') as r;
do $$ declare n int; begin
  select count(*) into n from public.packs;
  raise notice 'ПРОВАЛ: anon прочитал packs (% строк)', n;
exception when insufficient_privilege then raise notice 'OK: anon к packs не допущен';
          when others then raise notice 'OK: anon к packs не допущен (%)', sqlstate; end $$;
reset role;

\echo '--- 2. alice входит по приглашению ---'
update auth._ctx set uid=:'alice', jwt='{"user_metadata":{"full_name":"Алиса","avatar_url":"https://cdn.discordapp.com/avatars/1/x.png"}}';
set role authenticated;
select 'join:' || (public.join_pack(:'inv') is not null) as r;
select 'alice_sees_packs:' || count(*) from public.packs;
select 'member_name:' || display_name || '/' || coalesce(avatar_url,'-') from public.pack_members;
select 'join_idempotent:' || (public.join_pack(:'inv') is not null) as r;
select 'members_after_2nd_join:' || count(*) from public.pack_members;
reset role;

\echo '--- 3. alice пишет свои ответы ---'
set role authenticated;
insert into public.availability (pack_id,user_id,day,hours)
  select id, :'alice', '2026-09-18', '{20,21,22,23}' from public.packs;
insert into public.world_prefs (pack_id,user_id,combat)
  select id, :'alice', 'hard' from public.packs;
insert into public.mod_suggestions (pack_id,author_id,text)
  select id, :'alice', 'PlantEverything' from public.packs;
insert into public.mod_votes (suggestion_id,user_id)
  select id, :'alice' from public.mod_suggestions;
select 'alice_wrote:' || (select count(*) from public.availability) || '/'
  || (select count(*) from public.world_prefs) || '/'
  || (select count(*) from public.mod_suggestions) || '/'
  || (select count(*) from public.mod_votes);
reset role;

\echo '--- 4. carol (не участник) не видит ничего ---'
update auth._ctx set uid=:'carol', jwt='{"user_metadata":{"full_name":"Кэрол"}}';
set role authenticated;
select 'carol_packs:'||count(*) from public.packs;
select 'carol_members:'||count(*) from public.pack_members;
select 'carol_availability:'||count(*) from public.availability;
select 'carol_prefs:'||count(*) from public.world_prefs;
select 'carol_mods:'||count(*) from public.mod_suggestions;
select 'carol_votes:'||count(*) from public.mod_votes;
reset role;

\echo '--- 5. carol не может вступить без приглашения ---'
set role authenticated;
do $$ begin
  insert into public.pack_members (pack_id,user_id,display_name)
    select id, '33333333-3333-3333-3333-333333333333', 'Кэрол' from public.packs;
  raise notice 'ПРОВАЛ: прямой insert в pack_members прошёл';
exception when others then raise notice 'OK: прямой insert отбит (%)', sqlstate; end $$;
reset role;

\echo '--- 6. bob вступает и видит доступность alice (тепловая карта) ---'
update auth._ctx set uid=:'bob', jwt='{"user_metadata":{"user_name":"bob"}}';
set role authenticated;
select 'bob_join:' || (public.join_pack(:'inv') is not null) as r;
select 'bob_sees_members:'||count(*) from public.pack_members;
select 'bob_sees_availability:'||count(*) from public.availability;
select 'bob_sees_prefs:'||count(*) from public.world_prefs;
select 'bob_sees_mods:'||count(*) from public.mod_suggestions;
select 'bob_sees_votes:'||count(*) from public.mod_votes;
reset role;

\echo '--- 7. bob не может подделать ответы alice ---'
set role authenticated;
do $$ begin
  insert into public.availability (pack_id,user_id,day,hours)
    select id, '11111111-1111-1111-1111-111111111111', '2026-09-20', '{1,2}' from public.packs;
  raise notice 'ПРОВАЛ: bob записал доступность за alice';
exception when others then raise notice 'OK: подделка доступности отбита (%)', sqlstate; end $$;
do $$ declare n int; begin
  update public.availability set hours='{0}' where user_id='11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  if n > 0 then raise notice 'ПРОВАЛ: bob изменил % строк alice', n;
  else raise notice 'OK: update чужой доступности затронул 0 строк'; end if;
end $$;
do $$ begin
  insert into public.mod_votes (suggestion_id,user_id)
    select id, '11111111-1111-1111-1111-111111111111' from public.mod_suggestions;
  raise notice 'ПРОВАЛ: bob проголосовал за alice';
exception when others then raise notice 'OK: голос за другого отбит (%)', sqlstate; end $$;
with v as (
  insert into public.mod_votes (suggestion_id,user_id)
  select id, '22222222-2222-2222-2222-222222222222' from public.mod_suggestions returning 1
) select 'bob_votes_own:' || count(*) from v;
reset role;

\echo '--- 8. ограничения данных ---'
update auth._ctx set uid=:'alice';
set role authenticated;
do $$ begin
  insert into public.availability (pack_id,user_id,day,hours)
    select id, '11111111-1111-1111-1111-111111111111', '2026-09-25', '{24}' from public.packs;
  raise notice 'ПРОВАЛ: час 24 принят';
exception when check_violation then raise notice 'OK: час вне 0..23 отбит'; end $$;
do $$ begin
  insert into public.world_prefs (pack_id,user_id,combat)
    select id, '11111111-1111-1111-1111-111111111111', 'impossible' from public.packs;
  raise notice 'ПРОВАЛ: несуществующий вариант боя принят';
exception when check_violation then raise notice 'OK: неизвестный вариант отбит'; end $$;
-- «Без порталов» добавили позже остальных вариантов — ограничение должно его пускать.
do $$ begin
  insert into public.world_prefs (pack_id,user_id,portals)
    select id, '11111111-1111-1111-1111-111111111111', 'none' from public.packs
    on conflict (pack_id,user_id) do update set portals = 'none';
  raise notice 'OK: вариант «Без порталов» принят';
exception when check_violation then raise notice 'ПРОВАЛ: вариант «Без порталов» отбит'; end $$;
reset role;

\echo '--- 9. правка и удаление своего сообщения ---'
update auth._ctx set uid=:'alice';
set role authenticated;
select 'edited_before:' || coalesce((select edited_at::text from public.mod_suggestions), 'нет');
update public.mod_suggestions set text='PlantEverything + грядки' where author_id=:'alice';
select 'alice_edit:' || text || '/' || (edited_at is not null) from public.mod_suggestions;
-- Автора и пачку правка не переписывает: их возвращает триггер.
update public.mod_suggestions set author_id=:'bob' where author_id=:'alice';
select 'author_pinned:' || (author_id = :'alice') from public.mod_suggestions;
reset role;

update auth._ctx set uid=:'bob';
set role authenticated;
do $$ declare n int; begin
  update public.mod_suggestions set text='теперь моё'
   where author_id <> '22222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  if n > 0 then raise notice 'ПРОВАЛ: bob переписал % чужих сообщений', n;
  else raise notice 'OK: правка чужого сообщения затронула 0 строк'; end if;
end $$;
do $$ declare n int; begin
  delete from public.mod_suggestions;
  get diagnostics n = row_count;
  if n > 0 then raise notice 'ПРОВАЛ: bob удалил % чужих сообщений', n;
  else raise notice 'OK: удаление чужого сообщения затронуло 0 строк'; end if;
end $$;
reset role;

update auth._ctx set uid=:'alice';
set role authenticated;
delete from public.mod_suggestions where author_id=:'alice';
select 'after_delete:' || (select count(*) from public.mod_suggestions) || '/'
  || (select count(*) from public.mod_votes);
reset role;

\echo '--- 10. аватар только с CDN Discord ---'
update auth._ctx set uid=:'alice',
  jwt='{"user_metadata":{"full_name":"Алиса","avatar_url":"https://evil.example/pixel.png"}}';
set role authenticated;
select 'jwt_avatar_dropped:' || coalesce(public.jwt_avatar_url(), 'нет');
select 'join_with_foreign_avatar:' || (public.join_pack(:'inv') is not null);
select 'stored_avatar:' || coalesce((select avatar_url from public.pack_members where user_id=:'alice'), 'нет');
do $$ begin
  update public.pack_members set avatar_url='https://evil.example/pixel.png' where user_id=auth.uid();
  raise notice 'ПРОВАЛ: чужой хост в аватаре принят';
exception when check_violation then raise notice 'OK: чужой хост в аватаре отбит'; end $$;
reset role;
