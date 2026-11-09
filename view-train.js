// Cut — Train screen (workout logging, swaps, rest timer, cardio)
import { PROGRAM, SESSIONS, EQUIP, VARIANT_CUES } from './data.js';
import * as L from './logic.js';
import { store, save, saveSoon, today, day, peekDay } from './store.js';
import { esc, fmt, toast, openSheet, closeSheet, rerender, ICONS, liftUnit } from './ui.js';

const SHORT = { lowerA: 'Low A', push: 'Push', pull: 'Pull', lowerB: 'Low B', upper: 'Upper' };
let viewKey = null;
const sel = () => viewKey || today();
export function onEnter() { viewKey = null; }
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const findEx = (session, key) => PROGRAM[session].ex.find((e) => e.key === key);

function planFor(k) {
  return L.weekPlan(store.state, k, today()).plan[k] || {};
}
function ensureWorkout(k, session) {
  const d = day(k);
  if (!d.workout || d.workout.session !== session) d.workout = { session, ex: {}, done: false };
  return d.workout;
}
function exState(w, ex) {
  if (!w.ex[ex.key]) w.ex[ex.key] = { vi: 0, name: ex.v[0][0], sets: [] };
  const e = w.ex[ex.key];
  if (!Array.isArray(e.sets)) e.sets = [];
  return e;
}

function weekStrip(wp, k, td) {
  return `<div class="week" role="tablist">${wp.days.map((dk) => {
    const p = wp.plan[dk] || {};
    const label = p.session ? SHORT[p.session] : p.status === 'busy' ? 'Busy' : p.status === 'free' ? 'Free' : p.status === 'prestart' ? '—' : 'Rest';
    const mark = p.status === 'done' ? ICONS.check : p.status === 'missed' ? ICONS.x : '';
    return `<button class="wk ${p.status || ''} ${dk === k ? 'sel' : ''} ${dk === td ? 'is-today' : ''}" data-act="wDay" data-k="${dk}" role="tab" aria-selected="${dk === k}">
      <span>${L.wd(dk)}</span><b>${label}</b><i>${mark}</i></button>`;
  }).join('')}</div>`;
}

function exCard(k, ex, i, w, mode) {
  const st = store.state;
  const e = (w && w.ex && w.ex[ex.key]) || { vi: 0, sets: [] };
  const vi = e.vi || 0;
  const [name, equip] = ex.v[vi] || ex.v[0];
  const last = L.lastPerformance(st, name, k);
  const sug = L.suggestion(ex, last, equip);
  const nSets = ex.sets + (e.extra || 0);
  const doneN = (e.sets || []).filter((x) => x && x.done).length;
  const lu = equip === 'bw' ? 'BW' : liftUnit();
  let rows = '';
  if (mode !== 'preview') {
    for (let j = 0; j < nSets; j++) {
      const sv = (e.sets || [])[j] || {};
      rows += `<div class="set ${sv.done ? 'on' : ''}">
        <span class="set-i">${j + 1}</span>
        <input class="in-w" type="text" inputmode="decimal" data-inp="wSet" data-f="w" data-key="${ex.key}" data-j="${j}" value="${esc(sv.w ?? '')}" placeholder="${sug.w ?? (equip === 'bw' ? 'BW' : lu)}" aria-label="Weight">
        <span class="x">${lu} ×</span>
        <input class="in-r" type="text" inputmode="numeric" data-inp="wSet" data-f="r" data-key="${ex.key}" data-j="${j}" value="${esc(sv.r ?? '')}" placeholder="${sug.r}" aria-label="Reps">
        <button class="chk ${sv.done ? 'on' : ''}" data-act="wSetDone" data-key="${ex.key}" data-j="${j}" aria-label="Set ${j + 1} done">${ICONS.check}</button>
      </div>`;
    }
  }
  const lastTxt = last ? `Last ${L.fmtShort(last.date)}: ${last.sets.map((x) => (equip === 'bw' ? x.r : `${fmt(x.w, x.w % 1 ? 1 : 0)}×${x.r}`)).join(' · ')}` : 'No history yet';
  return `<article class="ex ${doneN >= nSets ? 'done' : ''}">
    <div class="ex-h">
      <span class="ex-n">${doneN >= nSets ? ICONS.check : i + 1}</span>
      <div class="ex-t"><b>${esc(name)}</b><small>${ex.sets} × ${ex.reps[0]}–${ex.reps[1]} · rest ${mmss(ex.rest)} · ${EQUIP[equip].label}</small></div>
      ${ex.v.length > 1 && mode !== 'preview' ? `<button class="btn sm ghost" data-act="wSwap" data-key="${ex.key}" aria-label="Swap exercise">${ICONS.swap}Swap</button>` : ''}
    </div>
    <div class="ex-last">${esc(lastTxt)}<b class="${sug.up ? 'up' : ''}">${esc(sug.text)}</b></div>
    <div class="ex-cue">${esc((vi > 0 && VARIANT_CUES[name]) || ex.cue)}</div>
    ${rows ? `<div class="sets">${rows}</div><button class="link sm" data-act="wAddSet" data-key="${ex.key}">+ Add set</button>` : ''}
    ${mode === 'preview' && ex.v.length > 1 ? `<div class="ex-alt">Swaps: ${ex.v.slice(1).map((v) => esc(v[0])).join(' · ')}</div>` : ''}
  </article>`;
}

