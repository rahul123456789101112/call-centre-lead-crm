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
function edit(sheetName, a1, value, oldValue) {
  const sh = ss.getSheetByName(sheetName); const r = sh.getRange(a1);
  if (value !== undefined) { if (Array.isArray(value)) r.setValues(value); else r.setValue(value); }
  fresh(); g.onEdit({ range: r, value: Array.isArray(value) ? undefined : value, oldValue, source: ss });
}
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
M.setUser('caller1@example.com', 'TK1');
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

// ---------- stage change clears invalid substage ----------
edit('Lead Management', 'P2', 'Interested', 'New Lead');
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

// ---------- follow-up via sidebar ----------
fresh();
const ctx = g.getFollowUpContext();
ok(ctx.actor.name === 'Sample Counsellor 1' && ctx.stages.length === 7, 'sidebar context (stages=' + ctx.stages.length + ')');
ok(!ctx.activityTypes.some(a => a.type === 'Lead Created'), 'system activity types hidden from form');
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

// ---------- identity fallback via temporary key ----------
M.setUser('', 'TK1');
edit('Lead Management', 'Y2', 'note by caller');
ok(cell(LM(), 'W2') === 'Sample Counsellor 1', 'unidentified email resolved via temp-key mapping: ' + cell(LM(), 'W2'));
M.setUser('', 'TK-unknown');
edit('Lead Management', 'Y2', 'note 2');
ok(cell(LM(), 'W2') === 'Unidentified user', 'unknown user labelled: ' + cell(LM(), 'W2'));

// ---------- Stage Master: add stage + substage ----------
M.setUser('admin@example.com', 'TKA');
const sm = ss.getSheetByName('Stage Master');
sm.getRange('B18:F18').setValues([['Counselling', 'Session Booked', 'demo', 3.5, '']]);
edit('Stage Master', 'B18:F18', undefined);
ok(cell(sm, 'A18') === 'STG-017' && cell(sm, 'F18') === 'Active', 'new stage row gets ID + Active');
fresh();
ok(g.getFollowUpContext().stages.some(s => s.name === 'Counselling' && s.subs[0] === 'Session Booked'), 'new stage/substage available');
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
