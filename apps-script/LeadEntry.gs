/**
 * LeadEntry.gs
 * "Lead Entry" is the only way to add new leads (admins only; the sheet is hidden from counsellors).
 * Admins type or paste rows, then run Lead CRM > Add leads from Lead Entry. Every row is checked:
 * valid rows become leads in Lead Management (Lead ID, created date, log entry) and are cleared;
 * invalid rows stay with a plain-English message in column S.
 */

var LE = {
  NAME: 1, MOBILE: 2, EMAIL: 3, CUSTOM_FIRST: 4, CUSTOM_LAST: 13, OWNER: 14, SOURCE: 15, PRIORITY: 16,
  REMARKS: 17, RESULT: 18, MESSAGE: 19, LEAD_ID: 20
};
var LE_COLS = 20;
var LE_INPUT_COLS = 17;
var LE_ROWS = 2000;
var LE_RESULT = { CREATED: 'Created', ERROR: 'Error' };

/** Lead Management column for each Lead Entry input column. */
function entryToLeadCol_(c) {
  if (c >= LE.CUSTOM_FIRST && c <= LE.CUSTOM_LAST) return customCol_(c - LE.CUSTOM_FIRST + 1);
  return { 1: LC.NAME, 2: LC.MOBILE, 3: LC.EMAIL, 14: LC.OWNER, 15: LC.SOURCE, 16: LC.PRIORITY, 17: LC.REMARKS }[c];
}

function entryHeaders_() {
  var h = ['Lead Name', 'Mobile Number', 'Email ID'];
  var cf = [];
  try { cf = readCustomFields_(); } catch (e) { /* settings not built */ }
  for (var i = 1; i <= CUSTOM_SLOTS; i++) h.push((cf[i - 1] && cf[i - 1].name) || defaultCustomName_(i));
  return h.concat(['Assigned Counsellor', 'Lead Source', 'Lead Priority', 'Remarks', 'Result', 'Message', 'Lead ID']);
}

/* ================================================================== */
/* Layout (setup)                                                      */
/* ================================================================== */

function setupLeadEntrySheet_(sh) {
  ensureSize_(sh, LE_ROWS + 1, LE_COLS);
  if (sh.getMaxColumns() > LE_COLS) sh.deleteColumns(LE_COLS + 1, sh.getMaxColumns() - LE_COLS);
  styleHeader_(sh.getRange(1, 1, 1, LE_INPUT_COLS), COLORS.headerUser);
  styleHeader_(sh.getRange(1, LE.RESULT, 1, 3), COLORS.headerSystem);
  sh.setRowHeight(1, 40);
  sh.setFrozenRows(1);
  sh.setColumnWidths(1, LE_COLS, 130);
  sh.setColumnWidth(LE.NAME, 180);
  sh.setColumnWidth(LE.REMARKS, 220);
  sh.setColumnWidth(LE.MESSAGE, 380);
  var rows = sh.getMaxRows() - 1;
  sh.getRange(2, LE.MOBILE, rows, 1).setNumberFormat('@');
  sh.getRange(2, LE.RESULT, rows, 3).setBackground(COLORS.lockedCell).setFontColor('#566573');
  sh.getRange(2, LE.MESSAGE, rows, 1).setWrap(true);
  var notes = [];
  for (var c = 1; c <= LE_COLS; c++) notes.push('');
  notes[LE.NAME - 1] = 'Required. Type or paste new leads here (one per row), then Lead CRM > Add leads from Lead Entry.';
  notes[LE.MOBILE - 1] = 'Required. Numbers only (spaces and dashes are removed). Must match Lists & Settings > Mobile Number Pattern.';
  notes[LE.EMAIL - 1] = 'Optional. Must be a valid email address.';
  notes[LE.OWNER - 1] = 'Optional. An active counsellor from Counsellor Master (blank = unassigned).';
  notes[LE.SOURCE - 1] = 'Optional. A value from Lists & Settings > Lead Source.';
  notes[LE.PRIORITY - 1] = 'Optional. A value from Lists & Settings > Lead Priority.';
  notes[LE.REMARKS - 1] = 'Optional. Copied to Lead Remarks.';
  notes[LE.RESULT - 1] = 'Filled by the CRM: Created or Error.';
  notes[LE.MESSAGE - 1] = 'Filled by the CRM: what is wrong with the row, or which lead was created.';
  notes[LE.LEAD_ID - 1] = 'Filled by the CRM: the new Lead ID.';
  sh.getRange(1, 1, 1, LE_COLS).setNotes([notes]);
  applyLeadEntryCustomFields_();
  setupLeadEntryRules_();
}

