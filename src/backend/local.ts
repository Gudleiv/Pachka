import { FALLBACK_PACK, type PackConfig } from '../data/pack';
import { DEFAULT_PREFS, type WorldPrefs } from '../data/valheim';
import { buildSeed } from './seed';
import type { AuthState, Availability, Backend, Member, ModSuggestion, PackSnapshot } from './types';

const KEY = 'pachka.local.v1';
const ME: Member = { userId: 'me', displayName: 'Ты', avatarUrl: null };

interface Persisted {
  availability: Availability;
  prefs: WorldPrefs;
  ownMods: ModSuggestion[];
  votes: Record<string, boolean>;
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { availability: {}, prefs: DEFAULT_PREFS, ownMods: [], votes: {}, ...JSON.parse(raw) };
  } catch {
    // Приватный режим или заблокированное хранилище — работаем в памяти.
  }
  return { availability: {}, prefs: DEFAULT_PREFS, ownMods: [], votes: {} };
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

  async load(): Promise<PackSnapshot> {
    const seed = buildSeed(this.pack.windowStart, this.pack.windowDays);
    const mods = [...this.state.ownMods, ...seed.mods].map((m) => {
      const voted = this.state.votes[m.id];
      if (voted === undefined) return m;
      // Голос «за» уже учтён в seed-числе только для своих предложений.
      const base = m.mine ? m.likes - 1 : m.likes;
      return { ...m, likes: base + (voted ? 1 : 0), mine: voted };
    });

    return {
      pack: this.pack,
      me: ME,
      members: [...seed.members, ME],
      availability: { ...seed.availability, [ME.userId]: this.state.availability },
      prefs: { ...seed.prefs, [ME.userId]: this.state.prefs },
      mods,
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

  async addMod(text: string): Promise<ModSuggestion> {
    const mod: ModSuggestion = {
      id: `local-${Date.now()}`,
      authorId: ME.userId,
      authorName: ME.displayName,
      authorAvatar: null,
      text,
      likes: 1,
      mine: true,
    };
    this.state.ownMods.unshift(mod);
    this.state.votes[mod.id] = true;
    save(this.state);
    return mod;
  }

  async toggleModVote(id: string, next: boolean): Promise<void> {
    this.state.votes[id] = next;
    save(this.state);
  }
}
