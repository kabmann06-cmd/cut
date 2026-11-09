// Cut — Plan screen (targets, schedule, exams, units, reminders, foods, program, backup)
import { PROGRAM, SESSIONS, RULES, APP_VERSION, EQUIP } from './data.js';
import * as L from './logic.js';
import { store, save, today, uid, exportJSON, importJSON, resetAll } from './store.js';
import { esc, fmt, toast, openSheet, closeSheet, rerender, ICONS, bwVal, toKg, bwUnit, formVals } from './ui.js';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DOW_LONG = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getPath(o, p) { return p.split('.').reduce((x, k) => (x == null ? x : x[k]), o); }
function setPath(o, p, v) { const ks = p.split('.'); const last = ks.pop(); const t = ks.reduce((x, k) => x[k], o); t[last] = v; }

function numField(label, path, { unit = '', step = 1, bw = false, min, max } = {}) {
  const raw = getPath(store.state.settings, path);
  const val = raw == null ? '' : bw ? bwVal(raw).toFixed(1) : raw;
  return `<label class="field"><span class="lbl">${label}</span><span class="in-wrap"><input type="number" inputmode="decimal" step="${step}" value="${val}"
    data-chg="sNum" data-path="${path}" ${bw ? 'data-bw="1"' : ''} ${min != null ? `data-min="${min}"` : ''} ${max != null ? `data-max="${max}"` : ''}><span>${unit}</span></span></label>`;
}
function dayToggles(path, active) {
  return `<div class="dow">${DOW.map((l, i) => `<button class="${active.includes(i) ? 'on' : ''}" data-act="sToggleDay" data-path="${path}" data-d="${i}" aria-pressed="${active.includes(i)}" aria-label="${DOW_LONG[i]}">${l}</button>`).join('')}</div>`;
}
function rangeList(kind, list) {
  if (!list.length) return '<p class="muted sm">None yet.</p>';
  return `<div class="list compact">${list.map((r, i) => `<div class="li static"><span class="li-main"><b>${esc(r.label || (kind === 'exams' ? 'Exams' : 'Maintenance'))}</b><span>${esc(L.fmtShort(r.start))} → ${esc(L.fmtShort(r.end))}, ${r.start.slice(0, 4)}</span></span>
    <button class="icon-btn" data-act="sDelRange" data-kind="${kind}" data-i="${i}" aria-label="Remove">${ICONS.trash}</button></div>`).join('')}</div>`;
}
function rangeForm(kind) {
  return `<div class="range-form"><input type="date" name="${kind}_start" aria-label="Start"><input type="date" name="${kind}_end" aria-label="End">
    <input type="text" name="${kind}_label" placeholder="${kind === 'exams' ? 'e.g. Midterms' : 'e.g. Reading week'}" aria-label="Label">
    <button class="btn sm" data-act="sAddRange" data-kind="${kind}">${ICONS.plus}Add</button></div>`;
}

function programRef() {
  return SESSIONS.map((sk) => {
    const p = PROGRAM[sk];
    return `<details class="prog"><summary><b>${p.name}</b><span>${p.focus}${p.intervals ? ' · interval finisher' : ''}</span></summary>
      <ol>${p.ex.map((e) => `<li><b>${esc(e.v[0][0])}</b> ${e.sets} × ${e.reps[0]}–${e.reps[1]}${e.core ? ' <span class="pill tiny">exam core</span>' : ''}
        <br><span class="muted sm">Swaps: ${e.v.slice(1).map((v) => `${esc(v[0])} (${EQUIP[v[1]].label.toLowerCase()})`).join(' · ') || '—'}</span></li>`).join('')}</ol></details>`;
  }).join('');
}

