-- Пачка — схема БД для Supabase.
-- Выполняется один раз в SQL Editor проекта.
--
-- Модель доступа: страница статическая и полностью публичная, поэтому вся
-- защита живёт здесь. Анонимному ключу доступно ровно две вещи: узнать
-- название пачки по GUID приглашения и вступить в неё после входа в Discord.
-- Всё остальное закрыто RLS и ограничено пачками, в которых состоит участник.

-- ─────────────────────────── таблицы ───────────────────────────

create table if not exists public.packs (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  game          text not null,
  cover_url     text,
  -- Момент старта, без часового пояса: у пачки одно «в семь вечера» на всех,
  -- как и часы доступности. Пусто — значит ещё не договорились.
  starts_at     timestamp,
  window_start  date not null,
  window_days   int  not null default 30 check (window_days between 1 and 92),
  -- GUID приглашения: попадает в ссылку, которую кидают в Discord.
  invite_code   uuid not null unique default gen_random_uuid(),
  created_at    timestamptz not null default now()
);

-- Пачки, заведённые до появления старта: `create table if not exists` выше
-- колонку в них не добавит.
alter table public.packs add column if not exists starts_at timestamp;

create table if not exists public.pack_members (
  pack_id       uuid not null references public.packs(id) on delete cascade,
  user_id       uuid not null references auth.users(id)   on delete cascade,
  -- Денормализованный профиль Discord: чтобы читать имена участников,
  -- не открывая клиенту доступ к auth.users.
  display_name  text not null,
  avatar_url    text,
  joined_at     timestamptz not null default now(),
  primary key (pack_id, user_id)
);

-- Свою строку участник правит напрямую (members_update_own), поэтому адрес
-- аватара ограничен не только в jwt_avatar_url(), но и здесь.
alter table public.pack_members drop constraint if exists pack_members_avatar_host;
alter table public.pack_members add constraint pack_members_avatar_host
  check (avatar_url is null or starts_with(avatar_url, 'https://cdn.discordapp.com/'));

create table if not exists public.availability (
  pack_id     uuid not null,
  user_id     uuid not null,
  day         date not null,
  hours       smallint[] not null default '{}',
  updated_at  timestamptz not null default now(),
  primary key (pack_id, user_id, day),
  foreign key (pack_id, user_id) references public.pack_members(pack_id, user_id) on delete cascade,
  constraint availability_hours_range check (
    hours <@ '{0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23}'::smallint[]
  )
);

create table if not exists public.world_prefs (
  pack_id     uuid not null,
  user_id     uuid not null,
  combat      text not null default 'normal' check (combat    in ('easy','normal','hard','vhard')),
  death       text not null default 'normal' check (death     in ('easy','normal','hard')),
  portals     text not null default 'normal' check (portals   in ('items','afterfirst','normal','boss')),
  raids       text not null default 'normal' check (raids     in ('less','normal','more')),
  resources   text not null default 'x15'    check (resources in ('x2','x15','x1')),
  fire        boolean not null default false,
  no_map      boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (pack_id, user_id),
  foreign key (pack_id, user_id) references public.pack_members(pack_id, user_id) on delete cascade
);

-- Лента обсуждения: моды, правила, договорённости о старте.
create table if not exists public.mod_suggestions (
  id          uuid primary key default gen_random_uuid(),
  pack_id     uuid not null references public.packs(id)  on delete cascade,
  author_id   uuid not null references auth.users(id)    on delete cascade,
  text        text not null check (char_length(btrim("text")) between 1 and 500),
  created_at  timestamptz not null default now(),
  -- Время правки нужно только как флаг «отредактировано»: дату не показываем.
  edited_at   timestamptz
);

create table if not exists public.mod_votes (
  suggestion_id uuid not null references public.mod_suggestions(id) on delete cascade,
  user_id       uuid not null references auth.users(id)             on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (suggestion_id, user_id)
);

