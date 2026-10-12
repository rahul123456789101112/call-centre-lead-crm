/**
 * Setup.gs
 * setupWorkbook() builds (or repairs) the whole CRM in the current spreadsheet:
 * 6 sheets, headers, formatting, data validation, conditional formatting, protections,
 * sample master data, dashboard formulas and charts, and the core installable trigger.
 *
 * Safe to re-run: existing leads, log entries, master data and settings are kept; only
 * structure, rules and the Dashboard are rebuilt.
 */

/* Dashboard fixed cells (also used by Triggers.gs / Menu.gs). */
var DASH = {
  CONTROL_ROW: 4,
  PERIOD: 'C4', CUSTOM_FROM: 'F4', CUSTOM_TO: 'I4', COUNSELLOR: 'L4',
  FROM: '$C$5', TO: '$F$5', REFRESHED: 'I5',
  CRIT: '$AA$1', ALL: '$AA$2', SEL: '$L$4',
  CHART_COL: 14
};

var COLORS = {
  navy: '#1F3864', blue: '#2E75B6', teal: '#117A65', amber: '#B9770E', red: '#C0392B', grey: '#7F8C8D',
  headerUser: '#1F3864', headerSystem: '#566573', headerFormula: '#0E6655', headerCustom: '#5B2C6F',
  card: '#F4F6F9', band: '#F4F7FB', palette: ['#2E75B6', '#117A65', '#E67E22', '#8E44AD', '#C0392B', '#7F8C8D']
};

/* ================================================================== */
/* Entry point                                                         */
/* ================================================================== */

function setupWorkbook() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var firstRun = !ss.getSheetByName(SHEET.LEADS) || !ss.getSheetByName(SHEET.SETTINGS);
  if (!firstRun) requireAdmin_();
  var me = '';
  try { me = Session.getEffectiveUser().getEmail(); } catch (e) { /* ignore */ }

  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    clearMemo_();
    ss.toast('Creating sheets...', CRM_TITLE, 60);
    var sh = ensureSheets_(ss);
    setupSettingsSheet_(sh.settings, me);
    createNamedRanges_(ss, sh.settings);
    clearMemo_();
    setupStageMaster_(sh.stages);
    setupCounsellorMaster_(sh.counsellors);
    SpreadsheetApp.flush();
    ss.toast('Formatting Lead Management (10,000 rows)...', CRM_TITLE, 60);
    setupLeadSheet_(sh.leads);
    setupLogSheet_(sh.log);
    SpreadsheetApp.flush();
    ss.toast('Building dashboard...', CRM_TITLE, 60);
    setupDashboard_(sh.dashboard);
    SpreadsheetApp.flush();
    applyProtections_(ss);
    installCoreTriggers_(ss);
    initCounters_();
    removeDefaultSheets_(ss);
    PropertiesService.getDocumentProperties().setProperty('CRM_VERSION', CRM_VERSION);
    ss.setActiveSheet(sh.leads);
    clearMemo_();
  } finally {
    lock.releaseLock();
  }
  alert_('Lead CRM ' + (firstRun ? 'created' : 'repaired') + '.\n\n' +
    'Next steps:\n' +
    '1. Replace the SAMPLE rows in Stage Master and Counsellor Master with your own.\n' +
    '2. Add each counsellor\'s Google account email in Counsellor Master (used to identify users).\n' +
    '3. Add administrator emails in Lists & Settings > "' + SET.ADMINS + '", then run Lead CRM > Admin > Reapply protections.\n' +
    '4. Share the spreadsheet with callers as Editors. Each caller opens Lead CRM > Log Follow-Up once to authorise.\n\n' +
    'See docs/SETUP.md for details.');
}

function alert_(msg) {
  var ui = getUiSafe_();
  try {
    if (ui) { ui.alert(CRM_TITLE, msg, ui.ButtonSet.OK); return; }
  } catch (e) { /* no dialog available, e.g. run from a trigger */ }
  console.log(msg);
  toast_(msg.split('\n')[0], 10);
}

function ensureSheets_(ss) {
  var tabColors = {};
  tabColors[SHEET.LEADS] = COLORS.navy;
  tabColors[SHEET.LOG] = COLORS.teal;
  tabColors[SHEET.STAGES] = COLORS.grey;
  tabColors[SHEET.COUNSELLORS] = COLORS.grey;
  tabColors[SHEET.DASHBOARD] = '#E67E22';
  tabColors[SHEET.SETTINGS] = COLORS.grey;
  var out = {};
  SHEET_ORDER.forEach(function (name, i) {
    var s = ss.getSheetByName(name);
    if (!s) s = ss.insertSheet(name, i);
    ss.setActiveSheet(s);
    ss.moveActiveSheet(i + 1);
    s.setTabColor(tabColors[name]);
  });
  out.leads = ss.getSheetByName(SHEET.LEADS);
  out.log = ss.getSheetByName(SHEET.LOG);
  out.stages = ss.getSheetByName(SHEET.STAGES);
  out.counsellors = ss.getSheetByName(SHEET.COUNSELLORS);
  out.dashboard = ss.getSheetByName(SHEET.DASHBOARD);
  out.settings = ss.getSheetByName(SHEET.SETTINGS);
  return out;
}

function ensureSize_(sh, rows, cols) {
  if (sh.getMaxRows() < rows) sh.insertRowsAfter(sh.getMaxRows(), rows - sh.getMaxRows());
  if (sh.getMaxColumns() < cols) sh.insertColumnsAfter(sh.getMaxColumns(), cols - sh.getMaxColumns());
}

function removeDefaultSheets_(ss) {
  ss.getSheets().forEach(function (s) {
    if (SHEET_ORDER.indexOf(s.getName()) >= 0) return;
    if (/^(Sheet|Feuille|Hoja|Tabelle|Foglio|Planilha)\s*\d+$/i.test(s.getName()) && s.getLastRow() === 0 && s.getCharts().length === 0) {
      ss.deleteSheet(s);
    }
  });
}

function styleHeader_(range, bg) {
  range.setBackground(bg).setFontColor('#FFFFFF').setFontWeight('bold').setWrap(true)
    .setVerticalAlignment('middle').setHorizontalAlignment('center');
}

/** Writes a block of rows (padding ragged arrays). */
function writeRows_(sh, row, col, rows, width) {
  if (!rows.length) return;
  var data = rows.map(function (r) {
    var out = r.slice(0, width);
    while (out.length < width) out.push('');
    return out;
  });
  sh.getRange(row, col, data.length, width).setValues(data);
}

/** Writes a single list down a column starting at row 2. */
function writeList_(sh, col, values) {
  if (!values.length) return;
  sh.getRange(2, col, values.length, 1).setValues(values.map(function (v) { return [v]; }));
}

/* ================================================================== */
/* Lists & Settings                                                    */
/* ================================================================== */

var DEFAULT_LISTS = {
  priorities: ['Critical', 'Hot', 'Warm', 'Cold'],
  outcomes: ['Connected', 'Not Connected', 'Interested', 'Not Interested', 'Call Back', 'Busy', 'Switched Off',
    'Wrong Number', 'No Answer / Voicemail', 'Details Shared', 'Converted'],
  sources: ['Website', 'Walk-In', 'Referral', 'Social Media', 'Google Ads', 'Facebook / Instagram Ads',
    'Event / Seminar', 'Inbound Call', 'Other'],
  statuses: [STATUS.OPEN, STATUS.ON_HOLD, STATUS.CONVERTED, STATUS.LOST, STATUS.DUPLICATE],
  activityTypes: [
    ['Outbound Call', CATEGORY.CONTACT, 'Yes'],
    ['Inbound Call', CATEGORY.CONTACT, 'Yes'],
    ['WhatsApp', CATEGORY.CONTACT, 'Yes'],
    ['Email', CATEGORY.CONTACT, 'Yes'],
    ['SMS', CATEGORY.CONTACT, 'Yes'],
    ['Meeting / Walk-In', CATEGORY.CONTACT, 'Yes'],
    [ACT.FU_SCHEDULED, CATEGORY.RECORD, 'Yes'],
    ['Other', CATEGORY.RECORD, 'Yes'],
    [ACT.STAGE_UPDATED, CATEGORY.RECORD, 'No'],
    [ACT.LEAD_ASSIGNED, CATEGORY.RECORD, 'No'],
    [ACT.STATUS_UPDATED, CATEGORY.RECORD, 'No'],
    [ACT.LEAD_CREATED, CATEGORY.SYSTEM, 'No'],
    [ACT.SUBSTAGE_CLEARED, CATEGORY.SYSTEM, 'No'],
    [ACT.LOG_EDITED, CATEGORY.SYSTEM, 'No']
  ],
  buckets: [['0-3 Days', 0, 3], ['4-7 Days', 4, 7], ['8-15 Days', 8, 15], ['16-30 Days', 16, 30], ['More Than 30 Days', 31, '']]
};