/** Headers of the custom columns and their visibility follow the Custom Fields table. */
function applyLeadEntryCustomFields_() {
  var sh = ss_().getSheetByName(SHEET.ENTRY);
  if (!sh) return;
  sh.getRange(1, 1, 1, LE_COLS).setValues([entryHeaders_()]);
  readCustomFields_().forEach(function (f) {
    var c = LE.CUSTOM_FIRST + f.slot - 1;
    if (f.active) sh.showColumns(c); else sh.hideColumns(c);
  });
}

function entryColumnRule_(c) {
  var dv = SpreadsheetApp.newDataValidation;
  var settingsSheet = getSheet_(SHEET.SETTINGS);
  var listRange = function (col) { return settingsSheet.getRange(colLetter_(col) + '2:' + colLetter_(col)); };
  switch (c) {
    case LE.OWNER: return dv().requireValueInRange(listRange(LS.H_ACTIVE_CNS), true).setAllowInvalid(false).build();
    case LE.SOURCE: return dv().requireValueInRange(listRange(LS.SOURCE), true).setAllowInvalid(false).build();
    case LE.PRIORITY: return dv().requireValueInRange(listRange(LS.PRIORITY), true).setAllowInvalid(false).build();
    case LE.EMAIL: return dv().requireTextIsEmail().setAllowInvalid(false).build();
    default:
      if (c >= LE.CUSTOM_FIRST && c <= LE.CUSTOM_LAST) {
        var f = readCustomFields_()[c - LE.CUSTOM_FIRST];
        if (f && f.allowed.length) return dv().requireValueInList(f.allowed, true).setAllowInvalid(false).build();
        return dv().requireFormulaSatisfied('=LEN(' + colLetter_(c) + '2)<=' + MAX_CUSTOM_LENGTH).setAllowInvalid(false).build();
      }
      return null;
  }
}

function setupLeadEntryRules_() {
  var sh = ss_().getSheetByName(SHEET.ENTRY);
  if (!sh) return;
  var rows = sh.getMaxRows() - 1;
  for (var c = 1; c <= LE_INPUT_COLS; c++) sh.getRange(2, c, rows, 1).setDataValidation(entryColumnRule_(c));
  var all = sh.getRange(2, 1, rows, LE_COLS);
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$R2="Error"').setBackground('#FADBD8').setRanges([all]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$R2="Created"').setBackground('#D5F5E3').setRanges([all]).build()
  ]);
}

/** Edits in Lead Entry: put the dropdowns back after a paste and clear an old result of the edited rows. */
function onLeadEntryEdit_(e, sheet, range) {
  var r1 = Math.max(range.getRow(), 2), r2 = range.getLastRow();
  if (r2 < r1) return;
  var c1 = range.getColumn(), c2 = Math.min(range.getLastColumn(), LE_INPUT_COLS);
  if (c1 > LE_INPUT_COLS) return;
  for (var c = c1; c <= c2; c++) sheet.getRange(r1, c, r2 - r1 + 1, 1).setDataValidation(entryColumnRule_(c));
  sheet.getRange(r1, LE.RESULT, r2 - r1 + 1, 3).clearContent();
}

/* ================================================================== */
/* Lead CRM > Add leads from Lead Entry                                */
/* ================================================================== */

