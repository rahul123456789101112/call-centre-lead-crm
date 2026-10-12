/**
 * CustomFields.gs
 * Optional custom fields on Lead Management (columns E:N, slots 1-10).
 *
 * The source of truth is the "Custom Fields" table in Lists & Settings (Z:AB):
 *   Slot | Field Name | Active (Yes/No)
 * Active slots are shown with their Field Name as header; inactive slots are hidden.
 * Columns are never inserted or deleted, only shown/hidden, so every position stays fixed and
 * hidden columns keep their data.
 */

var CF_HEADERS = ['Custom Field Slot', 'Field Name', 'Active (Yes/No)'];

/** [{slot, name, active}] for slots 1-10, falling back to defaults for missing rows. */
function readCustomFields_() {
  var sh = getSheet_(SHEET.SETTINGS);
  var vals = sh.getRange(2, LS.CF_SLOT, CUSTOM_SLOTS, 3).getValues();
  var out = [];
  for (var i = 0; i < CUSTOM_SLOTS; i++) {
    out.push({
      slot: i + 1,
      name: str_(vals[i][1]),
      active: yes_(vals[i][2])
    });
  }
  return out;
}

function writeCustomFields_(fields) {
  getSheet_(SHEET.SETTINGS).getRange(2, LS.CF_SLOT, CUSTOM_SLOTS, 3).setValues(fields.map(function (f) {
    return [f.slot, f.name, f.active ? 'Yes' : 'No'];
  }));
}

/** Creates the table (all 10 slots inactive) unless it already exists; keeps existing names/status. */
function setupCustomFieldTable_(settingsSheet) {
  settingsSheet.getRange(1, LS.CF_SLOT, 1, 3).setValues([CF_HEADERS]);
  var cur = settingsSheet.getRange(2, LS.CF_SLOT, CUSTOM_SLOTS, 3).getValues();
  var rows = cur.map(function (r, i) {
    var exists = str_(r[0]) !== '' || str_(r[1]) !== '' || str_(r[2]) !== '';
    return exists ? [i + 1, r[1], yes_(r[2]) ? 'Yes' : 'No'] : [i + 1, defaultCustomName_(i + 1), 'No'];
  });
  settingsSheet.getRange(2, LS.CF_SLOT, CUSTOM_SLOTS, 3).setValues(rows);
  settingsSheet.getRange(2, LS.CF_ACTIVE, CUSTOM_SLOTS, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['Yes', 'No'], true).setAllowInvalid(false)
    .setHelpText('Yes = column shown on Lead Management with this name. No = column hidden (data kept).').build());
  settingsSheet.getRange(2, LS.CF_SLOT, CUSTOM_SLOTS, 1).setFontColor('#566573').setHorizontalAlignment('center');
  settingsSheet.getRange(1, LS.CF_SLOT).setNote('Slot N = Lead Management column ' + colLetter_(customCol_(1)) + '..' +
    colLetter_(customCol_(CUSTOM_SLOTS)) + ' (slot 1 = ' + colLetter_(customCol_(1)) + '). Use Lead CRM > Add / Remove custom field, or edit Field Name / Active here.');
}

/** Writes custom headers and shows/hides the 10 custom columns according to the table. */
function applyCustomFields_() {
  var leads = getSheet_(SHEET.LEADS);
  var fields = readCustomFields_();
  leads.getRange(1, LC.CUSTOM_FIRST, 1, CUSTOM_SLOTS).setValues([fields.map(function (f) {
    return f.name || defaultCustomName_(f.slot);
  })]);
  fields.forEach(function (f) {
    if (f.active) leads.showColumns(customCol_(f.slot));
    else leads.hideColumns(customCol_(f.slot));
  });
  return fields;
}

/** Number of non-empty cells in a custom slot's column. */
function customFieldDataCount_(slot) {
  var leads = getSheet_(SHEET.LEADS);
  var last = lastLeadRow_(leads);
  if (last < 2) return 0;
  return leads.getRange(2, customCol_(slot), last - 1, 1).getValues()
    .filter(function (r) { return str_(r[0]) !== ''; }).length;
}

