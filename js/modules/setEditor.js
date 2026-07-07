// ============================================================
// modules/setEditor.js — shared "Sets/Serien" editor widget used
// by both templates.js and plans.js so the editing UX is consistent.
// ============================================================
import { el, clear, uid, selectInput } from '../utils.js';
import { SET_INTENSITIES } from '../refdata.js';

// Renders an editable list of sets into `hostNode`. `sets` is mutated in place.
// Returns nothing; caller reads the same `sets` array on submit.
export function renderSetEditor(hostNode, sets) {
  clear(hostNode);
  const head = el('div', { class: 'set-row set-row-head' }, [
    el('span', {}, 'Dist. (m)'), el('span', {}, 'Beschreibung'), el('span', {}, 'Wdh.'), el('span', {}, 'Pause (s)'), el('span', {}, ''),
  ]);
  hostNode.appendChild(head);
  const rowsHost = el('div');
  hostNode.appendChild(rowsHost);

  function draw() {
    clear(rowsHost);
    sets.forEach((s, i) => {
      const row = el('div', { class: 'set-row' }, [
        el('input', { type: 'number', min: '0', value: s.distance ?? '', oninput: (e) => s.distance = e.target.value ? parseInt(e.target.value) : null }),
        el('input', { type: 'text', value: s.description || '', placeholder: 'z. B. 8x100 Freistil', oninput: (e) => s.description = e.target.value }),
        el('input', { type: 'number', min: '1', value: s.reps ?? 1, oninput: (e) => s.reps = parseInt(e.target.value) || 1 }),
        el('input', { type: 'number', min: '0', value: s.restSec ?? 0, oninput: (e) => s.restSec = parseInt(e.target.value) || 0 }),
        el('button', { type: 'button', class: 'btn btn-danger btn-sm', title: 'Zeile entfernen', onclick: () => { sets.splice(i, 1); draw(); } }, '×'),
      ]);
      const intensitySel = selectInput(SET_INTENSITIES, s.intensity || 'ga1', { onchange: (e) => s.intensity = e.target.value, style: 'grid-column:2/3;margin-top:4px' });
      rowsHost.appendChild(row);
    });
  }
  draw();

  const addBtn = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', style: 'margin-top:8px' }, '+ Satz hinzufügen');
  addBtn.addEventListener('click', () => { sets.push({ id: uid('set'), order: sets.length + 1, description: '', distance: 100, reps: 1, intensity: 'ga1', restSec: 20 }); draw(); });
  hostNode.appendChild(addBtn);
}

export function totalDistance(sets) {
  return sets.reduce((sum, s) => sum + (s.distance || 0) * (s.reps || 1), 0);
}
