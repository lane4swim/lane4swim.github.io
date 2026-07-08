// ============================================================
// modules/syncQueue.js — Event-Queue zur Vorbereitung der
// Backend-Synchronisation ("Outbox-Pattern").
//
// Jede Änderung (Anlegen/Bearbeiten/Löschen) an den fachlichen
// Daten wird von db.js automatisch als Event in den Store
// "syncQueue" geschrieben (siehe db.js: enqueueSyncEvent). Diese
// Ansicht macht die Warteschlange sichtbar und erlaubt es, die
// spätere Übertragung an ein Backend in der Demo zu simulieren.
// ============================================================
import { getSyncQueue, updateSyncEvent, clearSyncedEvents, pendingSyncCount, remove } from '../db.js';
import {
  el, clear, badge, emptyState, laneWave, toast, confirmAction,
} from '../utils.js';

const ENTITY_LABELS = {
  users: 'Nutzer:in', athletes: 'Athlet:in', groups: 'Gruppe', competitions: 'Wettkampf',
  entries: 'Meldung', results: 'Zeit/Ergebnis', exercises: 'Übung', templates: 'Vorlage',
  plans: 'Trainingsplan', sessions: 'Einheit', actionItems: 'Handlungsfeld',
};

const ACTION_LABELS = { create: 'Angelegt', update: 'Bearbeitet', delete: 'Gelöscht' };

export const syncQueueModule = {
  id: 'syncqueue',
  label: 'Sync-Warteschlange',
  roles: ['trainer', 'admin'],
  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4v6h6"/><path d="M20 20v-6h-6"/><path d="M5.6 15a8 8 0 0013.9 2.3M18.4 9a8 8 0 00-13.9-2.3"/></svg>`,
  async render(container) {
    clear(container);
    const queue = await getSyncQueue();
    renderView(container, queue);
  }
};