export function render() {
  const st = store.state;
  const s = st.settings;
  const td = today();
  if (viewKey && L.weekStart(viewKey) !== L.weekStart(td) && Math.abs(L.diffDays(td, viewKey)) > 14) viewKey = null;
  const k = sel();
  const wp = L.weekPlan(st, k, td);
  const p = wp.plan[k] || {};
  const d = peekDay(k);
  const exam = L.isExam(k, s, d);
  const isFuture = k > td;

  let note = '';
  const futureSlots = wp.days.filter((dk) => dk >= td && ['today', 'planned'].includes((wp.plan[dk] || {}).status)).length;
  if (wp.unplaced.length && L.weekStart(k) === L.weekStart(td) && futureSlots === 0) {
    const sun = wp.days[6];
    note = `<section class="banner"><b>${wp.unplaced.map((x) => PROGRAM[x].name).join(', ')}</b> didn't fit this week. That's fine. Make it up Sunday if you feel good.
      ${sun >= td && !(st.days[sun] || {}).train ? '<button class="btn sm" data-act="wMakeup">Add to Sunday</button>' : ''}</section>`;
  }

  let body;
  if (p.session) {
    const prog = PROGRAM[p.session];
    const w = d.workout && d.workout.session === p.session ? d.workout : null;
    const list = L.exercisesFor(p.session, exam);
    const total = list.reduce((n, e) => n + e.sets + ((w && w.ex[e.key] && w.ex[e.key].extra) || 0), 0);
    const doneSets = L.setsDone(w);
    const cp = L.cardioPlan(st, k, p.session);
    const cDone = !!(d.cardio && d.cardio.done);
    const mode = isFuture ? 'preview' : 'log';
    const statusTxt = p.status === 'done' ? 'Done' : k === td ? 'Today' : isFuture ? 'Planned' : 'Past day';
    body = `
    <section class="card sess">
      <div class="sess-h">
        <div><div class="eyebrow">${esc(L.fmtDate(k))} · ${statusTxt}</div><h2>${esc(prog.name)}</h2><p class="muted">${esc(prog.focus)}${exam ? ' · exam mode: top 4 lifts' : ''}</p></div>
        <div class="sess-prog"><b>${doneSets}</b><span>/ ${total} sets</span></div>
      </div>
      ${mode === 'log' && p.status !== 'done' ? '<p class="ex-hint">Grey numbers are your target. Hit them, tap ✓. Beat them, type the real numbers first.</p>' : ''}
      <div class="row wrap">
        <button class="chip-btn ${exam ? 'on' : ''}" data-act="wExam" aria-pressed="${exam}">Exam mode</button>
        <button class="chip-btn" data-act="wPick">Change session</button>
        ${k === td && p.status !== 'done' ? '<button class="chip-btn" data-act="wBusy">Busy today</button>' : ''}
      </div>
    </section>
    ${list.map((ex, i) => exCard(k, ex, i, w, mode)).join('')}
    ${cp.min > 0 ? `<section class="card cardio ${cDone ? 'done' : ''}">
      <div class="card-h"><h2>Cardio</h2><span class="pill">${cp.min} min</span></div>
      <p class="strong">${esc(cp.title)}</p><p class="muted">${esc(cp.detail || '')}</p>
      ${isFuture ? '' : `<div class="row"><label class="field sm"><input type="number" inputmode="numeric" data-inp="wCardioMin" value="${(d.cardio && d.cardio.min) || cp.min}" aria-label="Cardio minutes"><span>min</span></label>
        <button class="btn grow ${cDone ? 'good' : ''}" data-act="wCardio">${cDone ? `${ICONS.check}Cardio done` : 'Mark cardio done'}</button></div>`}
    </section>` : ''}
    ${isFuture ? '<p class="muted center">Preview. Logging opens on the day.</p>'
      : p.status === 'done' ? `<button class="btn block ghost" data-act="wUndoFinish">${ICONS.check}Workout done · undo</button>`
      : '<button class="btn primary block" data-act="wFinish">Finish workout</button>'}`;
  } else {
    const type = L.dayType(k, s);
    const msgs = {
      busy: ['Busy day', 'Gym skipped. Your sessions slide to the next gym day.'],
      prestart: ['Before your start', 'Nothing to log for this day.'],
      missed: ['Missed', 'No sets logged. The session moved to your next gym day.'],
      free: ['All 5 sessions done', 'Week complete. Rest, steps, or extra cardio.'],
      rest: type === 'between' ? ['Between shifts', 'No gym. Sleep 12:00–19:00 and let the shift cover your steps.']
        : type === 'post' ? ['Recovery day', 'Outdoor walk 45–60 min + meal prep. Bed 23:30.']
        : ['Rest day', 'Hit 12k steps.'],
    };
    const [h, sub] = msgs[p.status] || msgs.rest;
    const canTrain = (p.status === 'rest' || p.status === 'free') && k >= td;
    body = `<section class="card empty-state"><h2>${h}</h2><p class="muted">${sub}</p>
      <div class="row wrap center">
        ${p.status === 'busy' && k === td ? '<button class="btn" data-act="wBusy">Undo busy</button>' : ''}
        ${canTrain ? '<button class="btn" data-act="wTrainDay">Train anyway</button>' : ''}
        ${k < td && !['busy', 'prestart'].includes(p.status) ? '<button class="btn" data-act="wPick">Log a session for this day</button>' : ''}
      </div></section>`;
  }

  return `<header class="top"><div class="eyebrow">Week of ${esc(L.fmtShort(wp.ws))}</div><h1>Train</h1></header>
    ${weekStrip(wp, k, td)}${note}${body}`;
}

