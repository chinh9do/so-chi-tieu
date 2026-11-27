/* Sổ chi tiêu — dữ liệu lưu trong máy (IndexedDB), sao lưu bằng JSON/Excel */
'use strict';

const APP_ID = 'so-chi-tieu';
const DATA_VERSION = 1;

const DEFAULT_CATS = [
  { id: 'an', short: 'Ăn uống', name: 'Ăn uống hằng ngày', group: 'Thiết yếu', color: '#1F8A9E' },
  { id: 'tro', short: 'Tiền trọ', name: 'Tiền trọ (điện nước)', group: 'Thiết yếu', color: '#3B5BA9' },
  { id: 'giavi', short: 'Gia vị, bếp', name: 'Gia vị / dụng cụ nấu ăn', group: 'Thiết yếu', color: '#B08A2A' },
  { id: 'xang', short: 'Xăng xe', name: 'Xăng xe', group: 'Xe', color: '#B4532F' },
  { id: 'suaxe', short: 'Sửa xe', name: 'Sửa xe', group: 'Xe', color: '#7E4632' },
  { id: 'nhot', short: 'Thay nhớt', name: 'Thay nhớt', group: 'Xe', color: '#8C7A3C' },
  { id: 'quanao', short: 'Quần áo', name: 'Quần áo, giày dép', group: 'Mua sắm', color: '#A0447A' },
  { id: 'canhan', short: 'Cá nhân', name: 'Đồ dùng cá nhân', group: 'Mua sắm', color: '#7B5BA6' },
  { id: 'cafe', short: 'Cà phê', name: 'Cà phê / nhậu', group: 'Phát sinh', color: '#C46A2E' },
  { id: 'dichoi', short: 'Đi chơi', name: 'Đi chơi / du lịch', group: 'Phát sinh', color: '#2F8F6A' },
  { id: 'anngoai', short: 'Ăn ngoài', name: 'Ăn ngoài', group: 'Phát sinh', color: '#D0564A' },
  { id: 'suckhoe', short: 'Sức khỏe', name: 'Sức khỏe / y tế', group: 'Khác', color: '#3E8E8C' },
  { id: 'cuoi', short: 'Cưới hỏi', name: 'Cưới hỏi / sinh nhật', group: 'Khác', color: '#C23B5A' },
  { id: 'khac', short: 'Khác', name: 'Khác', group: 'Khác', color: '#6F7A76' },
];
const GROUP_ORDER = ['Thiết yếu', 'Xe', 'Mua sắm', 'Phát sinh', 'Khác'];

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const fmtK = v => nf.format(Math.round(v || 0) / 1000) + 'k';
const fmtK0 = v => nf0.format(Math.round((v || 0) / 1000)) + 'k';
const fmtD = v => nf0.format(Math.round(v || 0)) + 'đ';
const fmtKm = v => (v == null || v === '') ? '—' : nf0.format(v) + ' km';
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const dayLabel = s => { const d = parseISO(s); return `${WD[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; };
const dmy = s => s ? s.split('-').reverse().join('/') : '';
const ymLabel = ym => { const [y, m] = ym.split('-'); return `Tháng ${+m}/${y}`; };
const addMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
const uid = p => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function parseAmount(str) {
  if (str == null) return null;
  const s = String(str).toLowerCase().replace(/\s/g, '').replace(/đ/g, '');
  if (!s) return null;
  const parts = s.split('+').filter(Boolean);
  if (!parts.length) return null;
  const list = [];
  for (let p of parts) {
    let mult = 1;
    if (p.endsWith('tr')) { mult = 1000; p = p.slice(0, -2); }
    else if (p.endsWith('k')) p = p.slice(0, -1);
    if ((p.match(/\./g) || []).length > 1) p = p.replace(/\./g, '');
    p = p.replace(',', '.');
    if (!/^\d*\.?\d+$/.test(p)) return null;
    list.push(parseFloat(p) * mult);
  }
  const k = list.reduce((a, b) => a + b, 0);
  return { k, vnd: Math.round(k * 1000), parts: list };
}

/* ---------- storage ---------- */
const store = {
  db: null,
  async open() {
    if (!('indexedDB' in window)) return;
    this.db = await new Promise((res, rej) => {
      const r = indexedDB.open(APP_ID, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async get(k) {
    if (!this.db) { try { return JSON.parse(localStorage.getItem(APP_ID + ':' + k)); } catch { return null; } }
    return new Promise((res, rej) => {
      const q = this.db.transaction('kv').objectStore('kv').get(k);
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
    });
  },
  async set(k, v) {
    if (!this.db) { localStorage.setItem(APP_ID + ':' + k, JSON.stringify(v)); return; }
    return new Promise((res, rej) => {
      const t = this.db.transaction('kv', 'readwrite');
      t.objectStore('kv').put(v, k);
      t.oncomplete = () => res(); t.onerror = () => rej(t.error);
    });
  },
};

function emptyState() {
  return {
    app: APP_ID, version: DATA_VERSION,
    categories: DEFAULT_CATS.map(({ id, name, group }) => ({ id, name, group })),
    transactions: [], weddings: [], oil: [], monthNotes: [],
    settings: { odometer: null, odometerDate: null, oilInterval: 3000, lastBackup: null },
  };
}
let S = emptyState();
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => store.set('state', S).catch(e => toast('Không lưu được: ' + e.message)), 120);
  if (typeof scheduleSync === 'function') scheduleSync();
}
function normalize(d) {
  const s = emptyState();
  s.categories = Array.isArray(d.categories) && d.categories.length ? d.categories : s.categories;
  for (const c of DEFAULT_CATS) if (!s.categories.find(x => x.id === c.id)) s.categories.push({ id: c.id, name: c.name, group: c.group });
  s.transactions = (d.transactions || []).filter(t => t && t.date && t.cat).map(t => ({ id: t.id || uid('tx'), date: t.date, cat: t.cat, amount: Math.round(+t.amount || 0), note: t.note || '', src: t.src || '' }));
  s.weddings = (d.weddings || []).map(w => ({ id: w.id || uid('wd'), date: w.date || null, name: w.name || '', amount: Math.round(+w.amount || 0), group: w.group || '', note: w.note || '', link: w.link || '', txId: w.txId || null }));
  s.oil = (d.oil || []).map(o => ({ id: o.id || uid('oil'), date: o.date, approx: !!o.approx, odo: numOrNull(o.odo), next: numOrNull(o.next), cost: numOrNull(o.cost), note: o.note || '', txId: o.txId || null }));
  s.monthNotes = (d.monthNotes || []).map(n => ({ id: n.id || uid('mn'), month: n.month, text: n.text || '' }));
  s.settings = Object.assign(s.settings, d.settings || {});
  return s;
}
const numOrNull = v => (v === null || v === undefined || v === '' || isNaN(+v)) ? null : +v;

/* ---------- derived ---------- */
const catById = id => {
  const c = S.categories.find(x => x.id === id) || { id, name: id, group: 'Khác' };
  const d = DEFAULT_CATS.find(x => x.id === id);
  return { ...c, color: d ? d.color : '#6F7A76', short: (d && d.name === c.name) ? d.short : c.name };
};
const sortedCats = () => S.categories.map(c => catById(c.id));
function sumBy(list, key = 'cat') {
  const m = {};
  for (const t of list) m[t[key]] = (m[t[key]] || 0) + t.amount;
  return m;
}
const txInMonth = ym => S.transactions.filter(t => t.date.startsWith(ym));
const txInYear = y => S.transactions.filter(t => t.date.startsWith(String(y)));
const total = list => list.reduce((a, t) => a + t.amount, 0);
const years = () => [...new Set(S.transactions.map(t => +t.date.slice(0, 4)))].sort();

/* ---------- UI state ---------- */
const nowYM = today().slice(0, 7);
const ui = {
  tab: 'nhap', entryCat: 'an', entryDate: today(),
  bookMonth: nowYM, query: '', filterCat: '',
  sumMode: 'month', sumMonth: nowYM, sumYear: new Date().getFullYear(),
  wdQuery: '',
};

/* ---------- toast / sheet ---------- */
let toastTimer;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
function openSheet(html, onMount) {
  $('#sheetPanel').innerHTML = `<div class="grab"></div>${html}`;
  $('#sheet').classList.add('open');
  document.body.style.overflow = 'hidden';
  onMount && onMount($('#sheetPanel'));
}
function closeSheet() {
  $('#sheet').classList.remove('open');
  document.body.style.overflow = '';
  $('#sheetPanel').innerHTML = '';
}

/* ---------- reusable pieces ---------- */
function strip(byCat) {
  const tot = Object.values(byCat).reduce((a, b) => a + b, 0);
  if (!tot) return `<div class="strip" aria-hidden="true"></div>`;
  const segs = sortedCats().filter(c => byCat[c.id] > 0)
    .map(c => `<i style="flex:${byCat[c.id]};background:${c.color}" title="${esc(c.name)} ${fmtK(byCat[c.id])}"></i>`).join('');
  return `<div class="strip" role="img" aria-label="Tỷ lệ chi theo danh mục">${segs}</div>`;
}
function legend(byCat, max = 6) {
  const items = sortedCats().filter(c => byCat[c.id] > 0).sort((a, b) => byCat[b.id] - byCat[a.id]).slice(0, max);
  return `<div class="legend">${items.map(c => `<span><i class="dot" style="background:${c.color}"></i>${esc(c.name)}</span>`).join('')}</div>`;
}
function txRow(t) {
  const c = catById(t.cat);
  return `<button class="item" data-action="edit-tx" data-id="${esc(t.id)}">
    <i class="dot" style="background:${c.color}"></i>
    <span class="main"><span class="t1">${esc(c.name)}</span>${t.note ? `<span class="t2" style="display:block">${esc(t.note)}</span>` : ''}</span>
    <span class="amt">${fmtK(t.amount)}</span></button>`;
}
function banners() {
  let h = '';
  const st = S.settings;
  const synced = syncOn() && Sync.st.lastSync && daysBetween(Sync.st.lastSync.slice(0, 10), today()) < 7;
  if (syncOn() && Sync.st.lastError) h += `<div class="banner"><span>Chưa đồng bộ được: ${esc(Sync.st.lastError)}</span><button data-action="sync-now">Thử lại</button></div>`;
  if (S.transactions.length && !synced) {
    const days = st.lastBackup ? daysBetween(st.lastBackup.slice(0, 10), today()) : null;
    if (days === null || days >= 30) {
      h += `<div class="banner"><span>${days === null ? 'Bạn chưa sao lưu lần nào.' : `Đã ${days} ngày chưa sao lưu.`}</span><button data-action="backup-json">Sao lưu ngay</button></div>`;
    }
  }
  const o = oilStatus();
  if (o && o.remaining != null && o.remaining <= 300) {
    h += `<div class="banner"><span>${o.remaining <= 0 ? `Đã quá hạn thay nhớt ${nf0.format(-o.remaining)} km.` : `Còn ${nf0.format(o.remaining)} km nữa là đến lần thay nhớt.`}</span><button data-action="tab" data-tab="xe">Xem</button></div>`;
  }
  return h;
}

/* ---------- view: Nhập ---------- */
function renderEntry() {
  const ym = today().slice(0, 7);
  const mTx = txInMonth(ym), byCat = sumBy(mTx);
  const dayTx = S.transactions.filter(t => t.date === ui.entryDate);
  const isToday = ui.entryDate === today();
  const groups = GROUP_ORDER.map(g => {
    const cs = sortedCats().filter(c => c.group === g);
    if (!cs.length) return '';
    return `<div class="grp">${g}</div>` + cs.map(c => `<button type="button" class="chip" role="radio" aria-checked="${c.id === ui.entryCat}" data-cat="${c.id}" style="--c:${c.color}"><i class="dot"></i>${esc(c.short)}</button>`).join('');
  }).join('');
  const welcome = !S.transactions.length ? `<div class="card welcome"><b>Chưa có dữ liệu</b>
    <p>Chuyển dữ liệu cũ: chọn file <b>chi-tieu-data.json</b> hoặc file Excel sao lưu. Hoặc nhập khoản chi đầu tiên ngay bên dưới.</p>
    <button class="primary" data-action="import">Nhập dữ liệu từ file</button></div>` : '';

  $('#view').innerHTML = `
  <section class="hero">
    <div class="hero-row">
      <div><div class="lbl">${ymLabel(ym)}</div><div class="big">${fmtK(total(mTx))}</div></div>
      <div class="right"><div class="lbl">Hôm nay</div><div class="mid">${fmtK(total(S.transactions.filter(t => t.date === today())))}</div></div>
    </div>
    ${strip(byCat)}
  </section>
  ${banners()}${welcome}
  <form class="card" id="entryForm" autocomplete="off">
    <div class="amount">
      <label class="sr" for="amt">Số tiền (nghìn đồng)</label>
      <input id="amt" inputmode="decimal" placeholder="0" enterkeyhint="done">
      <span class="unit">k</span>
      <button type="button" class="plus" data-action="plus" aria-label="Thêm dấu cộng">+</button>
    </div>
    <div class="preview" id="amtPreview">Nhập số nghìn đồng. Nhiều khoản thì cộng: 20+30+15</div>
    <div class="cats" role="radiogroup" aria-label="Danh mục">${groups}</div>
    <div class="extra" data-for="cuoi" hidden>
      <label class="field"><span>Mừng cưới ai?</span><input class="inp" id="wdName" placeholder="Tên người, ví dụ: Bảo MTI"></label>
      <label class="check"><input type="checkbox" id="wdAdd" checked> Ghi vào sổ Tiền cưới</label>
    </div>
    <div class="extra" data-for="tro" hidden>
      <p class="hint">Tiền trọ tháng sau (gồm điện nước) đóng vào cuối tháng này. Chọn đúng ngày đóng để tổng tháng khớp.</p>
    </div>
    <div class="extra" data-for="nhot" hidden>
      <label class="field"><span>Số km lúc thay</span><input class="inp" id="oilOdo" inputmode="numeric" placeholder="${S.settings.odometer ? nf0.format(S.settings.odometer) : 'ví dụ 22064'}"></label>
    </div>
    <div class="row2">
      <label class="field"><span>Ngày</span><input class="inp" type="date" id="date" value="${ui.entryDate}" max="${addDaysISO(today(), 366)}"></label>
      <label class="field"><span>Ghi chú</span><input class="inp" id="note" placeholder="Không bắt buộc"></label>
    </div>
    <button class="primary" type="submit">Lưu khoản chi</button>
  </form>
  <div class="dayhead"><b>${isToday ? 'Hôm nay' : dayLabel(ui.entryDate)}</b><span class="muted">${fmtK(total(dayTx))}</span></div>
  <div class="list">${dayTx.length ? dayTx.map(txRow).join('') : `<div class="empty">Chưa có khoản chi nào trong ngày.</div>`}</div>`;
  toggleExtras();
}
function addDaysISO(s, n) { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); }
function toggleExtras() {
  $$('.extra').forEach(el => { el.hidden = el.dataset.for !== ui.entryCat; });
}
function updatePreview() {
  const v = $('#amt').value, p = parseAmount(v), el = $('#amtPreview');
  if (!v) { el.textContent = 'Nhập số nghìn đồng. Nhiều khoản thì cộng: 20+30+15'; return; }
  el.textContent = p ? `= ${fmtD(p.vnd)}${p.parts.length > 1 ? ` (${p.parts.length} khoản cộng lại)` : ''}` : 'Số tiền chưa đúng. Ví dụ: 45, 1,5tr, 20+30';
}
function submitEntry(e) {
  e.preventDefault();
  const p = parseAmount($('#amt').value);
  if (!p || p.vnd <= 0) { toast('Nhập số tiền trước đã'); $('#amt').focus(); return; }
  const date = $('#date').value || today();
  let note = $('#note').value.trim();
  if (p.parts.length > 1) note = (note + ' (' + p.parts.map(x => nf.format(x)).join(' + ') + ')').trim();
  const t = { id: uid('tx'), date, cat: ui.entryCat, amount: p.vnd, note, src: '' };
  if (ui.entryCat === 'tro' && !note) {
    const d = parseISO(date), n = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    t.note = `Tiền trọ tháng ${n.getMonth() + 1}/${n.getFullYear()} (gồm điện nước)`;
  }
  if (ui.entryCat === 'cuoi') {
    const name = $('#wdName').value.trim();
    if (name) t.note = (`Mừng cưới ${name}` + (note ? ' — ' + note : ''));
    if (name && $('#wdAdd').checked) S.weddings.push({ id: uid('wd'), date, name, amount: p.vnd, group: '', note, link: '', txId: t.id });
  }
  if (ui.entryCat === 'nhot') {
    const odo = numOrNull(String($('#oilOdo').value).replace(/\D/g, ''));
    S.oil.push({ id: uid('oil'), date, approx: false, odo, next: odo ? odo + (+S.settings.oilInterval || 3000) : null, cost: p.vnd, note, txId: t.id });
    if (odo && (!S.settings.odometer || odo >= S.settings.odometer)) { S.settings.odometer = odo; S.settings.odometerDate = date; }
  }
  S.transactions.push(t);
  ui.entryDate = date;
  save(); renderEntry();
  toast(`Đã lưu ${fmtK(p.vnd)} vào ${catById(t.cat).name}`);
}

/* ---------- edit transaction ---------- */
function catOptions(sel) {
  return GROUP_ORDER.map(g => `<optgroup label="${g}">${sortedCats().filter(c => c.group === g).map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>`).join('');
}
function editTx(id) {
  const t = S.transactions.find(x => x.id === id); if (!t) return;
  const wd = S.weddings.find(w => w.txId === id), oil = S.oil.find(o => o.txId === id);
  openSheet(`<h2>Sửa khoản chi</h2>
    <form id="txForm">
      <label class="field"><span>Số tiền (nghìn đồng)</span><input class="inp" id="eAmt" inputmode="decimal" value="${nf.format(t.amount / 1000).replace(/\./g, '')}"></label>
      <label class="field"><span>Danh mục</span><select class="inp" id="eCat">${catOptions(t.cat)}</select></label>
      <label class="field"><span>Ngày</span><input class="inp" type="date" id="eDate" value="${t.date}"></label>
      <label class="field"><span>Ghi chú</span><textarea class="inp" id="eNote" rows="2">${esc(t.note)}</textarea></label>
      ${wd ? `<p class="hint">Liên kết với sổ Tiền cưới: ${esc(wd.name)}. Sửa số tiền và ngày ở đây sẽ cập nhật cả bên đó.</p>` : ''}
      ${oil ? `<p class="hint">Liên kết với lần thay nhớt ngày ${dmy(oil.date)}.</p>` : ''}
      ${t.src ? `<p class="hint">Nguồn: ${esc(t.src)}</p>` : ''}
      <button class="primary" type="submit">Lưu thay đổi</button>
      <div class="btnrow"><button type="button" class="secondary danger" data-action="del-tx" data-id="${esc(id)}">Xoá khoản chi</button><button type="button" class="secondary" data-action="close-sheet">Huỷ</button></div>
    </form>`, pn => {
    $('#txForm', pn).onsubmit = e => {
      e.preventDefault();
      const p = parseAmount($('#eAmt').value);
      if (!p || p.vnd <= 0) { toast('Số tiền chưa đúng'); return; }
      t.amount = p.vnd; t.cat = $('#eCat').value; t.date = $('#eDate').value || t.date; t.note = $('#eNote').value.trim();
      if (wd) { wd.amount = t.amount; wd.date = t.date; }
      if (oil) { oil.cost = t.amount; oil.date = t.date; }
      save(); closeSheet(); render(); toast('Đã lưu thay đổi');
    };
  });
}
function deleteTx(id) {
  if (!confirm('Xoá khoản chi này?')) return;
  S.transactions = S.transactions.filter(t => t.id !== id);
  S.weddings.forEach(w => { if (w.txId === id) w.txId = null; });
  S.oil.forEach(o => { if (o.txId === id) o.txId = null; });
  save(); closeSheet(); render(); toast('Đã xoá khoản chi');
}

/* ---------- view: Sổ ---------- */
function renderBook() {
  const notes = S.monthNotes.filter(n => n.month === ui.bookMonth);
  $('#view').innerHTML = `
  <div class="monthnav"><button class="iconbtn" data-action="bm" data-d="-1" aria-label="Tháng trước">‹</button><b>${ymLabel(ui.bookMonth)}</b><button class="iconbtn" data-action="bm" data-d="1" aria-label="Tháng sau">›</button></div>
  <div class="toolbar">
    <input class="inp" type="search" id="q" placeholder="Tìm trong ghi chú, mọi tháng" value="${esc(ui.query)}">
    <select class="inp" id="fcat" aria-label="Lọc danh mục"><option value="">Tất cả</option>${catOptions(ui.filterCat)}</select>
  </div>
  <div class="note-card"${notes.length ? '' : ' hidden'} id="mnotes">${notes.map(n => `<p><button class="linklike" data-action="edit-note" data-id="${esc(n.id)}" style="border:0;background:none;padding:0;text-align:left;color:inherit">${esc(n.text)}</button></p>`).join('')}</div>
  <div class="btnrow"><button class="secondary" data-action="add-note">Thêm ghi chú tháng</button></div>
  <div id="bookList"></div>`;
  renderBookList();
}
function renderBookList() {
  const q = ui.query.trim().toLowerCase();
  let list = q
    ? S.transactions.filter(t => (t.note || '').toLowerCase().includes(q) || catById(t.cat).name.toLowerCase().includes(q))
    : txInMonth(ui.bookMonth);
  if (ui.filterCat) list = list.filter(t => t.cat === ui.filterCat);
  list = list.slice().sort((a, b) => b.date.localeCompare(a.date));
  const head = `<div class="dayhead"><span class="muted">${q ? `${list.length} kết quả` : `${list.length} khoản`}</span><b>${fmtK(total(list))}</b></div>`;
  if (!list.length) { $('#bookList').innerHTML = head + `<div class="empty">${q ? 'Không tìm thấy khoản nào khớp.' : 'Tháng này chưa có khoản chi.'}</div>`; return; }
  const shown = list.slice(0, 400);
  const byDay = {};
  for (const t of shown) (byDay[t.date] = byDay[t.date] || []).push(t);
  $('#bookList').innerHTML = head + Object.keys(byDay).map(d =>
    `<div class="dayhead"><b>${dayLabel(d)}</b><span class="muted">${fmtK(total(byDay[d]))}</span></div><div class="list">${byDay[d].map(txRow).join('')}</div>`
  ).join('') + (list.length > shown.length ? `<p class="hint">Đang hiện 400 khoản đầu. Gõ cụ thể hơn để thu hẹp.</p>` : '');
}
function editNote(id) {
  const n = id ? S.monthNotes.find(x => x.id === id) : { id: null, month: ui.bookMonth, text: '' };
  openSheet(`<h2>${id ? 'Sửa' : 'Thêm'} ghi chú tháng</h2><p class="muted">${ymLabel(n.month)}</p>
    <form id="noteForm"><textarea class="inp" id="nText" rows="4" placeholder="Ví dụ: chuyển trọ mới, cọc 3tr">${esc(n.text)}</textarea>
    <button class="primary" type="submit">Lưu ghi chú</button>
    ${id ? `<div class="btnrow"><button type="button" class="secondary danger" id="nDel">Xoá ghi chú</button></div>` : ''}</form>`, pn => {
    $('#noteForm', pn).onsubmit = e => {
      e.preventDefault(); const text = $('#nText').value.trim(); if (!text) return;
      if (id) n.text = text; else S.monthNotes.push({ id: uid('mn'), month: n.month, text });
      save(); closeSheet(); render(); toast('Đã lưu ghi chú');
    };
    if (id) $('#nDel', pn).onclick = () => { if (!confirm('Xoá ghi chú này?')) return; S.monthNotes = S.monthNotes.filter(x => x.id !== id); save(); closeSheet(); render(); };
  });
}

/* ---------- view: Tổng kết ---------- */
function catRows(byCat, tot) {
  const cs = sortedCats().filter(c => byCat[c.id] > 0).sort((a, b) => byCat[b.id] - byCat[a.id]);
  if (!cs.length) return `<div class="empty">Chưa có dữ liệu.</div>`;
  const max = Math.max(...cs.map(c => byCat[c.id]));
  return cs.map(c => `<div class="catrow"><i class="dot" style="background:${c.color}"></i><span>${esc(c.name)}</span>
    <span class="amt">${fmtK(byCat[c.id])}<span class="pct">${Math.round(byCat[c.id] / tot * 100)}%</span></span>
    <span class="bar"><i style="width:${byCat[c.id] / max * 100}%;background:${c.color}"></i></span></div>`).join('');
}
function groupBoxes(byCat) {
  return `<div class="groups">${GROUP_ORDER.map(g => {
    const v = sortedCats().filter(c => c.group === g).reduce((a, c) => a + (byCat[c.id] || 0), 0);
    return `<div><span>${g}</span><b>${fmtK0(v)}</b></div>`;
  }).join('')}</div>`;
}
function barChart(values, labels, opts = {}) {
  const W = 340, H = 140, padB = 18, padT = 8, padX = 6, n = values.length, gap = n > 20 ? 2 : 6;
  const bw = (W - 2 * padX - gap * (n - 1)) / n, max = Math.max(1, ...values);
  const bars = values.map((v, i) => {
    const h = v / max * (H - padB - padT), x = padX + i * (bw + gap), y = H - padB - h;
    const lab = labels[i];
    return `<g${opts.action ? ` data-action="${opts.action}" data-i="${i}" style="cursor:pointer"` : ''}>
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h, v ? 1.5 : 0).toFixed(1)}" rx="2" fill="${opts.hl === i ? 'var(--accent)' : 'var(--muted)'}" opacity="${opts.hl === i ? 1 : .55}"><title>${esc(opts.titles ? opts.titles[i] : lab)}: ${fmtK(v)}</title></rect>
      ${lab !== '' ? `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle">${esc(lab)}</text>` : ''}</g>`;
  }).join('');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'Biểu đồ')}">${bars}</svg></div>`;
}
function renderSummary() {
  const seg = `<div class="seg" role="group" aria-label="Chế độ tổng kết">
    <button data-action="sum-mode" data-m="month" aria-pressed="${ui.sumMode === 'month'}">Theo tháng</button>
    <button data-action="sum-mode" data-m="year" aria-pressed="${ui.sumMode === 'year'}">Theo năm</button></div>`;
  if (ui.sumMode === 'month') {
    const ym = ui.sumMonth, list = txInMonth(ym), tot = total(list), byCat = sumBy(list);
    const isCur = ym === nowYM, dayNow = +today().slice(8);
    const prev = total(txInMonth(addMonth(ym, -1)).filter(t => !isCur || +t.date.slice(8) <= dayNow));
    const curCmp = isCur ? total(list.filter(t => +t.date.slice(8) <= dayNow)) : tot;
    const delta = prev ? Math.round((curCmp - prev) / prev * 100) : null;
    const [y, m] = ym.split('-').map(Number), nDays = new Date(y, m, 0).getDate();
    const daily = Array.from({ length: nDays }, (_, i) => total(list.filter(t => +t.date.slice(8) === i + 1 && t.cat !== 'tro')));
    const labels = daily.map((_, i) => [1, 5, 10, 15, 20, 25, nDays].includes(i + 1) ? String(i + 1) : '');
    const notes = S.monthNotes.filter(n => n.month === ym);
    $('#view').innerHTML = `${seg}
    <div class="monthnav"><button class="iconbtn" data-action="sm" data-d="-1" aria-label="Tháng trước">‹</button><b>${ymLabel(ym)}</b><button class="iconbtn" data-action="sm" data-d="1" aria-label="Tháng sau">›</button></div>
    <section class="hero"><div class="hero-row"><div><div class="lbl">Tổng chi</div><div class="big">${fmtK(tot)}</div></div>
      <div class="right"><div class="lbl">${isCur ? `So với 1–${dayNow} tháng trước` : 'So với tháng trước'}</div><div class="mid ${delta > 0 ? 'delta-up' : 'delta-down'}">${delta === null ? '—' : (delta > 0 ? '+' : '') + delta + '%'}</div></div></div>
      ${strip(byCat)}${legend(byCat)}</section>
    ${groupBoxes(byCat)}
    ${notes.length ? `<div class="note-card">${notes.map(n => `<p>${esc(n.text)}</p>`).join('')}</div>` : ''}
    <h3>Theo danh mục</h3><div class="list">${catRows(byCat, tot)}</div>
    <h3>Chi theo ngày <span class="muted" style="font-weight:400">(không tính tiền trọ)</span></h3>
    ${barChart(daily, labels, { label: 'Chi tiêu theo ngày', titles: daily.map((_, i) => `Ngày ${i + 1}`) })}`;
  } else {
    const y = ui.sumYear, list = txInYear(y), tot = total(list), byCat = sumBy(list);
    const monthly = Array.from({ length: 12 }, (_, i) => total(list.filter(t => +t.date.slice(5, 7) === i + 1)));
    const active = monthly.filter(v => v > 0).length || 1;
    const ys = years();
    const cmpRows = sortedCats().filter(c => ys.some(yy => S.transactions.some(t => t.cat === c.id && t.date.startsWith(yy)))).map(c =>
      `<tr><td><i class="dot" style="background:${c.color}"></i> ${esc(c.name)}</td>${ys.map(yy => `<td>${fmtK(total(S.transactions.filter(t => t.cat === c.id && t.date.startsWith(yy))))}</td>`).join('')}</tr>`).join('');
    $('#view').innerHTML = `${seg}
    <div class="monthnav"><button class="iconbtn" data-action="sy" data-d="-1" aria-label="Năm trước">‹</button><b>Năm ${y}</b><button class="iconbtn" data-action="sy" data-d="1" aria-label="Năm sau">›</button></div>
    <section class="hero"><div class="hero-row"><div><div class="lbl">Tổng chi</div><div class="big">${fmtK(tot)}</div></div>
      <div class="right"><div class="lbl">Trung bình / tháng</div><div class="mid">${fmtK0(tot / active)}</div></div></div>
      ${strip(byCat)}${legend(byCat)}</section>
    ${groupBoxes(byCat)}
    <h3>Theo tháng <span class="muted" style="font-weight:400">(chạm cột để xem chi tiết)</span></h3>
    ${barChart(monthly, monthly.map((_, i) => String(i + 1)), { action: 'goto-month', label: 'Chi tiêu theo tháng', titles: monthly.map((_, i) => `Tháng ${i + 1}`) })}
    <h3>Theo danh mục</h3><div class="list">${catRows(byCat, tot)}</div>
    ${ys.length > 1 ? `<h3>So sánh các năm</h3><div class="scrollx"><table class="cmp"><thead><tr><th>Danh mục</th>${ys.map(yy => `<th>${yy}</th>`).join('')}</tr></thead>
      <tbody>${cmpRows}</tbody><tfoot><tr><td>Tổng</td>${ys.map(yy => `<td>${fmtK(total(txInYear(yy)))}</td>`).join('')}</tr></tfoot></table></div>` : ''}`;
  }
}