function setupSettingsSheet_(sh, me) {
  ensureSize_(sh, 200, LS.H_PAIRS + 1);
  var headers = {};
  headers[LS.PRIORITY] = 'Lead Priority';
  headers[LS.OUTCOME] = 'Contact Outcome';
  headers[LS.SOURCE] = 'Lead Source';
  headers[LS.STATUS] = 'Lead Status';
  headers[LS.ACT_TYPE] = 'Activity Type';
  headers[LS.ACT_CATEGORY] = 'Activity Category';
  headers[LS.ACT_SIDEBAR] = 'Show in Follow-Up Form';
  headers[LS.ACTIVE_VALUES] = 'Active Status Values';
  headers[LS.BUCKET_LABEL] = 'Ageing Bucket';
  headers[LS.BUCKET_MIN] = 'Min Days';
  headers[LS.BUCKET_MAX] = 'Max Days (blank = no limit)';
  headers[LS.SET_KEY] = 'Setting';
  headers[LS.SET_VALUE] = 'Value';
  headers[LS.SET_DESC] = 'Description';
  headers[LS.H_ACTIVE_STAGES] = 'Active Stages (auto)';
  headers[LS.H_ALL_STAGES] = 'All Stages (auto)';
  headers[LS.H_ACTIVE_CNS] = 'Active Counsellors (auto)';
  headers[LS.H_CNS_FILTER] = 'Counsellor Filter (auto)';
  headers[LS.H_PERIODS] = 'Reporting Periods (auto)';
  headers[LS.H_PAIRS] = 'Stage (auto)';
  headers[LS.H_PAIRS + 1] = 'Substage (auto)';
  Object.keys(headers).forEach(function (c) { sh.getRange(1, parseInt(c, 10)).setValue(headers[c]); });

  var isEmpty = !str_(sh.getRange(2, LS.PRIORITY).getValue()) && !str_(sh.getRange(2, LS.SET_KEY).getValue());
  if (isEmpty) {
    writeList_(sh, LS.PRIORITY, DEFAULT_LISTS.priorities);
    writeList_(sh, LS.OUTCOME, DEFAULT_LISTS.outcomes);
    writeList_(sh, LS.SOURCE, DEFAULT_LISTS.sources);
    writeList_(sh, LS.STATUS, DEFAULT_LISTS.statuses);
    writeRows_(sh, 2, LS.ACT_TYPE, DEFAULT_LISTS.activityTypes, 3);
    writeList_(sh, LS.ACTIVE_VALUES, [ACTIVE, INACTIVE]);
    writeRows_(sh, 2, LS.BUCKET_LABEL, DEFAULT_LISTS.buckets, 3);
    writeRows_(sh, 2, LS.SET_KEY, DEFAULT_SETTINGS.map(function (d) {
      return [d[0], d[0] === SET.ADMINS ? (me || '') : d[1], d[2]];
    }), 3);
  } else {
    // Upgrade path: append any setting keys that do not exist yet.
    var last = Math.max(sh.getLastRow(), 2);
    var keys = sh.getRange(2, LS.SET_KEY, last - 1, 1).getValues().map(function (r) { return str_(r[0]).toLowerCase(); });
    var lastKeyRow = 1;
    keys.forEach(function (k, i) { if (k) lastKeyRow = i + 2; });
    var missing = DEFAULT_SETTINGS.filter(function (d) { return keys.indexOf(d[0].toLowerCase()) < 0; });
    if (missing.length) {
      writeRows_(sh, lastKeyRow + 1, LS.SET_KEY, missing.map(function (d) { return [d[0], d[1], d[2]]; }), 3);
    }
  }

  // Setting values with fixed choices get a dropdown.
  var lastSet = Math.max(sh.getLastRow(), 2);
  var keyVals = sh.getRange(2, LS.SET_KEY, lastSet - 1, 1).getValues();
  keyVals.forEach(function (r, i) {
    var def = DEFAULT_SETTINGS.filter(function (d) { return same_(d[0], r[0]); })[0];
    var cell = sh.getRange(i + 2, LS.SET_VALUE);
    if (def && def[3]) cell.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(def[3], true).setAllowInvalid(false).build());
  });

  // Auto-calculated helper lists used by dropdowns and the dashboard. Do not edit.
  var smB = "'Stage Master'!B2:B", smC = "'Stage Master'!C2:C", smE = "'Stage Master'!E2:E", smF = "'Stage Master'!F2:F";
  var cmB = "'Counsellor Master'!B2:B", cmF = "'Counsellor Master'!F2:F";
  sh.getRange(2, LS.H_ACTIVE_STAGES).setFormula('=IFERROR(UNIQUE(SORT(FILTER(' + smB + ',' + smF + '="Active",' + smB + '<>""),FILTER(' + smE + ',' + smF + '="Active",' + smB + '<>""),TRUE)),"")');
  sh.getRange(2, LS.H_ALL_STAGES).setFormula('=IFERROR(UNIQUE(SORT(FILTER(' + smB + ',' + smB + '<>""),FILTER(' + smE + ',' + smB + '<>""),TRUE)),"")');
  sh.getRange(2, LS.H_ACTIVE_CNS).setFormula('=IFERROR(SORT(UNIQUE(FILTER(' + cmB + ',' + cmF + '="Active",' + cmB + '<>""))),"")');
  sh.getRange(2, LS.H_CNS_FILTER).setFormula('={"' + ALL_COUNSELLORS + '";IFERROR(SORT(UNIQUE(FILTER(' + cmB + ',' + cmB + '<>""))),"")}');
  writeList_(sh, LS.H_PERIODS, PERIODS);
  sh.getRange(2, LS.H_PAIRS).setFormula('=IFERROR(UNIQUE(SORT(FILTER({' + smB + ',' + smC + '},' + smB + '<>""),FILTER(' + smE + ',' + smB + '<>""),TRUE)),"")');

  // Validation on the configurable lists
  var maxR = sh.getMaxRows() - 1;
  sh.getRange(2, LS.ACT_CATEGORY, maxR, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList([CATEGORY.CONTACT, CATEGORY.RECORD, CATEGORY.SYSTEM], true).setAllowInvalid(false)
    .setHelpText('Contact = a real call/message (counts as a follow-up). Record Update = a change to the lead. System = automated.').build());
  sh.getRange(2, LS.ACT_SIDEBAR, maxR, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['Yes', 'No'], true).setAllowInvalid(false).build());
  sh.getRange(2, LS.BUCKET_MIN, maxR, 2).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(false).build());

  // Formatting
  sh.setFrozenRows(1);
  styleHeader_(sh.getRange(1, 1, 1, LS.ACTIVE_VALUES), COLORS.navy);
  styleHeader_(sh.getRange(1, LS.BUCKET_LABEL, 1, 3), COLORS.teal);
  styleHeader_(sh.getRange(1, LS.SET_KEY, 1, 3), COLORS.headerCustom);
  styleHeader_(sh.getRange(1, LS.H_ACTIVE_STAGES, 1, 7), COLORS.headerSystem);
  sh.getRange(2, LS.H_ACTIVE_STAGES, sh.getMaxRows() - 1, 7).setBackground('#F2F3F4').setFontColor('#566573');
  sh.setRowHeight(1, 40);
  for (var c = 1; c <= LS.H_PAIRS + 1; c++) sh.setColumnWidth(c, 140);
  [9, 13, 17].forEach(function (c) { sh.setColumnWidth(c, 24); });
  sh.setColumnWidth(LS.SET_KEY, 260);
  sh.setColumnWidth(LS.SET_VALUE, 200);
  sh.setColumnWidth(LS.SET_DESC, 480);
  sh.getRange(2, LS.SET_DESC, sh.getMaxRows() - 1, 1).setWrap(true).setFontColor('#566573');
  sh.getRange(1, LS.SET_KEY).setNote('Settings are read by name: edit the Value column only. Keep names unchanged.');
  sh.getRange(1, LS.H_ACTIVE_STAGES).setNote('Columns R:X are calculated automatically from Stage Master / Counsellor Master. Do not type here.');
}

function createNamedRanges_(ss, settingsSheet) {
  var last = Math.max(settingsSheet.getLastRow(), 2);
  var keys = settingsSheet.getRange(2, LS.SET_KEY, last - 1, 1).getValues();
  Object.keys(NAMED).forEach(function (k) {
    var def = NAMED[k];
    for (var i = 0; i < keys.length; i++) {
      if (same_(keys[i][0], def.key)) {
        ss.setNamedRange(def.name, settingsSheet.getRange(i + 2, LS.SET_VALUE));
        return;
      }
    }
  });
}

/* ================================================================== */
/* Stage Master / Counsellor Master                                    */
/* ================================================================== */

var SAMPLE_STAGES = [
  ['New Lead', 'Not Contacted', 'Lead received, no call attempted yet', 1],
  ['New Lead', 'First Attempt Pending', 'Lead queued for the first call', 1],
  ['Contacted', 'Connected', 'Spoke to the lead', 2],
  ['Contacted', 'Not Connected', 'Call attempted, not reached', 2],
  ['Contacted', 'Call Back Requested', 'Lead asked to be called later', 2],
  ['Interested', 'Highly Interested', 'Strong intent shown', 3],
  ['Interested', 'Details Shared', 'Brochure / fees / details sent', 3],
  ['Interested', 'Follow-Up Required', 'Needs another conversation', 3],
  ['Application', 'Application Started', 'Application form begun', 4],
  ['Application', 'Application Submitted', 'Application submitted', 4],
  ['Application', 'Documents Pending', 'Waiting for documents', 4],
  ['Payment', 'Payment Pending', 'Awaiting payment', 5],
  ['Payment', 'Partial Payment', 'Part payment received', 5],
  ['Converted', 'Successfully Converted', 'Enrolled / purchased', 6],
  ['Lost', 'Not Interested', 'Lead declined', 7],
  ['Lost', 'Not Eligible', 'Does not meet criteria', 7]
];

