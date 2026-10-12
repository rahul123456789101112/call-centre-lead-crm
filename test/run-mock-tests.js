'use strict';
// Scenario tests for the Lead CRM Apps Script code against the in-memory mock in mock.js.
// Usage: node test/run-mock-tests.js apps-script
const fs = require('fs'), vm = require('vm'), path = require('path');
const M = require('./mock.js');
const dir = process.argv[2];
const ss = new M.Spreadsheet();
const g = makeCtx(ss);
function makeCtx(book) { const c = M.makeGlobals(book); vm.createContext(c); for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.gs'))) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), c, { filename: f }); return c; }
let fails = 0;
function ok(cond, msg) { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails++; }
function section(t) { console.log('\n--- ' + t + ' ---'); }
function fresh() { vm.runInContext('clearMemo_()', g); }
const LM = () => ss.getSheetByName('Lead Management'), LOG = () => ss.getSheetByName('Follow-Up Log');
const LE = () => ss.getSheetByName('Lead Entry'), LS_ = () => ss.getSheetByName('Lists & Settings');
function cell(sh, a1) { return sh.getRange(a1).getValue(); }
const lastToast = () => M.toasts[M.toasts.length - 1] || '';
// Simulates a user edit: the simple trigger (fast path, runs as the editor) then the installable trigger
// (runs as the owner; for personal accounts e.user is blank, identity comes from the key hand-off).
function edit(sheetName, a1, value, oldValue) {
  const sh = ss.getSheetByName(sheetName); const r = sh.getRange(a1);
  if (value !== undefined) { if (Array.isArray(value)) r.setValues(value); else r.setValue(value); }
  const ev = { range: r, value: Array.isArray(value) ? undefined : value, oldValue, source: ss };
  fresh(); g.onEdit(ev);
  fresh(); g.onEditInstallable(Object.assign({}, ev, { triggerUid: 't1', user: { getEmail: () => '' } }));
}
function typeFormula(a1, f) {   // a user typing a formula: the cell holds the formula and its result
  const r = LM().getRange(a1); r.setValue(2); r.setFormula(f);
  fresh(); g.onEdit({ range: r, source: ss });
  fresh(); g.onEditInstallable({ range: r, source: ss, triggerUid: 't1', user: { getEmail: () => '' } });
}
// Switch user; "registers" them as if they had used the Lead CRM menu once (authorised context).
function as(email, key, noRegister) { M.setUser(email, key || 'TK'); if (!noRegister) { fresh(); vm.runInContext('registerCurrentUser_()', g); } }
function logRows() { const l = LOG(); const n = l.getLastRow(); return n < 2 ? [] : l.getRange(2, 1, n - 1, 18).getValues(); }
function setSetting(key, value) {
  const sh = LS_(); const keys = sh.getRange(2, 14, 60, 1).getValues();
  const i = keys.findIndex(r => r[0] === key); if (i < 0) throw new Error('no setting ' + key);
  sh.getRange(2 + i, 15).setValue(value); fresh();
}
const day = k => vm.runInContext(`dateFromKey_(addDaysKey_(todayKey_(),${k}))`, g);
const key = d => vm.runInContext('toDateKey_', g)(d);
const today = () => vm.runInContext('todayKey_()', g);
function throws(fn, re) { try { fn(); return false; } catch (e) { return re ? re.test(e.message) : true; } }
function snap(row) { return JSON.parse(cell(LM(), 'AI' + row)); }

section('Setup');
{
  const ss2 = new M.Spreadsheet(); const g2 = makeCtx(ss2);
  g2.setupWorkbookQuickTest();
  ok(ss2.getSheetByName('Lead Management').getMaxRows() === 1001, 'quick test builds 1,000 lead rows');
  ok(!g2._state.docProps.SETUP_STATE && g2._state.docProps.SETUP_ROWS === '1000', 'quick test completes in one run');
}
vm.runInContext('SETUP_BUDGET_MS = 1', g);
let runs = 0;
do { g.setupWorkbook(); runs++; } while (g._state.docProps.SETUP_STATE && runs < 20);
ok(runs === 11, 'setup resumed across ' + runs + ' runs (11 stages)');
ok(M.alerts.filter(a => /NOT finished/.test(a)).length === 10, 'each partial run says to run again');
ok(/created with 10[,.]?000 lead rows/.test(M.alerts[M.alerts.length - 1]), 'final run reports completion');
vm.runInContext('SETUP_BUDGET_MS = 270000', g);
const ALL = ['Start Here', 'Lead Management', 'Dashboard', 'Field Guide', 'Lead Entry', 'Follow-Up Log', 'Stage Master', 'Counsellor Master', 'Lists & Settings', 'Access Log', 'Deleted Leads'];
ok(ALL.every(n => ss.getSheetByName(n)) && ss.getSheets()[0].getName() === 'Start Here', 'all 11 sheets created, Start Here first');
ok(!ss.getSheetByName('Sheet1'), 'default Sheet1 removed');
ok(['Lead Entry', 'Follow-Up Log', 'Stage Master', 'Counsellor Master', 'Lists & Settings', 'Access Log', 'Deleted Leads'].every(n => ss.getSheetByName(n).isSheetHidden()) &&
  !ss.getSheetByName('Lead Management').isSheetHidden() && !ss.getSheetByName('Field Guide').isSheetHidden(), 'admin sheets hidden, counsellor sheets visible');
ok(ss.getSheetByName('Start Here').getLastRow() <= 10, 'Start Here fits on one screen (' + ss.getSheetByName('Start Here').getLastRow() + ' lines)');
ok(LM().getMaxColumns() === 35 && LM().getMaxRows() >= 10001, 'Lead Management: exactly 35 columns, 10,000 rows');
ok(cell(LM(), 'A1') === 'Lead ID' && cell(LM(), 'AB1') === 'Lead Status' && cell(LM(), 'O1') === 'Assigned Counsellor' && cell(LM(), 'Z1') === 'Lead Source', 'lead headers in required order');
ok(/^=\{"Follow-Up Count"/.test(LM().getRange('V1').getFormula()), 'V1 header array formula');
ok(LM().isColumnHiddenByUser(35), 'Audit Snapshot hidden');
ok(ss.getSheetByName('Dashboard').charts.length === 6, 'dashboard charts = ' + ss.getSheetByName('Dashboard').charts.length);
ok(['onEditInstallable', 'onChangeInstallable', 'scheduledMaintenance', 'processQueuedFollowUps', 'onOpenInstallable'].every(h => M.triggers.some(t => t.getHandlerFunction() === h)), 'all installable triggers created');
ok(Object.keys(ss.named).length === 5, 'named ranges created');
const lmProt = () => LM().getProtections('SHEET').find(p => /^CRM:/.test(p.desc));
ok(lmProt() && lmProt().warn === false && (lmProt().unprot || []).length === 0, 'Lead Management fully protected (no lead rows yet)');
ok(['Lead Entry', 'Follow-Up Log', 'Deleted Leads', 'Field Guide', 'Start Here', 'Lists & Settings'].every(n => ss.getSheetByName(n).getProtections('SHEET').some(p => p.warn === false)), 'admin-only sheets strictly protected');
ok(ss.getSheetByName('Field Guide').getLastRow() >= 36 && cell(ss.getSheetByName('Field Guide'), 'B2') === 'Lead ID' && cell(ss.getSheetByName('Field Guide'), 'B36') === 'Audit Snapshot (system)', 'Field Guide covers all 35 columns');
ok(vm.runInContext('FIELD_DICTIONARY.length', g) === 26, 'dictionary has 26 entries (custom fields share one)');
const dvRule = a1 => JSON.stringify(LM().getRange(a1).getDataValidation(), (k, v) => (v && typeof v === 'object' && v.sh ? 'range:' + v.sh.name : v));
ok(/requireDateBetween/.test(dvRule('T5')) && /setAllowInvalid",\[false\]/.test(dvRule('T5')), 'Next Follow-Up Date: date picker rule that rejects');
ok(['C5', 'D5', 'O5', 'P5', 'R5', 'U5', 'Y5', 'Z5', 'AB5'].every(a => /setAllowInvalid",\[false\]/.test(dvRule(a))), 'every validated column rejects invalid values');
let bad = 0;
for (const [where, f] of M.formulas) {
  let depth = 0, brace = 0, inQ = false, inS = false;
  for (let i = 0; i < f.length; i++) {
    const ch = f[i];
    if (inQ) { if (ch === '"') { if (f[i + 1] === '"') i++; else inQ = false; } continue; }
    if (inS) { if (ch === "'") inS = false; continue; }
    if (ch === '"') inQ = true; else if (ch === "'") inS = true;
    else if (ch === '(') depth++; else if (ch === ')') depth--;
    else if (ch === '{') brace++; else if (ch === '}') brace--;
    if (depth < 0 || brace < 0) break;
  }
  if (depth || brace || inQ || inS || !f.startsWith('=')) { bad++; console.log('  bad formula @' + where + ': ' + f.slice(0, 200)); }
}
ok(bad === 0, 'all ' + M.formulas.length + ' written formulas are balanced');

section('Custom fields');
as('admin@example.com', 'TKA');
ok([5, 6, 7, 8, 9, 10, 11, 12, 13, 14].every(c => LM().isColumnHiddenByUser(c)), 'all 10 custom slots hidden after setup');
M.prompts.push('Course Interested'); fresh(); g.addCustomField();
ok(!LM().isColumnHiddenByUser(5) && cell(LM(), 'E1') === 'Course Interested' && cell(LS_(), 'AB2') === 'Yes', 'Add custom field uses slot 1, shows column E');
ok(cell(LE(), 'D1') === 'Course Interested' && !LE().isColumnHiddenByUser(4) && LE().isColumnHiddenByUser(5), 'Lead Entry shows the same custom fields');
LS_().getRange('AC2').setValue('MBA, BBA, BCom'); edit('Lists & Settings', 'AC2', undefined);
ok(/MBA","BBA","BCom/.test(dvRule('E5')), 'Allowed Values turn the custom column into a dropdown');
M.prompts.push('Lead Source'); fresh(); g.addCustomField();
ok(cell(LS_(), 'AB3') === 'No' && M.alerts.some(a => /already a column name/.test(a)), 'duplicate field name rejected');

section('Lead Entry (admin adds leads)');
const cm = ss.getSheetByName('Counsellor Master');
cm.getRange('C2').setValue('caller1@example.com'); cm.getRange('C3').setValue('caller2@example.com');
const entryRow = (name, mobile, email, course, owner, source, prio, remarks) => [name, mobile, email, course || '', '', '', '', '', '', '', '', '', '', owner || '', source || '', prio || '', remarks || ''];
LE().getRange('A2:Q8').setValues([
  entryRow('Ravi Kumar', '98765 43210', '', 'MBA', 'Sample Counsellor 1', 'Website', 'Hot', 'from web'),
  entryRow('Bad Mobile', '12345', '', '', 'Sample Counsellor 1'),
  entryRow('', '', '', '', '', '', '', ''),
  entryRow('', '9123456780', '', '', 'Sample Counsellor 1'),
  entryRow('Asha', '9876543210', 'asha@example', '', 'Sample Counsellor 2'),
  entryRow('Wrong Owner', '9000000001', '', 'PhD', 'Nobody'),
  entryRow('Asha Two', '9876543211', 'asha@example.com', 'BBA', 'Sample Counsellor 2', 'Referral')
]);
as('caller1@example.com', 'TK1');
fresh(); ok(throws(() => g.addLeadsFromEntry(), /administrators/i), 'a counsellor cannot add leads');
as('admin@example.com', 'TKA');
fresh(); g.addLeadsFromEntry();
ok(cell(LM(), 'A2') === 'LD-000001' && cell(LM(), 'C2') === '9876543210' && cell(LM(), 'E2') === 'MBA' && cell(LM(), 'O2') === 'Sample Counsellor 1', 'valid row created: ID, cleaned mobile, custom field, counsellor');
ok(cell(LM(), 'P2') === 'New Lead' && cell(LM(), 'Q2') === 'Not Contacted' && cell(LM(), 'AB2') === 'Open' && cell(LM(), 'AA2') instanceof Date && cell(LM(), 'AE2') instanceof Date && cell(LM(), 'Y2') === 'from web', 'defaults, created / assigned dates and remarks');
ok(snap(2).v && snap(2).v['3'] === '9876543210', 'full snapshot written for the new lead');
ok(cell(LM(), 'A3') === 'LD-000002' && cell(LM(), 'B3') === 'Asha Two' && cell(LM(), 'A4') === '', 'only valid rows created (2 of 6)');
const entry = LE().getRange('A2:T8').getValues();
ok(entry[0][17] === 'Error' && entry[0][0] === 'Bad Mobile' && /Mobile number must be 10 digits/.test(entry[0][18]), 'invalid mobile stays with a plain-English message');
ok(entry.some(r => r[17] === 'Error' && /Lead Name cannot be empty/.test(r[18])), 'missing name refused');
ok(entry.some(r => r[17] === 'Error' && /not a valid email/.test(r[18])), 'bad email refused');
ok(entry.some(r => r[17] === 'Error' && /not an active counsellor/.test(r[18]) && /not allowed in Course Interested/.test(r[18])), 'unknown counsellor and value outside Allowed Values refused');
ok(entry.filter(r => r[17] === 'Created').length === 2 && entry.some(r => r[17] === 'Created' && r[19] === 'LD-000001' && r[0] === ''), 'created rows cleared, with Result / Lead ID');
ok(logRows().filter(r => r[5] === 'Lead Created').length === 2, 'Lead Created log entries');
ok((lmProt().unprot || []).length > 0 && lmProt().unprot.every(r => r.r === 2 && r.nr === 2), 'protection opened for counsellor columns of rows 2-3 only');
// fix the bad rows and add duplicates
LE().getRange('A2:Q2').setValues([entryRow('Bad Mobile', '9988776655', '', '', 'Sample Counsellor 1')]);
LE().getRange('A3:Q3').setValues([entryRow('Dup Ravi', '+91 98765 43210', '', '', 'Sample Counsellor 1')]);
LE().getRange('A4:Q5').setValues([entryRow('', '', '', ''), entryRow('', '', '', '')]);
fresh(); g.addLeadsFromEntry();
ok(cell(LM(), 'B4') === 'Bad Mobile' && LE().getRange('A2:T6').getValues().some(r => r[17] === 'Error' && /must be 10 digits/.test(r[18]) && r[0] === 'Dup Ravi'), 'fixed row created; +91 number refused by the 10-digit pattern');
LE().getRange('A2:Q6').setValues(Array(5).fill(entryRow('', '', '')));
setSetting('Duplicate Mobile Check', 'Block');
LE().getRange('A2:Q3').setValues([entryRow('Dup Ravi', '9876543210', '', '', 'Sample Counsellor 1'), entryRow('Dup In Batch', '9988776655', '')]);
fresh(); g.addLeadsFromEntry();
ok(LE().getRange('A2:T3').getValues().every(r => r[17] === 'Error' && /already belongs to/.test(r[18])), 'Duplicate Mobile Check = Block refuses duplicates');
setSetting('Duplicate Mobile Check', 'Warn');
LE().getRange('A2:T3').setValues(Array(2).fill(Array(20).fill('')));
LE().getRange('A2:Q2').setValues([entryRow('Warned Dup', '9876543210', '', '', 'Sample Counsellor 2')]);
fresh(); g.addLeadsFromEntry();
ok(cell(LM(), 'B5') === 'Warned Dup' && /also used by LD-000001/.test(cell(LE(), 'S2')), 'Warn creates the lead with a note');
ok(/Duplicate mobile/.test(cell(LM(), 'AH2')) && /Duplicate mobile/.test(cell(LM(), 'AH5')), 'duplicate flagged in Data Quality Flags');

section('Careless counsellor in Lead Management');
as('caller1@example.com', 'TK1');
const before = () => logRows().length;
let n0 = before();
edit('Lead Management', 'T2', 'tomorrow', '');
ok(cell(LM(), 'T2') === '' && /must be a real date/.test(lastToast()), 'text in a date cell is undone with a message');
ok(logRows().length === n0 + 1 && logRows().pop()[5] === 'Edit Reverted', 'reverted attempt logged (who / what / old / new)');
edit('Lead Management', 'T2', day(-3), '');
ok(cell(LM(), 'T2') === '' && /cannot be in the past/.test(lastToast()), 'past follow-up date refused');
edit('Lead Management', 'T2', day(400), '');
ok(cell(LM(), 'T2') === '' && /within 365 days/.test(lastToast()), 'follow-up date too far ahead refused');
// skipping Next Follow-Up after a call: outcome changed, no date
edit('Lead Management', 'U2', 'Not Connected', '');
ok(cell(LM(), 'U2') === 'Not Connected' && /^Incomplete: Next Follow-Up Date/.test(cell(LM(), 'AH2')), 'outcome without a new follow-up date: row marked Incomplete');
ok(!logRows().some(r => r[1] === 'LD-000001' && r[12] === 'Contact'), 'incomplete update is not counted as a follow-up yet');
ok(/incomplete/i.test(M.toasts.slice(-1)[0]), 'counsellor told what is missing');
edit('Lead Management', 'T2', day(1), '');
ok(key(cell(LM(), 'T2')) === key(day(1)) && !/Incomplete/.test(cell(LM(), 'AH2')), 'setting the date completes the lead');
ok(logRows().some(r => r[1] === 'LD-000001' && r[12] === 'Contact' && r[5] === 'Sheet Update' && r[6] === 'Not Connected'), 'the earlier outcome change now counts as a follow-up');
ok(key(cell(LM(), 'S2')) === today() && cell(LM(), 'W2') === 'Sample Counsellor 1', 'last contact date and Last Updated By filled');
n0 = before();
edit('Lead Management', 'P2:U2', [['xyz', 'abc', 'Super', 'yesterday', 'junk', 'Whatever']]);
ok(cell(LM(), 'P2') === 'New Lead' && cell(LM(), 'Q2') === 'Not Contacted' && cell(LM(), 'R2') === 'Hot' && cell(LM(), 'S2') instanceof Date &&
  key(cell(LM(), 'T2')) === key(day(1)) && cell(LM(), 'U2') === 'Not Connected', 'junk pasted over six columns: every cell put back');
ok(logRows().length - n0 >= 6 && logRows().slice(n0).every(r => r[5] === 'Edit Reverted'), 'each reverted cell logged');
ok(dvRule('R2').includes('requireValueInRange'), 'dropdown restored after the paste replaced it');
edit('Lead Management', 'P2', '', 'New Lead');
ok(cell(LM(), 'P2') === 'New Lead' && /cannot be emptied/.test(lastToast()), 'clearing a dropdown cell is undone');
edit('Lead Management', 'R2', '', 'Hot');
ok(cell(LM(), 'R2') === 'Hot', 'clearing priority undone');
edit('Lead Management', 'C2', '1111111111', '9876543210');
ok(cell(LM(), 'C2') === '9876543210' && /Only an admin/.test(lastToast()), 'typing in a locked column (mobile) undone');
edit('Lead Management', 'W2', 'me', 'Sample Counsellor 1');
ok(cell(LM(), 'W2') === 'Sample Counsellor 1' && /filled automatically/.test(lastToast()), 'system column edit undone ("This field is filled automatically")');
edit('Lead Management', 'A2', '', 'LD-000001');
ok(cell(LM(), 'A2') === 'LD-000001', 'clearing the Lead ID undone');
edit('Lead Management', 'V2', 5);
ok(cell(LM(), 'V2') === '', 'typing in a formula column removed');
edit('Lead Management', 'B10', 'New guy');
ok(cell(LM(), 'B10') === '' && /Lead Entry/.test(lastToast()), 'typing in an empty row removed ("add leads in Lead Entry")');
edit('Lead Management', 'A20:D21', [['LD-999', 'X', '9999999999', 'x@y.com'], ['', 'Y', '1', '']]);
ok(LM().getRange('A20:D21').getValues().every(r => r.every(v => v === '')), 'adding a lead directly in Lead Management removed');
edit('Lead Management', 'P3', 'Interested', 'New Lead');
ok(cell(LM(), 'P3') === 'New Lead' && cell(LM(), 'Q3') === 'Not Contacted' && /assigned to Sample Counsellor 2/.test(lastToast()), "editing another counsellor's lead undone (substage restored too)");
typeFormula('Y2', '=1+1');
ok(cell(LM(), 'Y2') === 'from web' && LM().getRange('Y2').getFormula() === '', 'formula typed in remarks undone');
edit('Lead Management', 'Y2', 'x'.repeat(600), 'from web');
ok(cell(LM(), 'Y2') === 'from web' && /at most 500/.test(lastToast()), 'remarks longer than the limit refused');
edit('Lead Management', 'AB2', 'Converted', 'Open');
ok(cell(LM(), 'AB2') === 'Open' && /only when Lead Stage is "Converted"/.test(lastToast()), 'Status Converted without the Converted stage refused');
// fill-down over own and another counsellor's lead
edit('Lead Management', 'P2:P3', [['Interested'], ['Interested']]);
ok(cell(LM(), 'P2') === 'Interested' && cell(LM(), 'Q2') === '' && cell(LM(), 'P3') === 'New Lead', 'fill-down: own lead changed, other lead undone');
ok(/Incomplete: Lead Substage/.test(cell(LM(), 'AH2')), 'new stage without a substage: Incomplete');
ok(logRows().some(r => r[1] === 'LD-000001' && r[5] === 'Stage Updated' && r[14] === 'New Lead' && r[15] === 'Interested'), 'stage change audited old -> new');
edit('Lead Management', 'Q2', 'Payment Pending', '');
ok(cell(LM(), 'Q2') === '' && /not a substage of "Interested"/.test(lastToast()), 'substage of another stage refused');
edit('Lead Management', 'Q2', 'Details Shared', '');
ok(cell(LM(), 'Q2') === 'Details Shared' && !/Incomplete/.test(cell(LM(), 'AH2')), 'valid substage completes the lead');
// undo: the previous value comes back through an edit event
edit('Lead Management', 'P2', 'New Lead', 'Interested');
ok(cell(LM(), 'P2') === 'New Lead' && cell(LM(), 'Q2') === '' && logRows().some(r => r[1] === 'LD-000001' && r[5] === 'Stage Updated' && r[14] === 'Interested' && r[15] === 'New Lead'), 'undo is accepted as a normal, audited change');
edit('Lead Management', 'Q2', 'Not Contacted', '');
// stage <-> status rules
edit('Lead Management', 'P2', 'Converted', 'New Lead');
ok(cell(LM(), 'AB2') === 'Converted', 'moving to the Converted stage sets status Converted');
edit('Lead Management', 'P2', 'Interested', 'Converted');
ok(cell(LM(), 'AB2') === 'Open', 'leaving the Converted stage sets status back to Open');
edit('Lead Management', 'Q2', 'Highly Interested', '');
// unknown editor
as('stranger@gmail.com', 'TK-unregistered', true);
edit('Lead Management', 'R2', 'Cold', 'Hot');
ok(cell(LM(), 'R2') === 'Hot' && /does not know who you are/.test(lastToast()), 'edit by an unidentified user undone (setting: Block Edits From Unknown Users)');

section('Admin and owner in Lead Management');
as('admin@example.com', 'TKA');
edit('Lead Management', 'C2', '98765-12345', '9876543210');
ok(cell(LM(), 'C2') === '9876512345' && logRows().some(r => r[5] === 'Field Updated' && r[13] === 'Mobile Number' && r[14] === '9876543210' && r[15] === '9876512345'), 'admin edits a contact field: cleaned and audited old/new');
edit('Lead Management', 'C2', 'abc', '9876512345');
ok(cell(LM(), 'C2') === '9876512345' && /numbers only/.test(lastToast()), 'admin typing letters in Mobile refused');
edit('Lead Management', 'O3', 'Sample Counsellor 1', 'Sample Counsellor 2');
ok(cell(LM(), 'AF3') === 'Sample Counsellor 2' && logRows().some(r => r[5] === 'Lead Assigned' && r[1] === 'LD-000002'), 'admin reassigns: Previous Counsellor + audit');
edit('Lead Management', 'AA2', day(-100), cell(LM(), 'AA2'));
ok(key(cell(LM(), 'AA2')) === today() && /filled automatically/.test(lastToast()), 'owner/admin cannot change Lead Created Date');
fresh(); g.allowSystemCorrection();
edit('Lead Management', 'AF2', 'Old Counsellor', '');
ok(cell(LM(), 'AF2') === 'Old Counsellor' && logRows().some(r => r[5] === 'System Field Corrected' && r[15] === 'Old Counsellor'), 'correction window: admin may fix a system column (logged)');
edit('Lead Management', 'A2', 'LD-7', 'LD-000001');
ok(cell(LM(), 'A2') === 'LD-000001', 'even in the window the Lead ID stays');
g._state.docProps.SYS_CORRECTION = JSON.stringify({ until: Date.now() - 1, by: 'x' });
edit('Lead Management', 'AF2', 'Again', 'Old Counsellor');
ok(cell(LM(), 'AF2') === 'Old Counsellor', 'after 10 minutes system columns are locked again');
edit('Lead Management', 'A1', 'ID', 'Lead ID');
ok(cell(LM(), 'A1') === 'Lead ID', 'header row restored');

section('Column layout (onChange)');
LM().insertColumnsBefore(4, 1);
fresh(); g.onChangeInstallable({ changeType: 'INSERT_COLUMN' });
ok(LM().getMaxColumns() === 35 && cell(LM(), 'D1') === 'Email ID', 'empty inserted column removed automatically');
LM().getRange('B1:C1').setValues([['Mobile Number', 'Lead Name']]);
fresh(); g.onChangeInstallable({ changeType: 'OTHER' });
ok(g._state.docProps.LAYOUT_BROKEN === '1' && logRows().some(r => r[13] === 'Lead Management columns'), 'moved columns detected and logged');
edit('Lead Management', 'T2', 'junk', '');
ok(cell(LM(), 'T2') === 'junk' && /paused/.test(lastToast()), 'CRM pauses (makes no changes) while the layout is wrong');
LM().getRange('B1:C1').setValues([['Lead Name', 'Mobile Number']]);
fresh(); g.onChangeInstallable({ changeType: 'OTHER' });
ok(!g._state.docProps.LAYOUT_BROKEN, 'layout OK again after undo');
fresh(); g.recheckAllLeads();
ok(key(cell(LM(), 'T2')) === key(day(1)), 'Admin > Re-check all lead rows puts back the junk typed while paused');

section('Follow-up form');
as('caller1@example.com', 'TK1');
fresh(); const fctx = g.getFollowUpContext();
ok(fctx.canSave && fctx.actor.name === 'Sample Counsellor 1' && fctx.outcomes.length > 5, 'counsellor can use the form');
const base = { leadId: 'LD-000001', outcome: 'Interested', stage: 'Interested', substage: 'Highly Interested', nextFollowUp: '', remarks: 'Asked for fees' };
fresh(); let res = g.submitFollowUp(Object.assign({}, base, { submissionId: 'F1' }));
ok(!res.ok && res.errors.join().includes('next follow-up date'), 'form refuses to save without Next Follow-Up Date');
fresh(); res = g.submitFollowUp(Object.assign({}, base, { submissionId: 'F1', substage: '', nextFollowUp: key(day(2)) }));
ok(!res.ok && res.errors.join().includes('substage'), 'form refuses to save without a substage');
fresh(); res = g.submitFollowUp(Object.assign({}, base, { submissionId: 'F1', remarks: '', nextFollowUp: key(day(2)) }));
ok(!res.ok && res.errors.join().includes('remark'), 'form refuses to save without remarks');
fresh(); res = g.submitFollowUp(Object.assign({}, base, { leadId: 'LD-000004', submissionId: 'F1', nextFollowUp: key(day(2)) }));
ok(!res.ok && /only update your own/.test(res.errors.join()), "form refuses another counsellor's lead");
n0 = before();
fresh(); res = g.submitFollowUp(Object.assign({}, base, { submissionId: 'F2', nextFollowUp: key(day(2)) }));
ok(res.ok && res.queued, 'counsellor save accepted (queued for the owner) ' + JSON.stringify(res.errors || ''));
ok(cell(LM(), 'U2') === 'Interested' && cell(LM(), 'Q2') === 'Highly Interested' && key(cell(LM(), 'T2')) === key(day(2)) && cell(LM(), 'Y2') === 'Asked for fees', 'white cells written at once');
ok(logRows().length === n0, 'log entry waits for the owner trigger');
fresh(); res = g.submitFollowUp(Object.assign({}, base, { submissionId: 'F2', nextFollowUp: key(day(2)) }));
ok(!res.ok && res.duplicate, 'double click / resubmission blocked');
fresh(); g.processQueuedFollowUps();
let rows = logRows();
ok(rows.length > n0 && rows.some(r => r[1] === 'LD-000001' && r[5] === 'Outbound Call' && r[12] === 'Contact' && r[3] === 'Sample Counsellor 1' && r[6] === 'Interested'), 'queue writes the follow-up to Follow-Up Log');
ok(!rows.slice(n0).some(r => r[5] === 'Stage Updated'), 'no stage change logged (stage unchanged)');
ok(cell(LM(), 'X2') instanceof Date && cell(LM(), 'W2') === 'Sample Counsellor 1' && snap(2).v['21'] === 'Interested' && !/Incomplete/.test(cell(LM(), 'AH2')), 'system columns and snapshot updated by the owner');
n0 = before();
edit('Lead Management', 'R2', 'Warm', 'Hot');
ok(logRows().length === n0 + 1 && logRows().pop()[13] === 'Lead Priority', 'a later sheet edit is not mistaken for the form save');
as('admin@example.com', 'TKA');
n0 = before();
fresh(); res = g.submitFollowUp({ submissionId: 'A1', leadId: 'LD-000002', outcome: 'Converted', stage: 'Converted', substage: 'Successfully Converted', nextFollowUp: '', remarks: 'Paid' });
ok(res.ok && !res.queued && cell(LM(), 'AB3') === 'Converted' && cell(LM(), 'T3') === '', 'admin save written at once; Converted stage closes the lead (no next date needed)');
ok(logRows().slice(n0).some(r => r[13] === 'Lead Status' && r[15] === 'Converted' && r[12] === 'System'), 'conversion logged');

section('My overdue follow-ups');
as('admin@example.com', 'TKA');
LM().getRange('T5').setValue(day(-2));   // simulate a follow-up that became overdue
LM().getRange('AI5').setValue(JSON.stringify(Object.assign(snap(5), { n: key(day(-2)), v: Object.assign(snap(5).v, { 20: { d: day(-2).getTime() } }) })));
as('caller2@example.com', 'TK2');
fresh(); const mine = g.getMyFollowUps();
ok(mine.ok && mine.items.some(i => i.id === 'LD-000004' && i.overdue) && mine.items.every(i => i.owner === 'Sample Counsellor 2'), 'counsellor sees only their own due / overdue leads');

section('Delete, restore, purge');
as('caller1@example.com', 'TK1');
fresh(); ok(throws(() => g.deleteLeads(), /administrators/i), 'a counsellor cannot delete leads');
as('admin@example.com', 'TKA');
const leadsBefore = vm.runInContext('countLeads_()', g);
M.prompts.push('LD-000003, LD-404'); M.confirms.push('YES'); M.prompts.push('');
fresh(); g.deleteLeads();
ok(vm.runInContext('countLeads_()', g) === leadsBefore && M.alerts.some(a => /reason is required/.test(a)), 'no reason: nothing deleted');
M.prompts.push('LD-000003, LD-404'); M.confirms.push('YES'); M.prompts.push('Duplicate entry');
fresh(); g.deleteLeads();
const DL = ss.getSheetByName('Deleted Leads');
ok(vm.runInContext('countLeads_()', g) === leadsBefore - 1 && !vm.runInContext("findLeadRow_(getSheet_(SHEET.LEADS),'LD-000003')", g), 'lead removed from Lead Management');
ok(cell(DL, 'D2') === 'LD-000003' && cell(DL, 'B2') === 'admin@example.com' && cell(DL, 'C2') === 'Duplicate entry' && cell(DL, 'A2') instanceof Date, 'moved to Deleted Leads with Deleted By / At / Reason');
ok(logRows().some(r => r[1] === 'LD-000003' && r[5] === 'Lead Deleted' && r[10] === 'Duplicate entry') && logRows().some(r => r[1] === 'LD-000003' && r[5] === 'Lead Created'), 'Lead Deleted entry written; history kept');
fresh(); g.refreshDashboard();
const lay = JSON.parse(g._state.docProps.DASH_LAYOUT);
const kpi = name => { const c = lay.cards[name]; return ss.getSheetByName('Dashboard').getRange(c[0], c[1]).getValue(); };
ok(kpi('Total Leads') === leadsBefore - 1, 'deleted lead excluded from dashboard counts');
M.prompts.push('LD-000003'); M.confirms.push('YES');
fresh(); g.restoreDeletedLead();
const back = vm.runInContext("findLeadRow_(getSheet_(SHEET.LEADS),'LD-000003')", g);
ok(back && cell(LM(), 'B' + back) === 'Bad Mobile' && DL.getLastRow() === 1 && logRows().some(r => r[5] === 'Lead Restored'), 'restored with its original Lead ID');
M.prompts.push('LD-000003'); M.confirms.push('YES'); M.prompts.push('Test');
fresh(); g.deleteLeads();
M.prompts.push('LD-000003'); M.confirms.push('YES'); M.prompts.push('purge');
fresh(); g.purgeDeletedLead();
ok(DL.getLastRow() === 2 && M.alerts.some(a => /Not confirmed/.test(a)), 'purge needs the exact second confirmation');
M.prompts.push('LD-000003'); M.confirms.push('YES'); M.prompts.push('PURGE');
fresh(); g.purgeDeletedLead();
ok(DL.getLastRow() < 2 && logRows().some(r => r[1] === 'LD-000003' && r[5] === 'Lead Purged'), 'purged permanently and logged');

section('Dashboard');
as('admin@example.com', 'TKA');
const rowOf = id => vm.runInContext("findLeadRow_(getSheet_(SHEET.LEADS),'" + id + "')", g);
edit('Lead Management', 'T' + rowOf('LD-000001'), day(0), day(2));
edit('Lead Management', 'U' + rowOf('LD-000001'), 'Busy', 'Interested');   // a new outcome but no new follow-up date: incomplete
fresh(); g.refreshDashboard();
ok(kpi('Incomplete Leads') === 1, 'Incomplete Leads KPI');
const D = ss.getSheetByName('Dashboard');
const cnsRow = [0, 1, 2].map(i => D.getRange(lay.counsellor.data + i, 2, 1, 11).getValues()[0]).find(r => r[0] === 'Sample Counsellor 1');
ok(cnsRow && cnsRow[10] === 1, 'Incomplete Leads per counsellor');
ok(kpi('Follow-Ups Completed') >= 2 && kpi('Unique Leads Contacted') >= 1, 'follow-ups counted (form + completed sheet update)');
as('caller1@example.com', 'TK1');
D.getRange('I5').setValue('old');
fresh(); g.refreshDashboard();
ok(D.getRange('I5').getValue() === 'old' && /within a minute/.test(lastToast()), 'counsellor refresh is handed to the owner trigger');
fresh(); g.processQueuedFollowUps();
ok(D.getRange('I5').getValue() instanceof Date, 'owner trigger refreshed the dashboard');

section('Admin sheets and settings');
fresh(); ok(throws(() => g.showAdminSheets(), /administrators/i), 'a counsellor cannot show admin sheets');
as('admin@example.com', 'TKA');
fresh(); g.showAdminSheets();
ok(!ss.getSheetByName('Lead Entry').isSheetHidden(), 'admin shows admin sheets');
fresh(); g.hideAdminSheets();
ok(ss.getSheetByName('Lead Entry').isSheetHidden(), 'and hides them again');
const editCol = LS_().getRange('AE1:AE9').getValues().map(r => r[0]);
ok(editCol[0] === 'Counsellor-Editable Fields' && editCol.includes('Lead Stage') && editCol.includes('All Custom Fields'), 'Counsellor-Editable Fields list in Lists & Settings');
const idx = editCol.indexOf('Lead Remarks');
LS_().getRange('AE' + (idx + 1)).setValue(''); edit('Lists & Settings', 'AE' + (idx + 1), undefined);
as('caller1@example.com', 'TK1');
edit('Lead Management', 'Y2', 'changed', 'Asked for fees');
ok(cell(LM(), 'Y2') === 'Asked for fees' && /Only an admin/.test(lastToast()), 'removing Lead Remarks from the list locks it for counsellors');
as('admin@example.com', 'TKA');
LS_().getRange('AE' + (idx + 1)).setValue('Lead Remarks'); edit('Lists & Settings', 'AE' + (idx + 1), undefined);

section('Counsellor web app (optional)');
const ID_URL = 'https://script.google.com/macros/s/IDENTITY/exec', SECRET = 'test-secret-123';
g._state.scriptProps.IDENTITY_URL = ID_URL; g._state.scriptProps.IDENTITY_SECRET = SECRET;
const AL = () => { const a = ss.getSheetByName('Access Log'); return a.getLastRow() < 2 ? [] : a.getRange(2, 1, a.getLastRow() - 1, 7).getValues(); };
function signIn(email, lead) {
  const c = M.makeGlobals(new M.Spreadsheet());
  c._state.scriptProps.IDENTITY_SECRET = SECRET; c._state.scriptProps.MAIN_APP_URL = 'https://script.google.com/macros/s/MAIN/exec';
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(dir, '..', 'identity-app', 'Identity.gs'), 'utf8'), c, { filename: 'Identity.gs' });
  M.setUser(email, 'TK-ID');
  const html = c.doGet({ parameter: lead ? { lead } : {} }).__msg;
  M.setUser('', 'TK-VISITOR');
  const m = /href="([^"]+\?t=([^"&]+)[^"]*)"/.exec(html);
  return m ? decodeURIComponent(m[2]) : null;
}
function openApp(params) { fresh(); const out = g.doGet({ parameter: params }); return typeof out.__msg === 'string' ? { page: out.__msg } : JSON.parse(out.__tpl.boot); }
M.setUser('', 'TK-VISITOR');
let page = openApp({});
ok(page.page && /Sign in with Google/.test(page.page), 'visitor without a session is sent to the sign-in app');
page = openApp({ t: signIn('stranger@yahoo.com') });
ok(page.page && /Access denied/.test(page.page) && AL().some(r => r[1] === 'stranger@yahoo.com' && r[3] === 'Access Denied'), 'unlisted Google account denied and logged');
let tok = signIn('caller1@example.com', 'LD-000001');
let boot = openApp({ t: tok, lead: 'LD-000001' });
ok(/^[a-f0-9]{64}$/.test(boot.sid), 'valid token opens a session');
ok(openApp({ t: tok }).page && /expired|already used/.test(openApp({ t: tok }).page), 'sign-in token cannot be reused');
const S1 = boot.sid;
fresh(); const list = g.portalListLeads(S1, 'all', '');
ok(list.leads.length >= 1 && list.leads.every(l => l.owner === 'Sample Counsellor 1'), 'counsellor sees only own leads');
fresh(); let sv = g.portalSaveLead(S1, 'LD-000001', { MOBILE: '9999999999' });
ok(!sv.ok && /cannot be changed/.test(sv.errors[0]), 'locked field (mobile) refused by the server');
fresh(); sv = g.portalSaveLead(S1, 'LD-000001', { NEXT_FU: key(day(-1)) });
ok(!sv.ok && /past/.test(sv.errors[0]), 'web app uses the same date rules');
fresh(); sv = g.portalSaveLead(S1, 'LD-000001', { PRIORITY: 'Critical', CUSTOM_1: 'BBA' });
ok(sv.ok && cell(LM(), 'R2') === 'Critical' && cell(LM(), 'E2') === 'BBA', 'allowed fields saved');
fresh(); sv = g.portalSaveLead(S1, 'LD-000001', { CUSTOM_1: 'PhD' });
ok(!sv.ok && /not allowed/.test(sv.errors[0]), 'custom field outside Allowed Values refused');
fresh(); sv = g.portalSaveLead(S1, 'LD-000001', { STAGE: 'Contacted' });
ok(sv.ok && cell(LM(), 'P2') === 'Contacted' && cell(LM(), 'Q2') === '' && /Incomplete/.test(cell(LM(), 'AH2')), 'web app stage change clears substage and marks Incomplete');
fresh(); res = g.portalSubmitFollowUp(S1, { submissionId: 'W1', leadId: 'LD-000001', outcome: 'Call Back', stage: 'Contacted', substage: 'Call Back Requested', nextFollowUp: key(day(3)), remarks: 'later' });
ok(res.ok && !/Incomplete/.test(cell(LM(), 'AH2')) && AL().some(r => r[3] === 'Follow-Up Logged'), 'web app follow-up completes the lead and is logged');
fresh(); let threw = false; try { g.portalGetLead(S1, 'LD-000004'); } catch (e) { threw = /not assigned to you/.test(e.message); }
ok(threw, "web app refuses another counsellor's lead");
cm.getRange('F2').setValue('Inactive');
fresh(); threw = false; try { g.portalListLeads(S1, 'all', ''); } catch (e) { threw = /ACCESS_DENIED/.test(e.message); }
ok(threw, 'inactive counsellor is refused on the next request');
cm.getRange('F2').setValue('Active');

section('Identity, maintenance, repair');
as('caller1@example.com', 'TK1');
edit('Lead Management', 'R2', 'Warm', 'Critical');
ok(cell(LM(), 'W2') === 'Sample Counsellor 1', 'editor identified via the temporary-key hand-off');
fresh(); g.onOpen({}); fresh(); g.onOpenInstallable({ user: { getEmail: () => '' } });
ok(AL().some(r => r[3] === 'Spreadsheet Opened' && r[1] === 'caller1@example.com'), 'spreadsheet open logged');
as('admin@example.com', 'TKA');
fresh(); g.scheduledMaintenance(); ok(true, 'hourly maintenance ran');
fresh(); g.runHealthCheck();
const hc = M.alerts[M.alerts.length - 1];
ok(/OK    Edit guard trigger installed/.test(hc) && /OK    Lead Management columns are in the expected order/.test(hc) && /OK    Admin sheets hidden/.test(hc), 'health check passes the new checks');
setSetting('Email Reminders Enabled', 'Yes');
fresh(); ok(g.sendFollowUpReminders() >= 1, 'reminder emails include incomplete / overdue leads');
setSetting('Email Reminders Enabled', 'No');
const leadCount = vm.runInContext('countLeads_()', g);
fresh(); g.setupWorkbook();
ok(vm.runInContext('countLeads_()', g) === leadCount && cell(LM(), 'A2') === 'LD-000001' && cell(LM(), 'E1') === 'Course Interested' && logRows().length > 10, 'repair keeps leads, custom fields and log');
ok(snap(2).v && !/Incomplete/.test(cell(LM(), 'AH2')), 'repair rebuilds snapshots without losing state');

section('Upgrade from version 1');
{
  const ss3 = new M.Spreadsheet(); const g3 = makeCtx(ss3);
  const old = ss3.insertSheet('Lead Management', 0); old.maxCols = 40; old.maxRows = 1001;
  const oldHeaders = ['Lead ID','Lead Name','Mobile Number','Email ID','Assigned Counsellor','Lead Stage','Lead Substage','Lead Priority','Last Contact Date','Next Follow-Up Date','Last Follow-Up Outcome','Follow-Up Count','Last Updated By','Last Activity Timestamp','Lead Remarks','Lead Source','Course','Custom Field 2','Custom Field 3','Custom Field 4','Custom Field 5','Custom Field 6','Custom Field 7','Custom Field 8','Custom Field 9','Batch','Lead Created Date','Lead Status'];
  old.getRange(1, 1, 1, oldHeaders.length).setValues([oldHeaders]);
  old.getRange(2, 1, 1, 28).setValues([['LD-000001','Old Lead','9000000000','','Sample Counsellor 1','New Lead','Not Contacted','Hot','','','','','','','old remark','Website','BBA','','','','','','','','','','','Open']]);
  old.getRange(3, 1, 1, 28).setValues([['','Typed Lead','9000000001','','','','','','','','','','','','','','','','','','','','','','','','','']]);
  const s3 = ss3.insertSheet('Lists & Settings', 1); s3.maxCols = 30;
  s3.getRange('AD1:AD3').setValues([['Counsellor-Locked Fields'], ['Lead ID'], ['Mobile Number']]);
  s3.getRange('N2:O2').setValues([['Admin Emails', 'admin@example.com']]);
  g3.setupWorkbookQuickTest();
  const L3 = ss3.getSheetByName('Lead Management'), S3 = ss3.getSheetByName('Lists & Settings');
  ok(L3.getRange('E1').getValue() === 'Course' && L3.getRange('E2').getValue() === 'BBA' && L3.getRange('O2').getValue() === 'Sample Counsellor 1' && L3.getRange('Y2').getValue() === 'old remark',
    'old column layout migrated (custom fields to E:N)');
  ok(L3.getMaxColumns() === 35, 'extra columns removed');
  ok(/^LD-\d{6}$/.test(L3.getRange('A3').getValue()) && L3.getRange('AA3').getValue() instanceof Date, 'row typed before the upgrade gets a Lead ID');
  ok(JSON.parse(L3.getRange('AI2').getValue()).v['2'] === 'Old Lead', 'full snapshots built for existing leads');
  ok(S3.getRange('AD1').getValue() === '' && S3.getRange('AE1').getValue() === 'Counsellor-Editable Fields', 'old Counsellor-Locked Fields list replaced');
}
console.log('\nToasts sample:', M.toasts.slice(-4));
console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