/* ---------- view: Tiền cưới ---------- */
function renderWedding() {
  const q = ui.wdQuery.trim().toLowerCase();
  const all = S.weddings;
  const list = all.filter(w => !q || (w.name + ' ' + w.group + ' ' + w.note).toLowerCase().includes(q))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.name.localeCompare(b.name, 'vi'));
  const dated = list.filter(w => w.date), undated = list.filter(w => !w.date);
  const linked = new Set(all.map(w => w.txId).filter(Boolean));
  const orphan = S.transactions.filter(t => t.cat === 'cuoi' && !linked.has(t.id)).sort((a, b) => b.date.localeCompare(a.date));
  const yearNow = String(new Date().getFullYear());
  const row = w => `<button class="item" data-action="edit-wd" data-id="${esc(w.id)}">
    <span class="main"><span class="t1">${esc(w.name)}${w.group ? `<span class="tag">${esc(w.group)}</span>` : ''}</span>
    <span class="t2" style="display:block">${w.date ? dmy(w.date) : ''}${w.note && w.date ? ' — ' : ''}${w.date ? esc(w.note) : ''}</span></span>
    <span class="amt">${fmtK(w.amount)}</span></button>`;
  $('#view').innerHTML = `
  <section class="hero"><div class="hero-row">
    <div><div class="lbl">Đã ghi tên ${all.length} người</div><div class="big">${fmtK(total(all))}</div></div>
    <div class="right"><div class="lbl">Cưới hỏi năm ${yearNow}</div><div class="mid">${fmtK(total(S.transactions.filter(t => t.cat === 'cuoi' && t.date.startsWith(yearNow))))}</div></div></div>
    <p class="hint">Số bên phải lấy từ sổ chi tiêu (danh mục Cưới hỏi), gồm cả khoản chưa gắn tên.</p></section>
  <div class="toolbar" style="grid-template-columns:1fr auto">
    <input class="inp" type="search" id="wq" placeholder="Tìm tên, nhóm (MTI, B1…)" value="${esc(ui.wdQuery)}">
    <button class="secondary" data-action="add-wd">Thêm</button>
  </div>
  ${orphan.length ? `<details class="card"><summary>${orphan.length} khoản cưới hỏi trong sổ chi chưa gắn tên</summary>
    <p class="hint">Chạm vào một khoản để ghi tên người. Số tiền và ngày lấy từ sổ chi, không tính trùng.</p>
    <div class="list" style="margin-top:8px">${orphan.map(t => `<button class="item" data-action="link-wd" data-id="${esc(t.id)}"><span class="main"><span class="t1">${dmy(t.date)}</span>${t.note ? `<span class="t2" style="display:block">${esc(t.note)}</span>` : ''}</span><span class="amt">${fmtK(t.amount)}</span></button>`).join('')}</div></details>` : ''}
  ${dated.length ? `<h3>Có ngày</h3><div class="list">${dated.map(row).join('')}</div>` : ''}
  ${undated.length ? `<h3>Chưa có ngày <span class="muted" style="font-weight:400">(${undated.length})</span></h3><div class="list">${undated.map(row).join('')}</div>` : ''}
  ${!list.length ? `<div class="empty">${q ? 'Không tìm thấy tên nào khớp.' : 'Chưa có đám cưới nào. Bấm Thêm để ghi.'}</div>` : ''}`;
}
function editWedding(id, fromTxId) {
  const isNew = !id;
  const src = fromTxId ? S.transactions.find(t => t.id === fromTxId) : null;
  const w = id ? S.weddings.find(x => x.id === id) : { id: null, date: src ? src.date : today(), name: '', amount: src ? src.amount : 0, group: '', note: src ? src.note : '', link: '', txId: fromTxId || null };
  const groups = [...new Set(S.weddings.map(x => x.group).filter(Boolean))].sort();
  openSheet(`<h2>${isNew ? 'Thêm đám cưới' : 'Sửa đám cưới'}</h2>
  <form id="wdForm">
    <label class="field"><span>Tên người</span><input class="inp" id="wName" value="${esc(w.name)}" required placeholder="Ví dụ: Bảo MTI"></label>
    <div class="row2">
      <label class="field"><span>Số tiền (nghìn)</span><input class="inp" id="wAmt" inputmode="decimal" value="${w.amount ? nf.format(w.amount / 1000).replace(/\./g, '') : ''}" ${src ? 'disabled' : ''}></label>
      <label class="field"><span>Nhóm</span><input class="inp" id="wGroup" list="wdGroups" value="${esc(w.group)}" placeholder="MTI, B1, trọ…"></label>
    </div>
    <datalist id="wdGroups">${groups.map(g => `<option value="${esc(g)}">`).join('')}</datalist>
    <label class="field"><span>Ngày cưới / ngày đi mừng</span><input class="inp" type="date" id="wDate" value="${w.date || ''}" ${src ? 'disabled' : ''}></label>
    <label class="field"><span>Ghi chú</span><input class="inp" id="wNote" value="${esc(w.note)}"></label>
    <label class="field"><span>Link (Facebook, thiệp…)</span><input class="inp" id="wLink" value="${esc(w.link)}" inputmode="url"></label>
    ${w.link ? `<p class="hint"><a href="${esc(w.link)}" target="_blank" rel="noopener">Mở link</a></p>` : ''}
    ${!w.txId && !src ? `<label class="check"><input type="checkbox" id="wTx" ${isNew ? 'checked' : ''}> Ghi vào sổ chi tiêu (danh mục Cưới hỏi)</label>
      <p class="hint">Bỏ chọn nếu khoản này đã có trong sổ chi rồi, để không bị tính hai lần.</p>` : `<p class="hint">Đã có trong sổ chi tiêu${src ? '' : ': sửa số tiền và ngày ở đây sẽ cập nhật cả bên đó'}.</p>`}
    <button class="primary" type="submit">${isNew ? 'Lưu đám cưới' : 'Lưu thay đổi'}</button>
    ${!isNew ? `<div class="btnrow"><button type="button" class="secondary danger" id="wDel">Xoá</button></div>` : ''}
  </form>`, pn => {
    $('#wdForm', pn).onsubmit = e => {
      e.preventDefault();
      const name = $('#wName').value.trim(); if (!name) return;
      let amount = w.amount, date = w.date;
      if (!src) {
        const p = parseAmount($('#wAmt').value); if (!p || p.vnd <= 0) { toast('Nhập số tiền'); return; }
        amount = p.vnd; date = $('#wDate').value || null;
      }
      Object.assign(w, { name, amount, date, group: $('#wGroup').value.trim(), note: $('#wNote').value.trim(), link: $('#wLink').value.trim() });
      const wantTx = $('#wTx') && $('#wTx').checked;
      if (wantTx && !w.txId) {
        if (!date) { toast('Cần chọn ngày để ghi vào sổ chi'); return; }
        const t = { id: uid('tx'), date, cat: 'cuoi', amount, note: `Mừng cưới ${name}`, src: '' };
        S.transactions.push(t); w.txId = t.id;
      } else if (w.txId) {
        const t = S.transactions.find(x => x.id === w.txId);
        if (t) { t.amount = amount; if (date) t.date = date; if (!t.note || /^Mừng cưới/.test(t.note) || src) t.note = `Mừng cưới ${name}` + (src && src.note && !/^Mừng cưới/.test(src.note) ? ' — ' + src.note : ''); }
      }
      if (isNew) { w.id = uid('wd'); S.weddings.push(w); }
      save(); closeSheet(); render(); toast('Đã lưu');
    };
    if (!isNew) $('#wDel', pn).onclick = () => {
      if (!confirm('Xoá khỏi sổ Tiền cưới?')) return;
      if (w.txId && confirm('Xoá luôn khoản chi tương ứng trong sổ chi tiêu?')) S.transactions = S.transactions.filter(t => t.id !== w.txId);
      S.weddings = S.weddings.filter(x => x.id !== w.id); save(); closeSheet(); render(); toast('Đã xoá');
    };
  });
}

