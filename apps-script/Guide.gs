/**
 * Guide.gs
 * "Start Here" (first tab, one screen), the read-only "Field Guide" sheet, and showing / hiding the
 * admin sheets. FIELD_DICTIONARY is also the source of docs/COLUMN_DICTIONARY.md
 * (tools/build-column-dictionary.js), so the sheet and the document always say the same thing.
 */

var START_LINES = [
  ['Lead CRM - Start Here', 'title'],
  ['Lead Management = your leads. White cells you may change; grey cells are automatic or admin-only. Dashboard = team numbers. Field Guide = what every column means.', ''],
  ['COUNSELLOR - every day', 'head'],
  ['1. Lead CRM > My overdue follow-ups: your calls for today.', ''],
  ['2. After each call: select the lead row, then Lead CRM > Log follow-up. Fill it in and press Save.', ''],
  ['3. A red Lead ID means something is missing: column AH (Data Quality Flags) says what. Fix it.', ''],
  ['ADMIN - every day', 'head'],
  ['1. Paste new leads in Lead Entry (Admin > Show admin sheets), then Lead CRM > Add leads from Lead Entry.', ''],
  ['2. Assign leads in Lead Management column O. 3. Check Dashboard: overdue and incomplete leads per counsellor.', ''],
  ['Mistakes are undone automatically and you will see a short message at the bottom right. Nothing else to remember.', 'foot']
];

function setupStartHere_(sh) {
  sh.clear();
  ensureSize_(sh, 12, 2);
  if (sh.getMaxColumns() > 2) sh.deleteColumns(3, sh.getMaxColumns() - 2);
  if (sh.getMaxRows() > 12) sh.deleteRows(13, sh.getMaxRows() - 12);
  sh.setHiddenGridlines(true);
  sh.setColumnWidth(1, 24);
  sh.setColumnWidth(2, 980);
  START_LINES.forEach(function (l, i) {
    var cell = sh.getRange(i + 1, 2);
    cell.setValue(l[0]).setWrap(true).setFontFamily('Roboto').setFontSize(12).setVerticalAlignment('middle');
    sh.setRowHeight(i + 1, 30);
    if (l[1] === 'title') { cell.setFontSize(20).setFontWeight('bold').setFontColor(COLORS.navy); sh.setRowHeight(i + 1, 44); }
    if (l[1] === 'head') cell.setFontWeight('bold').setFontColor('#FFFFFF').setBackground(COLORS.teal);
    if (l[1] === 'foot') cell.setFontStyle('italic').setFontColor('#566573');
  });
}

/* ================================================================== */
/* Column dictionary (Field Guide sheet + docs/COLUMN_DICTIONARY.md)  */
/* ================================================================== */

var GUIDE_HEADERS = ['Column', 'Field', 'Definition', 'Type', 'Updated by', 'When it is updated', 'Value comes from',
  'Allowed values / format (example)', 'Locked for counsellors?', 'Admins can edit?', 'Validation', 'Used in the Dashboard'];

