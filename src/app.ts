import type { Backend } from './backend';
import type { PackSnapshot } from './backend/types';
import { buildDayList, windowLabel, tzLabel, type DayCell } from './lib/dates';
import { el } from './lib/dom';
import type { WorldPrefs } from './data/valheim';
import { createCover, createHeader } from './ui/chrome';
import { createHeatmap } from './ui/heatmap';
import { createAvailability, DEFAULT_HOURS } from './ui/availability';
import { createSweatPanel, type VoteTally } from './ui/sweat';
import { createModsPanel } from './ui/mods';

/** Откладывает запись, чтобы протяжка по часам не слала запрос на каждый час. */
function debounce<A extends unknown[]>(ms: number, fn: (...args: A) => void): (...args: A) => void {
  let timer: number | undefined;
  return (...args: A) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), ms);
  };
}

const PREF_KEYS: (keyof WorldPrefs)[] = ['combat', 'death', 'portals', 'raids', 'resources', 'fire', 'noMap'];

export function mountApp(root: HTMLElement, backend: Backend, snapshot: PackSnapshot): void {
  const days: DayCell[] = buildDayList(snapshot.pack.windowStart, snapshot.pack.windowDays);

  const state = {
    days: { ...(snapshot.availability[snapshot.me.userId] ?? {}) } as Record<string, number[]>,
    active: days[0]?.key ?? '',
    prefs: { ...(snapshot.prefs[snapshot.me.userId] as WorldPrefs) },
    mods: [...snapshot.mods],
  };

  const pendingDays = new Map<string, number[]>();
  const flushDays = debounce(350, () => {
    for (const [key, hours] of pendingDays) void backend.saveAvailability(key, hours);
    pendingDays.clear();
  });
  const persistDay = (key: string) => {
    pendingDays.set(key, state.days[key] ?? []);
    flushDays();
  };
  const persistPrefs = debounce(250, () => void backend.savePrefs(state.prefs));

  // ——— производные величины ———

  function heat(): { counts: number[][]; mine: boolean[][]; total: number } {
    const counts: number[][] = [];
    const mine: boolean[][] = [];
    const others = snapshot.members.filter((m) => m.userId !== snapshot.me.userId);

    for (let b = 0; b < 12; b++) {
      const cRow: number[] = [];
      const mRow: boolean[] = [];
      for (const d of days) {
        const own = (state.days[d.key] ?? []).some((h) => h === b * 2 || h === b * 2 + 1);
        let n = own ? 1 : 0;
        for (const m of others) {
          const hrs = snapshot.availability[m.userId]?.[d.key];
          if (hrs?.some((h) => h === b * 2 || h === b * 2 + 1)) n++;
        }
        cRow.push(n);
        mRow.push(own);
      }
      counts.push(cRow);
      mine.push(mRow);
    }
    return { counts, mine, total: snapshot.members.length };
  }

  function tallies(): Record<keyof WorldPrefs, VoteTally> {
    const out = {} as Record<keyof WorldPrefs, VoteTally>;
    for (const key of PREF_KEYS) out[key] = {};
    for (const m of snapshot.members) {
      const p = m.userId === snapshot.me.userId ? state.prefs : snapshot.prefs[m.userId];
      if (!p) continue;
      for (const key of PREF_KEYS) {
        const id = String(p[key]);
        out[key]![id] = (out[key]![id] ?? 0) + 1;
      }
    }
    return out;
  }

  // ——— панели ———

  const heatmap = createHeatmap(days);

  const availability = createAvailability(days, windowLabel(days), tzLabel(), {
    pickDay(key) {
      // Повторный клик по активному отмеченному дню снимает его целиком.
      if (state.active === key && state.days[key]) delete state.days[key];
      else if (!state.days[key]) state.days[key] = [...DEFAULT_HOURS];
      state.active = key;
      persistDay(key);
      repaintAvailability();
    },
    setHour(hour, on) {
      const key = state.active;
      if (!key) return;
      const cur = state.days[key] ?? [];
      const has = cur.includes(hour);
      if (has === on) return;
      const next = on ? [...cur, hour].sort((a, b) => a - b) : cur.filter((h) => h !== hour);
      if (next.length) state.days[key] = next;
      else delete state.days[key];
      persistDay(key);
      repaintAvailability();
    },
    applyPreset(dows, hours) {
      let first: string | null = null;
      for (const d of days) {
        if (!dows.includes(d.dow)) continue;
        state.days[d.key] = [...hours];
        persistDay(d.key);
        first ??= d.key;
      }
      if (first) state.active = first;
      repaintAvailability();
    },
    copyToSelected() {
      const hrs = state.days[state.active];
      if (!hrs?.length) return;
      for (const key of Object.keys(state.days)) {
        state.days[key] = [...hrs];
        persistDay(key);
      }
      repaintAvailability();
    },
    clearAll() {
      for (const key of Object.keys(state.days)) {
        delete state.days[key];
        persistDay(key);
      }
      repaintAvailability();
    },
  });

  const sweat = createSweatPanel({
    set(patch) {
      state.prefs = { ...state.prefs, ...patch };
      persistPrefs();
      sweat.paint(state.prefs, tallies());
    },
  });

  const mods = createModsPanel({
    submit(text) {
      // Оптимистично показываем предложение, затем подменяем id с сервера.
      const temp = {
        id: `pending-${Date.now()}`,
        authorId: snapshot.me.userId,
        authorName: snapshot.me.displayName,
        authorAvatar: snapshot.me.avatarUrl,
        text,
        likes: 1,
        mine: true,
      };
      state.mods = [temp, ...state.mods];
      mods.paint(state.mods);
      void backend.addMod(text).then(
        (saved) => {
          state.mods = state.mods.map((m) => (m.id === temp.id ? { ...temp, id: saved.id } : m));
          mods.paint(state.mods);
        },
        () => {
          state.mods = state.mods.filter((m) => m.id !== temp.id);
          mods.paint(state.mods);
        },
      );
    },
    toggleVote(id, next) {
      state.mods = state.mods.map((m) =>
        m.id === id ? { ...m, mine: next, likes: m.likes + (next ? 1 : -1) } : m,
      );
      mods.paint(state.mods);
      void backend.toggleModVote(id, next);
    },
  });

  function repaintAvailability(): void {
    availability.paint({ days: state.days, active: state.active });
    const { counts, mine, total } = heat();
    heatmap.paint(counts, mine, total);
  }

  // ——— сборка страницы ———

  root.append(
    createHeader(snapshot.pack.game, snapshot.me, backend.needsAuth ? () => void backend.signOut().then(() => location.reload()) : null),
    el('main', {
      style: 'max-width:1120px; margin:0 auto; padding:26px 26px 60px; display:flex; flex-direction:column; gap:26px',
    }, [
      createCover(snapshot.pack.title, snapshot.pack.coverUrl),
      heatmap.node,
      el('h2', { style: 'margin:8px 0 0; font-size:32px; line-height:1.1', text: 'Опрос / Обсуждение' }),
      availability.node,
      sweat.node,
      mods.node,
    ]),
  );

  repaintAvailability();
  sweat.paint(state.prefs, tallies());
  mods.paint(state.mods);
}
