// Cut — app shell: routing, onboarding, event delegation, service worker.
import { load, save, store, today, day } from './store.js';
import { setRerender, toast, closeSheet, sheetOpen, formVals, ICONS } from './ui.js';
import * as L from './logic.js';
import * as Today from './view-today.js';
import * as Food from './view-food.js';
import * as Train from './view-train.js';
import * as Progress from './view-progress.js';
import * as Plan from './view-plan.js';

load();

const views = { today: Today, food: Food, train: Train, progress: Progress, plan: Plan };

function onboardHTML() {
  return `<section class="onb">
    <div class="onb-mark">${ICONS.flame}</div>
    <h1>Cut</h1>
    <p class="muted">Calories, training, cardio, steps and sleep, built around your night shifts.</p>
    <form class="card" data-submit="onboard">
      <label class="field"><span class="lbl">Current weight (kg)</span><input name="ob_w" type="number" inputmode="decimal" step="0.1" placeholder="kg" required></label>
      <div class="grid2">
        <label class="field"><span class="lbl">Height (cm)</span><input name="ob_h" type="number" inputmode="decimal" step="0.5" placeholder="cm"></label>
        <label class="field"><span class="lbl">Goal weight (kg)</span><input name="ob_goal" type="number" inputmode="decimal" step="0.5" value="85"></label>
      </div>
      <label class="field"><span class="lbl">Body-fat estimate from your photos (%)</span><input name="ob_bf" type="number" inputmode="decimal" step="0.5" placeholder="%"></label>
      <p class="muted sm">Starts you on 2,300 kcal · 200 g protein · 45 min cardio · 12k steps, with Fri + Sat night shifts (23:00–11:00) and gym Mon–Fri. All editable in Plan.</p>
      <button class="btn primary block" type="submit">Start the cut</button>
    </form>
    <p class="muted sm center">Moving phones? <label class="link">Import a backup<input type="file" accept="application/json,.json" data-chg="sImportFile" hidden></label></p>
  </section>`;
}

function parseHash() {
  const h = location.hash.replace(/^#/, '');
  const [r, q] = h.split('?');
  return { r: views[r] ? r : 'today', q: q || '' };
}

let lastRoute = null;
function render() {
  const main = document.getElementById('main');
  const on = !!store.state.onboarded;
  document.body.classList.toggle('onboarding', !on);
  if (!on) { main.innerHTML = onboardHTML(); return; }
  const { r, q } = parseHash();
  if (r !== lastRoute) {
    if (views[r].onEnter) views[r].onEnter();
    lastRoute = r;
  }
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.r === r));
  main.innerHTML = views[r].render();
  if (r === 'food' && q === 'add') {
    history.replaceState(null, '', '#food');
    Food.actions.fAdd();
  }
}
setRerender(render);

const common = {
  closeSheet,
  onboard() {
    const v = formVals(document.getElementById('main'));
    const w = L.num(v.ob_w);
    if (!w || w < 30 || w > 300) return toast('Enter your weight in kg');
    const s = store.state.settings;
    const k = today();
    s.startWeight = w;
    s.startDate = k;
    s.heightCm = L.num(v.ob_h) || null;
    s.goalWeight = L.num(v.ob_goal) || 85;
    const bf = L.num(v.ob_bf);
    if (bf) { s.bfEstimate = bf; s.bfEstimateWeight = w; }
    day(k).weight = w;
    store.state.onboarded = true;
    save();
    requestPersist();
    location.hash = 'today';
    render();
    toast('You’re set. Log breakfast first.');
  },
};

const ACT = { ...Today.actions, ...Food.actions, ...Train.actions, ...Progress.actions, ...Plan.actions, ...common };
const INP = { ...(Food.inputs || {}), ...(Train.inputs || {}) };
const CHG = { ...(Plan.changes || {}) };

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  try { const r = fn(el, e); if (r && r.catch) r.catch((err) => { console.error(err); toast('Something went wrong'); }); }
  catch (err) { console.error(err); toast('Something went wrong'); }
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-inp]');
  if (el && INP[el.dataset.inp]) INP[el.dataset.inp](el, e);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-chg]');
  if (el && CHG[el.dataset.chg]) CHG[el.dataset.chg](el, e);
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-submit]');
  if (!f) return;
  e.preventDefault();
  const fn = ACT[f.dataset.submit];
  if (fn) fn(f, e);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sheetOpen()) closeSheet();
});
window.addEventListener('hashchange', () => {
  if (sheetOpen()) closeSheet();
  render();
  window.scrollTo(0, 0);
});

// Re-render when the app comes back (new day, fresh plan)
let lastDay = today();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && today() !== lastDay) {
    lastDay = today();
    if (!sheetOpen()) render();
  }
});

function requestPersist() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persisted().then((p) => {
        store.persisted = p;
        if (!p) navigator.storage.persist().then((x) => { store.persisted = x; }).catch(() => {});
      }).catch(() => {});
    }
  } catch (e) { /* not supported */ }
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) toast('Cut updated', { action: 'Reload', onAction: () => location.reload() });
  });
}

if (!store.storageOk) setTimeout(() => toast('Storage is blocked. Data won’t save. Open from the Home Screen icon.', { ms: 6000 }), 600);
if (store.state.onboarded) requestPersist();
render();
