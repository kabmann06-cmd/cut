// Cut — Food screen (log, saved meals, food library, quick add, Open Food Facts search + barcode)
import { RULES } from './data.js';
import * as L from './logic.js';
import { store, save, today, day, peekDay, uid } from './store.js';
import { esc, fmt, bar, toast, openSheet, setSheet, closeSheet, sheetHooks, rerender, ICONS, formVals } from './ui.js';

let viewKey = null;
const sel = () => viewKey || today();
let tab = 'meals';
let foodQuery = '';
let pending = null;           // { mode: 'add'|'edit', food, qty, back, id?, serving?, servingLabel?, fromOff? }
let off = { q: '', busy: false, err: '', results: [] };
let scanReader = null;

export function onEnter() { viewKey = null; }

const OFF_FIELDS = 'code,product_name,brands,nutriments,serving_size,serving_quantity';
const r1 = (v) => Math.round(v * 10) / 10;

function qtyText(e) {
  if (e.unit === 'g') return `${fmt(e.qty)} g`;
  if (e.unit === 'meal') return e.qty !== 1 ? `${fmt(e.qty, e.qty % 1 ? 2 : 0)} × meal` : 'meal';
  return `${fmt(e.qty, e.qty % 1 ? 1 : 0)} × ${e.unit}`;
}
function entryNums(e) {
  const m = L.entryFactor(e);
  return { kcal: Math.round((e.per.kcal || 0) * m), p: Math.round((e.per.p || 0) * m) };
}
function entryRow(e) {
  const n = entryNums(e);
  return `<button class="li" data-act="fEdit" data-id="${e.id}">
    <span class="li-time">${esc(e.time || '')}</span>
    <span class="li-main"><b>${esc(e.name)}</b><span>${esc(qtyText(e))}</span></span>
    <span class="li-num"><b>${fmt(n.kcal)}</b><span>${n.p} g P</span></span></button>`;
}

export function render() {
  const st = store.state;
  const s = st.settings;
  const td = today();
  const k = sel();
  const d = peekDay(k);
  const t = L.dayTotals(d);
  const tg = L.targetsFor(st, k);
  const entries = (d.food || []).slice().sort((a, b) => ((a.time || '') < (b.time || '') ? -1 : 1));
  const kLeft = tg.kcal - t.kcal;
  const pLeft = tg.p - t.p;
  return `
  <header class="top"><div class="eyebrow">${k === td ? 'Today' : esc(L.fmtDate(k, true))}</div>
    <div class="top-row"><h1>Food</h1>
      <div class="daynav">
        <button class="icon-btn" data-act="fPrev" aria-label="Previous day">${ICONS.left}</button>
        <span>${esc(L.fmtShort(k))}</span>
        <button class="icon-btn" data-act="fNext" ${k >= td ? 'disabled' : ''} aria-label="Next day">${ICONS.right}</button>
      </div></div></header>
  <section class="card totals">
    <div class="tot"><div class="tot-h"><span>Calories</span><b>${fmt(t.kcal)}<small> / ${fmt(tg.kcal)}</small></b></div>
      ${bar(t.kcal, tg.kcal, 'var(--kcal)', true)}
      <div class="tot-s ${kLeft < 0 ? 'bad' : ''}">${kLeft >= 0 ? `${fmt(kLeft)} left` : `${fmt(-kLeft)} over`}${tg.maintenance ? ' · maintenance week' : ''}</div></div>
    <div class="tot"><div class="tot-h"><span>Protein</span><b>${t.p}<small> / ${tg.p} g</small></b></div>
      ${bar(t.p, tg.p, 'var(--protein)')}
      <div class="tot-s">${pLeft > 0 ? `${pLeft} g to go` : 'Protein hit'}</div></div>
    <div class="tot-mini"><span>Carbs <b>${t.c}</b>/${tg.c} g</span><span>Fat <b>${t.f}</b>/${tg.f} g</span><span>Caffeine <b>${t.caf}</b> mg</span></div>
  </section>
  <div class="row"><button class="btn primary grow" data-act="fAdd">${ICONS.plus}Add food</button>
    <button class="btn" data-act="fRepeat">${ICONS.copy}Repeat yesterday</button></div>
  <section class="card list-card">${entries.length ? entries.map(entryRow).join('') : '<p class="muted center pad">Nothing logged yet. Tap Add food. Saved meals are one tap.</p>'}</section>
  <section class="card tips"><h2>Food rules</h2><ul>${RULES.food.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></section>`;
}