/** [key, definition, type, updated by, when, comes from, allowed/example, locked for counsellors, admins can edit, validation, dashboard] */
var FIELD_DICTIONARY = [
  ['ID', 'Unique, permanent number of the lead.', 'Script-filled', 'Script', 'Once, when the lead is created from Lead Entry.', 'Lists & Settings: Lead ID Prefix + Lead ID Digits', 'LD-000123', 'Yes', 'No (any change is undone)', 'Reject: any change is undone and logged', 'Every lead count; links the lead to Follow-Up Log'],
  ['NAME', 'Name of the person.', 'Manual', 'Admin', 'When the lead is added; an admin may correct it.', 'Lead Entry', 'Text, required, up to 100 characters (Ravi Kumar)', 'Yes', 'Yes (audited old/new)', 'Reject: empty or too long', 'Lists in reports E and G'],
  ['MOBILE', 'Main phone number.', 'Manual', 'Admin', 'When the lead is added; an admin may correct it.', 'Lead Entry', 'Numbers only, must match Mobile Number Pattern (default 10 digits: 9876543210). Spaces and dashes are removed.', 'Yes', 'Yes (audited old/new)', 'Reject: empty, letters, wrong length; duplicates refused if Duplicate Mobile Check = Block', 'Reports E and G; duplicate flag'],
  ['EMAIL', 'Email address.', 'Manual', 'Admin', 'When the lead is added; an admin may correct it.', 'Lead Entry', 'Optional, a valid email (ravi@example.com)', 'Yes', 'Yes (audited old/new)', 'Reject: not an email; duplicates refused if Duplicate Email Check = Block', 'Duplicate flag only'],
  ['CUSTOM', 'Optional extra field (for example "Course Interested"). Only active fields are shown.', 'Manual, or Dropdown when Allowed Values are set', 'Counsellor (own leads) or Admin', 'Any time.', 'Lists & Settings: Custom Fields table (name, Active, Allowed Values)', 'A value from Allowed Values, or text up to 100 characters (MBA)', 'No, while active and "All Custom Fields" is in Counsellor-Editable Fields', 'Yes', 'Reject: not in Allowed Values or too long', 'Not used'],
  ['OWNER', 'Counsellor responsible for the lead.', 'Dropdown', 'Admin', 'When the lead is added, or when an admin reassigns it.', 'Counsellor Master (Active counsellors)', 'An active counsellor name (Priya Sharma), or empty = unassigned', 'Yes', 'Yes (audited, Lead Assigned entry)', 'Reject: not an active counsellor', 'Counsellor filter, report C, report E, unassigned list (G), reminders'],
  ['STAGE', 'Where the lead is in the sales process.', 'Dropdown', 'Counsellor (own leads) or Admin', 'With the follow-up form, or in the sheet.', 'Stage Master (Active stages). New leads get Default Lead Stage.', 'An active stage (Interested)', 'No', 'Yes', 'Reject: not in the list, or emptied. A change needs a new Next Follow-Up Date', 'Report A (stage-wise), chart'],
  ['SUBSTAGE', 'Detail of the stage (for Lost: the lost reason).', 'Dropdown (depends on Lead Stage)', 'Counsellor (own leads) or Admin', 'With the follow-up form or in the sheet; emptied automatically when the stage changes.', 'Stage Master (substages of the chosen stage)', 'A substage of the current stage (Highly Interested)', 'No', 'Yes', 'Reject: not a substage of the current stage. Required when the stage has substages (else Incomplete)', 'Report B (substage-wise)'],
  ['PRIORITY', 'How urgent the lead is.', 'Dropdown', 'Counsellor (own leads) or Admin', 'Any time.', 'Lists & Settings: Lead Priority', 'Critical, Hot, Warm, Cold', 'No', 'Yes', 'Reject: not in the list, or emptied', 'Not used (colour only)'],
  ['LAST_CONTACT', 'Date of the latest real contact (call, message, meeting).', 'Script-filled', 'Script (admin may correct)', 'When a follow-up is saved with the form, or when an outcome changed in the sheet is counted.', 'Follow-up form / Follow-Up Log', 'A date, not in the future (12-Oct-2026)', 'Yes', 'Yes', 'Reject: not a date, or in the future', 'Not used'],
  ['NEXT_FU', 'When the lead must be contacted next.', 'Date (calendar: double-click the cell)', 'Counsellor (own leads) or Admin', 'With the follow-up form or in the sheet.', 'Follow-up form or the sheet', 'From today up to Max Next Follow-Up Days ahead (default 365) for open leads (20-Oct-2026)', 'No', 'Yes', 'Reject: not a date, in the past, too far ahead, or emptied on an open lead. Required after a stage or outcome change', 'Follow-Ups Pending / Overdue, report E, follow-up ageing (F), reminders'],
  ['OUTCOME', 'Result of the latest contact.', 'Dropdown', 'Counsellor (own leads) or Admin', 'With the follow-up form or in the sheet.', 'Lists & Settings: Contact Outcome', 'Connected, Not Connected, Interested, ... (Call Back)', 'No', 'Yes', 'Reject: not in the list, or emptied. A change needs a new Next Follow-Up Date', 'A change counts as a follow-up (Follow-Ups Completed) once the lead is complete'],
  ['FU_COUNT', 'Number of follow-ups (Contact entries) in Follow-Up Log for this lead.', 'Formula', 'Formula', 'Recalculates automatically.', 'Follow-Up Log', 'Whole number (3)', 'Yes', 'No (any entry is removed)', 'Reject: typed values are removed', 'Not used (the dashboard counts the log itself)'],
  ['UPDATED_BY', 'Who made the latest change (counsellor name, or email).', 'Script-filled', 'Script', 'After every accepted change.', 'Counsellor Master (name for the signed-in email)', 'Priya Sharma', 'Yes', 'No (only in a correction window)', 'Reject: any change is undone and logged', 'Not used'],
  ['LAST_ACTIVITY', 'Date and time of the latest change or follow-up.', 'Script-filled', 'Script', 'After every accepted change or follow-up.', 'The CRM clock', '12-Oct-2026 14:05', 'Yes', 'No (only in a correction window)', 'Reject: any change is undone and logged', 'Report E'],
  ['REMARKS', 'Short note about the latest contact. The only free-text cell for counsellors.', 'Manual', 'Counsellor (own leads) or Admin', 'With the follow-up form or in the sheet.', 'Follow-up form or the sheet', 'Text up to Max Remarks Length (default 500 characters)', 'No', 'Yes', 'Reject: too long, or a formula', 'Not used'],
  ['SOURCE', 'Where the lead came from.', 'Dropdown', 'Admin', 'When the lead is added; an admin may correct it.', 'Lists & Settings: Lead Source', 'Website, Walk-In, Referral, ...', 'Yes', 'Yes (audited old/new)', 'Reject: not in the list, or emptied', 'Lead Source table (report F area)'],
  ['CREATED', 'When the lead was added.', 'Script-filled', 'Script', 'Once, when the lead is created.', 'The CRM clock', '12-Oct-2026 09:30', 'Yes', 'No (only in a correction window)', 'Reject: any change is undone and logged', 'Leads Created (Period), lead ageing (F), lists in G'],
  ['STATUS', 'Overall state: Open, On Hold, Converted, Lost, Duplicate.', 'Dropdown', 'Counsellor (own leads) or Admin; set automatically from the stage', 'In the sheet; automatically when the stage becomes the Converted / Lost Stage (or leaves it).', 'Lists & Settings: Lead Status', 'Open, On Hold, Converted, Lost, Duplicate', 'No', 'Yes', 'Reject: not in the list, emptied, or Converted / Lost without the matching stage', 'Converted / Lost KPIs, conversion rate, open-lead counts, status chart'],
  ['LAST_FU_DATE', 'Date of the latest follow-up (any activity type).', 'Script-filled', 'Script', 'When a follow-up is saved, or an outcome changed in the sheet is counted.', 'Follow-up form / Follow-Up Log', '12-Oct-2026', 'Yes', 'No (only in a correction window)', 'Reject: any change is undone and logged', 'Not used'],
  ['STAGE_CHANGED', 'When the stage or substage last changed.', 'Script-filled', 'Script', 'On every stage or substage change.', 'The CRM clock', '12-Oct-2026 14:05', 'Yes', 'No (only in a correction window)', 'Reject: any change is undone and logged', 'Not used'],
  ['ASSIGNED_DATE', 'When the lead was last (re)assigned.', 'Script-filled', 'Script', 'When Assigned Counsellor changes (or on creation with a counsellor).', 'The CRM clock', '12-Oct-2026 09:30', 'Yes', 'No (only in a correction window)', 'Reject: any change is undone and logged', 'Not used'],
  ['PREV_OWNER', 'Counsellor before the latest reassignment.', 'Script-filled', 'Script', 'When the lead is reassigned.', 'Assigned Counsellor before the change', 'Amit Verma', 'Yes', 'No (only in a correction window)', 'Reject: any change is undone and logged', 'Not used'],
  ['ACTIVITY_TOTAL', 'Number of follow-ups and record updates in Follow-Up Log (automatic System entries not counted).', 'Formula', 'Formula', 'Recalculates automatically.', 'Follow-Up Log', 'Whole number (7)', 'Yes', 'No (any entry is removed)', 'Reject: typed values are removed', 'Not used (the dashboard counts the log itself)'],
  ['DQ_FLAGS', 'Problems with the lead. Starts with "Incomplete: ..." when a required field is missing (the Lead ID turns red).', 'Script-filled', 'Script', 'After every change; all rows hourly.', 'Calculated from the row and Lists & Settings rules', 'Incomplete: Next Follow-Up Date; Duplicate mobile', 'Yes', 'No', 'Recalculated after any change', 'Incomplete Leads KPI and counsellor column, exceptions summary (G)'],
  ['SNAPSHOT', 'Hidden copy of the last accepted values, used to undo wrong changes and to write the audit trail.', 'Hidden system', 'Script', 'After every accepted change.', 'The CRM', 'Hidden', 'Yes', 'No', 'Never edit or paste here', 'Not used']
];

