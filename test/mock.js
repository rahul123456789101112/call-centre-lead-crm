// Minimal in-memory mock of the Apps Script services used by the Lead CRM.
// Formulas are stored, not evaluated. Unknown chainable methods are no-ops.
'use strict';
const toasts = [], alerts = [], formulas = [], triggers = [], prompts = [], confirms = [];
let tempKey = 'TK1', activeEmail = 'admin@example.com';

function chain(log) {
  const p = new Proxy(function () {}, {
    get(t, k) { if (k === 'then') return undefined; return (...a) => { if (log) log(k, a); return p; }; },
    apply() { return p; }
  });
  return p;
}

function parseA1(a1) {
  a1 = a1.replace(/\$/g, '');
  const m = /^([A-Z]+)?(\d+)?(?::([A-Z]+)?(\d+)?)?$/.exec(a1);
  if (!m) throw new Error('bad A1 ' + a1);
  const col = s => s.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  return { c1: m[1] ? col(m[1]) : 1, r1: m[2] ? +m[2] : 1, c2: m[3] ? col(m[3]) : (m[1] && !m[2] && !m[3] ? col(m[1]) : null), r2: m[4] ? +m[4] : null, hasEnd: !!(m[3] || m[4]) };
}
function letter(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

class Sheet {
  constructor(ss, name) { this.ss = ss; this.name = name; this.maxRows = 1000; this.maxCols = 26; this.v = {}; this.f = {}; this.dv = {}; this.charts = []; this.filter = null; this.prot = []; this.hidden = new Set(); }
  key(r, c) { return r + ':' + c; }
  getName() { return this.name; }
  getSheetId() { return this.ss.sheets.indexOf(this) + 1000; }
  getParent() { return this.ss; }
  getMaxRows() { return this.maxRows; }
  getMaxColumns() { return this.maxCols; }
  insertRowsAfter(after, n) { this.maxRows += n; }
  insertColumnsAfter(after, n) { this.maxCols += n; }
  getLastRow() { let m = 0; for (const k in this.v) if (this.v[k] !== '' && this.v[k] != null) m = Math.max(m, +k.split(':')[0]); for (const k in this.f) m = Math.max(m, +k.split(':')[0]); return m; }
  getLastColumn() { let m = 0; for (const k in this.v) if (this.v[k] !== '') m = Math.max(m, +k.split(':')[1]); return m; }
  getRange(a, b, c, d) {
    if (typeof a === 'string') {
      const p = parseA1(a);
      const r2 = p.hasEnd ? (p.r2 || this.maxRows) : p.r1;
      const c2 = p.hasEnd ? (p.c2 || this.maxCols) : p.c1;
      return new Range(this, p.r1, p.c1, r2 - p.r1 + 1, c2 - p.c1 + 1);
    }
    return new Range(this, a, b, c || 1, d || 1);
  }
  appendRow(vals) { const r = this.getLastRow() + 1; if (r > this.maxRows) this.maxRows = r; this.getRange(r, 1, 1, vals.length).setValues([vals]); return this; }
  getDataRange() { return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  getFilter() { return this.filter; }
  getCharts() { return this.charts.slice(); }
  removeChart(c) { this.charts = this.charts.filter(x => x !== c); }
  newChart() { const sh = this; const b = chain(); return new Proxy({}, { get(t, k) { if (k === 'build') return () => ({ chart: true }); return (...a) => this.proxyRef; }, set() { return true; } }) && (function () { const o = {}; const p = new Proxy(o, { get(t, k) { if (k === 'build') return () => ({ chart: true }); if (k === 'addRange') return (r) => { if (r.r < 1 || r.r + r.nr - 1 > sh.maxRows) throw new Error('chart range out of bounds'); return p; }; return () => p; } }); return p; })(); }
  insertChart(c) { this.charts.push(c); }
  getBandings() { return []; }
  getProtections(type) { return this.prot.filter(p => !type || p.type === type); }
  protect(type) { const p = new Protection(this, type || 'SHEET'); this.prot.push(p); return p; }
  hideSheet() { this.isHidden = true; return this; } showSheet() { this.isHidden = false; return this; } isSheetHidden() { return !!this.isHidden; }
  // Row / column deletion and insertion shift the stored cells like Sheets does.
  shift(axis, at, n) {   // n > 0 insert n before `at`; n < 0 delete -n starting at `at`
    const move = obj => { const out = {}; for (const k in obj) { let [r, c] = k.split(':').map(Number); let x = axis === 'r' ? r : c;
      if (n < 0 && x >= at && x < at - n) continue; if (x >= at) x += n; out[axis === 'r' ? x + ':' + c : r + ':' + x] = obj[k]; } return out; };
    this.v = move(this.v); this.f = move(this.f); this.dv = move(this.dv);
    if (axis === 'c') { const h = new Set(); this.hidden.forEach(c => { if (n < 0 && c >= at && c < at - n) return; h.add(c >= at ? c + n : c); }); this.hidden = h; this.maxCols += n; }
    else this.maxRows += n;
  }
  deleteRow(r) { this.shift('r', r, -1); } deleteRows(r, n) { this.shift('r', r, -n); }
  deleteColumn(c) { this.shift('c', c, -1); } deleteColumns(c, n) { this.shift('c', c, -n); }
  insertColumnsBefore(c, n) { this.shift('c', c, n); }
  getSheetProtection() { return null; }
  setConditionalFormatRules(r) { this.cf = r; }
  clearConditionalFormatRules() { this.cf = []; }
  clear() { this.v = {}; this.f = {}; }
  hideColumns(c, n) { for (let i = 0; i < (n || 1); i++) this.hidden.add(c + i); }
  showColumns(c, n) { for (let i = 0; i < (n || 1); i++) this.hidden.delete(c + i); }
  isColumnHiddenByUser(c) { return this.hidden.has(c); }
  moveColumns(range, dest) {
    // Reorder columns: take [c1..c2] and place them before column `dest` (dest < c1 in our use).
    const c1 = range.c, n = range.nc, order = [];
    for (let c = 1; c <= this.maxCols; c++) order.push(c);
    const moved = order.splice(c1 - 1, n);
    order.splice(dest - 1, 0, ...moved);            // order[newIndex] = oldColumn
    const remap = obj => { const out = {}; for (const k in obj) { const [r, c] = k.split(':').map(Number); out[r + ':' + (order.indexOf(c) + 1)] = obj[k]; } return out; };
    this.v = remap(this.v); this.f = remap(this.f); this.dv = remap(this.dv);
  }
  setColumnWidths() {} setFrozenRows() {} setFrozenColumns() {} setColumnWidth() {} setRowHeight() {} setTabColor() {} setHiddenGridlines() {}
  setActiveSelection() {} getActiveCell() { return this.getRange(this.ss.activeRow || 2, 1); }
}
class Protection {
  constructor(sh, type) { this.sh = sh; this.type = type; this.desc = ''; this.editors = []; }
  setDescription(d) { this.desc = d; return this; } getDescription() { return this.desc; }
  setWarningOnly(w) { this.warn = w; return this; }
  addEditors(e) { this.editors.push(...e.map(x => ({ getEmail: () => x }))); return this; }
  getEditors() { return this.editors; } removeEditors(u) { this.editors = this.editors.filter(x => !u.includes(x)); return this; }
  canDomainEdit() { return false; } setDomainEdit() { return this; } remove() { this.sh.prot = this.sh.prot.filter(p => p !== this); }
  setUnprotectedRanges(r) { this.unprot = r; return this; }
}
class Range {
  constructor(sh, r, c, nr, nc) {
    if (r < 1 || c < 1 || nr < 1 || nc < 1) throw new Error(`invalid range ${sh.name} r${r} c${c} ${nr}x${nc}`);
    if (r + nr - 1 > sh.maxRows || c + nc - 1 > sh.maxCols) throw new Error(`range out of bounds ${sh.name} r${r} c${c} ${nr}x${nc} (max ${sh.maxRows}x${sh.maxCols})`);
    Object.assign(this, { sh, r, c, nr, nc });
    const px = new Proxy(this, { get(t, k) { if (k in t) return t[k]; if (typeof k === 'symbol') return undefined; return () => px; } });
    return px;
  }
  getSheet() { return this.sh; } getRow() { return this.r; } getColumn() { return this.c; }
  getLastRow() { return this.r + this.nr - 1; } getLastColumn() { return this.c + this.nc - 1; }
  getNumRows() { return this.nr; } getNumColumns() { return this.nc; }
  getA1Notation() { return letter(this.c) + this.r + (this.nr > 1 || this.nc > 1 ? ':' + letter(this.c + this.nc - 1) + (this.r + this.nr - 1) : ''); }
  getValues() { const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const v = this.sh.v[this.sh.key(this.r + i, this.c + j)]; row.push(v === undefined ? '' : v); } o.push(row); } return o; }
  getDisplayValues() { return this.getValues().map(r => r.map(v => String(v))); }
  getValue() { return this.getValues()[0][0]; }
  setValues(vals) {
    if (vals.length !== this.nr || vals.some(r => r.length !== this.nc)) throw new Error(`setValues dims ${vals.length}x${vals[0] && vals[0].length} vs ${this.nr}x${this.nc} at ${this.sh.name}!${this.getA1Notation()}`);
    vals.forEach((row, i) => row.forEach((v, j) => {
      if (v === undefined) throw new Error('undefined value at ' + this.sh.name);
      const k = this.sh.key(this.r + i, this.c + j);
      if (typeof v === 'string' && v.startsWith('=')) { this.sh.f[k] = v; formulas.push([this.sh.name, v]); } else delete this.sh.f[k];
      this.sh.v[k] = v;
    }));
    return this;
  }
  setValue(v) { return this.setValues([[v]]); }
  setFormula(f) { formulas.push([this.sh.name + '!' + this.getA1Notation(), f]); this.sh.f[this.sh.key(this.r, this.c)] = f; return this; }
  setFormulas(fs) { if (fs.length !== this.nr) throw new Error('setFormulas dims'); fs.forEach((row, i) => row.forEach((f, j) => { formulas.push([this.sh.name, f]); this.sh.f[this.sh.key(this.r + i, this.c + j)] = f; })); return this; }
  getFormula() { return this.sh.f[this.sh.key(this.r, this.c)] || ''; }
  getFormulas() { const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(this.sh.f[this.sh.key(this.r + i, this.c + j)] || ''); o.push(row); } return o; }
  clearContent() { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) { delete this.sh.v[this.sh.key(this.r + i, this.c + j)]; } return this; }
  setDataValidation(rule) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sh.dv[this.sh.key(this.r + i, this.c + j)] = rule; return this; }
  setDataValidations(rules) { if (rules.length !== this.nr) throw new Error('setDataValidations dims ' + rules.length + ' vs ' + this.nr); rules.forEach((row, i) => row.forEach((rule, j) => { this.sh.dv[this.sh.key(this.r + i, this.c + j)] = rule; })); return this; }
  getDataValidation() { return this.sh.dv[this.sh.key(this.r, this.c)] || null; }
  clearDataValidations() { return this; }
  protect() { return this.sh.protect('RANGE'); }
  createFilter() { this.sh.filter = makeFilter(); return this.sh.filter; }
  applyRowBanding() { return chain(); }
  getNextDataCell() { // UP from bottom
    for (let r = this.r; r >= 1; r--) { const v = this.sh.v[this.sh.key(r, this.c)]; if (v !== undefined && v !== '') return this.sh.getRange(r, this.c); }
    return this.sh.getRange(1, this.c);
  }
  createTextFinder(text) {
    const self = this; let entire = false;
    const all = () => { const out = []; for (let i = 0; i < self.nr; i++) for (let j = 0; j < self.nc; j++) { const v = String(self.sh.v[self.sh.key(self.r + i, self.c + j)] ?? ''); if (entire ? v.toLowerCase() === text.toLowerCase() : v.toLowerCase().includes(text.toLowerCase())) out.push(self.sh.getRange(self.r + i, self.c + j)); } return out; };
    const tf = { matchEntireCell(b) { entire = b; return tf; }, findAll: all, findNext() { return all()[0] || null; } };
    return tf;
  }
}
function makeFilter() { const crit = {}; return { getColumnFilterCriteria: c => crit[c] || null, removeColumnFilterCriteria(c) { delete crit[c]; return this; }, setColumnFilterCriteria(c, x) { crit[c] = x; return this; }, remove() {}, crit }; }