/* ---------- view: Xe ---------- */
function oilStatus() {
  const hist = S.oil.filter(o => o.date).slice().sort((a, b) => a.date.localeCompare(b.date));
  if (!hist.length) return null;
  const last = hist[hist.length - 1];
  const interval = +S.settings.oilInterval || 3000;
  const next = last.next ?? (last.odo != null ? last.odo + interval : null);
  const cur = S.settings.odometer;
  const remaining = next != null && cur != null ? next - cur : null;
  const exact = hist.filter(o => o.odo != null && !o.approx).slice(-4);
  let rate = null;
  if (exact.length >= 2) {
    const a = exact[0], b = exact[exact.length - 1], d = daysBetween(a.date, b.date);
    if (d > 0) rate = (b.odo - a.odo) / d;
  }
  let eta = null;
  if (rate && remaining != null && S.settings.odometerDate) eta = addDaysISO(S.settings.odometerDate, Math.max(0, Math.round(remaining / rate)));
  return { last, next, cur, remaining, rate, eta, hist, interval };
}
function renderCar() {
  const o = oilStatus(), st = S.settings;
  const y = String(new Date().getFullYear()), ly = txInYear(y);
  const sum = id => total(ly.filter(t => t.cat === id));
  let gauge = '';
  if (o && o.last.odo != null && o.next != null && o.cur != null) {
    const pct = Math.max(0, Math.min(100, (o.cur - o.last.odo) / (o.next - o.last.odo) * 100));
    gauge = `<div class="gauge ${o.remaining <= 0 ? 'over' : o.remaining <= 300 ? 'near' : ''}"><i style="width:${pct}%"></i></div>
      <div class="hero-row"><span class="lbl">${fmtKm(o.last.odo)}</span><span class="lbl">${fmtKm(o.next)}</span></div>`;
  }
  $('#view').innerHTML = `
  <div class="card">
    <div class="hero-row"><div><div class="lbl">Số km hiện tại</div><div class="big">${fmtKm(st.odometer)}</div>
      <div class="lbl">${st.odometerDate ? 'Cập nhật ' + dmy(st.odometerDate) : 'Chưa cập nhật'}</div></div>
      <button class="secondary" data-action="odo">Cập nhật km</button></div>
    ${o ? `<h3 style="margin-top:18px">Lần thay nhớt tới</h3>
      <div class="mid">${o.next != null ? fmtKm(o.next) : 'Chưa rõ'}${o.remaining != null ? ` <span class="${o.remaining <= 0 ? 'delta-up' : 'muted'}" style="font-size:15px;font-weight:500">${o.remaining <= 0 ? `quá ${nf0.format(-o.remaining)} km` : `còn ${nf0.format(o.remaining)} km`}</span>` : ''}</div>
      ${gauge}
      <p class="hint">Lần trước: ${dmy(o.last.date)}${o.last.approx ? ' (ước lượng)' : ''}, ${daysBetween(o.last.date, today())} ngày trước.${o.eta ? ` Với mức chạy khoảng ${nf0.format(o.rate)} km/ngày, dự kiến đến hạn khoảng ${dmy(o.eta)}.` : ''}</p>` : `<p class="hint">Chưa có lịch sử thay nhớt.</p>`}
    <button class="primary" data-action="add-oil">Ghi lần thay nhớt</button>
  </div>
  <h3>Chi phí xe năm ${y}</h3>
  <div class="stats"><div><span class="lbl">Xăng</span><b>${fmtK(sum('xang'))}</b></div><div><span class="lbl">Sửa xe</span><b>${fmtK(sum('suaxe'))}</b></div><div><span class="lbl">Thay nhớt</span><b>${fmtK(sum('nhot'))}</b></div></div>
  <h3>Lịch sử thay nhớt</h3>
  <div class="list">${o ? o.hist.slice().reverse().map((h, i, arr) => {
    const prev = arr[i + 1];
    const gap = prev && prev.odo != null && h.odo != null ? `+${nf0.format(h.odo - prev.odo)} km` : '';
    return `<button class="item" data-action="edit-oil" data-id="${esc(h.id)}"><span class="main"><span class="t1">${dmy(h.date)}${h.approx ? '<span class="tag warn">Ngày ước lượng</span>' : ''}</span>
      <span class="t2" style="display:block">${h.odo != null ? nf0.format(h.odo) : '?'} → ${h.next != null ? nf0.format(h.next) : '?'} km${h.cost ? ', ' + fmtK(h.cost) : ''}</span></span><span class="amt muted" style="font-size:13px">${gap}</span></button>`;
  }).join('') : `<div class="empty">Chưa có lần thay nào.</div>`}</div>
  <p class="hint">Chu kỳ thay: ${nf0.format(+st.oilInterval || 3000)} km (đổi trong Cài đặt).</p>`;
}
function editOdo() {
  openSheet(`<h2>Cập nhật số km</h2><form id="odoForm">
    <label class="field"><span>Số km trên đồng hồ</span><input class="inp" id="odoVal" inputmode="numeric" value="${S.settings.odometer ?? ''}"></label>
    <button class="primary" type="submit">Lưu số km</button></form>`, pn => {
    $('#odoVal', pn).focus();
    $('#odoForm', pn).onsubmit = e => {
      e.preventDefault(); const v = numOrNull(String($('#odoVal').value).replace(/\D/g, ''));
      if (v == null) return; S.settings.odometer = v; S.settings.odometerDate = today(); save(); closeSheet(); render(); toast('Đã cập nhật số km');
    };
  });
}
function editOil(id) {
  const isNew = !id;
  const o = id ? S.oil.find(x => x.id === id) : { date: today(), approx: false, odo: S.settings.odometer, next: null, cost: null, note: '', txId: null };
  openSheet(`<h2>${isNew ? 'Ghi lần thay nhớt' : 'Sửa lần thay nhớt'}</h2><form id="oilForm">
    <div class="row2"><label class="field"><span>Ngày</span><input class="inp" type="date" id="oDate" value="${o.date || ''}"></label>
    <label class="field"><span>Chi phí (nghìn)</span><input class="inp" id="oCost" inputmode="decimal" value="${o.cost ? nf.format(o.cost / 1000).replace(/\./g, '') : ''}" placeholder="ví dụ 120"></label></div>
    <div class="row2"><label class="field"><span>Km lúc thay</span><input class="inp" id="oOdo" inputmode="numeric" value="${o.odo ?? ''}"></label>
    <label class="field"><span>Km lần tới</span><input class="inp" id="oNext" inputmode="numeric" value="${o.next ?? ''}" placeholder="tự tính nếu bỏ trống"></label></div>
    <label class="field"><span>Ghi chú</span><input class="inp" id="oNote" value="${esc(o.note)}"></label>
    ${!o.txId ? `<label class="check"><input type="checkbox" id="oTx" ${isNew ? 'checked' : ''}> Ghi chi phí vào sổ chi tiêu (Thay nhớt)</label>` : `<p class="hint">Chi phí đã có trong sổ chi tiêu.</p>`}
    <button class="primary" type="submit">Lưu</button>
    ${!isNew ? `<div class="btnrow"><button type="button" class="secondary danger" id="oDel">Xoá</button></div>` : ''}</form>`, pn => {
    $('#oilForm', pn).onsubmit = e => {
      e.preventDefault();
      const date = $('#oDate').value; if (!date) { toast('Chọn ngày'); return; }
      const odo = numOrNull(String($('#oOdo').value).replace(/\D/g, ''));
      let next = numOrNull(String($('#oNext').value).replace(/\D/g, ''));
      if (next == null && odo != null) next = odo + (+S.settings.oilInterval || 3000);
      const cp = parseAmount($('#oCost').value);
      Object.assign(o, { date, odo, next, cost: cp ? cp.vnd : null, note: $('#oNote').value.trim() });
      if (o.approx && !isNew) o.approx = false;
      if ($('#oTx') && $('#oTx').checked && o.cost) {
        const t = { id: uid('tx'), date, cat: 'nhot', amount: o.cost, note: o.note || 'Thay nhớt', src: '' };
        S.transactions.push(t); o.txId = t.id;
      } else if (o.txId) {
        const t = S.transactions.find(x => x.id === o.txId); if (t && o.cost) { t.amount = o.cost; t.date = date; }
      }
      if (isNew) { o.id = uid('oil'); S.oil.push(o); }
      if (odo != null && (S.settings.odometer == null || odo >= S.settings.odometer)) { S.settings.odometer = odo; S.settings.odometerDate = date; }
      save(); closeSheet(); render(); toast('Đã lưu lần thay nhớt');
    };
    if (!isNew) $('#oDel', pn).onclick = () => {
      if (!confirm('Xoá lần thay nhớt này?')) return;
      if (o.txId && confirm('Xoá luôn khoản chi tương ứng trong sổ chi tiêu?')) S.transactions = S.transactions.filter(t => t.id !== o.txId);
      S.oil = S.oil.filter(x => x.id !== o.id); save(); closeSheet(); render();
    };
  });
}

