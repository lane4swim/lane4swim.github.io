// ============================================================
// modules/setEditor.js — shared "Sets/Serien" editor widget used
// by both templates.js and plans.js so the editing UX is consistent.
//
// An editable list is an array of "entries". Each entry is either:
//   - a plain set:   { kind: 'set',   id, description, distance, reps, intensity, restSec, exerciseId? }
//   - a repeat block:{ kind: 'block', id, label, repeatCount, sets: [ <plain set>, ... ] }
//
// Repeat blocks model classic swim-set notation like "3x [100 Freistil,
// 50 Beine]" without forcing the whole block to be typed out longhand.
// Entries without a `kind` (older saved data) are treated as plain sets
// for backward compatibility — no data migration needed.
// ============================================================
import { el, clear, uid, selectInput, badge } from '../utils.js';
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

function newBlankSet() {
  return { kind: 'set', id: uid('set'), description: '', distance: 100, reps: 1, intensity: 'ga1', restSec: 20 };
}

function newBlock() {
  return { kind: 'block', id: uid('block'), label: '', repeatCount: 3, sets: [newBlankSet()] };
}

function setFromExercise(exercise) {
  const defaults = CATEGORY_DEFAULTS[exercise.category] || { intensity: 'ga1', restSec: 20 };
  return {
    kind: 'set',
    id: uid('set'),
    description: exercise.name,
    distance: exercise.defaultDistance || 100,
    reps: 1,
    intensity: defaults.intensity,
    restSec: defaults.restSec,
    exerciseId: exercise.id,
  };
}

// Total distance across a mixed list of plain sets and repeat blocks.
// A block's inner distance is computed once and then multiplied by its
// repeatCount — this is the one place that "correctly" defines what a
// block's total distance means, so every other view (plan detail,
// template cards, stats) should go through this function rather than
// re-implementing the sum.
export function totalDistance(items) {
  return (items || []).reduce((sum, entry) => {
    if (entry.kind === 'block') {
      const inner = totalDistance(entry.sets || []);
      return sum + inner * (entry.repeatCount || 1);
    }
    return sum + (entry.distance || 0) * (entry.reps || 1);
  }, 0);
}

// Deep-clones a list of entries with fresh ids — used when copying a
// template's sets into a new plan day, so editing the plan can never
// mutate the original template (or another day) via shared references.
export function cloneItems(items) {
  return (items || []).map(entry => {
    if (entry.kind === 'block') {
      return { ...entry, id: uid('block'), sets: (entry.sets || []).map(s => ({ ...s, id: uid('set') })) };
    }
    return { ...entry, id: uid('set') };
  });
}

function buildExerciseOptions(exercises) {
  return [{ value: '', label: '— Übung aus Katalog wählen —' }, ...exercises
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(ex => ({ value: ex.id, label: `${EXERCISE_CATEGORIES.find(c => c.value === ex.category)?.label || ex.category} · ${ex.name}` }))];
}