// ---------- add sheet ----------
function mealsTab() {
  const st = store.state;
  return `<div class="list">${st.meals.map((m) => {
    const t = L.mealTotals(m, st.foods);
    return `<button class="li" data-act="fLogMeal" data-id="${m.id}"><span class="li-main"><b>${esc(m.name)}</b><span>${fmt(t.kcal)} kcal · ${fmt(t.p)} g protein</span></span><span class="add-ic">${ICONS.plus}</span></button>`;
  }).join('')}</div>
  <button class="btn block ghost" data-act="fNewMeal">${ICONS.plus}New meal</button>`;
}
function foodsList() {
  const q = foodQuery.trim().toLowerCase();
  const list = store.state.foods.filter((f) => !q || f.name.toLowerCase().includes(q));
  if (!list.length) return '<p class="muted center pad">No match. Try the Search tab for packaged foods.</p>';
  return list.map((f) => `<button class="li" data-act="fPickFood" data-id="${f.id}"><span class="li-main"><b>${esc(f.name)}</b>
    <span>${f.unit === 'g' ? 'per 100 g' : esc(f.unit)} · ${fmt(f.kcal)} kcal · ${fmt(f.p, f.p % 1 ? 1 : 0)} g P</span></span><span class="add-ic">${ICONS.plus}</span></button>`).join('');
}
function foodsTab() {
  return `<label class="field search">${ICONS.search}<input type="search" placeholder="Filter your foods" value="${esc(foodQuery)}" data-inp="fFoodQ" autocomplete="off"></label>
    <div class="list" id="foodsList">${foodsList()}</div>
    <button class="btn block ghost" data-act="fNewFood">${ICONS.plus}New food</button>`;
}
function recentTab() {
  const r = store.state.recent;
  if (!r.length) return '<p class="muted center pad">Anything you log shows up here for one-tap re-logging.</p>';
  return `<div class="list">${r.map((e, i) => {
    const n = entryNums(e);
    return `<button class="li" data-act="fLogRecent" data-i="${i}"><span class="li-main"><b>${esc(e.name)}</b><span>${esc(qtyText(e))} · ${fmt(n.kcal)} kcal · ${n.p} g P</span></span><span class="add-ic">${ICONS.plus}</span></button>`;
  }).join('')}</div>`;
}
function quickTab() {
  return `<label class="field"><span class="lbl">Name (optional)</span><input name="qname" placeholder="e.g. Shawarma plate" autocomplete="off"></label>
  <div class="grid2">
    <label class="field"><span class="lbl">Calories</span><input name="qkcal" type="number" inputmode="numeric" placeholder="kcal"></label>
    <label class="field"><span class="lbl">Protein (g)</span><input name="qp" type="number" inputmode="decimal" placeholder="g"></label>
    <label class="field"><span class="lbl">Carbs (g)</span><input name="qc" type="number" inputmode="decimal" placeholder="optional"></label>
    <label class="field"><span class="lbl">Fat (g)</span><input name="qf" type="number" inputmode="decimal" placeholder="optional"></label>
    <label class="field"><span class="lbl">Caffeine (mg)</span><input name="qcaf" type="number" inputmode="numeric" placeholder="optional"></label>
  </div>
  <button class="btn primary block" data-act="fQuickAdd">Add</button>`;
}
function offResultsHTML() {
  if (off.busy) return '<p class="muted center pad">Searching…</p>';
  if (off.err) return `<p class="bad center pad">${esc(off.err)}</p>`;
  if (!off.results.length) return '';
  return `<div class="list">${off.results.map((p, i) => `<button class="li" data-act="fOffPick" data-i="${i}">
    <span class="li-main"><b>${esc(p.name)}</b><span>${fmt(p.per100.kcal)} kcal · ${fmt(p.per100.p, 1)} g P per 100 g${p.servingLabel ? ` · serving ${esc(p.servingLabel)}` : ''}</span></span><span class="add-ic">${ICONS.plus}</span></button>`).join('')}</div>`;
}
function searchTab() {
  return `<form class="row" data-submit="fSearch"><label class="field search grow">${ICONS.search}<input name="offq" type="search" placeholder="Search packaged foods" value="${esc(off.q)}" enterkeyhint="search" autocomplete="off"></label><button class="btn" type="submit">Go</button></form>
  <form class="row" data-submit="fBarcode"><button class="btn" type="button" data-act="fScan">${ICONS.scan}Scan</button>
    <label class="field grow"><input name="barcode" type="text" inputmode="numeric" placeholder="or type the barcode" autocomplete="off"></label><button class="btn" type="submit">Look up</button></form>
  <div id="offRes">${offResultsHTML()}</div>
  <p class="muted sm">Data from Open Food Facts (needs internet). Double-check against the label.</p>`;
}
function addSheetHTML() {
  const tabs = [['meals', 'Meals'], ['foods', 'Foods'], ['recent', 'Recent'], ['quick', 'Quick'], ['search', 'Search']];
  const bodies = { meals: mealsTab, foods: foodsTab, recent: recentTab, quick: quickTab, search: searchTab };
  return `<h3>Add to ${sel() === today() ? 'today' : esc(L.fmtShort(sel()))}</h3>
    <div class="seg" role="tablist">${tabs.map(([id, l]) => `<button class="${tab === id ? 'on' : ''}" data-act="fTab" data-t="${id}" role="tab" aria-selected="${tab === id}">${l}</button>`).join('')}</div>
    <div class="tab-body">${(bodies[tab] || mealsTab)()}</div>`;
}