function setupStageMaster_(sh) {
  ensureSize_(sh, 300, STAGE_HEADERS.length);
  sh.getRange(1, 1, 1, STAGE_HEADERS.length).setValues([STAGE_HEADERS]);
  if (sh.getLastRow() < 2) {
    writeRows_(sh, 2, 1, SAMPLE_STAGES.map(function (s, i) {
      return ['STG-' + pad_(i + 1, 3), s[0], s[1], s[2], s[3], ACTIVE, 'SAMPLE - replace with your own process'];
    }), STAGE_HEADERS.length);
  }
  var maxR = sh.getMaxRows() - 1;
  sh.getRange(2, SM.ACTIVE, maxR, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList([ACTIVE, INACTIVE], true).setAllowInvalid(false)
    .setHelpText('Inactive stages/substages disappear from new selections but stay on existing leads.').build());
  sh.getRange(2, SM.ORDER, maxR, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(false).setHelpText('Number used to order stages in dropdowns and reports.').build());
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$F2="Inactive"')
      .setFontColor('#A6ACAF').setItalic(true).setRanges([sh.getRange(2, 1, maxR, STAGE_HEADERS.length)]).build()
  ]);
  formatMasterSheet_(sh, STAGE_HEADERS.length, [90, 160, 200, 300, 90, 110, 280]);
  sh.getRange(1, SM.SUBSTAGE).setNote('One row per stage + substage. A stage with no substages: one row with Substage blank.');
  sh.getRange(1, SM.ACTIVE).setNote('Active / Inactive. Changing this refreshes the substage dropdowns automatically.');
}

function setupCounsellorMaster_(sh) {
  ensureSize_(sh, 300, COUNSELLOR_HEADERS.length);
  sh.getRange(1, 1, 1, COUNSELLOR_HEADERS.length).setValues([COUNSELLOR_HEADERS]);
  if (sh.getLastRow() < 2) {
    var today = todayDate_();
    writeRows_(sh, 2, 1, [
      ['CNS-001', 'Sample Counsellor 1', 'counsellor1@example.com', 'Sample Team Leader', 'Team A', ACTIVE, today],
      ['CNS-002', 'Sample Counsellor 2', 'counsellor2@example.com', 'Sample Team Leader', 'Team A', ACTIVE, today],
      ['CNS-003', 'Sample Counsellor 3', 'counsellor3@example.com', 'Sample Team Leader', 'Team B', INACTIVE, today]
    ], COUNSELLOR_HEADERS.length);
  }
  var maxR = sh.getMaxRows() - 1;
  sh.getRange(2, CM.ACTIVE, maxR, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList([ACTIVE, INACTIVE], true).setAllowInvalid(false)
    .setHelpText('Inactive counsellors are hidden from new assignments; their history is kept.').build());
  sh.getRange(2, CM.EMAIL, maxR, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireTextIsEmail().setAllowInvalid(true).setHelpText('Google account email used to identify this counsellor.').build());
  sh.getRange(2, CM.ADDED, maxR, 1).setNumberFormat('dd-mmm-yyyy').setDataValidation(
    SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).build());
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$F2="Inactive"')
      .setFontColor('#A6ACAF').setItalic(true).setRanges([sh.getRange(2, 1, maxR, COUNSELLOR_HEADERS.length)]).build()
  ]);
  formatMasterSheet_(sh, COUNSELLOR_HEADERS.length, [100, 200, 240, 180, 140, 140, 110]);
  sh.getRange(1, CM.NAME).setNote('Names appear in the Assigned Counsellor dropdown. Do not rename a counsellor who has history - add a new row instead.');
}

function formatMasterSheet_(sh, width, widths) {
  sh.setFrozenRows(1);
  styleHeader_(sh.getRange(1, 1, 1, width), COLORS.navy);
  sh.setRowHeight(1, 36);
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getBandings().forEach(function (b) { b.remove(); });
  sh.getRange(2, 1, sh.getMaxRows() - 1, width).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false)
    .setFirstRowColor('#FFFFFF').setSecondRowColor(COLORS.band);
  if (sh.getFilter()) sh.getFilter().remove();
  sh.getRange(1, 1, sh.getMaxRows(), width).createFilter();
}

/* ================================================================== */
/* Lead Management                                                     */
/* ================================================================== */

function setupLeadSheet_(sh) {
  ensureSize_(sh, LEAD_DATA_ROWS + 1, LEAD_COLS);
  var existing = sh.getRange(1, 1, 1, LEAD_COLS).getValues()[0];
  var headers = LEAD_HEADERS.map(function (h, i) {
    var c = i + 1;
    // Keep custom field names an administrator has already set.
    if (c >= LC.CUSTOM_FIRST && c <= LC.CUSTOM_LAST && str_(existing[i])) return existing[i];
    return h;
  });
  sh.getRange(1, 1, 1, LEAD_COLS).setValues([headers]);
  var formulas = leadHeaderFormulas_();
  sh.getRange(1, LC.FU_COUNT).setFormula(formulas.fuCount);
  sh.getRange(1, LC.ACTIVITY_TOTAL).setFormula(formulas.activityTotal);
  sh.getRange(1, LC.DQ_FLAGS).setFormula(formulas.dq);

  // Header colours: user fields / system / formula / custom
  styleHeader_(sh.getRange(1, 1, 1, LEAD_COLS), COLORS.headerUser);
  LEAD_SYSTEM_COLS.forEach(function (c) { sh.getRange(1, c).setBackground(COLORS.headerSystem); });
  LEAD_FORMULA_COLS.forEach(function (c) { sh.getRange(1, c).setBackground(COLORS.headerFormula); });
  sh.getRange(1, LC.CUSTOM_FIRST, 1, 10).setBackground(COLORS.headerCustom);
  sh.setRowHeight(1, 48);
  sh.setFrozenRows(1);
  sh.setFrozenColumns(2);

  var rows = sh.getMaxRows() - 1;
  var col = function (c, n) { return sh.getRange(2, c, rows, n || 1); };
  col(LC.ID).setFontWeight('bold').setFontColor(COLORS.navy);
  col(LC.MOBILE).setNumberFormat('@');
  col(LC.LAST_CONTACT).setNumberFormat('dd-mmm-yyyy');
  col(LC.NEXT_FU).setNumberFormat('dd-mmm-yyyy');
  col(LC.FU_COUNT).setNumberFormat('0').setHorizontalAlignment('center');
  col(LC.LAST_ACTIVITY).setNumberFormat('dd-mmm-yyyy hh:mm');
  col(LC.CREATED).setNumberFormat('dd-mmm-yyyy hh:mm');
  col(LC.LAST_FU_DATE).setNumberFormat('dd-mmm-yyyy');
  col(LC.STAGE_CHANGED).setNumberFormat('dd-mmm-yyyy hh:mm');
  col(LC.ASSIGNED_DATE).setNumberFormat('dd-mmm-yyyy hh:mm');
  col(LC.ACTIVITY_TOTAL).setNumberFormat('0').setHorizontalAlignment('center');
  col(LC.DQ_FLAGS).setWrap(false);
  col(LC.REMARKS).setWrap(false);

  var widths = {};
  widths[LC.ID] = 100; widths[LC.NAME] = 170; widths[LC.MOBILE] = 120; widths[LC.EMAIL] = 190;
  widths[LC.OWNER] = 160; widths[LC.STAGE] = 130; widths[LC.SUBSTAGE] = 170; widths[LC.PRIORITY] = 80;
  widths[LC.REMARKS] = 240; widths[LC.DQ_FLAGS] = 260; widths[LC.UPDATED_BY] = 170; widths[LC.LAST_ACTIVITY] = 140;
  for (var c = 1; c <= LEAD_COLS; c++) sh.setColumnWidth(c, widths[c] || 120);
  sh.hideColumns(LC.SNAPSHOT);

  addLeadHeaderNotes_(sh);
  applyLeadSheetRules_(sh);
  refreshAllSubstageValidations_();
}

function leadHeaderFormulas_() {
  var log = "'Follow-Up Log'!B2:M";
  var open = '((AB2:AB<>"Converted")*(AB2:AB<>"Lost")*(AB2:AB<>"Duplicate"))';
  var sm = function (c) { return "'Stage Master'!" + c + '2:' + c; };
  var dq = '={"Data Quality Flags";ARRAYFORMULA(IF(A2:A="",,REGEXREPLACE(' +
    'IF(C2:C="","Missing mobile; ",IF(REGEXMATCH(TO_TEXT(C2:C),SET_MOBILE_PATTERN),"","Invalid mobile format; "))' +
    '&IF((SET_DUP_MOBILE<>"Off")*(C2:C<>""),IF(COUNTIF(C2:C,C2:C)>1,"Duplicate mobile; ",""),"")' +
    '&IF(D2:D="","",IF(REGEXMATCH(TO_TEXT(D2:D),"^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$"),"","Invalid email; "))' +
    '&IF((SET_DUP_EMAIL<>"Off")*(D2:D<>""),IF(COUNTIF(D2:D,D2:D)>1,"Duplicate email; ",""),"")' +
    '&IF(E2:E="","Unassigned; ",IF(COUNTIF(\'Lists & Settings\'!T2:T,E2:E)=0,"Inactive/unknown counsellor; ",""))' +
    '&IF(F2:F="","Missing stage; ",IF(COUNTIFS(' + sm('B') + ',F2:F,' + sm('F') + ',"Active")=0,"Inactive/unknown stage; ",""))' +
    '&IF(G2:G="",IF(COUNTIFS(' + sm('B') + ',F2:F,' + sm('C') + ',"<>",' + sm('F') + ',"Active")>0,"Missing substage; ",""),' +
    'IF(COUNTIFS(' + sm('B') + ',F2:F,' + sm('C') + ',G2:G,' + sm('F') + ',"Active")=0,"Substage not valid for stage; ",""))' +
    '&IF(I2:I="","",IF(ISNUMBER(I2:I),"","Invalid last contact date; "))' +
    '&IF(J2:J="",IF(' + open + ',"No next follow-up date; ",""),IF(ISNUMBER(J2:J),IF(' + open + '*(J2:J<TODAY()),"Overdue follow-up; ",""),"Invalid follow-up date; "))' +
    '&IF(AB2:AB="","Missing status; ","")' +
    ',";\\s*$","")))}';
  return {
    fuCount: '={"Follow-Up Count";ARRAYFORMULA(IF(A2:A="",,IFERROR(VLOOKUP(A2:A,QUERY(' + log +
      ',"select B, count(B) where B <> \'\' and M = \'Contact\' group by B label count(B) \'\'",0),2,FALSE),0)))}',
    activityTotal: '={"Total Activities";ARRAYFORMULA(IF(A2:A="",,IFERROR(VLOOKUP(A2:A,QUERY(' + log +
      ',"select B, count(B) where B <> \'\' and M <> \'System\' and M <> \'\' group by B label count(B) \'\'",0),2,FALSE),0)))}',
    dq: dq
  };
}