function nameInUse_(name, exceptSlot) {
  var fixed = LEAD_HEADERS.filter(function (h, i) { return i + 1 < LC.CUSTOM_FIRST || i + 1 > LC.CUSTOM_LAST; });
  if (fixed.some(function (h) { return same_(h, name); })) return true;
  return readCustomFields_().some(function (f) { return f.active && f.slot !== exceptSlot && same_(f.name, name); });
}

/* ================================================================== */
/* Menu actions                                                        */
/* ================================================================== */

/** Lead CRM > Add custom field. */
function addCustomField() {
  requireAdmin_();
  var ui = SpreadsheetApp.getUi();
  var fields = readCustomFields_();
  var free = fields.filter(function (f) { return !f.active; });
  if (!free.length) {
    ui.alert(CRM_TITLE, 'All ' + CUSTOM_SLOTS + ' custom field slots are in use. Remove a custom field first.', ui.ButtonSet.OK);
    return;
  }
  var r = ui.prompt(CRM_TITLE, 'Name of the new custom field (e.g. "Course Interested"):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var name = str_(r.getResponseText()).replace(/\s+/g, ' ');
  if (!name) { ui.alert(CRM_TITLE, 'No name entered - nothing changed.', ui.ButtonSet.OK); return; }
  if (name.length > 60) { ui.alert(CRM_TITLE, 'Please use a name of 60 characters or fewer.', ui.ButtonSet.OK); return; }
  if (/^[=+\-@]/.test(name)) { ui.alert(CRM_TITLE, 'A field name cannot start with = + - or @.', ui.ButtonSet.OK); return; }
  if (nameInUse_(name, 0)) { ui.alert(CRM_TITLE, '"' + name + '" is already a column name on Lead Management.', ui.ButtonSet.OK); return; }

  // Prefer a free slot with no leftover data from a removed field.
  var slot = null;
  for (var i = 0; i < free.length; i++) {
    if (customFieldDataCount_(free[i].slot) === 0) { slot = free[i]; break; }
  }
  if (!slot) {
    slot = free[0];
    var n = customFieldDataCount_(slot.slot);
    var ok = ui.alert(CRM_TITLE, 'Every free slot still holds data from a removed field.\n\nSlot ' + slot.slot +
      ' (column ' + colLetter_(customCol_(slot.slot)) + ', previously "' + (slot.name || defaultCustomName_(slot.slot)) + '") has ' + n +
      ' value(s). Reusing it will show that old data under "' + name + '".\n\nContinue?', ui.ButtonSet.YES_NO);
    if (ok !== ui.Button.YES) return;
  }
  var lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    fields[slot.slot - 1].name = name;
    fields[slot.slot - 1].active = true;
    writeCustomFields_(fields);
    applyCustomFields_();
  } finally {
    lock.releaseLock();
  }
  var leads = getSheet_(SHEET.LEADS);
  ss_().setActiveSheet(leads);
  leads.setActiveSelection(leads.getRange(1, customCol_(slot.slot)));
  toast_('Custom field "' + name + '" added in column ' + colLetter_(customCol_(slot.slot)) + ' (slot ' + slot.slot + ').');
}