function addLeadsFromEntry() {
  var email = requireAdmin_();
  var t0 = Date.now();
  var ss = ss_();
  var sh = getSheet_(SHEET.ENTRY);
  var last = sh.getLastRow();
  if (last < 2) {
    ss.setActiveSheet(showSheet_(SHEET.ENTRY));
    notify_('Lead Entry is empty. Type or paste new leads there (Lead Name and Mobile Number are required), then run this again.');
    return;
  }
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  var res;
  try {
    clearMemo_();
    var actor = getActor_();
    if (!actor.email) actor = { email: email, name: '', label: email, admin: true, counsellor: '' };
    res = addLeadsFromRows_(sh.getRange(2, 1, last - 1, LE_COLS).getValues(), actor, t0);
    // Lead Entry afterwards: rows with errors (input kept), then confirmations, then rows not reached yet.
    var rows = res.errors.concat(res.created).concat(res.notReached);
    sh.getRange(2, 1, last - 1, LE_COLS).clearContent();
    if (rows.length) writeRows_(sh, 2, 1, rows, LE_COLS);
  } finally {
    lock.releaseLock();
  }
  var msg = res.createdIds.length
    ? 'Created ' + res.createdIds.length + ' lead(s): ' + res.createdIds[0] + (res.createdIds.length > 1 ? ' to ' + res.createdIds[res.createdIds.length - 1] : '') + '.'
    : 'No leads were created.';
  if (res.errors.length) msg += '\n\n' + res.errors.length + ' row(s) have a problem. They are at the top of Lead Entry (red), with the reason in column S. Fix them and run this again.';
  if (res.notReached.length) msg += '\n\n' + res.notReached.length + ' row(s) were not checked yet (time limit). Run this again.';
  ss.setActiveSheet(getSheet_(res.errors.length || res.notReached.length ? SHEET.ENTRY : SHEET.LEADS));
  notify_(msg);
}

/**
 * Checks Lead Entry rows and creates the valid ones. Caller holds the lock.
 * Returns {created: [entry rows], errors: [entry rows], notReached: [entry rows], createdIds: []}.
 */