// ---------- qty view (add + edit) ----------
const isG = () => pending && pending.food.unit === 'g';
const stepFor = () => (isG() ? 25 : pending.food.unit === 'meal' ? 0.25 : 0.5);
function totLine() {
  const t = L.foodTotalsFor(pending.food, pending.qty || 0);
  return `<b>${fmt(t.kcal)}</b> kcal · <b>${fmt(t.p)}</b> g protein · ${fmt(t.c)} g C · ${fmt(t.f)} g F${t.caf ? ` · ${fmt(t.caf)} mg caffeine` : ''}`;
}
function qtyHTML() {
  const f = pending.food;
  const g = isG();
  const head = pending.mode === 'edit'
    ? `<h3>${esc(f.name)}</h3>`
    : `<button class="link" data-act="fTab" data-t="${pending.back || 'foods'}">${ICONS.left}Back</button><h3>${esc(f.name)}</h3>`;
  const unitTxt = g ? 'values per 100 g' : f.unit === 'meal' ? 'saved meal' : esc(f.unit);
  const chips = pending.serving ? `<div class="chip-grid">
      <button class="chip-btn" data-act="fQtySet" data-v="${pending.serving}">1 serving (${fmt(pending.serving)} g)</button>
      <button class="chip-btn" data-act="fQtySet" data-v="${pending.serving * 2}">2 servings</button>
      <button class="chip-btn" data-act="fQtySet" data-v="100">100 g</button></div>` : '';
  return `${head}<p class="muted">${unitTxt} · ${fmt(f.kcal)} kcal · ${fmt(f.p, 1)} g protein</p>
  <div class="qty"><button class="icon-btn lg" data-act="fQty" data-v="-1" aria-label="Less">${ICONS.minus}</button>
    <label class="field big"><input name="qty" type="number" inputmode="decimal" step="any" min="0" value="${pending.qty}" data-inp="fQtyIn"><span>${g ? 'g' : '×'}</span></label>
    <button class="icon-btn lg" data-act="fQty" data-v="1" aria-label="More">${ICONS.plus}</button></div>
  ${chips}
  <div class="qty-tot" id="qtyTot">${totLine()}</div>
  ${pending.fromOff ? '<label class="check-row"><input type="checkbox" name="savelib" checked> Save to my foods</label>' : ''}
  ${pending.mode === 'edit'
    ? `<label class="field"><span class="lbl">Time</span><input name="etime" type="time" value="${esc(pending.time || '')}"></label>
       <div class="row"><button class="btn primary grow" data-act="fSaveEdit">Save</button><button class="btn ghost" data-act="fDel">${ICONS.trash}Delete</button></div>`
    : '<button class="btn primary block" data-act="fAddPending">Add</button>'}`;
}

