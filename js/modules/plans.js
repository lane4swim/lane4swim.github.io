// ============================================================
// modules/plans.js — Trainingspläne (Sets, Serien, Wochenpläne, Kalender)
// ============================================================
import { getAll, put, remove, uid } from '../db.js';
import {
  el, clear, field, textInput, selectInput, openModal, confirmAction, toast, badge,
  emptyState, laneWave, fmtDateLong, fmtDateShort, todayISO, isoAddDays, startOfWeek,
} from '../utils.js';
import { WEEKDAYS } from '../refdata.js';
import { renderSetEditor, totalDistance } from './setEditor.js';
import { navigate } from '../router.js';

export const plansModule = {
  id: 'plans',
  label: 'Trainingspläne',
  roles: ['trainer', 'admin', 'athlete'],
  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18"/><path d="M8 2.5v4M16 2.5v4"/></svg>`,
  async render(container, params) {
    clear(container);
    const [plans, groups, templates] = await Promise.all([getAll('plans'), getAll('groups'), getAll('templates')]);
    if (params[0]) return renderDetail(container, params[0]);
    renderList(container, plans, groups, templates);
  }
};

function renderList(container, plans, groups, templates) {
  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'page-head' }, [
    el('div', {}, [el('div', { class: 'page-eyebrow' }, `${plans.length} Trainingspläne`), el('h1', { class: 'mt-0' }, 'Trainingspläne')]),
    el('div', { class: 'page-actions' }, [el('button', { class: 'btn btn-primary', onclick: () => openPlanModal(null, groups, templates, refresh) }, '+ Plan erstellen')]),
  ]));
  wrap.appendChild(laneWave());

  const host = el('div', { class: 'grid grid-2' });
  wrap.appendChild(host);
  container.appendChild(wrap);

  if (plans.length === 0) host.appendChild(emptyState('Noch keine Pläne', 'Erstelle einen Wochenplan, optional auf Basis einer Vorlage.', null));
  plans.sort((a, b) => b.weekStart.localeCompare(a.weekStart)).forEach(p => {
    const group = groups.find(g => g.id === p.groupId);
    const dist = (p.days || []).reduce((sum, d) => sum + totalDistance(d.sets || []), 0);
    const card = el('div', { class: 'card row-click', onclick: () => navigate('plans', p.id) }, [
      el('div', { class: 'flex justify-between items-center' }, [el('h3', { class: 'mt-0' }, p.name), badge(p.status === 'aktiv' ? 'Aktiv' : 'Archiv', p.status === 'aktiv' ? 'done' : 'neutral')]),
      el('p', { class: 'text-sm' }, `${group?.name || 'Ohne Gruppe'} · ${(p.days || []).length} Einheiten · ${dist} m gesamt`),
      el('p', { class: 'text-sm' }, `Woche ab ${fmtDateShort(p.weekStart)}`),
    ]);
    host.appendChild(card);
  });

  async function refresh() { const [p2, g2, t2] = await Promise.all([getAll('plans'), getAll('groups'), getAll('templates')]); clear(container); renderList(container, p2, g2, t2); }
}

async function renderDetail(container, planId) {
  const [plans, groups, templates] = await Promise.all([getAll('plans'), getAll('groups'), getAll('templates')]);
  const plan = plans.find(p => p.id === planId);
  if (!plan) { container.appendChild(emptyState('Nicht gefunden', 'Dieser Plan existiert nicht mehr.', el('button', { class: 'btn btn-primary', onclick: () => navigate('plans') }, 'Zurück'))); return; }
  const group = groups.find(g => g.id === plan.groupId);

  const wrap = el('div');
  wrap.appendChild(el('button', { class: 'btn btn-ghost btn-sm mb-16', onclick: () => navigate('plans') }, '← Alle Pläne'));
  wrap.appendChild(el('div', { class: 'page-head' }, [
    el('div', {}, [el('div', { class: 'page-eyebrow' }, group?.name || 'Ohne Gruppe'), el('h1', { class: 'mt-0' }, plan.name)]),
    el('div', { class: 'page-actions' }, [
      el('button', { class: 'btn btn-ghost', onclick: () => openPlanModal(plan, groups, templates, () => { clear(container); renderDetail(container, planId); }) }, 'Bearbeiten'),
      el('button', { class: 'btn btn-danger', onclick: () => confirmAction('Diesen Trainingsplan löschen?', async () => { await remove('plans', planId); toast('Plan gelöscht'); navigate('plans'); }) }, 'Löschen'),
    ]),
  ]));
  wrap.appendChild(laneWave());
  wrap.appendChild(el('p', {}, `Woche ab ${fmtDateLong(plan.weekStart)} · Status: ${plan.status === 'aktiv' ? 'Aktiv' : 'Archiviert'}`));

  (plan.days || []).slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(day => {
    const dayCard = el('div', { class: 'card' }, [
      el('div', { class: 'day-block-head' }, [
        el('h3', { class: 'mt-0' }, fmtDateLong(day.date)),
        badge(`${totalDistance(day.sets || [])} m`, 'neutral'),
      ]),
    ]);
    if (!day.sets || day.sets.length === 0) dayCard.appendChild(el('p', {}, 'Keine Sätze geplant.'));
    else {
      const table = el('table');
      table.appendChild(el('thead', {}, el('tr', {}, [el('th', {}, 'Beschreibung'), el('th', {}, 'Distanz'), el('th', {}, 'Wdh.'), el('th', {}, 'Pause')])));
      const tbody = el('tbody');
      day.sets.forEach(s => tbody.appendChild(el('tr', {}, [el('td', {}, s.description || '—'), el('td', {}, `${s.distance ?? '—'} m`), el('td', {}, s.reps), el('td', {}, `${s.restSec || 0}s`)])));
      table.appendChild(tbody);
      dayCard.appendChild(el('div', { class: 'table-wrap' }, table));
    }
    wrap.appendChild(dayCard);
  });

  container.appendChild(wrap);
}

