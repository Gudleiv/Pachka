import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { PACK_SLUG, SUPABASE_ANON_KEY, SUPABASE_URL, cleanUrl, inviteFromUrl, redirectTarget } from '../config';
import type { PackConfig } from '../data/pack';
import { DEFAULT_PREFS, type WorldPrefs } from '../data/valheim';
import type { AuthState, Availability, Backend, Member, PackSnapshot, Post } from './types';

/** GUID приглашения переживает редирект на Discord через localStorage. */
const PENDING_INVITE = 'pachka.pendingInvite';

interface PackRow {
  id: string;
  slug: string;
  title: string;
  game: string;
  cover_url: string | null;
  window_start: string;
  window_days: number;
}

interface MemberRow {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
}

interface AvailabilityRow {
  user_id: string;
  day: string;
  hours: number[];
}

interface PrefsRow {
  user_id: string;
  combat: string;
  death: string;
  portals: string;
  raids: string;
  resources: string;
  fire: boolean;
  no_map: boolean;
}

interface PostRow {
  id: string;
  author_id: string;
  text: string;
  created_at: string;
  edited_at: string | null;
  mod_votes: { user_id: string }[];
}

function memberFromUser(user: User): Member {
  const meta = user.user_metadata ?? {};
  const name =
    (meta['full_name'] as string | undefined) ??
    (meta['name'] as string | undefined) ??
    (meta['user_name'] as string | undefined) ??
    'Викинг';
  return {
    userId: user.id,
    displayName: name,
    avatarUrl: (meta['avatar_url'] as string | undefined) ?? null,
  };
}

function packFromRow(row: PackRow): PackConfig {
  return {
    id: row.id,
    title: row.title,
    game: row.game,
    coverUrl: row.cover_url,
    windowStart: row.window_start,
    windowDays: row.window_days,
  };
}

/**
 * Боевой режим. Supabase закрывает обе дыры статического хостинга:
 * обмен OAuth-кода Discord на сессию идёт на его серверах (client secret
 * в репозиторий не попадает), а доступ к данным ограничен RLS-политиками.
 * Собственного бэкенда в проекте нет.
 */
export class SupabaseBackend implements Backend {
  readonly kind = 'supabase' as const;
  readonly needsAuth = true;

  private client: SupabaseClient;
  private pack: PackConfig | null = null;
  private invite: string | null = null;
  /** Кэш id участника: см. requireUserId(). */
  private userId: string | null = null;

