import type { PackConfig } from '../data/pack';
import type { WorldPrefs } from '../data/valheim';

export interface Member {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

/** Часы доступности участника: { 'YYYY-MM-DD': [20, 21, 22, 23] }. */
export type Availability = Record<string, number[]>;

/**
 * Сообщение в ленте обсуждения: мод, правило, договорённость о старте.
 * В базе лежит в `mod_suggestions` — таблицу не переименовывали, чтобы
 * не потерять уже написанное.
 */
export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  text: string;
  likes: number;
  /** Текущий пользователь поддержал это сообщение. */
  mine: boolean;
  /** Автор правил текст после отправки. Когда именно — не показываем. */
  edited: boolean;
}

/** Всё, что нужно странице: конфиг пачки, участники и их ответы. */
export interface PackSnapshot {
  pack: PackConfig;
  me: Member;
  members: Member[];
  availability: Record<string, Availability>;
  prefs: Record<string, WorldPrefs>;
  posts: Post[];
}

export type AuthState =
  | { status: 'anonymous' }
  | { status: 'authenticated'; member: Member }
  /**
   * Вошёл в Discord, но ещё не состоит в этой пачке. `reason` заполнен, если
   * приглашение было, но вступить по нему не вышло — иначе причина отказа
   * теряется и экран выглядит так, будто ссылки не было вовсе.
   */
  | { status: 'not-a-member'; member: Member; reason: string | null };

export interface Backend {
  readonly kind: 'local' | 'supabase';
  /** Локальный режим не требует входа и не умеет Discord. */
  readonly needsAuth: boolean;

  /** Разбирает ответ OAuth-редиректа, если он есть в URL. */
  init(): Promise<void>;
  getAuthState(): Promise<AuthState>;
  /** Уводит на Discord; возврат — на ту же страницу. */
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  /** Вступление в пачку по GUID приглашения. */
  joinByInvite(inviteCode: string): Promise<void>;
  /** Приглашение, распознанное при загрузке или отложенное до входа. */
  pendingInvite(): string | null;

  load(): Promise<PackSnapshot>;
  saveAvailability(day: string, hours: number[]): Promise<void>;
  savePrefs(prefs: WorldPrefs): Promise<void>;
  addPost(text: string): Promise<Post>;
  /** Правка своего сообщения; чужие закрыты и в интерфейсе, и в RLS. */
  editPost(id: string, text: string): Promise<void>;
  deletePost(id: string): Promise<void>;
  togglePostVote(id: string, next: boolean): Promise<void>;
}