function openPlanModal(plan, groups, templates, onSaved) {
  const isEdit = !!plan;
  const data = plan ? { ...plan, days: (plan.days || []).map(d => ({ ...d, sets: d.sets.map(s => ({ ...s })) })) } : {
    name: `Trainingswoche ${startOfWeek(todayISO())}`, weekStart: startOfWeek(todayISO()), groupId: groups[0]?.id || '', status: 'aktiv', days: [],
  };
  const form = el('form', { class: 'form-grid single' });
  const fName = textInput(data.name, { required: true });
  const fWeek = el('input', { type: 'date', value: data.weekStart });
  const fGroup = selectInput(groups.map(g => ({ value: g.id, label: g.name })), data.groupId);
  const fStatus = selectInput([{ value: 'aktiv', label: 'Aktiv' }, { value: 'archiv', label: 'Archiviert' }], data.status);
  form.appendChild(field('Name', fName));
  const row2 = el('div', { class: 'form-grid' }, [field('Wochenbeginn', fWeek), field('Gruppe', fGroup)]);
  form.appendChild(row2);
  form.appendChild(field('Status', fStatus));

  const daysWrap = el('div', { class: 'field' });
  daysWrap.appendChild(el('label', {}, 'Trainingstage'));
  const daysHost = el('div');
  daysWrap.appendChild(daysHost);
  form.appendChild(daysWrap);

  function drawDays() {
    clear(daysHost);
    data.days.forEach((day, di) => {
      const block = el('div', { class: 'day-block' });
      const dateInput = el('input', { type: 'date', value: day.date, oninput: (e) => day.date = e.target.value });
      block.appendChild(el('div', { class: 'day-block-head' }, [
        el('div', { class: 'flex items-center gap-8' }, [el('strong', {}, 'Datum:'), dateInput]),
        el('button', { type: 'button', class: 'btn btn-danger btn-sm', onclick: () => { data.days.splice(di, 1); drawDays(); } }, 'Tag entfernen'),
      ]));
      const setsHost = el('div');
      block.appendChild(setsHost);
      renderSetEditor(setsHost, day.sets);
      daysHost.appendChild(block);
    });
  }
  drawDays();

  const addRow = el('div', { class: 'flex gap-8', style: 'margin-top:8px' });
  const templateSel = selectInput([{ value: '', label: '— leerer Tag —' }, ...templates.map(t => ({ value: t.id, label: t.name }))], '');
  addRow.appendChild(templateSel);
  addRow.appendChild(el('button', { type: 'button', class: 'btn btn-accent btn-sm', onclick: () => {
    const tpl = templates.find(t => t.id === templateSel.value);
    const nextDate = data.days.length ? isoAddDays(data.days[data.days.length - 1].date, 1) : fWeek.value || todayISO();
    data.days.push({ date: nextDate, sets: tpl ? tpl.sets.map(s => ({ ...s, id: uid('set') })) : [] });
    drawDays();
  } }, '+ Trainingstag hinzufügen'));
  daysWrap.appendChild(addRow);

  form.appendChild(el('div', { class: 'form-actions' }, [
    el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => close() }, 'Abbrechen'),
    el('button', { type: 'submit', class: 'btn btn-primary' }, isEdit ? 'Speichern' : 'Anlegen'),
  ]));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!fName.value.trim()) { toast('Bitte einen Namen angeben.', 'error'); return; }
    await put('plans', { ...data, name: fName.value.trim(), weekStart: fWeek.value, groupId: fGroup.value, status: fStatus.value, days: data.days });
    toast(isEdit ? 'Änderungen gespeichert' : 'Plan angelegt');
    close(); onSaved?.();
  });
  const { close } = openModal({ title: isEdit ? 'Plan bearbeiten' : 'Trainingsplan erstellen', bodyNode: form, wide: true });
}