function addLeadHeaderNotes_(sh) {
  var notes = {};
  notes[LC.ID] = 'System-generated, unique and permanent. Do not type here.';
  notes[LC.OWNER] = 'Dropdown of ACTIVE counsellors from Counsellor Master. Changing it records a reassignment.';
  notes[LC.STAGE] = 'Dropdown of ACTIVE stages from Stage Master.';
  notes[LC.SUBSTAGE] = 'Dependent dropdown: shows only the substages of the selected Lead Stage. Cleared automatically if the stage changes and it no longer fits.';
  notes[LC.LAST_CONTACT] = 'Date of the latest Contact activity (updated by the follow-up form). Cannot be in the future.';
  notes[LC.NEXT_FU] = 'Red = overdue, yellow = due today, blue = upcoming.';
  notes[LC.FU_COUNT] = 'Formula: number of Contact activities for this Lead ID in Follow-Up Log.';
  notes[LC.UPDATED_BY] = 'Counsellor (mapped from Google account) or email of the person who last changed this lead.';
  notes[LC.LAST_ACTIVITY] = 'Fixed timestamp of the latest record update or follow-up (never recalculates).';
  notes[LC.CUSTOM_FIRST] = 'Custom fields: administrators may rename headers Q1:Z1. Data stays editable.';
  notes[LC.CREATED] = 'Fixed timestamp written when the Lead ID was generated.';
  notes[LC.LAST_FU_DATE] = 'Date of the latest activity logged through the follow-up form (any type).';
  notes[LC.STAGE_CHANGED] = 'Fixed timestamp of the latest stage or substage change.';
  notes[LC.ASSIGNED_DATE] = 'Fixed timestamp of the latest (re)assignment.';
  notes[LC.PREV_OWNER] = 'Counsellor before the latest reassignment. Full history: Follow-Up Log (Lead Assigned).';
  notes[LC.ACTIVITY_TOTAL] = 'Formula: Contact + Record Update entries in Follow-Up Log (System entries excluded).';
  notes[LC.DQ_FLAGS] = 'Formula: data-quality warnings (missing/invalid contact, duplicates, stage problems, overdue).';
  notes[LC.SNAPSHOT] = 'Hidden. Used by the script to detect changes, including bulk pastes. Do not edit.';
  Object.keys(notes).forEach(function (c) { sh.getRange(1, parseInt(c, 10)).setNote(notes[c]); });
}

/** Data validation, conditional formatting, banding and filter for Lead Management (re-runnable). */
function applyLeadSheetRules_(sh) {
  var rows = sh.getMaxRows() - 1;
  var col = function (c, n) { return sh.getRange(2, c, rows, n || 1); };
  var ls = "'Lists & Settings'!";
  var settingsSheet = getSheet_(SHEET.SETTINGS);
  var listRange = function (c) { return settingsSheet.getRange(colLetter_(c) + '2:' + colLetter_(c)); };
  var dv = SpreadsheetApp.newDataValidation;

  col(1, LEAD_COLS).clearDataValidations();
  col(LC.ID).setDataValidation(dv().requireFormulaSatisfied('=COUNTIF($A$2:$A,A2)=1').setAllowInvalid(false)
    .setHelpText('Lead IDs are generated automatically and must be unique.').build());
  col(LC.MOBILE).setDataValidation(dv().requireFormulaSatisfied('=REGEXMATCH(TO_TEXT(C2),INDIRECT("SET_MOBILE_PATTERN"))')
    .setAllowInvalid(true).setHelpText('Mobile number format looks wrong (see Lists & Settings > Mobile Number Pattern). Allowed, but flagged.').build());
  col(LC.EMAIL).setDataValidation(dv().requireTextIsEmail().setAllowInvalid(true).setHelpText('Email format looks wrong. Allowed, but flagged.').build());
  col(LC.OWNER).setDataValidation(dv().requireValueInRange(listRange(LS.H_ACTIVE_CNS), true).setAllowInvalid(false)
    .setHelpText('Choose an active counsellor (Counsellor Master).').build());
  col(LC.STAGE).setDataValidation(dv().requireValueInRange(listRange(LS.H_ACTIVE_STAGES), true).setAllowInvalid(false)
    .setHelpText('Choose an active stage (Stage Master).').build());
  col(LC.SUBSTAGE).setDataValidation(noSubstageRule_(''));
  col(LC.PRIORITY).setDataValidation(dv().requireValueInRange(listRange(LS.PRIORITY), true).setAllowInvalid(false).build());
  col(LC.LAST_CONTACT).setDataValidation(dv().requireFormulaSatisfied('=AND(ISDATE(I2),INT(I2)<=TODAY())').setAllowInvalid(false)
    .setHelpText('Enter a valid date that is not in the future.').build());
  col(LC.NEXT_FU).setDataValidation(dv().requireDate().setAllowInvalid(false).setHelpText('Enter a valid date (dd-mmm-yyyy).').build());
  col(LC.OUTCOME).setDataValidation(dv().requireValueInRange(listRange(LS.OUTCOME), true).setAllowInvalid(false).build());
  col(LC.SOURCE).setDataValidation(dv().requireValueInRange(listRange(LS.SOURCE), true).setAllowInvalid(true)
    .setHelpText('Choose a source from Lists & Settings (other values are allowed but flagged).').build());
  col(LC.STATUS).setDataValidation(dv().requireValueInRange(listRange(LS.STATUS), true).setAllowInvalid(false).build());

  // Conditional formatting: earlier rules win.
  var full = col(1, LEAD_COLS);
  var cf = function (formula, ranges, bg, font, bold, extra) {
    var b = SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(formula).setRanges(ranges);
    if (bg) b.setBackground(bg);
    if (font) b.setFontColor(font);
    if (bold) b.setBold(true);
    if (extra) extra(b);
    return b.build();
  };
  sh.setConditionalFormatRules([
    cf('=$AB2="Converted"', [full], '#D5F5E3', '#145A32'),
    cf('=OR($AB2="Lost",$AB2="Duplicate")', [full], '#E5E7E9', '#7B7D7D', false, function (b) { b.setItalic(true); }),
    cf('=AND($A2<>"",COUNTIF($A$2:$A,$A2)>1)', [col(LC.ID)], COLORS.red, '#FFFFFF', true),
    cf('=AND(ISNUMBER($J2),$J2<TODAY())', [col(LC.ID), col(LC.NEXT_FU)], '#F5B7B1', '#922B21', true),
    cf('=AND(ISNUMBER($J2),INT($J2)=TODAY())', [col(LC.ID), col(LC.NEXT_FU)], '#FCF3CF', '#7D6608', true),
    cf('=AND(ISNUMBER($J2),INT($J2)>TODAY(),INT($J2)<=TODAY()+INDIRECT("SET_UPCOMING_DAYS"))', [col(LC.NEXT_FU)], '#D6EAF8', '#1B4F72'),
    cf('=$H2="Critical"', [col(LC.PRIORITY)], '#922B21', '#FFFFFF', true),
    cf('=$H2="Hot"', [col(LC.PRIORITY)], '#F5CBA7', '#784212', true),
    cf('=AND($C2<>"",ISNUMBER(SEARCH("Duplicate mobile",$AH2)))', [col(LC.MOBILE)], '#FAD7A0', '#784212'),
    cf('=AND($D2<>"",ISNUMBER(SEARCH("Duplicate email",$AH2)))', [col(LC.EMAIL)], '#FAD7A0', '#784212'),
    cf('=$AH2<>""', [col(LC.DQ_FLAGS)], null, COLORS.amber, false, function (b) { b.setItalic(true); })
  ]);

  sh.getBandings().forEach(function (b) { b.remove(); });
  col(1, LEAD_COLS).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false)
    .setFirstRowColor('#FFFFFF').setSecondRowColor(COLORS.band);

  if (sh.getFilter()) sh.getFilter().remove();
  sh.getRange(1, 1, sh.getMaxRows(), LEAD_COLS).createFilter();
}

/** Admin > Extend Lead Management by 5,000 rows. */
function extendLeadSheet() {
  requireAdmin_();
  var sh = getSheet_(SHEET.LEADS);
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    sh.insertRowsAfter(sh.getMaxRows(), 5000);
    applyLeadSheetRules_(sh);
    refreshAllSubstageValidations_();
    applyProtections_(ss_());
  } finally {
    lock.releaseLock();
  }
  toast_('Lead Management now has ' + (sh.getMaxRows() - 1) + ' data rows.');
}

/* ================================================================== */
/* Follow-Up Log                                                       */
/* ================================================================== */