/* ---------- export / import ---------- */
const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const plugin = n => window.Capacitor && ((window.Capacitor.Plugins && window.Capacitor.Plugins[n]) || (window.Capacitor.registerPlugin && window.Capacitor.registerPlugin(n)));
function b64FromString(str) {
  const bytes = new TextEncoder().encode(str); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
async function deliverFile(name, mime, { text, base64 }) {
  if (isNative()) {
    const Filesystem = plugin('Filesystem'), Share = plugin('Share');
    const data = base64 || b64FromString(text);
    const r = await Filesystem.writeFile({ path: name, data, directory: 'CACHE' });
    await Share.share({ title: name, url: r.uri, dialogTitle: 'Lưu file sao lưu' });
    return;
  }
  let blob;
  if (base64) { const bin = atob(base64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); blob = new Blob([u], { type: mime }); }
  else blob = new Blob([text], { type: mime });
  const file = new File([blob], name, { type: mime });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title: name }); return; }
    catch (e) { if (e.name === 'AbortError') throw e; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
const stamp = () => today().replace(/-/g, '');
function exportData() { return Object.assign({ app: APP_ID, version: DATA_VERSION, exportedAt: new Date().toISOString() }, S); }
async function backupJSON() {
  try {
    await deliverFile(`so-chi-tieu-${stamp()}.json`, 'application/json', { text: JSON.stringify(exportData(), null, 1) });
    S.settings.lastBackup = new Date().toISOString(); save(); render(); toast('Đã tạo file sao lưu');
  } catch (e) { if (e.name !== 'AbortError') toast('Không xuất được file: ' + e.message); }
}
const toSerial = s => { const [y, m, d] = s.split('-').map(Number); return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000; };
const fromSerial = n => { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
function sheetFrom(rows, dateCols = [], widths = []) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  for (let r = 1; r < rows.length; r++) for (const c of dateCols) {
    const a = XLSX.utils.encode_cell({ r, c }); if (ws[a] && typeof ws[a].v === 'number') ws[a].z = 'dd/mm/yyyy';
  }
  ws['!cols'] = widths.map(w => ({ wch: w }));
  return ws;
}
async function exportExcel() {
  if (!window.XLSX) { toast('Thiếu thư viện Excel'); return; }
  const wb = XLSX.utils.book_new(), cats = sortedCats();
  const tx = S.transactions.slice().sort((a, b) => a.date.localeCompare(b.date));
  XLSX.utils.book_append_sheet(wb, sheetFrom([['Ngày', 'Danh mục', 'Nhóm', 'Số tiền (đ)', 'Ghi chú', 'ID'],
    ...tx.map(t => { const c = catById(t.cat); return [toSerial(t.date), c.name, c.group, t.amount, t.note, t.id]; })], [0], [12, 24, 12, 14, 50, 22]), 'Giao dịch');
  const months = [...new Set(tx.map(t => t.date.slice(0, 7)))].sort();
  XLSX.utils.book_append_sheet(wb, sheetFrom([['Tháng', ...cats.map(c => c.name), 'Tổng'],
    ...months.map(m => { const l = txInMonth(m), b = sumBy(l); return [m, ...cats.map(c => b[c.id] || 0), total(l)]; })], [], [10, ...cats.map(() => 14), 14]), 'Tổng tháng');
  XLSX.utils.book_append_sheet(wb, sheetFrom([['Năm', ...cats.map(c => c.name), 'Tổng'],
    ...years().map(y => { const l = txInYear(y), b = sumBy(l); return [String(y), ...cats.map(c => b[c.id] || 0), total(l)]; })], [], [8, ...cats.map(() => 14), 14]), 'Tổng năm');
  XLSX.utils.book_append_sheet(wb, sheetFrom([['Ngày', 'Tên', 'Số tiền (đ)', 'Nhóm', 'Ghi chú', 'Link', 'Mã giao dịch', 'ID'],
    ...S.weddings.map(w => [w.date ? toSerial(w.date) : '', w.name, w.amount, w.group, w.note, w.link, w.txId || '', w.id])], [0], [12, 24, 14, 10, 30, 30, 22, 14]), 'Tiền cưới');
  XLSX.utils.book_append_sheet(wb, sheetFrom([['Ngày', 'Ngày ước lượng', 'Km lúc thay', 'Km lần tới', 'Chi phí (đ)', 'Ghi chú', 'Mã giao dịch', 'ID'],
    ...S.oil.slice().sort((a, b) => a.date.localeCompare(b.date)).map(o => [toSerial(o.date), o.approx ? 'Có' : '', o.odo ?? '', o.next ?? '', o.cost ?? '', o.note, o.txId || '', o.id])], [0], [12, 14, 12, 12, 12, 40, 22, 10]), 'Thay nhớt');
  XLSX.utils.book_append_sheet(wb, sheetFrom([['Tháng', 'Ghi chú', 'ID'], ...S.monthNotes.map(n => [n.month, n.text, n.id])], [], [10, 70, 10]), 'Ghi chú tháng');
  XLSX.utils.book_append_sheet(wb, sheetFrom([['ID', 'Tên', 'Nhóm'], ...S.categories.map(c => [c.id, c.name, c.group])], [], [10, 26, 12]), 'Danh mục');
  XLSX.utils.book_append_sheet(wb, sheetFrom([['Khóa', 'Giá trị'], ...Object.entries(S.settings).map(([k, v]) => [k, v ?? ''])], [], [16, 30]), 'Cài đặt');
  try {
    await deliverFile(`so-chi-tieu-${stamp()}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', { base64: XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) });
    S.settings.lastBackup = new Date().toISOString(); save(); render(); toast('Đã xuất file Excel');
  } catch (e) { if (e.name !== 'AbortError') toast('Không xuất được file: ' + e.message); }
}
function readDateCell(v) {
  if (v === '' || v == null) return null;
  if (typeof v === 'number') return fromSerial(v);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return null;
}
function parseWorkbook(buf) {
  const wb = XLSX.read(buf, { type: 'array' });
  const rows = name => wb.Sheets[name] ? XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '', raw: true }) : [];
  if (!wb.Sheets['Giao dịch']) throw new Error('File Excel không có sheet "Giao dịch". Hãy dùng file do app xuất ra.');
  const catRows = rows('Danh mục');
  const categories = catRows.length ? catRows.map(r => ({ id: String(r['ID']), name: String(r['Tên']), group: String(r['Nhóm'] || 'Khác') })) : DEFAULT_CATS.map(({ id, name, group }) => ({ id, name, group }));
  const byName = {}; categories.forEach(c => { byName[c.name.toLowerCase()] = c.id; byName[c.id.toLowerCase()] = c.id; });
  const transactions = rows('Giao dịch').map(r => {
    const date = readDateCell(r['Ngày']); if (!date) return null;
    const name = String(r['Danh mục'] || '').toLowerCase();
    const cat = byName[name] || 'khac';
    let note = String(r['Ghi chú'] || '');
    if (!byName[name] && name) note = `[${r['Danh mục']}] ${note}`.trim();
    return { id: String(r['ID'] || uid('tx')), date, cat, amount: Math.round(+r['Số tiền (đ)'] || 0), note, src: '' };
  }).filter(Boolean);
  const weddings = rows('Tiền cưới').map(r => ({ id: String(r['ID'] || uid('wd')), date: readDateCell(r['Ngày']), name: String(r['Tên'] || ''), amount: Math.round(+r['Số tiền (đ)'] || 0), group: String(r['Nhóm'] || ''), note: String(r['Ghi chú'] || ''), link: String(r['Link'] || ''), txId: String(r['Mã giao dịch'] || '') || null })).filter(w => w.name);
  const oil = rows('Thay nhớt').map(r => ({ id: String(r['ID'] || uid('oil')), date: readDateCell(r['Ngày']), approx: /có|yes|x/i.test(String(r['Ngày ước lượng'] || '')), odo: numOrNull(r['Km lúc thay']), next: numOrNull(r['Km lần tới']), cost: numOrNull(r['Chi phí (đ)']), note: String(r['Ghi chú'] || ''), txId: String(r['Mã giao dịch'] || '') || null })).filter(o => o.date);
  const monthNotes = rows('Ghi chú tháng').map(r => ({ id: String(r['ID'] || uid('mn')), month: String(r['Tháng']).slice(0, 7), text: String(r['Ghi chú'] || '') })).filter(n => n.text);
  const settings = {};
  rows('Cài đặt').forEach(r => { const k = String(r['Khóa']), v = r['Giá trị']; settings[k] = v === '' ? null : (['odometer', 'oilInterval'].includes(k) ? +v : String(v)); });
  return { categories, transactions, weddings, oil, monthNotes, settings };
}
function mergeInto(base, inc) {
  const up = (a, b) => { const m = new Map(a.map(x => [x.id, x])); b.forEach(x => m.set(x.id, x)); return [...m.values()]; };
  base.transactions = up(base.transactions, inc.transactions);
  base.weddings = up(base.weddings, inc.weddings);
  base.oil = up(base.oil, inc.oil);
  base.monthNotes = up(base.monthNotes, inc.monthNotes);
  if (inc.settings) for (const k of ['odometer', 'odometerDate', 'oilInterval']) {
    if (inc.settings[k] != null && (base.settings[k] == null || (k === 'odometer' && inc.settings[k] > base.settings[k]))) base.settings[k] = inc.settings[k];
  }
  return base;
}
async function handleImportFile(file) {
  try {
    let inc;
    if (/\.xlsx$/i.test(file.name)) inc = normalize(parseWorkbook(new Uint8Array(await file.arrayBuffer())));
    else {
      const d = JSON.parse(await file.text());
      if (!Array.isArray(d.transactions)) throw new Error('File JSON không đúng định dạng sổ chi tiêu.');
      inc = normalize(d);
    }
    const n = inc.transactions.length;
    let mode = 'replace';
    if (S.transactions.length) {
      mode = confirm(`File có ${n} khoản chi, ${inc.weddings.length} đám cưới, ${inc.oil.length} lần thay nhớt.\n\nOK = THAY THẾ toàn bộ dữ liệu hiện tại bằng file này.\nHuỷ = GỘP vào dữ liệu hiện tại (trùng mã thì lấy theo file).`) ? 'replace' : 'merge';
    }
    S = mode === 'replace' ? inc : mergeInto(S, inc);
    await store.set('state', S);
    closeSheet(); render();
    toast(`${mode === 'replace' ? 'Đã nhập' : 'Đã gộp'} ${nf0.format(n)} khoản chi`);
  } catch (e) { toast('Không đọc được file: ' + e.message); }
}

/* ---------- đồng bộ đám mây: Supabase + mã hoá đầu-cuối ---------- */
const b64e = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const b64url = u8 => b64e(u8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const PBKDF2_ITER = 600000;
const VERIFY_TEXT = 'so-chi-tieu:ok';
const BATCH = 400;
const Sync = { st: null, keys: null, busy: false, pending: false, timer: null };

async function syncLoad() {
  try { Sync.st = (await store.get('sync')) || null; Sync.keys = (await store.get('synckeys')) || null; } catch { Sync.st = null; Sync.keys = null; }
}
const syncPersist = () => store.set('sync', Sync.st);
const syncOn = () => !!(Sync.st && Sync.st.enabled && Sync.st.refresh && Sync.keys);

async function deriveKeys(pass, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITER }, base, 512));
  const aes = await crypto.subtle.importKey('raw', bits.slice(0, 32), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  const hmac = await crypto.subtle.importKey('raw', bits.slice(32), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  bits.fill(0);
  return { aes, hmac };
}
async function encObj(keys, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keys.aes, new TextEncoder().encode(JSON.stringify(obj))));
  return { iv: b64e(iv), data: b64e(ct) };
}
async function decObj(keys, iv, data) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(iv) }, keys.aes, b64d(data));
  return JSON.parse(new TextDecoder().decode(pt));
}
// Mã dòng trên server = HMAC(khoá bí mật, mã bản ghi) → server không suy ra được ngày hay danh mục
async function rowId(key) {
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', Sync.keys.hmac, new TextEncoder().encode(key)));
  return b64url(sig.slice(0, 24));
}
function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36) + '.' + str.length; }

function takeSession(j) {
  Object.assign(Sync.st, { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000, userId: (j.user && j.user.id) || Sync.st.userId });
}
async function authErr(r, fallback) {
  let j = {}; try { j = await r.json(); } catch {}
  return new Error(j.error_description || j.msg || j.message || j.error || `${fallback} (${r.status})`);
}
async function sbRefresh() {
  const st = Sync.st;
  if (!st || !st.refresh) { const e = new Error('Chưa đăng nhập'); e.auth = true; throw e; }
  const r = await fetch(st.url + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: st.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: st.refresh }) });
  if (!r.ok) { const e = new Error('Phiên đăng nhập đã hết hạn. Hãy bật lại đồng bộ.'); e.auth = true; throw e; }
  takeSession(await r.json());
  if (st.enabled) await syncPersist();
}
async function sbFetch(path, { method = 'GET', body, headers = {} } = {}) {
  const st = Sync.st;
  if (!st.access || Date.now() > (st.exp || 0) - 60000) await sbRefresh();
  const go = () => fetch(st.url + path, {
    method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: { apikey: st.key, Authorization: 'Bearer ' + st.access, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
  });
  let r = await go();
  if (r.status === 401) { await sbRefresh(); r = await go(); }
  if (!r.ok) {
    let msg = `Lỗi máy chủ (${r.status})`;
    try { const j = await r.json(); msg = j.message || j.msg || j.error || msg; } catch {}
    throw new Error(msg);
  }
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}

const ARR = { tx: 'transactions', wd: 'weddings', oil: 'oil', mn: 'monthNotes' };
function localRecords() {
  const m = new Map();
  for (const [k, arr] of Object.entries(ARR)) for (const x of S[arr]) m.set(`${k}:${x.id}`, x);
  m.set('set:settings', S.settings);
  m.set('cat:all', S.categories);
  return m;
}
function applyRemote(key, del, v) {
  const i0 = key.indexOf(':'), k = key.slice(0, i0), id = key.slice(i0 + 1);
  if (k === 'set') { if (!del && v) S.settings = v; return; }
  if (k === 'cat') { if (!del && Array.isArray(v) && v.length) S.categories = v; return; }
  const arr = ARR[k]; if (!arr) return;
  const i = S[arr].findIndex(x => x.id === id);
  if (del) { if (i >= 0) S[arr].splice(i, 1); }
  else if (i >= 0) S[arr][i] = v; else S[arr].push(v);
}

function syncStatusText() {
  const st = Sync.st || {};
  if (Sync.busy) return st.progress || 'Đang đồng bộ…';
  if (st.lastError) return 'Chưa đồng bộ được: ' + st.lastError;
  if (st.lastSync) { const d = new Date(st.lastSync); return `Đồng bộ lần cuối lúc ${pad(d.getHours())}:${pad(d.getMinutes())} ngày ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; }
  return 'Chưa đồng bộ lần nào';
}
function showSyncStatus() { const el = $('#syncStatus'); if (el) el.textContent = syncStatusText(); }
function scheduleSync(ms = 4000) {
  if (!syncOn()) return;
  clearTimeout(Sync.timer);
  Sync.timer = setTimeout(() => syncNow(), ms);
}
function softRender() {
  if ($('#sheet').classList.contains('open')) return;
  const typing = ui.tab === 'nhap' && (($('#amt') && $('#amt').value) || ($('#note') && $('#note').value));
  if (!typing) render();
}

async function syncNow({ silent = true } = {}) {
  if (!syncOn()) return;
  if (Sync.busy) { Sync.pending = true; return; }
  if (!navigator.onLine) { Sync.st.lastError = 'Đang offline, sẽ đồng bộ khi có mạng'; showSyncStatus(); return; }
  const st = Sync.st; st.index = st.index || {}; st.lastRev = st.lastRev || 0;
  Sync.busy = true; st.progress = ''; showSyncStatus();
  let changed = false;
  try {
    // 1) Kéo thay đổi từ máy chủ về (theo số thứ tự rev tăng dần)
    const local0 = localRecords();
    const hashOf = v => v === undefined ? undefined : fnv(JSON.stringify(v));
    const dirty = key => !st.preferRemote && hashOf(local0.get(key)) !== st.index[key];
    for (;;) {
      const rows = await sbFetch(`/rest/v1/items?select=rev,iv,data&rev=gt.${st.lastRev}&order=rev.asc&limit=1000`);
      for (const r of rows) {
        const o = await decObj(Sync.keys, r.iv, r.data);
        if (!dirty(o.key)) {
          const before = hashOf(local0.get(o.key));
          applyRemote(o.key, o.del, o.v);
          if (o.del) delete st.index[o.key]; else st.index[o.key] = fnv(JSON.stringify(o.v));
          if (before !== (o.del ? undefined : st.index[o.key])) changed = true;
        }
        st.lastRev = Math.max(st.lastRev, +r.rev);
      }
      if (rows.length) await syncPersist();
      if (rows.length < 1000) break;
      st.progress = 'Đang tải dữ liệu về…'; showSyncStatus();
    }
    if (st.preferRemote) { delete st.preferRemote; await syncPersist(); }
    if (changed) await store.set('state', S);

    // 2) Đẩy thay đổi trong máy lên (bản ghi mới/sửa/xoá so với lần đồng bộ trước)
    const local = localRecords(), ops = [];
    for (const [key, v] of local) { const h = fnv(JSON.stringify(v)); if (st.index[key] !== h) ops.push({ key, v, h }); }
    for (const key of Object.keys(st.index)) if (!local.has(key)) ops.push({ key, del: true });
    for (let i = 0; i < ops.length; i += BATCH) {
      const batch = ops.slice(i, i + BATCH), rows = [];
      for (const op of batch) {
        const e = await encObj(Sync.keys, op.del ? { key: op.key, del: true } : { key: op.key, v: op.v });
        rows.push({ user_id: st.userId, id: await rowId(op.key), iv: e.iv, data: e.data });
      }
      await sbFetch('/rest/v1/items?on_conflict=user_id,id', { method: 'POST', body: rows, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
      for (const op of batch) { if (op.del) delete st.index[op.key]; else st.index[op.key] = op.h; }
      await syncPersist();
      if (ops.length > BATCH) { st.progress = `Đang tải lên ${nf0.format(Math.min(i + BATCH, ops.length))}/${nf0.format(ops.length)}…`; showSyncStatus(); }
    }
    st.lastSync = new Date().toISOString(); st.lastError = null; st.progress = '';
    await syncPersist();
  } catch (e) {
    st.lastError = e.message; st.progress = '';
    if (e.auth) { st.enabled = false; Sync.keys = null; await store.set('synckeys', null).catch(() => {}); }
    await syncPersist().catch(() => {});
    if (!silent || e.auth) toast('Đồng bộ lỗi: ' + e.message);
  } finally {
    Sync.busy = false; showSyncStatus();
    if (changed) softRender();
    if (Sync.pending) { Sync.pending = false; scheduleSync(1500); }
  }
}

async function syncSetup({ url, key, email, password, pass, pass2 }) {
  url = String(url || '').trim().replace(/\/+$/, '');
  if (!/^https:\/\/[^/]+$/.test(url) && !/^http:\/\/localhost(:\d+)?$/.test(url)) throw new Error('Project URL có dạng https://xxxx.supabase.co');
  if (!key.trim()) throw new Error('Thiếu Publishable key');
  if (!email.trim() || !password) throw new Error('Nhập email và mật khẩu đăng nhập');
  if (!pass || pass.length < 8) throw new Error('Mật khẩu mã hoá cần ít nhất 8 ký tự');
  const prev = Sync.st;
  Sync.st = { url, key: key.trim(), email: email.trim(), enabled: false, lastRev: 0, index: {} };
  try {
    const r = await fetch(url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: Sync.st.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: Sync.st.email, password }) });
    if (!r.ok) throw await authErr(r, 'Đăng nhập thất bại');
    takeSession(await r.json());
    const v = await sbFetch('/rest/v1/vault?select=salt,check_iv,check_ct');
    if (!v || !v.length) {
      if (pass !== pass2) throw new Error('Hai lần nhập mật khẩu mã hoá không khớp');
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const keys = await deriveKeys(pass, salt);
      const chk = await encObj(keys, VERIFY_TEXT);
      await sbFetch('/rest/v1/vault', { method: 'POST', body: { user_id: Sync.st.userId, salt: b64e(salt), check_iv: chk.iv, check_ct: chk.data }, headers: { Prefer: 'return=minimal' } });
      Sync.keys = keys;
    } else {
      const keys = await deriveKeys(pass, b64d(v[0].salt));
      let ok = false; try { ok = (await decObj(keys, v[0].check_iv, v[0].check_ct)) === VERIFY_TEXT; } catch {}
      if (!ok) throw new Error('Sai mật khẩu mã hoá');
      Sync.keys = keys;
      let replace = true;
      if (S.transactions.length) replace = confirm('Trên mây đã có dữ liệu.\n\nOK = dùng dữ liệu trên mây, THAY dữ liệu đang có trong máy này.\nHuỷ = GỘP dữ liệu trong máy này lên mây.');
      if (replace) { S = emptyState(); await store.set('state', S); Sync.st.preferRemote = true; }
    }
    Sync.st.enabled = true;
    await store.set('synckeys', Sync.keys);
    await syncPersist();
  } catch (e) {
    Sync.st = prev; Sync.keys = prev && prev.enabled ? Sync.keys : null;
    throw e;
  }
  await syncNow({ silent: false });
}
async function syncOff() {
  if (!confirm('Tắt đồng bộ trên máy này? Dữ liệu trong máy và trên mây vẫn giữ nguyên.')) return;
  const st = Sync.st;
  try { await fetch(st.url + '/auth/v1/logout', { method: 'POST', headers: { apikey: st.key, Authorization: 'Bearer ' + st.access } }); } catch {}
  Sync.st = { url: st.url, key: st.key, email: st.email };
  Sync.keys = null;
  await syncPersist(); await store.set('synckeys', null);
  openSettings(); toast('Đã tắt đồng bộ');
}
function syncSectionHTML() {
  const st = Sync.st || {};
  if (syncOn()) return `<h3>Đồng bộ đám mây</h3>
    <p class="hint">Đang bật với tài khoản <b>${esc(st.email)}</b>. Dữ liệu được mã hoá ngay trên máy trước khi gửi đi.</p>
    <p class="hint" id="syncStatus">${esc(syncStatusText())}</p>
    <div class="btnrow"><button class="secondary" data-action="sync-now">Đồng bộ ngay</button><button class="secondary" data-action="sync-off">Tắt đồng bộ</button></div>`;
  return `<h3>Đồng bộ đám mây</h3>
    <p class="hint">Dùng project Supabase của riêng bạn (xem SUPABASE.md). Dữ liệu được mã hoá bằng mật khẩu mã hoá trước khi rời máy, nên Supabase cũng không đọc được.</p>
    ${st.lastError ? `<p class="hint danger">${esc(st.lastError)}</p>` : ''}
    <form id="syncForm" autocomplete="off">
      <label class="field"><span>Project URL</span><input class="inp" id="sbUrl" inputmode="url" autocapitalize="off" placeholder="https://xxxx.supabase.co" value="${esc(st.url || '')}"></label>
      <label class="field"><span>Publishable key (hoặc anon key)</span><input class="inp" id="sbKey" autocapitalize="off" value="${esc(st.key || '')}"></label>
      <label class="field"><span>Email đăng nhập</span><input class="inp" id="sbEmail" type="email" autocomplete="username" autocapitalize="off" value="${esc(st.email || '')}"></label>
      <label class="field"><span>Mật khẩu đăng nhập</span><input class="inp" id="sbPw" type="password" autocomplete="current-password"></label>
      <label class="field"><span>Mật khẩu mã hoá</span><input class="inp" id="sbPass" type="password" autocomplete="off"></label>
      <label class="field"><span>Nhập lại mật khẩu mã hoá (chỉ cần ở máy đầu tiên)</span><input class="inp" id="sbPass2" type="password" autocomplete="off"></label>
      <p class="hint">Mật khẩu mã hoá phải giống nhau trên mọi máy. Quên nó thì bản trên mây không mở được, dữ liệu trong máy vẫn còn.</p>
      <button class="primary" type="submit" id="sbGo">Bật đồng bộ</button>
    </form>`;
}
function mountSyncForm(pn) {
  const f = $('#syncForm', pn); if (!f) return;
  f.onsubmit = async e => {
    e.preventDefault();
    const btn = $('#sbGo', pn); btn.disabled = true; btn.textContent = 'Đang thiết lập…';
    try {
      await syncSetup({ url: $('#sbUrl').value, key: $('#sbKey').value, email: $('#sbEmail').value, password: $('#sbPw').value, pass: $('#sbPass').value, pass2: $('#sbPass2').value });
      render(); openSettings();
      toast(Sync.st && Sync.st.lastError ? 'Đã bật, nhưng lần đồng bộ đầu bị lỗi' : 'Đã bật đồng bộ');
    } catch (err) {
      toast(err.message); btn.disabled = false; btn.textContent = 'Bật đồng bộ';
    }
  };
}

/* ---------- settings ---------- */
function openSettings() {
  const st = S.settings;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iPhone|iPad/i.test(navigator.userAgent);
  openSheet(`<h2>Sao lưu và cài đặt</h2>
  <p class="muted">${syncOn() ? 'Dữ liệu nằm trong máy và được đồng bộ (đã mã hoá) lên Supabase của bạn.' : 'Dữ liệu chỉ nằm trong máy này.'} Lần sao lưu file gần nhất: <b>${st.lastBackup ? dmy(st.lastBackup.slice(0, 10)) : 'chưa có'}</b>.</p>
  <div class="btnrow"><button class="secondary" data-action="backup-json">Sao lưu (.json)</button><button class="secondary" data-action="backup-xlsx">Xuất Excel</button></div>
  <p class="hint">File .json giữ đầy đủ mọi thứ, dùng để chuyển sang máy khác (iPhone, Android, máy tính). File Excel để xem và cũng nhập lại được.</p>
  <div class="btnrow"><button class="secondary" data-action="import">Nhập dữ liệu từ file</button></div>
  ${syncSectionHTML()}
  <h3>Thay nhớt</h3>
  <label class="field"><span>Chu kỳ thay nhớt (km)</span><input class="inp" id="setInterval" inputmode="numeric" value="${st.oilInterval ?? 3000}"></label>
  ${ios && !standalone && !isNative() ? `<h3>Cài lên màn hình chính</h3><p class="hint">Trong Safari, bấm nút Chia sẻ rồi chọn "Thêm vào MH chính". App sẽ mở toàn màn hình và chạy được khi không có mạng.</p>` : ''}
  <h3>Dữ liệu</h3>
  <p class="hint">${nf0.format(S.transactions.length)} khoản chi, ${S.weddings.length} đám cưới, ${S.oil.length} lần thay nhớt, ${S.monthNotes.length} ghi chú tháng.</p>
  <div class="btnrow"><button class="secondary danger" data-action="wipe">Xoá toàn bộ dữ liệu</button></div>
  <p class="hint">Phiên bản dữ liệu ${DATA_VERSION}</p>`, pn => {
    mountSyncForm(pn);
    $('#setInterval', pn).onchange = e => { const v = +String(e.target.value).replace(/\D/g, ''); if (v > 0) { S.settings.oilInterval = v; save(); toast('Đã lưu chu kỳ thay nhớt'); } };
  });
}
async function wipe() {
  if (!confirm(syncOn() ? 'Xoá toàn bộ dữ liệu trong máy? Đồng bộ sẽ được tắt trên máy này, dữ liệu trên mây vẫn giữ nguyên.' : 'Xoá toàn bộ dữ liệu trong máy? Hãy chắc chắn bạn đã sao lưu.')) return;
  if (!confirm('Xác nhận lần nữa: xoá hết, không khôi phục được.')) return;
  if (Sync.st) { Sync.st = { url: Sync.st.url, key: Sync.st.key, email: Sync.st.email }; Sync.keys = null; await syncPersist(); await store.set('synckeys', null); }
  S = emptyState(); await store.set('state', S); closeSheet(); render(); toast('Đã xoá toàn bộ dữ liệu');
}

/* ---------- render & events ---------- */
const TITLES = { nhap: 'Sổ chi tiêu', so: 'Sổ chi', tong: 'Tổng kết', cuoi: 'Tiền cưới', xe: 'Xe' };
function render() {
  $$('.tab').forEach(b => b.setAttribute('aria-current', b.dataset.tab === ui.tab ? 'page' : 'false'));
  $('#title').textContent = TITLES[ui.tab];
  ({ nhap: renderEntry, so: renderBook, tong: renderSummary, cuoi: renderWedding, xe: renderCar })[ui.tab]();
}
document.addEventListener('click', e => {
  const tab = e.target.closest('.tab');
  if (tab) { ui.tab = tab.dataset.tab; render(); window.scrollTo(0, 0); return; }
  const chip = e.target.closest('.chip');
  if (chip) {
    ui.entryCat = chip.dataset.cat;
    $$('.chip').forEach(c => c.setAttribute('aria-checked', c === chip));
    toggleExtras(); return;
  }
  const el = e.target.closest('[data-action]'); if (!el) return;
  const a = el.dataset.action, id = el.dataset.id;
  switch (a) {
    case 'settings': openSettings(); break;
    case 'close-sheet': closeSheet(); break;
    case 'tab': closeSheet(); ui.tab = el.dataset.tab; render(); break;
    case 'plus': { const i = $('#amt'); if (i.value && !i.value.endsWith('+')) i.value += '+'; i.focus(); updatePreview(); break; }
    case 'edit-tx': editTx(id); break;
    case 'del-tx': deleteTx(id); break;
    case 'bm': ui.bookMonth = addMonth(ui.bookMonth, +el.dataset.d); ui.query = ''; renderBook(); break;
    case 'add-note': editNote(null); break;
    case 'edit-note': editNote(id); break;
    case 'sum-mode': ui.sumMode = el.dataset.m; renderSummary(); break;
    case 'sm': ui.sumMonth = addMonth(ui.sumMonth, +el.dataset.d); renderSummary(); break;
    case 'sy': ui.sumYear += +el.dataset.d; renderSummary(); break;
    case 'goto-month': ui.sumMonth = `${ui.sumYear}-${pad(+el.dataset.i + 1)}`; ui.sumMode = 'month'; renderSummary(); break;
    case 'add-wd': editWedding(null); break;
    case 'edit-wd': editWedding(id); break;
    case 'link-wd': editWedding(null, id); break;
    case 'odo': editOdo(); break;
    case 'add-oil': editOil(null); break;
    case 'edit-oil': editOil(id); break;
    case 'backup-json': backupJSON(); break;
    case 'backup-xlsx': exportExcel(); break;
    case 'import': $('#fileInput').value = ''; $('#fileInput').click(); break;
    case 'wipe': wipe(); break;
    case 'sync-now': syncNow({ silent: false }).then(() => { if ($('#sheet').classList.contains('open')) showSyncStatus(); else render(); }); showSyncStatus(); break;
    case 'sync-off': syncOff(); break;
  }
});
document.addEventListener('submit', e => { if (e.target.id === 'entryForm') submitEntry(e); });
let qTimer;
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'amt') updatePreview();
  else if (t.id === 'q') { clearTimeout(qTimer); qTimer = setTimeout(() => { ui.query = t.value; renderBookList(); }, 180); }
  else if (t.id === 'wq') { clearTimeout(qTimer); qTimer = setTimeout(() => { ui.wdQuery = t.value; const pos = t.selectionStart; renderWedding(); const n = $('#wq'); n.focus(); n.setSelectionRange(pos, pos); }, 250); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'date') { ui.entryDate = t.value || today(); const keep = { amt: $('#amt').value, note: $('#note').value }; renderEntry(); $('#amt').value = keep.amt; $('#note').value = keep.note; updatePreview(); }
  else if (t.id === 'fcat') { ui.filterCat = t.value; renderBookList(); }
  else if (t.id === 'fileInput' && t.files[0]) handleImportFile(t.files[0]);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

/* ---------- boot ---------- */
(async function boot() {
  try { await store.open(); } catch (e) { console.warn('IndexedDB lỗi, dùng localStorage', e); }
  try { const d = await store.get('state'); if (d) S = normalize(d); } catch (e) { toast('Không đọc được dữ liệu: ' + e.message); }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  await syncLoad();
  render();
  if (syncOn()) syncNow();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') scheduleSync(800); });
  window.addEventListener('online', () => scheduleSync(800));
  if ('serviceWorker' in navigator && !isNative() && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
