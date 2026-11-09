// Cut — Today screen
import { PROGRAM, DAY_TYPE_LABEL } from './data.js';
import * as L from './logic.js';
import { store, save, today, day, peekDay } from './store.js';
import { esc, fmt, ring, bar, toast, openSheet, closeSheet, rerender, ICONS, bwFmt, bwUnit, bwVal, toKg, formVals } from './ui.js';

const STEPS_SHORTCUT = 'shortcuts://run-shortcut?name=' + encodeURIComponent('Steps');

function trainRow(st, k, p, d, type) {
  if (p.session) {
    const prog = PROGRAM[p.session];
    const exam = L.isExam(k, st.settings, d);
    const total = L.exercisesFor(p.session, exam).reduce((n, e) => n + e.sets, 0);
    const done = L.setsDone(d.workout && d.workout.session === p.session ? d.workout : null);
    const status = p.status === 'done' ? `<span class="pill good">${ICONS.check} Done</span>` : `<span class="pill">${done}/${total} sets</span>`;
    return `<a class="plan-row" href="#train">
      <span class="plan-ic">${ICONS.train}</span>
      <span class="plan-main"><b>${esc(prog.name)}</b><span>${esc(prog.focus)}${exam ? ' · exam mode' : ''}</span></span>
      ${status}<span class="chev">${ICONS.right}</span></a>`;
  }
  let msg = 'Rest day';
  let sub = 'Hit your steps.';
  if (p.status === 'busy') { msg = 'Busy today'; sub = 'Gym skipped. Sessions slide forward.'; }
  else if (p.status === 'free') { msg = 'All 5 sessions done'; sub = 'Rest, or extra cardio if you want it.'; }
  else if (type === 'between') { msg = 'No gym'; sub = 'Between shifts. Sleep is the priority.'; }
  else if (type === 'post') { msg = 'Recovery day'; sub = 'Outdoor walk + meal prep.'; }
  const btn = p.status === 'busy'
    ? '<button class="btn sm" data-act="tBusy">Undo</button>'
    : p.status === 'rest' ? '<button class="btn sm" data-act="tTrainAnyway">Train anyway</button>' : '';
  return `<div class="plan-row"><span class="plan-ic">${ICONS.train}</span><span class="plan-main"><b>${msg}</b><span>${sub}</span></span>${btn}</div>`;
}