// ---------- rest timer ----------
let timerEnd = 0;
let timerInt = null;
let audioCtx = null;
function beep() {
  try {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    [0, 0.22].forEach((off) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t0 + off);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + off + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.16);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0 + off);
      o.stop(t0 + off + 0.18);
    });
  } catch (e) { /* audio blocked */ }
  try { if (navigator.vibrate) navigator.vibrate([120, 80, 120]); } catch (e) { /* no vibration */ }
}
function tick() {
  const el = document.querySelector('#timer .t-time');
  if (!el) return;
  const left = Math.max(0, Math.round((timerEnd - Date.now()) / 1000));
  el.textContent = left === 0 ? 'Go' : mmss(left);
  el.classList.toggle('go', left === 0);
  if (left === 0 && timerInt) {
    clearInterval(timerInt);
    timerInt = null;
    beep();
    setTimeout(() => { if (!timerInt) stopTimer(); }, 5000);
  }
}
export function startTimer(sec) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { audioCtx = null; }
  timerEnd = Date.now() + sec * 1000;
  const el = document.getElementById('timer');
  el.innerHTML = `<button class="t-btn" data-act="timerAdd" data-v="-15">−15</button>
    <span class="t-ic">${ICONS.timer}</span><span class="t-time"></span>
    <button class="t-btn" data-act="timerAdd" data-v="15">+15</button>
    <button class="t-btn x" data-act="timerStop" aria-label="Close timer">${ICONS.x}</button>`;
  el.hidden = false;
  clearInterval(timerInt);
  timerInt = setInterval(tick, 250);
  tick();
}
export function stopTimer() {
  clearInterval(timerInt);
  timerInt = null;
  const el = document.getElementById('timer');
  el.hidden = true;
  el.innerHTML = '';
}

