// Cut — persistence. Everything lives in this phone's storage; export backups from Plan.
import { DEFAULT_SETTINGS, DEFAULT_FOODS, DEFAULT_MEALS, APP_VERSION } from './data.js';
import { key } from './logic.js';

const KEY = 'cut.v1';
const clone = (o) => JSON.parse(JSON.stringify(o));

export const store = { state: null, storageOk: true };

export function fresh() {
  return {
    v: 1,
    onboarded: false,
    settings: clone(DEFAULT_SETTINGS),
    days: {},
    foods: clone(DEFAULT_FOODS),
    meals: clone(DEFAULT_MEALS),
    checkins: [],
    reviews: {},
    recent: [],
  };
}

export function migrate(s) {
  const f = fresh();
  if (!s || typeof s !== 'object') return f;
  const out = { ...f, ...s };
  const ss = s.settings || {};
  out.settings = { ...f.settings, ...ss };
  out.settings.targets = { ...f.settings.targets, ...(ss.targets || {}) };
  out.settings.cardio = { ...f.settings.cardio, ...(ss.cardio || {}) };
  out.settings.units = { ...f.settings.units, ...(ss.units || {}) };
  for (const k of ['days', 'reviews']) if (!out[k] || typeof out[k] !== 'object' || Array.isArray(out[k])) out[k] = {};
  for (const k of ['foods', 'meals', 'checkins', 'recent']) if (!Array.isArray(out[k])) out[k] = f[k];
  for (const k of ['shiftNights', 'gymDays', 'exams', 'maintenance', 'milestones']) if (!Array.isArray(out.settings[k])) out.settings[k] = f.settings[k];
  return out;
}

export function load() {
  let s = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) s = JSON.parse(raw);
  } catch (e) {
    store.storageOk = false;
  }
  store.state = migrate(s);
  return store.state;
}

let saveTimer = null;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    localStorage.setItem(KEY, JSON.stringify(store.state));
    store.storageOk = true;
  } catch (e) {
    store.storageOk = false;
  }
  return store.storageOk;
}
// For rapid typing (set inputs): batch writes.
export function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 400);
}

export const today = () => key(new Date());
export function day(k) {
  const d = store.state.days;
  if (!d[k]) d[k] = {};
  return d[k];
}
export const peekDay = (k) => store.state.days[k] || {};
export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-5);

export function exportJSON() {
  return JSON.stringify({ app: 'cut', version: APP_VERSION, exported: new Date().toISOString(), state: store.state });
}
export function importJSON(text) {
  const obj = JSON.parse(text);
  const s = obj && obj.state ? obj.state : obj;
  if (!s || typeof s !== 'object' || !s.settings || !s.days) throw new Error('That file is not a Cut backup.');
  store.state = migrate(s);
  save();
}
export function resetAll() {
  store.state = fresh();
  save();
}