create index if not exists availability_pack_idx     on public.availability(pack_id);
create index if not exists mod_suggestions_pack_idx  on public.mod_suggestions(pack_id, created_at desc);

-- ─────────────────────── вспомогательные функции ───────────────────────

-- SECURITY DEFINER, иначе политика на pack_members рекурсивно вызовет саму себя.
create or replace function public.is_pack_member(p_pack uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.pack_members m
    where m.pack_id = p_pack and m.user_id = auth.uid()
  );
$$;

-- Имя из профиля Discord; Supabase кладёт его в user_metadata токена.
create or replace function public.jwt_display_name()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'name', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'user_name', ''),
    'Викинг'
  );
$$;

-- Аватар берём только с CDN Discord. `user_metadata` участник переписывает
-- сам (GoTrue отдаёт его на запись владельцу токена), а картинку по этому
-- адресу грузит браузер каждого в пачке — чужой хост там ни к чему.
create or replace function public.jwt_avatar_url()
returns text
language sql
stable
as $$
  select case when starts_with(u, 'https://cdn.discordapp.com/') then u end
  from (select nullif(auth.jwt() -> 'user_metadata' ->> 'avatar_url', '') as u) t;
$$;

-- Пометку правки ставит база, а не клиент: запрос мимо интерфейса иначе
-- переписал бы текст молча. Заодно прибиты поля, которые правке не подлежат.
create or replace function public.touch_mod_suggestion()
returns trigger
language plpgsql
as $$
begin
  new.id         := old.id;
  new.pack_id    := old.pack_id;
  new.author_id  := old.author_id;
  new.created_at := old.created_at;
  if new.text is distinct from old.text then
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;
  return new;
end;
$$;

drop trigger if exists mod_suggestions_touch on public.mod_suggestions;
create trigger mod_suggestions_touch
  before update on public.mod_suggestions
  for each row execute function public.touch_mod_suggestion();

-- ─────────────────────────── RPC ───────────────────────────

