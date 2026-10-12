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
function fresh() { vm.runInContext('clearMemo_()', g); }
const LM = () => ss.getSheetByName('Lead Management'), LOG = () => ss.getSheetByName('Follow-Up Log');
function cell(sh, a1) { return sh.getRange(a1).getValue(); }
let currentEmail = 'admin@example.com';
// Simulates a user edit: the simple trigger (fast path) then the installable trigger (runs as owner, e.user = editor).
function edit(sheetName, a1, value, oldValue) {
  const sh = ss.getSheetByName(sheetName); const r = sh.getRange(a1);
  if (value !== undefined) { if (Array.isArray(value)) r.setValues(value); else r.setValue(value); }
  const ev = { range: r, value: Array.isArray(value) ? undefined : value, oldValue, source: ss };
  fresh(); g.onEdit(ev);
  fresh(); g.onEditInstallable(Object.assign({}, ev, { triggerUid: 't1', user: { getEmail: () => '' } }));
}
// Switch user; "registers" them as if they had used the Lead CRM menu once (authorised context).
function as(email, key, noRegister) { currentEmail = email; M.setUser(email, key || 'TK'); if (!noRegister) { fresh(); vm.runInContext('registerCurrentUser_()', g); } }
const ID_URL = 'https://script.google.com/macros/s/IDENTITY/exec', SECRET = 'test-secret-123';
function logRows() { const l = LOG(); const n = l.getLastRow(); return n < 2 ? [] : l.getRange(2, 1, n - 1, 18).getValues(); }

// ---------- quick-test setup (1,000 rows) on a separate workbook ----------
{
  const ss2 = new M.Spreadsheet(); const g2 = makeCtx(ss2);
  g2.setupWorkbookQuickTest();
  ok(ss2.getSheetByName('Lead Management').getMaxRows() === 1001, 'quick test builds 1,000 lead rows');
  ok(!g2._state.docProps.SETUP_STATE && g2._state.docProps.SETUP_ROWS === '1000', 'quick test completes in one run');
}

