// ============================================================
// modules/profile.js — "Mein Profil" / "My Profile"
//
// Lets the currently signed-in account (trainer, admin, or athlete)
// change their own personal data — name and email — plus their
// preferred display language (same setting as the topbar dropdown,
// surfaced here too since it's naturally "my personal data").
//
// Deliberately NOT restricted via `roles` on the module: every role
// should be able to manage their own account. Athlete master-data
// (birthdate, group, notes, …) is intentionally out of scope here —
// that remains coach-managed under "Athleten & Team", since it
// reflects team/roster decisions rather than personal account info.
// ============================================================
import { getAll } from '../db.js';
import { el, clear, field, textInput, toast, laneWave, badge, fullName, beginRender } from '../utils.js';
import { getCurrentUser, updateProfile, setUserLocale } from '../state.js';
import { t, getLocale, getAvailableLocales } from '../i18n.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const profileModule = {
  id: 'profile',
  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c0-4.1 3.4-7 7.5-7s7.5 2.9 7.5 7"/><path d="M18.5 5.5l1.4 1.4M20 4l-1.5 1.5" opacity=".6"/></svg>`,
  async render(container) {
    const isCurrent = beginRender(container);
    clear(container);
    const [athletes] = await Promise.all([getAll('athletes')]);
    if (!isCurrent()) return;
    renderView(container, athletes);
  }
};

function renderView(container, athletes) {
  const user = getCurrentUser();
  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'page-head' }, [
    el('div', {}, [el('div', { class: 'page-eyebrow' }, t('profile.eyebrow')), el('h1', { class: 'mt-0' }, t('profile.title'))]),
  ]));
  wrap.appendChild(laneWave());

  if (!user) { container.appendChild(wrap); return; }

  const linkedAthlete = user.athleteId ? athletes.find(a => a.id === user.athleteId) : null;

  // ---- Personal data form ----
  const card = el('div', { class: 'card mb-16' }, [el('h3', { class: 'mt-0' }, t('profile.accountSection'))]);
  const form = el('form', { class: 'form-grid' });
  const fName = textInput(user.name || '', { required: true });
  const fEmail = textInput(user.email || '', { type: 'email', required: true });
  form.appendChild(field(t('profile.formName'), fName, { span2: true }));
  form.appendChild(field(t('profile.formEmail'), fEmail, { span2: true }));

  const roleRow = el('div', { class: 'field span-2' }, [
    el('label', {}, t('profile.roleLabel')),
    el('div', {}, badge(t(`settings.role_${user.role}`), 'neutral')),
  ]);
  form.appendChild(roleRow);

  const athleteRow = el('div', { class: 'field span-2' }, [
    el('label', {}, t('profile.linkedAthlete')),
    el('div', {}, linkedAthlete ? el('span', {}, fullName(linkedAthlete)) : el('span', { class: 'text-slate text-sm' }, t('profile.noLinkedAthlete'))),
    linkedAthlete ? el('div', { class: 'hint' }, t('profile.linkedAthleteNote')) : null,
  ].filter(Boolean));
  form.appendChild(athleteRow);

  form.appendChild(el('div', { class: 'form-actions', style: 'grid-column:1/-1' }, [
    el('button', { type: 'submit', class: 'btn btn-primary' }, t('common.save')),
  ]));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = fName.value.trim(), email = fEmail.value.trim();
    if (!name) { toast(t('profile.validationName'), 'error'); return; }
    if (!EMAIL_RE.test(email)) { toast(t('profile.validationEmail'), 'error'); return; }
    await updateProfile({ name, email });
    toast(t('profile.saved'));
  });

  card.appendChild(form);
  wrap.appendChild(card);

  // ---- Language preference ----
  const langCard = el('div', { class: 'card' }, [
    el('h3', { class: 'mt-0' }, t('profile.languageSectionTitle')),
    el('p', { class: 'text-sm' }, t('profile.languageSectionHint')),
  ]);
  const langButtons = el('div', { class: 'pill-group' });
  getAvailableLocales().forEach(loc => {
    const isActive = loc.code === getLocale();
    const pill = el('button', {
      type: 'button',
      class: `pill ${isActive ? 'active' : ''}`,
      onclick: async () => { await setUserLocale(loc.code); },
    }, `${loc.flag} ${loc.label}`);
    langButtons.appendChild(pill);
  });
  langCard.appendChild(langButtons);
  wrap.appendChild(langCard);

  container.appendChild(wrap);
}