-- Единственное, что видно до входа: название пачки на экране приглашения.
-- Перебор GUID'ов бесполезен — угадать uuid v4 нельзя.
create or replace function public.pack_preview(p_invite uuid)
returns table (title text, game text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.title, p.game from public.packs p where p.invite_code = p_invite;
$$;

-- Вступление в пачку по GUID приглашения. Идемпотентно: повторный заход по
-- ссылке просто обновляет имя и аватар из Discord.
create or replace function public.join_pack(p_invite uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_pack uuid;
begin
  if auth.uid() is null then
    raise exception 'Нужен вход' using errcode = '28000';
  end if;

  select id into v_pack from public.packs where invite_code = p_invite;
  if v_pack is null then
    raise exception 'Приглашение не найдено' using errcode = 'no_data_found';
  end if;

  insert into public.pack_members (pack_id, user_id, display_name, avatar_url)
  values (v_pack, auth.uid(), public.jwt_display_name(), public.jwt_avatar_url())
  on conflict (pack_id, user_id) do update
    set display_name = excluded.display_name,
        avatar_url   = excluded.avatar_url;

  return v_pack;
end;
$$;

-- Подтягивает свежие имя и аватар Discord во все пачки участника.
create or replace function public.sync_profile()
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update public.pack_members
     set display_name = public.jwt_display_name(),
         avatar_url   = public.jwt_avatar_url()
   where user_id = auth.uid();
$$;

revoke all on function public.pack_preview(uuid) from public;
revoke all on function public.join_pack(uuid)    from public;
revoke all on function public.sync_profile()     from public;
grant execute on function public.pack_preview(uuid) to anon, authenticated;
grant execute on function public.join_pack(uuid)    to authenticated;
grant execute on function public.sync_profile()     to authenticated;

-- ─────────────────────── права на таблицы ───────────────────────
-- Supabase выдаёт их новым таблицам через default privileges; прописываем
-- явно, чтобы схема не зависела от настроек конкретного проекта.

grant usage on schema public to anon, authenticated;

grant select                         on public.packs           to authenticated;
grant select, update, delete         on public.pack_members    to authenticated;
grant select, insert, update, delete on public.availability    to authenticated;
grant select, insert, update, delete on public.world_prefs     to authenticated;
grant select, insert, update, delete on public.mod_suggestions to authenticated;
grant select, insert, delete         on public.mod_votes       to authenticated;

-- ─────────────────────────── RLS ───────────────────────────

alter table public.packs           enable row level security;
alter table public.pack_members    enable row level security;
alter table public.availability    enable row level security;
alter table public.world_prefs     enable row level security;
alter table public.mod_suggestions enable row level security;
alter table public.mod_votes       enable row level security;

-- packs: видна только своя пачка; создаются они вручную в консоли.
drop policy if exists packs_select on public.packs;
create policy packs_select on public.packs
  for select to authenticated using (public.is_pack_member(id));

-- pack_members: участники видят друг друга, правят только свою строку.
drop policy if exists members_select on public.pack_members;
create policy members_select on public.pack_members
  for select to authenticated using (public.is_pack_member(pack_id));

drop policy if exists members_update_own on public.pack_members;
create policy members_update_own on public.pack_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists members_delete_own on public.pack_members;
create policy members_delete_own on public.pack_members
  for delete to authenticated using (user_id = auth.uid());
-- INSERT напрямую запрещён: вступление идёт только через join_pack().

-- availability: читает вся пачка (из этого строится тепловая карта),
-- пишет каждый только за себя.
drop policy if exists availability_select on public.availability;
create policy availability_select on public.availability
  for select to authenticated using (public.is_pack_member(pack_id));

drop policy if exists availability_write on public.availability;
create policy availability_write on public.availability
  for all to authenticated
  using (user_id = auth.uid() and public.is_pack_member(pack_id))
  with check (user_id = auth.uid() and public.is_pack_member(pack_id));

-- world_prefs: так же — голоса видны всем, правит каждый свой.
drop policy if exists prefs_select on public.world_prefs;
create policy prefs_select on public.world_prefs
  for select to authenticated using (public.is_pack_member(pack_id));

drop policy if exists prefs_write on public.world_prefs;
create policy prefs_write on public.world_prefs
  for all to authenticated
  using (user_id = auth.uid() and public.is_pack_member(pack_id))
  with check (user_id = auth.uid() and public.is_pack_member(pack_id));

-- mod_suggestions: лента общая, автор может поправить и убрать своё сообщение.
drop policy if exists mods_select on public.mod_suggestions;
create policy mods_select on public.mod_suggestions
  for select to authenticated using (public.is_pack_member(pack_id));

drop policy if exists mods_insert on public.mod_suggestions;
create policy mods_insert on public.mod_suggestions
  for insert to authenticated
  with check (author_id = auth.uid() and public.is_pack_member(pack_id));

drop policy if exists mods_update_own on public.mod_suggestions;
create policy mods_update_own on public.mod_suggestions
  for update to authenticated
  using (author_id = auth.uid() and public.is_pack_member(pack_id))
  with check (author_id = auth.uid());

drop policy if exists mods_delete_own on public.mod_suggestions;
create policy mods_delete_own on public.mod_suggestions
  for delete to authenticated using (author_id = auth.uid());

-- mod_votes: один голос на человека — это гарантирует первичный ключ.
drop policy if exists votes_select on public.mod_votes;
create policy votes_select on public.mod_votes
  for select to authenticated using (
    exists (select 1 from public.mod_suggestions s
             where s.id = suggestion_id and public.is_pack_member(s.pack_id))
  );

drop policy if exists votes_write on public.mod_votes;
create policy votes_write on public.mod_votes
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.mod_suggestions s
                 where s.id = suggestion_id and public.is_pack_member(s.pack_id))
  );
