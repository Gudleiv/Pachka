import { button, el } from '../lib/dom';
import {
  COMBAT, DEATH, FIRE_NOTE, MODES, NO_MAP_NOTE, PORTALS, RAIDS, RESOURCES,
  prefsEqual, sweatBand, sweatOf, type WorldOption, type WorldPrefs,
} from '../data/valheim';
import { ACCENT, fogRule, kicker, panelHeading, panelSub, PANEL_STYLE, paintVoteBadge, voteBadge } from './shared';

/** Сколько человек в пачке выбрало каждый вариант; ключ — id варианта. */
export type VoteTally = Record<string, number>;

export interface SweatHandlers {
  set(patch: Partial<WorldPrefs>): void;
}

export interface SweatView {
  node: HTMLElement;
  paint(prefs: WorldPrefs, votes: Record<keyof WorldPrefs, VoteTally>): void;
}

interface OptionNode {
  btn: HTMLButtonElement;
  dot: HTMLElement;
  title: HTMLElement;
  badge: HTMLElement;
  id: string;
}

const OPTION_STYLE =
  'display:flex; align-items:center; gap:12px; padding:10px 12px; cursor:pointer; font:inherit;' +
  ' text-align:left; border-radius:var(--radius-sm); border:1px solid var(--color-divider);' +
  ' transition:background 120ms, border-color 120ms';

function ladder<Id extends string>(
  title: string,
  hint: string,
  options: WorldOption<Id>[],
  titleFont: boolean,
  onPick: (id: Id) => void,
): { node: HTMLElement; nodes: OptionNode[] } {
  const nodes: OptionNode[] = [];
  const list = el('div', { style: 'display:flex; flex-direction:column; gap:6px' });

  for (const o of options) {
    const dot = el('span', { style: 'width:9px; height:9px; flex:none; border-radius:50%' });
    const label = el('span', {
      style: `font-size:14px${titleFont ? '; font-family:var(--font-heading)' : ''}`,
      text: o.label,
    });
    const badge = voteBadge();
    const btn = button({ style: OPTION_STYLE, on: { click: () => onPick(o.id) } }, [
      dot,
      el('span', { style: 'display:flex; flex-direction:column; gap:2px; min-width:0' }, [
        label,
        el('span', { style: 'font-size:11px; color:#7b8390', text: o.note }),
      ]),
      badge,
    ]);
    nodes.push({ btn, dot, title: label, badge, id: o.id });
    list.append(btn);
  }

  const node = el('div', { style: 'display:flex; flex-direction:column; gap:10px' }, [
    el('div', { style: 'display:flex; align-items:baseline; gap:8px' }, [
      el('span', { style: 'font-family:var(--font-heading); font-size:15px', text: title }),
      el('span', { style: 'font-size:11px; color:#7b8390', text: hint }),
    ]),
    list,
  ]);
  return { node, nodes };
}

function paintLadder(nodes: OptionNode[], picked: string, tally: VoteTally): void {
  for (const n of nodes) {
    const on = n.id === picked;
    n.btn.style.background = on ? 'rgba(200,160,106,0.14)' : 'rgba(255,255,255,0.025)';
    n.btn.style.borderColor = on ? ACCENT : 'var(--color-divider)';
    n.btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    n.dot.style.background = on ? ACCENT : '#3a4150';
    n.title.style.color = on ? 'var(--color-accent-100)' : '#c3c8d2';
    paintVoteBadge(n.badge, tally[n.id] ?? 0, on);
  }
}

interface ToggleNode {
  btn: HTMLButtonElement;
  track: HTMLElement;
  knob: HTMLElement;
  state: HTMLElement;
  node: HTMLElement;
}

function toggle(title: string, note: string, onFlip: () => void): ToggleNode {
  const knob = el('span', {
    style:
      'position:absolute; top:2px; width:16px; height:16px; border-radius:50%;' +
      ' background:var(--color-accent-100); transition:left 140ms',
  });
  const track = el('span', {
    style: 'position:relative; flex:none; width:36px; height:20px; border-radius:10px; transition:background 140ms',
  }, [knob]);
  const state = el('span', { style: 'font-size:14px' });
  const btn = button({ style: OPTION_STYLE, on: { click: onFlip } }, [
    track,
    el('span', { style: 'display:flex; flex-direction:column; gap:2px; min-width:0' }, [
      state,
      el('span', { style: 'font-size:11px; color:#7b8390', text: note }),
    ]),
  ]);
  const node = el('div', { style: 'display:flex; flex-direction:column; gap:10px' }, [
    el('div', { style: 'display:flex; align-items:baseline; gap:8px' }, [
      el('span', { style: 'font-family:var(--font-heading); font-size:15px', text: title }),
      el('span', { style: 'font-size:11px; color:#7b8390', text: 'модификатор мира' }),
    ]),
    btn,
  ]);
  return { btn, track, knob, state, node };
}

function paintToggle(t: ToggleNode, on: boolean, onLabel: string, offLabel: string): void {
  t.btn.style.background = on ? 'rgba(200,160,106,0.14)' : 'rgba(255,255,255,0.025)';
  t.btn.style.borderColor = on ? ACCENT : 'var(--color-divider)';
  t.btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  t.track.style.background = on ? 'var(--color-accent-600)' : '#2c3240';
  t.knob.style.left = on ? '18px' : '2px';
  t.state.textContent = on ? onLabel : offLabel;
  t.state.style.color = on ? 'var(--color-accent-100)' : '#7b8390';
}