function addLeadsFromRows_(rows, actor, t0) {
  var env = validationEnv_();
  var settings = env.settings;
  var leads = getSheet_(SHEET.LEADS);
  var lastLead = lastLeadRow_(leads);
  var existing = lastLead >= 2 ? leads.getRange(2, 1, lastLead - 1, LC.EMAIL).getValues() : [];
  var mobiles = {}, emails = {}, ids = {};
  existing.forEach(function (r) {
    var id = str_(r[LC.ID - 1]);
    if (!id) return;
    ids[id.toLowerCase()] = true;
    var m = mobileKey_(r[LC.MOBILE - 1]), em = str_(r[LC.EMAIL - 1]).toLowerCase();
    if (m) (mobiles[m] = mobiles[m] || []).push(id);
    if (em) (emails[em] = emails[em] || []).push(id);
  });

  var out = { created: [], errors: [], notReached: [], createdIds: [] };
  var newLeads = [], notes = [];
  var now = new Date();
  for (var i = 0; i < rows.length; i++) {
    var src = rows[i];
    var hasInput = src.slice(0, LE_INPUT_COLS).some(function (v) { return str_(v) !== ''; });
    if (!hasInput) continue;   // empty row or an old "Created" confirmation
    if (t0 && Date.now() - t0 > 240000) { out.notReached.push(src.slice(0, LE_INPUT_COLS)); continue; }
    var lead = new Array(LEAD_COLS);
    for (var k = 0; k < LEAD_COLS; k++) lead[k] = '';
    var errs = [];
    for (var c = 1; c <= LE_INPUT_COLS; c++) {
      var lc = entryToLeadCol_(c);
      var raw = src[c - 1];
      if (isCustomCol_(lc) && str_(raw) !== '' && !readCustomFields_()[lc - LC.CUSTOM_FIRST].active) {
        errs.push(leadLabel_(lc) + ' is not an active custom field; leave it empty.');
        continue;
      }
      if (typeof raw === 'string' && /^[=+@]/.test(raw.trim()) && lc !== LC.MOBILE) { errs.push(leadLabel_(lc) + ' cannot start with = + or @.'); continue; }
      var chk = checkLeadValue_(lc, raw, '', lead, env);
      if (!chk.ok) errs.push(chk.msg);
      else lead[lc - 1] = chk.value;
    }
    var dupNote = [];
    if (!errs.length) {
      [[LC.MOBILE, settings.dupMobile, mobiles, 'Mobile number', mobileKey_], [LC.EMAIL, settings.dupEmail, emails, 'Email ID', function (v) { return str_(v).toLowerCase(); }]]
        .forEach(function (d) {
          var key = d[4](lead[d[0] - 1]);
          if (!key || same_(d[1], 'Off') || !d[2][key]) return;
          if (same_(d[1], 'Block')) errs.push(d[3] + ' already belongs to ' + d[2][key].slice(0, 3).join(', ') + '.');
          else dupNote.push(d[3] + ' is also used by ' + d[2][key].slice(0, 3).join(', ') + '.');
        });
    }
    if (errs.length) {
      out.errors.push(src.slice(0, LE_INPUT_COLS).concat([LE_RESULT.ERROR, errs.join(' '), '']));
      continue;
    }
    var id = generateLeadId_(settings, ids, {});
    ids[id.toLowerCase()] = true;
    lead[LC.ID - 1] = id;
    var mk = mobileKey_(lead[LC.MOBILE - 1]), ek = str_(lead[LC.EMAIL - 1]).toLowerCase();
    if (mk) (mobiles[mk] = mobiles[mk] || []).push(id);
    if (ek) (emails[ek] = emails[ek] || []).push(id);
    newLeads.push(lead);
    notes.push(dupNote);
  }
  if (!newLeads.length) return out;

  var start = lastLead + 1;
  ensureLeadCapacity_(start + newLeads.length - 1);
  var entries = [];
  var dqEnvRows = [];
  newLeads.forEach(function (lead, k) {
    var created = initialiseNewLead_(lead, settings, env.stageInfo, now, actor);
    created.entries[0][LG.REMARKS - 1] = 'Added from Lead Entry';
    entries = entries.concat(created.entries);
    dqEnvRows.push(k);
    out.createdIds.push(lead[LC.ID - 1]);
    var msg = 'Added to Lead Management as ' + lead[LC.ID - 1] + '.' + (notes[k].length ? ' Note: ' + notes[k].join(' ') : '');
    var echo = [];
    for (var c = 0; c < LE_INPUT_COLS; c++) echo.push('');
    out.created.push(echo.concat([LE_RESULT.CREATED, msg, lead[LC.ID - 1]]));
  });
  // Data-quality flags need every lead, including the new ones (duplicates).
  var dqEnv = buildDqEnv_(leads, newLeads);
  newLeads.forEach(function (lead) { lead[LC.DQ_FLAGS - 1] = computeDqFlags_(lead, dqEnv); });
  colRuns_(SNAP_COLS.concat([LC.DQ_FLAGS, LC.SNAPSHOT])).forEach(function (run) {
    leads.getRange(start, run[0], newLeads.length, run[1] - run[0] + 1)
      .setValues(newLeads.map(function (r) { return r.slice(run[0] - 1, run[1]); }));
  });
  var cache = {};
  leads.getRange(start, LC.SUBSTAGE, newLeads.length, 1)
    .setDataValidations(newLeads.map(function (r) { return [substageRuleFor_(r[LC.STAGE - 1], env.stageInfo, cache)]; }));
  appendLogRows_(entries);
  // A new duplicate also changes the flags of the existing lead it duplicates.
  if (notes.some(function (x) { return x.length; })) refreshDataQuality_();
  updateLeadProtection_();
  rememberLeadCount_();
  return out;
}

/** Makes sure Lead Management has data rows up to `row` (adds 5,000 at a time, with all rules). */
function ensureLeadCapacity_(row) {
  var sh = getSheet_(SHEET.LEADS);
  if (row <= sh.getMaxRows()) return;
  sh.insertRowsAfter(sh.getMaxRows(), Math.max(5000, row - sh.getMaxRows()));
  applyLeadSheetRules_(sh);
  refreshDateValidations_(true);
}
