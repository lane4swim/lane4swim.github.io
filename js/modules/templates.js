// ============================================================
// modules/templates.js — wiederverwendbare Trainingsplan-Vorlagen
// ============================================================
import { getAll, put, remove, uid } from '../db.js';
import { el, clear, field, textInput, openModal, confirmAction, toast, badge, emptyState, laneWave } from '../utils.js';
import { renderSetEditor, totalDistance, cloneItems } from './setEditor.js';

export const templatesModule = {
  id: 'templates',
  label: 'Vorlagen',
  roles: ['trainer', 'admin'],
  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="11" width="8" height="9" rx="1"/><rect x="13" y="11" width="8" height="9" rx="1"/></svg>`,
  async render(container) {
    clear(container);
    const [templates, exercises] = await Promise.all([getAll('templates'), getAll('exercises')]);
    renderList(container, templates, exercises);
  }
};

function renderList(container, templates, exercises) {
  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'page-head' }, [
    el('div', {}, [el('div', { class: 'page-eyebrow' }, `${templates.length} Vorlagen`), el('h1', { class: 'mt-0' }, 'Trainingsplan-Vorlagen')]),
    el('div', { class: 'page-actions' }, [el('button', { class: 'btn btn-primary', onclick: () => openTemplateModal(null, exercises, refresh) }, '+ Vorlage erstellen')]),
  ]));
  wrap.appendChild(laneWave());
  wrap.appendChild(el('p', {}, 'Vorlagen lassen sich beim Erstellen eines Trainingsplans für einen Tag übernehmen und danach frei anpassen.'));

  const host = el('div', { class: 'grid grid-2' });
  wrap.appendChild(host);
  container.appendChild(wrap);

  if (templates.length === 0) { host.appendChild(emptyState('Noch keine Vorlagen', 'Lege eine wiederverwendbare Trainingseinheit an, z. B. "Grundlagenausdauer".', null)); }
  templates.forEach(t => {
    const card = el('div', { class: 'card' }, [
      el('div', { class: 'flex justify-between items-center' }, [el('h3', { class: 'mt-0' }, t.name), badge(`${totalDistance(t.sets || [])} m`, 'neutral')]),
      el('p', { class: 'text-sm' }, t.description || ''),
      el('div', { class: 'pill-group mb-8' }, (t.tags || []).map(tag => badge(tag, 'neutral'))),
    ]);
    const list = el('div', { class: 'mb-8' });
    (t.sets || []).forEach(entry => {
      if (entry.kind === 'block') {
        list.appendChild(el('div', { class: 'list-row' }, [
          el('span', { style: 'flex:1' }, [badge(`${entry.repeatCount || 1}×`, 'progress'), ' ', entry.label || 'Wiederholungsblock', el('span', { class: 'hint' }, ` (${(entry.sets || []).length} Sätze)`)]),
          el('span', { class: 'data text-sm' }, `${totalDistance(entry.sets || []) * (entry.repeatCount || 1)}m`),
        ]));
      } else {
        list.appendChild(el('div', { class: 'list-row' }, [
          el('span', { style: 'flex:1' }, entry.description || '—'), el('span', { class: 'data text-sm' }, `${entry.reps}× ${entry.distance ?? '—'}m`),
        ]));
      }
    });
    card.appendChild(list);
    card.appendChild(el('div', { class: 'flex gap-8' }, [
      el('button', { class: 'btn btn-ghost btn-sm', onclick: () => openTemplateModal(t, exercises, refresh) }, 'Bearbeiten'),
      el('button', { class: 'btn btn-danger btn-sm', onclick: () => confirmAction(`Vorlage "${t.name}" löschen?`, async () => { await remove('templates', t.id); toast('Vorlage gelöscht'); refresh(); }) }, 'Löschen'),
    ]));
    host.appendChild(card);
  });

  async function refresh() { const [t2, e2] = await Promise.all([getAll('templates'), getAll('exercises')]); clear(container); renderList(container, t2, e2); }
}

function openTemplateModal(template, exercises, onSaved) {
  const isEdit = !!template;
  const data = template ? { ...template, sets: cloneItems(template.sets) } : { name: '', description: '', tags: [], sets: [] };
  const form = el('form', { class: 'form-grid single' });
  const fName = textInput(data.name, { required: true });
  const fDesc = el('textarea', {}, data.description || '');
  const fTags = textInput((data.tags || []).join(', '), { placeholder: 'z. B. ausdauer, basis' });
  form.appendChild(field('Name', fName));
  form.appendChild(field('Beschreibung', fDesc));
  form.appendChild(field('Tags', fTags, { hint: 'kommagetrennt' }));

  const setsWrap = el('div', { class: 'field' });
  setsWrap.appendChild(el('label', {}, 'Sätze / Serien'));
  const setsHost = el('div');
  setsWrap.appendChild(setsHost);
  form.appendChild(setsWrap);
  renderSetEditor(setsHost, data.sets, exercises);

  form.appendChild(el('div', { class: 'form-actions' }, [
    el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => close() }, 'Abbrechen'),
    el('button', { type: 'submit', class: 'btn btn-primary' }, isEdit ? 'Speichern' : 'Anlegen'),
  ]));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!fName.value.trim()) { toast('Bitte einen Namen angeben.', 'error'); return; }
    await put('templates', { ...data, name: fName.value.trim(), description: fDesc.value.trim(), tags: fTags.value.split(',').map(t => t.trim()).filter(Boolean), sets: data.sets });
    toast(isEdit ? 'Änderungen gespeichert' : 'Vorlage angelegt');
    close(); onSaved?.();
  });
  const { close } = openModal({ title: isEdit ? 'Vorlage bearbeiten' : 'Vorlage erstellen', bodyNode: form, wide: true });
}
