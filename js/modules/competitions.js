// ============================================================
// modules/competitions.js — Wettkampfmanagement
// ============================================================
import { getAll, put, remove } from '../db.js';
import {
  el, clear, fullName, fmtDateLong, todayISO, field, textInput, selectInput,
  openModal, confirmAction, toast, badge, emptyState, laneWave, secToTime, timeToSec,
} from '../utils.js';
import { EVENTS, COURSES } from '../refdata.js';
import { navigate } from '../router.js';
import { getRole } from '../state.js';

export const competitionsModule = {
  id: 'competitions',
  label: 'Wettkämpfe',
  roles: ['trainer', 'admin'],
  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M6 4h12v4a6 6 0 01-12 0V4z"/><path d="M6 5H3a4 4 0 004 4"/><path d="M18 5h3a4 4 0 01-4 4"/></svg>`,
  async render(container, params) {
    clear(container);
    const [competitions, athletes] = await Promise.all([getAll('competitions'), getAll('athletes')]);
    if (params[0]) return renderDetail(container, params[0]);
    renderList(container, competitions, athletes);
  }
};

function renderList(container, competitions, athletes) {
  const today = todayISO();
  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'page-head' }, [
    el('div', {}, [el('div', { class: 'page-eyebrow' }, `${competitions.length} Wettkämpfe`), el('h1', { class: 'mt-0' }, 'Wettkampfmanagement')]),
    el('div', { class: 'page-actions' }, [el('button', { class: 'btn btn-primary', onclick: () => openCompModal(null, () => refresh()) }, '+ Wettkampf anlegen')]),
  ]));
  wrap.appendChild(laneWave());

  const upcoming = competitions.filter(c => c.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = competitions.filter(c => c.date < today).sort((a, b) => b.date.localeCompare(a.date));

  wrap.appendChild(el('h3', {}, 'Anstehend'));
  wrap.appendChild(renderCompTable(upcoming, 'Keine anstehenden Wettkämpfe.'));
  wrap.appendChild(el('h3', { style: 'margin-top:26px' }, 'Vergangen'));
  wrap.appendChild(renderCompTable(past, 'Noch keine vergangenen Wettkämpfe erfasst.'));

  container.appendChild(wrap);

  async function refresh() {
    const [c2, a2] = await Promise.all([getAll('competitions'), getAll('athletes')]);
    clear(container);
    renderList(container, c2, a2);
  }
}

function renderCompTable(list, emptyMsg) {
  if (list.length === 0) return emptyState('Nichts hier', emptyMsg, null);
  const table = el('table');
  table.appendChild(el('thead', {}, el('tr', {}, [el('th', {}, 'Name'), el('th', {}, 'Datum'), el('th', {}, 'Ort'), el('th', {}, 'Bahn'), el('th', {}, '')])));
  const tbody = el('tbody');
  list.forEach(c => tbody.appendChild(el('tr', { class: 'row-click', onclick: () => navigate('competitions', c.id) }, [
    el('td', {}, c.name), el('td', {}, fmtDateLong(c.date)), el('td', {}, c.location || '—'),
    el('td', {}, badge(c.course, 'neutral')),
    el('td', {}, el('button', { class: 'btn btn-ghost btn-sm', onclick: (e) => { e.stopPropagation(); navigate('competitions', c.id); } }, 'Öffnen')),
  ])));
  table.appendChild(tbody);
  return el('div', { class: 'table-wrap card' }, table);
}

async function renderDetail(container, compId) {
  const [competitions, athletes, results] = await Promise.all([getAll('competitions'), getAll('athletes'), getAll('results')]);
  const comp = competitions.find(c => c.id === compId);
  if (!comp) { container.appendChild(emptyState('Nicht gefunden', 'Dieser Wettkampf existiert nicht mehr.', el('button', { class: 'btn btn-primary', onclick: () => navigate('competitions') }, 'Zurück'))); return; }
  const compResults = results.filter(r => r.competitionId === compId);

  const wrap = el('div');
  wrap.appendChild(el('button', { class: 'btn btn-ghost btn-sm mb-16', onclick: () => navigate('competitions') }, '← Alle Wettkämpfe'));
  wrap.appendChild(el('div', { class: 'page-head' }, [
    el('div', {}, [el('div', { class: 'page-eyebrow' }, fmtDateLong(comp.date)), el('h1', { class: 'mt-0' }, comp.name)]),
    el('div', { class: 'page-actions' }, [
      el('button', { class: 'btn btn-ghost', onclick: () => openCompModal(comp, () => renderDetail(container, compId) & clear(container)) }, 'Bearbeiten'),
      el('button', { class: 'btn btn-danger', onclick: () => confirmAction('Diesen Wettkampf inkl. aller Ergebnisse löschen?', async () => { await remove('competitions', compId); for (const r of compResults) await remove('results', r.id); toast('Wettkampf gelöscht'); navigate('competitions'); }) }, 'Löschen'),
    ]),
  ]));
  wrap.appendChild(laneWave());
  wrap.appendChild(el('p', {}, `${comp.location || 'Ort unbekannt'} · ${comp.course}${comp.notes ? ' · ' + comp.notes : ''}`));

  const card = el('div', { class: 'card' }, [
    el('div', { class: 'flex justify-between items-center mb-16' }, [
      el('h3', { class: 'mt-0' }, 'Ergebnisse'),
      el('button', { class: 'btn btn-accent btn-sm', onclick: () => openResultModal(null, comp, athletes, refreshDetail) }, '+ Ergebnis erfassen'),
    ]),
  ]);
  if (compResults.length === 0) card.appendChild(el('p', {}, 'Noch keine Ergebnisse für diesen Wettkampf erfasst.'));
  else {
    const table = el('table');
    table.appendChild(el('thead', {}, el('tr', {}, [el('th', {}, 'Athlet:in'), el('th', {}, 'Disziplin'), el('th', {}, 'Zeit'), el('th', {}, 'Platz'), el('th', {}, 'PB'), el('th', {}, '')])));
    const tbody = el('tbody');
    compResults.sort((a, b) => a.event.localeCompare(b.event)).forEach(r => {
      const athlete = athletes.find(a => a.id === r.athleteId);
      tbody.appendChild(el('tr', {}, [
        el('td', {}, fullName(athlete)), el('td', {}, r.event), el('td', { class: 'data' }, secToTime(r.time)),
        el('td', {}, r.place ? `${r.place}.` : '—'), el('td', {}, r.isPB ? badge('PB', 'pb') : ''),
        el('td', {}, el('button', { class: 'btn btn-danger btn-sm', onclick: async () => { await remove('results', r.id); toast('Ergebnis gelöscht'); refreshDetail(); } }, 'Entfernen')),
      ]));
    });
    table.appendChild(tbody);
    card.appendChild(el('div', { class: 'table-wrap' }, table));
  }
  wrap.appendChild(card);
  container.appendChild(wrap);

  async function refreshDetail() { clear(container); renderDetail(container, compId); }
}

