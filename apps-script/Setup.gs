/**
 * Setup.gs
 * setupWorkbook() builds (or repairs) the whole CRM in the current spreadsheet:
 * 11 sheets, headers, formatting, strict data validation, conditional formatting, protections,
 * hidden admin sheets, sample master data, the dashboard and the installable triggers.
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
  card: '#F4F6F9', band: '#F4F7FB', lockedHeader: '#D5D8DC', lockedHeaderFont: '#2C3E50', lockedCell: '#F2F3F4', palette: ['#2E75B6', '#117A65', '#E67E22', '#8E44AD', '#C0392B', '#7F8C8D']
};

/* ================================================================== */
/* Entry point                                                         */
/* ================================================================== */

/*
 * Setup runs in resumable stages. Progress is saved in Document Properties after every stage;
 * a run stops before the time budget is used up and the next run continues where it left off.
 * Every stage is idempotent, so re-running a stage that was interrupted is safe.
 */
var SETUP_STATE_KEY = 'SETUP_STATE';
var SETUP_ROWS_KEY = 'SETUP_ROWS';
var QUICK_TEST_ROWS = 1000;
/** Time budget per execution (Apps Script hard limit is 6 minutes). */
var SETUP_BUDGET_MS = 270000;

/** [name, function(ctx), estimated seconds for 10,000 rows] */
var SETUP_STAGES = [
  ['Create sheets', function (c) { ensureSheets_(c.ss); }, 10],
  ['Lists & Settings', function (c) {
    var sh = c.ss.getSheetByName(SHEET.SETTINGS);
    setupSettingsSheet_(sh, c.me);
    createNamedRanges_(c.ss, sh);
  }, 20],
  ['Stage Master & Counsellor Master', function (c) {
    setupStageMaster_(c.ss.getSheetByName(SHEET.STAGES));
    setupCounsellorMaster_(c.ss.getSheetByName(SHEET.COUNSELLORS));
  }, 20],
  ['Lead Management layout', function (c) { setupLeadSheetLayout_(c.ss.getSheetByName(SHEET.LEADS), c.rows); }, 40],
  ['Lead Management validation & colours', function (c) {
    applyLeadSheetRules_(c.ss.getSheetByName(SHEET.LEADS));
    refreshDateValidations_(true);
  }, 60],
  ['Follow-Up Log, Access Log & Deleted Leads', function (c) {
    setupLogSheet_(c.ss.getSheetByName(SHEET.LOG), c.rows);
    setupAccessLogSheet_(c.ss.getSheetByName(SHEET.ACCESS_LOG));
    setupDeletedLeadsSheet_(c.ss.getSheetByName(SHEET.DELETED));
  }, 30],
  ['Lead rows, formulas & data quality', function (c) {
    setupLeadFormulas_(c.ss.getSheetByName(SHEET.LEADS));
    processFollowUpQueue_();
    upgradeLeadRows_(c.ss.getSheetByName(SHEET.LEADS), c.me);
    refreshAllSubstageValidations_();   // rows that already hold leads only
    refreshDataQuality_();
  }, 40],
  ['Lead Entry, Start Here & Field Guide', function (c) {
    setupLeadEntrySheet_(c.ss.getSheetByName(SHEET.ENTRY));
    setupStartHere_(c.ss.getSheetByName(SHEET.START));
    setupFieldGuide_(c.ss.getSheetByName(SHEET.GUIDE));
  }, 30],
  ['Dashboard layout', function (c) { setupDashboard_(c.ss.getSheetByName(SHEET.DASHBOARD)); }, 40],
  ['Dashboard data & charts', function (c) { refreshDashboardCharts_(); }, 40],
  ['Protections, hidden sheets & triggers', function (c) {
    initCounters_();
    applyProtections_(c.ss);
    installCoreTriggers_(c.ss);
    removeDefaultSheets_(c.ss);
    rememberLeadCount_();
    hideAdminSheets_();
  }, 40]
];

/** Full build / repair with 10,000 lead rows (continues an unfinished setup). */
function setupWorkbook() {
  runSetup_(null);
}

/** Quick build with 1,000 lead rows for testing (Admin menu or run from the editor). */
function setupWorkbookQuickTest() {
  runSetup_(QUICK_TEST_ROWS);
}

/** Forgets saved progress so the next setup run starts from stage 1 (data is not touched). */
function restartSetup() {
  PropertiesService.getDocumentProperties().deleteProperty(SETUP_STATE_KEY);
  notify_('Setup progress cleared. Run Set up / repair workbook again to start from the first stage.');
}