class Spreadsheet {
  constructor() { this.sheets = [new Sheet(this, 'Sheet1')]; this.named = {}; this.active = this.sheets[0]; }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  getSheets() { return this.sheets.slice(); }
  insertSheet(n, i) { const s = new Sheet(this, n); this.sheets.splice(i ?? this.sheets.length, 0, s); return s; }
  deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); }
  setActiveSheet(s) { this.active = s; return s; } getActiveSheet() { return this.active; }
  moveActiveSheet() {}
  toast(m) { toasts.push(m); }
  getSpreadsheetTimeZone() { return 'Asia/Kolkata'; }
  setNamedRange(n, r) { this.named[n] = r; } getRangeByName(n) { return this.named[n] || null; }
  getOwner() { return null; } getUrl() { return 'https://docs.google.com/x'; }
}

function builder(kind) {
  const calls = [];
  const p = new Proxy({}, { get(t, k) {
    if (k === 'build') return () => {
      // Like Google: a conditional-format rule must have at least one range.
      if (kind === 'cf' && calls.some(c => c[0] === 'setRanges' && (!c[1][0] || !c[1][0].length))) throw new Error('Exception: Ranges must have at least one range.');
      return { kind, calls };
    };
    return (...a) => { calls.push([k, a]); return p; };
  } });
  return p;
}