function setupLogSheet_(sh) {
  ensureSize_(sh, LOG_INITIAL_ROWS + 1, LOG_COLS);
  sh.getRange(1, 1, 1, LOG_COLS).setValues([LOG_HEADERS]);
  styleHeader_(sh.getRange(1, 1, 1, LOG_COLS), COLORS.teal);
  sh.getRange(1, LG.CATEGORY, 1, 6).setBackground(COLORS.headerSystem);
  sh.setRowHeight(1, 48);
  sh.setFrozenRows(1);
  sh.setFrozenColumns(2);
  var rows = sh.getMaxRows() - 1;
  sh.getRange(2, LG.TIME, rows, 1).setNumberFormat('dd-mmm-yyyy hh:mm:ss');
  sh.getRange(2, LG.NEXT_FU, rows, 1).setNumberFormat('dd-mmm-yyyy');
  var widths = [110, 100, 170, 160, 150, 140, 140, 140, 170, 110, 280, 190, 120, 150, 150, 200, 150, 120];
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.hideColumns(LG.SUBMISSION);
  var settingsSheet = getSheet_(SHEET.SETTINGS);
  sh.getRange(2, LG.TYPE, rows, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInRange(settingsSheet.getRange('E2:E'), true).setAllowInvalid(true).build());
  sh.getRange(2, LG.CATEGORY, rows, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList([CATEGORY.CONTACT, CATEGORY.RECORD, CATEGORY.SYSTEM], true).setAllowInvalid(true).build());
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$M2="System"').setFontColor('#909497')
      .setRanges([sh.getRange(2, 1, rows, LOG_COLS)]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$M2="Record Update"').setFontColor('#1B4F72')
      .setRanges([sh.getRange(2, 1, rows, LOG_COLS)]).build()
  ]);
  if (sh.getFilter()) sh.getFilter().remove();
  sh.getRange(1, 1, sh.getMaxRows(), LOG_COLS).createFilter();
  sh.getRange(1, LG.CATEGORY).setNote('Contact = actual call/message/email. Record Update = change to lead details. System = automated change by the script.');
  sh.getRange(1, LG.COUNSELLOR).setNote('Counsellor credited with the activity (follow-up form) or the person who made the change (audit entries). "System" for automated entries.');
  sh.getRange(1, LG.OWNER).setNote('Assigned counsellor of the lead when the entry was written.');
}

/* ================================================================== */
/* Dashboard                                                           */
/* ================================================================== */