function runSetup_(rowsOverride) {
  var t0 = Date.now();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getDocumentProperties();
  var state = null;
  try { state = JSON.parse(props.getProperty(SETUP_STATE_KEY) || 'null'); } catch (e) { state = null; }
  if (!state) {
    var firstRun = !ss.getSheetByName(SHEET.LEADS) || !ss.getSheetByName(SHEET.SETTINGS);
    if (!firstRun) requireAdmin_();
    state = { next: 0, firstRun: firstRun, rows: LEAD_DATA_ROWS, started: new Date().toISOString() };
  } else if (!state.firstRun) {
    requireAdmin_();
  }
  if (rowsOverride) state.rows = rowsOverride;
  props.setProperty(SETUP_ROWS_KEY, String(state.rows));

  var me = '';
  try { me = Session.getEffectiveUser().getEmail(); } catch (e) { /* ignore */ }
  var ctx = { ss: ss, me: me, rows: state.rows };
  var budget = SETUP_BUDGET_MS;
  var total = SETUP_STAGES.length;
  var scale = Math.max(state.rows / LEAD_DATA_ROWS, 0.2);

  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    while (state.next < total) {
      var stage = SETUP_STAGES[state.next];
      var elapsed = Date.now() - t0;
      // Always run at least one stage per execution; otherwise only start a stage that should fit.
      if (state.ranThisExecution && elapsed + stage[2] * 1000 * scale > budget) break;
      ss.toast('Stage ' + (state.next + 1) + ' of ' + total + ': ' + stage[0] + '...', CRM_TITLE, 120);
      var s0 = Date.now();
      clearMemo_();
      stage[1](ctx);
      SpreadsheetApp.flush();
      console.log('Setup stage ' + (state.next + 1) + '/' + total + ' "' + stage[0] + '" took ' +
        Math.round((Date.now() - s0) / 1000) + ' s (rows: ' + state.rows + ')');
      state.next++;
      state.ranThisExecution = true;
      var save = JSON.parse(JSON.stringify(state));
      delete save.ranThisExecution;
      props.setProperty(SETUP_STATE_KEY, JSON.stringify(save));
    }
  } finally {
    lock.releaseLock();
  }

  if (state.next < total) {
    var msg = 'Setup is NOT finished yet: completed ' + state.next + ' of ' + total + ' stages in ' +
      Math.round((Date.now() - t0) / 1000) + ' s.\n\n' +
      'Run it again (Lead CRM > Admin > Set up / repair workbook, or Run > setupWorkbook in the editor) ' +
      'to continue from stage ' + (state.next + 1) + ': "' + SETUP_STAGES[state.next][0] + '".';
    notify_(msg);
    return;
  }

  props.deleteProperty(SETUP_STATE_KEY);
  props.setProperty('CRM_VERSION', CRM_VERSION);
  ss.setActiveSheet(ss.getSheetByName(SHEET.START));
  clearMemo_();
  var done = 'Lead CRM ' + (state.firstRun ? 'created' : 'repaired') + ' with ' + state.rows.toLocaleString() +
    ' lead rows.\n\n' +
    'Next steps:\n' +
    '1. Reload the spreadsheet tab to see the Lead CRM menu.\n' +
    '2. Lead CRM > Admin > Show admin sheets. Replace the SAMPLE rows in Stage Master and Counsellor Master with your own.\n' +
    '3. Put each counsellor\'s Google account email in Counsellor Master.\n' +
    '4. Add administrator emails in Lists & Settings > "' + SET.ADMINS + '", then Lead CRM > Admin > Reapply protections.\n' +
    '5. Add leads in Lead Entry, then Lead CRM > Add leads from Lead Entry.\n' +
    '6. Share the spreadsheet with counsellors as Editors. Each counsellor opens Lead CRM > My overdue follow-ups once.\n\n' +
    'See docs/SETUP.md for details.';
  notify_(done);
}

/**
 * Non-blocking message: a modeless dialog in the spreadsheet plus the execution log.
 * (ui.alert would pause the script until someone clicks OK in the spreadsheet tab, which can
 * use up the whole execution time when setup is started from the Apps Script editor.)
 */