function openCompModal(comp, onSaved) {
  const isEdit = !!comp;
  const data = comp ? { ...comp } : { name: '', date: todayISO(), location: '', course: 'LCM', notes: '' };
  const form = el('form', { class: 'form-grid' });
  const fName = textInput(data.name, { required: true });
  const fDate = el('input', { type: 'date', value: data.date });
  const fLoc = textInput(data.location);
  const fCourse = selectInput(COURSES, data.course);
  const fNotes = el('textarea', {}, data.notes || '');
  form.appendChild(field('Name', fName, { span2: true }));
  form.appendChild(field('Datum', fDate));
  form.appendChild(field('Bahnlänge', fCourse));
  form.appendChild(field('Ort', fLoc, { span2: true }));
  form.appendChild(field('Notizen', fNotes, { span2: true }));
  form.appendChild(el('div', { class: 'form-actions', style: 'grid-column:1/-1' }, [
    el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => close() }, 'Abbrechen'),
    el('button', { type: 'submit', class: 'btn btn-primary' }, isEdit ? 'Speichern' : 'Anlegen'),
  ]));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!fName.value.trim()) { toast('Bitte einen Namen angeben.', 'error'); return; }
    await put('competitions', { ...data, name: fName.value.trim(), date: fDate.value, location: fLoc.value.trim(), course: fCourse.value, notes: fNotes.value.trim() });
    toast(isEdit ? 'Änderungen gespeichert' : 'Wettkampf angelegt');
    close(); onSaved?.();
  });
  const { close } = openModal({ title: isEdit ? 'Wettkampf bearbeiten' : 'Wettkampf anlegen', bodyNode: form, wide: true });
}

function openResultModal(result, comp, athletes, onSaved) {
  const isEdit = !!result;
  const data = result ? { ...result } : { athleteId: athletes[0]?.id || '', event: EVENTS[0], time: '', place: '', isPB: false, date: comp.date, competitionId: comp.id, course: comp.course };
  const form = el('form', { class: 'form-grid' });
  const fAthlete = selectInput(athletes.map(a => ({ value: a.id, label: fullName(a) })), data.athleteId);
  const fEvent = selectInput(EVENTS.map(e => ({ value: e, label: e })), data.event);
  const fTime = textInput(data.time ? secToTime(data.time) : '', { placeholder: 'mm:ss.cc oder ss.cc', required: true });
  const fPlace = el('input', { type: 'number', min: '1', value: data.place || '' });
  const fPB = el('input', { type: 'checkbox' }); fPB.checked = !!data.isPB;
  form.appendChild(field('Athlet:in', fAthlete, { span2: true }));
  form.appendChild(field('Disziplin', fEvent));
  form.appendChild(field('Zeit', fTime, { hint: 'z. B. 1:02.35 oder 28.90' }));
  form.appendChild(field('Platz', fPlace));
  form.appendChild(field('Persönliche Bestzeit?', el('div', { class: 'flex items-center gap-8' }, [fPB, el('span', { class: 'text-sm' }, 'ja, neue PB'])])));
  form.appendChild(el('div', { class: 'form-actions', style: 'grid-column:1/-1' }, [
    el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => close() }, 'Abbrechen'),
    el('button', { type: 'submit', class: 'btn btn-primary' }, 'Speichern'),
  ]));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const sec = timeToSec(fTime.value);
    if (!sec || isNaN(sec)) { toast('Bitte eine gültige Zeit angeben.', 'error'); return; }
    await put('results', { ...data, athleteId: fAthlete.value, event: fEvent.value, time: sec, place: fPlace.value ? parseInt(fPlace.value) : null, isPB: fPB.checked });
    toast('Ergebnis gespeichert');
    close(); onSaved?.();
  });
  const { close } = openModal({ title: isEdit ? 'Ergebnis bearbeiten' : 'Ergebnis erfassen', bodyNode: form, wide: true });
}