export function render() {
  const st = store.state;
  const s = st.settings;
  const k = today();
  const d = peekDay(k);
  const type = L.dayType(k, s);
  const p = L.weekPlan(st, k, k).plan[k] || {};
  const t = L.dayTotals(d);
  const tg = L.targetsFor(st, k);
  const exam = L.isExam(k, s, d);
  const cp = L.cardioPlan(st, k, p.session);
  const sp = L.sleepPlan(k, s);
  const rev = L.weeklyReview(st, k);
  const revDone = st.reviews[L.weekStart(k)];
  const items = L.checklist(st, k, k);
  const doneN = items.filter((x) => x.done).length;
  const steps = d.steps || 0;
  const left = Math.max(0, s.stepsGoal - steps);
  const kcalLeft = tg.kcal - t.kcal;

  let banners = '';
  if (rev.ready && !revDone) {
    const applyLabel = rev.kind === 'kcal' ? `${rev.delta > 0 ? '+' : '−'}${Math.abs(rev.delta)} kcal` : rev.kind === 'cardio' ? `+${rev.delta} min cardio` : '';
    banners += `<section class="banner review">
      <div class="banner-h">${ICONS.scale}<b>Weekly check-in</b><span class="muted">${bwFmt(rev.lastAvg)} → ${bwFmt(rev.thisAvg)} ${bwUnit()}</span></div>
      <p>${esc(rev.text)}</p>
      <div class="row">${applyLabel ? `<button class="btn primary sm" data-act="tApplyReview">Apply ${applyLabel}</button>` : ''}<button class="btn sm" data-act="tDismissReview">${applyLabel ? 'Not now' : 'Got it'}</button></div>
    </section>`;
  }
  if (tg.maintenance) banners += `<section class="banner good"><b>Maintenance week.</b> Eat ~${fmt(tg.kcal)} kcal, keep lifting and stepping. The scale will jump 1–2 kg. That's water, not fat.</section>`;
  if (exam) banners += `<section class="banner warn"><b>Exam mode.</b> Top 4 lifts only, cardio becomes an incline walk with flashcards. Calories don't change.</section>`;

  const checks = items.map((x) => {
    const cls = `chk-item ${x.done ? 'on' : ''}`;
    if (x.id === 'water') {
      return `<div class="${cls}"><span class="chk-dot">${x.done ? ICONS.check : ''}</span><span class="chk-l">Water <b>${fmt(d.water || 0, 1)}</b>/${s.waterGoal} L</span>
        <span class="stepper"><button class="icon-btn" data-act="tWater" data-v="-0.5" aria-label="Less water">${ICONS.minus}</button><button class="icon-btn" data-act="tWater" data-v="0.5" aria-label="More water">${ICONS.plus}</button></span></div>`;
    }
    if (x.manual) return `<button class="${cls}" data-act="tCheck" data-id="${x.id}"><span class="chk-dot">${x.done ? ICONS.check : ''}</span><span class="chk-l">${esc(x.label)}</span></button>`;
    return `<div class="${cls}"><span class="chk-dot">${x.done ? ICONS.check : ''}</span><span class="chk-l">${esc(x.label)}</span></div>`;
  }).join('');

  return `
  <header class="top">
    <div class="eyebrow">${esc(L.fmtDate(k, true))}</div>
    <div class="top-row"><h1>Today</h1>
      <button class="chip-btn ${exam ? 'on' : ''}" data-act="tExam" aria-pressed="${exam}">Exam mode</button></div>
    <div class="chips"><span class="chip">${DAY_TYPE_LABEL[type]}</span>${tg.maintenance ? '<span class="chip good">Maintenance</span>' : ''}</div>
  </header>
  ${banners}
  <section class="card rings-card">
    <div class="ring-row">
      <div class="ring-wrap">${ring(t.kcal, tg.kcal, 'var(--kcal)', { overBad: true })}
        <div class="ring-label"><b class="${kcalLeft < 0 ? 'bad' : ''}">${fmt(Math.abs(kcalLeft))}</b><span>${kcalLeft < 0 ? 'kcal over' : 'kcal left'}</span></div></div>
      <div class="ring-wrap">${ring(t.p, tg.p, 'var(--protein)')}
        <div class="ring-label"><b>${fmt(Math.max(0, tg.p - t.p))}<small>g</small></b><span>${t.p >= tg.p ? 'protein hit' : 'protein left'}</span></div></div>
    </div>
    <div class="ring-legend">
      <span><i style="background:var(--kcal)"></i>${fmt(t.kcal)} / ${fmt(tg.kcal)} kcal</span>
      <span><i style="background:var(--protein)"></i>${fmt(t.p)} / ${tg.p} g protein</span>
    </div>
    <div class="macros">
      <div><span>Carbs</span>${bar(t.c, tg.c, 'var(--carbs)')}<small>${fmt(t.c)}/${tg.c} g</small></div>
      <div><span>Fat</span>${bar(t.f, tg.f, 'var(--fat)')}<small>${fmt(t.f)}/${tg.f} g</small></div>
      <div><span>Caffeine</span>${bar(t.caf, s.caffeineMax, 'var(--warn)', true)}<small>${fmt(t.caf)}/${s.caffeineMax} mg</small></div>
    </div>
    <a class="btn primary block" href="#food?add">${ICONS.plus}Log food</a>
  </section>

  <section class="tiles">
    <button class="tile" data-act="tWeigh"><span class="tile-k">${ICONS.scale}Weight</span><b>${d.weight ? bwFmt(d.weight) : '—'}</b><span class="tile-s">${d.weight ? bwUnit() + ' today' : L.weighDay(k, s) ? 'Tap to weigh in' : 'Skip today'}</span></button>
    <button class="tile" data-act="tSteps"><span class="tile-k">${ICONS.steps}Steps</span><b>${steps ? fmt(steps) : '—'}</b><span class="tile-s">${left ? `${fmt(left)} left` : 'Goal hit'}</span></button>
    <button class="tile" data-act="tSleep"><span class="tile-k">${ICONS.moon}Sleep</span><b>${d.sleep ? fmt(d.sleep, 1) : '—'}</b><span class="tile-s">${d.sleep ? 'h last night' : 'Tap to log'}</span></button>
  </section>

  <section class="card">
    <div class="card-h"><h2>Plan</h2>${p.session && p.status !== 'done' ? '<button class="link" data-act="tBusy">Busy today?</button>' : ''}</div>
    ${trainRow(st, k, p, d, type)}
    ${cp.min > 0 ? `<button class="plan-row" data-act="tCardio">
      <span class="plan-ic">${ICONS.flame}</span>
      <span class="plan-main"><b>${esc(cp.title)}</b><span>${esc(cp.detail || '')}</span></span>
      <span class="tick ${d.cardio && d.cardio.done ? 'on' : ''}">${ICONS.check}</span></button>`
      : `<div class="plan-row"><span class="plan-ic">${ICONS.flame}</span><span class="plan-main"><b>${esc(cp.title)}</b></span></div>`}
    <button class="plan-row" data-act="tSteps">
      <span class="plan-ic">${ICONS.steps}</span>
      <span class="plan-main"><b>${fmt(steps)} / ${fmt(s.stepsGoal)} steps</b><span>${left ? `${fmt(left)} left ≈ ${Math.ceil(left / 100)} min walk` : 'Goal hit.'}</span>${bar(steps, s.stepsGoal, 'var(--good)')}</span>
    </button>
    <div class="plan-row"><span class="plan-ic">${ICONS.moon}</span><span class="plan-main"><b>${esc(sp.lines.join(' · '))}</b><span>${esc(sp.note)}</span></span></div>
    <div class="plan-row"><span class="plan-ic">${ICONS.bolt}</span><span class="plan-main"><b>Caffeine: ${esc(L.caffeineCutoff(k, s))}</b><span>${fmt(t.caf)} mg today${t.lastCaf ? `, last at ${esc(t.lastCaf)}` : ''}</span></span></div>
    ${p.session && p.status !== 'done' ? '<button class="link block-link" data-act="wPick">Do a different session today</button>' : ''}
  </section>

  <section class="card">
    <div class="card-h"><h2>Checklist</h2><span class="score">${doneN}/${items.length}</span></div>
    <div class="checks">${checks}</div>
  </section>`;
}

