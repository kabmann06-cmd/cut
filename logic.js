// Cut — pure logic (no DOM). Dates are local 'YYYY-MM-DD' strings.
import { PROGRAM, SESSIONS, EQUIP } from './data.js';

// ---------- small helpers ----------
export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
export const num = (v) => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
export const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------- dates ----------
export function key(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function parseKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(k, n) {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return key(d);
}
export const dow = (k) => parseKey(k).getDay();
export const diffDays = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000); // b − a
export const weekStart = (k) => addDays(k, -((dow(k) + 6) % 7)); // Monday
export const inRange = (k, ranges) => (ranges || []).some((r) => r && r.start && r.end && k >= r.start && k <= r.end);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const wd = (k) => WD[dow(k)];
export function fmtDate(k, long = false) {
  const d = parseKey(k);
  return `${long ? WD_LONG[d.getDay()] : WD[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
}
export const fmtShort = (k) => { const d = parseKey(k); return `${MON[d.getMonth()]} ${d.getDate()}`; };
export const hhmm = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// ---------- schedule ----------
// Night N = a shift that starts on weekday N (e.g. Fri 23:00 → Sat 11:00).
export function dayType(k, s) {
  const d = dow(k);
  const nights = s.shiftNights || [];
  const cameOffShift = nights.includes((d + 6) % 7);
  const shiftTonight = nights.includes(d);
  if (cameOffShift && shiftTonight) return 'between';
  if (cameOffShift) return 'post';
  if (shiftTonight) return 'pre';
  return 'normal';
}
export function isGymEligible(k, s) {
  const t = dayType(k, s);
  if (t === 'between' || t === 'post') return false;
  return (s.gymDays || []).includes(dow(k));
}
export const isExam = (k, s, d) => (d && typeof d.exam === 'boolean' ? d.exam : inRange(k, s.exams));
export const isMaintenance = (k, s) => inRange(k, s.maintenance);
export const weighDay = (k, s) => ['normal', 'pre'].includes(dayType(k, s));

export function sleepPlan(k, s) {
  const t = dayType(k, s);
  const next = dayType(addDays(k, 1), s);
  const shift = `Shift ${s.shiftStart}–${s.shiftEnd}`;
  if (t === 'pre') return { lines: ['Nap 18:00–20:30', `${shift} tonight`], note: 'Gym early (done by ~2 pm), nap, eat ~21:00, leave ~22:15.' };
  if (t === 'between') return { lines: ['Sleep 12:00–19:00 after shift', `${shift} tonight`], note: 'Blackout room, earplugs, sunglasses on the drive home.' };
  if (t === 'post') return { lines: ['Sleep 12:00–15:00 only (set an alarm)', 'Bed 23:30 → 08:00'], note: 'Short sleep + early bedtime resets you for tomorrow.' };
  if (next === 'pre') return { lines: ['Bed 01:00 → 09:30'], note: 'Sleep in. First shift is tomorrow night.' };
  return { lines: ['Bed 01:00 → 08:00'], note: 'Wind down at 00:30. Games before bed, not in bed.' };
}
export function caffeineCutoff(k, s) {
  const t = dayType(k, s);
  if (t === 'pre' || t === 'between') return 'OK on shift, none after 05:00';
  if (t === 'post') return 'None after 16:00 (bed 23:30)';
  return 'None after 18:00';
}

// ---------- training ----------
export function setsDone(w) {
  let n = 0;
  for (const e of Object.values((w && w.ex) || {})) for (const st of e.sets || []) if (st && st.done) n++;
  return n;
}
export const workoutCompleted = (w, isPast) => !!(w && w.session && (w.done || (isPast && setsDone(w) > 0)));

// Assigns this week's sessions to days. Missed days push sessions forward; leftovers drop off.
export function weekPlan(state, refKey, today) {
  const s = state.settings;
  const ws = weekStart(refKey);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const consumed = new Set();
  for (const k of days) {
    const w = state.days[k] && state.days[k].workout;
    if (workoutCompleted(w, k < today)) consumed.add(w.session);
  }
  let remaining = SESSIONS.filter((x) => !consumed.has(x));
  const plan = {};
  const start = s.startDate || null;
  for (const k of days) {
    const d = state.days[k] || {};
    const w = d.workout;
    if (workoutCompleted(w, k < today)) { plan[k] = { session: w.session, status: 'done' }; continue; }
    if (start && k < start) {
      // before you started: that day's session is skipped, not pushed into the rest of the week
      if (isGymEligible(k, s) && remaining.length) remaining = remaining.slice(1);
      plan[k] = { status: 'prestart' };
      continue;
    }
    if (d.busy) { plan[k] = { status: 'busy' }; continue; }
    const eligible = isGymEligible(k, s) || !!d.train;
    if (k < today && d.session) {
      // picked after the fact ("log it now") — show it so sets can be back-filled
      remaining = remaining.filter((x) => x !== d.session);
      plan[k] = { session: d.session, status: 'past' };
      continue;
    }
    if (!eligible) { plan[k] = { status: 'rest' }; continue; }
    if (k < today) { plan[k] = { status: 'missed' }; continue; }
    const inProgress = w && w.session && setsDone(w) > 0 ? w.session : null;
    const sess = d.session || inProgress || remaining[0] || null;
    if (!sess) { plan[k] = { status: 'free' }; continue; }
    remaining = remaining.filter((x) => x !== sess);
    plan[k] = { session: sess, status: k === today ? 'today' : 'planned' };
  }
  return { ws, days, plan, unplaced: remaining };
}

export const exercisesFor = (sessionKey, exam) => {
  const p = PROGRAM[sessionKey];
  if (!p) return [];
  return exam ? p.ex.filter((e) => e.core) : p.ex;
};

export function lastPerformance(state, name, beforeKey) {
  const keys = Object.keys(state.days).filter((k) => k < beforeKey).sort().reverse();
  for (const k of keys) {
    const w = state.days[k].workout;
    if (!w || !w.ex) continue;
    for (const e of Object.values(w.ex)) {
      if (!e || e.name !== name) continue;
      const sets = (e.sets || [])
        .filter((x) => x && x.done && num(x.r) > 0)
        .map((x) => ({ w: num(x.w) ?? 0, r: num(x.r) }));
      if (sets.length) return { date: k, sets };
    }
  }
  return null;
}

// Double progression: all sets at the top of the range → add weight; otherwise add a rep.
export function suggestion(ex, last, equip) {
  const [lo, hi] = ex.reps;
  if (!last) return { w: null, r: lo, up: false, text: `First time: pick a weight you can do for ${lo}–${hi} reps.` };
  const topW = Math.max(...last.sets.map((x) => x.w));
  const step = EQUIP[equip] ? EQUIP[equip].step : 5;
  const allTop = last.sets.length >= ex.sets && last.sets.every((x) => x.r >= hi);
  if (allTop && step > 0) return { w: topW + step, r: lo, up: true, text: `Hit ${hi}+ on every set → add ${step}` };
  if (allTop) return { w: topW, r: hi + 1, up: true, text: 'Hit the top on every set → add reps or slow the tempo' };
  const atTop = last.sets.filter((x) => x.w === topW);
  const minR = Math.min(...atTop.map((x) => x.r));
  return { w: topW, r: Math.min(hi, minR + 1), up: false, text: 'Beat last time by 1 rep' };
}

export function cardioPlan(state, k, sessionKey) {
  const s = state.settings;
  const t = dayType(k, s);
  const min = s.cardio.min;
  if (t === 'between') return { kind: 'none', title: 'No cardio. Your shift covers the steps.', min: 0 };
  if (t === 'post') return { kind: 'walk', title: `${min}–60 min outdoor walk`, min, detail: 'Daylight helps reset your body clock after nights. Meal prep after.' };
  if (!sessionKey) return { kind: 'rest', title: 'No cardio planned. Hit your steps.', min: 0 };
  if (isExam(k, s, state.days[k])) {
    const m = Math.min(min, 45);
    return { kind: 'exam', title: `${m} min incline walk + flashcards`, min: m, detail: 'Treadmill 12%, ~5 km/h. Notes on the console.' };
  }
  if (PROGRAM[sessionKey] && PROGRAM[sessionKey].intervals) {
    return { kind: 'intervals', title: `${min} min, last 10 as intervals`, min, detail: `${min - 10} min steady, then 1 min hard / 1 min easy × 5. StairMaster or treadmill.` };
  }
  return { kind: 'steady', title: `${min} min steady`, min, detail: 'StairMaster ~L7–10 (no rails) or treadmill 12–15% @ 4.8–5.6 km/h. Short sentences only.' };
}

// ---------- nutrition ----------
export const entryFactor = (e) => (e.unit === 'g' ? (num(e.qty) || 0) / 100 : num(e.qty) || 0);
export function dayTotals(d) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, caf: 0, lastCaf: null, n: 0 };
  for (const e of (d && d.food) || []) {
    const m = entryFactor(e);
    const per = e.per || {};
    t.kcal += (per.kcal || 0) * m;
    t.p += (per.p || 0) * m;
    t.c += (per.c || 0) * m;
    t.f += (per.f || 0) * m;
    const caf = (per.caf || 0) * m;
    if (caf > 0) { t.caf += caf; if (!t.lastCaf || (e.time || '') > t.lastCaf) t.lastCaf = e.time || null; }
    t.n++;
  }
  for (const x of ['kcal', 'p', 'c', 'f', 'caf']) t[x] = Math.round(t[x]);
  return t;
}
export function targetsFor(state, k) {
  const s = state.settings;
  const t = { ...s.targets, maintenance: false };
  if (isMaintenance(k, s)) {
    const extra = Math.max(0, (s.maintenanceKcal || t.kcal) - t.kcal);
    t.kcal = s.maintenanceKcal || t.kcal;
    t.c += Math.round((extra * 0.7) / 4);
    t.f += Math.round((extra * 0.3) / 9);
    t.maintenance = true;
  }
  return t;
}
export function foodTotalsFor(food, qty) {
  const m = food.unit === 'g' ? qty / 100 : qty;
  return { kcal: food.kcal * m, p: food.p * m, c: food.c * m, f: food.f * m, caf: (food.caf || 0) * m };
}
export function mealTotals(meal, foods) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, caf: 0 };
  for (const [fid, q] of meal.items || []) {
    const fd = foods.find((x) => x.id === fid);
    if (!fd) continue;
    const v = foodTotalsFor(fd, q);
    for (const x in t) t[x] += v[x];
  }
  for (const x in t) t[x] = Math.round(t[x] * 10) / 10;
  return t;
}

// ---------- body weight ----------
export function weightSeries(state) {
  return Object.keys(state.days).filter((k) => isNum(state.days[k].weight)).sort().map((k) => ({ k, w: state.days[k].weight }));
}
export function avgWeight(state, endKey, n = 7) {
  let sum = 0, cnt = 0;
  for (let i = 0; i < n; i++) {
    const d = state.days[addDays(endKey, -i)];
    if (d && isNum(d.weight)) { sum += d.weight; cnt++; }
  }
  return cnt ? { avg: sum / cnt, n: cnt } : null;
}
export function currentWeight(state, today) {
  const a = avgWeight(state, today, 7);
  if (a) return a.avg;
  const ser = weightSeries(state).filter((x) => x.k <= today);
  if (ser.length) return ser[ser.length - 1].w;
  return state.settings.startWeight || null;
}
export function linreg(pts) {
  const n = pts.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; sxx += x * x; sxy += x * y; }
  const den = n * sxx - sx * sx;
  const slope = den ? (n * sxy - sx * sy) / den : 0;
  return { slope, intercept: n ? (sy - slope * sx) / n : 0 };
}

const signed = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`;

// Weekly check-in: compares this week's average weight with last week's.
export function weeklyReview(state, today) {
  const s = state.settings;
  const a = avgWeight(state, today, 7);
  const b = avgWeight(state, addDays(today, -7), 7);
  const c = avgWeight(state, addDays(today, -14), 7);
  if (!a || !b || a.n < 3 || b.n < 3) return { ready: false };
  const change = a.avg - b.avg;
  const loss = -change;
  const prevChange = c && c.n >= 3 ? b.avg - c.avg : null;
  const daysIn = s.startDate ? diffDays(s.startDate, today) : 0;
  const recentMaint = (s.maintenance || []).some((r) => r.start <= today && r.end >= addDays(today, -13));
  const base = { ready: true, change, prevChange, week: weekStart(today), thisAvg: a.avg, lastAvg: b.avg };
  if (recentMaint) return { ...base, kind: 'none', delta: 0, text: 'Maintenance week in the window, so no changes. A 1–2 kg jump is water and drops within a week.' };
  if (daysIn < 14) return { ...base, kind: 'none', delta: 0, text: 'The first 2 weeks include water weight. Hold the plan.' };
  if (loss > 1.2) return { ...base, kind: 'kcal', delta: 150, text: `Losing ${loss.toFixed(1)} kg/week, faster than needed. Add 150 kcal to protect muscle.` };
  if (loss >= 0.5) return { ...base, kind: 'none', delta: 0, text: `On track: −${loss.toFixed(1)} kg/week. No changes.` };
  const prevSlow = prevChange !== null && -prevChange < 0.5;
  if (!prevSlow) return { ...base, kind: 'none', delta: 0, text: `Slow week (${signed(change)} kg). Hold steady: log everything and hit 12k steps daily.` };
  if (s.cardio.min < s.cardio.cap) return { ...base, kind: 'cardio', delta: 10, text: `Two slow weeks in a row. Add 10 min of cardio a day (→ ${Math.min(s.cardio.cap, s.cardio.min + 10)} min).` };
  if (s.targets.kcal - 150 >= s.floorKcal) return { ...base, kind: 'kcal', delta: -150, text: `Two slow weeks and cardio is maxed. Drop 150 kcal (→ ${s.targets.kcal - 150}).` };
  return { ...base, kind: 'none', delta: 0, text: 'At the calorie floor and cardio cap. Tighten logging accuracy and steps before cutting more.' };
}

// Applies a review recommendation to settings (mutates).
export function applyRecommendation(settings, rec) {
  if (rec.kind === 'kcal') {
    const next = Math.max(settings.floorKcal, settings.targets.kcal + rec.delta);
    const diff = next - settings.targets.kcal;
    settings.targets.kcal = next;
    settings.targets.c = Math.max(50, settings.targets.c + Math.round(diff / 4));
  } else if (rec.kind === 'cardio') {
    settings.cardio.min = Math.min(settings.cardio.cap, settings.cardio.min + rec.delta);
  }
  return settings;
}

// Real maintenance from your data: average intake minus the energy in the weight you lost.
export function measuredTdee(state, today) {
  const s = state.settings;
  if (!s.startDate || diffDays(s.startDate, today) < 21) return null;
  const N = 21;
  const start = addDays(today, -(N - 1));
  const kcals = [];
  const pts = [];
  for (let i = 0; i < N; i++) {
    const k = addDays(start, i);
    if (isMaintenance(k, s)) return null;
    const d = state.days[k];
    if (!d) continue;
    const t = dayTotals(d);
    if (t.kcal >= 1200) kcals.push(t.kcal);
    if (isNum(d.weight)) pts.push([i, d.weight]);
  }
  if (kcals.length < 12 || pts.length < 8) return null;
  const { slope } = linreg(pts);
  return Math.round((mean(kcals) - slope * 7700) / 10) * 10;
}

export function projections(state, today) {
  const s = state.settings;
  const cur = currentWeight(state, today);
  if (!cur) return [];
  let rate = null;
  const a = avgWeight(state, today, 7);
  const b = avgWeight(state, addDays(today, -14), 7);
  if (s.startDate && diffDays(s.startDate, today) >= 21 && a && b && a.n >= 3 && b.n >= 3) {
    const r = (b.avg - a.avg) / 2;
    if (r >= 0.2 && r <= 2) rate = r;
  }
  const targets = [...new Set([...(s.milestones || []), s.goalWeight])].filter((m) => isNum(m) && m < cur).sort((x, y) => y - x);
  return targets.map((m) => {
    let weeks;
    if (rate) weeks = (cur - m) / rate;
    else {
      const above = Math.max(0, cur - Math.max(m, 90));
      const below = Math.max(0, Math.min(cur, 90) - m);
      weeks = above / 1.0 + below / 0.85;
    }
    let days = Math.round(weeks * 7);
    for (const r of s.maintenance || []) {
      const end = addDays(today, days);
      if (r.end >= today && r.start <= end) {
        const from = r.start > today ? r.start : today;
        days += Math.max(0, diffDays(from, r.end) + 1);
      }
    }
    return { m, date: addDays(today, days), measured: !!rate, rate };
  });
}

// ---------- body fat ----------
export function navyBF(waist, neck, height) {
  if (!(waist > 0 && neck > 0 && height > 0) || waist <= neck) return null;
  return 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height)) - 450;
}
export function bfEstimate(state, today) {
  const s = state.settings;
  const W = currentWeight(state, today);
  const out = {};
  const ci = (state.checkins || []).filter((c) => num(c.waist) && num(c.neck)).sort((x, y) => (x.date < y.date ? 1 : -1))[0];
  if (ci && s.heightCm) {
    const v = navyBF(num(ci.waist), num(ci.neck), s.heightCm);
    if (v !== null) out.navy = { pct: v, date: ci.date };
  }
  if (num(s.bfEstimate) && num(s.bfEstimateWeight) && W) {
    const W0 = num(s.bfEstimateWeight);
    const lbm0 = W0 * (1 - num(s.bfEstimate) / 100);
    const lbm = W < W0 ? lbm0 - 0.15 * (W0 - W) : lbm0;
    out.photo = { pct: clamp((1 - lbm / W) * 100, 3, 60), lbm };
  }
  return out;
}