// ---------- resumable setup: budget forces one stage per run ----------
vm.runInContext('SETUP_BUDGET_MS = 1', g);
let runs = 0;
do { g.setupWorkbook(); runs++; } while (g._state.docProps.SETUP_STATE && runs < 20);
ok(runs === 10, 'setup resumed across ' + runs + ' runs (10 stages)');
ok(M.alerts.filter(a => /NOT finished/.test(a)).length === 9 && /continue from stage 2/.test(M.alerts.find(a => /NOT finished/.test(a))), 'each partial run says to run again');
ok(/created with 10[,.]?000 lead rows/.test(M.alerts[M.alerts.length - 1]), 'final run reports completion');
vm.runInContext('SETUP_BUDGET_MS = 270000', g);
ok(LM().getRange('Q5').getDataValidation() === null, 'no substage rules on empty rows after setup');
ok(['Lead Management', 'Follow-Up Log', 'Stage Master', 'Counsellor Master', 'Dashboard', 'Lists & Settings'].every(n => ss.getSheetByName(n)), 'all 6 sheets created');
ok(!ss.getSheetByName('Sheet1'), 'default Sheet1 removed');
ok(LM().getMaxRows() >= 10001, 'Lead Management sized for 10,000 leads');
ok(cell(LM(), 'A1') === 'Lead ID' && cell(LM(), 'AB1') === 'Lead Status' && cell(LM(), 'N1') === 'Custom Field 10' && cell(LM(), 'O1') === 'Assigned Counsellor' && cell(LM(), 'Z1') === 'Lead Source', 'lead headers in required order');
ok(/^=\{"Follow-Up Count"/.test(LM().getRange('V1').getFormula()), 'L1 header array formula');
ok(ss.getSheetByName('Stage Master').getLastRow() === 17, '16 sample stage rows');
ok(ss.getSheetByName('Dashboard').charts.length === 6, 'dashboard charts = ' + ss.getSheetByName('Dashboard').charts.length);
ok(M.triggers.some(t => t.getHandlerFunction() === 'onChangeInstallable'), 'onChange trigger installed');
ok(Object.keys(ss.named).length === 4, 'named ranges created');

// formula sanity: balanced parens/braces and quotes
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
  if (depth || brace || inQ || inS || !f.startsWith('=') || /,,\)|\(,/.test(f.replace(/IF\([^,]*="",,/g, ''))) { bad++; console.log('  bad formula @' + where + ': ' + f.slice(0, 200)); }
}
ok(bad === 0, 'all ' + M.formulas.length + ' written formulas are balanced');

// ---------- custom fields ----------
const LS_ = () => ss.getSheetByName('Lists & Settings');
ok([5,6,7,8,9,10,11,12,13,14].every(c => LM().isColumnHiddenByUser(c)), 'all 10 custom slots hidden after setup');
ok(JSON.stringify(LS_().getRange('Z2:AB3').getValues()) === JSON.stringify([[1, 'Custom Field 1', 'No'], [2, 'Custom Field 2', 'No']]), 'Custom Fields table starts inactive');
M.prompts.push('Course Interested'); fresh(); g.addCustomField();
ok(!LM().isColumnHiddenByUser(5) && cell(LM(), 'E1') === 'Course Interested' && cell(LS_(), 'AB2') === 'Yes', 'Add custom field uses slot 1, shows column E');
M.prompts.push('Lead Source'); fresh(); g.addCustomField();
ok(cell(LS_(), 'AB3') === 'No' && M.alerts.some(a => /already a column name/.test(a)), 'duplicate field name rejected');
edit('Lead Management', 'E2', 'MBA');
M.prompts.push('1'); M.confirms.push('NO'); fresh(); g.removeCustomField();
ok(!LM().isColumnHiddenByUser(5) && cell(LS_(), 'AB2') === 'Yes', 'remove cancelled when user answers No to data warning');
M.prompts.push('Course Interested'); M.confirms.push('YES'); fresh(); g.removeCustomField();
ok(LM().isColumnHiddenByUser(5) && cell(LS_(), 'AB2') === 'No' && cell(LM(), 'E2') === 'MBA', 'remove hides column, marks inactive, keeps data');
ok(M.alerts.some(a => /contains 1 value/.test(a)), 'remove warned about existing data');
M.prompts.push('City'); fresh(); g.addCustomField();
ok(cell(LS_(), 'AA3') === 'City' && cell(LS_(), 'AB3') === 'Yes' && LM().isColumnHiddenByUser(5), 'add prefers an empty free slot (slot 2)');
LS_().getRange('AA3').setValue('Home City'); edit('Lists & Settings', 'AA3', undefined);
ok(cell(LM(), 'F1') === 'Home City', 'renaming in the Custom Fields table updates the header');
LM().getRange('F1').setValue('Town'); edit('Lead Management', 'F1', undefined);
ok(cell(LS_(), 'AA3') === 'Town', 'renaming the header updates the table');

// ---------- new lead ----------
as('caller1@example.com', 'TK1');
const cm = ss.getSheetByName('Counsellor Master');
cm.getRange('C2').setValue('caller1@example.com');
edit('Lead Management', 'B2', 'Ravi Kumar');
ok(cell(LM(), 'A2') === 'LD-000001', 'Lead ID generated: ' + cell(LM(), 'A2'));
ok(cell(LM(), 'AA2') instanceof Date, 'created timestamp fixed value');
ok(cell(LM(), 'AB2') === 'Open' && cell(LM(), 'P2') === 'New Lead' && cell(LM(), 'Q2') === 'Not Contacted', 'defaults applied');
ok(cell(LM(), 'W2') === 'Sample Counsellor 1', 'Last Updated By mapped to counsellor: ' + cell(LM(), 'W2'));
let rows = logRows();
ok(rows.length === 1 && rows[0][5] === 'Lead Created' && rows[0][12] === 'System' && rows[0][0] === 'ACT-000001', 'Lead Created system entry');
const dvG = LM().getRange('Q2').getDataValidation();
ok(dvG && JSON.stringify(dvG.calls).includes('First Attempt Pending') && !JSON.stringify(dvG.calls).includes('Connected'), 'G2 dropdown = New Lead substages only');

// ---------- assignment ----------
edit('Lead Management', 'O2', 'Sample Counsellor 1', undefined);
rows = logRows();
ok(rows.length === 2 && rows[1][5] === 'Lead Assigned' && rows[1][15] === 'Sample Counsellor 1', 'Lead Assigned audit');
ok(cell(LM(), 'AE2') instanceof Date, 'Lead Assigned Date stamped');
edit('Lead Management', 'O2', 'Sample Counsellor 2', 'Sample Counsellor 1');
ok(cell(LM(), 'AF2') === 'Sample Counsellor 1', 'Previous Counsellor kept on reassignment');

// ---------- stage change: fast path (simple onEdit only) clears substage + sets new dropdown first ----------
{
  const r = LM().getRange('P2'); r.setValue('Interested');
  fresh(); g.onEdit({ range: r, value: 'Interested', oldValue: 'New Lead', source: ss });
  ok(cell(LM(), 'Q2') === '' && JSON.stringify(LM().getRange('Q2').getDataValidation().calls).includes('Highly Interested'),
    'fast path: substage cleared and new dropdown set before any logging');
  ok(!logRows().some(r => r[5] === 'Stage Updated'), 'fast path writes no log entries');
  fresh(); g.onEditInstallable({ range: r, value: 'Interested', oldValue: 'New Lead', source: ss, triggerUid: 't', user: { getEmail: () => '' } });
}
ok(cell(LM(), 'Q2') === '', 'invalid substage cleared after stage change');
rows = logRows();
ok(rows.some(r => r[5] === 'Stage Updated' && r[14] === 'New Lead' && r[15] === 'Interested'), 'Stage Updated audit old->new');
ok(rows.some(r => r[5] === 'Substage Cleared' && r[14] === 'Not Contacted'), 'Substage Cleared system entry');
const dvG2 = JSON.stringify(LM().getRange('Q2').getDataValidation().calls);
ok(dvG2.includes('Highly Interested') && !dvG2.includes('Not Contacted'), 'G2 dropdown now Interested substages');
ok(cell(LM(), 'AD2') instanceof Date, 'Last Stage Change Date stamped');
edit('Lead Management', 'Q2', 'Details Shared', '');
ok(cell(LM(), 'Q2') === 'Details Shared', 'valid substage kept');
edit('Lead Management', 'Q2', 'Payment Pending', 'Details Shared');
ok(cell(LM(), 'Q2') === '', 'typed substage from another stage cleared');

// ---------- paste block with duplicate ID ----------
edit('Lead Management', 'A3:C5', [['LD-000001', 'Dup Person', '9876543210'], ['', 'Asha', '9876543210'], ['LEGACY-9', 'Legacy', '9123456789']]);
ok(cell(LM(), 'A3') !== 'LD-000001' && /^LD-\d{6}$/.test(cell(LM(), 'A3')), 'duplicate pasted ID replaced: ' + cell(LM(), 'A3'));
ok(cell(LM(), 'A5') === 'LEGACY-9', 'unique imported ID kept');
ok(cell(LM(), 'AA5') instanceof Date && cell(LM(), 'AB5') === 'Open' && logRows().some(r => r[1] === 'LEGACY-9' && r[5] === 'Lead Created'), 'imported lead initialised + logged');
ok(M.toasts.some(t => /mobile number 9876543210 is also used/.test(t)), 'duplicate mobile warning toast');
ok(!/COUNTIF\(C2:C,C2:C\)/.test(LM().getRange('AH1').getFormula()), 'no quadratic duplicate COUNTIF in AH1');
const ids = [2, 3, 4, 5].map(r => cell(LM(), 'A' + r));
ok(new Set(ids).size === 4, 'all IDs unique: ' + ids.join(','));

// ---------- manual Lead ID edit restored ----------
edit('Lead Management', 'A2', 'HACK', 'LD-000001');
ok(cell(LM(), 'A2') === 'LD-000001', 'manual Lead ID edit reverted');

// ---------- typing in formula column ----------
edit('Lead Management', 'V2', 5);
ok(cell(LM(), 'V2') === '', 'formula column entry cleared');

// ---------- follow-ups: counsellors use the web app (runs as owner); the sidebar links to it ----------
edit('Lead Management', 'O2', 'Sample Counsellor 1', 'Sample Counsellor 2');
g._state.scriptProps.IDENTITY_URL = ID_URL; g._state.scriptProps.IDENTITY_SECRET = SECRET;
fresh();
const sideCtx = g.getFollowUpContext();
ok(sideCtx.useWebApp && sideCtx.webAppUrl === ID_URL + '?lead=LD-000001', 'counsellor sidebar links to the sign-in app: ' + sideCtx.webAppUrl);
fresh();
ok(!g.submitFollowUp({ leadId: 'LD-000001' }).ok, 'counsellor cannot write through the sidebar under strict protection');
fresh();
const SID = vm.runInContext("createPortalSession_('caller1@example.com')", g);
const ctx = g.portalInit(SID);
ok(ctx.user.name === 'Sample Counsellor 1' && ctx.stages.length === 7, 'web app context (stages=' + ctx.stages.length + ')');
ok(!ctx.activityTypes.some(a => a.type === 'Lead Created'), 'system activity types hidden from form');
g.submitFollowUp = p => g.portalSubmitFollowUp(SID, p);   // the follow-up tests below run through the web app
const today = vm.runInContext('todayKey_()', g), tomorrow = vm.runInContext('addDaysKey_(todayKey_(),1)', g);
fresh();
let res = g.submitFollowUp({ submissionId: 'S1', leadId: 'LD-000001', counsellor: 'Sample Counsellor 1', activityType: 'Outbound Call', outcome: 'Interested', stage: 'Interested', substage: 'Highly Interested', status: 'Open', nextFollowUp: tomorrow, remarks: 'Asked for fees' });
ok(res.ok, 'follow-up saved ' + JSON.stringify(res.errors || res.activityId));
ok(cell(LM(), 'U2') === 'Interested' && cell(LM(), 'Y2') === 'Asked for fees' && cell(LM(), 'Q2') === 'Highly Interested', 'lead row updated (outcome/remarks/substage)');
ok(vm.runInContext('toDateKey_', g)(cell(LM(), 'T2')) === tomorrow && vm.runInContext('toDateKey_', g)(cell(LM(), 'S2')) === today, 'next FU + last contact dates');
ok(cell(LM(), 'X2') instanceof Date && cell(LM(), 'W2') === 'Sample Counsellor 1', 'last activity timestamp + user');
fresh();
res = g.submitFollowUp({ submissionId: 'S1', leadId: 'LD-000001', counsellor: 'Sample Counsellor 1', activityType: 'Outbound Call', outcome: 'Interested', stage: 'Interested', substage: 'Highly Interested', status: 'Open', nextFollowUp: tomorrow, remarks: 'Asked for fees' });
ok(!res.ok && res.duplicate, 'resubmitting same submission ID blocked');
fresh();
res = g.submitFollowUp({ submissionId: 'S2', leadId: 'LD-000001', counsellor: 'Sample Counsellor 1', activityType: 'Outbound Call', outcome: 'Interested', stage: 'Interested', substage: 'Highly Interested', status: 'Open', nextFollowUp: tomorrow, remarks: 'Asked for fees' });
ok(!res.ok && res.duplicate, 'identical activity within 2 min blocked (fingerprint)');
fresh();
res = g.submitFollowUp({ submissionId: 'S3', leadId: 'LD-000001', counsellor: 'Sample Counsellor 1', activityType: 'WhatsApp', outcome: 'Call Back', stage: 'Interested', substage: 'Highly Interested', status: 'Open', nextFollowUp: '', remarks: 'x' });
ok(!res.ok && res.errors.join().includes('Next follow-up'), 'missing next FU rejected for open lead');
fresh();
res = g.submitFollowUp({ submissionId: 'S4', leadId: 'LD-000001', counsellor: 'Sample Counsellor 1', activityType: 'WhatsApp', outcome: 'Call Back', stage: 'Payment', substage: 'Highly Interested', status: 'Open', nextFollowUp: tomorrow, remarks: 'x' });
ok(!res.ok && res.errors.join().includes('does not belong'), 'invalid stage/substage combination rejected');

// Sort simulation: move lead LD-000001 from row 2 to row 6, then log against it
const r2 = LM().getRange(2, 1, 1, 35).getValues(); const r5 = LM().getRange(5, 1, 1, 35).getValues();
LM().getRange(6, 1, 1, 35).setValues(r2); LM().getRange(2, 1, 1, 35).setValues(r5); LM().getRange(5, 1, 1, 35).setValues(LM().getRange(10, 1, 1, 35).getValues());
fresh();
res = g.submitFollowUp({ submissionId: 'S5', leadId: 'LD-000001', counsellor: 'Sample Counsellor 1', activityType: 'Inbound Call', outcome: 'Converted', stage: 'Converted', substage: 'Successfully Converted', status: 'Open', nextFollowUp: '', remarks: 'Paid' });
ok(res.ok, 'follow-up after sort found lead by ID ' + JSON.stringify(res.errors || ''));
ok(cell(LM(), 'A6') === 'LD-000001' && cell(LM(), 'AB6') === 'Converted' && cell(LM(), 'T6') === '', 'stage Converted -> status Converted, next FU cleared, correct row');
rows = logRows();
ok(rows.filter(r => r[1] === 'LD-000001' && r[12] === 'Contact').length === 2, 'both contact activities preserved in log');
ok(rows.some(r => r[13] === 'Lead Status' && r[15] === 'Converted' && r[12] === 'System'), 'conversion event logged (auto status)');
ok(new Set(rows.map(r => r[0])).size === rows.length, 'activity IDs unique (' + rows.length + ' rows)');

// ---------- identity for personal Google accounts: e.user is blank; key hand-off between triggers ----------
as('caller1@example.com', 'TK1');
edit('Lead Management', 'Y2', 'note by caller');
ok(cell(LM(), 'W2') === 'Sample Counsellor 1', 'editor identified via temporary-key hand-off (e.user blank): ' + cell(LM(), 'W2'));
as('someone.else@gmail.com', 'TK-unregistered', true);
edit('Lead Management', 'Y2', 'note 1b');
ok(cell(LM(), 'W2') === 'Unidentified user', 'editor who never used the menu is "Unidentified user"');
as('', 'TK-unknown');
edit('Lead Management', 'Y2', 'note 2');
ok(cell(LM(), 'W2') === 'Unidentified user', 'unknown user labelled: ' + cell(LM(), 'W2'));
// legacy simple mode: temporary-key mapping
g._state.docProps.EDIT_MODE = 'simple';
as('', 'TK1');
edit('Lead Management', 'Y2', 'note 3');
ok(cell(LM(), 'W2') === 'Sample Counsellor 1', 'simple mode: email resolved via temp-key mapping');
g._state.docProps.EDIT_MODE = 'installable';

// ---------- Stage Master: add stage + substage ----------
as('admin@example.com', 'TKA');
const sm = ss.getSheetByName('Stage Master');
sm.getRange('B18:F18').setValues([['Counselling', 'Session Booked', 'demo', 3.5, '']]);
edit('Stage Master', 'B18:F18', undefined);
ok(cell(sm, 'A18') === 'STG-017' && cell(sm, 'F18') === 'Active', 'new stage row gets ID + Active');
fresh();
ok(g.getFollowUpContext().stages.some(s => s.name === 'Counselling' && s.subs[0] === 'Session Booked'), 'new stage/substage available (admin sidebar)');
// lead in Counselling stage gets the new list
edit('Lead Management', 'P3', 'Counselling', 'New Lead');
ok(JSON.stringify(LM().getRange('Q3').getDataValidation().calls).includes('Session Booked'), 'new substage in dependent dropdown');
// deactivate substage
sm.getRange('F18').setValue('Inactive'); edit('Stage Master', 'F18', undefined);
fresh();
ok(!g.getFollowUpContext().stages.some(s => s.name === 'Counselling'), 'inactive stage hidden from new selections');

// ---------- counsellor master ----------
cm.getRange('B5').setValue('New Person'); edit('Counsellor Master', 'B5', undefined);
ok(cell(cm, 'A5') === 'CNS-004' && cell(cm, 'F5') === 'Active' && cell(cm, 'G5') instanceof Date, 'new counsellor gets ID/status/date');

// ---------- log tamper ----------
const before = logRows().length;
edit('Follow-Up Log', 'K2', 'changed', 'New lead entered');
ok(logRows().length === before + 1 && logRows().pop()[5] === 'Log Edited', 'manual log edit recorded');

// ---------- data-quality flags (script-computed) ----------
ok(/Duplicate mobile/.test(cell(LM(), 'AH3')) && /Duplicate mobile/.test(cell(LM(), 'AH4')), 'duplicate mobile flagged by script in AH');
ok(LM().getRange('AH1').getFormula() === '' && cell(LM(), 'AH1') === 'Data Quality Flags', 'AH is a script column, not an ARRAYFORMULA');

// ---------- strict protection of locked columns ----------
const strictDescs = LM().prot.filter(p => p.warn === false).map(p => p.desc);
ok(strictDescs.some(d => /: C:D$/.test(d)) && strictDescs.some(d => /: O$/.test(d)) && strictDescs.some(d => /: Z:AA$/.test(d)) && strictDescs.some(d => /: AC:AI$/.test(d)) && strictDescs.some(d => /: A$/.test(d)),
  'locked columns strictly protected: ' + strictDescs.join(' | '));
ok(!strictDescs.some(d => /: P|: Y|: AB/.test(d)), 'stage / remarks / status stay editable');
ok(ss.getSheetByName('Follow-Up Log').prot.some(p => p.warn === false), 'Follow-Up Log strictly protected (script writes as owner)');
ss.getSheetByName('Lists & Settings').getRange('AD8').setValue('Lead Remarks'); edit('Lists & Settings', 'AD8', undefined);
ok(LM().prot.some(p => p.warn === false && /: V:AA$/.test(p.desc)), 'adding "Lead Remarks" to Counsellor-Locked Fields locks column Y');
ss.getSheetByName('Lists & Settings').getRange('AD8').setValue(''); edit('Lists & Settings', 'AD8', undefined);
ok(!LM().prot.some(p => /: V:AA$/.test(p.desc)) && LM().prot.some(p => /: V:X$/.test(p.desc)), 'removing it unlocks Y again');

// ---------- dashboard (script-computed values) ----------
fresh(); g.refreshDashboard();
const lay = JSON.parse(g._state.docProps.DASH_LAYOUT);
const kpi = name => { const c = lay.cards[name]; return ss.getSheetByName('Dashboard').getRange(c[0], c[1]).getValue(); };
ok(kpi('Follow-Ups Completed') === 2 && kpi('Unique Leads Contacted') === 1, 'dashboard: 2 follow-ups on one lead = 1 unique lead contacted');
ok(kpi('Total Leads') === 4 && kpi('Converted Leads') === 1, 'dashboard: total ' + kpi('Total Leads') + ', converted ' + kpi('Converted Leads'));
ok(Math.abs(kpi('Conversion Rate') - 0.25) < 1e-9, 'dashboard: conversion rate 25%');
const D = ss.getSheetByName('Dashboard');
ok(D.getRange(lay.counsellor.data, 2).getValue() === 'Sample Counsellor 1' && D.getRange(lay.counsellor.data, 5).getValue() === 2, 'counsellor report: follow-ups credited');
ok(D.getRange(lay.stage.data, 2).getValue() === 'New Lead', 'stage report lists stages in order');
ok(D.getRange('I5').getValue() instanceof Date, 'dashboard refresh timestamp written');
D.getRange('L4').setValue('Sample Counsellor 2'); edit('Dashboard', 'L4', undefined);
ok(kpi('Follow-Ups Completed') === 0, 'counsellor filter change refreshes dashboard');
D.getRange('L4').setValue('All Counsellors'); edit('Dashboard', 'L4', undefined);
D.getRange('C4').setValue('Yesterday'); edit('Dashboard', 'C4', undefined);
ok(kpi('Follow-Ups Completed') === 0 && kpi('Total Leads') === 4, 'period change: activity KPIs follow the period, lead totals do not');
D.getRange('C4').setValue('Last 30 Days'); edit('Dashboard', 'C4', undefined);

// ---------- counsellor web app: sign-in app + access control + access log ----------
const AL = () => { const a = ss.getSheetByName('Access Log'); return a.getLastRow() < 2 ? [] : a.getRange(2, 1, a.getLastRow() - 1, 7).getValues(); };
// The separate sign-in project, loaded in its own sandbox with its own Script Properties.
function signIn(email, lead) {
  const c = M.makeGlobals(new M.Spreadsheet());
  c._state.scriptProps.IDENTITY_SECRET = SECRET; c._state.scriptProps.MAIN_APP_URL = 'https://script.google.com/macros/s/MAIN/exec';
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(dir, '..', 'identity-app', 'Identity.gs'), 'utf8'), c, { filename: 'Identity.gs' });
  M.setUser(email, 'TK-ID');                       // the sign-in app runs AS the visitor
  const html = c.doGet({ parameter: lead ? { lead } : {} }).__msg;
  M.setUser('', 'TK-VISITOR');                     // main app (execute as owner): visitor's email is NOT visible
  const m = /href="([^"]+\?t=([^"&]+)[^"]*)"/.exec(html);
  return m ? decodeURIComponent(m[2]) : null;
}
function openApp(params) { fresh(); const out = g.doGet({ parameter: params }); return typeof out.__msg === 'string' ? { page: out.__msg } : JSON.parse(out.__tpl.boot); }