function pushRecent(e) {
  const st = store.state;
  const sig = `${e.name}|${e.unit}|${e.qty}`;
  st.recent = [{ name: e.name, unit: e.unit, qty: e.qty, per: e.per }, ...st.recent.filter((x) => `${x.name}|${x.unit}|${x.qty}` !== sig)].slice(0, 15);
}
function logEntry(k, { name, unit, qty, per }) {
  const d = day(k);
  if (!Array.isArray(d.food)) d.food = [];
  const cleanPer = { kcal: r1(per.kcal || 0), p: r1(per.p || 0), c: r1(per.c || 0), f: r1(per.f || 0) };
  if (per.caf) cleanPer.caf = r1(per.caf);
  const e = { id: uid(), time: L.hhmm(), name, unit, qty, per: cleanPer };
  d.food.push(e);
  pushRecent(e);
  save();
  return e;
}
function undoable(k, e) {
  const n = entryNums(e);
  toast(`Logged ${e.name} · ${fmt(n.kcal)} kcal, ${n.p} g P`, {
    action: 'Undo',
    onAction: () => { const d = day(k); d.food = (d.food || []).filter((x) => x.id !== e.id); save(); rerender(); },
  });
}
function findEntry(id) {
  const d = peekDay(sel());
  return (d.food || []).find((x) => x.id === id);
}

// ---------- Open Food Facts ----------
function normalizeOff(p) {
  if (!p) return null;
  const n = p.nutriments || {};
  const val = (x) => { const v = L.num(x); return v == null ? null : v; };
  let kcal = val(n['energy-kcal_100g']);
  if (kcal == null && val(n.energy_100g) != null) kcal = val(n.energy_100g) / 4.184;
  if (kcal == null) return null;
  const brand = Array.isArray(p.brands) ? p.brands[0] : String(p.brands || '').split(',')[0].trim();
  const name = [p.product_name, brand].filter(Boolean).join(' — ') || `Product ${p.code || ''}`.trim();
  const caf = val(n.caffeine_100g);
  return {
    code: p.code,
    name: name.slice(0, 80),
    per100: { kcal, p: val(n.proteins_100g) || 0, c: val(n.carbohydrates_100g) || 0, f: val(n.fat_100g) || 0, caf: caf ? caf * 1000 : 0 },
    serving: val(p.serving_quantity) && val(p.serving_quantity) > 0 && val(p.serving_quantity) < 2000 ? val(p.serving_quantity) : null,
    servingLabel: p.serving_size || '',
  };
}
async function offFetch(url) {
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(tm); }
}
function openProduct(p) {
  pending = { mode: 'add', fromOff: true, back: 'search', food: { name: p.name, unit: 'g', ...p.per100 }, qty: p.serving || 100, serving: p.serving, servingLabel: p.servingLabel };
  setSheet(qtyHTML());
}
async function lookupBarcode(code) {
  let c = String(code || '').replace(/\D/g, '');
  if (c.length < 6) return toast('That barcode looks too short');
  if (c.length === 12) c = `0${c}`; // UPC-A → EAN-13 form
  off.busy = true; off.err = ''; off.results = [];
  tab = 'search';
  setSheet(addSheetHTML());
  try {
    const j = await offFetch(`https://world.openfoodfacts.org/api/v2/product/${c}.json?fields=${OFF_FIELDS}`);
    off.busy = false;
    const p = j && j.status === 1 ? normalizeOff(j.product) : null;
    if (!p) { off.err = `No nutrition data for ${c}. Use Quick add with the label numbers.`; setSheet(addSheetHTML()); return; }
    openProduct(p);
  } catch (e) {
    off.busy = false;
    off.err = 'Lookup failed. Check your connection, or use Quick add.';
    setSheet(addSheetHTML());
  }
}
function loadScript(src) {
  return new Promise((res, rej) => {
    if (window.ZXing) return res();
    const s = document.createElement('script');
    s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('load failed'));
    document.head.appendChild(s);
  });
}
function stopScan() {
  try { if (scanReader) scanReader.reset(); } catch (e) { /* ignore */ }
  scanReader = null;
}

