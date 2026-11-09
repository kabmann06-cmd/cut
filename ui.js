// Cut — shared UI helpers (formatting, rings, sheets, toasts, icons).
import { store } from './store.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = (n, d = 0) => (n == null || Number.isNaN(Number(n)) ? '–' : Number(n).toLocaleString('en-CA', { minimumFractionDigits: d, maximumFractionDigits: d }));
export const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// Re-render hook (set by app.js)
let _rerender = () => {};
export const setRerender = (fn) => { _rerender = fn; };
export const rerender = () => _rerender();

// Units
export const bwUnit = () => store.state.settings.units.body;
export const liftUnit = () => store.state.settings.units.lift;
export const bwVal = (kg) => (kg == null ? null : bwUnit() === 'lb' ? kg * 2.20462 : kg);
export const bwFmt = (kg, d = 1) => (kg == null ? '—' : bwVal(kg).toFixed(d));
export const toKg = (v) => (bwUnit() === 'lb' ? v / 2.20462 : v);

// Progress ring
export function ring(value, max, color, { size = 124, stroke = 11, overBad = false } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const over = max > 0 && value > max;
  const col = over && overBad ? 'var(--bad)' : color;
  const h = size / 2;
  return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/>
    <circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke="${col}" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(2)}" transform="rotate(-90 ${h} ${h})"/>
  </svg>`;
}
export function bar(value, max, color, overBad = false) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const over = overBad && max > 0 && value > max;
  return `<div class="bar"><i style="width:${pct.toFixed(1)}%;background:${over ? 'var(--bad)' : color}"></i></div>`;
}

// Bottom sheet
export const sheetHooks = { onClose: null };
export function openSheet(html, { onOpen } = {}) {
  const root = document.getElementById('sheet');
  if (sheetHooks.onClose) { try { sheetHooks.onClose(); } catch (e) { /* ignore */ } sheetHooks.onClose = null; }
  root.innerHTML = `<div class="sheet-bg" data-act="closeSheet"></div>
    <div class="sheet" role="dialog" aria-modal="true"><div class="sheet-grip" data-act="closeSheet"></div><div class="sheet-body">${html}</div></div>`;
  root.classList.add('open');
  document.documentElement.classList.add('locked');
  requestAnimationFrame(() => { const s = root.querySelector('.sheet'); if (s) s.classList.add('in'); });
  if (onOpen) onOpen(root);
}
export function setSheet(html) {
  const b = document.querySelector('#sheet .sheet-body');
  if (b) { b.innerHTML = html; b.scrollTop = 0; }
}
export function closeSheet() {
  if (sheetHooks.onClose) { try { sheetHooks.onClose(); } catch (e) { /* ignore */ } sheetHooks.onClose = null; }
  const root = document.getElementById('sheet');
  root.classList.remove('open');
  root.innerHTML = '';
  document.documentElement.classList.remove('locked');
}
export const sheetOpen = () => document.getElementById('sheet').classList.contains('open');

// Toast
let toastTimer = null;
export function toast(msg, { action, onAction, ms = 2800 } = {}) {
  const el = document.getElementById('toast');
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button class="toast-btn" type="button">${esc(action)}</button>` : ''}`;
  el.classList.add('show');
  if (action) el.querySelector('button').addEventListener('click', () => { el.classList.remove('show'); if (onAction) onAction(); });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), action ? Math.max(ms, 4500) : ms);
}

// Read a sheet's inputs by name
export function formVals(root = document.getElementById('sheet')) {
  const out = {};
  root.querySelectorAll('[name]').forEach((el) => {
    out[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  });
  return out;
}

const I = (d, extra = '') => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
export const ICONS = {
  today: I('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>'),
  food: I('<path d="M7 2v8a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2"/><path d="M9 12v10"/><path d="M17 2c-1.7 1.3-2.5 3.5-2.5 6.5 0 2 .8 3.2 2.5 3.5V22"/>'),
  train: I('<path d="M6.5 6.5v11"/><path d="M17.5 6.5v11"/><path d="M3.5 9v6"/><path d="M20.5 9v6"/><path d="M6.5 12h11"/>'),
  progress: I('<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-7"/>'),
  plan: I('<path d="M4 6h10"/><path d="M18 6h2"/><circle cx="16" cy="6" r="2"/><path d="M4 12h4"/><path d="M12 12h8"/><circle cx="10" cy="12" r="2"/><path d="M4 18h12"/><path d="M20 18h0"/><circle cx="18" cy="18" r="2"/>'),
  plus: I('<path d="M12 5v14"/><path d="M5 12h14"/>'),
  minus: I('<path d="M5 12h14"/>'),
  check: I('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  swap: I('<path d="M7 4 3 8l4 4"/><path d="M3 8h13a4 4 0 0 1 4 4"/><path d="m17 20 4-4-4-4"/><path d="M21 16H8a4 4 0 0 1-4-4"/>'),
  left: I('<path d="m15 18-6-6 6-6"/>'),
  right: I('<path d="m9 18 6-6-6-6"/>'),
  x: I('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  timer: I('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><path d="M10 2h4"/>'),
  scan: I('<path d="M4 7V5a1 1 0 0 1 1-1h2"/><path d="M17 4h2a1 1 0 0 1 1 1v2"/><path d="M20 17v2a1 1 0 0 1-1 1h-2"/><path d="M7 20H5a1 1 0 0 1-1-1v-2"/><path d="M8 8v8"/><path d="M11 8v8"/><path d="M14 8v8"/><path d="M17 8v8"/>'),
  search: I('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  trash: I('<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>'),
  copy: I('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
  moon: I('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  steps: I('<path d="M8 16c-1.5 0-3-1-3-4.5S6.5 5 8.5 5s2.5 2.5 2.5 5-1 6-3 6z"/><path d="M6.5 19.5c.2 1 1 1.5 1.8 1.5s1.6-.7 1.6-1.7"/><path d="M16 12c1.5 0 3-1 3-4.5S17.5 1 15.5 1 13 3.5 13 6s1 6 3 6z"/><path d="M17.5 15.5c-.2 1-1 1.5-1.8 1.5s-1.6-.7-1.6-1.7"/>'),
  scale: I('<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 9a5 5 0 0 1 8 0"/><path d="m12 9 1.5-2"/>'),
  flame: I('<path d="M12 22c4 0 7-2.7 7-7 0-3-1.5-5.5-4-8 0 2.5-1.2 4-3 4 0-3-1-6-4-9 0 4-5 6.5-5 12 0 4.3 4 8 9 8z"/>'),
  drop: I('<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/>'),
  edit: I('<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="m13.5 6.5 4 4"/>'),
  info: I('<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h0"/>'),
  bolt: I('<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>'),
  calendar: I('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/>'),
  download: I('<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>'),
  upload: I('<path d="M12 20V9"/><path d="m7 14 5-5 5 5"/><path d="M5 4h14"/>'),
};