function renderView(container, queue) {
  const wrap = el('div');
  const pending = queue.filter(e => e.status === 'pending').length;
  const errored = queue.filter(e => e.status === 'error').length;
  const synced = queue.filter(e => e.status === 'synced').length;

  wrap.appendChild(el('div', { class: 'page-head' }, [
    el('div', {}, [el('div', { class: 'page-eyebrow' }, `${queue.length} Events insgesamt`), el('h1', { class: 'mt-0' }, 'Sync-Warteschlange')]),
    el('div', { class: 'page-actions' }, [
      el('button', { class: 'btn btn-ghost', disabled: synced === 0, onclick: () => confirmAction('Alle bereits synchronisierten Einträge aus der Warteschlange entfernen?', async () => { const n = await clearSyncedEvents(); toast(`${n} Einträge aufgeräumt`); refresh(); }) }, 'Synchronisierte aufräumen'),
      el('button', { class: 'btn btn-primary', disabled: pending + errored === 0, onclick: () => runSimulatedSync(refresh) }, '↻ Jetzt synchronisieren (Demo)'),
    ]),
  ]));
  wrap.appendChild(laneWave());

  wrap.appendChild(el('div', { class: 'card mb-16' }, [
    el('p', { class: 'mt-0' }, 'Jede Änderung an Athlet:innen, Plänen, Zeiten usw. wird lokal als Event in dieser Warteschlange abgelegt — dem sogenannten „Outbox-Pattern". Sobald ein echtes Backend angebunden ist, würde ein Sync-Prozess diese Events automatisch im Hintergrund übertragen, sobald eine Verbindung besteht, und sie danach als synchronisiert markieren.'),
    el('p', { style: 'margin-bottom:0' }, 'Da diese Demo-Version ohne Server läuft, kann die Übertragung über den Button oben simuliert werden (inkl. gelegentlicher, absichtlich simulierter Fehler zur Veranschaulichung der Fehlerbehandlung).'),
  ]));

  wrap.appendChild(el('div', { class: 'grid grid-3 mb-16' }, [
    (() => { const d = el('div', { class: 'stat-card' }); d.innerHTML = `<div class="stat-label">Ausstehend</div><div class="stat-value">${pending}</div><div class="stat-sub">wartet auf Übertragung</div>`; return d; })(),
    (() => { const d = el('div', { class: 'stat-card alt' }); d.innerHTML = `<div class="stat-label">Fehlerhaft</div><div class="stat-value">${errored}</div><div class="stat-sub">Wiederholung nötig</div>`; return d; })(),
    (() => { const d = el('div', { class: 'stat-card' }); d.innerHTML = `<div class="stat-label">Synchronisiert</div><div class="stat-value">${synced}</div><div class="stat-sub">erfolgreich übertragen</div>`; return d; })(),
  ]));

  const host = el('div');
  wrap.appendChild(host);
  container.appendChild(wrap);

  function draw() {
    clear(host);
    if (queue.length === 0) { host.appendChild(emptyState('Warteschlange leer', 'Sobald Daten angelegt, bearbeitet oder gelöscht werden, erscheinen hier die entsprechenden Sync-Events.', null)); return; }
    const table = el('table');
    table.appendChild(el('thead', {}, el('tr', {}, [
      el('th', {}, 'Zeitpunkt'), el('th', {}, 'Bereich'), el('th', {}, 'Vorgang'), el('th', {}, 'Status'), el('th', {}, 'Versuche'), el('th', {}, ''),
    ])));
    const tbody = el('tbody');
    queue.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).forEach(evt => {
      const label = ENTITY_LABELS[evt.store] || evt.store;
      const statusEl = evt.status === 'synced' ? badge('Synchronisiert', 'done')
        : evt.status === 'error' ? badge('Fehler', 'open')
        : badge('Ausstehend', 'progress');
      const dt = new Date(evt.createdAt);
      const timeLabel = dt.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const row = el('tr', {}, [
        el('td', { class: 'data text-sm' }, timeLabel),
        el('td', {}, label),
        el('td', {}, ACTION_LABELS[evt.action] || evt.action),
        el('td', {}, [statusEl, evt.status === 'error' && evt.lastError ? el('div', { class: 'hint', style: 'margin-top:3px' }, evt.lastError) : null]),
        el('td', {}, String(evt.attempts || 0)),
        el('td', {}, evt.status !== 'synced' ? el('button', { class: 'btn btn-ghost btn-sm', onclick: async () => { await updateSyncEvent(evt.id, { status: 'pending', lastError: null }); toast('Zur erneuten Übertragung vorgemerkt'); refresh(); } }, 'Erneut versuchen') : el('button', { class: 'btn btn-danger btn-sm', onclick: async () => { await remove('syncQueue', evt.id); toast('Eintrag entfernt'); refresh(); } }, 'Entfernen')),
      ]);
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    host.appendChild(el('div', { class: 'table-wrap card' }, table));
  }
  draw();

  async function refresh() { const q2 = await getSyncQueue(); clear(container); renderView(container, q2); }
}

// Simulates transmitting pending/error events to a backend: brief delay per
// event, ~90% success rate, otherwise marks as 'error' with a sample message
// so the retry flow above can be demonstrated.
async function runSimulatedSync(onDone) {
  const queue = await getSyncQueue();
  const toSend = queue.filter(e => e.status === 'pending' || e.status === 'error');
  if (toSend.length === 0) { toast('Nichts zu synchronisieren'); return; }
  toast(`Synchronisiere ${toSend.length} Event(s) …`);
  for (const evt of toSend) {
    await new Promise(r => setTimeout(r, 220));
    const willFail = Math.random() < 0.1;
    if (willFail) {
      await updateSyncEvent(evt.id, { status: 'error', attempts: (evt.attempts || 0) + 1, lastError: 'Simulierter Netzwerkfehler — Backend nicht erreichbar.' });
    } else {
      await updateSyncEvent(evt.id, { status: 'synced', attempts: (evt.attempts || 0) + 1, syncedAt: new Date().toISOString(), lastError: null });
    }
  }
  const failedCount = toSend.length; // recompute below for accurate message
  const after = await getSyncQueue();
  const stillFailing = after.filter(e => e.status === 'error').length;
  toast(stillFailing > 0 ? `Sync abgeschlossen, ${stillFailing} Event(s) fehlgeschlagen` : 'Sync erfolgreich abgeschlossen', stillFailing > 0 ? 'error' : 'info');
  onDone?.();
}