M.setUser('', 'TK-VISITOR');
let page = openApp({});
ok(page.page && /Sign in with Google/.test(page.page) && page.page.indexOf(ID_URL) > 0, 'visitor without a session is sent to the sign-in app');
let tok = signIn('stranger@yahoo.com');
page = openApp({ t: tok });
ok(page.page && /Access denied/.test(page.page) && AL().some(r => r[1] === 'stranger@yahoo.com' && r[3] === 'Access Denied'), 'signed-in Google account not in the lists is denied and logged');
fresh(); let threw = false; try { g.portalListLeads('0'.repeat(64), 'all', ''); } catch (e) { threw = /SESSION_EXPIRED/.test(e.message); }
ok(threw, 'API calls without a valid session are refused');
tok = signIn('caller1@example.com', 'LD-000001');
let boot = openApp({ t: tok, lead: 'LD-000001' });
ok(/^[a-f0-9]{64}$/.test(boot.sid) && boot.lead === 'LD-000001', 'valid token from the sign-in app opens a session');
ok(openApp({ t: tok }).page && /expired|already used/.test(openApp({ t: tok }).page), 'sign-in token cannot be reused');
const forged = tok.split('.')[0].replace(/.$/, c => c === 'A' ? 'B' : 'A') + '.' + tok.split('.')[1];
ok(openApp({ t: forged }).page !== undefined, 'tampered token rejected');
{
  const payload = 'caller1@example.com|' + (Date.now() - 1000) + '|old';
  const sig = Buffer.from(require('crypto').createHmac('sha256', SECRET).update(payload).digest()).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  const expired = Buffer.from(payload).toString('base64').replace(/\+/g, '-').replace(/\//g, '_') + '.' + sig;
  ok(openApp({ t: expired }).page !== undefined, 'expired token rejected');
}
ok(AL().some(r => r[1] === 'caller1@example.com' && r[3] === 'Portal Opened'), 'portal open logged');
const S1 = boot.sid;
fresh(); const list = g.portalListLeads(S1, 'all', '');
ok(list.leads.length === 1 && list.leads[0].id === 'LD-000001', 'counsellor sees only own leads (' + list.leads.map(l => l.id).join(',') + ')');
ok(AL().some(r => r[3] === 'Leads Listed' && /LD-000001/.test(r[5])), 'list view logged with lead IDs');
fresh(); threw = false; try { g.portalGetLead(S1, cell(LM(), 'A3')); } catch (e) { threw = /not assigned to you/.test(e.message); }
ok(threw && AL().some(r => r[3] === 'Access Denied' && r[4] === cell(LM(), 'A3')), 'opening another counsellor\'s lead refused and logged');
fresh(); const lv = g.portalGetLead(S1, 'LD-000001');
ok(lv.values.NAME === 'Ravi Kumar' && !('SNAPSHOT' in lv.values), 'lead view returns allowed fields');
fresh(); let sv = g.portalSaveLead(S1, 'LD-000001', { MOBILE: '9999999999' });
ok(!sv.ok && /cannot be changed/.test(sv.errors[0]) && cell(LM(), 'C6') !== '9999999999', 'locked field (mobile) rejected by server');
fresh(); sv = g.portalSaveLead(S1, 'LD-000001', { PRIORITY: 'Hot', CUSTOM_2: 'Pune' });
ok(sv.ok && cell(LM(), 'R6') === 'Hot' && cell(LM(), 'F6') === 'Pune' && cell(LM(), 'W6') === 'Sample Counsellor 1', 'allowed fields saved with user stamp');
ok(AL().some(r => r[3] === 'Lead Updated' && /Lead Priority/.test(r[5])), 'edit logged with old -> new values');
fresh(); sv = g.portalSaveLead(S1, 'LD-000001', { STAGE: 'Interested' });
ok(sv.ok && cell(LM(), 'P6') === 'Interested' && cell(LM(), 'Q6') === '' && logRows().some(r => r[1] === 'LD-000001' && r[5] === 'Substage Cleared'), 'web app stage change clears substage + audits');
fresh(); g.portalLogClientEvent(S1, 'copy', 'LD-000001');
ok(AL().some(r => r[3] === 'Copy In Browser (reported)'), 'reported browser copy logged');
// Any email provider; Gmail dots / +tags / googlemail.com match the Counsellor Master entry.
cm.getRange('C3').setValue('Jane.Doe@gmail.com');
boot = openApp({ t: signIn('janedoe+crm@googlemail.com') });
ok(boot.sid && (fresh(), g.portalInit(boot.sid).user.name === 'Sample Counsellor 2'), 'Gmail address variants match the listed counsellor');
// Admin Emails grants access for any provider
ss.getSheetByName('Lists & Settings').getRange(2, 14, 30, 2).getValues().forEach((r, i) => {
  if (r[0] === 'Admin Emails') ss.getSheetByName('Lists & Settings').getRange(2 + i, 15).setValue('admin@example.com, boss@outlook.com');
});
boot = openApp({ t: signIn('boss@outlook.com') });
ok(boot.sid && (fresh(), g.portalInit(boot.sid).user.admin === true), 'email in Admin Emails gets in as admin (any provider)');
// Deactivating a counsellor ends access on the next request
cm.getRange('F2').setValue('Inactive');
fresh(); threw = false; try { g.portalListLeads(S1, 'all', ''); } catch (e) { threw = /ACCESS_DENIED/.test(e.message); }
ok(threw, 'inactive counsellor is refused on the next request');
cm.getRange('F2').setValue('Active');
// Spreadsheet opens by personal accounts are attributed through the same key hand-off
as('caller1@example.com', 'TK1');
fresh(); g.onOpen({});
fresh(); g.onOpenInstallable({ user: { getEmail: () => '' } });
ok(AL().some(r => r[3] === 'Spreadsheet Opened' && r[1] === 'caller1@example.com'), 'spreadsheet open logged with the opener resolved via key hand-off');
as('admin@example.com', 'TKA');
fresh(); g.scheduledMaintenance();
ok(true, 'hourly maintenance ran');

// ---------- bulk process + health ----------
fresh(); g.processAllLeads();
ok(true, 'processAllLeads ran');
fresh(); g.runHealthCheck();
console.log(M.alerts[M.alerts.length - 1]);
fresh(); g.refreshDashboard(); g.viewOverdue(); g.viewUnworked(); g.identifyMe(); g.sendFollowUpReminders();
// re-run setup (repair) keeps data
fresh(); g.setupWorkbook();
ok(cell(LM(), 'A6') === 'LD-000001' && logRows().length > 5, 'repair keeps leads and log');
ok(cell(LM(), 'F1') === 'Town' && !LM().isColumnHiddenByUser(6) && LM().isColumnHiddenByUser(5) && cell(LS_(), 'AA2') === 'Course Interested' && cell(LS_(), 'AB2') === 'No', 'repair keeps custom field names, active status and visibility');
ok(LM().getRange(1, 1, 7, 35).getValues().some(r => r[4] === 'MBA'), 'repair keeps hidden custom field data');

// ---------- migration from the original layout (custom fields in Q:Z) ----------
{
  const ss3 = new M.Spreadsheet(); const g3 = makeCtx(ss3);
  const old = ss3.insertSheet('Lead Management', 0); old.maxCols = 35; old.maxRows = 1001;
  const oldHeaders = ['Lead ID','Lead Name','Mobile Number','Email ID','Assigned Counsellor','Lead Stage','Lead Substage','Lead Priority','Last Contact Date','Next Follow-Up Date','Last Follow-Up Outcome','Follow-Up Count','Last Updated By','Last Activity Timestamp','Lead Remarks','Lead Source','Course','Custom Field 2','Custom Field 3','Custom Field 4','Custom Field 5','Custom Field 6','Custom Field 7','Custom Field 8','Custom Field 9','Batch','Lead Created Date','Lead Status'];
  old.getRange(1, 1, 1, oldHeaders.length).setValues([oldHeaders]);
  old.getRange(2, 1, 1, 28).setValues([['LD-000001','Old Lead','9000000000','','Sample Counsellor 1','New Lead','Not Contacted','Hot','','','','','','','old remark','Website','BBA','','','','','','','','','','','Open']]);
  g3.setupWorkbookQuickTest();
  const L3 = ss3.getSheetByName('Lead Management'), S3 = ss3.getSheetByName('Lists & Settings');
  ok(L3.getRange('E1').getValue() === 'Course' && L3.getRange('E2').getValue() === 'BBA' && L3.getRange('O2').getValue() === 'Sample Counsellor 1' && L3.getRange('Y2').getValue() === 'old remark' && L3.getRange('AB2').getValue() === 'Open',
    'old layout migrated: custom data moved to E:N, core fields moved right');
  ok(S3.getRange('AB2').getValue() === 'Yes' && S3.getRange('AB3').getValue() === 'No' && S3.getRange('AA11').getValue() === 'Batch' && S3.getRange('AB11').getValue() === 'Yes' && !L3.isColumnHiddenByUser(5) && L3.isColumnHiddenByUser(6),
    'migrated slots: used/renamed fields active, unused hidden');
}
console.log('\nToasts sample:', M.toasts.slice(-6));
console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