var ENTRY_DICTIONARY = [
  ['A', 'Lead Name', 'Name of the new lead. Required.', 'Manual', 'Text up to 100 characters'],
  ['B', 'Mobile Number', 'Required. Numbers only; must match Mobile Number Pattern.', 'Manual', '9876543210'],
  ['C', 'Email ID', 'Optional. Must be a valid email.', 'Manual', 'ravi@example.com'],
  ['D-M', 'Custom Field 1-10', 'Same names and visibility as the Custom Fields table. Optional.', 'Manual / Dropdown', 'Allowed Values, or text up to 100 characters'],
  ['N', 'Assigned Counsellor', 'Optional. Empty = unassigned.', 'Dropdown', 'Active counsellor'],
  ['O', 'Lead Source', 'Optional.', 'Dropdown', 'Lists & Settings: Lead Source'],
  ['P', 'Lead Priority', 'Optional.', 'Dropdown', 'Lists & Settings: Lead Priority'],
  ['Q', 'Remarks', 'Optional. Copied to Lead Remarks.', 'Manual', 'Up to Max Remarks Length'],
  ['R', 'Result', 'Created or Error. Filled by the CRM.', 'Script-filled', 'Created / Error'],
  ['S', 'Message', 'Why the row was refused, or which lead was created. Filled by the CRM.', 'Script-filled', 'Mobile number must be 10 digits.'],
  ['T', 'Lead ID', 'The new Lead ID. Filled by the CRM.', 'Script-filled', 'LD-000124']
];

