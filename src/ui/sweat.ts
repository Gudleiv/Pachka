import { button, el } from '../lib/dom';
import {
  COMBAT, DEATH, FIRE, MODES, NO_MAP, PORTALS, RAIDS, RESOURCES,
  prefsEqual, sweatBand, sweatOf, type WorldOption, type WorldPrefs,
} from '../data/valheim';
import { achBadge, ACCENT, fogRule, kicker, panelHeading, panelSub, PANEL_CLASS, paintVoteBadge, voteBadge } from './shared';
import { createTooltip, type TipRow } from './tooltip';

/** Сколько человек в пачке выбрало каждый вариант; ключ — id варианта. */
export type VoteTally = Record<string, number>;

export interface SweatHandlers {
  set(patch: Partial<WorldPrefs>): void;
  /** Кто выбрал этот вариант — для подсказки на числе голосов. */
  voters(key: keyof WorldPrefs, option: string): TipRow[];
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
  label: string;
}

interface Ladder {
  node: HTMLElement;
  nodes: OptionNode[];
  key: keyof WorldPrefs;
  title: string;
}

const OPTION_STYLE =
  'display:flex; align-items:center; gap:12px; padding:10px 12px; cursor:pointer; font:inherit;' +
  ' text-align:left; border-radius:var(--radius-sm); border:1px solid var(--color-divider);' +
  ' transition:background 120ms, border-color 120ms';