export function render() {
  const st = store.state;
  const s = st.settings;
  const icsUrl = new URL('reminders.ics', location.href).href.split('#')[0];
  return `<header class="top"><div class="eyebrow">Settings + reference</div><h1>Plan</h1></header>

  <section class="card">
    <div class="card-h"><h2>Daily targets</h2></div>
    <div class="grid2">
      ${numField('Calories', 'targets.kcal', { unit: 'kcal', step: 50, min: 1200, max: 6000 })}
      ${numField('Protein', 'targets.p', { unit: 'g', step: 5, min: 50, max: 400 })}
      ${numField('Fat', 'targets.f', { unit: 'g', step: 5, min: 20, max: 250 })}
      ${numField('Carbs', 'targets.c', { unit: 'g', step: 5, min: 0, max: 800 })}
      ${numField('Floor (never below)', 'floorKcal', { unit: 'kcal', step: 50, min: 1200, max: 4000 })}
      ${numField('Maintenance week', 'maintenanceKcal', { unit: 'kcal', step: 50, min: 1500, max: 6000 })}
    </div>
    <p class="muted sm">The weekly check-in suggests changes; nothing moves unless you tap Apply.</p>
  </section>

  <section class="card">
    <div class="card-h"><h2>Cardio + goals</h2></div>
    <div class="grid2">
      ${numField('Cardio now', 'cardio.min', { unit: 'min', step: 5, min: 0, max: 120 })}
      ${numField('Cardio cap', 'cardio.cap', { unit: 'min', step: 5, min: 0, max: 120 })}
      ${numField('Steps goal', 'stepsGoal', { unit: 'steps', step: 500, min: 1000, max: 40000 })}
      ${numField('Sleep goal', 'sleepGoal', { unit: 'h', step: 0.5, min: 4, max: 12 })}
      ${numField('Water goal', 'waterGoal', { unit: 'L', step: 0.5, min: 1, max: 8 })}
      ${numField('Goal weight', 'goalWeight', { unit: bwUnit(), step: 0.5, bw: true })}
      ${numField('Height', 'heightCm', { unit: 'cm', step: 0.5, min: 120, max: 230 })}
      ${numField('Photo BF estimate', 'bfEstimate', { unit: '%', step: 0.5, min: 3, max: 60 })}
      ${numField('Weight at that estimate', 'bfEstimateWeight', { unit: bwUnit(), step: 0.1, bw: true })}
    </div>
  </section>

  <section class="card">
    <div class="card-h"><h2>Schedule</h2></div>
    <p class="lbl">Nights you work (the day the shift starts)</p>
    ${dayToggles('shiftNights', s.shiftNights)}
    <div class="grid2">
      <label class="field"><span class="lbl">Shift start</span><input type="time" value="${esc(s.shiftStart)}" data-chg="sText" data-path="shiftStart"></label>
      <label class="field"><span class="lbl">Shift end</span><input type="time" value="${esc(s.shiftEnd)}" data-chg="sText" data-path="shiftEnd"></label>
    </div>
    <p class="lbl">Gym days (between-shift and post-shift days are skipped automatically)</p>
    ${dayToggles('gymDays', s.gymDays)}
    <p class="muted sm">This week: ${L.weekPlan(st, today(), today()).days.map((k) => `${L.wd(k)} ${({ normal: 'school', pre: 'pre-shift', between: 'shift', post: 'reset' })[L.dayType(k, s)]}`).join(' · ')}</p>
  </section>

  <section class="card">
    <div class="card-h"><h2>Exam periods</h2></div>
    <p class="muted sm">Exam mode turns on automatically: top 4 lifts + an incline walk with flashcards. You can also flip it per day on Today.</p>
    ${rangeList('exams', s.exams)}${rangeForm('exams')}
  </section>

  <section class="card">
    <div class="card-h"><h2>Maintenance weeks</h2></div>
    <p class="muted sm">Planned breaks at maintenance calories. Pre-set for Dec 24–31.</p>
    ${rangeList('maintenance', s.maintenance)}${rangeForm('maintenance')}
  </section>

  <section class="card">
    <div class="card-h"><h2>Units</h2></div>
    <div class="row">
      <div class="seg two grow"><button class="${s.units.body === 'kg' ? 'on' : ''}" data-act="sUnit" data-k="body" data-v="kg">Body kg</button><button class="${s.units.body === 'lb' ? 'on' : ''}" data-act="sUnit" data-k="body" data-v="lb">Body lb</button></div>
      <div class="seg two grow"><button class="${s.units.lift === 'lb' ? 'on' : ''}" data-act="sUnit" data-k="lift" data-v="lb">Lifts lb</button><button class="${s.units.lift === 'kg' ? 'on' : ''}" data-act="sUnit" data-k="lift" data-v="kg">Lifts kg</button></div>
    </div>
  </section>

  <section class="card">
    <div class="card-h"><h2>Reminders</h2></div>
    <div class="list">
      <div class="li static"><span class="plan-ic">${ICONS.calendar}</span><span class="li-main"><b>Calendar reminders</b><span>Weigh-in, meals, gym, caffeine cutoff, steps check, wind-down, nap, shift meals. Open the link in <b>Safari</b> → Add All.</span></span></div>
    </div>
    <div class="row wrap"><a class="btn" href="${esc(icsUrl)}" target="_blank" rel="noopener">${ICONS.calendar}Open reminders.ics</a><button class="btn" data-act="sCopyLink" data-url="${esc(icsUrl)}">${ICONS.copy}Copy link</button></div>
    <div class="list"><button class="li" data-act="sShortcut"><span class="plan-ic">${ICONS.steps}</span><span class="li-main"><b>Steps Shortcut</b><span>Reads Apple Health, pings you with steps left, copies the number for this app.</span></span><span class="chev">${ICONS.right}</span></button></div>
  </section>

  <section class="card">
    <div class="card-h"><h2>Foods + meals</h2></div>
    <div class="row"><button class="btn grow" data-act="sFoods">My foods (${st.foods.length})</button><button class="btn grow" data-act="sMeals">My meals (${st.meals.length})</button></div>
  </section>

  <section class="card">
    <div class="card-h"><h2>The program</h2></div>
    ${programRef()}
    <details class="prog"><summary><b>Training rules</b></summary><ul>${RULES.training.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></details>
    <details class="prog"><summary><b>Cardio rules</b></summary><ul>${RULES.cardio.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></details>
  </section>

  <section class="card">
    <div class="card-h"><h2>Backup</h2></div>
    <p class="muted sm">Your data lives only on this phone. Export weekly to Files or iCloud Drive. ${st.lastBackup ? `Last backup: <b>${esc(L.fmtShort(st.lastBackup))}</b>.` : '<b class="warn">No backup yet.</b>'}</p>
    <div class="row wrap">
      <button class="btn" data-act="sExport">${ICONS.download}Export</button>
      <label class="btn">${ICONS.upload}Import<input type="file" accept="application/json,.json" data-chg="sImportFile" hidden></label>
      <button class="btn ghost" data-act="sCopyJSON">${ICONS.copy}Copy data</button>
    </div>
    <div class="row"><button class="btn ghost danger" data-act="sReset">Reset everything</button></div>
  </section>
  <p class="muted center sm">Cut ${APP_VERSION} · ${store.storageOk ? 'storage OK' : '<b class="bad">storage blocked</b>'}${store.persisted ? ' · persistent' : ''}</p>`;
}