export function createSweatPanel(handlers: SweatHandlers): SweatView {
  const modeNodes = MODES.map((m) => {
    const title = el('span', { style: 'font-family:var(--font-heading); font-size:16px', text: m.label });
    const ach = el(
      'span',
      {
        title: 'В этом режиме открываются дополнительные достижения',
        style:
          `display:${m.ach ? 'inline-flex' : 'none'}; align-items:center; gap:5px; margin-left:auto;` +
          ' padding:3px 8px; border-radius:11px; border:1px solid var(--color-accent-600);' +
          ' background:rgba(200,160,106,0.18); color:var(--color-accent-100); font-size:10px;' +
          ' letter-spacing:0.08em; text-transform:uppercase',
      },
      [el('span', { style: 'font-size:11px', text: '☖' }), 'Доп. ачивки'],
    );
    const btn = button(
      {
        style:
          'display:flex; flex-direction:column; align-items:flex-start; gap:6px; padding:12px 14px;' +
          ' cursor:pointer; font:inherit; text-align:left; border-radius:var(--radius-sm);' +
          ' border:1px solid var(--color-divider); transition:background 120ms, border-color 120ms',
        on: { click: () => handlers.set(m.set) },
      },
      [
        el('span', { style: 'display:flex; align-items:center; gap:8px; width:100%' }, [title, ach]),
        el('span', { style: 'font-size:11px; color:#7b8390; text-wrap:pretty', text: m.note }),
      ],
    );
    return { btn, title, mode: m };
  });

  const combat = ladder('Бой', 'сила врагов', COMBAT, false, (id) => handlers.set({ combat: id }));
  const portals = ladder('Порталы', 'изменяет работу порталов в игре', PORTALS, false, (id) => handlers.set({ portals: id }));
  const raids = ladder('Частота набегов', 'как часто база под атакой', RAIDS, false, (id) => handlers.set({ raids: id }));
  const resources = ladder('Количество ресурсов', 'сколько добычи в мире', RESOURCES, true, (id) => handlers.set({ resources: id }));
  const death = ladder('Плата за смерть', 'что ждет вас после смерти', DEATH, false, (id) => handlers.set({ death: id }));

  let current: WorldPrefs | null = null;
  const fire = toggle('Огнеопасно', FIRE_NOTE, () => current && handlers.set({ fire: !current.fire }));
  const noMap = toggle('Без карты', NO_MAP_NOTE, () => current && handlers.set({ noMap: !current.noMap }));

  const sweatLabel = el('span', { style: 'font-family:var(--font-heading); font-size:15px; color:var(--color-accent-300)' });
  const sweatFill = el('div', {
    style: 'height:100%; background:linear-gradient(to right, var(--moss), var(--color-accent), var(--blood))',
  });
  const sweatNote = el('span', { style: 'font-size:12px; color:#8b93a1; text-wrap:pretty' });

  const node = el('section', { style: PANEL_STYLE.replace('gap:14px', 'gap:16px') }, [
    el('div', {}, [kicker('Второе'), panelHeading('Селектор душноты'), panelSub('Твои пожелания по миру. Голоса пачки складываются — правила ставим по большинству.')]),
    fogRule(),
    el('div', { style: 'display:flex; flex-direction:column; gap:8px' }, [
      el('span', { style: 'font-size:11px; letter-spacing:0.16em; color:#7b8390; text-transform:uppercase', text: 'Готовые режимы сложности' }),
      el('div', { style: 'display:grid; grid-template-columns:repeat(auto-fit, minmax(260px,1fr)); gap:10px' }, modeNodes.map((m) => m.btn)),
    ]),
    el('div', { style: 'display:grid; grid-template-columns:repeat(auto-fit, minmax(300px,1fr)); gap:22px' }, [
      combat.node, portals.node, raids.node, resources.node, death.node, fire.node, noMap.node,
    ]),
    el('div', {
      style:
        'display:flex; align-items:center; gap:18px; flex-wrap:wrap; padding:16px;' +
        ' border:1px solid var(--color-divider); border-radius:var(--radius-sm); background:rgba(15,18,23,0.7)',
    }, [
      el('div', { style: 'display:flex; flex-direction:column; gap:6px; min-width:220px; flex:1' }, [
        el('div', { style: 'display:flex; align-items:baseline; gap:8px' }, [
          el('span', { style: 'font-size:11px; letter-spacing:0.16em; color:#7b8390; text-transform:uppercase', text: 'Твоя душнота' }),
          sweatLabel,
        ]),
        el('div', { style: 'height:6px; border-radius:3px; background:#232935; overflow:hidden' }, [sweatFill]),
        sweatNote,
      ]),
    ]),
  ]);

  function paint(prefs: WorldPrefs, votes: Record<keyof WorldPrefs, VoteTally>): void {
    current = prefs;
    for (const m of modeNodes) {
      const on = prefsEqual(prefs, m.mode.set);
      m.btn.style.background = on ? 'rgba(200,160,106,0.14)' : 'rgba(255,255,255,0.025)';
      m.btn.style.borderColor = on ? ACCENT : 'var(--color-divider)';
      m.btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      m.title.style.color = on ? 'var(--color-accent-100)' : '#c3c8d2';
    }

    paintLadder(combat.nodes, prefs.combat, votes.combat);
    paintLadder(portals.nodes, prefs.portals, votes.portals);
    paintLadder(raids.nodes, prefs.raids, votes.raids);
    paintLadder(resources.nodes, prefs.resources, votes.resources);
    paintLadder(death.nodes, prefs.death, votes.death);
    paintToggle(fire, prefs.fire, 'Включена', 'Выключена');
    paintToggle(noMap, prefs.noMap, 'Включено', 'Выключено');

    const sweat = sweatOf(prefs);
    const band = sweatBand(sweat);
    sweatLabel.textContent = band.label;
    sweatNote.textContent = band.note;
    sweatFill.style.width = `${Math.round(8 + sweat * 92)}%`;
  }

  return { node, paint };
}
