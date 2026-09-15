import type { Backend } from './backend';
import type { PackSnapshot } from './backend/types';
import { buildDayList, spanAt, spanLabel, windowLabel, tzLabel, type DayCell } from './lib/dates';
import { el } from './lib/dom';
import type { WorldPrefs } from './data/valheim';
import { createCover, createHeader } from './ui/chrome';
import { createHeatmap } from './ui/heatmap';
import type { TipRow } from './ui/tooltip';
import { createAvailability, DEFAULT_HOURS } from './ui/availability';
import { createSweatPanel, type VoteTally } from './ui/sweat';
import { createDiscussionPanel } from './ui/discussion';

/** Откладывает запись, чтобы протяжка по часам не слала запрос на каждый час. */
function debounce<A extends unknown[]>(ms: number, fn: (...args: A) => void): (...args: A) => void {
  let timer: number | undefined;
  return (...args: A) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), ms);
  };
}

const PREF_KEYS: (keyof WorldPrefs)[] = ['combat', 'death', 'portals', 'raids', 'resources', 'fire', 'noMap'];

/**
 * Голоса: сначала ты, дальше по алфавиту. Порядок участников в базе
 * произвольный, а список не должен прыгать от варианта к варианту. У часов
 * порядок свой — по началу отрезка, см. `who()`.
 */
function byMine(a: TipRow, b: TipRow): number {
  return a.mine === b.mine ? a.name.localeCompare(b.name, 'ru') : a.mine ? -1 : 1;
}

export function mountApp(root: HTMLElement, backend: Backend, snapshot: PackSnapshot): void {
  const days: DayCell[] = buildDayList(snapshot.pack.windowStart, snapshot.pack.windowDays);

  const state = {
    days: { ...(snapshot.availability[snapshot.me.userId] ?? {}) } as Record<string, number[]>,
    active: days[0]?.key ?? '',
    prefs: { ...(snapshot.prefs[snapshot.me.userId] as WorldPrefs) },
    posts: [...snapshot.posts],
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

  /**
   * Кто отметил этот блок — для подсказки на ячейке. Рядом с именем не сам блок,
   * а отрезок, в который он попал: на вопрос «до скольки он тут» два часа ячейки
   * не отвечают.
   */
  function who(block: number, dayIndex: number): TipRow[] {
    const day = days[dayIndex];
    if (!day) return [];
    const out: (TipRow & { from: number })[] = [];
    for (const m of snapshot.members) {
      const mine = m.userId === snapshot.me.userId;
      const hours = (mine ? state.days : snapshot.availability[m.userId] ?? {})[day.key] ?? [];
      const span = spanAt(hours, block * 2) ?? spanAt(hours, block * 2 + 1);
      if (!span) continue;
      out.push({ name: m.displayName, avatarUrl: m.avatarUrl, note: spanLabel(span), mine, from: span.from });
    }
    // Сначала ты, дальше — кто раньше сел: список читается как расписание.
    // Имя — только чтобы одинаковые отрезки не менялись местами.
    return out.sort((x, y) =>
      x.mine !== y.mine ? (x.mine ? -1 : 1) : x.from - y.from || x.name.localeCompare(y.name, 'ru'));
  }

  /** Кто выбрал этот вариант мира — для подсказки на числе голосов. */
  function voters(key: keyof WorldPrefs, option: string): TipRow[] {
    const out: TipRow[] = [];
    for (const m of snapshot.members) {
      const mine = m.userId === snapshot.me.userId;
      const prefs = mine ? state.prefs : snapshot.prefs[m.userId];
      if (!prefs || String(prefs[key]) !== option) continue;
      out.push({ name: m.displayName, avatarUrl: m.avatarUrl, mine });
    }
    return out.sort(byMine);
  }

  /**
   * Размер пачки считаем не по списку участников, а по тем, кто отметил себе
   * хотя бы час: вступивший по ссылке и не заполнивший опрос ещё не игрок.
   */
  function ready(): number {
    return snapshot.members.filter((m) => {
      const own = m.userId === snapshot.me.userId;
      const marked = own ? state.days : snapshot.availability[m.userId] ?? {};
      return Object.values(marked).some((hours) => hours.length > 0);
    }).length;
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

  const cover = createCover(snapshot.pack);

  const heatmap = createHeatmap(days, { who });

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
    voters,
    set(patch) {
      state.prefs = { ...state.prefs, ...patch };
      persistPrefs();
      sweat.paint(state.prefs, tallies());
    },
  });

  const discussion = createDiscussionPanel(snapshot.me.userId, {
    submit(text) {
      // Оптимистично показываем сообщение, затем подменяем id с сервера.
      const temp = {
        id: `pending-${Date.now()}`,
        authorId: snapshot.me.userId,
        authorName: snapshot.me.displayName,
        authorAvatar: snapshot.me.avatarUrl,
        text,
        likes: 1,
        mine: true,
        edited: false,
      };
      state.posts = [temp, ...state.posts];
      discussion.paint(state.posts);
      void backend.addPost(text).then(
        (saved) => {
          state.posts = state.posts.map((p) => (p.id === temp.id ? { ...temp, id: saved.id } : p));
          discussion.paint(state.posts);
        },
        () => {
          state.posts = state.posts.filter((p) => p.id !== temp.id);
          discussion.paint(state.posts);
        },
      );
    },
    edit(id, text) {
      const before = state.posts;
      state.posts = state.posts.map((p) => (p.id === id ? { ...p, text, edited: true } : p));
      discussion.paint(state.posts);
      void backend.editPost(id, text).catch(() => {
        // Правка не дошла — возвращаем прежний текст, чтобы лента не врала.
        state.posts = before;
        discussion.paint(state.posts);
      });
    },
    remove(id) {
      const before = state.posts;
      state.posts = state.posts.filter((p) => p.id !== id);
      discussion.paint(state.posts);
      void backend.deletePost(id).catch(() => {
        state.posts = before;
        discussion.paint(state.posts);
      });
    },
    toggleVote(id, next) {
      state.posts = state.posts.map((p) =>
        p.id === id ? { ...p, mine: next, likes: p.likes + (next ? 1 : -1) } : p,
      );
      discussion.paint(state.posts);
      void backend.togglePostVote(id, next);
    },
  });

  function repaintAvailability(): void {
    availability.paint({ days: state.days, active: state.active });
    const { counts, mine, total } = heat();
    heatmap.paint(counts, mine, total);
    cover.paint(ready());
  }

  // ——— сборка страницы ———

  root.append(
    createHeader(snapshot.pack.game, snapshot.me, backend.needsAuth ? () => void backend.signOut().then(() => location.reload()) : null),
    el('main', { class: 'page' }, [
      cover.node,
      heatmap.node,
      el('h2', { class: 'section-title', text: 'Опрос / Обсуждение' }),
      availability.node,
      sweat.node,
      discussion.node,
    ]),
  );

  repaintAvailability();
  sweat.paint(state.prefs, tallies());
  discussion.paint(state.posts);
}
