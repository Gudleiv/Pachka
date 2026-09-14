import { buildDayList } from '../lib/dates';
import { DEFAULT_PREFS, type WorldPrefs } from '../data/valheim';
import type { Availability, Member, ModSuggestion } from './types';

interface SeedMember {
  name: string;
  /** Общая «свободность» участника, 0…1. */
  f: number;
  prefs: WorldPrefs;
}

const SEED_MEMBERS: SeedMember[] = [
  { name: 'Бьорн', f: 0.95, prefs: { combat: 'hard', death: 'normal', portals: 'normal', raids: 'more', resources: 'x1', fire: false, noMap: false } },
  { name: 'Сигурд', f: 0.8, prefs: { combat: 'normal', death: 'easy', portals: 'items', raids: 'normal', resources: 'x15', fire: false, noMap: false } },
  { name: 'Хельга', f: 0.75, prefs: { combat: 'normal', death: 'normal', portals: 'afterfirst', raids: 'normal', resources: 'x15', fire: false, noMap: false } },
  { name: 'Рагнар', f: 0.65, prefs: { combat: 'easy', death: 'easy', portals: 'items', raids: 'less', resources: 'x2', fire: false, noMap: false } },
  { name: 'Астрид', f: 0.85, prefs: { combat: 'hard', death: 'hard', portals: 'boss', raids: 'more', resources: 'x1', fire: true, noMap: false } },
  { name: 'Ивар', f: 0.55, prefs: DEFAULT_PREFS },
  { name: 'Фрейдис', f: 0.7, prefs: { combat: 'normal', death: 'normal', portals: 'afterfirst', raids: 'normal', resources: 'x15', fire: false, noMap: false } },
  { name: 'Торвальд', f: 0.6, prefs: { combat: 'easy', death: 'normal', portals: 'normal', raids: 'normal', resources: 'x1', fire: false, noMap: true } },
  { name: 'Гуннар', f: 0.45, prefs: { combat: 'hard', death: 'easy', portals: 'items', raids: 'more', resources: 'x2', fire: false, noMap: false } },
];

/** Детерминированный псевдослучайный хеш — тот же, что в прототипе дизайна. */
function rnd(a: number, b: number, c: number): number {
  const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Вес двухчасового блока: вечер плотный, ночь и утро — редкие. */
function blockWeight(b: number): number {
  if (b === 9 || b === 10) return 1;
  if (b === 8 || b === 11) return 0.8;
  if (b === 0) return 0.35;
  if (b === 7) return 0.5;
  return 0.06;
}

function dowWeight(dow: number): number {
  if (dow >= 5) return 1;
  if (dow === 4) return 0.9;
  return 0.45;
}

export interface SeedData {
  members: Member[];
  availability: Record<string, Availability>;
  prefs: Record<string, WorldPrefs>;
  mods: ModSuggestion[];
}

/**
 * Демо-наполнение для локального режима: девять участников с синтетической,
 * но детерминированной доступностью. В режиме Supabase не используется.
 */
export function buildSeed(windowStart: string, windowDays: number): SeedData {
  const days = buildDayList(windowStart, windowDays);
  const members: Member[] = [];
  const availability: Record<string, Availability> = {};
  const prefs: Record<string, WorldPrefs> = {};

  SEED_MEMBERS.forEach((m, i) => {
    const userId = `seed-${i + 1}`;
    members.push({ userId, displayName: m.name, avatarUrl: null });
    prefs[userId] = m.prefs;

    const own: Availability = {};
    for (const d of days) {
      const hours: number[] = [];
      for (let b = 0; b < 12; b++) {
        const p = blockWeight(b) * dowWeight(d.dow) * m.f;
        if (rnd(i + 1, d.date.getDate() + d.date.getMonth() * 40, b + 1) < p) {
          hours.push(b * 2, b * 2 + 1);
        }
      }
      if (hours.length) own[d.key] = hours;
    }
    availability[userId] = own;
  });

  const mods: ModSuggestion[] = [
    { id: 'seed-mod-1', authorId: 'seed-2', authorName: 'Сигурд', authorAvatar: null, text: 'PlantEverything — грядки для всех семян и деревьев, чтобы база не выглядела как вырубка.', likes: 4, mine: false },
    { id: 'seed-mod-2', authorId: 'seed-3', authorName: 'Хельга', authorAvatar: null, text: 'EquipmentAndQuickSlots: три быстрых слота под еду. Без него вечер уходит в инвентарь.', likes: 3, mine: false },
    { id: 'seed-mod-3', authorId: 'seed-1', authorName: 'Бьорн', authorAvatar: null, text: 'Только ванилла, никаких модов. Десятый заход — пройдём как есть.', likes: 1, mine: false },
  ];

  return { members, availability, prefs, mods };
}
