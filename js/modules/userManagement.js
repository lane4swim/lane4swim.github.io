// ============================================================
// modules/userManagement.js — "Nutzerverwaltung"
//
// Bildet den einladungsbasierten Registrierungsprozess ab, der auf dem
// Backend (Phase 1, siehe docs/backend-plan.md) bereits real implementiert
// ist: Superadmin legt Vereine an + lädt deren ersten Admin ein; Admin lädt
// Trainer:innen/Athlet:innen des eigenen Vereins ein. Beides über zeitlich
// befristete Einladungslinks.
//
// WICHTIG — bewusste Scope-Entscheidung: Diese Ansicht simuliert den Ablauf
// vollständig LOKAL (IndexedDB), genau wie der Rest der App bisher komplett
// offline funktioniert (siehe z. B. die Sync-Warteschlange, die die
// künftige Server-Synchronisation ebenfalls erst simuliert). Es findet noch
// KEIN echter HTTP-Aufruf an apps/api statt — das ist Phase 4
// (Frontend-Integration) im Backend-Plan. Die hier erzeugten "Links"
// enthalten ein lokal generiertes Token zur Veranschaulichung.
// ============================================================
import { getAll, put, remove } from '../db.js';
import {
  el, clear, field, textInput, selectInput, openModal, confirmAction, toast, badge,
  emptyState, laneWave, fullName, beginRender, uid, todayISO, isoAddDays, fmtDateShort,
} from '../utils.js';
import { getCurrentUser, isSuperAdmin } from '../state.js';
import { t } from '../i18n.js';

const MEMBER_INVITE_TTL_DAYS = 7;
const CLUB_INVITE_TTL_DAYS = 14;

export const userManagementModule = {
  id: 'usermgmt',
  roles: ['superadmin', 'admin'],
  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
  async render(container) {
    const isCurrent = beginRender(container);
    clear(container);
    const [clubs, invitations, users] = await Promise.all(['clubs', 'invitations', 'users'].map(getAll));
    if (!isCurrent()) return;
    renderView(container, clubs, invitations, users);
  }
};

function statusOf(invitation) {
  if (invitation.revokedAt) return 'revoked';
  if (invitation.usedAt) return 'used';
  if (new Date(invitation.expiresAt).getTime() < Date.now()) return 'expired';
  return 'pending';
}
function statusBadge(status) {
  const map = { pending: ['statusPending', 'progress'], used: ['statusUsed', 'done'], expired: ['statusExpired', 'neutral'], revoked: ['statusRevoked', 'open'] };
  const [key, variant] = map[status];
  return badge(t(`usermgmt.${key}`), variant);
}

function buildInviteUrl(token) {
  return `${location.origin}${location.pathname}#/accept-invite/${token}`;
}

function renderView(container, clubs, invitations, users) {
  const me = getCurrentUser();
  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'page-head' }, [
    el('div', {}, [el('div', { class: 'page-eyebrow' }, t('usermgmt.eyebrow')), el('h1', { class: 'mt-0' }, t('usermgmt.title'))]),
  ]));
  wrap.appendChild(laneWave());
  wrap.appendChild(el('p', {}, isSuperAdmin() ? t('usermgmt.superadminIntro') : t('usermgmt.adminIntro')));

  if (isSuperAdmin()) {
    wrap.appendChild(renderClubsSection(clubs, refresh));
  }

  wrap.appendChild(renderInviteSection(clubs, users, me, refresh));
  wrap.appendChild(renderInvitationsList(invitations, clubs, refresh));
  wrap.appendChild(renderExistingUsers(users, clubs, refresh));

  wrap.appendChild(el('p', { class: 'hint', style: 'margin-top:24px' }, t('usermgmt.note')));

  container.appendChild(wrap);

  async function refresh() {
    const [c2, i2, u2] = await Promise.all(['clubs', 'invitations', 'users'].map(getAll));
    clear(container);
    renderView(container, c2, i2, u2);
  }
}

// ---------------- Superadmin: Vereine anlegen ----------------
function renderClubsSection(clubs, onChanged) {
  const card = el('div', { class: 'card mb-16' }, [
    el('div', { class: 'flex justify-between items-center mb-16' }, [
      el('h3', { class: 'mt-0' }, t('usermgmt.clubsSection')),
      el('button', { class: 'btn btn-primary btn-sm', onclick: () => openCreateClubModal(onChanged) }, t('usermgmt.createClub')),
    ]),
  ]);
  if (clubs.length === 0) {
    card.appendChild(emptyState(t('usermgmt.clubsSection'), t('usermgmt.noClubsYet'), null));
  } else {
    const table = el('table');
    table.appendChild(el('thead', {}, el('tr', {}, [el('th', {}, t('usermgmt.formClubName')), el('th', {}, '')])));
    const tbody = el('tbody');
    clubs.forEach(club => tbody.appendChild(el('tr', {}, [el('td', {}, club.name), el('td', {}, fmtDateShort((club.createdAt || '').slice(0, 10)))])));
    table.appendChild(tbody);
    card.appendChild(el('div', { class: 'table-wrap' }, table));
  }
  return card;
}