export const actions = {
  fPrev() { viewKey = L.addDays(sel(), -1); rerender(); },
  fNext() { const n = L.addDays(sel(), 1); viewKey = n >= today() ? null : n; rerender(); },
  fAdd() { pending = null; openSheet(addSheetHTML()); },
  fTab(el) { stopScan(); tab = el.dataset.t; pending = null; setSheet(addSheetHTML()); },
  fLogMeal(el) {
    const st = store.state;
    const m = st.meals.find((x) => x.id === el.dataset.id);
    if (!m) return;
    const t = L.mealTotals(m, st.foods);
    const k = sel();
    const e = logEntry(k, { name: m.name, unit: 'meal', qty: 1, per: t });
    closeSheet(); rerender(); undoable(k, e);
  },
  fLogRecent(el) {
    const r = store.state.recent[+el.dataset.i];
    if (!r) return;
    const k = sel();
    const e = logEntry(k, r);
    closeSheet(); rerender(); undoable(k, e);
  },
  fPickFood(el) {
    const f = store.state.foods.find((x) => x.id === el.dataset.id);
    if (!f) return;
    pending = { mode: 'add', back: 'foods', food: { ...f }, qty: f.unit === 'g' ? 150 : 1 };
    setSheet(qtyHTML());
  },
  fQty(el) {
    if (!pending) return;
    const v = Math.max(0, Math.round(((L.num(pending.qty) || 0) + parseFloat(el.dataset.v) * stepFor()) * 100) / 100);
    pending.qty = v;
    const inp = document.querySelector('#sheet [name=qty]');
    if (inp) inp.value = v;
    const tot = document.getElementById('qtyTot');
    if (tot) tot.innerHTML = totLine();
  },
  fQtySet(el) {
    if (!pending) return;
    pending.qty = parseFloat(el.dataset.v);
    document.querySelector('#sheet [name=qty]').value = pending.qty;
    document.getElementById('qtyTot').innerHTML = totLine();
  },
  fAddPending() {
    if (!pending) return;
    const q = L.num(document.querySelector('#sheet [name=qty]').value);
    if (!q || q <= 0) return toast('Enter an amount');
    const f = pending.food;
    const vals = formVals();
    if (pending.fromOff && vals.savelib) {
      const st = store.state;
      if (!st.foods.some((x) => x.name === f.name)) st.foods.unshift({ id: uid(), name: f.name, unit: 'g', kcal: r1(f.kcal), p: r1(f.p), c: r1(f.c), f: r1(f.f), ...(f.caf ? { caf: r1(f.caf) } : {}) });
    }
    const k = sel();
    const e = logEntry(k, { name: f.name, unit: f.unit, qty: q, per: { kcal: f.kcal, p: f.p, c: f.c, f: f.f, caf: f.caf || 0 } });
    pending = null;
    closeSheet(); rerender(); undoable(k, e);
  },
  fQuickAdd() {
    const v = formVals();
    const kcal = L.num(v.qkcal);
    if (kcal == null || kcal < 0) return toast('Enter calories');
    const k = sel();
    const e = logEntry(k, { name: (v.qname || '').trim() || 'Quick add', unit: 'serving', qty: 1, per: { kcal, p: L.num(v.qp) || 0, c: L.num(v.qc) || 0, f: L.num(v.qf) || 0, caf: L.num(v.qcaf) || 0 } });
    closeSheet(); rerender(); undoable(k, e);
  },
  fEdit(el) {
    const e = findEntry(el.dataset.id);
    if (!e) return;
    pending = { mode: 'edit', id: e.id, time: e.time, food: { name: e.name, unit: e.unit, ...e.per }, qty: e.qty };
    openSheet(qtyHTML());
  },
  fSaveEdit() {
    if (!pending) return;
    const e = findEntry(pending.id);
    const q = L.num(document.querySelector('#sheet [name=qty]').value);
    if (!e || !q || q <= 0) return toast('Enter an amount');
    e.qty = q;
    const tm = formVals().etime;
    if (tm) e.time = tm;
    save(); pending = null; closeSheet(); rerender();
  },
  fDel() {
    if (!pending) return;
    const d = day(sel());
    d.food = (d.food || []).filter((x) => x.id !== pending.id);
    save(); pending = null; closeSheet(); rerender(); toast('Deleted');
  },
  fRepeat() {
    const k = sel();
    const prev = peekDay(L.addDays(k, -1));
    const list = prev.food || [];
    if (!list.length) return toast('Nothing logged the day before');
    const d = day(k);
    if (!Array.isArray(d.food)) d.food = [];
    const ids = [];
    for (const e of list) { const c = { ...e, per: { ...e.per }, id: uid() }; ids.push(c.id); d.food.push(c); }
    save(); rerender();
    toast(`Copied ${list.length} items`, { action: 'Undo', onAction: () => { const dd = day(k); dd.food = dd.food.filter((x) => !ids.includes(x.id)); save(); rerender(); } });
  },
  async fSearch() {
    const q = (formVals().offq || '').trim();
    if (q.length < 2) return toast('Type at least 2 letters');
    off = { q, busy: true, err: '', results: [] };
    document.getElementById('offRes').innerHTML = offResultsHTML();
    try {
      const j = await offFetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&fields=${OFF_FIELDS}`);
      off.results = (j.products || []).map(normalizeOff).filter(Boolean).slice(0, 20);
      off.err = off.results.length ? '' : 'Nothing found. Try fewer words or the brand name.';
    } catch (e) {
      off.err = 'Search failed: no connection, or the food database is busy. Try again in a minute, or use Quick add.';
    }
    off.busy = false;
    const box = document.getElementById('offRes');
    if (box) box.innerHTML = offResultsHTML();
  },
  fBarcode() { lookupBarcode(formVals().barcode); },
  fOffPick(el) { const p = off.results[+el.dataset.i]; if (p) openProduct(p); },
  async fScan() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return toast('Camera not available here. Type the barcode.');
    setSheet(`<h3>Scan barcode</h3><div class="scan"><video id="scanVideo" playsinline muted autoplay></video><div class="scan-frame"></div></div>
      <p class="muted center">Hold the barcode inside the box.</p><button class="btn block" data-act="fTab" data-t="search">Cancel</button>`);
    try {
      await loadScript('./zxing.min.js');
      const Z = window.ZXing;
      const hints = new Map();
      hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]);
      stopScan();
      scanReader = new Z.BrowserMultiFormatReader(hints);
      sheetHooks.onClose = stopScan;
      const video = document.getElementById('scanVideo');
      const res = await scanReader.decodeOnceFromVideoDevice(undefined, video);
      const code = res.getText();
      stopScan();
      sheetHooks.onClose = null;
      lookupBarcode(code);
    } catch (e) {
      stopScan();
      if (!document.getElementById('scanVideo')) return; // cancelled
      const msg = e && e.name === 'NotAllowedError' ? 'Camera permission denied. Allow it in Settings, or type the barcode.' : 'Couldn’t start the scanner. Type the barcode instead.';
      tab = 'search'; off.err = msg; setSheet(addSheetHTML());
    }
  },
  fNewFood(el) {
    const f = el.dataset.id ? store.state.foods.find((x) => x.id === el.dataset.id) : null;
    const html = `${el.dataset.id ? '' : `<button class="link" data-act="fTab" data-t="foods">${ICONS.left}Back</button>`}<h3>${f ? 'Edit food' : 'New food'}</h3>
      <label class="field"><span class="lbl">Name</span><input name="nf_name" value="${esc(f ? f.name : '')}" placeholder="e.g. Oikos Pro yogurt" autocomplete="off"></label>
      <div class="seg two"><label><input type="radio" name="nf_mode" value="unit" ${!f || f.unit !== 'g' ? 'checked' : ''}><span>Per serving</span></label><label><input type="radio" name="nf_mode" value="g" ${f && f.unit === 'g' ? 'checked' : ''}><span>Per 100 g</span></label></div>
      <label class="field"><span class="lbl">Serving name (if per serving)</span><input name="nf_unit" value="${esc(f && f.unit !== 'g' ? f.unit : '1 serving')}" autocomplete="off"></label>
      <div class="grid2">
        <label class="field"><span class="lbl">Calories</span><input name="nf_kcal" type="number" inputmode="decimal" value="${f ? f.kcal : ''}"></label>
        <label class="field"><span class="lbl">Protein (g)</span><input name="nf_p" type="number" inputmode="decimal" value="${f ? f.p : ''}"></label>
        <label class="field"><span class="lbl">Carbs (g)</span><input name="nf_c" type="number" inputmode="decimal" value="${f ? f.c : ''}"></label>
        <label class="field"><span class="lbl">Fat (g)</span><input name="nf_f" type="number" inputmode="decimal" value="${f ? f.f : ''}"></label>
        <label class="field"><span class="lbl">Caffeine (mg)</span><input name="nf_caf" type="number" inputmode="numeric" value="${f && f.caf ? f.caf : ''}"></label>
      </div>
      <button class="btn primary block" data-act="fSaveFood" ${f ? `data-id="${f.id}"` : ''}>Save food</button>`;
    if (el.dataset.id) openSheet(html); else setSheet(html);
  },
  fSaveFood(el) {
    const v = formVals();
    const name = (v.nf_name || '').trim();
    const kcal = L.num(v.nf_kcal);
    if (!name || kcal == null) return toast('Name and calories are required');
    const isGram = document.querySelector('#sheet [name=nf_mode]:checked').value === 'g';
    const food = { name, unit: isGram ? 'g' : (v.nf_unit || '1 serving').trim(), kcal, p: L.num(v.nf_p) || 0, c: L.num(v.nf_c) || 0, f: L.num(v.nf_f) || 0 };
    if (L.num(v.nf_caf)) food.caf = L.num(v.nf_caf);
    const st = store.state;
    if (el.dataset.id) {
      const i = st.foods.findIndex((x) => x.id === el.dataset.id);
      if (i >= 0) st.foods[i] = { ...st.foods[i], ...food };
      save(); closeSheet(); rerender(); toast('Food updated');
    } else {
      st.foods.unshift({ id: uid(), ...food });
      save(); tab = 'foods'; foodQuery = ''; setSheet(addSheetHTML()); toast('Saved to your foods');
    }
  },
  fNewMeal() { setSheet(mealBuilderHTML([{ id: 'chicken', q: 150 }])); },
  fMealRow() {
    const rows = readMealRows();
    rows.push({ id: store.state.foods[0].id, q: 1 });
    const name = formVals().nm_name;
    setSheet(mealBuilderHTML(rows, name));
  },
  fMealDelRow(el) {
    const rows = readMealRows();
    rows.splice(+el.dataset.i, 1);
    setSheet(mealBuilderHTML(rows, formVals().nm_name));
  },
  fSaveMeal() {
    const name = (formVals().nm_name || '').trim();
    const rows = readMealRows().filter((r) => r.q > 0);
    if (!name || !rows.length) return toast('Give it a name and at least one item');
    store.state.meals.unshift({ id: uid(), name, items: rows.map((r) => [r.id, r.q]) });
    save(); tab = 'meals'; setSheet(addSheetHTML()); toast('Meal saved');
  },
};

function readMealRows() {
  const out = [];
  document.querySelectorAll('#sheet .meal-row').forEach((row) => {
    out.push({ id: row.querySelector('select').value, q: L.num(row.querySelector('input').value) || 0 });
  });
  return out;
}
function mealBuilderHTML(rows, name = '') {
  const foods = store.state.foods;
  return `<button class="link" data-act="fTab" data-t="meals">${ICONS.left}Back</button><h3>New meal</h3>
    <label class="field"><span class="lbl">Meal name</span><input name="nm_name" value="${esc(name)}" placeholder="e.g. Shift box" autocomplete="off"></label>
    ${rows.map((r, i) => `<div class="meal-row"><select aria-label="Food">${foods.map((f) => `<option value="${f.id}" ${f.id === r.id ? 'selected' : ''}>${esc(f.name)}${f.unit === 'g' ? ' (g)' : ''}</option>`).join('')}</select>
      <input type="number" inputmode="decimal" value="${r.q}" aria-label="Amount"><button class="icon-btn" data-act="fMealDelRow" data-i="${i}" aria-label="Remove">${ICONS.x}</button></div>`).join('')}
    <p class="muted sm">Amount = grams for (g) foods, otherwise number of servings.</p>
    <button class="btn block ghost" data-act="fMealRow">${ICONS.plus}Add item</button>
    <button class="btn primary block" data-act="fSaveMeal">Save meal</button>`;
}

export const inputs = {
  fFoodQ(el) { foodQuery = el.value; const box = document.getElementById('foodsList'); if (box) box.innerHTML = foodsList(); },
  fQtyIn(el) { if (!pending) return; pending.qty = L.num(el.value) || 0; const tot = document.getElementById('qtyTot'); if (tot) tot.innerHTML = totLine(); },
};