function setupDashboard_(sh) {
  var keep = {};
  [DASH.PERIOD, DASH.CUSTOM_FROM, DASH.CUSTOM_TO, DASH.COUNSELLOR].forEach(function (a1) {
    keep[a1] = sh.getRange(a1).getValue();
  });
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart().clearDataValidations();
  sh.clear();
  sh.clearConditionalFormatRules();
  sh.getBandings().forEach(function (b) { b.remove(); });
  ensureSize_(sh, 900, 30);
  sh.setHiddenGridlines(true);
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).setFontFamily('Roboto').setFontSize(10).setVerticalAlignment('middle');
  sh.setColumnWidth(1, 18);
  for (var c = 2; c <= 12; c++) sh.setColumnWidth(c, 118);
  sh.setColumnWidth(13, 24);

  var LM = function (c) { return "'Lead Management'!" + c + '2:' + c; };
  var FL = function (c) { return "'Follow-Up Log'!" + c + '2:' + c; };
  var LS_ = function (c) { return "'Lists & Settings'!" + c + '2:' + c; };
  var FROM = DASH.FROM, TO = DASH.TO, CRIT = DASH.CRIT, ALLF = DASH.ALL, SEL = DASH.SEL;
  var LEADS = LM('A') + ',"<>"';
  var CNS_LM = LM('E') + ',' + CRIT;
  var CNS_FL = FL('D') + ',' + CRIT;
  var PERIOD_FL = FL('E') + ',">="&' + FROM + ',' + FL('E') + ',"<"&(' + TO + '+1)';
  var OPEN = LM('AB') + ',"<>Converted",' + LM('AB') + ',"<>Lost",' + LM('AB') + ',"<>Duplicate"';
  var OPENB = '(' + LM('AB') + '<>"Converted")*(' + LM('AB') + '<>"Lost")*(' + LM('AB') + '<>"Duplicate")';
  var FL_CNS_B = '((' + ALLF + ')+(' + FL('D') + '=' + SEL + '))';
  var LM_CNS_B = '((' + ALLF + ')+(' + LM('E') + '=' + SEL + '))';
  var FL_PERIOD_B = FL('E') + '>=' + FROM + ',' + FL('E') + '<' + TO + '+1';
  var uniq = function (conds) { return 'ARRAYFORMULA(IFERROR(COUNTUNIQUE(FILTER(' + FL('B') + ',' + conds + ')),0))'; };

  // ---- Title and controls ----
  sh.getRange('B1').setValue('Lead CRM - MIS Dashboard').setFontSize(20).setFontWeight('bold').setFontColor(COLORS.navy);
  sh.getRange('B2').setValue('Choose a reporting period and counsellor. Activity metrics use Follow-Up Log dates; lead-generation metrics use Lead Created Date; follow-up status metrics are as of today.')
    .setFontColor('#566573').setFontStyle('italic');
  var label = function (a1, text) { sh.getRange(a1).setValue(text).setFontWeight('bold').setFontColor('#566573').setHorizontalAlignment('right'); };
  label('B4', 'Reporting Period');
  label('E4', 'Custom From');
  label('H4', 'Custom To');
  label('K4', 'Counsellor');
  label('B5', 'Applied From');
  label('E5', 'Applied To');
  label('H5', 'Last Refreshed');
  var inputs = [DASH.PERIOD, DASH.CUSTOM_FROM, DASH.CUSTOM_TO, DASH.COUNSELLOR];
  inputs.forEach(function (a1) {
    sh.getRange(a1).setBackground('#FFF9E6').setBorder(true, true, true, true, false, false, '#E6B800', SpreadsheetApp.BorderStyle.SOLID)
      .setFontWeight('bold').setHorizontalAlignment('center');
  });
  sh.getRange(DASH.PERIOD).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInRange(getSheet_(SHEET.SETTINGS).getRange('V2:V'), true).setAllowInvalid(false).build())
    .setValue(keep[DASH.PERIOD] || 'Last 30 Days');
  [DASH.CUSTOM_FROM, DASH.CUSTOM_TO].forEach(function (a1) {
    sh.getRange(a1).setNumberFormat('dd-mmm-yyyy').setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false)
      .setHelpText('Used when Reporting Period = Custom Date Range.').build());
    if (keep[a1]) sh.getRange(a1).setValue(keep[a1]);
  });
  sh.getRange(DASH.COUNSELLOR).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInRange(getSheet_(SHEET.SETTINGS).getRange('U2:U'), true).setAllowInvalid(false).build())
    .setValue(keep[DASH.COUNSELLOR] || ALL_COUNSELLORS);
  sh.getRange('C5').setFormula('=IFERROR(SWITCH($C$4,"Today",TODAY(),"Yesterday",TODAY()-1,"Last 7 Days",TODAY()-6,"Last 30 Days",TODAY()-29,' +
    '"Current Month",EOMONTH(TODAY(),-1)+1,"Previous Month",EOMONTH(TODAY(),-2)+1,"Custom Date Range",IF(ISDATE($F$4),INT($F$4),TODAY())),TODAY())');
  sh.getRange('F5').setFormula('=IFERROR(SWITCH($C$4,"Today",TODAY(),"Yesterday",TODAY()-1,"Last 7 Days",TODAY(),"Last 30 Days",TODAY(),' +
    '"Current Month",TODAY(),"Previous Month",EOMONTH(TODAY(),-1),"Custom Date Range",IF(ISDATE($I$4),INT($I$4),TODAY())),TODAY())');
  sh.getRange('C5:F5').setNumberFormat('dd-mmm-yyyy').setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange(DASH.REFRESHED).setNumberFormat('dd-mmm-yyyy hh:mm').setHorizontalAlignment('center');
  sh.getRange('K5').setFormula('=IF($C$5>$F$5,"Warning: From date is after To date","")').setFontColor(COLORS.red).setFontWeight('bold');
  // Hidden helper cells for the counsellor filter
  sh.getRange('AA1').setFormula('=IF(OR($L$4="",$L$4="' + ALL_COUNSELLORS + '"),"<>~~ALL~~",$L$4)');
  sh.getRange('AA2').setFormula('=OR($L$4="",$L$4="' + ALL_COUNSELLORS + '")');
  sh.hideColumns(27);

  // ---- KPI cards ----
  var kpis = [
    ['Total Leads', '=COUNTIFS(' + LEADS + ',' + CNS_LM + ')', 'All leads with a Lead ID. Not date-filtered.', '#,##0'],
    ['Leads Created (Period)', '=COUNTIFS(' + LEADS + ',' + CNS_LM + ',' + LM('AA') + ',">="&' + FROM + ',' + LM('AA') + ',"<"&(' + TO + '+1))', 'Leads whose Lead Created Date is in the period.', '#,##0'],
    ['Leads Worked (Period)', '=' + uniq(FL('M') + '<>"System",' + FL('M') + '<>"",' + FL_PERIOD_B + ',' + FL_CNS_B), 'Unique Lead IDs with at least one Contact or Record Update activity in the period.', '#,##0'],
    ['Unique Leads Contacted', '=' + uniq(FL('M') + '="Contact",' + FL_PERIOD_B + ',' + FL_CNS_B), 'Unique Lead IDs with at least one Contact activity in the period (each lead counted once).', '#,##0'],
    ['Follow-Ups Completed', '=COUNTIFS(' + FL('M') + ',"Contact",' + PERIOD_FL + ',' + CNS_FL + ')', 'Number of Contact activities logged in the period.', '#,##0'],
    ['Follow-Ups Pending', '=COUNTIFS(' + LEADS + ',' + CNS_LM + ',' + LM('J') + ',">="&TODAY(),' + OPEN + ')', 'Open leads with a next follow-up date today or later (as of today).', '#,##0'],
    ['Follow-Ups Overdue', '=COUNTIFS(' + LEADS + ',' + CNS_LM + ',' + LM('J') + ',"<"&TODAY(),' + OPEN + ')', 'Open leads whose next follow-up date is before today.', '#,##0'],
    ['Converted Leads', '=COUNTIFS(' + LEADS + ',' + CNS_LM + ',' + LM('AB') + ',"Converted")', 'Leads with Lead Status = Converted (current).', '#,##0'],
    ['Lost Leads', '=COUNTIFS(' + LEADS + ',' + CNS_LM + ',' + LM('AB') + ',"Lost")', 'Leads with Lead Status = Lost (current).', '#,##0'],
    ['Leads Not Contacted', '=COUNTIFS(' + LEADS + ',' + CNS_LM + ',' + LM('L') + ',0,' + OPEN + ')', 'Open leads with zero Contact activities ever (Follow-Up Count = 0).', '#,##0'],
    ['Leads With No Activity', '=COUNTIFS(' + LEADS + ',' + CNS_LM + ',' + LM('AG') + ',0)', 'Leads with no Contact or Record Update entry in the log ever (unworked).', '#,##0'],
    ['Conversion Rate', '', 'Converted Leads / Total Leads.', '0.0%']
  ];
  var cardCell = {}, cardAbs = {};
  kpis.forEach(function (k, idx) {
    var g = Math.floor(idx / 6), pos = idx % 6;
    var col = 2 + pos * 2, row = 7 + g * 4;
    cardCell[k[0]] = colLetter_(col) + (row + 1);
    cardAbs[k[0]] = '$' + colLetter_(col) + '$' + (row + 1);
    var box = sh.getRange(row, col, 3, 2);
    box.setBackground(COLORS.card).setBorder(true, true, true, true, false, false, '#D5D8DC', SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(row, col, 1, 2).merge().setFontWeight('bold').setFontColor('#566573').setHorizontalAlignment('center');
    sh.getRange(row, col).setValue(k[0]);
    sh.getRange(row + 1, col, 1, 2).merge().setFontSize(22).setFontWeight('bold').setFontColor(COLORS.navy)
      .setHorizontalAlignment('center').setNumberFormat(k[3]);
    if (k[1]) sh.getRange(row + 1, col).setFormula(k[1]);
    sh.getRange(row + 2, col, 1, 2).merge().setFontSize(8).setFontColor('#7F8C8D').setWrap(true)
      .setHorizontalAlignment('center').setVerticalAlignment('top');
    sh.getRange(row + 2, col).setValue(k[2]);
    sh.getRange(row, col).setNote(k[2]);
  });
  sh.getRange(cardCell['Conversion Rate']).setFormula('=IFERROR(' + cardCell['Converted Leads'] + '/' + cardCell['Total Leads'] + ',0)');
  [7, 11].forEach(function (r) { sh.setRowHeight(r, 24); sh.setRowHeight(r + 1, 40); sh.setRowHeight(r + 2, 34); });
  var TOTAL = cardAbs['Total Leads'];

  var layout = {};
  var row = 16;

  // ---- A. Stage-wise ----
  var A = section_(sh, row, 'A. Stage-Wise Report', ['Lead Stage', 'Total Current Leads', 'Leads Worked (Period)',
    'Follow-Ups Completed (Period)', 'Overdue Follow-Ups', 'Converted Leads', '% of Total Leads'], 25);
  sh.getRange(A.data, 2).setFormula('=ARRAY_CONSTRAIN(IFERROR(FILTER(' + LS_('S') + ',' + LS_('S') + '<>""),""),25,1)');
  blockFormulas_(sh, A, 3, function (r) {
    var b = '$B' + r;
    return [
      '=IF(' + b + '="",,COUNTIFS(' + LM('F') + ',' + b + ',' + LEADS + ',' + CNS_LM + '))',
      '=IF(' + b + '="",,' + uniq(FL('H') + '=' + b + ',' + FL('M') + '="Contact",' + FL_PERIOD_B + ',' + FL_CNS_B) + ')',
      '=IF(' + b + '="",,COUNTIFS(' + FL('H') + ',' + b + ',' + FL('M') + ',"Contact",' + PERIOD_FL + ',' + CNS_FL + '))',
      '=IF(' + b + '="",,COUNTIFS(' + LM('F') + ',' + b + ',' + LEADS + ',' + CNS_LM + ',' + LM('J') + ',"<"&TODAY(),' + OPEN + '))',
      '=IF(' + b + '="",,COUNTIFS(' + LM('F') + ',' + b + ',' + LEADS + ',' + CNS_LM + ',' + LM('AB') + ',"Converted"))',
      '=IF(' + b + '="",,IFERROR(C' + r + '/' + TOTAL + ',0))'
    ];
  });
  sh.getRange(A.data, 8, A.n, 1).setNumberFormat('0.0%');
  layout.stage = A;
  row = A.end + 2;

  // ---- B. Substage-wise ----
  var B = section_(sh, row, 'B. Substage-Wise Report', ['Lead Stage', 'Lead Substage', 'Current Lead Count',
    'Leads Worked (Period)', 'Conversion Count'], 80);
  sh.getRange(B.data, 2).setFormula('=ARRAY_CONSTRAIN(IFERROR(FILTER(' + "'Lists & Settings'!W2:X" + ',' + LS_('W') + '<>""),""),80,2)');
  blockFormulas_(sh, B, 4, function (r) {
    var b = '$B' + r, c = '$C' + r;
    return [
      '=IF(' + b + '="",,COUNTIFS(' + LM('F') + ',' + b + ',' + LM('G') + ',' + c + ',' + LEADS + ',' + CNS_LM + '))',
      '=IF(' + b + '="",,' + uniq(FL('H') + '=' + b + ',' + FL('I') + '=' + c + ',' + FL('M') + '="Contact",' + FL_PERIOD_B + ',' + FL_CNS_B) + ')',
      '=IF(' + b + '="",,COUNTIFS(' + LM('F') + ',' + b + ',' + LM('G') + ',' + c + ',' + LEADS + ',' + CNS_LM + ',' + LM('AB') + ',"Converted"))'
    ];
  });
  layout.substage = B;
  row = B.end + 2;

  // ---- C. Counsellor-wise ----
  var C = section_(sh, row, 'C. Counsellor-Wise Performance', ['Counsellor Name', 'Assigned Leads', 'Unique Leads Worked (Period)',
    'Follow-Ups Completed (Period)', 'Pending Follow-Ups', 'Overdue Follow-Ups', 'Conversions', 'Conversion Rate',
    'Leads Not Contacted', 'Avg Activities per Lead'], 40);
  sh.getRange(C.data, 2).setFormula('=ARRAY_CONSTRAIN(IF(' + ALLF + ',IFERROR(FILTER(' + "'Counsellor Master'!B2:B" + ',' + "'Counsellor Master'!B2:B" + '<>""),""),' + SEL + '),40,1)');
  blockFormulas_(sh, C, 3, function (r) {
    var b = '$B' + r;
    var mine = LM('E') + ',' + b;
    return [
      '=IF(' + b + '="",,COUNTIFS(' + mine + ',' + LEADS + '))',
      '=IF(' + b + '="",,ARRAYFORMULA(IFERROR(COUNTUNIQUE(FILTER(' + FL('B') + ',' + FL('D') + '=' + b + ',' + FL('M') + '="Contact",' + FL_PERIOD_B + ')),0)))',
      '=IF(' + b + '="",,COUNTIFS(' + FL('D') + ',' + b + ',' + FL('M') + ',"Contact",' + PERIOD_FL + '))',
      '=IF(' + b + '="",,COUNTIFS(' + mine + ',' + LEADS + ',' + LM('J') + ',">="&TODAY(),' + OPEN + '))',
      '=IF(' + b + '="",,COUNTIFS(' + mine + ',' + LEADS + ',' + LM('J') + ',"<"&TODAY(),' + OPEN + '))',
      '=IF(' + b + '="",,COUNTIFS(' + mine + ',' + LEADS + ',' + LM('AB') + ',"Converted"))',
      '=IF(' + b + '="",,IFERROR(H' + r + '/C' + r + ',0))',
      '=IF(' + b + '="",,COUNTIFS(' + mine + ',' + LEADS + ',' + LM('L') + ',0,' + OPEN + '))',
      '=IF(' + b + '="",,IFERROR(E' + r + '/D' + r + ',0))'
    ];
  });
  sh.getRange(C.data, 9, C.n, 1).setNumberFormat('0.0%');
  sh.getRange(C.data, 11, C.n, 1).setNumberFormat('0.0');
  layout.counsellor = C;
  row = C.end + 2;

  // ---- F. Ageing + G-style distribution ----
  var F = section_(sh, row, 'F. Lead Ageing & Follow-Up Ageing', ['Ageing Bucket', 'Min Days', 'Max Days',
    'Open Leads (age since Lead Created Date)', 'Due/Overdue Follow-Ups (days overdue)'], 10);
  sh.getRange(F.data, 2).setFormula('=ARRAY_CONSTRAIN(IFERROR(FILTER(' + "'Lists & Settings'!J2:L" + ',' + LS_('J') + '<>""),""),10,3)');
  blockFormulas_(sh, F, 5, function (r) {
    var b = '$B' + r, mn = '$C' + r, mx = 'IF($D' + r + '="",100000,$D' + r + ')';
    return [
      '=IF(' + b + '="",,COUNTIFS(' + LEADS + ',' + CNS_LM + ',' + OPEN + ',' + LM('AA') + ',"<"&(TODAY()-' + mn + '+1),' + LM('AA') + ',">="&(TODAY()-' + mx + ')))',
      '=IF(' + b + '="",,COUNTIFS(' + LEADS + ',' + CNS_LM + ',' + OPEN + ',' + LM('J') + ',"<="&(TODAY()-' + mn + '),' + LM('J') + ',">="&(TODAY()-' + mx + ')))'
    ];
  });
  // Lead distribution by status (H:I) and by source (K:L) on the same rows
  headerCells_(sh.getRange(F.data - 1, 8, 1, 2), ['Lead Status', 'Leads']);
  sh.getRange(F.data, 8).setFormula('=ARRAY_CONSTRAIN(IFERROR(FILTER(' + LS_('D') + ',' + LS_('D') + '<>""),""),10,1)');
  headerCells_(sh.getRange(F.data - 1, 11, 1, 2), ['Lead Source', 'Leads']);
  sh.getRange(F.data, 11).setFormula('=ARRAY_CONSTRAIN(IFERROR(FILTER(' + LS_('C') + ',' + LS_('C') + '<>""),""),10,1)');
  var dist = [], src = [];
  for (var i = 0; i < F.n; i++) {
    var r = F.data + i;
    dist.push(['=IF($H' + r + '="",,COUNTIFS(' + LM('AB') + ',$H' + r + ',' + LEADS + ',' + CNS_LM + '))']);
    src.push(['=IF($K' + r + '="",,COUNTIFS(' + LM('P') + ',$K' + r + ',' + LEADS + ',' + CNS_LM + '))']);
  }
  sh.getRange(F.data, 9, F.n, 1).setFormulas(dist);
  sh.getRange(F.data, 12, F.n, 1).setFormulas(src);
  layout.ageing = F;
  row = F.end + 2;

  // ---- G. Exceptions: unassigned / unworked ----
  var G = section_(sh, row, 'G. Exceptions - Unassigned & Unworked Leads (first 25; full lists via Lead CRM > Views)', [
    'Unassigned Lead ID', 'Lead Name', 'Mobile', 'Created', '', 'Unworked Lead ID', 'Lead Name', 'Counsellor', 'Created'], 25);
  sh.getRange(G.data - 1, 6).setValue('').setBackground(null);
  sh.getRange(G.title, 8).setFormula('="Unassigned (open): "&COUNTIFS(' + LEADS + ',' + LM('E') + ',"",' + OPEN + ')&"   |   Unworked: "&COUNTIFS(' + LEADS + ',' + CNS_LM + ',' + LM('AG') + ',0)&"   |   Leads with data-quality flags: "&COUNTIFS(' + LEADS + ',' + CNS_LM + ',' + LM('AH') + ',"?*")')
    .setFontColor(COLORS.amber).setFontWeight('bold');
  sh.getRange(G.data, 2).setFormula('=IFERROR(ARRAY_CONSTRAIN(ARRAYFORMULA(SORT(FILTER({' + LM('A') + ',' + LM('B') + ',' + LM('C') + ',' + LM('AA') + '},' +
    LM('A') + '<>"",' + LM('E') + '="",' + OPENB + '),4,TRUE)),25,4),"None")');
  sh.getRange(G.data, 7).setFormula('=IFERROR(ARRAY_CONSTRAIN(ARRAYFORMULA(SORT(FILTER({' + LM('A') + ',' + LM('B') + ',' + LM('E') + ',' + LM('AA') + '},' +
    LM('A') + '<>"",' + LM('AG') + '=0,' + LM_CNS_B + '),4,TRUE)),25,4),"None")');
  sh.getRange(G.data, 5, G.n, 1).setNumberFormat('dd-mmm-yyyy');
  sh.getRange(G.data, 10, G.n, 1).setNumberFormat('dd-mmm-yyyy');
  layout.exceptions = G;
  row = G.end + 2;

  // ---- D. Daily productivity trend ----
  var D = section_(sh, row, 'D. Daily Productivity Trend (up to 62 days of the selected period)', ['Activity Date', 'Activities (Contact + Record Update)',
    'Unique Leads Contacted', 'Follow-Ups Completed', 'Conversions'], 62);
  sh.getRange(D.data, 2).setFormula('=IFERROR(ARRAY_CONSTRAIN(SEQUENCE(MAX(1,' + TO + '-' + FROM + '+1),1,' + FROM + ',1),62,1),"")');
  sh.getRange(D.data, 2, D.n, 1).setNumberFormat('dd-mmm-yyyy');
  blockFormulas_(sh, D, 3, function (r) {
    var b = '$B' + r;
    var day = FL('E') + ',">="&' + b + ',' + FL('E') + ',"<"&(' + b + '+1)';
    return [
      '=IF(' + b + '="",,COUNTIFS(' + day + ',' + FL('M') + ',"<>System",' + FL('M') + ',"<>",' + CNS_FL + '))',
      '=IF(' + b + '="",,' + uniq(FL('M') + '="Contact",' + FL('E') + '>=' + b + ',' + FL('E') + '<' + b + '+1,' + FL_CNS_B) + ')',
      '=IF(' + b + '="",,COUNTIFS(' + day + ',' + FL('M') + ',"Contact",' + CNS_FL + '))',
      '=IF(' + b + '="",,COUNTIFS(' + day + ',' + FL('N') + ',"Lead Status",' + FL('P') + ',"Converted",' + FL('Q') + ',' + CRIT + '))'
    ];
  });
  layout.daily = D;
  row = D.end + 2;

  // ---- E. Follow-up pending report (last block: spills downward) ----
  var E = section_(sh, row, 'E. Follow-Ups Due Today or Overdue (most overdue first, up to 500)', ['Lead ID', 'Lead Name', 'Mobile Number',
    'Counsellor', 'Lead Stage', 'Lead Substage', 'Next Follow-Up Date', 'Days Overdue', 'Last Activity Timestamp'], 500);
  ensureSize_(sh, E.end + 5, 30);
  sh.getRange(E.data, 2).setFormula('=IFERROR(ARRAY_CONSTRAIN(ARRAYFORMULA(SORT(FILTER({' + LM('A') + ',' + LM('B') + ',' + LM('C') + ',' +
    LM('E') + ',' + LM('F') + ',' + LM('G') + ',' + LM('J') + ',TODAY()-INT(' + LM('J') + '),' + LM('N') + '},' +
    LM('A') + '<>"",ISNUMBER(' + LM('J') + '),' + LM('J') + '<TODAY()+1,' + OPENB + ',' + LM_CNS_B + '),8,FALSE)),500,9),"No follow-ups due today or overdue.")');
  sh.getRange(E.data, 8, E.n, 1).setNumberFormat('dd-mmm-yyyy');
  sh.getRange(E.data, 9, E.n, 1).setNumberFormat('0');
  sh.getRange(E.data, 10, E.n, 1).setNumberFormat('dd-mmm-yyyy hh:mm');
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND(ISNUMBER($I' + E.data + '),$I' + E.data + '>0)')
      .setFontColor(COLORS.red).setBold(true).setRanges([sh.getRange(E.data, 9, E.n, 1)]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND(ISNUMBER($I' + E.data + '),$I' + E.data + '=0)')
      .setFontColor('#7D6608').setBold(true).setRanges([sh.getRange(E.data, 9, E.n, 1)]).build()
  ]);
  layout.pending = E;

  PropertiesService.getDocumentProperties().setProperty(PROP.DASH_LAYOUT, JSON.stringify(layout));
  SpreadsheetApp.flush();
  buildDashboardCharts_(sh, layout);
  writeDashboardTimestamp_(sh);
  sh.setFrozenRows(5);
}

