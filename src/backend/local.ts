import { FALLBACK_PACK, type PackConfig } from '../data/pack';
import { DEFAULT_PREFS, type WorldPrefs } from '../data/valheim';
import { buildSeed } from './seed';
import type { AuthState, Availability, Backend, Member, PackSnapshot, Post } from './types';

const KEY = 'pachka.local.v1';
const ME: Member = { userId: 'me', displayName: 'Ты', avatarUrl: null };

interface Persisted {
  availability: Availability;
  prefs: WorldPrefs;
  ownPosts: Post[];
  votes: Record<string, boolean>;
}

function load(): Persisted {
  const empty: Persisted = { availability: {}, prefs: DEFAULT_PREFS, ownPosts: [], votes: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const saved = JSON.parse(raw) as Partial<Persisted> & { ownMods?: Post[] };
    // До ленты обсуждения свои записи лежали в ownMods — переносим их.
    // …а пометки правки тогда не существовало — считаем такие записи нетронутыми.
    const ownPosts = (saved.ownPosts ?? saved.ownMods ?? []).map((p) => ({ ...p, edited: p.edited === true }));
    return { ...empty, ...saved, ownPosts };
  } catch {
    // Приватный режим или заблокированное хранилище — работаем в памяти.
  }
  return empty;
}

function save(state: Persisted): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Не блокируем интерфейс, если сохранить не удалось.
  }
}

/**
 * Локальный режим: ответы пачки — демо-данные, свои ответы лежат в
 * localStorage. Нужен, чтобы страница работала на GitHub Pages без бэкенда;
 * данные не покидают браузер и не видны другим участникам.
 */
export class LocalBackend implements Backend {
  readonly kind = 'local' as const;
  readonly needsAuth = false;

  private state: Persisted = load();
  private pack: PackConfig = FALLBACK_PACK;

  async init(): Promise<void> {}

  async getAuthState(): Promise<AuthState> {
    return { status: 'authenticated', member: ME };
  }

  async signIn(): Promise<void> {}
  async signOut(): Promise<void> {}
  async joinByInvite(): Promise<void> {}
  /** В демо-режиме приглашений нет: пачка одна и она локальная. */
  pendingInvite(): string | null {
    return null;
  }

  async load(): Promise<PackSnapshot> {
    const seed = buildSeed(this.pack.windowStart, this.pack.windowDays);
    const posts = [...this.state.ownPosts, ...seed.posts].map((p) => {
      const voted = this.state.votes[p.id];
      if (voted === undefined) return p;
      // Голос «за» уже учтён в seed-числе только для своих сообщений.
      const base = p.mine ? p.likes - 1 : p.likes;
      return { ...p, likes: base + (voted ? 1 : 0), mine: voted };
    });

    return {
      pack: this.pack,
      me: ME,
      members: [...seed.members, ME],
      availability: { ...seed.availability, [ME.userId]: this.state.availability },
      prefs: { ...seed.prefs, [ME.userId]: this.state.prefs },
      posts,
    };
  }

  async saveAvailability(day: string, hours: number[]): Promise<void> {
    if (hours.length) this.state.availability[day] = [...hours].sort((a, b) => a - b);
    else delete this.state.availability[day];
    save(this.state);
  }

  async savePrefs(prefs: WorldPrefs): Promise<void> {
    this.state.prefs = prefs;
    save(this.state);
  }

  async addPost(text: string): Promise<Post> {
    const post: Post = {
      id: `local-${Date.now()}`,
      authorId: ME.userId,
      authorName: ME.displayName,
      authorAvatar: null,
      text,
      likes: 1,
      mine: true,
      edited: false,
    };
    this.state.ownPosts.unshift(post);
    this.state.votes[post.id] = true;
    save(this.state);
    return post;
  }

  /** Править можно только своё: сид-сообщения демо-ленты не свои. */
  async editPost(id: string, text: string): Promise<void> {
    this.state.ownPosts = this.state.ownPosts.map((p) =>
      p.id === id ? { ...p, text, edited: true } : p,
    );
    save(this.state);
  }

  async deletePost(id: string): Promise<void> {
    this.state.ownPosts = this.state.ownPosts.filter((p) => p.id !== id);
    delete this.state.votes[id];
    save(this.state);
  }

  async togglePostVote(id: string, next: boolean): Promise<void> {
    this.state.votes[id] = next;
    save(this.state);
  }
}
