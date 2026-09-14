// Формулировки модификаторов мира взяты из русской локализации Valheim.
// Менять их нельзя — единственный кастомный пункт помечен ниже.

export type CombatId = 'easy' | 'normal' | 'hard' | 'vhard';
export type DeathId = 'easy' | 'normal' | 'hard';
export type PortalsId = 'items' | 'afterfirst' | 'normal' | 'boss';
export type RaidsId = 'less' | 'normal' | 'more';
export type ResourcesId = 'x2' | 'x15' | 'x1';

export interface WorldOption<Id extends string> {
  id: Id;
  label: string;
  note: string;
  /** Нормированный вес варианта для расчёта душноты (0…1). */
  w: number;
}

export const COMBAT: WorldOption<CombatId>[] = [
  { id: 'easy', label: 'Легко', note: 'Враги слабее, чем в обычном режиме.', w: 0.15 },
  { id: 'normal', label: 'Обычная игра', note: 'Враги ведут себя, как в обычном режиме.', w: 0.45 },
  { id: 'hard', label: 'Сложно', note: 'Враги сильнее, чем в обычном режиме.', w: 0.75 },
  { id: 'vhard', label: 'Ужасно сложно', note: 'Враги намного сильнее, чем в обычном режиме.', w: 1 },
];

export const DEATH: WorldOption<DeathId>[] = [
  { id: 'easy', label: 'Легко', note: 'Все вещи сбрасываются, а навыки ухудшаются меньше, чем в обычном режиме.', w: 0.2 },
  { id: 'normal', label: 'Обычная игра', note: 'Все вещи сбрасываются, а навыки ухудшаются, как в обычном режиме.', w: 0.55 },
  { id: 'hard', label: 'Сложно', note: 'Снаряжение сбрасывается, а остальные вещи в сумке безвозвратно теряются. Навыки ухудшаются сильнее.', w: 1 },
];

export const PORTALS: WorldOption<PortalsId>[] = [
  { id: 'items', label: 'Перемещение предметов', note: 'Позволяет брать с собой в порталы все вещи, что сильно облегчает игру и противоречит ее оригинальной задумке.', w: 0 },
  // Кастомная договорённость пачки: в игре такого пункта нет, это соглашение, а не настройка сервера.
  { id: 'afterfirst', label: 'Перемещение предметов после первого путешествия', note: 'За первым металлом/ценностью едем сами, потом порталы открыты (условная договоренность).', w: 0.3 },
  { id: 'normal', label: 'Обычная игра', note: 'Порталы работают, как в обычном режиме: металлы через них не проходят.', w: 0.65 },
  { id: 'boss', label: 'Без порталов с боссами', note: 'Вы не сможете использовать порталы или выходить из подземелий боссов, пока босс активен.', w: 1 },
];

export const RAIDS: WorldOption<RaidsId>[] = [
  { id: 'less', label: 'Меньше', note: 'Набеги случаются реже, чем в обычном режиме.', w: 0 },
  { id: 'normal', label: 'Обычная игра', note: 'Набеги случаются, как в обычном режиме.', w: 0.5 },
  { id: 'more', label: 'Больше', note: 'Набеги случаются чаще, чем в обычном режиме.', w: 1 },
];

export const RESOURCES: WorldOption<ResourcesId>[] = [
  { id: 'x2', label: '2x', note: 'Вдвое больше ресурсов, чем в обычном режиме.', w: 0 },
  { id: 'x15', label: '1,5x', note: 'В полтора раза больше ресурсов, чем в обычном режиме.', w: 0.3 },
  { id: 'x1', label: '1x', note: 'Обычная игра: ресурсов столько, сколько задумано.', w: 0.6 },
];

export const FIRE_NOTE = 'Дерево может загореться, а огонь может выйти из Пепельных земель и охватить весь мир.';
export const NO_MAP_NOTE = 'У вас не будет ни карты, ни мини-карты. Так играть сложнее, чем задумано.';

/** Пожелания одного участника по миру — семь параметров селектора душноты. */
export interface WorldPrefs {
  combat: CombatId;
  death: DeathId;
  portals: PortalsId;
  raids: RaidsId;
  resources: ResourcesId;
  fire: boolean;
  noMap: boolean;
}

export const DEFAULT_PREFS: WorldPrefs = {
  combat: 'normal',
  death: 'normal',
  portals: 'normal',
  raids: 'normal',
  resources: 'x15',
  fire: false,
  noMap: false,
};

export interface DifficultyMode {
  id: string;
  label: string;
  note: string;
  /** Показывать бейдж «Доп. ачивки». */
  ach: boolean;
  set: WorldPrefs;
}

export const MODES: DifficultyMode[] = [
  {
    id: 'normal',
    label: 'Обычный',
    note: 'Всё как задумано: бой, плата за смерть, набеги и порталы в обычном режиме.',
    ach: false,
    set: { combat: 'normal', death: 'normal', resources: 'x1', raids: 'normal', portals: 'normal', fire: false, noMap: false },
  },
  {
    id: 'hard',
    label: 'Сложный',
    note: 'Бой — сложно, набеги — больше. Остальное в обычном режиме.',
    ach: true,
    set: { combat: 'hard', death: 'normal', resources: 'x1', raids: 'more', portals: 'normal', fire: false, noMap: false },
  },
];

export interface SweatBand {
  max: number;
  label: string;
  note: string;
}

export const SWEAT: SweatBand[] = [
  { max: 0.25, label: 'Чилл-заход', note: 'Сидим, строим, никто не потеет. Хороший вариант для тех, кто в Valheim впервые.' },
  { max: 0.5, label: 'Ровно', note: 'Ванильный темп: прогресс по биомам без лишней боли, руду возим лодкой изредка.' },
  { max: 0.78, label: 'Душно', note: 'Готовь еду и щиты заранее. Логистика руды станет отдельным занятием вечера.' },
  { max: 1.01, label: 'Тьма Асгарда', note: 'Смерть дорого стоит, металл едет только лодкой. Пачке понадобится дисциплина.' },
];

const weight = <Id extends string>(list: WorldOption<Id>[], id: Id): number =>
  list.find((o) => o.id === id)?.w ?? 0;

/** Душнота 0…1 — взвешенная сумма нормированных весов семи параметров. */
export function sweatOf(p: WorldPrefs): number {
  return (
    weight(COMBAT, p.combat) * 0.24 +
    weight(PORTALS, p.portals) * 0.18 +
    weight(DEATH, p.death) * 0.14 +
    weight(RESOURCES, p.resources) * 0.12 +
    weight(RAIDS, p.raids) * 0.12 +
    (p.fire ? 1 : 0) * 0.1 +
    (p.noMap ? 1 : 0) * 0.1
  );
}

export function sweatBand(sweat: number): SweatBand {
  return SWEAT.find((b) => sweat < b.max) ?? SWEAT[SWEAT.length - 1]!;
}

export function prefsEqual(a: WorldPrefs, b: WorldPrefs): boolean {
  return (
    a.combat === b.combat && a.death === b.death && a.portals === b.portals &&
    a.raids === b.raids && a.resources === b.resources && a.fire === b.fire && a.noMap === b.noMap
  );
}
