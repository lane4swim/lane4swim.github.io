// ============================================================
// state.js — current session (simulated auth, fully offline).
// Since this is a local-first single-user device app, "login"
// is a lightweight profile switcher backed by the users store.
//
// Each user record carries a `locale` field (e.g. "de-DE", "en-US")
// — the user's preferred display language. Switching the active
// user also switches the active i18n locale to that user's
// preference, so language and "who's logged in" travel together,
// same as most real multi-user apps.
// ============================================================
import { getAll, put } from './db.js';
import { setLocale, detectInitialLocale } from './i18n.js';

const SESSION_KEY = 'lane1-session-user-id';

let current = null;
const listeners = [];

export function onUserChange(fn) { listeners.push(fn); }
function emit() { for (const fn of listeners) fn(current); }

export async function initSession() {
  const users = await getAll('users');
  const savedId = localStorage.getItem(SESSION_KEY);
  current = users.find(u => u.id === savedId) || users[0] || null;
  setLocale(current?.locale || detectInitialLocale());
  return current;
}

export function getCurrentUser() { return current; }
export function getRole() { return current?.role || 'trainer'; }

export async function setCurrentUserById(id) {
  const users = await getAll('users');
  current = users.find(u => u.id === id) || current;
  if (current) {
    localStorage.setItem(SESSION_KEY, current.id);
    setLocale(current.locale || detectInitialLocale());
  }
  emit();
  return current;
}

// Changes and persists the *current* user's preferred display language.
export async function setUserLocale(locale) {
  if (!current) { setLocale(locale); return null; }
  current = await put('users', { ...current, locale });
  setLocale(locale);
  emit();
  return current;
}

export async function upsertUser(user) {
  const saved = await put('users', user);
  if (!current) current = saved;
  emit();
  return saved;
}

export function isTrainerOrAdmin() {
  return ['trainer', 'admin'].includes(getRole());
}
export function isAdmin() { return getRole() === 'admin'; }
