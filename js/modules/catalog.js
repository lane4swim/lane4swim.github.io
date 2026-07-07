// ============================================================
// modules/catalog.js — Übungskatalog
// ============================================================
import { getAll, put, remove } from '../db.js';
import { el, clear, field, textInput, selectInput, openModal, confirmAction, toast, badge, emptyState, laneWave } from '../utils.js';
import { EXERCISE_CATEGORIES, STROKES } from '../refdata.js';
import { getRole } from '../state.js';

export const catalogModule = {
  id: 'catalog',
  label: 'Übungskatalog',
  roles: ['trainer', 'admin'],
  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><path d="M9 7h7M9 11h7"/></svg>`,
  async render(container) {
    clear(container);
    const exercises = await getAll('exercises');
    renderList(container, exercises);
  }
};

function renderList(container, exercises) {
  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'page-head' }, [
    el('div', {}, [el('div', { class: 'page-eyebrow' }, `${exercises.length} Übungen`), el('h1', { class: 'mt-0' }, 'Übungskatalog')]),
    el('div', { class: 'page-actions' }, [el('button', { class: 'btn btn-primary', onclick: () => openExerciseModal(null, refresh) }, '+ Übung anlegen')]),
  ]));
  wrap.appendChild(laneWave());

  let catFilter = 'all', search = '';
  const controls = el('div', { class: 'grid grid-2 mb-16' }, [
    field('Suche', textInput('', { placeholder: 'Name oder Beschreibung…', oninput: (e) => { search = e.target.value.toLowerCase(); draw(); } })),
    field('Kategorie', selectInput([{ value: 'all', label: 'Alle Kategorien' }, ...EXERCISE_CATEGORIES], 'all', { onchange: (e) => { catFilter = e.target.value; draw(); } })),
  ]);
  wrap.appendChild(controls);

  const host = el('div', { class: 'grid grid-3' });
  wrap.appendChild(host);
  container.appendChild(wrap);

  function draw() {
    clear(host);
    let filtered = exercises;
    if (catFilter !== 'all') filtered = filtered.filter(e => e.category === catFilter);
    if (search) filtered = filtered.filter(e => (e.name + ' ' + (e.description || '')).toLowerCase().includes(search));
    if (filtered.length === 0) { host.appendChild(emptyState('Keine Übungen', 'Für diese Filter wurden keine Übungen gefunden.', null)); return; }
    filtered.forEach(ex => {
      const catLabel = EXERCISE_CATEGORIES.find(c => c.value === ex.category)?.label || ex.category;
      const card = el('div', { class: 'card' }, [
        el('div', { class: 'flex justify-between items-center mb-8' }, [el('h3', { class: 'mt-0', style: 'font-size:1.05rem' }, ex.name), badge(catLabel, 'neutral')]),
        el('p', { class: 'text-sm' }, ex.description || 'Keine Beschreibung.'),
        el('div', { class: 'pill-group mb-8' }, [
          ex.stroke ? badge(ex.stroke, 'progress') : null,
          ex.defaultDistance ? badge(`${ex.defaultDistance} m`, 'neutral') : null,
          ...(ex.tags || []).map(t => badge(t, 'neutral')),
        ].filter(Boolean)),
        el('div', { class: 'flex gap-8', style: 'margin-top:10px' }, [
          el('button', { class: 'btn btn-ghost btn-sm', onclick: () => openExerciseModal(ex, refresh) }, 'Bearbeiten'),
          el('button', { class: 'btn btn-danger btn-sm', onclick: () => confirmAction(`"${ex.name}" aus dem Katalog löschen?`, async () => { await remove('exercises', ex.id); toast('Übung gelöscht'); refresh(); }) }, 'Löschen'),
        ]),
      ]);
      host.appendChild(card);
    });
  }
  draw();

  async function refresh() { const e2 = await getAll('exercises'); clear(container); renderList(container, e2); }
}

function openExerciseModal(exercise, onSaved) {
  const isEdit = !!exercise;
  const data = exercise ? { ...exercise } : { name: '', category: 'technik', stroke: '', description: '', defaultDistance: '', tags: [] };
  const form = el('form', { class: 'form-grid' });
  const fName = textInput(data.name, { required: true });
  const fCat = selectInput(EXERCISE_CATEGORIES, data.category);
  const fStroke = selectInput([{ value: '', label: '— unabhängig —' }, ...STROKES.map(s => ({ value: s, label: s }))], data.stroke || '');
  const fDist = el('input', { type: 'number', min: '0', value: data.defaultDistance || '', placeholder: 'z. B. 100' });
  const fDesc = el('textarea', {}, data.description || '');
  const fTags = textInput((data.tags || []).join(', '), { placeholder: 'z. B. aufwärmen, technik' });
  form.appendChild(field('Name', fName, { span2: true }));
  form.appendChild(field('Kategorie', fCat));
  form.appendChild(field('Schwimmlage', fStroke));
  form.appendChild(field('Standarddistanz (m)', fDist));
  form.appendChild(field('Tags', fTags, { hint: 'kommagetrennt' }));
  form.appendChild(field('Beschreibung', fDesc, { span2: true }));
  form.appendChild(el('div', { class: 'form-actions', style: 'grid-column:1/-1' }, [
    el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => close() }, 'Abbrechen'),
    el('button', { type: 'submit', class: 'btn btn-primary' }, isEdit ? 'Speichern' : 'Anlegen'),
  ]));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!fName.value.trim()) { toast('Bitte einen Namen angeben.', 'error'); return; }
    await put('exercises', {
      ...data, name: fName.value.trim(), category: fCat.value, stroke: fStroke.value || null,
      defaultDistance: fDist.value ? parseInt(fDist.value) : null, description: fDesc.value.trim(),
      tags: fTags.value.split(',').map(t => t.trim()).filter(Boolean),
    });
    toast(isEdit ? 'Änderungen gespeichert' : 'Übung angelegt');
    close(); onSaved?.();
  });
  const { close } = openModal({ title: isEdit ? 'Übung bearbeiten' : 'Übung anlegen', bodyNode: form, wide: true });
}