function openCreateClubModal(onChanged) {
  const form = el('form', { class: 'form-grid' });
  const fClubName = textInput('', { required: true });
  const fAdminName = textInput('', { required: true });
  const fAdminEmail = textInput('', { type: 'email', required: true });
  form.appendChild(field(t('usermgmt.formClubName'), fClubName, { span2: true }));
  form.appendChild(field(t('usermgmt.formAdminName'), fAdminName));
  form.appendChild(field(t('usermgmt.formAdminEmail'), fAdminEmail));
  form.appendChild(el('div', { class: 'form-actions', style: 'grid-column:1/-1' }, [
    el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => close() }, t('common.cancel')),
    el('button', { type: 'submit', class: 'btn btn-primary' }, t('common.create')),
  ]));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!fClubName.value.trim()) { toast(t('usermgmt.validationClubName'), 'error'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fAdminEmail.value.trim())) { toast(t('usermgmt.validationEmail'), 'error'); return; }
    const club = await put('clubs', { name: fClubName.value.trim() });
    const invitation = await put('invitations', {
      token: uid('invite'),
      role: 'admin',
      clubId: club.id,
      clubName: club.name,
      email: fAdminEmail.value.trim(),
      athleteId: null,
      invitedByUserId: getCurrentUser()?.id ?? null,
      expiresAt: isoAddDays(todayISO(), CLUB_INVITE_TTL_DAYS) + 'T00:00:00.000Z',
      usedAt: null,
      revokedAt: null,
    });
    toast(t('usermgmt.clubCreated'));
    close();
    onChanged?.();
    showInviteLinkModal(invitation);
  });
  const { close } = openModal({ title: t('usermgmt.clubModalTitle'), bodyNode: form, wide: true });
}

// ---------------- Admin/Superadmin: Team einladen ----------------
function renderInviteSection(clubs, users, me, onChanged) {
  const card = el('div', { class: 'card mb-16' }, [
    el('div', { class: 'flex justify-between items-center mb-16' }, [
      el('h3', { class: 'mt-0' }, t('usermgmt.inviteSection')),
      el('button', { class: 'btn btn-accent btn-sm', onclick: () => openInviteModal(clubs, me, onChanged) }, t('usermgmt.inviteTrainerOrAthlete')),
    ]),
  ]);
  return card;
}

function openInviteModal(clubs, me, onChanged) {
  const isSuper = isSuperAdmin();
  const form = el('form', { class: 'form-grid' });
  const fRole = selectInput([{ value: 'trainer', label: t('settings.role_trainer') }, { value: 'athlete', label: t('settings.role_athlete') }], 'trainer');
  const fEmail = textInput('', { type: 'email', required: true });
  const fClub = isSuper
    ? selectInput(clubs.map(c => ({ value: c.id, label: c.name })), clubs[0]?.id || '')
    : null;
  form.appendChild(field(t('usermgmt.formRole'), fRole));
  form.appendChild(field(t('usermgmt.formEmail'), fEmail));
  if (fClub) form.appendChild(field(t('usermgmt.colClub'), fClub, { span2: true }));
  form.appendChild(el('div', { class: 'form-actions', style: 'grid-column:1/-1' }, [
    el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => close() }, t('common.cancel')),
    el('button', { type: 'submit', class: 'btn btn-primary' }, t('common.create')),
  ]));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fEmail.value.trim())) { toast(t('usermgmt.validationEmail'), 'error'); return; }
    const clubId = isSuper ? fClub.value : me?.clubId;
    const club = clubs.find(c => c.id === clubId);
    const invitation = await put('invitations', {
      token: uid('invite'),
      role: fRole.value,
      clubId,
      clubName: club?.name || '',
      email: fEmail.value.trim(),
      athleteId: null,
      invitedByUserId: me?.id ?? null,
      expiresAt: isoAddDays(todayISO(), MEMBER_INVITE_TTL_DAYS) + 'T00:00:00.000Z',
      usedAt: null,
      revokedAt: null,
    });
    toast(t('usermgmt.inviteCreated'));
    close();
    onChanged?.();
    showInviteLinkModal(invitation);
  });
  const { close } = openModal({ title: t('usermgmt.inviteModalTitle'), bodyNode: form, wide: true });
}