function notify_(msg) {
  console.log(msg);
  try {
    var html = HtmlService.createHtmlOutput('<div style="font-family:Roboto,Arial;font-size:13px;white-space:pre-wrap;line-height:1.45">' +
      String(msg).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</div>').setWidth(520).setHeight(320);
    SpreadsheetApp.getUi().showModelessDialog(html, CRM_TITLE);
  } catch (e) {
    toast_(String(msg).split('\n')[0], 15);
  }
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
  tabColors[SHEET.START] = COLORS.teal;
  tabColors[SHEET.GUIDE] = COLORS.teal;
  tabColors[SHEET.ENTRY] = COLORS.navy;
  tabColors[SHEET.DELETED] = COLORS.red;
  tabColors[SHEET.LEADS] = COLORS.navy;
  tabColors[SHEET.LOG] = COLORS.teal;
  tabColors[SHEET.STAGES] = COLORS.grey;
  tabColors[SHEET.COUNSELLORS] = COLORS.grey;
  tabColors[SHEET.DASHBOARD] = '#E67E22';
  tabColors[SHEET.SETTINGS] = COLORS.grey;
  tabColors[SHEET.ACCESS_LOG] = COLORS.grey;
  var out = {};
  SHEET_ORDER.forEach(function (name, i) {
    var s = ss.getSheetByName(name);
    if (!s) s = ss.insertSheet(name, i);
    if (s.isSheetHidden()) s.showSheet();
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
    [ACT.LOG_EDITED, CATEGORY.SYSTEM, 'No'],
    [ACT.FIELD_UPDATED, CATEGORY.RECORD, 'No'],
    [ACT.SHEET_UPDATE, CATEGORY.CONTACT, 'No'],
    [ACT.EDIT_REVERTED, CATEGORY.SYSTEM, 'No'],
    [ACT.SYS_CORRECTED, CATEGORY.RECORD, 'No'],
    [ACT.CORRECTION_OPENED, CATEGORY.SYSTEM, 'No'],
    [ACT.LEAD_DELETED, CATEGORY.SYSTEM, 'No'],
    [ACT.LEAD_RESTORED, CATEGORY.SYSTEM, 'No'],
    [ACT.LEAD_PURGED, CATEGORY.SYSTEM, 'No']
  ],
  buckets: [['0-3 Days', 0, 3], ['4-7 Days', 4, 7], ['8-15 Days', 8, 15], ['16-30 Days', 16, 30], ['More Than 30 Days', 31, '']]
};

function setupSettingsSheet_(sh, me) {
  ensureSize_(sh, 200, LS.EDITABLE);
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
  var headerRow = [];
  for (var hc = 1; hc <= LS.H_PAIRS + 1; hc++) headerRow.push(headers[hc] || '');
  sh.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);

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
    // Settings of features that no longer exist are removed (key, value and description).
    keys.forEach(function (k, i) {
      if (OBSOLETE_SETTINGS.some(function (o) { return o.toLowerCase() === k; })) sh.getRange(i + 2, LS.SET_KEY, 1, 3).clearContent();
    });
    upgradeActivityTypes_(sh);
  }

  // Setting values with fixed choices get a dropdown.
  var lastSet = Math.max(sh.getLastRow(), 2);
  var keyVals = sh.getRange(2, LS.SET_KEY, lastSet - 1, 1).getValues();
  sh.getRange(2, LS.SET_VALUE, keyVals.length, 1).setDataValidations(keyVals.map(function (r) {
    var def = DEFAULT_SETTINGS.filter(function (d) { return same_(d[0], r[0]); })[0];
    return [def && def[3] ? SpreadsheetApp.newDataValidation().requireValueInList(def[3], true).setAllowInvalid(false).build() : null];
  }));

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
  setupCustomFieldTable_(sh);
  setupEditableFieldList_(sh);
  styleHeader_(sh.getRange(1, LS.CF_SLOT, 1, 4), COLORS.headerCustom);
  sh.getRange(2, LS.H_ACTIVE_STAGES, sh.getMaxRows() - 1, 7).setBackground('#F2F3F4').setFontColor('#566573');
  sh.setRowHeight(1, 40);
  sh.setColumnWidths(1, LS.CF_ACTIVE, 140);
  sh.setColumnWidth(LS.CF_SLOT - 1, 24);
  sh.setColumnWidth(LS.CF_NAME, 200);
  sh.setColumnWidth(LS.CF_ALLOWED, 260);
  [9, 13, 17].forEach(function (c) { sh.setColumnWidth(c, 24); });
  sh.setColumnWidth(LS.SET_KEY, 260);
  sh.setColumnWidth(LS.SET_VALUE, 200);
  sh.setColumnWidth(LS.SET_DESC, 480);
  sh.getRange(2, LS.SET_DESC, sh.getMaxRows() - 1, 1).setWrap(true).setFontColor('#566573');
  sh.getRange(1, LS.SET_KEY).setNote('Settings are read by name: edit the Value column only. Keep names unchanged.');
  sh.getRange(1, LS.H_ACTIVE_STAGES).setNote('Columns R:X are calculated automatically from Stage Master / Counsellor Master. Do not type here.');
}

/** Adds the activity types written by newer versions to an existing Activity Type list. */
function upgradeActivityTypes_(sh) {
  var last = Math.max(sh.getLastRow(), 2);
  var have = sh.getRange(2, LS.ACT_TYPE, last - 1, 1).getValues().map(function (r) { return str_(r[0]).toLowerCase(); });
  var lastRow = 1;
  have.forEach(function (t, i) { if (t) lastRow = i + 2; });
  var add = DEFAULT_LISTS.activityTypes.filter(function (t) { return have.indexOf(t[0].toLowerCase()) < 0; });
  if (add.length) writeRows_(sh, lastRow + 1, LS.ACT_TYPE, add, 3);
}

/**
 * Lists & Settings column AE: the Lead Management fields counsellors may edit (everything else is locked).
 * Replaces the older "Counsellor-Locked Fields" list in AD, which is cleared.
 */
function setupEditableFieldList_(sh) {
  var old = sh.getRange(1, LS.OLD_LOCKED);
  if (same_(old.getValue(), 'Counsellor-Locked Fields')) {
    sh.getRange(1, LS.OLD_LOCKED, sh.getMaxRows(), 1).clearContent().clearDataValidations();
    old.clearNote();
  }
  var head = sh.getRange(1, LS.EDITABLE);
  if (!same_(head.getValue(), EDITABLE_HEADER)) {
    head.setValue(EDITABLE_HEADER);
    sh.getRange(2, LS.EDITABLE, sh.getMaxRows() - 1, 1).clearContent();
    writeList_(sh, LS.EDITABLE, DEFAULT_EDITABLE_FIELDS);
  }
  styleHeader_(head, COLORS.teal);
  sh.setColumnWidth(LS.OLD_LOCKED, 24);
  sh.setColumnWidth(LS.EDITABLE, 220);
  var choices = EDITABLE_CANDIDATE_COLS.map(function (c) { return LEAD_HEADERS[c - 1]; }).concat([ALL_CUSTOM_FIELDS]);
  sh.getRange(2, LS.EDITABLE, sh.getMaxRows() - 1, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(choices, true).setAllowInvalid(true)
    .setHelpText('Fields counsellors may change on their own leads. A single custom field may be listed by its Field Name.').build());
  head.setNote('One field per row. Counsellors can change ONLY these columns, on their own leads (white cells). ' +
    'Everything else is grey and locked. Contact, assignment and automatic columns can never be added. Changes apply immediately.');
}