/** Section title + header row; returns {title, data, n, end}. */
function section_(sh, row, title, headers, n) {
  sh.getRange(row, 2).setValue(title).setFontSize(13).setFontWeight('bold').setFontColor(COLORS.navy);
  sh.getRange(row, 2, 1, 11).setBorder(null, null, true, null, null, null, COLORS.navy, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  headerCells_(sh.getRange(row + 1, 2, 1, headers.length), headers);
  sh.setRowHeight(row + 1, 36);
  return { title: row, data: row + 2, n: n, end: row + 1 + n };
}

function headerCells_(range, headers) {
  range.setValues([headers]);
  range.setBackground(COLORS.navy).setFontColor('#FFFFFF').setFontWeight('bold').setWrap(true)
    .setHorizontalAlignment('center').setFontSize(9);
}

/** Writes per-row formulas for a section starting at column `startCol`. */
function blockFormulas_(sh, sec, startCol, fn) {
  var out = [];
  for (var i = 0; i < sec.n; i++) out.push(fn(sec.data + i));
  sh.getRange(sec.data, startCol, sec.n, out[0].length).setFormulas(out).setHorizontalAlignment('center');
}

function writeDashboardTimestamp_(sh) {
  sh = sh || getSheet_(SHEET.DASHBOARD);
  sh.getRange(DASH.REFRESHED).setValue(new Date()).setNumberFormat('dd-mmm-yyyy hh:mm');
}

/** Number of filled rows in a dashboard block's label column (at least 1). */
function filledRows_(sh, sec, col) {
  var vals = sh.getRange(sec.data, col || 2, sec.n, 1).getDisplayValues();
  var n = 0;
  vals.forEach(function (v, i) { if (str_(v[0]) !== '') n = i + 1; });
  return Math.max(n, 1);
}

function buildDashboardCharts_(sh, layout) {
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  var hdr = function (sec, col, rows) { return sh.getRange(sec.data - 1, col, rows + 1, 1); };
  var add = function (type, ranges, anchorRow, title, opts) {
    var b = sh.newChart().setChartType(type);
    ranges.forEach(function (r) { b.addRange(r); });
    b.setPosition(anchorRow, DASH.CHART_COL, 0, 0)
      .setNumHeaders(1)
      .setHiddenDimensionStrategy(Charts.ChartHiddenDimensionStrategy.IGNORE_BOTH)
      .setOption('title', title)
      .setOption('titleTextStyle', { color: COLORS.navy, fontSize: 13, bold: true })
      .setOption('legend', { position: 'bottom' })
      .setOption('colors', COLORS.palette)
      .setOption('width', 640)
      .setOption('height', 320)
      .setOption('backgroundColor', '#FFFFFF');
    Object.keys(opts || {}).forEach(function (k) { b.setOption(k, opts[k]); });
    sh.insertChart(b.build());
  };
  var nStage = filledRows_(sh, layout.stage);
  add(Charts.ChartType.BAR, [hdr(layout.stage, 2, nStage), hdr(layout.stage, 3, nStage), hdr(layout.stage, 4, nStage)],
    layout.stage.title, 'Leads by Stage (current) and Leads Worked in Period');
  var nCns = filledRows_(sh, layout.counsellor);
  add(Charts.ChartType.COLUMN, [hdr(layout.counsellor, 2, nCns), hdr(layout.counsellor, 4, nCns), hdr(layout.counsellor, 5, nCns)],
    layout.counsellor.title, 'Counsellor Productivity (selected period)');
  add(Charts.ChartType.LINE, [hdr(layout.daily, 2, layout.daily.n), hdr(layout.daily, 3, layout.daily.n),
    hdr(layout.daily, 4, layout.daily.n), hdr(layout.daily, 5, layout.daily.n)],
    layout.daily.title, 'Daily Activity Trend', { pointSize: 4 });
  var nStatus = filledRows_(sh, layout.ageing, 8);
  add(Charts.ChartType.PIE, [hdr(layout.ageing, 8, nStatus), hdr(layout.ageing, 9, nStatus)],
    layout.ageing.title, 'Lead Distribution by Status', { pieHole: 0.45 });
  var nAge = filledRows_(sh, layout.ageing);
  add(Charts.ChartType.COLUMN, [hdr(layout.ageing, 2, nAge), hdr(layout.ageing, 5, nAge), hdr(layout.ageing, 6, nAge)],
    layout.ageing.title + 17, 'Lead Ageing & Follow-Up Ageing (open leads)');
  var nSub = filledRows_(sh, layout.substage);
  add(Charts.ChartType.BAR, [hdr(layout.substage, 3, nSub), hdr(layout.substage, 4, nSub)],
    layout.substage.title, 'Current Leads by Substage', { height: Math.max(320, nSub * 22) });
}

/** Resizes chart ranges to the current number of stages / counsellors etc. Requires edit rights on Dashboard. */
function refreshDashboardCharts_() {
  var raw = PropertiesService.getDocumentProperties().getProperty(PROP.DASH_LAYOUT);
  if (!raw) return;
  var sh = getSheet_(SHEET.DASHBOARD);
  SpreadsheetApp.flush();
  buildDashboardCharts_(sh, JSON.parse(raw));
}

/** Menu: Lead CRM > Refresh Dashboard. */
function refreshDashboard() {
  var sh = getSheet_(SHEET.DASHBOARD);
  writeDashboardTimestamp_(sh);
  SpreadsheetApp.flush();
  var resized = true;
  try { refreshDashboardCharts_(); } catch (e) { resized = false; }
  ss_().setActiveSheet(sh);
  toast_('Dashboard refreshed' + (resized ? '' : ' (charts can only be resized by an administrator)') + '.');
}

/* ================================================================== */
/* Protections, triggers, counters                                     */
/* ================================================================== */

/**
 * Strict protection (admins only): header row of Lead Management, master sheets, Lists & Settings,
 * Dashboard (except its filter cells). Warning-only protection: system / formula columns of Lead
 * Management and the whole Follow-Up Log — the follow-up form and simple trigger run as the caller and
 * must be able to write there, and callers must be able to sort the sheet.
 */
function applyProtections_(ss) {
  clearMemo_();
  var admins = getAdminEmails_();
  var me = '';
  try { me = Session.getEffectiveUser().getEmail(); } catch (e) { /* ignore */ }
  if (me && admins.indexOf(me.toLowerCase()) < 0) admins.push(me.toLowerCase());

  ss.getSheets().forEach(function (s) {
    s.getProtections(SpreadsheetApp.ProtectionType.RANGE).concat(s.getProtections(SpreadsheetApp.ProtectionType.SHEET))
      .forEach(function (p) { if (/^CRM:/.test(p.getDescription() || '')) { try { p.remove(); } catch (e) { /* not ours to remove */ } } });
  });

  var strict = function (p, desc) {
    p.setDescription('CRM: ' + desc).setWarningOnly(false);
    try { p.addEditors(admins); } catch (e) { console.warn('addEditors: ' + e); }
    var remove = p.getEditors().filter(function (u) { return admins.indexOf(String(u.getEmail()).toLowerCase()) < 0; });
    if (remove.length) { try { p.removeEditors(remove); } catch (e) { console.warn('removeEditors: ' + e); } }
    if (p.canDomainEdit()) p.setDomainEdit(false);
    return p;
  };
  var warn = function (p, desc) { p.setDescription('CRM: ' + desc).setWarningOnly(true); return p; };

  var leads = ss.getSheetByName(SHEET.LEADS);
  var rows = leads.getMaxRows() - 1;
  strict(leads.getRange(1, 1, 1, LEAD_COLS).protect(), 'Lead Management header row (admins rename custom fields)');
  warn(leads.getRange(2, LC.ID, rows, 1).protect(), 'Lead ID (system)');
  warn(leads.getRange(2, LC.FU_COUNT, rows, 1).protect(), 'Follow-Up Count (formula)');
  warn(leads.getRange(2, LC.UPDATED_BY, rows, 2).protect(), 'Last Updated By / Timestamp (system)');
  warn(leads.getRange(2, LC.CREATED, rows, 1).protect(), 'Lead Created Date (system)');
  warn(leads.getRange(2, LC.LAST_FU_DATE, rows, 4).protect(), 'Tracking dates (system)');
  warn(leads.getRange(2, LC.ACTIVITY_TOTAL, rows, 3).protect(), 'Formula and audit columns');

  warn(ss.getSheetByName(SHEET.LOG).protect(), 'Follow-Up Log is append-only - use Lead CRM > Log Follow-Up');
  strict(ss.getSheetByName(SHEET.STAGES).protect(), 'Stage Master (admins)');
  strict(ss.getSheetByName(SHEET.COUNSELLORS).protect(), 'Counsellor Master (admins)');
  strict(ss.getSheetByName(SHEET.SETTINGS).protect(), 'Lists & Settings (admins)');
  var dash = ss.getSheetByName(SHEET.DASHBOARD);
  var dp = strict(dash.protect(), 'Dashboard formulas and charts (admins)');
  dp.setUnprotectedRanges([DASH.PERIOD, DASH.CUSTOM_FROM, DASH.CUSTOM_TO, DASH.COUNSELLOR, DASH.REFRESHED]
    .map(function (a1) { return dash.getRange(a1); }));
}

/** Admin > Reapply protections (after editing the Admin Emails setting). */
function reapplyProtections() {
  requireAdmin_();
  applyProtections_(ss_());
  toast_('Protections reapplied for administrators: ' + getAdminEmails_().join(', '));
}

function installCoreTriggers_(ss) {
  var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'onChangeInstallable'; });
  if (!has) ScriptApp.newTrigger('onChangeInstallable').forSpreadsheet(ss).onChange().create();
}

