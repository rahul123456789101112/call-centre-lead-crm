/**
 * DeleteLeads.gs
 * Admin-only safe deletion: Lead CRM > Admin > Delete lead(s) moves leads to the hidden, admin-only
 * "Deleted Leads" sheet (with Deleted By, Deleted At and Reason) and writes a "Lead Deleted" entry in
 * Follow-Up Log. Their history stays in the log. "Restore deleted lead" brings a lead back with its
 * original Lead ID; "Purge deleted lead permanently" removes it for good (two confirmations, logged).
 * Every action checks Admin Emails on the server (requireAdmin_), whatever menu the user sees.
 */

var DL_META = ['Deleted At', 'Deleted By', 'Reason'];
var DL_COLS = DL_META.length + LEAD_COLS;

function setupDeletedLeadsSheet_(sh) {
  ensureSize_(sh, 200, DL_COLS);
  sh.getRange(1, 1, 1, DL_COLS).setValues([DL_META.concat(LEAD_HEADERS)]);
  styleHeader_(sh.getRange(1, 1, 1, DL_META.length), COLORS.red);
  styleHeader_(sh.getRange(1, DL_META.length + 1, 1, LEAD_COLS), COLORS.headerSystem);
  sh.setFrozenRows(1);
  sh.setColumnWidths(1, DL_COLS, 130);
  sh.setColumnWidth(3, 260);
  sh.getRange(2, 1, sh.getMaxRows() - 1, 1).setNumberFormat('dd-mmm-yyyy hh:mm');
  sh.getRange(2, DL_META.length + LC.MOBILE, sh.getMaxRows() - 1, 1).setNumberFormat('@');
  sh.getRange(1, 1).setNote('Leads removed with Lead CRM > Admin > Delete lead(s). Restore one with Admin > Restore deleted lead. Do not edit this sheet.');
}

/** Lead ID column of the Deleted Leads sheet. */
function dlIdCol_() { return DL_META.length + LC.ID; }

function parseIds_(text) {
  return str_(text).split(/[\s,;]+/).map(function (x) { return x.trim(); }).filter(String)
    .filter(function (x, i, a) { return a.map(function (y) { return y.toLowerCase(); }).indexOf(x.toLowerCase()) === i; });
}

function leadLine_(r) {
  return str_(r[LC.ID - 1]) + ' - ' + (str_(r[LC.NAME - 1]) || '(no name)') + ' - ' + str_(r[LC.MOBILE - 1]) + ' - ' +
    (str_(r[LC.OWNER - 1]) || 'unassigned') + ' - ' + str_(r[LC.STAGE - 1]) + ' / ' + str_(r[LC.STATUS - 1]);
}