/** Rows of the Field Guide (one per Lead Management column; custom slots listed one by one). */
function fieldGuideRows_() {
  var byKey = {};
  FIELD_DICTIONARY.forEach(function (d) { byKey[d[0]] = d; });
  var rows = [];
  for (var c = 1; c <= LEAD_COLS; c++) {
    var key = isCustomCol_(c) ? 'CUSTOM' : lcKeyForCol_(c);
    var d = byKey[key];
    var name = LEAD_HEADERS[c - 1];
    rows.push([colLetter_(c), name].concat(d.slice(1)));
  }
  return rows;
}

function setupFieldGuide_(sh) {
  sh.clear();
  var rows = fieldGuideRows_();
  var entryStart = rows.length + 4;
  ensureSize_(sh, entryStart + ENTRY_DICTIONARY.length + 2, GUIDE_HEADERS.length);
  sh.getRange(1, 1, 1, GUIDE_HEADERS.length).setValues([GUIDE_HEADERS]);
  styleHeader_(sh.getRange(1, 1, 1, GUIDE_HEADERS.length), COLORS.navy);
  sh.getRange(2, 1, rows.length, GUIDE_HEADERS.length).setValues(rows).setWrap(true).setVerticalAlignment('top');
  sh.getRange(entryStart - 1, 1).setValue('Lead Entry sheet (admins only)').setFontWeight('bold').setFontColor(COLORS.navy).setFontSize(12);
  sh.getRange(entryStart, 1, 1, 5).setValues([['Column', 'Field', 'Definition', 'Type', 'Format (example)']]);
  styleHeader_(sh.getRange(entryStart, 1, 1, 5), COLORS.teal);
  sh.getRange(entryStart + 1, 1, ENTRY_DICTIONARY.length, 5).setValues(ENTRY_DICTIONARY).setWrap(true).setVerticalAlignment('top');
  sh.setFrozenRows(1);
  sh.setFrozenColumns(2);
  var widths = [60, 170, 320, 140, 150, 220, 220, 260, 150, 150, 260, 240];
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange(1, 1).setNote('Read-only guide. Counsellor-editable columns depend on Lists & Settings > Counsellor-Editable Fields; this guide shows the defaults.');
}

/* ================================================================== */
/* Admin sheets: hidden from counsellors                               */
/* ================================================================== */

function showSheet_(name) {
  var sh = getSheet_(name);
  if (sh.isSheetHidden()) sh.showSheet();
  return sh;
}

function hideAdminSheets_() {
  var ss = ss_();
  var active = ss.getActiveSheet();
  if (active && ADMIN_SHEETS.indexOf(active.getName()) >= 0) ss.setActiveSheet(ss.getSheetByName(SHEET.START) || ss.getSheetByName(SHEET.LEADS));
  ADMIN_SHEETS.forEach(function (n) { var s = ss.getSheetByName(n); if (s && !s.isSheetHidden()) s.hideSheet(); });
  backupSheets_().forEach(function (s) { if (!s.isSheetHidden()) s.hideSheet(); });
}

/** Lead CRM > Admin > Show admin sheets. */
function showAdminSheets() {
  requireAdmin_();
  ADMIN_SHEETS.forEach(function (n) { if (ss_().getSheetByName(n)) showSheet_(n); });
  backupSheets_().forEach(function (s) { if (s.isSheetHidden()) s.showSheet(); });
  toast_('Admin sheets are visible. Hide them again with Lead CRM > Admin > Hide admin sheets.');
}

/** Lead CRM > Admin > Hide admin sheets. */
function hideAdminSheets() {
  requireAdmin_();
  hideAdminSheets_();
  toast_('Admin sheets hidden.');
}
