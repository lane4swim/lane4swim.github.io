// ============================================================
// app.js — bootstraps the application.
// ============================================================
import { getAll, pendingSyncCount } from './db.js';
import { seedIfEmpty, resetDemoData } from './seed.js';
import { initSession, getCurrentUser, setCurrentUserById, getRole, onUserChange } from './state.js';
import { registerModule, visibleModules, currentRoute, navigate, onRouteChange, getModule } from './router.js';
import { el, clear, toast, confirmAction, openModal, field, textInput, selectInput } from './utils.js';

import { dashboardModule } from './modules/dashboard.js';
import { athletesModule } from './modules/athletes.js';
import { competitionsModule } from './modules/competitions.js';
import { timesModule } from './modules/times.js';
import { plansModule } from './modules/plans.js';
import { templatesModule } from './modules/templates.js';
import { catalogModule } from './modules/catalog.js';
import { sessionsModule } from './modules/sessions.js';
import { actionItemsModule } from './modules/actionItems.js';
import { statsModule } from './modules/stats.js';
import { syncQueueModule } from './modules/syncQueue.js';

[dashboardModule, athletesModule, competitionsModule, timesModule, plansModule,
  templatesModule, catalogModule, sessionsModule, actionItemsModule, statsModule, syncQueueModule]
  .forEach(registerModule);

const viewEl = document.getElementById('view');
const navList = document.getElementById('nav-list');
const bottomNav = document.getElementById('bottomnav');
const userSelect = document.getElementById('user-select');
const netIndicator = document.getElementById('net-indicator');

async function boot() {
  registerServiceWorker();
  await seedIfEmpty();
  await initSession();
  await populateUserSelect();
  buildNav();
  updateNetStatus();
  window.addEventListener('online', updateNetStatus);
  window.addEventListener('offline', updateNetStatus);
  onRouteChange(render);
  onUserChange(() => { buildNav(); render(currentRoute()); });
  render(currentRoute());
}

function updateNetStatus() {
  const online = navigator.onLine;
  netIndicator.classList.toggle('net-offline', !online);
  netIndicator.querySelector('.net-label').textContent = online ? 'Offline bereit' : 'Offline-Modus aktiv';
}

async function populateUserSelect() {
  const users = await getAll('users');
  clear(userSelect);
  users.forEach(u => {
    const roleLabel = u.role === 'trainer' ? 'Trainer:in' : u.role === 'admin' ? 'Admin' : 'Athlet:in';
    userSelect.appendChild(el('option', { value: u.id }, `${u.name} (${roleLabel})`));
  });
  const current = getCurrentUser();
  if (current) userSelect.value = current.id;
  userSelect.onchange = async () => { await setCurrentUserById(userSelect.value); navigate('dashboard'); };
}

function buildNav() {
  const role = getRole();
  const mods = visibleModules(role);
  clear(navList);
  clear(bottomNav);
  mods.forEach(m => {
    const navBadge = m.id === 'syncqueue' ? el('span', { class: 'nav-badge', hidden: true }) : null;
    const li = el('li', {}, el('button', { class: 'nav-link', 'data-route': m.id, onclick: () => navigate(m.id) }, [
      el('span', { class: 'ic', html: m.icon }), el('span', { style: 'flex:1' }, m.label), navBadge,
    ].filter(Boolean)));
    navList.appendChild(li);
    const bottomBadge = m.id === 'syncqueue' ? el('span', { class: 'nav-badge nav-badge-mobile', hidden: true }) : null;
    const bBtn = el('button', { 'data-route': m.id, onclick: () => navigate(m.id), style: 'position:relative' }, [
      el('span', { class: 'ic', html: m.icon }), el('span', {}, m.label.split(' ')[0]), bottomBadge,
    ].filter(Boolean));
    bottomNav.appendChild(bBtn);
  });
  markActive(currentRoute().routeId);
  updateSyncBadge();
}

async function updateSyncBadge() {
  const count = await pendingSyncCount();
  document.querySelectorAll('.nav-badge').forEach(b => {
    b.textContent = count > 99 ? '99+' : String(count);
    b.hidden = count === 0;
  });
}

function markActive(routeId) {
  document.querySelectorAll('.nav-link, .bottomnav button').forEach(b => b.classList.toggle('active', b.dataset.route === routeId));
}

async function render(route) {
  const role = getRole();
  let mod = getModule(route.routeId);
  if (!mod || (mod.roles && !mod.roles.includes(role))) mod = visibleModules(role)[0];
  markActive(mod.id);
  viewEl.innerHTML = '<div class="empty-state">Lädt…</div>';
  try {
    await mod.render(viewEl, route.params || []);
  } catch (err) {
    console.error(err);
    viewEl.innerHTML = '';
    viewEl.appendChild(el('div', { class: 'empty-state' }, [
      el('h3', {}, 'Etwas ist schiefgelaufen'),
      el('p', {}, String(err?.message || err)),
    ]));
  }
  viewEl.focus();
  updateSyncBadge();
}

// ---------------- Settings modal ----------------
document.getElementById('btn-settings').addEventListener('click', openSettings);

async function openSettings() {
  const users = await getAll('users');
  const body = el('div');
  body.appendChild(el('h3', { class: 'mt-0' }, 'Konten'));
  users.forEach(u => body.appendChild(el('p', { class: 'text-sm' }, `${u.name} — Rolle: ${u.role}`)));
  body.appendChild(el('p', { class: 'hint' }, 'Diese App speichert alle Daten ausschließlich lokal auf diesem Gerät (IndexedDB) und funktioniert vollständig offline.'));
  body.appendChild(el('div', { class: 'form-actions', style: 'justify-content:flex-start;margin-top:20px' }, [
    el('button', { class: 'btn btn-ghost', onclick: exportData }, 'Daten exportieren (JSON)'),
    el('button', { class: 'btn btn-danger', onclick: () => confirmAction('Alle Daten zurücksetzen und Demo-Daten neu laden? Dies kann nicht widerrufen werden.', async () => { await resetDemoData(); toast('Demo-Daten neu geladen'); location.reload(); }, { title: 'Zurücksetzen', confirmLabel: 'Zurücksetzen' }) }, 'Auf Demo-Daten zurücksetzen'),
  ]));
  openModal({ title: 'Einstellungen', bodyNode: body, wide: true });
}

async function exportData() {
  const { exportAll } = await import('./db.js');
  const dump = await exportAll();
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `lane1-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  toast('Export gestartet');
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline-first: fail silently */ });
  }
}

boot();