// ---------- sheets ----------
function weighSheet() {
  const k = today();
  const d = peekDay(k);
  const last = L.weightSeries(store.state).filter((x) => x.k <= k).pop();
  const val = d.weight || (last && last.w) || store.state.settings.startWeight || '';
  openSheet(`<h3>Weigh-in</h3>
    <p class="muted">Morning, after the bathroom, before food. The 7-day average is what counts, so daily swings don't matter.</p>
    <label class="field big"><input name="w" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="${val ? bwVal(val).toFixed(1) : ''}" autofocus><span>${bwUnit()}</span></label>
    <div class="row"><button class="btn primary grow" data-act="tSaveWeigh">Save</button>${d.weight ? '<button class="btn ghost" data-act="tDelWeigh">Delete</button>' : ''}</div>`);
}
function stepsSheet() {
  const d = peekDay(today());
  openSheet(`<h3>Steps today</h3>
    <p class="muted">Run your <b>Steps</b> Shortcut (it copies today's count), come back, tap Paste. Or type it from the Health app.</p>
    <label class="field big"><input name="steps" type="number" inputmode="numeric" min="0" max="100000" value="${d.steps || ''}" placeholder="0"><span>steps</span></label>
    <div class="row wrap">
      <button class="btn" data-act="tPasteSteps">${ICONS.copy}Paste</button>
      <a class="btn" href="${STEPS_SHORTCUT}">${ICONS.bolt}Run Steps Shortcut</a>
      <a class="btn" href="x-apple-health://">Open Health</a>
    </div>
    <button class="btn primary block" data-act="tSaveSteps">Save</button>`);
}
function sleepSheet() {
  const d = peekDay(today());
  const chips = [5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10, 11].map((h) => `<button class="chip-btn ${d.sleep === h ? 'on' : ''}" data-act="tSleepChip" data-v="${h}">${h} h</button>`).join('');
  openSheet(`<h3>Sleep (last 24 h)</h3>
    <p class="muted">Count naps too. On a pre-shift day, last night + your nap. Target: ${store.state.settings.sleepGoal} h average.</p>
    <div class="chip-grid">${chips}</div>
    <label class="field big"><input name="sleep" type="number" inputmode="decimal" step="0.25" min="0" max="20" value="${d.sleep || ''}" placeholder="7"><span>hours</span></label>
    <button class="btn primary block" data-act="tSaveSleep">Save</button>`);
}

