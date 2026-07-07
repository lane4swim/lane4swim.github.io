// ============================================================
// modules/stats.js — Statistiken und Auswertungen
// ============================================================
import { getAll } from '../db.js';
import {
  el, clear, field, selectInput, badge, emptyState, laneWave, fullName,
  groupBy, average, secToTime, svgBarChart, svgLineChart, todayISO, isoAddDays, fmtDateShort,
} from '../utils.js';
import { EVENTS } from '../refdata.js';

export const statsModule = {
  id: 'stats',
  label: 'Statistiken',
  roles: ['trainer', 'admin'],
  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>`,
  async render(container) {
    clear(container);
    const [athletes, results, sessions, groups] = await Promise.all(['athletes', 'results', 'sessions', 'groups'].map(getAll));
    renderView(container, athletes, results, sessions, groups);
  }
};

function renderView(container, athletes, results, sessions, groups) {
  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'page-head' }, [el('div', {}, [el('div', { class: 'page-eyebrow' }, 'Auswertungen'), el('h1', { class: 'mt-0' }, 'Statistiken')])]));
  wrap.appendChild(laneWave());

  // -------- Attendance rate per group --------
  const attCard = el('div', { class: 'card mb-16' }, [el('h3', { class: 'mt-0' }, 'Anwesenheitsquote pro Gruppe (letzte Einheiten)')]);
  const bars = groups.map(g => {
    let present = 0, total = 0;
    sessions.filter(s => s.groupId === g.id).forEach(s => (s.attendance || []).forEach(a => { total++; if (a.present) present++; }));
    return { label: g.name, value: total ? Math.round((present / total) * 100) : 0 };
  });
  if (bars.every(b => b.value === 0) && sessions.length === 0) attCard.appendChild(el('p', {}, 'Noch keine Trainingseinheiten erfasst.'));
  else attCard.appendChild(svgBarChart({ bars, yFormat: (v) => v + '%', color: 'var(--c-petrol)' }));
  wrap.appendChild(attCard);

  // -------- RPE trend over time (team average per session) --------
  const rpeCard = el('div', { class: 'card mb-16' }, [el('h3', { class: 'mt-0' }, 'Empfundene Belastung (Ø RPE je Einheit)')]);
  const rpePoints = sessions.slice().sort((a, b) => a.date.localeCompare(b.date)).map(s => {
    const vals = (s.attendance || []).filter(a => a.present && a.rpe).map(a => a.rpe);
    return vals.length ? { y: average(vals), label: fmtDateShort(s.date) } : null;
  }).filter(Boolean);
  if (rpePoints.length < 2) rpeCard.appendChild(el('p', {}, 'Noch nicht genug RPE-Daten für einen Trend.'));
  else rpeCard.appendChild(svgLineChart({ points: rpePoints, yFormat: (v) => v.toFixed(1), color: 'var(--c-lane-d)' }));
  wrap.appendChild(rpeCard);

  // -------- Training volume (planned distance would need plans; use results count as activity proxy) --------
  const volCard = el('div', { class: 'card mb-16' }, [el('h3', { class: 'mt-0' }, 'Erfasste Zeiten pro Monat')]);
  const byMonth = groupBy(results, r => r.date.slice(0, 7));
  const months = Object.keys(byMonth).sort().slice(-6);
  if (months.length === 0) volCard.appendChild(el('p', {}, 'Noch keine Zeiten erfasst.'));
  else volCard.appendChild(svgBarChart({ bars: months.map(m => ({ label: m.slice(5) + '/' + m.slice(2, 4), value: byMonth[m].length })), color: 'var(--c-chlorine-d)' }));
  wrap.appendChild(volCard);

  // -------- Individual progress explorer --------
  const exploreCard = el('div', { class: 'card' }, [el('h3', { class: 'mt-0' }, 'Leistungsentwicklung im Detail')]);
  let athleteId = athletes[0]?.id, event = EVENTS[0];
  const controls = el('div', { class: 'grid grid-2 mb-16' }, [
    field('Athlet:in', selectInput(athletes.map(a => ({ value: a.id, label: fullName(a) })), athleteId, { onchange: (e) => { athleteId = e.target.value; drawExplore(); } })),
    field('Disziplin', selectInput(EVENTS.map(e => ({ value: e, label: e })), event, { onchange: (e) => { event = e.target.value; drawExplore(); } })),
  ]);
  exploreCard.appendChild(controls);
  const exploreHost = el('div');
  exploreCard.appendChild(exploreHost);
  wrap.appendChild(exploreCard);
  container.appendChild(wrap);

  function drawExplore() {
    clear(exploreHost);
    const series = results.filter(r => r.athleteId === athleteId && r.event === event).sort((a, b) => a.date.localeCompare(b.date));
    if (series.length === 0) { exploreHost.appendChild(emptyState('Keine Daten', 'Für diese Kombination liegen noch keine Zeiten vor.', null)); return; }
    if (series.length === 1) { exploreHost.appendChild(el('p', {}, `Einzige erfasste Zeit: ${secToTime(series[0].time)} am ${fmtDateShort(series[0].date)}.`)); return; }
    const first = series[0].time, last = series[series.length - 1].time;
    const delta = first - last;
    exploreHost.appendChild(el('p', {}, [
      `Entwicklung über ${series.length} Zeiten: `,
      el('span', { class: 'data' }, secToTime(first)), ' → ', el('span', { class: 'data' }, secToTime(last)), ' ',
      badge(delta > 0 ? `−${delta.toFixed(2)}s schneller` : delta < 0 ? `+${(-delta).toFixed(2)}s langsamer` : 'unverändert', delta > 0 ? 'done' : delta < 0 ? 'open' : 'neutral'),
    ]));
    exploreHost.appendChild(svgLineChart({ points: series.map(r => ({ y: r.time, label: fmtDateShort(r.date) })), yFormat: secToTime, invertY: true, color: 'var(--c-chlorine-d)' }));
  }
  drawExplore();
}