/** Lead CRM > Admin > Delete lead(s). */
function deleteLeads() {
  var email = requireAdmin_();
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt(CRM_TITLE, 'Lead ID(s) to delete. Separate several with commas or spaces:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var ids = parseIds_(r.getResponseText());
  if (!ids.length) { ui.alert(CRM_TITLE, 'No Lead ID entered. Nothing was deleted.', ui.ButtonSet.OK); return; }
  var sheet = getSheet_(SHEET.LEADS);
  var found = [], missing = [];
  ids.forEach(function (id) {
    var row = findLeadRow_(sheet, id);
    if (row) found.push(sheet.getRange(row, 1, 1, LEAD_COLS).getValues()[0]); else missing.push(id);
  });
  if (!found.length) { ui.alert(CRM_TITLE, 'No lead found for: ' + missing.join(', ') + '. Nothing was deleted.', ui.ButtonSet.OK); return; }
  var list = found.slice(0, 20).map(leadLine_).join('\n') + (found.length > 20 ? '\n... and ' + (found.length - 20) + ' more' : '');
  var ok = ui.alert(CRM_TITLE, 'Delete these ' + found.length + ' lead(s)?\n\n' + list +
    (missing.length ? '\n\nNot found (ignored): ' + missing.join(', ') : '') +
    '\n\nThey move to the admin-only "Deleted Leads" sheet and can be restored.', ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;
  var why = ui.prompt(CRM_TITLE, 'Reason for deleting (required):', ui.ButtonSet.OK_CANCEL);
  if (why.getSelectedButton() !== ui.Button.OK) return;
  var reason = str_(why.getResponseText());
  if (!reason) { ui.alert(CRM_TITLE, 'A reason is required. Nothing was deleted.', ui.ButtonSet.OK); return; }
  var n = deleteLeadsById_(found.map(function (x) { return str_(x[LC.ID - 1]); }), reason, email);
  toast_(n + ' lead(s) deleted and moved to Deleted Leads.');
}

/** Moves leads to Deleted Leads. Returns the number deleted. */
function deleteLeadsById_(ids, reason, email) {
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    processFollowUpQueue_();
    var sheet = getSheet_(SHEET.LEADS);
    var del = getSheet_(SHEET.DELETED);
    var now = new Date();
    var rows = [];
    ids.forEach(function (id) {
      var row = findLeadRow_(sheet, id);          // found again inside the lock: rows may have moved
      if (row) rows.push({ row: row, values: sheet.getRange(row, 1, 1, LEAD_COLS).getValues()[0] });
    });
    if (!rows.length) return 0;
    var start = del.getLastRow() + 1;
    if (start + rows.length - 1 > del.getMaxRows()) del.insertRowsAfter(del.getMaxRows(), rows.length + 100);
    del.getRange(start, 1, rows.length, DL_COLS).setValues(rows.map(function (x) {
      return [now, email, safeText_(reason)].concat(x.values.map(function (v) { return v === null || v === undefined ? '' : v; }));
    }));
    appendLogRows_(rows.map(function (x) {
      return buildLogEntry_({
        row: x.values, time: now, type: ACT.LEAD_DELETED, category: CATEGORY.SYSTEM, counsellor: 'System', updatedBy: email,
        field: 'Lead', oldValue: leadLine_(x.values), newValue: 'Moved to Deleted Leads', remarks: reason
      });
    }));
    rows.sort(function (a, b) { return b.row - a.row; }).forEach(function (x) { sheet.deleteRow(x.row); });
    updateLeadProtection_();
    rememberLeadCount_();
    return rows.length;
  } finally {
    lock.releaseLock();
  }
}

/** Lead CRM > Admin > Restore deleted lead. */
function restoreDeletedLead() {
  var email = requireAdmin_();
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt(CRM_TITLE, 'Lead ID to restore (from the Deleted Leads sheet):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var id = str_(r.getResponseText());
  var del = getSheet_(SHEET.DELETED);
  var dRow = findDeletedRow_(id);
  if (!dRow) { ui.alert(CRM_TITLE, 'Lead ' + id + ' is not in Deleted Leads.', ui.ButtonSet.OK); return; }
  var vals = del.getRange(dRow, 1, 1, DL_COLS).getValues()[0];
  var ok = ui.alert(CRM_TITLE, 'Restore this lead to Lead Management with its original Lead ID?\n\n' + leadLine_(vals.slice(DL_META.length)) +
    '\n\nDeleted by ' + vals[1] + ' on ' + displayDateTime_(vals[0]) + '. Reason: ' + vals[2], ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;
  var res = restoreLeadById_(id, email);
  if (!res.ok) { ui.alert(CRM_TITLE, res.message, ui.ButtonSet.OK); return; }
  toast_('Lead ' + id + ' restored in row ' + res.row + ' of Lead Management.');
}

function findDeletedRow_(id) {
  var del = getSheet_(SHEET.DELETED);
  var last = del.getLastRow();
  if (last < 2 || !str_(id)) return 0;
  var hit = del.getRange(2, dlIdCol_(), last - 1, 1).createTextFinder(str_(id)).matchEntireCell(true).findNext();
  return hit ? hit.getRow() : 0;
}

function restoreLeadById_(id, email) {
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var del = getSheet_(SHEET.DELETED);
    var dRow = findDeletedRow_(id);
    if (!dRow) return { ok: false, message: 'Lead ' + id + ' is not in Deleted Leads.' };
    var sheet = getSheet_(SHEET.LEADS);
    if (findLeadRow_(sheet, id)) return { ok: false, message: 'Lead ' + id + ' is already in Lead Management.' };
    var vals = del.getRange(dRow, 1, 1, DL_COLS).getValues()[0];
    var lead = vals.slice(DL_META.length);
    var row = lastLeadRow_(sheet) + 1;
    ensureLeadCapacity_(row);
    LEAD_FORMULA_COLS.forEach(function (c) { lead[c - 1] = ''; });
    lead[LC.DQ_FLAGS - 1] = computeDqFlags_(lead, buildDqEnv_(sheet, [lead]));
    writeRowCols_(sheet, row, lead, SNAP_COLS.concat([LC.DQ_FLAGS, LC.SNAPSHOT]));
    sheet.getRange(row, LC.SUBSTAGE).setDataValidation(substageRuleFor_(lead[LC.STAGE - 1], getStageInfo_(), {}));
    appendLogRows_([buildLogEntry_({
      row: lead, time: new Date(), type: ACT.LEAD_RESTORED, category: CATEGORY.SYSTEM, counsellor: 'System', updatedBy: email,
      field: 'Lead', oldValue: 'Deleted Leads', newValue: 'Lead Management row ' + row, remarks: 'Restored by an admin'
    })]);
    del.deleteRow(dRow);
    updateLeadProtection_();
    rememberLeadCount_();
    return { ok: true, row: row };
  } finally {
    lock.releaseLock();
  }
}

/** Lead CRM > Admin > Purge deleted lead permanently (two confirmations). */
function purgeDeletedLead() {
  var email = requireAdmin_();
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt(CRM_TITLE, 'Lead ID to remove PERMANENTLY from Deleted Leads:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var id = str_(r.getResponseText());
  var dRow = findDeletedRow_(id);
  if (!dRow) { ui.alert(CRM_TITLE, 'Lead ' + id + ' is not in Deleted Leads. Only deleted leads can be purged.', ui.ButtonSet.OK); return; }
  var vals = getSheet_(SHEET.DELETED).getRange(dRow, 1, 1, DL_COLS).getValues()[0];
  var first = ui.alert(CRM_TITLE, 'PERMANENTLY remove this lead? This cannot be undone.\n\n' + leadLine_(vals.slice(DL_META.length)) +
    '\n\nIts entries in Follow-Up Log are kept.', ui.ButtonSet.YES_NO);
  if (first !== ui.Button.YES) return;
  var second = ui.prompt(CRM_TITLE, 'To confirm, type PURGE and press OK:', ui.ButtonSet.OK_CANCEL);
  if (second.getSelectedButton() !== ui.Button.OK || str_(second.getResponseText()) !== 'PURGE') {
    ui.alert(CRM_TITLE, 'Not confirmed. Nothing was removed.', ui.ButtonSet.OK);
    return;
  }
  purgeLeadById_(id, email);
  toast_('Lead ' + id + ' was permanently removed.');
}

function purgeLeadById_(id, email) {
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var dRow = findDeletedRow_(id);
    if (!dRow) return false;
    var blank = new Array(LEAD_COLS);
    for (var b = 0; b < LEAD_COLS; b++) blank[b] = '';
    blank[LC.ID - 1] = id;
    appendLogRows_([buildLogEntry_({
      row: blank, time: new Date(), type: ACT.LEAD_PURGED, category: CATEGORY.SYSTEM, counsellor: 'System', updatedBy: email,
      field: 'Lead', oldValue: 'Deleted Leads', newValue: 'Permanently removed', remarks: 'Purged by an admin (confirmed twice)'
    })]);
    getSheet_(SHEET.DELETED).deleteRow(dRow);
    return true;
  } finally {
    lock.releaseLock();
  }
}