function initCounters_() {
  var props = PropertiesService.getDocumentProperties();
  var settings = getSettings_();
  if (!props.getProperty(PROP.LEAD_SEQ)) {
    props.setProperty(PROP.LEAD_SEQ, String(maxIdNumber_(getSheet_(SHEET.LEADS), LC.ID, settings.leadPrefix)));
  }
  if (!props.getProperty(PROP.ACT_SEQ)) {
    props.setProperty(PROP.ACT_SEQ, String(maxIdNumber_(getSheet_(SHEET.LOG), LG.ACT_ID, settings.actPrefix)));
  }
  if (!props.getProperty(PROP.EDIT_MODE)) props.setProperty(PROP.EDIT_MODE, 'simple');
}

/**
 * Admin > Recalculate ID counters: sets the Lead / Activity counters to the highest ID currently in
 * the sheets. Use after deleting test data before go-live (new IDs then continue from there).
 */
function recalculateIdCounters() {
  requireAdmin_();
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var props = PropertiesService.getDocumentProperties();
    var settings = getSettings_();
    var lead = maxIdNumber_(getSheet_(SHEET.LEADS), LC.ID, settings.leadPrefix);
    var act = maxIdNumber_(getSheet_(SHEET.LOG), LG.ACT_ID, settings.actPrefix);
    props.setProperty(PROP.LEAD_SEQ, String(lead));
    props.setProperty(PROP.ACT_SEQ, String(act));
    alert_('Counters reset. Next Lead ID: ' + settings.leadPrefix + pad_(lead + 1, settings.leadDigits) +
      '\nNext Activity ID: ' + settings.actPrefix + pad_(act + 1, 6));
  } finally {
    lock.releaseLock();
  }
}
