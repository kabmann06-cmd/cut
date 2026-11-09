// Cut — Progress screen (weight trend, projections, body fat, adherence, steps, sleep)
import * as L from './logic.js';
import { store, save, today, uid } from './store.js';
import { esc, fmt, toast, openSheet, closeSheet, rerender, ICONS, bwFmt, bwUnit, bwVal, formVals } from './ui.js';

let range = 60;

function weightChart(st, td) {
  const ser = L.weightSeries(st).filter((x) => x.k <= td && (range === 0 || L.diffDays(x.k, td) < range));
  if (ser.length < 2) return '<p class="muted center pad">Weigh in on a few mornings and your trend line shows up here.</p>';
  const W = 340, H = 180, pl = 34, pr = 10, pt = 12, pb = 24;
  const x0 = ser[0].k, span = Math.max(1, L.diffDays(x0, ser[ser.length - 1].k));
  const vals = ser.map((p) => bwVal(p.w));
  const trend = ser.map((p) => bwVal(L.avgWeight(st, p.k, 7).avg));
  let lo = Math.min(...vals, ...trend), hi = Math.max(...vals, ...trend);
  const pad = Math.max(0.6, (hi - lo) * 0.12);
  lo -= pad; hi += pad;
  const X = (k) => pl + (L.diffDays(x0, k) / span) * (W - pl - pr);
  const Y = (v) => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
  const ticks = [];
  const nT = 4;
  for (let i = 0; i <= nT; i++) ticks.push(lo + ((hi - lo) * i) / nT);
  const grid = ticks.map((v) => `<line x1="${pl}" x2="${W - pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="g"/><text x="${pl - 6}" y="${(Y(v) + 3.5).toFixed(1)}" class="yl">${v.toFixed(0)}</text>`).join('');
  const s = st.settings;
  const lines = [...new Set([...(s.milestones || []), s.goalWeight])].map((m) => bwVal(m)).filter((m) => m > lo && m < hi)
    .map((m) => `<line x1="${pl}" x2="${W - pr}" y1="${Y(m).toFixed(1)}" y2="${Y(m).toFixed(1)}" class="goal"/><text x="${W - pr - 2}" y="${(Y(m) - 4).toFixed(1)}" class="gl">${m.toFixed(0)}</text>`).join('');
  const dots = ser.map((p, i) => `<circle cx="${X(p.k).toFixed(1)}" cy="${Y(vals[i]).toFixed(1)}" r="2.6" class="dot"/>`).join('');
  const path = ser.map((p, i) => `${i ? 'L' : 'M'}${X(p.k).toFixed(1)},${Y(trend[i]).toFixed(1)}`).join(' ');
  const mid = L.addDays(x0, Math.round(span / 2));
  const xl = [x0, mid, ser[ser.length - 1].k].map((k, i) => `<text x="${X(k).toFixed(1)}" y="${H - 6}" class="xl" text-anchor="${['start', 'middle', 'end'][i]}">${L.fmtShort(k)}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight trend">${grid}${lines}<path d="${path}" class="trend"/>${dots}${xl}</svg>
    <div class="legend"><span><i class="lg-dot"></i>Daily</span><span><i class="lg-line"></i>7-day average</span><span><i class="lg-goal"></i>Milestones</span></div>`;
}

function barChart(vals, goal, color, fmtV) {
  const W = 340, H = 120, pl = 6, pr = 6, pt = 10, pb = 20;
  const max = Math.max(goal * 1.15, ...vals.map((v) => v.v || 0));
  const bw = (W - pl - pr) / vals.length;
  const Y = (v) => pt + (1 - v / max) * (H - pt - pb);
  const bars = vals.map((v, i) => {
    const x = pl + i * bw + bw * 0.18;
    const h = v.v ? (H - pb) - Y(v.v) : 0;
    const hit = v.v >= goal;
    return `<rect x="${x.toFixed(1)}" y="${(H - pb - h).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="3" fill="${v.v ? (hit ? color : 'var(--muted2)') : 'none'}"><title>${esc(L.fmtShort(v.k))}: ${fmtV(v.v)}</title></rect>
      <text x="${(x + bw * 0.32).toFixed(1)}" y="${H - 6}" class="xl" text-anchor="middle">${L.wd(v.k)[0]}</text>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img"><line x1="${pl}" x2="${W - pr}" y1="${Y(goal).toFixed(1)}" y2="${Y(goal).toFixed(1)}" class="goal"/>${bars}</svg>`;
}

function lastN(td, n) { return Array.from({ length: n }, (_, i) => L.addDays(td, i - n + 1)); }

export function render() {
  const st = store.state;
  const s = st.settings;
  const td = today();
  const cur = L.currentWeight(st, td);
  const a = L.avgWeight(st, td, 7);
  const b = L.avgWeight(st, L.addDays(td, -7), 7);
  const wk = a && b ? a.avg - b.avg : null;
  const fromStart = cur && s.startWeight ? cur - s.startWeight : null;
  const toGo = cur ? cur - s.goalWeight : null;
  const proj = L.projections(st, td);
  const bf = L.bfEstimate(st, td);
  const tdee = L.measuredTdee(st, td);
  const days14 = lastN(td, 14);
  const days7 = lastN(td, 7);
  const steps = days14.map((k) => ({ k, v: (st.days[k] || {}).steps || 0 }));
  const sleep = days14.map((k) => ({ k, v: (st.days[k] || {}).sleep || 0 }));
  const stepsLogged = steps.filter((x) => x.v > 0);
  const sleepLogged = sleep.filter((x) => x.v > 0);
  const tot7 = days7.map((k) => L.dayTotals(st.days[k] || {})).filter((t) => t.kcal >= 800);
  const avgK = tot7.length ? Math.round(L.mean(tot7.map((t) => t.kcal))) : null;
  const avgP = tot7.length ? Math.round(L.mean(tot7.map((t) => t.p))) : null;
  const wp = L.weekPlan(st, td, td);
  const doneWk = wp.days.filter((k) => (wp.plan[k] || {}).status === 'done').length;
  const cardioWk = wp.days.reduce((n, k) => n + (((st.days[k] || {}).cardio || {}).done ? ((st.days[k] || {}).cardio.min || 0) : 0), 0);
  const checkins = (st.checkins || []).slice().sort((x, y) => (x.date < y.date ? 1 : -1));
  const lastCi = checkins[0];
  const nextCi = lastCi ? L.addDays(lastCi.date, 14) : s.startDate ? L.addDays(s.startDate, 14) : td;
  const reviews = Object.entries(st.reviews || {}).sort((x, y) => (x[0] < y[0] ? 1 : -1)).slice(0, 6);
  const u = bwUnit();

  return `<header class="top"><div class="eyebrow">Since ${s.startDate ? esc(L.fmtShort(s.startDate)) : 'start'}</div><h1>Progress</h1></header>

  <section class="card">
    <div class="stat-row">
      <div class="stat"><span>7-day avg</span><b>${cur ? bwFmt(cur) : '—'}<small>${u}</small></b></div>
      <div class="stat"><span>This week</span><b class="${wk != null ? (wk <= 0 ? 'good' : 'bad') : ''}">${wk != null ? `${wk > 0 ? '+' : '−'}${Math.abs(bwVal(wk)).toFixed(1)}` : '—'}</b></div>
      <div class="stat"><span>Total</span><b class="${fromStart != null && fromStart <= 0 ? 'good' : ''}">${fromStart != null ? `${fromStart > 0 ? '+' : '−'}${Math.abs(bwVal(fromStart)).toFixed(1)}` : '—'}</b></div>
      <div class="stat"><span>To ${bwFmt(s.goalWeight, 0)}</span><b>${toGo != null ? Math.max(0, bwVal(toGo)).toFixed(1) : '—'}</b></div>
    </div>
    <div class="seg mini">${[[30, '30d'], [60, '60d'], [90, '90d'], [0, 'All']].map(([v, l]) => `<button class="${range === v ? 'on' : ''}" data-act="pRange" data-v="${v}">${l}</button>`).join('')}</div>
    ${weightChart(st, td)}
    ${proj.length ? `<div class="proj">${proj.map((p) => `<div><span>${bwFmt(p.m, 0)} ${u}</span><b>${esc(L.fmtShort(p.date))}</b><small>${p.date.slice(0, 4)}</small></div>`).join('')}</div>
      <p class="muted sm">${proj[0].measured ? `Based on your last 2 weeks (−${proj[0].rate.toFixed(2)} kg/wk).` : 'Planned pace (~1 kg/wk, slower under 90). Switches to your real pace after 3 weeks.'} Includes maintenance weeks.</p>` : ''}
  </section>

  <section class="card">
    <div class="card-h"><h2>Body fat</h2><button class="btn sm" data-act="pCheckin">${ICONS.plus}Check-in</button></div>
    <div class="stat-row">
      <div class="stat"><span>Estimate</span><b>${bf.photo ? `${bf.photo.pct.toFixed(1)}<small>%</small>` : '—'}</b></div>
      <div class="stat"><span>Lean mass</span><b>${bf.photo ? `${bwFmt(bf.photo.lbm)}<small>${u}</small>` : '—'}</b></div>
      <div class="stat"><span>Navy tape</span><b>${bf.navy ? `${bf.navy.pct.toFixed(1)}<small>%</small>` : '—'}</b></div>
    </div>
    <p class="muted sm">Estimate = your photo-based starting % adjusted for the weight you've lost. Navy = waist at the belly button + neck (cm). Photos + waist every 2 weeks. Next: <b>${esc(L.fmtShort(nextCi))}</b>.</p>
    ${checkins.length ? `<div class="list compact">${checkins.slice(0, 6).map((c) => `<button class="li" data-act="pCheckin" data-id="${c.id}"><span class="li-main"><b>${esc(L.fmtShort(c.date))}</b><span>${c.waist ? `waist ${c.waist} cm` : ''}${c.neck ? ` · neck ${c.neck} cm` : ''}${c.photos ? ' · photos ✓' : ''}${c.note ? ` · ${esc(c.note)}` : ''}</span></span>
      ${c.waist && c.neck && s.heightCm ? `<span class="li-num"><b>${(L.navyBF(+c.waist, +c.neck, s.heightCm) || 0).toFixed(1)}%</b></span>` : ''}</button>`).join('')}</div>` : ''}
  </section>

  <section class="card">
    <div class="card-h"><h2>Nutrition, last 7 days</h2></div>
    <div class="stat-row">
      <div class="stat"><span>Avg kcal</span><b>${avgK != null ? fmt(avgK) : '—'}</b></div>
      <div class="stat"><span>Avg protein</span><b>${avgP != null ? `${avgP}<small>g</small>` : '—'}</b></div>
      <div class="stat"><span>Days logged</span><b>${tot7.length}<small>/7</small></b></div>
    </div>
    <p class="muted sm">${tdee ? `<b>Your measured maintenance: ~${fmt(tdee)} kcal/day</b> (21 days of intake + weight trend). Target ${fmt(s.targets.kcal)} = a ${fmt(tdee - s.targets.kcal)} kcal deficit.` : 'Measured maintenance appears after 3 weeks of logging food + weigh-ins. This answers the fast-vs-slow metabolism question with your own data.'}</p>
  </section>

  <section class="card">
    <div class="card-h"><h2>Steps, 14 days</h2></div><p class="card-sub">${stepsLogged.length ? `Avg ${fmt(L.mean(stepsLogged.map((x) => x.v)))} · ${steps.filter((x) => x.v >= s.stepsGoal).length} of 14 days at ${s.stepsGoal / 1000}k+` : 'Log steps on Today.'}</p>
    ${barChart(steps, s.stepsGoal, 'var(--good)', (v) => fmt(v))}
  </section>

  <section class="card">
    <div class="card-h"><h2>Sleep, 14 days</h2></div><p class="card-sub">${sleepLogged.length ? `Avg ${L.mean(sleepLogged.map((x) => x.v)).toFixed(1)} h on logged days` : 'Log sleep on Today.'}</p>
    ${barChart(sleep, s.sleepGoal, 'var(--protein)', (v) => `${v} h`)}
    <p class="muted sm">Split days (pre-shift nap, post-shift short sleep) average out over the week. Aim for ~7.2 h overall.</p>
  </section>

  <section class="card">
    <div class="card-h"><h2>Training this week</h2></div>
    <div class="stat-row">
      <div class="stat"><span>Sessions</span><b>${doneWk}<small>/5</small></b></div>
      <div class="stat"><span>Cardio</span><b>${cardioWk}<small>min</small></b></div>
      <div class="stat"><span>Cardio target</span><b>${s.cardio.min}<small>min/day</small></b></div>
    </div>
  </section>

  ${reviews.length ? `<section class="card"><div class="card-h"><h2>Weekly check-ins</h2></div><div class="list compact">${reviews.map(([w, r]) => `<div class="li static"><span class="li-main"><b>Week of ${esc(L.fmtShort(w))}</b><span>${esc(r.text || '')}</span></span><span class="li-num"><b class="${r.change <= 0 ? 'good' : 'bad'}">${r.change > 0 ? '+' : '−'}${Math.abs(bwVal(r.change)).toFixed(1)}</b><span>${r.applied ? 'applied' : 'noted'}</span></span></div>`).join('')}</div></section>` : ''}
  `;
}

function checkinSheet(id) {
  const st = store.state;
  const c = id ? st.checkins.find((x) => x.id === id) : null;
  openSheet(`<h3>${c ? 'Edit check-in' : 'Check-in'}</h3>
    <p class="muted">Every 2 weeks: same spot, same light, morning. Front, side, back photos (they stay in your camera roll) + tape at the belly button, relaxed, after breathing out.</p>
    <label class="field"><span class="lbl">Date</span><input name="ci_date" type="date" value="${esc(c ? c.date : today())}"></label>
    <div class="grid2">
      <label class="field"><span class="lbl">Waist at belly button (cm)</span><input name="ci_waist" type="number" inputmode="decimal" step="0.5" value="${c && c.waist ? c.waist : ''}"></label>
      <label class="field"><span class="lbl">Neck (cm)</span><input name="ci_neck" type="number" inputmode="decimal" step="0.5" value="${c && c.neck ? c.neck : ''}"></label>
    </div>
    <label class="check-row"><input type="checkbox" name="ci_photos" ${!c || c.photos ? 'checked' : ''}> Took front / side / back photos</label>
    <label class="field"><span class="lbl">Note</span><input name="ci_note" value="${esc(c && c.note ? c.note : '')}" placeholder="optional" autocomplete="off"></label>
    <div class="row"><button class="btn primary grow" data-act="pSaveCheckin" ${c ? `data-id="${c.id}"` : ''}>Save</button>${c ? `<button class="btn ghost" data-act="pDelCheckin" data-id="${c.id}">${ICONS.trash}Delete</button>` : ''}</div>`);
}

export const actions = {
  pRange(el) { range = +el.dataset.v; rerender(); },
  pCheckin(el) { checkinSheet(el && el.dataset ? el.dataset.id : null); },
  pSaveCheckin(el) {
    const v = formVals();
    const st = store.state;
    const rec = { date: v.ci_date || today(), waist: L.num(v.ci_waist), neck: L.num(v.ci_neck), photos: !!v.ci_photos, note: (v.ci_note || '').trim() };
    if (rec.waist && (rec.waist < 50 || rec.waist > 200)) return toast('Waist should be in cm');
    if (el.dataset.id) {
      const i = st.checkins.findIndex((x) => x.id === el.dataset.id);
      if (i >= 0) st.checkins[i] = { ...st.checkins[i], ...rec };
    } else st.checkins.push({ id: uid(), ...rec });
    save(); closeSheet(); rerender(); toast('Check-in saved');
  },
  pDelCheckin(el) {
    const st = store.state;
    st.checkins = st.checkins.filter((x) => x.id !== el.dataset.id);
    save(); closeSheet(); rerender();
  },
};
