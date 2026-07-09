// ============================================================
// modules/dashboard.js
// ============================================================
import { getAll } from '../db.js';
import { el, clear, fmtDateLong, todayISO, fullName, statCard, badge, laneWave, groupBy, average, secToTime } from '../utils.js';
import { getRole, getCurrentUser } from '../state.js';
import { navigate } from '../router.js';
import { totalDistance } from './setEditor.js';

export const dashboardModule = {
  id: 'dashboard',
  label: 'Dashboard',
  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="11" width="8" height="10" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/></svg>`,
  async render(container) {
    clear(container);
    const role = getRole();
    if (role === 'athlete') return renderAthleteDashboard(container);
    return renderTrainerDashboard(container);
  }
};

async function renderTrainerDashboard(container) {
  const [athletes, groups, plans, sessions, actionItems, competitions] = await Promise.all(
    ['athletes', 'groups', 'plans', 'sessions', 'actionItems', 'competitions'].map(getAll)
  );

  const today = todayISO();
  const upcomingComps = competitions.filter(c => c.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const openActions = actionItems.filter(a => a.status !== 'done');
  const recentSessions = [...sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const upcomingPlanDays = [];
  plans.forEach(p => p.days?.forEach(d => { if (d.date >= today) upcomingPlanDays.push({ plan: p, day: d }); }));
  upcomingPlanDays.sort((a, b) => a.day.date.localeCompare(b.day.date));

  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'page-head' }, [
    el('div', {}, [el('div', { class: 'page-eyebrow' }, 'Übersicht'), el('h1', { class: 'mt-0' }, 'Willkommen zurück')]),
  ]));
  wrap.appendChild(laneWave());

  const stats = el('div', { class: 'grid grid-4 mb-16' }, [
    statCard({ label: 'Aktive Athleten', value: athletes.filter(a => a.active).length, sub: `${groups.length} Gruppen` }),
    statCard({ label: 'Nächster Wettkampf', value: upcomingComps[0] ? fmtDateLong(upcomingComps[0].date) : '—', sub: upcomingComps[0]?.name || 'Keiner geplant', alt: true }),
    statCard({ label: 'Offene Handlungsfelder', value: openActions.length, sub: `${actionItems.length} gesamt` }),
    statCard({ label: 'Geplante Einheiten', value: upcomingPlanDays.length, sub: 'kommend', alt: true }),
  ]);
  wrap.appendChild(stats);

  const grid = el('div', { class: 'grid grid-2' });

  const planCard = el('div', { class: 'card' }, [el('h3', {}, 'Nächste Trainingseinheiten')]);
  if (upcomingPlanDays.length === 0) {
    planCard.appendChild(el('p', {}, 'Keine geplanten Einheiten in der Zukunft.'));
    planCard.appendChild(el('button', { class: 'btn btn-primary btn-sm', onclick: () => navigate('plans') }, 'Plan erstellen'));
  } else {
    upcomingPlanDays.slice(0, 5).forEach(({ plan, day }) => {
      const group = groups.find(g => g.id === plan.groupId);
      planCard.appendChild(el('div', { class: 'list-row row-click', onclick: () => navigate('plans', plan.id) }, [
        el('div', { class: 'avatar' }, (group?.name || '?').slice(0, 2).toUpperCase()),
        el('div', { style: 'flex:1' }, [
          el('div', {}, `${fmtDateLong(day.date)}`),
          el('div', { class: 'text-slate text-sm' }, `${plan.name} · ${totalDistance(day.sets || [])} m geplant`),
        ]),
      ]));
    });
  }
  grid.appendChild(planCard);

  const compCard = el('div', { class: 'card' }, [el('h3', {}, 'Anstehende Wettkämpfe')]);
  if (upcomingComps.length === 0) {
    compCard.appendChild(el('p', {}, 'Kein Wettkampf in Planung.'));
  } else {
    upcomingComps.slice(0, 4).forEach(c => {
      compCard.appendChild(el('div', { class: 'list-row row-click', onclick: () => navigate('competitions', c.id) }, [
        el('div', { style: 'flex:1' }, [
          el('div', {}, c.name),
          el('div', { class: 'text-slate text-sm' }, `${fmtDateLong(c.date)} · ${c.location || '—'}`),
        ]),
        badge(c.course || '', 'neutral'),
      ]));
    });
  }
  compCard.appendChild(el('button', { class: 'btn btn-ghost btn-sm', style: 'margin-top:8px', onclick: () => navigate('competitions') }, 'Alle Wettkämpfe →'));
  grid.appendChild(compCard);

  const actionCard = el('div', { class: 'card' }, [el('h3', {}, 'Offene Handlungsfelder')]);
  if (openActions.length === 0) {
    actionCard.appendChild(el('p', {}, 'Aktuell keine offenen Punkte. Gute Arbeit!'));
  } else {
    openActions.slice(0, 5).forEach(a => {
      const athlete = athletes.find(x => x.id === a.athleteId);
      actionCard.appendChild(el('div', { class: 'list-row row-click', onclick: () => navigate('actionitems', a.id) }, [
        el('div', { class: 'avatar' }, fullName(athlete).split(' ').map(p => p[0]).join('')),
        el('div', { style: 'flex:1' }, [
          el('div', {}, a.title),
          el('div', { class: 'text-slate text-sm' }, fullName(athlete)),
        ]),
        badge(a.status === 'progress' ? 'In Bearbeitung' : 'Offen', a.status === 'progress' ? 'progress' : 'open'),
      ]));
    });
  }
  actionCard.appendChild(el('button', { class: 'btn btn-ghost btn-sm', style: 'margin-top:8px', onclick: () => navigate('actionitems') }, 'Alle Handlungsfelder →'));
  grid.appendChild(actionCard);

  const sessionCard = el('div', { class: 'card' }, [el('h3', {}, 'Letzte Trainingseinheiten')]);
  if (recentSessions.length === 0) {
    sessionCard.appendChild(el('p', {}, 'Noch keine Einheiten erfasst.'));
  } else {
    recentSessions.forEach(s => {
      const present = s.attendance?.filter(a => a.present).length || 0;
      const total = s.attendance?.length || 0;
      const rpeAvg = average(s.attendance?.filter(a => a.present && a.rpe).map(a => a.rpe) || []);
      sessionCard.appendChild(el('div', { class: 'list-row row-click', onclick: () => navigate('sessions', s.id) }, [
        el('div', { style: 'flex:1' }, [
          el('div', {}, fmtDateLong(s.date)),
          el('div', { class: 'text-slate text-sm' }, `Anwesend ${present}/${total}${rpeAvg ? ` · Ø RPE ${rpeAvg.toFixed(1)}` : ''}`),
        ]),
      ]));
    });
  }
  sessionCard.appendChild(el('button', { class: 'btn btn-ghost btn-sm', style: 'margin-top:8px', onclick: () => navigate('sessions') }, 'Alle Einheiten →'));
  grid.appendChild(sessionCard);

  wrap.appendChild(grid);
  container.appendChild(wrap);
}

async function renderAthleteDashboard(container) {
  const user = getCurrentUser();
  const [athletes, results, plans, actionItems, competitions] = await Promise.all(
    ['athletes', 'results', 'plans', 'actionItems', 'competitions'].map(getAll)
  );
  const me = athletes.find(a => a.id === user?.athleteId);
  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'page-head' }, [
    el('div', {}, [el('div', { class: 'page-eyebrow' }, 'Mein Training'), el('h1', { class: 'mt-0' }, me ? `Hallo, ${me.firstName}!` : 'Willkommen')]),
  ]));
  wrap.appendChild(laneWave());

  if (!me) {
    wrap.appendChild(el('p', {}, 'Kein Athletenprofil mit diesem Konto verknüpft.'));
    container.appendChild(wrap);
    return;
  }

  const myResults = results.filter(r => r.athleteId === me.id).sort((a, b) => b.date.localeCompare(a.date));
  const pbs = groupBy(myResults, r => r.event);
  const today = todayISO();
  const upcomingComps = competitions.filter(c => c.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const myPlans = plans.filter(p => p.groupId === me.groupId);
  const nextDay = [];
  myPlans.forEach(p => p.days?.forEach(d => { if (d.date >= today) nextDay.push({ p, d }); }));
  nextDay.sort((a, b) => a.d.date.localeCompare(b.d.date));
  const myActions = actionItems.filter(a => a.athleteId === me.id);

  wrap.appendChild(el('div', { class: 'grid grid-3 mb-16' }, [
    statCard({ label: 'Persönliche Bestzeiten', value: Object.keys(pbs).length, sub: 'Disziplinen' }),
    statCard({ label: 'Nächstes Training', value: nextDay[0] ? fmtDateLong(nextDay[0].d.date) : '—', sub: nextDay[0]?.p.name || '', alt: true }),
    statCard({ label: 'Offene Ziele', value: myActions.filter(a => a.status !== 'done').length, sub: `${myActions.length} gesamt` }),
  ]));

  const grid = el('div', { class: 'grid grid-2' });

  const pbCard = el('div', { class: 'card' }, [el('h3', {}, 'Aktuelle Bestzeiten')]);
  if (Object.keys(pbs).length === 0) {
    pbCard.appendChild(el('p', {}, 'Noch keine Zeiten erfasst.'));
  } else {
    Object.entries(pbs).forEach(([evt, list]) => {
      const best = list.reduce((a, b) => (a.time < b.time ? a : b));
      pbCard.appendChild(el('div', { class: 'list-row' }, [
        el('div', { style: 'flex:1' }, evt),
        el('div', { class: 'data' }, secToTime(best.time)),
      ]));
    });
  }
  grid.appendChild(pbCard);

  const compCard = el('div', { class: 'card' }, [el('h3', {}, 'Anstehende Wettkämpfe')]);
  if (upcomingComps.length === 0) compCard.appendChild(el('p', {}, 'Aktuell nichts geplant.'));
  else upcomingComps.slice(0, 4).forEach(c => compCard.appendChild(el('div', { class: 'list-row' }, [
    el('div', { style: 'flex:1' }, [el('div', {}, c.name), el('div', { class: 'text-slate text-sm' }, fmtDateLong(c.date))]),
  ])));
  grid.appendChild(compCard);

  wrap.appendChild(grid);
  container.appendChild(wrap);
}