/** Lead CRM > Remove custom field: hides the column and marks the slot inactive; data is kept. */
function removeCustomField() {
  requireAdmin_();
  var ui = SpreadsheetApp.getUi();
  var fields = readCustomFields_();
  var active = fields.filter(function (f) { return f.active; });
  if (!active.length) { ui.alert(CRM_TITLE, 'There are no active custom fields.', ui.ButtonSet.OK); return; }
  var list = active.map(function (f, i) { return (i + 1) + '. ' + f.name + '  (column ' + colLetter_(customCol_(f.slot)) + ')'; }).join('\n');
  var r = ui.prompt(CRM_TITLE, 'Which custom field should be removed? Enter its number or name:\n\n' + list, ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var answer = str_(r.getResponseText());
  var pick = /^\d+$/.test(answer) ? active[parseInt(answer, 10) - 1] : active.filter(function (f) { return same_(f.name, answer); })[0];
  if (!pick) { ui.alert(CRM_TITLE, 'No custom field matches "' + answer + '" - nothing changed.', ui.ButtonSet.OK); return; }

  var n = customFieldDataCount_(pick.slot);
  if (n > 0) {
    var ok = ui.alert(CRM_TITLE, 'Column ' + colLetter_(customCol_(pick.slot)) + ' ("' + pick.name + '") contains ' + n +
      ' value(s).\n\nRemoving the field HIDES the column and marks it inactive. The data is kept (not deleted) and ' +
      'reappears if the field is added again in this slot.\n\nRemove "' + pick.name + '"?', ui.ButtonSet.YES_NO);
    if (ok !== ui.Button.YES) return;
  }
  var lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    fields[pick.slot - 1].active = false;
    writeCustomFields_(fields);
    applyCustomFields_();
  } finally {
    lock.releaseLock();
  }
  toast_('Custom field "' + pick.name + '" removed (column ' + colLetter_(customCol_(pick.slot)) + ' hidden' + (n ? ', ' + n + ' value(s) kept' : '') + ').');
}

/* ================================================================== */
/* Edit hooks                                                          */
/* ================================================================== */

/** Admin edited the Custom Fields table in Lists & Settings: apply names / visibility. */
function onCustomFieldTableEdit_(range) {
  var r1 = range.getRow(), r2 = range.getLastRow(), c1 = range.getColumn(), c2 = range.getLastColumn();
  if (r2 < 2 || r1 > CUSTOM_SLOTS + 1 || c2 < LS.CF_SLOT || c1 > LS.CF_ACTIVE) return false;
  applyCustomFields_();
  toast_('Custom fields updated on Lead Management.');
  return true;
}

/** Admin renamed a custom header directly on Lead Management row 1: copy the name into the table. */
function onCustomHeaderEdit_(sheet, range) {
  var c1 = Math.max(range.getColumn(), LC.CUSTOM_FIRST), c2 = Math.min(range.getLastColumn(), LC.CUSTOM_LAST);
  if (c1 > c2) return;
  var fields = readCustomFields_();
  var headers = sheet.getRange(1, c1, 1, c2 - c1 + 1).getValues()[0];
  headers.forEach(function (h, i) {
    var slot = c1 - LC.CUSTOM_FIRST + i + 1;
    var name = str_(h);
    if (name) fields[slot - 1].name = name;
  });
  writeCustomFields_(fields);
  applyCustomFields_();   // restores a header that was cleared
}

/* ================================================================== */
/* Migration from the original layout (custom fields in Q:Z)           */
/* ================================================================== */

/**
 * Sheets built by the first version had Assigned Counsellor in column E and Custom Field 1-10 in Q:Z.
 * Moves those 10 columns (with their data, formats and validation) to E:N using moveColumns — no
 * column is inserted or deleted — and records each used slot as an active field.
 * Returns true when a migration was performed.
 */
function migrateOldCustomFieldLayout_(sh) {
  if (sh.getMaxColumns() < 26) return false;
  var e1 = str_(sh.getRange(1, 5).getValue());
  if (!same_(e1, 'Assigned Counsellor')) return false;
  if (sh.getFilter()) sh.getFilter().remove();
  var oldHeaders = sh.getRange(1, 17, 1, 10).getValues()[0];
  var last = lastLeadRow_(sh);
  var counts = [];
  for (var i = 0; i < 10; i++) {
    counts.push(last < 2 ? 0 : sh.getRange(2, 17 + i, last - 1, 1).getValues().filter(function (r) { return str_(r[0]) !== ''; }).length);
  }
  sh.moveColumns(sh.getRange(1, 17, sh.getMaxRows(), 10), 5);
  var fields = oldHeaders.map(function (h, i) {
    var name = str_(h) || defaultCustomName_(i + 1);
    var used = counts[i] > 0 || !same_(name, defaultCustomName_(i + 1));
    return { slot: i + 1, name: name, active: used };
  });
  writeCustomFields_(fields);
  console.log('Migrated custom fields from Q:Z to E:N. Active slots: ' +
    fields.filter(function (f) { return f.active; }).map(function (f) { return f.name; }).join(', '));
  return true;
}