function sessionSheet() {
  const td = today();
  const k = sel();
  const wp = L.weekPlan(store.state, k, td);
  const doneSet = new Set(wp.days.filter((dk) => (wp.plan[dk] || {}).status === 'done').map((dk) => wp.plan[dk].session));
  const cur = (wp.plan[k] || {}).session;
  openSheet(`<h3>Pick a session</h3><p class="muted">For ${esc(L.fmtDate(k))}. The rest of the week re-plans around it.</p>
    <div class="list">${SESSIONS.map((x) => `<button class="li ${x === cur ? 'on' : ''}" data-act="wPickSet" data-s="${x}">
      <span class="li-main"><b>${PROGRAM[x].name}</b><span>${PROGRAM[x].focus}</span></span>
      ${doneSet.has(x) ? '<span class="pill good">done this week</span>' : x === cur ? '<span class="pill">current</span>' : ''}</button>`).join('')}</div>
    ${(store.state.days[k] || {}).session ? '<button class="btn block ghost" data-act="wPickAuto">Back to the planned order</button>' : ''}`);
}

export const actions = {
  wDay(el) { viewKey = el.dataset.k === today() ? null : el.dataset.k; rerender(); },
  wPick: sessionSheet,
  wPickSet(el) {
    const k = sel();
    const sNew = el.dataset.s;
    const d = day(k);
    if (d.workout && d.workout.session !== sNew && L.setsDone(d.workout) > 0
      && !confirm(`You logged sets for ${PROGRAM[d.workout.session].name}. Switch anyway?`)) return;
    d.session = sNew;
    delete d.busy;
    if (!L.isGymEligible(k, store.state.settings)) d.train = true;
    if (d.workout && d.workout.session !== sNew) d.workout = { session: sNew, ex: {}, done: false };
    save(); closeSheet();
    if (!location.hash.startsWith('#train')) location.hash = 'train'; else rerender();
    toast(`${PROGRAM[sNew].name} it is`);
  },
  wPickAuto() { const d = day(sel()); delete d.session; save(); closeSheet(); rerender(); },
  wSetDone(el) {
    const k = sel();
    const p = planFor(k);
    if (!p.session) return;
    const ex = findEx(p.session, el.dataset.key);
    const j = +el.dataset.j;
    const w = ensureWorkout(k, p.session);
    const e = exState(w, ex);
    const cur = e.sets[j] || {};
    if (cur.done) { e.sets[j] = { ...cur, done: false }; w.done = false; save(); rerender(); return; }
    const row = el.closest('.set');
    const wIn = row.querySelector('.in-w');
    const rIn = row.querySelector('.in-r');
    const equip = (ex.v[e.vi || 0] || ex.v[0])[1];
    const wv = L.num(wIn.value) ?? L.num(wIn.placeholder) ?? (equip === 'bw' ? 0 : null);
    const rv = L.num(rIn.value) ?? L.num(rIn.placeholder);
    if (wv == null) { wIn.focus(); return toast('Enter the weight'); }
    if (!rv) { rIn.focus(); return toast('Enter reps'); }
    e.name = (ex.v[e.vi || 0] || ex.v[0])[0];
    e.sets[j] = { w: wv, r: rv, done: true };
    // carry the weight into the next empty set
    const nxt = e.sets[j + 1];
    if (!nxt || nxt.w === undefined || nxt.w === '') e.sets[j + 1] = { ...(nxt || {}), w: wv };
    const list = L.exercisesFor(p.session, L.isExam(k, store.state.settings, store.state.days[k]));
    const allDone = list.every((x) => {
      const es = w.ex[x.key];
      const need = x.sets + ((es && es.extra) || 0);
      return es && es.sets.filter((q) => q && q.done).length >= need;
    });
    if (allDone && !w.done) { w.done = true; toast('All sets done. Workout logged. Cardio next.'); stopTimer(); }
    else startTimer(ex.rest);
    // trim the helper "next set" stub if it is beyond the planned count
    const need = ex.sets + (e.extra || 0);
    if (e.sets.length > need) e.sets.length = need;
    save(); rerender();
  },
  wSwap(el) {
    const k = sel();
    const p = planFor(k);
    if (!p.session) return;
    const ex = findEx(p.session, el.dataset.key);
    const w = ensureWorkout(k, p.session);
    const e = exState(w, ex);
    if (e.sets.some((x) => x && x.done) && !confirm('Swapping clears the sets you logged for this exercise. Continue?')) return;
    e.vi = ((e.vi || 0) + 1) % ex.v.length;
    e.name = ex.v[e.vi][0];
    e.sets = [];
    save(); rerender();
    toast(`Swapped to ${e.name}`);
  },
  wAddSet(el) {
    const k = sel();
    const p = planFor(k);
    if (!p.session) return;
    const ex = findEx(p.session, el.dataset.key);
    const w = ensureWorkout(k, p.session);
    const e = exState(w, ex);
    e.extra = (e.extra || 0) + 1;
    w.done = false;
    save(); rerender();
  },
  wFinish() {
    const k = sel();
    const p = planFor(k);
    if (!p.session) return;
    const w = ensureWorkout(k, p.session);
    if (L.setsDone(w) === 0 && !confirm('No sets logged. Mark the workout done anyway?')) return;
    w.done = true;
    stopTimer(); save(); rerender();
    toast('Workout logged');
  },
  wUndoFinish() {
    const d = day(sel());
    if (d.workout) d.workout.done = false;
    save(); rerender();
  },
  wExam() {
    const k = sel();
    const s = store.state.settings;
    const d = day(k);
    const cur = L.isExam(k, s, d);
    if (!cur === L.inRange(k, s.exams)) delete d.exam; else d.exam = !cur;
    save(); rerender();
  },
  wBusy() {
    const d = day(today());
    d.busy = !d.busy;
    if (!d.busy) delete d.busy;
    save(); rerender();
    toast(d.busy ? 'Skipped. Sessions slide to your next gym day.' : 'Back on');
  },
  wTrainDay() { day(sel()).train = true; save(); rerender(); },
  wMakeup() {
    const wp = L.weekPlan(store.state, today(), today());
    day(wp.days[6]).train = true;
    save(); rerender();
    toast('Added to Sunday');
  },
  wCardio() {
    const k = sel();
    const d = day(k);
    const inp = document.querySelector('[data-inp=wCardioMin]');
    const p = planFor(k);
    const cp = L.cardioPlan(store.state, k, p.session);
    const min = (inp && L.num(inp.value)) || (d.cardio && d.cardio.min) || cp.min;
    d.cardio = { min, done: !(d.cardio && d.cardio.done) };
    save(); rerender();
    if (d.cardio.done) toast(`${min} min cardio logged`);
  },
  timerAdd(el) { timerEnd += parseInt(el.dataset.v, 10) * 1000; if (!timerInt) timerInt = setInterval(tick, 250); tick(); },
  timerStop: stopTimer,
};

export const inputs = {
  wSet(el) {
    const k = sel();
    const p = planFor(k);
    if (!p.session) return;
    const ex = findEx(p.session, el.dataset.key);
    const w = ensureWorkout(k, p.session);
    const e = exState(w, ex);
    const j = +el.dataset.j;
    e.sets[j] = { ...(e.sets[j] || {}), [el.dataset.f]: el.value };
    if (!e.name) e.name = (ex.v[e.vi || 0] || ex.v[0])[0];
    saveSoon();
  },
  wCardioMin(el) {
    const d = day(sel());
    const v = L.num(el.value);
    if (v == null) return;
    d.cardio = { ...(d.cardio || {}), min: v };
    saveSoon();
  },
};