function shortcutSheet() {
  openSheet(`<h3>Steps Shortcut</h3>
  <p class="muted">A web app can't read Apple Health, so a 1-minute Shortcut does it.</p>
  <ol class="steps-list">
    <li>Open <b>Shortcuts</b> → <b>+</b>. Name it <b>Steps</b> (exact name, so the app's button can run it).</li>
    <li>Add <b>Find Health Samples</b>. Set Type to <b>Steps</b>, add the filter <b>Start Date is Today</b>.</li>
    <li>Add <b>Calculate Statistics</b> → <b>Sum</b>.</li>
    <li>Add <b>Round Number</b> (Ones).</li>
    <li>Add <b>Copy to Clipboard</b> (Rounded Number).</li>
    <li>Add <b>Number</b> → <b>12000</b>, then <b>Calculate</b>: Number <b>−</b> Rounded Number.</li>
    <li>Add <b>If</b> Calculation Result <b>is greater than 0</b>: <b>Show Notification</b> “[Rounded Number] steps, [Calculation Result] left”. Otherwise: <b>Show Notification</b> “12k done”.</li>
    <li><b>Automation</b> tab → <b>+</b> → <b>Time of Day</b> 20:00, Daily, <b>Run Immediately</b> → Steps. Add a second one at 22:00 if you want.</li>
  </ol>
  <p class="muted sm">If you wear an Apple Watch and the count looks doubled, add the filter <b>Source is</b> your iPhone. If iOS won't read Health while the phone is locked, the automation can fail. Add the Shortcut as a Lock Screen or Home Screen widget and tap it instead.</p>
  <p class="muted sm">In this app: Today → Steps → <b>Run Steps Shortcut</b>, then come back and tap <b>Paste</b>.</p>`);
}

function foodsSheet() {
  const st = store.state;
  openSheet(`<h3>My foods</h3><p class="muted sm">Tap to edit. Values per 1 serving, or per 100 g for (g) foods.</p>
    <div class="list">${st.foods.map((f) => `<div class="li"><button class="li-main as-btn" data-act="fNewFood" data-id="${f.id}"><b>${esc(f.name)}</b><span>${f.unit === 'g' ? 'per 100 g' : esc(f.unit)} · ${fmt(f.kcal)} kcal · ${fmt(f.p, 1)} g P</span></button>
      <button class="icon-btn" data-act="sDelFood" data-id="${f.id}" aria-label="Delete ${esc(f.name)}">${ICONS.trash}</button></div>`).join('')}</div>`);
}
function mealsSheet() {
  const st = store.state;
  openSheet(`<h3>My meals</h3><p class="muted sm">Make new ones from Food → Add → Meals → New meal.</p>
    <div class="list">${st.meals.map((m) => { const t = L.mealTotals(m, st.foods); return `<div class="li"><span class="li-main"><b>${esc(m.name)}</b><span>${fmt(t.kcal)} kcal · ${fmt(t.p)} g P · ${m.items.length} items</span></span>
      <button class="icon-btn" data-act="sDelMeal" data-id="${m.id}" aria-label="Delete ${esc(m.name)}">${ICONS.trash}</button></div>`; }).join('')}</div>`);
}