// ---------- daily checklist ----------
export function checklist(state, k, today) {
  const s = state.settings;
  const d = state.days[k] || {};
  const t = dayTotals(d);
  const tg = targetsFor(state, k);
  const p = weekPlan(state, k, today).plan[k] || {};
  const type = dayType(k, s);
  const items = [];
  if (weighDay(k, s)) items.push({ id: 'weigh', label: 'Weigh-in', done: isNum(d.weight) });
  items.push({ id: 'protein', label: `Protein ${tg.p} g`, done: t.p >= tg.p - 5 });
  items.push({ id: 'kcal', label: 'Calories on budget', done: t.kcal >= 1200 && t.kcal <= tg.kcal + 50 });
  if (p.session) items.push({ id: 'workout', label: PROGRAM[p.session].name, done: p.status === 'done' });
  const cp = cardioPlan(state, k, p.session);
  if (cp.min > 0) items.push({ id: 'cardio', label: `Cardio ${cp.min} min`, done: !!(d.cardio && d.cardio.done) });
  items.push({ id: 'steps', label: `${Math.round(s.stepsGoal / 1000)}k steps`, done: (d.steps || 0) >= s.stepsGoal });
  if (type !== 'post') items.push({ id: 'sleep', label: `${s.sleepGoal} h sleep`, done: (d.sleep || 0) >= s.sleepGoal });
  items.push({ id: 'creatine', label: 'Creatine 5 g', done: !!d.creatine, manual: true });
  items.push({ id: 'water', label: `Water ${s.waterGoal} L`, done: (d.water || 0) >= s.waterGoal });
  return items;
}
