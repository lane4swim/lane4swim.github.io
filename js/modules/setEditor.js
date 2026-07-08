// ============================================================
// modules/setEditor.js — shared "Sets/Serien" editor widget used
// by both templates.js and plans.js so the editing UX is consistent.
// Optionally accepts the exercise catalog so sets can be created
// directly from a chosen exercise instead of typed from scratch.
// ============================================================
import { el, clear, uid, selectInput } from '../utils.js';
import { SET_INTENSITIES, EXERCISE_CATEGORIES } from '../refdata.js';

// Sensible defaults when a set is created from a catalog exercise,
// since exercises don't carry pool-intensity/rest data themselves.
const CATEGORY_DEFAULTS = {
  technik:      { intensity: 'locker',    restSec: 15 },
  ausdauer:     { intensity: 'ga1',       restSec: 15 },
  sprint:       { intensity: 'sprint',    restSec: 40 },
  kraft:        { intensity: 'ga1',       restSec: 20 },
  kick:         { intensity: 'locker',    restSec: 15 },
  atmung:       { intensity: 'locker',    restSec: 15 },
  'start-wende':{ intensity: 'renotempo', restSec: 30 },
  koordination: { intensity: 'locker',    restSec: 15 },
};

function setFromExercise(exercise) {
  const defaults = CATEGORY_DEFAULTS[exercise.category] || { intensity: 'ga1', restSec: 20 };
  return {
    id: uid('set'),
    description: exercise.name,
    distance: exercise.defaultDistance || 100,
    reps: 1,
    intensity: defaults.intensity,
    restSec: defaults.restSec,
    exerciseId: exercise.id,
  };
}

// Renders an editable list of sets into `hostNode`. `sets` is mutated in place.
// `exercises` (optional) enables the "aus Übungskatalog übernehmen" picker.
// Returns nothing; caller reads the same `sets` array on submit.
export function renderSetEditor(hostNode, sets, exercises = []) {
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
      const intensitySel = selectInput(SET_INTENSITIES, s.intensity || 'ga1', {
        onchange: (e) => s.intensity = e.target.value,
        style: 'grid-column:2/3;margin-top:4px',
        title: 'Intensität',
      });
      row.appendChild(intensitySel);
      if (s.exerciseId) {
        const ex = exercises.find(x => x.id === s.exerciseId);
        if (ex) row.appendChild(el('span', { class: 'hint', style: 'grid-column:2/3' }, `aus Übungskatalog: ${ex.name}`));
      }
      rowsHost.appendChild(row);
    });
    if (sets.length === 0) rowsHost.appendChild(el('p', { class: 'hint', style: 'padding:6px 0' }, 'Noch keine Sätze — leere Zeile oder Übung aus dem Katalog hinzufügen.'));
  }
  draw();

  const controls = el('div', { class: 'flex gap-8', style: 'margin-top:10px;flex-wrap:wrap' });

  const addBtn = el('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, '+ leerer Satz');
  addBtn.addEventListener('click', () => { sets.push({ id: uid('set'), order: sets.length + 1, description: '', distance: 100, reps: 1, intensity: 'ga1', restSec: 20 }); draw(); });
  controls.appendChild(addBtn);

  if (exercises.length > 0) {
    const options = [{ value: '', label: '— Übung aus Katalog wählen —' }, ...exercises
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(ex => ({ value: ex.id, label: `${EXERCISE_CATEGORIES.find(c => c.value === ex.category)?.label || ex.category} · ${ex.name}` }))];
    const exerciseSel = selectInput(options, '', { style: 'min-width:260px' });
    const useBtn = el('button', { type: 'button', class: 'btn btn-accent btn-sm' }, '+ aus Übungskatalog übernehmen');
    useBtn.addEventListener('click', () => {
      const ex = exercises.find(x => x.id === exerciseSel.value);
      if (!ex) return;
      sets.push(setFromExercise(ex));
      exerciseSel.value = '';
      draw();
    });
    controls.appendChild(exerciseSel);
    controls.appendChild(useBtn);
  }

  hostNode.appendChild(controls);
}

export function totalDistance(sets) {
  return sets.reduce((sum, s) => sum + (s.distance || 0) * (s.reps || 1), 0);
}