async function copyText(txt, okMsg) {
  try { await navigator.clipboard.writeText(txt); toast(okMsg); } catch (e) { toast('Copy blocked by the browser'); }
}

export const actions = {
  sToggleDay(el) {
    const s = store.state.settings;
    const path = el.dataset.path;
    const d = +el.dataset.d;
    const arr = new Set(s[path]);
    if (arr.has(d)) arr.delete(d); else arr.add(d);
    s[path] = [...arr].sort();
    save(); rerender();
  },
  sUnit(el) { store.state.settings.units[el.dataset.k] = el.dataset.v; save(); rerender(); },
  sAddRange(el) {
    const kind = el.dataset.kind;
    const v = formVals(document.getElementById('main'));
    const start = v[`${kind}_start`], end = v[`${kind}_end`];
    if (!start || !end || end < start) return toast('Pick a start and an end date');
    store.state.settings[kind].push({ start, end, label: (v[`${kind}_label`] || '').trim() });
    store.state.settings[kind].sort((a, b) => (a.start < b.start ? -1 : 1));
    save(); rerender(); toast('Added');
  },
  sDelRange(el) { store.state.settings[el.dataset.kind].splice(+el.dataset.i, 1); save(); rerender(); },
  sShortcut: shortcutSheet,
  sCopyLink(el) { copyText(el.dataset.url, 'Link copied. Paste it into Safari.'); },
  sFoods: foodsSheet,
  sMeals: mealsSheet,
  sDelFood(el) {
    const st = store.state;
    const f = st.foods.find((x) => x.id === el.dataset.id);
    if (!f || !confirm(`Delete ${f.name}? Meals using it will skip it.`)) return;
    st.foods = st.foods.filter((x) => x.id !== f.id);
    save(); foodsSheet(); rerender();
  },
  sDelMeal(el) {
    const st = store.state;
    const m = st.meals.find((x) => x.id === el.dataset.id);
    if (!m || !confirm(`Delete ${m.name}?`)) return;
    st.meals = st.meals.filter((x) => x.id !== m.id);
    save(); mealsSheet(); rerender();
  },
  async sExport() {
    const st = store.state;
    const json = exportJSON();
    const name = `cut-backup-${today()}.json`;
    let done = false;
    try {
      const file = new File([json], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Cut backup' });
        done = true;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    if (!done) {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
    st.lastBackup = today();
    save(); rerender(); toast('Backup exported');
  },
  sCopyJSON() { copyText(exportJSON(), 'Data copied. Paste it into Notes or Files to keep it.'); },
  sReset() {
    if (!confirm('Delete ALL data on this phone? Export a backup first.')) return;
    if (!confirm('Really? This cannot be undone.')) return;
    resetAll(); location.hash = 'today'; location.reload();
  },
};

export const changes = {
  sNum(el) {
    let v = L.num(el.value);
    if (v == null) return toast('Enter a number');
    if (el.dataset.bw) v = Math.round(toKg(v) * 10) / 10;
    const min = el.dataset.min != null ? +el.dataset.min : null;
    const max = el.dataset.max != null ? +el.dataset.max : null;
    if ((min != null && v < min) || (max != null && v > max)) return toast(`Keep it between ${min} and ${max}`);
    const s = store.state.settings;
    setPath(s, el.dataset.path, v);
    if (el.dataset.path === 'cardio.min' && s.cardio.min > s.cardio.cap) s.cardio.cap = s.cardio.min;
    if (el.dataset.path === 'targets.kcal' && v < s.floorKcal) toast(`Heads up: that's under your ${s.floorKcal} kcal floor`);
    else toast('Saved');
    save();
  },
  sText(el) { setPath(store.state.settings, el.dataset.path, el.value); save(); toast('Saved'); },
  async sImportFile(el) {
    const f = el.files && el.files[0];
    if (!f) return;
    try {
      const txt = await f.text();
      if (!confirm('Replace everything on this phone with this backup?')) return;
      importJSON(txt);
      rerender(); toast('Backup restored');
    } catch (e) { toast(e.message || 'Import failed'); }
    el.value = '';
  },
};