export const actions = {
  tWeigh: weighSheet,
  tSaveWeigh() {
    const v = L.num(formVals().w);
    if (!v || v < 30 || v > 660) return toast('Enter a real weight');
    const kg = Math.round(toKg(v) * 10) / 10;
    const k = today();
    day(k).weight = kg;
    const s = store.state.settings;
    if (!s.startDate) { s.startDate = k; s.startWeight = kg; }
    save(); closeSheet(); rerender(); toast(`Logged ${bwFmt(kg)} ${bwUnit()}`);
  },
  tDelWeigh() { delete day(today()).weight; save(); closeSheet(); rerender(); },
  tSteps: stepsSheet,
  async tPasteSteps() {
    try {
      const txt = await navigator.clipboard.readText();
      const n = parseInt(String(txt).replace(/[^0-9]/g, ''), 10);
      if (!Number.isFinite(n)) return toast('No number on the clipboard');
      document.querySelector('#sheet [name=steps]').value = n;
    } catch (e) { toast('Paste blocked. Long-press the box and paste instead.'); }
  },
  tSaveSteps() {
    const v = L.num(formVals().steps);
    if (v == null || v < 0) return toast('Enter your steps');
    day(today()).steps = Math.round(v);
    save(); closeSheet(); rerender();
    const left = store.state.settings.stepsGoal - v;
    toast(left > 0 ? `${fmt(left)} left ≈ ${Math.ceil(left / 100)} min walk` : '12k done');
  },
  tSleep: sleepSheet,
  tSleepChip(el) {
    document.querySelector('#sheet [name=sleep]').value = el.dataset.v;
    document.querySelectorAll('#sheet .chip-btn').forEach((b) => b.classList.toggle('on', b === el));
  },
  tSaveSleep() {
    const v = L.num(formVals().sleep);
    if (v == null || v < 0 || v > 24) return toast('Enter hours slept');
    day(today()).sleep = v;
    save(); closeSheet(); rerender();
  },
  tCardio() {
    const k = today();
    const st = store.state;
    const p = L.weekPlan(st, k, k).plan[k] || {};
    const cp = L.cardioPlan(st, k, p.session);
    const d = day(k);
    d.cardio = { min: (d.cardio && d.cardio.min) || cp.min, done: !(d.cardio && d.cardio.done) };
    save(); rerender();
    if (d.cardio.done) toast('Cardio done');
  },
  tBusy() {
    const d = day(today());
    d.busy = !d.busy;
    if (!d.busy) delete d.busy;
    save(); rerender();
    toast(d.busy ? 'Skipped. Today’s session slides to your next gym day.' : 'Back on');
  },
  tTrainAnyway() { day(today()).train = true; save(); location.hash = 'train'; },
  tCheck(el) {
    const d = day(today());
    d[el.dataset.id] = !d[el.dataset.id];
    save(); rerender();
  },
  tWater(el) {
    const d = day(today());
    d.water = Math.max(0, Math.round(((d.water || 0) + parseFloat(el.dataset.v)) * 10) / 10);
    save(); rerender();
  },
  tExam() {
    const k = today();
    const s = store.state.settings;
    const d = day(k);
    const cur = L.isExam(k, s, d);
    const byRange = L.inRange(k, s.exams);
    if (!cur === byRange) delete d.exam; else d.exam = !cur;
    save(); rerender();
    toast(!cur ? 'Exam mode on for today' : 'Exam mode off');
  },
  tApplyReview() {
    const st = store.state;
    const k = today();
    const rev = L.weeklyReview(st, k);
    if (!rev.ready) return;
    L.applyRecommendation(st.settings, rev);
    st.reviews[rev.week] = { date: k, change: rev.change, kind: rev.kind, delta: rev.delta, text: rev.text, applied: true };
    save(); rerender();
    toast(rev.kind === 'kcal' ? `Target now ${fmt(st.settings.targets.kcal)} kcal` : `Cardio now ${st.settings.cardio.min} min`);
  },
  tDismissReview() {
    const st = store.state;
    const k = today();
    const rev = L.weeklyReview(st, k);
    if (!rev.ready) return;
    st.reviews[rev.week] = { date: k, change: rev.change, kind: rev.kind, delta: rev.delta, text: rev.text, applied: false };
    save(); rerender();
  },
};