  constructor() {
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  async init(): Promise<void> {
    const invite = inviteFromUrl();
    if (invite) {
      this.invite = invite;
      try {
        localStorage.setItem(PENDING_INVITE, invite);
      } catch {
        // Без хранилища приглашение отработает только в текущем заходе.
      }
    }
    // supabase-js сам обменивает `?code=` на сессию при detectSessionInUrl.
    await this.client.auth.getSession();
    if (location.search || location.hash) cleanUrl();
  }

  /**
   * Приглашение переживает уход на Discord: в `redirectTo` можно передать
   * только адрес из белого списка Supabase, без хеша, поэтому GUID ждёт
   * возвращения в localStorage.
   */
  pendingInvite(): string | null {
    if (this.invite) return this.invite;
    try {
      return localStorage.getItem(PENDING_INVITE);
    } catch {
      return null;
    }
  }

  private clearPendingInvite(): void {
    this.invite = null;
    try {
      localStorage.removeItem(PENDING_INVITE);
    } catch {
      // Нечего чистить.
    }
  }

  async getAuthState(): Promise<AuthState> {
    // Единственный за загрузку поход на /auth/v1/user: он проверяет токен
    // на сервере и приносит свежий профиль Discord.
    const { data } = await this.client.auth.getUser();
    if (!data.user) return { status: 'anonymous' };
    this.userId = data.user.id;
    const member = memberFromUser(data.user);

    let joinError: string | null = null;
    const invite = this.pendingInvite();
    if (invite) {
      // Вступление идемпотентно: повторный заход по ссылке ничего не ломает.
      const { error } = await this.client.rpc('join_pack', { p_invite: invite });
      if (error) joinError = error.message;
      else this.clearPendingInvite();
    }

    const pack = await this.resolvePack();
    if (!pack) return { status: 'not-a-member', member, reason: joinError };
    this.pack = pack;
    // Имя и аватар в Discord могли смениться — обновляем, не блокируя
    // загрузку. `.then()` обязателен: билдер postgrest ленивый и без него
    // запрос вообще не уходит.
    void this.client.rpc('sync_profile').then(undefined, () => {
      // Профиль не обновился — не повод ронять страницу.
    });
    return { status: 'authenticated', member };
  }

  /** Пачка участника: по слагу из конфига, иначе — единственная доступная. */
  private async resolvePack(): Promise<PackConfig | null> {
    const query = this.client.from('packs').select('*');
    const { data } = PACK_SLUG
      ? await query.eq('slug', PACK_SLUG).maybeSingle()
      : await query.limit(1).maybeSingle();
    return data ? packFromRow(data as PackRow) : null;
  }

  /** Название пачки для экрана входа — единственное, что видно до авторизации. */
  async invitePreview(invite: string): Promise<{ title: string; game: string } | null> {
    const { data, error } = await this.client.rpc('pack_preview', { p_invite: invite });
    if (error || !data) return null;
    const row = Array.isArray(data) ? data[0] : data;
    return row ? { title: row.title, game: row.game } : null;
  }

  async signIn(): Promise<void> {
    await this.client.auth.signInWithOAuth({
      provider: 'discord',
      // `scopes` заменяет умолчание Supabase целиком, а не дополняет его:
      // без `email` GoTrue не создаёт пользователя Discord и рвёт вход.
      options: { redirectTo: redirectTarget(), scopes: 'identify email' },
    });
  }

  async signOut(): Promise<void> {
    this.userId = null;
    this.pack = null;
    await this.client.auth.signOut();
  }

  async joinByInvite(inviteCode: string): Promise<void> {
    const { error } = await this.client.rpc('join_pack', { p_invite: inviteCode });
    if (error) throw new Error(error.message);
    this.clearPendingInvite();
  }

  private requirePack(): PackConfig {
    if (!this.pack) throw new Error('Пачка не загружена');
    return this.pack;
  }

  /**
   * Свой id. `getUser()` ходит в сеть на каждый вызов, а он нужен в каждой
   * записи — поэтому id берём из проверенного при входе кэша, а запасной
   * путь читает локальную сессию. Подлинность токена всё равно проверяет
   * база: в RLS-политиках стоит `auth.uid()`, а не то, что прислал клиент.
   */
  private async requireUserId(): Promise<string> {
    if (this.userId) return this.userId;
    const { data } = await this.client.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new Error('Нет сессии');
    this.userId = id;
    return id;
  }

  async load(): Promise<PackSnapshot> {
    const pack = this.requirePack();
    const userId = await this.requireUserId();

    const [membersRes, availRes, prefsRes, postsRes] = await Promise.all([
      this.client.from('pack_members').select('user_id, display_name, avatar_url').eq('pack_id', pack.id),
      this.client.from('availability').select('user_id, day, hours').eq('pack_id', pack.id),
      this.client.from('world_prefs').select('*').eq('pack_id', pack.id),
      this.client
        .from('mod_suggestions')
        .select('id, author_id, text, created_at, edited_at, mod_votes(user_id)')
        .eq('pack_id', pack.id)
        .order('created_at', { ascending: false }),
    ]);

    const members: Member[] = ((membersRes.data ?? []) as MemberRow[]).map((r) => ({
      userId: r.user_id,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
    }));
    const me = members.find((m) => m.userId === userId) ?? { userId, displayName: 'Ты', avatarUrl: null };

    const availability: Record<string, Availability> = {};
    for (const row of (availRes.data ?? []) as AvailabilityRow[]) {
      (availability[row.user_id] ??= {})[row.day] = row.hours ?? [];
    }

    const prefs: Record<string, WorldPrefs> = {};
    for (const row of (prefsRes.data ?? []) as PrefsRow[]) {
      prefs[row.user_id] = {
        combat: row.combat as WorldPrefs['combat'],
        death: row.death as WorldPrefs['death'],
        portals: row.portals as WorldPrefs['portals'],
        raids: row.raids as WorldPrefs['raids'],
        resources: row.resources as WorldPrefs['resources'],
        fire: row.fire,
        noMap: row.no_map,
      };
    }
    prefs[userId] ??= DEFAULT_PREFS;

    const byId = new Map(members.map((m) => [m.userId, m]));
    const posts: Post[] = ((postsRes.data ?? []) as PostRow[]).map((r) => ({
      id: r.id,
      authorId: r.author_id,
      authorName: byId.get(r.author_id)?.displayName ?? 'Участник',
      authorAvatar: byId.get(r.author_id)?.avatarUrl ?? null,
      text: r.text,
      likes: r.mod_votes.length,
      mine: r.mod_votes.some((v) => v.user_id === userId),
      edited: r.edited_at !== null,
    }));

    return { pack, me, members, availability, prefs, posts };
  }

  async saveAvailability(day: string, hours: number[]): Promise<void> {
    const pack = this.requirePack();
    const userId = await this.requireUserId();
    if (hours.length === 0) {
      await this.client.from('availability').delete().match({ pack_id: pack.id, user_id: userId, day });
      return;
    }
    await this.client
      .from('availability')
      .upsert(
        { pack_id: pack.id, user_id: userId, day, hours: [...hours].sort((a, b) => a - b) },
        { onConflict: 'pack_id,user_id,day' },
      );
  }

  async savePrefs(prefs: WorldPrefs): Promise<void> {
    const pack = this.requirePack();
    const userId = await this.requireUserId();
    await this.client.from('world_prefs').upsert(
      {
        pack_id: pack.id,
        user_id: userId,
        combat: prefs.combat,
        death: prefs.death,
        portals: prefs.portals,
        raids: prefs.raids,
        resources: prefs.resources,
        fire: prefs.fire,
        no_map: prefs.noMap,
      },
      { onConflict: 'pack_id,user_id' },
    );
  }

  async addPost(text: string): Promise<Post> {
    const pack = this.requirePack();
    const userId = await this.requireUserId();
    const { data, error } = await this.client
      .from('mod_suggestions')
      .insert({ pack_id: pack.id, author_id: userId, text })
      .select('id')
      .single();
    if (error || !data) throw new Error(error?.message ?? 'Не удалось отправить сообщение');

    const id = (data as { id: string }).id;
    // Автор автоматически поддерживает своё сообщение.
    await this.client.from('mod_votes').insert({ suggestion_id: id, user_id: userId });
    return { id, authorId: userId, authorName: 'Ты', authorAvatar: null, text, likes: 1, mine: true, edited: false };
  }

  /**
   * Пометку «отредактировано» ставит триггер в базе, а не клиент: иначе её
   * можно было бы не проставить, отправив запрос мимо интерфейса.
   */
  async editPost(id: string, text: string): Promise<void> {
    const userId = await this.requireUserId();
    const { error } = await this.client
      .from('mod_suggestions')
      .update({ text })
      .match({ id, author_id: userId });
    if (error) throw new Error(error.message);
  }

  async deletePost(id: string): Promise<void> {
    const userId = await this.requireUserId();
    const { error } = await this.client.from('mod_suggestions').delete().match({ id, author_id: userId });
    if (error) throw new Error(error.message);
  }

  async togglePostVote(id: string, next: boolean): Promise<void> {
    const userId = await this.requireUserId();
    if (next) await this.client.from('mod_votes').insert({ suggestion_id: id, user_id: userId });
    else await this.client.from('mod_votes').delete().match({ suggestion_id: id, user_id: userId });
  }
}