// Renders one plain-set row. `onRemove` is called when the row's × is clicked;
// the caller owns the array and re-draws itself afterwards.
function buildSetRow(s, exercises, onRemove) {
  const row = el('div', { class: 'set-row' }, [
    el('input', { type: 'number', min: '0', value: s.distance ?? '', oninput: (e) => s.distance = e.target.value ? parseInt(e.target.value) : null }),
    el('input', { type: 'text', value: s.description || '', placeholder: 'z. B. 8x100 Freistil', oninput: (e) => s.description = e.target.value }),
    el('input', { type: 'number', min: '1', value: s.reps ?? 1, oninput: (e) => s.reps = parseInt(e.target.value) || 1 }),
    el('input', { type: 'number', min: '0', value: s.restSec ?? 0, oninput: (e) => s.restSec = parseInt(e.target.value) || 0 }),
    el('button', { type: 'button', class: 'btn btn-danger btn-sm', title: 'Zeile entfernen', onclick: onRemove }, '×'),
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
  return row;
}

// Renders one repeat-block: header (label + × repeatCount + remove),
// its own inner rows/controls (reusing buildSetRow), and a live subtotal.
// `onRedrawParent` re-renders the outer list so the parent's total-distance
// hint stays correct whenever something inside the block changes.
function buildBlockRow(block, exercises, onRemoveBlock, onRedrawParent) {
  const container = el('div', { class: 'day-block', style: 'margin:10px 0;border-style:dashed;border-color:var(--c-chlorine-d)' });

  const labelInput = el('input', {
    type: 'text', value: block.label || '', placeholder: 'Blockname, z. B. „Hauptserie“',
    style: 'min-width:180px', oninput: (e) => block.label = e.target.value,
  });
  const repeatInput = el('input', {
    type: 'number', min: '1', value: block.repeatCount || 1, style: 'width:60px', title: 'Wie oft wird dieser Block wiederholt?',
    oninput: (e) => { block.repeatCount = Math.max(1, parseInt(e.target.value) || 1); updateSubtotal(); onRedrawParent(); },
  });
  const removeBlockBtn = el('button', { type: 'button', class: 'btn btn-danger btn-sm', onclick: onRemoveBlock }, 'Block entfernen');

  container.appendChild(el('div', { class: 'day-block-head' }, [
    el('div', { class: 'flex items-center gap-8' }, [badge('Wiederholungsblock', 'progress'), labelInput]),
    el('div', { class: 'flex items-center gap-8' }, [el('span', { class: 'text-sm' }, '× Wiederholungen:'), repeatInput, removeBlockBtn]),
  ]));

  const innerHost = el('div');
  container.appendChild(innerHost);
  const subtotalEl = el('div', { class: 'hint', style: 'margin-top:6px' });
  container.appendChild(subtotalEl);

  function updateSubtotal() {
    const inner = totalDistance(block.sets || []);
    subtotalEl.textContent = `Blockdistanz: ${inner} m je Durchgang × ${block.repeatCount || 1} = ${inner * (block.repeatCount || 1)} m gesamt`;
  }

  function drawInner() {
    clear(innerHost);
    (block.sets || []).forEach((s, si) => {
      innerHost.appendChild(buildSetRow(s, exercises, () => { block.sets.splice(si, 1); drawInner(); updateSubtotal(); onRedrawParent(); }));
    });
    if (!block.sets || block.sets.length === 0) {
      innerHost.appendChild(el('p', { class: 'hint', style: 'padding:4px 0' }, 'Noch keine Sätze in diesem Block.'));
    }
    updateSubtotal();
  }
  drawInner();

  const innerControls = el('div', { class: 'flex gap-8', style: 'margin-top:6px;flex-wrap:wrap' });
  const addSetBtn = el('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, '+ Satz im Block');
  addSetBtn.addEventListener('click', () => { block.sets = block.sets || []; block.sets.push(newBlankSet()); drawInner(); onRedrawParent(); });
  innerControls.appendChild(addSetBtn);

  if (exercises.length > 0) {
    const exerciseSel = selectInput(buildExerciseOptions(exercises), '', { style: 'min-width:220px' });
    const useBtn = el('button', { type: 'button', class: 'btn btn-accent btn-sm' }, '+ aus Katalog (Block)');
    useBtn.addEventListener('click', () => {
      const ex = exercises.find(x => x.id === exerciseSel.value);
      if (!ex) return;
      block.sets = block.sets || [];
      block.sets.push(setFromExercise(ex));
      exerciseSel.value = '';
      drawInner();
      onRedrawParent();
    });
    innerControls.appendChild(exerciseSel);
    innerControls.appendChild(useBtn);
  }
  container.appendChild(innerControls);

  return container;
}

// Renders an editable list of mixed sets/blocks into `hostNode`.
// `items` is mutated in place; the caller reads the same array on submit.
// `exercises` (optional) enables "aus Übungskatalog übernehmen" pickers.
export function renderSetEditor(hostNode, items, exercises = []) {
  clear(hostNode);

  const totalEl = el('div', { class: 'hint', style: 'margin-bottom:8px;font-weight:700' });
  hostNode.appendChild(totalEl);

  const head = el('div', { class: 'set-row set-row-head' }, [
    el('span', {}, 'Dist. (m)'), el('span', {}, 'Beschreibung'), el('span', {}, 'Wdh.'), el('span', {}, 'Pause (s)'), el('span', {}, ''),
  ]);
  hostNode.appendChild(head);
  const rowsHost = el('div');
  hostNode.appendChild(rowsHost);

  function updateTotal() {
    totalEl.textContent = `Gesamtdistanz: ${totalDistance(items)} m`;
  }

  function draw() {
    clear(rowsHost);
    items.forEach((entry, i) => {
      if (entry.kind === 'block') {
        rowsHost.appendChild(buildBlockRow(entry, exercises, () => { items.splice(i, 1); draw(); }, updateTotal));
      } else {
        rowsHost.appendChild(buildSetRow(entry, exercises, () => { items.splice(i, 1); draw(); }));
      }
    });
    if (items.length === 0) {
      rowsHost.appendChild(el('p', { class: 'hint', style: 'padding:6px 0' }, 'Noch keine Sätze — leere Zeile, Übung aus dem Katalog oder Wiederholungsblock hinzufügen.'));
    }
    updateTotal();
  }
  draw();

  const controls = el('div', { class: 'flex gap-8', style: 'margin-top:10px;flex-wrap:wrap' });

  const addBtn = el('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, '+ leerer Satz');
  addBtn.addEventListener('click', () => { items.push(newBlankSet()); draw(); });
  controls.appendChild(addBtn);

  const addBlockBtn = el('button', { type: 'button', class: 'btn btn-primary btn-sm' }, '+ Wiederholungsblock');
  addBlockBtn.addEventListener('click', () => { items.push(newBlock()); draw(); });
  controls.appendChild(addBlockBtn);

  if (exercises.length > 0) {
    const exerciseSel = selectInput(buildExerciseOptions(exercises), '', { style: 'min-width:260px' });
    const useBtn = el('button', { type: 'button', class: 'btn btn-accent btn-sm' }, '+ aus Übungskatalog übernehmen');
    useBtn.addEventListener('click', () => {
      const ex = exercises.find(x => x.id === exerciseSel.value);
      if (!ex) return;
      items.push(setFromExercise(ex));
      exerciseSel.value = '';
      draw();
    });
    controls.appendChild(exerciseSel);
    controls.appendChild(useBtn);
  }

  hostNode.appendChild(controls);
}
