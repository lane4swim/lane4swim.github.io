// ============================================================
// modules/athletes.js — Athleten-, Team- und Gruppenverwaltung
// ============================================================
import { getAll, put, remove } from '../db.js';
import {
  el, clear, esc, fullName, ageFromBirthdate, fmtDateShort, todayISO,
  field, textInput, selectInput, openModal, confirmAction, toast, badge,
  emptyState, laneWave, groupBy, secToTime,
} from '../utils.js';
import { getRole } from '../state.js';
import { navigate } from '../router.js';

export const athletesModule = {
  id: 'athletes',
  label: 'Athleten & Team',
  roles: ['trainer', 'admin'],
  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="8" r="2.6" opacity=".6"/><path d="M15.5 14.3c2.6.4 4.5 2.7 4.5 5.7" opacity=".6"/></svg>`,
  async render(container, params) {
    clear(container);
    const [athletes, groups] = await Promise.all([getAll('athletes'), getAll('groups')]);
    if (params[0]) return renderDetail(container, params[0], athletes, groups);
    renderList(container, athletes, groups);
  }
};

function renderList(container, athletes, groups) {
  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'page-head' }, [
    el('div', {}, [el('div', { class: 'page-eyebrow' }, `${athletes.length} Athlet:innen`), el('h1', { class: 'mt-0' }, 'Athleten & Team')]),
    el('div', { class: 'page-actions' }, [
      el('button', { class: 'btn btn-ghost', onclick: () => openGroupModal(groups, refresh) }, 'Gruppen verwalten'),
      el('button', { class: 'btn btn-primary', onclick: () => openAthleteModal(null, groups, refresh) }, '+ Athlet:in anlegen'),
    ]),
  ]));
  wrap.appendChild(laneWave());

  // group filter pills
  const activeGroupId = { value: 'all' };
  const pillRow = el('div', { class: 'pill-group mb-16' });
  const allPill = el('button', { class: 'pill active', onclick: () => selectGroup('all') }, `Alle (${athletes.length})`);
  pillRow.appendChild(allPill);
  groups.forEach(g => {
    const count = athletes.filter(a => a.groupId === g.id).length;
    pillRow.appendChild(el('button', { class: 'pill', onclick: () => selectGroup(g.id) }, `${g.name} (${count})`));
  });
  wrap.appendChild(pillRow);

  const tableHost = el('div');
  wrap.appendChild(tableHost);
  container.appendChild(wrap);

  function selectGroup(gid) {
    activeGroupId.value = gid;
    [...pillRow.children].forEach(p => p.classList.remove('active'));
    const idx = gid === 'all' ? 0 : groups.findIndex(g => g.id === gid) + 1;
    pillRow.children[idx]?.classList.add('active');
    drawTable();
  }

  function drawTable() {
    clear(tableHost);
    const filtered = activeGroupId.value === 'all' ? athletes : athletes.filter(a => a.groupId === activeGroupId.value);
    if (filtered.length === 0) {
      tableHost.appendChild(emptyState('Keine Athlet:innen', 'In dieser Gruppe sind noch keine Athlet:innen erfasst.', null));
      return;
    }
    const table = el('table');
    table.appendChild(el('thead', {}, el('tr', {}, [
      el('th', {}, 'Name'), el('th', {}, 'Alter'), el('th', {}, 'Gruppe'), el('th', {}, 'Status'), el('th', {}, ''),
    ])));
    const tbody = el('tbody');
    filtered.sort((a, b) => a.lastName.localeCompare(b.lastName)).forEach(a => {
      const group = groups.find(g => g.id === a.groupId);
      tbody.appendChild(el('tr', { class: 'row-click', onclick: () => navigate('athletes', a.id) }, [
        el('td', {}, [el('div', { class: 'avatar', style: 'display:inline-flex;margin-right:8px' }, (a.firstName[0] + (a.lastName[0]||'')).toUpperCase()), fullName(a)]),
        el('td', {}, String(ageFromBirthdate(a.birthdate) ?? '—')),
        el('td', {}, group?.name || '—'),
        el('td', {}, badge(a.active ? 'Aktiv' : 'Inaktiv', a.active ? 'done' : 'neutral')),
        el('td', {}, el('button', { class: 'btn btn-ghost btn-sm', onclick: (e) => { e.stopPropagation(); navigate('athletes', a.id); } }, 'Öffnen')),
      ]));
    });
    table.appendChild(tbody);
    tableHost.appendChild(el('div', { class: 'table-wrap card' }, table));
  }
  drawTable();

  async function refresh() {
    const [a2, g2] = await Promise.all([getAll('athletes'), getAll('groups')]);
    clear(container);
    renderList(container, a2, g2);
  }
}

async function renderDetail(container, athleteId, athletes, groups) {
  const athlete = athletes.find(a => a.id === athleteId);
  if (!athlete) { container.appendChild(emptyState('Nicht gefunden', 'Diese Athletin/dieser Athlet existiert nicht (mehr).', el('button', { class: 'btn btn-primary', onclick: () => navigate('athletes') }, 'Zurück zur Übersicht'))); return; }

  const [results, actionItems, sessions] = await Promise.all([getAll('results'), getAll('actionItems'), getAll('sessions')]);
  const group = groups.find(g => g.id === athlete.groupId);
  const myResults = results.filter(r => r.athleteId === athleteId);
  const myActions = actionItems.filter(a => a.athleteId === athleteId);
  let attended = 0, total = 0;
  sessions.forEach(s => { const rec = s.attendance?.find(x => x.athleteId === athleteId); if (rec) { total++; if (rec.present) attended++; } });

  const wrap = el('div');
  wrap.appendChild(el('button', { class: 'btn btn-ghost btn-sm mb-16', onclick: () => navigate('athletes') }, '← Zur Übersicht'));
  wrap.appendChild(el('div', { class: 'page-head' }, [
    el('div', {}, [
      el('div', { class: 'page-eyebrow' }, group?.name || 'Ohne Gruppe'),
      el('h1', { class: 'mt-0' }, fullName(athlete)),
    ]),
    el('div', { class: 'page-actions' }, [
      el('button', { class: 'btn btn-ghost', onclick: () => openAthleteModal(athlete, groups, () => navigate('athletes', athleteId) & location.reload()) }, 'Bearbeiten'),
      el('button', { class: 'btn btn-danger', onclick: () => confirmAction(`${fullName(athlete)} wirklich löschen? Zugehörige Zeiten/Notizen bleiben erhalten, verweisen aber ins Leere.`, async () => { await remove('athletes', athleteId); toast('Athlet:in gelöscht'); navigate('athletes'); }) }, 'Löschen'),
    ]),
  ]));
  wrap.appendChild(laneWave());

  wrap.appendChild(el('div', { class: 'grid grid-4 mb-16' }, [
    (() => { const d = el('div', { class: 'stat-card' }); d.innerHTML = `<div class="stat-label">Alter</div><div class="stat-value">${ageFromBirthdate(athlete.birthdate) ?? '—'}</div><div class="stat-sub">${athlete.birthdate ? fmtDateShort(athlete.birthdate) : ''}</div>`; return d; })(),
    (() => { const d = el('div', { class: 'stat-card alt' }); d.innerHTML = `<div class="stat-label">Anwesenheit</div><div class="stat-value">${total ? Math.round(attended/total*100) : 0}%</div><div class="stat-sub">${attended}/${total} Einheiten</div>`; return d; })(),
    (() => { const d = el('div', { class: 'stat-card' }); d.innerHTML = `<div class="stat-label">Erfasste Zeiten</div><div class="stat-value">${myResults.length}</div><div class="stat-sub">${new Set(myResults.map(r=>r.event)).size} Disziplinen</div>`; return d; })(),
    (() => { const d = el('div', { class: 'stat-card alt' }); d.innerHTML = `<div class="stat-label">Handlungsfelder</div><div class="stat-value">${myActions.filter(a=>a.status!=='done').length}</div><div class="stat-sub">offen von ${myActions.length}</div>`; return d; })(),
  ]));

  const grid = el('div', { class: 'grid grid-2' });

  const infoCard = el('div', { class: 'card' }, [
    el('h3', {}, 'Stammdaten'),
    el('p', {}, [el('strong', {}, 'Geschlecht: '), athlete.gender === 'w' ? 'weiblich' : athlete.gender === 'm' ? 'männlich' : 'divers/unbekannt']),
    el('p', {}, [el('strong', {}, 'Mitglied seit: '), athlete.joinDate ? fmtDateShort(athlete.joinDate) : '—']),
    el('p', {}, [el('strong', {}, 'Gruppe: '), group?.name || '—']),
    athlete.notes ? el('p', {}, [el('strong', {}, 'Notizen: '), athlete.notes]) : null,
  ]);
  grid.appendChild(infoCard);

  const pbCard = el('div', { class: 'card' }, [el('h3', {}, 'Persönliche Bestzeiten')]);
  const byEvent = groupBy(myResults, r => r.event);
  if (Object.keys(byEvent).length === 0) pbCard.appendChild(el('p', {}, 'Noch keine Zeiten erfasst.'));
  else Object.entries(byEvent).forEach(([evt, list]) => {
    const best = list.reduce((a, b) => a.time < b.time ? a : b);
    pbCard.appendChild(el('div', { class: 'list-row' }, [el('div', { style: 'flex:1' }, evt), el('div', { class: 'data' }, secToTime(best.time))]));
  });
  pbCard.appendChild(el('button', { class: 'btn btn-ghost btn-sm', style: 'margin-top:8px', onclick: () => navigate('times') }, 'Zur Zeitenerfassung →'));
  grid.appendChild(pbCard);

  const actionCard = el('div', { class: 'card' }, [el('h3', {}, 'Handlungsfelder')]);
  if (myActions.length === 0) actionCard.appendChild(el('p', {}, 'Keine dokumentiert.'));
  else myActions.forEach(a => actionCard.appendChild(el('div', { class: 'list-row row-click', onclick: () => navigate('actionitems', a.id) }, [
    el('div', { style: 'flex:1' }, [el('div', {}, a.title), el('div', { class: 'text-slate text-sm' }, a.description?.slice(0, 60) || '')]),
    badge(a.status === 'done' ? 'Erledigt' : a.status === 'progress' ? 'In Bearbeitung' : 'Offen', a.status === 'done' ? 'done' : a.status === 'progress' ? 'progress' : 'open'),
  ])));
  actionCard.appendChild(el('button', { class: 'btn btn-ghost btn-sm', style: 'margin-top:8px', onclick: () => navigate('actionitems') }, 'Neues Handlungsfeld anlegen →'));
  grid.appendChild(actionCard);

  wrap.appendChild(grid);
  container.appendChild(wrap);
}

function openAthleteModal(athlete, groups, onSaved) {
  const isEdit = !!athlete;
  const data = athlete ? { ...athlete } : { firstName: '', lastName: '', birthdate: '', gender: 'w', groupId: groups[0]?.id || '', joinDate: todayISO(), active: true, notes: '' };
  const form = el('form', { class: 'form-grid' });
  const fFirst = textInput(data.firstName, { required: true });
  const fLast = textInput(data.lastName, { required: true });
  const fBirth = el('input', { type: 'date', value: data.birthdate || '' });
  const fGender = selectInput([{ value: 'w', label: 'weiblich' }, { value: 'm', label: 'männlich' }, { value: 'd', label: 'divers' }], data.gender);
  const fGroup = selectInput(groups.map(g => ({ value: g.id, label: g.name })), data.groupId);
  const fJoin = el('input', { type: 'date', value: data.joinDate || todayISO() });
  const fActive = el('input', { type: 'checkbox' }); fActive.checked = data.active !== false;
  const fNotes = el('textarea', {}, data.notes || '');

  form.appendChild(field('Vorname', fFirst));
  form.appendChild(field('Nachname', fLast));
  form.appendChild(field('Geburtsdatum', fBirth));
  form.appendChild(field('Geschlecht', fGender));
  form.appendChild(field('Trainingsgruppe', fGroup));
  form.appendChild(field('Mitglied seit', fJoin));
  form.appendChild(field('Notizen', fNotes, { span2: true }));
  const activeField = field('Status', el('div', { class: 'flex items-center gap-8' }, [fActive, el('span', { class: 'text-sm' }, 'aktiv')]), { span2: true });
  form.appendChild(activeField);

  form.appendChild(el('div', { class: 'form-actions span-2', style: 'grid-column:1/-1' }, [
    el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => close() }, 'Abbrechen'),
    el('button', { type: 'submit', class: 'btn btn-primary' }, isEdit ? 'Speichern' : 'Anlegen'),
  ]));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!fFirst.value.trim() || !fLast.value.trim()) { toast('Bitte Vor- und Nachname angeben.', 'error'); return; }
    const obj = {
      ...data, firstName: fFirst.value.trim(), lastName: fLast.value.trim(), birthdate: fBirth.value,
      gender: fGender.value, groupId: fGroup.value, joinDate: fJoin.value, active: fActive.checked, notes: fNotes.value.trim(),
    };
    await put('athletes', obj);
    toast(isEdit ? 'Änderungen gespeichert' : 'Athlet:in angelegt');
    close();
    onSaved?.();
  });

  const { close } = openModal({ title: isEdit ? `${fullName(athlete)} bearbeiten` : 'Athlet:in anlegen', bodyNode: form, wide: true });
}

function openGroupModal(groups, onSaved) {
  const body = el('div');
  const list = el('div', { class: 'mb-16' });
  function drawList() {
    clear(list);
    if (groups.length === 0) { list.appendChild(el('p', {}, 'Noch keine Gruppen angelegt.')); return; }
    groups.forEach(g => {
      list.appendChild(el('div', { class: 'list-row' }, [
        el('div', { style: 'flex:1' }, [el('div', {}, g.name), el('div', { class: 'text-slate text-sm' }, g.description || '')]),
        el('button', { class: 'btn btn-danger btn-sm', onclick: async () => { await remove('groups', g.id); groups.splice(groups.indexOf(g), 1); drawList(); onSaved?.(); } }, 'Löschen'),
      ]));
    });
  }
  drawList();
  body.appendChild(list);

  const form = el('form', { class: 'form-grid single' });
  const fName = textInput('', { placeholder: 'z. B. Leistungsgruppe' });
  const fDesc = el('textarea', { placeholder: 'Kurzbeschreibung (optional)' });
  form.appendChild(field('Gruppenname', fName));
  form.appendChild(field('Beschreibung', fDesc));
  form.appendChild(el('div', { class: 'form-actions' }, [el('button', { type: 'submit', class: 'btn btn-primary' }, '+ Gruppe hinzufügen')]));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!fName.value.trim()) return;
    const g = await put('groups', { name: fName.value.trim(), description: fDesc.value.trim() });
    groups.push(g);
    fName.value = ''; fDesc.value = '';
    drawList();
    onSaved?.();
  });
  body.appendChild(form);
  openModal({ title: 'Trainingsgruppen verwalten', bodyNode: body });
}