function showInviteLinkModal(invitation) {
  const url = buildInviteUrl(invitation.token);
  const body = el('div');
  body.appendChild(el('p', {}, t('usermgmt.inviteLinkHint', { date: fmtDateShort((invitation.expiresAt || '').slice(0, 10)) })));
  const linkRow = el('div', { class: 'flex gap-8', style: 'margin-top:12px' }, [
    el('input', { type: 'text', readonly: true, value: url, style: 'flex:1', onclick: (e) => e.target.select() }),
    el('button', { class: 'btn btn-accent btn-sm', onclick: async () => {
      try { await navigator.clipboard.writeText(url); toast(t('usermgmt.linkCopied')); }
      catch { toast(t('usermgmt.linkCopied')); }
    } }, t('usermgmt.copyLink')),
  ]);
  body.appendChild(linkRow);
  openModal({ title: t('usermgmt.inviteLinkTitle'), bodyNode: body, wide: true });
}

// ---------------- Ausstehende/verwendete Einladungen ----------------
function renderInvitationsList(invitations, clubs, onChanged) {
  const card = el('div', { class: 'card mb-16' }, [el('h3', { class: 'mt-0' }, t('usermgmt.pendingInvitesSection'))]);
  const relevant = isSuperAdmin() ? invitations : invitations.filter(i => i.clubId === getCurrentUser()?.clubId);
  if (relevant.length === 0) { card.appendChild(el('p', {}, t('usermgmt.noInvitesYet'))); return card; }

  const table = el('table');
  table.appendChild(el('thead', {}, el('tr', {}, [
    el('th', {}, t('usermgmt.colEmail')), el('th', {}, t('usermgmt.colRole')), el('th', {}, t('usermgmt.colClub')),
    el('th', {}, t('usermgmt.colStatus')), el('th', {}, t('usermgmt.colExpires')), el('th', {}, ''),
  ])));
  const tbody = el('tbody');
  relevant.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).forEach(invitation => {
    const status = statusOf(invitation);
    tbody.appendChild(el('tr', {}, [
      el('td', {}, invitation.email), el('td', {}, badge(t(`settings.role_${invitation.role}`), 'neutral')),
      el('td', {}, invitation.clubName || '—'), el('td', {}, statusBadge(status)),
      el('td', {}, fmtDateShort((invitation.expiresAt || '').slice(0, 10))),
      el('td', {}, status === 'pending' ? el('button', {
        class: 'btn btn-danger btn-sm',
        onclick: () => confirmAction(t('usermgmt.revokeConfirm'), async () => {
          await put('invitations', { ...invitation, revokedAt: new Date().toISOString() });
          toast(t('usermgmt.inviteRevoked'));
          onChanged?.();
        }),
      }, t('usermgmt.revokeInvite')) : null),
    ]));
  });
  table.appendChild(tbody);
  card.appendChild(el('div', { class: 'table-wrap' }, table));
  return card;
}

// ---------------- Bestehende Nutzer:innen ----------------
function renderExistingUsers(users, clubs, onChanged) {
  const card = el('div', { class: 'card' }, [el('h3', { class: 'mt-0' }, t('usermgmt.existingUsersSection'))]);
  const me = getCurrentUser();
  const relevant = isSuperAdmin() ? users : users.filter(u => u.clubId === me?.clubId);
  if (relevant.length === 0) { card.appendChild(el('p', {}, t('usermgmt.noUsersYet'))); return card; }

  const table = el('table');
  table.appendChild(el('thead', {}, el('tr', {}, [
    el('th', {}, t('athletes.colName')), el('th', {}, t('settings.roleLabel')), el('th', {}, t('usermgmt.colClub')), el('th', {}, ''),
  ])));
  const tbody = el('tbody');
  relevant.forEach(user => {
    const club = clubs.find(c => c.id === user.clubId);
    const isSelf = user.id === me?.id;
    tbody.appendChild(el('tr', {}, [
      el('td', {}, fullName2(user)), el('td', {}, badge(t(`settings.role_${user.role}`), 'neutral')),
      el('td', {}, club?.name || '—'),
      el('td', {}, isSelf ? null : el('button', {
        class: 'btn btn-danger btn-sm',
        onclick: () => confirmAction(t('usermgmt.removeUserConfirm'), async () => {
          await remove('users', user.id);
          toast(t('usermgmt.userRemoved'));
          onChanged?.();
        }),
      }, t('usermgmt.removeUser'))),
    ]));
  });
  table.appendChild(tbody);
  card.appendChild(el('div', { class: 'table-wrap' }, table));
  return card;
}

function fullName2(user) { return user.name || user.email; }
