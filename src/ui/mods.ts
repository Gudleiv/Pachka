import { button, clear, el } from '../lib/dom';
import { plural } from '../lib/plural';
import type { ModSuggestion } from '../backend/types';
import { avatar, fogRule, kicker, panelHeading, PANEL_CLASS } from './shared';

export interface ModsHandlers {
  submit(text: string): void;
  toggleVote(id: string, next: boolean): void;
}

export interface ModsView {
  node: HTMLElement;
  paint(mods: ModSuggestion[]): void;
}

export function createModsPanel(handlers: ModsHandlers): ModsView {
  const count = el('span', { style: 'font-size:13px; color:var(--color-accent-300)' });

  const input = el('textarea', {
    rows: 3,
    placeholder: 'Название мода и зачем он нужен',
    style:
      'width:100%; box-sizing:border-box; resize:vertical; padding:12px 14px;' +
      ' border-radius:var(--radius-sm); border:1px solid var(--color-divider);' +
      ' background:rgba(15,18,23,0.8); color:var(--color-text); font-family:var(--font-body);' +
      ' font-size:14px; line-height:1.5',
  });

  const send = button({ class: 'btn btn-primary', style: 'margin-left:auto; height:38px', text: 'Предложить' });

  const syncSend = () => {
    const ok = input.value.trim().length > 0;
    send.style.opacity = ok ? '1' : '0.45';
    send.setAttribute('aria-disabled', ok ? 'false' : 'true');
  };
  input.addEventListener('input', syncSend);
  send.addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    syncSend();
    handlers.submit(text);
  });
  syncSend();

  const list = el('div', { style: 'display:flex; flex-direction:column; gap:8px' });

  const node = el('section', { class: PANEL_CLASS }, [
    el('div', { style: 'display:flex; align-items:flex-end; gap:14px; flex-wrap:wrap' }, [
      el('div', { style: 'margin-right:auto' }, [
        kicker('Третье'),
        panelHeading('Предложения по модификациям'),
      ]),
      count,
    ]),
    fogRule(),
    el('div', { style: 'display:flex; flex-direction:column; gap:10px' }, [
      input,
      el('div', { style: 'display:flex; align-items:center; gap:12px; flex-wrap:wrap' }, [send]),
    ]),
    list,
  ]);

  function paint(mods: ModSuggestion[]): void {
    count.textContent = `${mods.length} ${plural(mods.length, ['предложение', 'предложения', 'предложений'])}`;
    clear(list);
    for (const m of mods) {
      const like = button(
        {
          title: 'Поддержать',
          style:
            'display:flex; flex:none; align-items:center; gap:6px; margin-left:auto; padding:5px 10px;' +
            ' cursor:pointer; font:inherit; font-size:12px; border-radius:13px;' +
            ` border:1px solid ${m.mine ? 'var(--color-accent-600)' : 'var(--color-divider)'};` +
            ` background:${m.mine ? 'rgba(200,160,106,0.18)' : 'rgba(255,255,255,0.04)'};` +
            ` color:${m.mine ? 'var(--color-accent-100)' : '#8b93a1'};` +
            ' transition:background 120ms, border-color 120ms',
          on: { click: () => handlers.toggleVote(m.id, !m.mine) },
        },
        [el('span', { style: 'font-size:11px', text: 'ᛉ' }), String(m.likes)],
      );
      like.setAttribute('aria-pressed', m.mine ? 'true' : 'false');

      list.append(
        el(
          'div',
          {
            style:
              'display:flex; align-items:flex-start; flex-wrap:wrap; gap:12px; padding:12px 14px;' +
              ' border-radius:var(--radius-sm); border:1px solid var(--color-divider);' +
              ' background:rgba(255,255,255,0.025)',
          },
          [
            avatar(m.authorName, m.authorAvatar),
            // На телефоне кнопке голоса не хватает места в строке — она
            // переносится вниз, а текст занимает всю ширину карточки.
            el('span', { style: 'display:flex; flex-direction:column; gap:3px; min-width:0; flex:1 1 200px' }, [
              el('span', { style: 'font-size:12px; color:var(--color-accent-300)', text: m.authorName }),
              el('span', { style: 'font-size:14px; line-height:1.5; color:#c3c8d2; text-wrap:pretty', text: m.text }),
            ]),
            like,
          ],
        ),
      );
    }
  }

  return { node, paint };
}