function setupAccessLogSheet_(sh) {
  ensureSize_(sh, 1000, AL_HEADERS.length);
  sh.getRange(1, 1, 1, AL_HEADERS.length).setValues([AL_HEADERS]);
  styleHeader_(sh.getRange(1, 1, 1, AL_HEADERS.length), COLORS.headerSystem);
  sh.setFrozenRows(1);
  sh.setColumnWidths(1, AL_HEADERS.length, 150);
  sh.setColumnWidth(6, 360);
  sh.getRange(2, 1, sh.getMaxRows() - 1, 1).setNumberFormat('dd-mmm-yyyy hh:mm:ss');
  sh.getRange(1, 4).setNote('Who viewed or changed what in the counsellor web app (and who opened this spreadsheet). Written by the script; admins only.');
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

/** Header colours: editable = navy, admin-only = blue-grey, automatic = light grey. */
function colourLeadHeaders_(sh) {
  var bg = [], fg = [];
  for (var c = 1; c <= LEAD_COLS; c++) {
    if (isEditableCol_(c)) { bg.push(isCustomCol_(c) ? COLORS.headerCustom : COLORS.headerUser); fg.push('#FFFFFF'); }
    else if (isSystemCol_(c)) { bg.push(COLORS.lockedHeader); fg.push(COLORS.lockedHeaderFont); }
    else { bg.push(COLORS.headerSystem); fg.push('#FFFFFF'); }
  }
  sh.getRange(1, 1, 1, LEAD_COLS).setBackgrounds([bg]).setFontColors([fg]);
}

/** Re-applies everything that depends on the Counsellor-Editable Fields list (colours, notes, rules, protection). */
function applyLockedColumns_() {
  clearMemo_();
  var sh = getSheet_(SHEET.LEADS);
  colourLeadHeaders_(sh);
  addLeadHeaderNotes_(sh);
  applyLeadSheetRules_(sh);
  refreshDateValidations_(true);
  refreshAllSubstageValidations_();
  applyProtections_(ss_());
}

/** Headers, header colours, number formats, widths and notes (no formulas, no validation). */
function setupLeadSheetLayout_(sh, dataRows) {
  ensureSize_(sh, (dataRows || LEAD_DATA_ROWS) + 1, LEAD_COLS);
  migrateOldCustomFieldLayout_(sh);
  // Unused columns to the right are removed (nothing can be typed there).
  if (sh.getMaxColumns() > LEAD_COLS) {
    if (sh.getFilter()) sh.getFilter().remove();
    sh.deleteColumns(LEAD_COLS + 1, sh.getMaxColumns() - LEAD_COLS);
  }
  var header = sh.getRange(1, 1, 1, LEAD_COLS);
  var existing = header.getValues()[0];
  var headers = LEAD_HEADERS.map(function (h, i) {
    var c = i + 1;
    // Custom field headers come from the Custom Fields table (applyCustomFields_ below);
    // formula headers are written in a later stage.
    if (isCustomCol_(c)) return str_(existing[i]) || h;
    if (LEAD_FORMULA_COLS.indexOf(c) >= 0) return existing[i] === '' ? h : existing[i];
    return h;
  });
  // Formula header cells may already hold a formula (repair run): only write plain-text headers.
  var formulasNow = header.getFormulas()[0];
  var plainCols = [];
  for (var pc = 1; pc <= LEAD_COLS; pc++) if (!formulasNow[pc - 1]) plainCols.push(pc);
  colRuns_(plainCols).forEach(function (r) { sh.getRange(1, r[0], 1, r[1] - r[0] + 1).setValues([headers.slice(r[0] - 1, r[1])]); });

  styleHeader_(header, COLORS.headerUser);
  colourLeadHeaders_(sh);
  sh.setRowHeight(1, 48);
  sh.setFrozenRows(1);
  sh.setFrozenColumns(2);

  // One call per column range (never per row).
  var rows = sh.getMaxRows() - 1;
  var col = function (c, n) { return sh.getRange(2, c, rows, n || 1); };
  col(LC.ID).setFontWeight('bold').setFontColor(COLORS.navy);
  col(LC.MOBILE).setNumberFormat('@');
  col(LC.LAST_CONTACT, 2).setNumberFormat('dd-mmm-yyyy');
  col(LC.FU_COUNT).setNumberFormat('0').setHorizontalAlignment('center');
  col(LC.LAST_ACTIVITY).setNumberFormat('dd-mmm-yyyy hh:mm');
  col(LC.CREATED).setNumberFormat('dd-mmm-yyyy hh:mm');
  col(LC.LAST_FU_DATE).setNumberFormat('dd-mmm-yyyy');
  col(LC.STAGE_CHANGED, 2).setNumberFormat('dd-mmm-yyyy hh:mm');
  col(LC.ACTIVITY_TOTAL).setNumberFormat('0').setHorizontalAlignment('center');

  sh.setColumnWidths(1, LEAD_COLS, 120);
  var widths = {};
  widths[LC.ID] = 100; widths[LC.NAME] = 170; widths[LC.EMAIL] = 190; widths[LC.OWNER] = 160;
  widths[LC.SUBSTAGE] = 170; widths[LC.PRIORITY] = 80; widths[LC.REMARKS] = 240; widths[LC.DQ_FLAGS] = 280;
  widths[LC.UPDATED_BY] = 170; widths[LC.LAST_ACTIVITY] = 140;
  Object.keys(widths).forEach(function (k) { sh.setColumnWidth(parseInt(k, 10), widths[k]); });
  sh.hideColumns(LC.SNAPSHOT);
  addLeadHeaderNotes_(sh);
  applyCustomFields_();   // header names + hide inactive slots (data is never touched)
}

/** Restores the fixed header texts and the two header formulas (row 1 can only be changed by admins). */
function restoreLeadHeaders_(sh) {
  var exp = expectedLeadHeaders_();
  var f = leadHeaderFormulas_();
  for (var c = 1; c <= LEAD_COLS; c++) {
    if (isCustomCol_(c)) continue;
    if (c === LC.FU_COUNT) sh.getRange(1, c).setFormula(f.fuCount);
    else if (c === LC.ACTIVITY_TOTAL) sh.getRange(1, c).setFormula(f.activityTotal);
    else sh.getRange(1, c).setValue(exp[c - 1]);
  }
}

/** Header-row ARRAYFORMULAs (V1, AG1). Written in their own stage because they trigger recalculation. */
function setupLeadFormulas_(sh) {
  var f = leadHeaderFormulas_();
  sh.getRange(1, LC.FU_COUNT).setFormula(f.fuCount);
  sh.getRange(1, LC.ACTIVITY_TOTAL).setFormula(f.activityTotal);
  // Data Quality Flags used to be an ARRAYFORMULA; it is now written by the script (DataQuality.gs).
  var dq = sh.getRange(1, LC.DQ_FLAGS);
  if (dq.getFormula()) { dq.setValue(LEAD_HEADERS[LC.DQ_FLAGS - 1]); sh.getRange(2, LC.DQ_FLAGS, sh.getMaxRows() - 1, 1).clearContent(); }
}

function leadHeaderFormulas_() {
  var log = "'Follow-Up Log'!B2:M";
  return {
    fuCount: '={"Follow-Up Count";ARRAYFORMULA(IF(A2:A="",,IFERROR(VLOOKUP(A2:A,QUERY(' + log +
      ',"select B, count(B) where B <> \'\' and M = \'Contact\' group by B label count(B) \'\'",0),2,FALSE),0)))}',
    activityTotal: '={"Total Activities";ARRAYFORMULA(IF(A2:A="",,IFERROR(VLOOKUP(A2:A,QUERY(' + log +
      ',"select B, count(B) where B <> \'\' and M <> \'System\' and M <> \'\' group by B label count(B) \'\'",0),2,FALSE),0)))}'
  };
}

/**
 * Upgrade / repair of existing lead rows: rows with data but no Lead ID (typed before this version) get an
 * ID; every lead gets a full snapshot of its current values (the reference the edit guard restores from).
 * Pending requirements already recorded in a snapshot are kept.
 */
function upgradeLeadRows_(sh, me) {
  var last = lastLeadRow_(sh);
  if (last < 2) return 0;
  var n = last - 1;
  var data = sh.getRange(2, 1, n, LEAD_COLS).getValues();
  var settings = getSettings_();
  var stageInfo = getStageInfo_();
  var now = new Date();
  var actor = { email: me || 'Setup', label: 'Setup', name: '' };
  var ids = {};
  data.forEach(function (r) { var id = str_(r[LC.ID - 1]); if (id) ids[id.toLowerCase()] = true; });
  var entries = [], snaps = [], idCol = [], touchedIds = false, created = false;
  data.forEach(function (row) {
    var id = str_(row[LC.ID - 1]);
    var hasData = SNAP_COLS.some(function (c) { return c !== LC.ID && !isSystemCol_(c) && str_(row[c - 1]) !== ''; });
    if (!id && hasData) {
      id = generateLeadId_(settings, ids, {});
      ids[id.toLowerCase()] = true;
      row[LC.ID - 1] = id;
      touchedIds = true;
      var init = initialiseNewLead_(row, settings, stageInfo, now, actor);
      init.entries[0][LG.REMARKS - 1] = 'Lead ID given by setup (row typed before version ' + CRM_VERSION + ')';
      entries = entries.concat(init.entries);
      created = true;
    }
    idCol.push([row[LC.ID - 1]]);
    if (!id) { snaps.push([row[LC.SNAPSHOT - 1]]); return; }
    var old = parseSnapshot_(row[LC.SNAPSHOT - 1]);
    if (!row[LC.CREATED - 1]) row[LC.CREATED - 1] = now;
    snaps.push([buildSnapshot_(row, old ? { p: old.p, pc: old.pc } : {})]);
  });
  if (created) {
    // initialiseNewLead_ filled defaults / dates on those rows: write the user and system columns back.
    colRuns_(SNAP_COLS.filter(function (c) { return c !== LC.ID; })).forEach(function (run) {
      sh.getRange(2, run[0], n, run[1] - run[0] + 1).setValues(data.map(function (r) { return r.slice(run[0] - 1, run[1]); }));
    });
  } else {
    sh.getRange(2, LC.CREATED, n, 1).setValues(data.map(function (r) { return [r[LC.CREATED - 1]]; }));
  }
  if (touchedIds) sh.getRange(2, LC.ID, n, 1).setValues(idCol);
  sh.getRange(2, LC.SNAPSHOT, n, 1).setValues(snaps);
  if (entries.length) appendLogRows_(entries);
  return n;
}

/** Header note of every column: "Editable", "Locked - admin only" or "Auto - do not edit", then what it means. */
function addLeadHeaderNotes_(sh) {
  var defs = {};
  FIELD_DICTIONARY.forEach(function (d) { defs[d[0]] = d[1]; });
  var row = [];
  for (var c = 1; c <= LEAD_COLS; c++) {
    var tag = isEditableCol_(c) ? 'Editable (your own leads)' : isSystemCol_(c) ? 'Auto - do not edit' : 'Locked - admin only';
    var key = isCustomCol_(c) ? 'CUSTOM' : lcKeyForCol_(c);
    var extra = c === LC.NEXT_FU ? '\nDouble-click to pick a date. Red = overdue, yellow = due today, blue = upcoming.' :
      c === LC.SUBSTAGE ? '\nShows only the substages of the chosen Lead Stage.' : '';
    row.push(tag + '\n' + (defs[key] || '') + extra);
  }
  sh.getRange(1, 1, 1, LEAD_COLS).setNotes([row]);
}

/** Data-validation rule of a Lead Management column (null = none). Every rule REJECTS wrong values. */
function leadColumnRule_(c) {
  var dv = SpreadsheetApp.newDataValidation;
  var settingsSheet = getSheet_(SHEET.SETTINGS);
  var listRange = function (col) { return settingsSheet.getRange(colLetter_(col) + '2:' + colLetter_(col)); };
  var today = todayDate_();
  var settings = getSettings_();
  switch (c) {
    case LC.NAME: return dv().requireFormulaSatisfied(lcf_('=LEN({NAME}2)<=' + MAX_NAME_LENGTH)).setAllowInvalid(false)
      .setHelpText('Lead Name: up to ' + MAX_NAME_LENGTH + ' characters.').build();
    case LC.MOBILE: return dv().requireFormulaSatisfied(lcf_('=REGEXMATCH(TO_TEXT({MOBILE}2),INDIRECT("SET_MOBILE_PATTERN"))'))
      .setAllowInvalid(false).setHelpText(settings.mobileMessage).build();
    case LC.EMAIL: return dv().requireTextIsEmail().setAllowInvalid(false).setHelpText('Enter a valid email address.').build();
    case LC.OWNER: return dv().requireValueInRange(listRange(LS.H_ACTIVE_CNS), true).setAllowInvalid(false)
      .setHelpText('Choose an active counsellor.').build();
    case LC.STAGE: return dv().requireValueInRange(listRange(LS.H_ACTIVE_STAGES), true).setAllowInvalid(false)
      .setHelpText('Choose a stage from the list.').build();
    case LC.PRIORITY: return dv().requireValueInRange(listRange(LS.PRIORITY), true).setAllowInvalid(false).build();
    case LC.OUTCOME: return dv().requireValueInRange(listRange(LS.OUTCOME), true).setAllowInvalid(false).build();
    case LC.SOURCE: return dv().requireValueInRange(listRange(LS.SOURCE), true).setAllowInvalid(false).build();
    case LC.STATUS: return dv().requireValueInRange(listRange(LS.STATUS), true).setAllowInvalid(false).build();
    // Fixed dates (refreshed daily by refreshDateValidations_) keep the calendar picker.
    case LC.LAST_CONTACT: return dv().requireDateBetween(new Date(2000, 0, 1), today).setAllowInvalid(false)
      .setHelpText('A date, not in the future. Double-click to pick it.').build();
    case LC.NEXT_FU: return dv().requireDateBetween(today, dateFromKey_(addDaysKey_(todayKey_(), settings.maxFuDays))).setAllowInvalid(false)
      .setHelpText('A date from today up to ' + settings.maxFuDays + ' days ahead. Double-click to pick it.').build();
    case LC.REMARKS: return dv().requireFormulaSatisfied(lcf_('=LEN({REMARKS}2)<=INDIRECT("SET_MAX_REMARKS")')).setAllowInvalid(false)
      .setHelpText('Up to ' + settings.maxRemarks + ' characters.').build();
    default:
      if (isCustomCol_(c)) {
        var f = readCustomFields_()[c - LC.CUSTOM_FIRST];
        if (f && f.allowed.length) return dv().requireValueInList(f.allowed, true).setAllowInvalid(false).build();
        var L = colLetter_(c);
        return dv().requireFormulaSatisfied('=LEN(' + L + '2)<=' + MAX_CUSTOM_LENGTH).setAllowInvalid(false)
          .setHelpText('Up to ' + MAX_CUSTOM_LENGTH + ' characters.').build();
      }
      return null;
  }
}

/**
 * The two date rules use fixed dates (so the calendar picker appears) and are moved forward once a day
 * by the hourly maintenance trigger.
 */
function refreshDateValidations_(force) {
  var props = PropertiesService.getDocumentProperties();
  var today = todayKey_();
  if (!force && props.getProperty(PROP.DV_DATE) === today) return false;
  var sh = getSheet_(SHEET.LEADS);
  var rows = sh.getMaxRows() - 1;
  [LC.LAST_CONTACT, LC.NEXT_FU].forEach(function (c) { sh.getRange(2, c, rows, 1).setDataValidation(leadColumnRule_(c)); });
  props.setProperty(PROP.DV_DATE, today);
  return true;
}

/** Data validation, conditional formatting and filter for Lead Management (re-runnable). */
function applyLeadSheetRules_(sh) {
  clearMemo_('validationEnv');
  var rows = sh.getMaxRows() - 1;
  var col = function (c, n) { return sh.getRange(2, c, rows, n || 1); };

  col(1, LEAD_COLS).clearDataValidations();
  for (var c = 1; c <= LEAD_COLS; c++) {
    if (c === LC.SUBSTAGE) continue;   // per-row dependent dropdowns (refreshAllSubstageValidations_)
    var rule = leadColumnRule_(c);
    if (rule) col(c).setDataValidation(rule);
  }

  // Conditional formatting: earlier rules win.
  var cf = function (formula, ranges, bg, font, bold, extra) {
    var b = SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(formula).setRanges(ranges);
    if (bg) b.setBackground(bg);
    if (font) b.setFontColor(font);
    if (bold) b.setBold(true);
    if (extra) extra(b);
    return b.build();
  };
  sh.setConditionalFormatRules([
    // Incomplete leads: red Lead ID and name (always visible: frozen columns) and red flags.
    cf(lcf_('=LEFT(${DQ_FLAGS}2,10)="Incomplete"'), [col(LC.ID, 2), col(LC.DQ_FLAGS)], '#E74C3C', '#FFFFFF', true),
    cf(lcf_('=AND(ISNUMBER(${NEXT_FU}2),${NEXT_FU}2<TODAY(),${STATUS}2<>"Converted",${STATUS}2<>"Lost",${STATUS}2<>"Duplicate")'), [col(LC.NEXT_FU)], '#F5B7B1', '#922B21', true),
    cf(lcf_('=AND(ISNUMBER(${NEXT_FU}2),INT(${NEXT_FU}2)=TODAY())'), [col(LC.NEXT_FU)], '#FCF3CF', '#7D6608', true),
    cf(lcf_('=AND(ISNUMBER(${NEXT_FU}2),INT(${NEXT_FU}2)>TODAY(),INT(${NEXT_FU}2)<=TODAY()+INDIRECT("SET_UPCOMING_DAYS"))'), [col(LC.NEXT_FU)], '#D6EAF8', '#1B4F72'),
    cf(lcf_('=${STATUS}2="Converted"'), [col(LC.STATUS)], '#D5F5E3', '#145A32', true),
    cf(lcf_('=OR(${STATUS}2="Lost",${STATUS}2="Duplicate")'), [col(LC.STATUS)], '#E5E7E9', '#7B7D7D', false, function (b) { b.setItalic(true); }),
    cf(lcf_('=${PRIORITY}2="Critical"'), [col(LC.PRIORITY)], '#922B21', '#FFFFFF', true),
    cf(lcf_('=${PRIORITY}2="Hot"'), [col(LC.PRIORITY)], '#F5CBA7', '#784212', true),
    // Duplicates are detected by the script (Data Quality Flags), so these rules only read the same row.
    cf(lcf_('=ISNUMBER(SEARCH("Duplicate mobile",${DQ_FLAGS}2))'), [col(LC.MOBILE)], '#FAD7A0', '#784212'),
    cf(lcf_('=ISNUMBER(SEARCH("Duplicate email",${DQ_FLAGS}2))'), [col(LC.EMAIL)], '#FAD7A0', '#784212'),
    cf(lcf_('=${DQ_FLAGS}2<>""'), [col(LC.DQ_FLAGS)], null, COLORS.amber, false, function (b) { b.setItalic(true); }),
    // Last rules: every locked cell is grey, every editable cell white (also after a paste copied colours).
    cf('=TRUE', colRuns_(lockedCols_()).map(function (r) { return col(r[0], r[1] - r[0] + 1); }), COLORS.lockedCell, '#566573'),
    cf('=TRUE', colRuns_(editableCols_()).map(function (r) { return col(r[0], r[1] - r[0] + 1); }), '#FFFFFF', '#202124')
  ].filter(function (r) { return r; }));

  sh.getBandings().forEach(function (b) { b.remove(); });
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
    refreshDateValidations_(true);
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

function setupLogSheet_(sh, leadRows) {
  ensureSize_(sh, Math.min(LOG_INITIAL_ROWS, leadRows || LOG_INITIAL_ROWS) + 1, LOG_COLS);
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
  sh.setColumnWidths(1, LOG_COLS, 140);
  widths.forEach(function (w, i) { if (w !== 140) sh.setColumnWidth(i + 1, w); });
  sh.hideColumns(LG.SUBMISSION);
  var settingsSheet = getSheet_(SHEET.SETTINGS);
  sh.getRange(2, LG.TYPE, rows, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInRange(settingsSheet.getRange('E2:E'), true).setAllowInvalid(true).build());
  sh.getRange(2, LG.CATEGORY, rows, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList([CATEGORY.CONTACT, CATEGORY.RECORD, CATEGORY.SYSTEM], true).setAllowInvalid(true).build());
  sh.setConditionalFormatRules([
    // Entries of deleted leads stay in the log, struck through.
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND($B2<>"",COUNTIF(INDIRECT("\'Deleted Leads\'!D2:D"),$B2)>0)')
      .setFontColor('#A6ACAF').setStrikethrough(true).setRanges([sh.getRange(2, 1, rows, LOG_COLS)]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$M2="System"').setFontColor('#909497')
      .setRanges([sh.getRange(2, 1, rows, LOG_COLS)]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$M2="Record Update"').setFontColor('#1B4F72')
      .setRanges([sh.getRange(2, 1, rows, LOG_COLS)]).build()
  ]);
  if (sh.getFilter()) sh.getFilter().remove();
  sh.getRange(1, 1, sh.getMaxRows(), LOG_COLS).createFilter();
  var notes = [];
  for (var c = 1; c <= LOG_COLS; c++) notes.push('');
  notes[LG.CATEGORY - 1] = 'Contact = actual call/message/email. Record Update = change to lead details. System = automated change by the script.';
  notes[LG.COUNSELLOR - 1] = 'Counsellor credited with the activity (follow-up form) or the person who made the change (audit entries). "System" for automated entries.';
  notes[LG.OWNER - 1] = 'Assigned counsellor of the lead when the entry was written.';
  sh.getRange(1, 1, 1, LOG_COLS).setNotes([notes]);
}

/* ================================================================== */
/* Protections, triggers, counters                                     */
/* ================================================================== */

/**
 * Protection model (all STRICT; admins and the owner keep full access):
 *  - Lead Management: the whole sheet is protected; only the counsellor-editable columns of rows that hold
 *    a lead are left open (updateLeadProtection_). Header row, empty rows, contact / assignment and
 *    automatic columns are therefore closed to counsellors. Automatic columns are also guarded against
 *    admins and the owner by the edit trigger (Google never blocks the owner).
 *  - Every other sheet: admins only (Dashboard: its filter cells stay open).
 * The installable triggers run as the owner and write wherever they need to.
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

  strict(ss.getSheetByName(SHEET.LEADS).protect(), 'Lead Management (counsellors: white cells of their leads only)');
  updateLeadProtection_();
  [[SHEET.LOG, 'Follow-Up Log is written by the CRM'], [SHEET.ACCESS_LOG, 'Access Log (admins)'],
    [SHEET.STAGES, 'Stage Master (admins)'], [SHEET.COUNSELLORS, 'Counsellor Master (admins)'],
    [SHEET.SETTINGS, 'Lists & Settings (admins)'], [SHEET.ENTRY, 'Lead Entry (admins)'],
    [SHEET.DELETED, 'Deleted Leads (admins)'], [SHEET.START, 'Start Here (admins)'], [SHEET.GUIDE, 'Field Guide (admins)']
  ].forEach(function (x) { var sh = ss.getSheetByName(x[0]); if (sh) strict(sh.protect(), x[1]); });
  var dash = ss.getSheetByName(SHEET.DASHBOARD);
  var dp = strict(dash.protect(), 'Dashboard (admins)');
  dp.setUnprotectedRanges([DASH.PERIOD, DASH.CUSTOM_FROM, DASH.CUSTOM_TO, DASH.COUNSELLOR]
    .map(function (a1) { return dash.getRange(a1); }));
}

/** Opens the counsellor-editable columns of rows 2..last lead row (call after leads are added / removed). */
function updateLeadProtection_() {
  var sh = getSheet_(SHEET.LEADS);
  var p = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).filter(function (x) { return /^CRM:/.test(x.getDescription() || ''); })[0];
  if (!p) return false;
  var last = lastLeadRow_(sh);
  var ranges = last < 2 ? [] : colRuns_(editableCols_()).map(function (r) { return sh.getRange(2, r[0], last - 1, r[1] - r[0] + 1); });
  p.setUnprotectedRanges(ranges);
  return true;
}

/** Admin > Reapply protections (after editing the Admin Emails setting). */
function reapplyProtections() {
  requireAdmin_();
  applyProtections_(ss_());
  toast_('Protections reapplied for administrators: ' + getAdminEmails_().join(', '));
}

/**
 * Installable triggers run as the person who ran setup (must be the owner): onEdit (the edit guard),
 * onChange (column check, dropdowns after sort), onOpen (access log), hourly maintenance and the
 * every-minute follow-up queue (saves made by counsellors with the form).
 */
function installCoreTriggers_(ss) {
  var have = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  if (have.indexOf('onChangeInstallable') < 0) ScriptApp.newTrigger('onChangeInstallable').forSpreadsheet(ss).onChange().create();
  if (have.indexOf('onEditInstallable') < 0) ScriptApp.newTrigger('onEditInstallable').forSpreadsheet(ss).onEdit().create();
  if (have.indexOf('onOpenInstallable') < 0) ScriptApp.newTrigger('onOpenInstallable').forSpreadsheet(ss).onOpen().create();
  if (have.indexOf('scheduledMaintenance') < 0) ScriptApp.newTrigger('scheduledMaintenance').timeBased().everyHours(1).create();
  if (have.indexOf('processQueuedFollowUps') < 0) ScriptApp.newTrigger('processQueuedFollowUps').timeBased().everyMinutes(1).create();
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
  props.deleteProperty(PROP.EDIT_MODE);   // the legacy "simple" mode no longer exists
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