function fmtDate(d, tz, fmt) {
  const parts = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    .formatToParts(d).forEach(p => parts[p.type] = p.value);
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+parts.month - 1];
  const local = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
  const offMin = Math.round((local - Math.floor(d.getTime() / 1000) * 1000) / 60000);
  const off = (offMin >= 0 ? '+' : '-') + String(Math.floor(Math.abs(offMin) / 60)).padStart(2, '0') + ':' + String(Math.abs(offMin) % 60).padStart(2, '0');
  return fmt.replace(/'([^']*)'/g, '\u0001$1\u0001').replace(/yyyy|MMM|MM|dd|HH|mm|ss|XXX/g, t => ({ yyyy: parts.year, MMM: mon, MM: parts.month, dd: parts.day, HH: String(+parts.hour % 24).padStart(2, '0'), mm: parts.minute, ss: parts.second, XXX: offMin === 0 ? 'Z' : off })[t]).replace(/\u0001/g, '');
}

function makeGlobals(ss) {
  const docProps = {}, scriptProps = {}, cache = {};
  const props = store => ({ getProperty: k => (k in store ? store[k] : null), setProperty(k, v) { store[k] = String(v); return this; }, deleteProperty(k) { delete store[k]; return this; }, getKeys: () => Object.keys(store) });
  return {
    console, Date, JSON, Math, Object, Array, String, Number, RegExp, Error, parseInt, parseFloat, isNaN,
    SpreadsheetApp: {
      getActive: () => ss, getActiveSpreadsheet: () => ss, getActiveSheet: () => ss.active, flush() {},
      getUi: () => ({ alert: (...a) => { alerts.push(a[1] || a[0]); return a.length > 2 && a[2] === 'YES_NO' ? (confirms.shift() || 'NO') : 'OK'; }, ButtonSet: { OK: 'OK', YES_NO: 'YES_NO', OK_CANCEL: 'OK_CANCEL' }, Button: { OK: 'OK', YES: 'YES', NO: 'NO' }, createMenu: () => chain(), showSidebar() {}, showModalDialog() {}, showModelessDialog: (h, t) => { alerts.push(h.__msg || t); }, prompt: () => { const t = prompts.length ? prompts.shift() : ''; return { getSelectedButton: () => 'OK', getResponseText: () => t }; } }),
      newDataValidation: () => builder('dv'), newConditionalFormatRule: () => builder('cf'), newFilterCriteria: () => builder('fc'),
      BandingTheme: {}, ProtectionType: { RANGE: 'RANGE', SHEET: 'SHEET' }, Direction: { UP: 'UP' }, BorderStyle: {}, RelativeDate: {}
    },
    Charts: { ChartType: { BAR: 'BAR', COLUMN: 'COLUMN', LINE: 'LINE', PIE: 'PIE' }, ChartHiddenDimensionStrategy: {} },
    Session: { getActiveUser: () => ({ getEmail: () => activeEmail }), getEffectiveUser: () => ({ getEmail: () => 'admin@example.com' }), getTemporaryActiveUserKey: () => tempKey, getScriptTimeZone: () => 'Asia/Kolkata' },
    PropertiesService: { getDocumentProperties: () => props(docProps), getScriptProperties: () => props(scriptProps) },
    CacheService: { getDocumentCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }),
      getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
    LockService: { getDocumentLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/a/macros/x/s/ABC/exec' }), getProjectTriggers: () => triggers, newTrigger: h => { const p = chain(); return new Proxy({}, { get(t, k) { if (k === 'create') return () => triggers.push({ getHandlerFunction: () => h }); return () => this.self; }, }) && (function mk() { const o = new Proxy({}, { get(t, k) { if (k === 'create') return () => { triggers.push({ getHandlerFunction: () => h }); }; return () => o; } }); return o; })(); }, deleteTrigger() {} },
    Utilities: {
      formatDate: fmtDate,
      computeDigest: (alg, s) => Array.from(require('crypto').createHash('md5').update(s).digest()),
      base64Encode: a => (typeof a === 'string' ? Buffer.from(a) : Buffer.from(a.map(x => x & 255))).toString('base64'),
      DigestAlgorithm: { MD5: 'MD5' }, Charset: { UTF_8: 'UTF-8' },
      base64EncodeWebSafe: a => (typeof a === 'string' ? Buffer.from(a) : Buffer.from(a.map(x => x & 255))).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      base64DecodeWebSafe: s => Array.from(Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64')).map(b => (b > 127 ? b - 256 : b)),
      computeHmacSha256Signature: (v, key) => Array.from(require('crypto').createHmac('sha256', key).update(v).digest()).map(b => (b > 127 ? b - 256 : b)),
      newBlob: bytes => ({ getDataAsString: () => Buffer.from(bytes.map(x => x & 255)).toString('utf8') }),
      getUuid: () => require('crypto').randomUUID(),
      sleep: () => {}
    },
    HtmlService: { XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' }, createTemplateFromFile: (n) => { const t = { evaluate: () => { const w = new Proxy({}, { get: (x, k) => k === '__tpl' ? t : () => w }); return w; } }; return t; }, createHtmlOutputFromFile: () => chain(), createHtmlOutput: (html) => { const w = new Proxy({}, { get: (t, k) => k === '__msg' ? html : () => w }); return w; } },
    MailApp: { sendEmail() {}, getRemainingDailyQuota: () => 100 },
    _state: { docProps, scriptProps, cache }
  };
}

module.exports = { Spreadsheet, makeGlobals, toasts, alerts, formulas, triggers, prompts, confirms, setUser(e, k) { activeEmail = e; tempKey = k; } };