function ladder<Id extends string>(
  key: keyof WorldPrefs,
  title: string,
  hint: string,
  options: WorldOption<Id>[],
  titleFont: boolean,
  onPick: (id: Id) => void,
): Ladder {
  const nodes: OptionNode[] = [];
  const list = el('div', { style: 'display:flex; flex-direction:column; gap:6px' });

  for (const o of options) {
    const dot = el('span', { style: 'width:9px; height:9px; flex:none; border-radius:50%' });
    const label = el('span', {
      style: `font-size:14px${titleFont ? '; font-family:var(--font-heading)' : ''}`,
      text: o.label,
    });
    const badge = voteBadge();
    // Метка для подсказки: что за вариант, знает карта ниже.
    badge.setAttribute('data-vote', '');
    const btn = button({ style: OPTION_STYLE, on: { click: () => onPick(o.id) } }, [
      dot,
      el('span', { style: 'display:flex; flex-direction:column; gap:4px; min-width:0' }, [
        // Бейдж переносится под название: в узкой колонке он рядом не помещается.
        el('span', { style: 'display:flex; align-items:center; flex-wrap:wrap; gap:6px' }, [
          label,
          o.ach && achBadge('Доп. ачивка'),
        ]),
        el('span', { style: 'font-size:11px; color:#7b8390', text: o.note }),
        // Условие ачивки — под пунктом: в бейдж такой текст не влезает.
        o.ach?.note &&
          el('span', { style: 'font-size:11px; color:#7b8390; text-wrap:pretty' }, [
            o.ach.name && el('span', { style: 'color:var(--color-accent-300)', text: `«${o.ach.name}». ` }),
            o.ach.note,
          ]),
      ]),
      badge,
    ]);
    nodes.push({ btn, dot, title: label, badge, id: o.id, label: o.label });
    list.append(btn);
  }

  const node = el('div', { style: 'display:flex; flex-direction:column; gap:10px' }, [
    el('div', { style: 'display:flex; align-items:baseline; gap:8px' }, [
      el('span', { style: 'font-family:var(--font-heading); font-size:15px', text: title }),
      el('span', { style: 'font-size:11px; color:#7b8390', text: hint }),
    ]),
    list,
  ]);
  return { node, nodes, key, title };
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

export function createSweatPanel(handlers: SweatHandlers): SweatView {
  const modeNodes = MODES.map((m) => {
    const title = el('span', { style: 'font-family:var(--font-heading); font-size:16px', text: m.label });
    const ach = m.ach ? achBadge('Доп. ачивки') : null;
    if (ach) ach.style.marginLeft = 'auto';
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

  const combat = ladder('combat', 'Бой', 'сила врагов', COMBAT, false, (id) => handlers.set({ combat: id }));
  const portals = ladder('portals', 'Порталы', 'изменяет работу порталов в игре', PORTALS, false, (id) => handlers.set({ portals: id }));
  const raids = ladder('raids', 'Частота набегов', 'как часто база под атакой', RAIDS, false, (id) => handlers.set({ raids: id }));
  const resources = ladder('resources', 'Количество ресурсов', 'сколько добычи в мире', RESOURCES, true, (id) => handlers.set({ resources: id }));
  const death = ladder('death', 'Плата за смерть', 'что ждет вас после смерти', DEATH, false, (id) => handlers.set({ death: id }));
  const fire = ladder('fire', 'Огнеопасно', 'модификатор мира', FIRE, false, (id) => handlers.set({ fire: id === 'true' }));
  const noMap = ladder('noMap', 'Без карты', 'модификатор мира', NO_MAP, false, (id) => handlers.set({ noMap: id === 'true' }));

  // Число голосов само по себе не говорит, кто за вариант, — подсказка говорит.
  const tipOf = new Map<HTMLElement, { key: keyof WorldPrefs; id: string; head: string }>();
  for (const l of [combat, portals, raids, resources, death, fire, noMap]) {
    for (const n of l.nodes) tipOf.set(n.badge, { key: l.key, id: n.id, head: `${l.title} · ${n.label}` });
  }

  const sweatLabel = el('span', { style: 'font-family:var(--font-heading); font-size:15px; color:var(--color-accent-300)' });
  const sweatFill = el('div', {
    style: 'height:100%; background:linear-gradient(to right, var(--moss), var(--color-accent), var(--blood))',
  });
  const sweatNote = el('span', { style: 'font-size:12px; color:#8b93a1; text-wrap:pretty' });

  const node = el('section', { class: `${PANEL_CLASS} panel-sweat` }, [
    el('div', {}, [kicker('Второе'), panelHeading('Селектор душноты'), panelSub('Твои пожелания по миру.')]),
    fogRule(),
    el('div', { style: 'display:flex; flex-direction:column; gap:8px' }, [
      el('span', { style: 'font-size:11px; letter-spacing:0.16em; color:#7b8390; text-transform:uppercase', text: 'Готовые режимы сложности' }),
      el('div', { style: 'display:grid; grid-template-columns:repeat(auto-fit, minmax(min(260px,100%),1fr)); gap:10px' }, modeNodes.map((m) => m.btn)),
    ]),
    el('div', { style: 'display:grid; grid-template-columns:repeat(auto-fit, minmax(min(300px,100%),1fr)); gap:22px' }, [
      combat.node, portals.node, raids.node, resources.node, death.node, fire.node, noMap.node,
    ]),
    el('div', {
      style:
        'display:flex; align-items:center; gap:18px; flex-wrap:wrap; padding:16px;' +
        ' border:1px solid var(--color-divider); border-radius:var(--radius-sm); background:rgba(15,18,23,0.7)',
    }, [
      el('div', { style: 'display:flex; flex-direction:column; gap:6px; min-width:min(220px,100%); flex:1' }, [
        el('div', { style: 'display:flex; align-items:baseline; gap:8px' }, [
          el('span', { style: 'font-size:11px; letter-spacing:0.16em; color:#7b8390; text-transform:uppercase', text: 'Твоя душнота' }),
          sweatLabel,
        ]),
        el('div', { style: 'height:6px; border-radius:3px; background:#232935; overflow:hidden' }, [sweatFill]),
        sweatNote,
      ]),
    ]),
  ]);

  const tip = createTooltip(node, '[data-vote]', (badge) => {
    const at = tipOf.get(badge);
    const rows = at ? handlers.voters(at.key, at.id) : [];
    return rows.length ? { head: at!.head, rows } : null;
  });
  node.append(tip.node);

  // Касание по числу открывает список — и только его: голос от этого не меняется.
  for (const badge of tipOf.keys()) {
    let touched = false;
    badge.addEventListener('pointerdown', (e) => {
      touched = e.pointerType === 'touch';
    });
    badge.addEventListener('click', (e) => {
      if (touched) e.stopPropagation();
      touched = false;
    });
  }

  function paint(prefs: WorldPrefs, votes: Record<keyof WorldPrefs, VoteTally>): void {
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
    paintLadder(fire.nodes, String(prefs.fire), votes.fire);
    paintLadder(noMap.nodes, String(prefs.noMap), votes.noMap);

    const sweat = sweatOf(prefs);
    const band = sweatBand(sweat);
    sweatLabel.textContent = band.label;
    sweatNote.textContent = band.note;
    sweatFill.style.width = `${Math.round(8 + sweat * 92)}%`;
    // Голоса под открытой подсказкой только что пересчитались.
    tip.refresh();
  }

  return { node, paint };
}
