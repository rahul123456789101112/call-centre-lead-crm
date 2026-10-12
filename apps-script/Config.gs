/**
 * Config.gs
 * Shared constants and helpers used by every other file in the Lead CRM project.
 *
 * Column numbers are 1-based. Do NOT insert, delete or reorder columns A:AI on
 * "Lead Management" or A:R on "Follow-Up Log". The script addresses columns by position
 * (inserted / deleted columns are detected by the onChange trigger, see Triggers.gs).
 * Custom fields (E:N) are managed by hiding/showing their fixed columns (Lead CRM > Add/Remove
 * custom field), never by inserting or deleting columns. Formulas get column letters from LC via lcf_().
 */

var CRM_TITLE = 'Lead CRM';
var CRM_VERSION = '2.0.0';

var SHEET = {
  START: 'Start Here',
  LEADS: 'Lead Management',
  DASHBOARD: 'Dashboard',
  GUIDE: 'Field Guide',
  ENTRY: 'Lead Entry',
  LOG: 'Follow-Up Log',
  STAGES: 'Stage Master',
  COUNSELLORS: 'Counsellor Master',
  SETTINGS: 'Lists & Settings',
  ACCESS_LOG: 'Access Log',
  DELETED: 'Deleted Leads'
};
var SHEET_ORDER = [SHEET.START, SHEET.LEADS, SHEET.DASHBOARD, SHEET.GUIDE, SHEET.ENTRY, SHEET.LOG, SHEET.STAGES,
  SHEET.COUNSELLORS, SHEET.SETTINGS, SHEET.ACCESS_LOG, SHEET.DELETED];
/** Sheets counsellors do not need: hidden after setup (Admin > Show admin sheets brings them back). */
var ADMIN_SHEETS = [SHEET.ENTRY, SHEET.LOG, SHEET.STAGES, SHEET.COUNSELLORS, SHEET.SETTINGS, SHEET.ACCESS_LOG, SHEET.DELETED];

var LEAD_DATA_ROWS = 10000;   // pre-sized data rows on Lead Management
var LOG_INITIAL_ROWS = 5000;  // pre-sized rows on Follow-Up Log (grows automatically)
var LOG_GROW_BY = 5000;

/* ---------- Lead Management columns ---------- */
var LC = {
  ID: 1, NAME: 2, MOBILE: 3, EMAIL: 4, CUSTOM_FIRST: 5, CUSTOM_LAST: 14, OWNER: 15, STAGE: 16,
  SUBSTAGE: 17, PRIORITY: 18, LAST_CONTACT: 19, NEXT_FU: 20, OUTCOME: 21, FU_COUNT: 22, UPDATED_BY: 23,
  LAST_ACTIVITY: 24, REMARKS: 25, SOURCE: 26, CREATED: 27, STATUS: 28,
  LAST_FU_DATE: 29, STAGE_CHANGED: 30, ASSIGNED_DATE: 31, PREV_OWNER: 32,
  ACTIVITY_TOTAL: 33, DQ_FLAGS: 34, SNAPSHOT: 35
};
var CUSTOM_SLOTS = 10;
var LEAD_COLS = 35;

var LEAD_HEADERS = (function () {
  var h = ['Lead ID', 'Lead Name', 'Mobile Number', 'Email ID'];
  for (var i = 1; i <= CUSTOM_SLOTS; i++) h.push(defaultCustomName_(i));
  return h.concat(['Assigned Counsellor', 'Lead Stage', 'Lead Substage', 'Lead Priority', 'Last Contact Date',
    'Next Follow-Up Date', 'Last Follow-Up Outcome', 'Follow-Up Count', 'Last Updated By',
    'Last Activity Timestamp', 'Lead Remarks', 'Lead Source', 'Lead Created Date', 'Lead Status',
    'Last Follow-Up Date', 'Last Stage Change Date', 'Lead Assigned Date', 'Previous Counsellor',
    'Total Activities', 'Data Quality Flags', 'Audit Snapshot (system)']);
})();

function defaultCustomName_(slot) { return 'Custom Field ' + slot; }
/** Lead Management column of custom field slot 1-10. */
function customCol_(slot) { return LC.CUSTOM_FIRST + slot - 1; }

/** Columns whose cells are produced by an ARRAYFORMULA in the header row. */
var LEAD_FORMULA_COLS = [LC.FU_COUNT, LC.ACTIVITY_TOTAL];
/** Columns written only by the script (Data Quality Flags are computed by the script, not a formula). */
var LEAD_SYSTEM_COLS = [LC.ID, LC.UPDATED_BY, LC.LAST_ACTIVITY, LC.CREATED, LC.LAST_FU_DATE,
  LC.STAGE_CHANGED, LC.ASSIGNED_DATE, LC.PREV_OWNER, LC.DQ_FLAGS, LC.SNAPSHOT];
/** Contact / assignment columns: locked for counsellors, editable by admins (every change audited). */
var LEAD_ADMIN_COLS = [LC.NAME, LC.MOBILE, LC.EMAIL, LC.OWNER, LC.SOURCE];
/** Columns that may appear in "Counsellor-Editable Fields" (plus custom fields). */
var EDITABLE_CANDIDATE_COLS = [LC.STAGE, LC.SUBSTAGE, LC.PRIORITY, LC.LAST_CONTACT, LC.NEXT_FU, LC.OUTCOME, LC.REMARKS, LC.STATUS];
var ALL_CUSTOM_FIELDS = 'All Custom Fields';
/** Default Lists & Settings > Counsellor-Editable Fields. Everything else is locked for counsellors. */
var DEFAULT_EDITABLE_FIELDS = ['Lead Stage', 'Lead Substage', 'Lead Priority', 'Next Follow-Up Date', 'Last Follow-Up Outcome',
  'Lead Remarks', 'Lead Status', ALL_CUSTOM_FIELDS];

/* ---------- Follow-Up Log columns ---------- */
var LG = {
  ACT_ID: 1, LEAD_ID: 2, LEAD_NAME: 3, COUNSELLOR: 4, TIME: 5, TYPE: 6, OUTCOME: 7, STAGE: 8,
  SUBSTAGE: 9, NEXT_FU: 10, REMARKS: 11, UPDATED_BY: 12, CATEGORY: 13, FIELD: 14, OLD: 15,
  NEW: 16, OWNER: 17, SUBMISSION: 18
};
var LOG_COLS = 18;
var LOG_HEADERS = ['Activity ID', 'Lead ID', 'Lead Name', 'Counsellor Name', 'Activity Date and Time',
  'Activity Type', 'Contact Outcome', 'Lead Stage at Time of Activity', 'Lead Substage at Time of Activity',
  'Next Follow-Up Date', 'Remarks', 'Updated By', 'Activity Category', 'Field Changed', 'Old Value',
  'New Value', 'Lead Owner at Time', 'Submission ID'];

/* ---------- Stage Master / Counsellor Master ---------- */
var SM = { ID: 1, STAGE: 2, SUBSTAGE: 3, DESC: 4, ORDER: 5, ACTIVE: 6, REMARKS: 7 };
var STAGE_HEADERS = ['Stage ID', 'Lead Stage', 'Substage', 'Stage Description', 'Stage Order', 'Active Status', 'Admin Remarks'];
var CM = { ID: 1, NAME: 2, EMAIL: 3, LEADER: 4, TEAM: 5, ACTIVE: 6, ADDED: 7 };
var COUNSELLOR_HEADERS = ['Counsellor ID', 'Counsellor Name', 'Email ID', 'Team Leader', 'Team Name', 'Active / Inactive Status', 'Date Added'];

/* ---------- Lists & Settings layout ---------- */
var LS = {
  PRIORITY: 1, OUTCOME: 2, SOURCE: 3, STATUS: 4, ACT_TYPE: 5, ACT_CATEGORY: 6, ACT_SIDEBAR: 7,
  ACTIVE_VALUES: 8, BUCKET_LABEL: 10, BUCKET_MIN: 11, BUCKET_MAX: 12, SET_KEY: 14, SET_VALUE: 15,
  SET_DESC: 16, H_ACTIVE_STAGES: 18, H_ALL_STAGES: 19, H_ACTIVE_CNS: 20, H_CNS_FILTER: 21,
  H_PERIODS: 22, H_PAIRS: 23, CF_SLOT: 26, CF_NAME: 27, CF_ACTIVE: 28, CF_ALLOWED: 29, OLD_LOCKED: 30, EDITABLE: 31
};
var EDITABLE_HEADER = 'Counsellor-Editable Fields';

/* ---------- Access Log (portal / sheet access audit) ---------- */
var AL_HEADERS = ['Timestamp', 'User Email', 'Counsellor', 'Action', 'Lead ID', 'Details', 'Source'];

var ACTIVE = 'Active';
var INACTIVE = 'Inactive';
var CATEGORY = { CONTACT: 'Contact', RECORD: 'Record Update', SYSTEM: 'System' };
var STATUS = { OPEN: 'Open', ON_HOLD: 'On Hold', CONVERTED: 'Converted', LOST: 'Lost', DUPLICATE: 'Duplicate' };
var CLOSED_STATUSES = [STATUS.CONVERTED, STATUS.LOST, STATUS.DUPLICATE];

/** Activity types the script itself writes (audit trail). */
var ACT = {
  LEAD_CREATED: 'Lead Created', LEAD_ASSIGNED: 'Lead Assigned', STAGE_UPDATED: 'Stage Updated',
  STATUS_UPDATED: 'Status Updated', FU_SCHEDULED: 'Follow-Up Scheduled',
  SUBSTAGE_CLEARED: 'Substage Cleared', LOG_EDITED: 'Log Edited', FIELD_UPDATED: 'Field Updated',
  EDIT_REVERTED: 'Edit Reverted', SHEET_UPDATE: 'Sheet Update', LEAD_DELETED: 'Lead Deleted',
  LEAD_RESTORED: 'Lead Restored', LEAD_PURGED: 'Lead Purged', SYS_CORRECTED: 'System Field Corrected',
  CORRECTION_OPENED: 'Correction Window Opened'
};

var PERIODS = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Current Month', 'Previous Month', 'Custom Date Range'];
var ALL_COUNSELLORS = 'All Counsellors';

/** Setting keys (column N of Lists & Settings). Values are read by key, so rows may be reordered. */
var SET = {
  LEAD_PREFIX: 'Lead ID Prefix',
  LEAD_DIGITS: 'Lead ID Digits',
  ACT_PREFIX: 'Activity ID Prefix',
  DEFAULT_STATUS: 'Default Lead Status',
  DEFAULT_STAGE: 'Default Lead Stage',
  DEFAULT_SUBSTAGE: 'Default Lead Substage',
  CONVERTED_STAGE: 'Converted Stage',
  LOST_STAGE: 'Lost Stage',
  AUTO_SYNC: 'Auto-Set Status From Stage',
  DUP_MOBILE: 'Duplicate Mobile Check',
  DUP_EMAIL: 'Duplicate Email Check',
  MOBILE_PATTERN: 'Mobile Number Pattern',
  UPCOMING_DAYS: 'Upcoming Follow-Up Window (Days)',
  REQUIRE_NEXT_FU: 'Require Next Follow-Up For Open Leads',
  REQUIRE_REMARKS: 'Require Remarks On Follow-Up',
  REQUIRE_SUBSTAGE: 'Require Substage',
  MAX_FU_DAYS: 'Max Next Follow-Up Days',
  MAX_REMARKS: 'Max Remarks Length',
  MOBILE_MESSAGE: 'Mobile Number Message',
  BLOCK_UNKNOWN: 'Block Edits From Unknown Users',
  FORM_ACTIVITY: 'Follow-Up Form Activity Type',
  MAX_BACKDATE: 'Max Backdate Days For Activities',   // obsolete (removed from the sheet by setup)
  REMINDERS: 'Email Reminders Enabled',
  REMINDER_HOUR: 'Reminder Hour (0-23)',
  ADMINS: 'Admin Emails'
};

/** Default settings: [key, value, description, allowed values (optional)]. */
var DEFAULT_SETTINGS = [
  [SET.LEAD_PREFIX, 'LD-', 'Text placed before the running number of every new Lead ID.'],
  [SET.LEAD_DIGITS, 6, 'Number of digits in the running number (LD-000001).'],
  [SET.ACT_PREFIX, 'ACT-', 'Text placed before every Activity ID in Follow-Up Log.'],
  [SET.DEFAULT_STATUS, STATUS.OPEN, 'Lead Status given to every new lead.'],
  [SET.DEFAULT_STAGE, 'New Lead', 'Lead Stage given to every new lead (blank = none).'],
  [SET.DEFAULT_SUBSTAGE, 'Not Contacted', 'Substage given with the default stage (must belong to it).'],
  [SET.CONVERTED_STAGE, 'Converted', 'Lead Status "Converted" is only allowed in this stage; moving a lead here sets it.'],
  [SET.LOST_STAGE, 'Lost', 'Lead Status "Lost" is only allowed in this stage; moving a lead here sets it.'],
  [SET.AUTO_SYNC, 'Yes', 'Yes = apply the two rules above automatically.', ['Yes', 'No']],
  [SET.DUP_MOBILE, 'Warn', 'Off = no check; Warn = allow but flag; Block = refuse a duplicate mobile.', ['Off', 'Warn', 'Block']],
  [SET.DUP_EMAIL, 'Warn', 'Off = no check; Warn = allow but flag; Block = refuse a duplicate email.', ['Off', 'Warn', 'Block']],
  [SET.MOBILE_PATTERN, '^[0-9]{10}$', 'Pattern a mobile number must match after spaces and dashes are removed. Numbers that do not match are refused.'],
  [SET.MOBILE_MESSAGE, 'Mobile number must be 10 digits.', 'Message shown when a mobile number does not match the pattern above.'],
  [SET.UPCOMING_DAYS, 3, 'Follow-ups due within this many days are highlighted as upcoming.'],
  [SET.REQUIRE_NEXT_FU, 'Yes', 'Yes = after a stage or outcome change, an open lead needs a new next follow-up date (until then it shows as Incomplete).', ['Yes', 'No']],
  [SET.REQUIRE_SUBSTAGE, 'Yes', 'Yes = a substage is needed when the stage has substages (for Lost: the lost reason).', ['Yes', 'No']],
  [SET.REQUIRE_REMARKS, 'Yes', 'Yes = the follow-up form needs remarks.', ['Yes', 'No']],
  [SET.MAX_FU_DAYS, 365, 'Latest allowed next follow-up date, in days from today.'],
  [SET.MAX_REMARKS, 500, 'Maximum number of characters in Lead Remarks and form remarks.'],
  [SET.FORM_ACTIVITY, 'Outbound Call', 'Activity Type recorded for follow-ups saved with the follow-up form.'],
  [SET.BLOCK_UNKNOWN, 'Yes', 'Yes = edits in Lead Management are undone when the CRM cannot tell who made them (the person must use the Lead CRM menu once).', ['Yes', 'No']],
  [SET.REMINDERS, 'No', 'Daily email reminders. Change only through Lead CRM > Admin > Enable daily email reminders.', ['Yes', 'No']],
  [SET.REMINDER_HOUR, 8, 'Hour of day (spreadsheet time zone) when reminders are sent.'],
  [SET.ADMINS, '', 'Comma-separated emails of CRM administrators (any email provider). Then run Admin > Reapply protections.']
];
/** Settings rows removed by setup because the feature no longer exists. */
var OBSOLETE_SETTINGS = [SET.MAX_BACKDATE];

/** Settings cells exposed as named ranges so formulas, validation and formatting can read them. */
var NAMED = {
  MOBILE_PATTERN: { name: 'SET_MOBILE_PATTERN', key: SET.MOBILE_PATTERN },
  UPCOMING_DAYS: { name: 'SET_UPCOMING_DAYS', key: SET.UPCOMING_DAYS },
  DUP_MOBILE: { name: 'SET_DUP_MOBILE', key: SET.DUP_MOBILE },
  DUP_EMAIL: { name: 'SET_DUP_EMAIL', key: SET.DUP_EMAIL },
  MAX_REMARKS: { name: 'SET_MAX_REMARKS', key: SET.MAX_REMARKS }
};

var PROP = {
  LEAD_SEQ: 'LEAD_SEQ', ACT_SEQ: 'ACT_SEQ', EDIT_MODE: 'EDIT_MODE', USER_KEY_PREFIX: 'UK_',
  DASH_LAYOUT: 'DASH_LAYOUT', LAST_SUBSTAGE_REFRESH: 'LAST_SUBSTAGE_REFRESH',
  SUBSTAGE_MAP: 'SUBSTAGE_MAP_V1', WEB_APP_URL: 'WEB_APP_URL', DASH_CHART_COUNTS: 'DASH_CHART_COUNTS',
  IDENTITY_URL: 'IDENTITY_URL', IDENTITY_SECRET: 'IDENTITY_SECRET', QUEUE_PREFIX: 'FUQ_',
  CORRECTION: 'SYS_CORRECTION', DV_DATE: 'DV_DATE'
};

/* ================================================================== */
/* Generic helpers                                                     */
/* ================================================================== */

var _memo = {};
/** Per-execution memoisation (each trigger / server call is a fresh execution). */
function memo_(key, fn) {
  if (!Object.prototype.hasOwnProperty.call(_memo, key)) _memo[key] = fn();
  return _memo[key];
}
function clearMemo_(key) {
  if (key) delete _memo[key]; else _memo = {};
}

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function getSheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Sheet "' + name + '" is missing. Run Lead CRM > Admin > Set up / repair workbook.');
  return sh;
}

function colLetter_(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/**
 * Fills {KEY} placeholders in a formula template with Lead Management column letters from LC,
 * e.g. lcf_('=${NEXT_FU}2<TODAY()') -> '=$T2<TODAY()'. Keeps formulas in step with column moves.
 */
function lcf_(template) {
  return String(template).replace(/\{([A-Z_]+)\}/g, function (m, key) {
    if (!LC[key]) throw new Error('Unknown Lead Management column key ' + key);
    return colLetter_(LC[key]);
  });
}

function pad_(num, digits) {
  var s = String(num);
  while (s.length < digits) s = '0' + s;
  return s;
}

function str_(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function same_(a, b) { return str_(a).toLowerCase() === str_(b).toLowerCase(); }
function yes_(v) { return /^(yes|y|true|1)$/i.test(str_(v)); }
function isClosedStatus_(s) { return CLOSED_STATUSES.some(function (c) { return same_(c, s); }); }
function escapeRegex_(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** Prevents user text being interpreted as a formula when written with setValues. */
function safeText_(v) {
  var s = str_(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function getUiSafe_() {
  try { return SpreadsheetApp.getUi(); } catch (e) { return null; }
}

function toast_(msg, seconds) {
  try { ss_().toast(msg, CRM_TITLE, seconds || 6); } catch (e) { /* no UI in this context */ }
}

/* ---------- Dates (always in the spreadsheet's time zone) ---------- */

function sheetTz_() {
  return memo_('tz', function () { return ss_().getSpreadsheetTimeZone() || Session.getScriptTimeZone(); });
}

/** Offset such as +05:30 for the given date in the spreadsheet time zone. */
function tzOffset_(d) {
  var o = Utilities.formatDate(d, sheetTz_(), 'XXX');
  return o === 'Z' ? '+00:00' : o;
}

/** Converts a Date, a yyyy-MM-dd string or a Sheets serial number to 'yyyy-MM-dd' ('' if not a date). */
function toDateKey_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, sheetTz_(), 'yyyy-MM-dd');
  }
  var s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  if (/^\d+(\.\d+)?$/.test(s)) { // Sheets serial number (days since 1899-12-30)
    var ms = Date.UTC(1899, 11, 30) + Math.floor(parseFloat(s)) * 86400000;
    var d = new Date(ms);
    return d.getUTCFullYear() + '-' + pad_(d.getUTCMonth() + 1, 2) + '-' + pad_(d.getUTCDate(), 2);
  }
  return '';
}

/** Midnight of the given yyyy-MM-dd in the spreadsheet time zone, as a Date. */
function dateFromKey_(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  var noon = new Date(key + 'T12:00:00Z');
  var d = new Date(key + 'T00:00:00' + tzOffset_(noon));
  return isNaN(d.getTime()) ? null : d;
}

/** Parses 'yyyy-MM-ddTHH:mm' (datetime-local input) in the spreadsheet time zone. */
function dateTimeFromLocal_(s) {
  var m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(str_(s));
  if (!m) return null;
  var d = new Date(m[1] + 'T' + m[2] + ':' + m[3] + ':00' + tzOffset_(new Date(m[1] + 'T12:00:00Z')));
  return isNaN(d.getTime()) ? null : d;
}

function todayKey_() { return toDateKey_(new Date()); }
function todayDate_() { return dateFromKey_(todayKey_()); }

function addDaysKey_(key, days) {
  var d = new Date(key + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().substring(0, 10);
}

function displayValue_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, sheetTz_(), 'dd-MMM-yyyy');
  }
  return str_(v);
}

function displayDateTime_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, sheetTz_(), 'dd-MMM-yyyy HH:mm');
  }
  return str_(v);
}

/* ================================================================== */
/* Settings & master data                                              */
/* ================================================================== */

/** Raw key -> value map from Lists & Settings (columns N:O). */
function getSettingsMap_() {
  return memo_('settingsMap', function () {
    var map = {};
    DEFAULT_SETTINGS.forEach(function (d) { map[d[0]] = d[1]; });
    var sh = ss_().getSheetByName(SHEET.SETTINGS);
    if (!sh) return map;
    var last = sh.getLastRow();
    if (last < 2) return map;
    sh.getRange(2, LS.SET_KEY, last - 1, 2).getValues().forEach(function (r) {
      var k = str_(r[0]);
      if (k) map[k] = r[1];
    });
    return map;
  });
}

function getSettings_() {
  return memo_('settings', function () {
    var m = getSettingsMap_();
    var num = function (v, d) { var n = parseInt(v, 10); return isNaN(n) ? d : n; };
    return {
      leadPrefix: str_(m[SET.LEAD_PREFIX]),
      leadDigits: Math.min(Math.max(num(m[SET.LEAD_DIGITS], 6), 3), 10),
      actPrefix: str_(m[SET.ACT_PREFIX]) || 'ACT-',
      defaultStatus: str_(m[SET.DEFAULT_STATUS]) || STATUS.OPEN,
      defaultStage: str_(m[SET.DEFAULT_STAGE]),
      defaultSubstage: str_(m[SET.DEFAULT_SUBSTAGE]),
      convertedStage: str_(m[SET.CONVERTED_STAGE]),
      lostStage: str_(m[SET.LOST_STAGE]),
      autoSync: yes_(m[SET.AUTO_SYNC]),
      dupMobile: str_(m[SET.DUP_MOBILE]) || 'Warn',
      dupEmail: str_(m[SET.DUP_EMAIL]) || 'Warn',
      mobilePattern: str_(m[SET.MOBILE_PATTERN]),
      upcomingDays: num(m[SET.UPCOMING_DAYS], 3),
      requireNextFu: yes_(m[SET.REQUIRE_NEXT_FU]),
      requireRemarks: yes_(m[SET.REQUIRE_REMARKS]),
      requireSubstage: yes_(m[SET.REQUIRE_SUBSTAGE]),
      maxFuDays: Math.max(num(m[SET.MAX_FU_DAYS], 365), 1),
      maxRemarks: Math.min(Math.max(num(m[SET.MAX_REMARKS], 500), 20), 5000),
      mobileMessage: str_(m[SET.MOBILE_MESSAGE]) || 'Mobile number format is not valid.',
      blockUnknown: yes_(m[SET.BLOCK_UNKNOWN]),
      formActivity: str_(m[SET.FORM_ACTIVITY]) || 'Outbound Call',
      remindersEnabled: yes_(m[SET.REMINDERS]),
      reminderHour: Math.min(Math.max(num(m[SET.REMINDER_HOUR], 8), 0), 23),
      adminEmails: str_(m[SET.ADMINS]).split(/[,;\s]+/).map(function (e) { return e.toLowerCase(); })
        .filter(function (e) { return e.indexOf('@') > 0; })
    };
  });
}

/** Writes one setting value (used by admin menu actions). */
function setSettingValue_(key, value) {
  var sh = getSheet_(SHEET.SETTINGS);
  var last = Math.max(sh.getLastRow(), 2);
  var keys = sh.getRange(2, LS.SET_KEY, last - 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (same_(keys[i][0], key)) { sh.getRange(i + 2, LS.SET_VALUE).setValue(value); clearMemo_(); return; }
  }
  throw new Error('Setting "' + key + '" not found in Lists & Settings.');
}

/** Dropdown lists from Lists & Settings (columns A:H). */
function getLists_() {
  return memo_('lists', function () {
    var sh = getSheet_(SHEET.SETTINGS);
    var last = Math.max(sh.getLastRow(), 2);
    var v = sh.getRange(2, 1, last - 1, LS.ACTIVE_VALUES).getValues();
    var col = function (c) {
      var out = [];
      v.forEach(function (r) { var s = str_(r[c - 1]); if (s && out.indexOf(s) < 0) out.push(s); });
      return out;
    };
    var types = [];
    v.forEach(function (r) {
      var t = str_(r[LS.ACT_TYPE - 1]);
      if (!t) return;
      types.push({
        type: t,
        category: str_(r[LS.ACT_CATEGORY - 1]) || CATEGORY.CONTACT,
        sidebar: yes_(r[LS.ACT_SIDEBAR - 1])
      });
    });
    return {
      priorities: col(LS.PRIORITY), outcomes: col(LS.OUTCOME), sources: col(LS.SOURCE),
      statuses: col(LS.STATUS), activityTypes: types
    };
  });
}

function activityCategory_(type) {
  var t = getLists_().activityTypes.filter(function (a) { return same_(a.type, type); })[0];
  return t ? t.category : CATEGORY.CONTACT;
}

/**
 * Stage Master as a lookup object. A stage is active when at least one of its rows is Active.
 * Substage lists contain only active substages, in Stage Order then sheet order.
 */
function getStageInfo_() {
  return memo_('stageInfo', function () {
    var sh = getSheet_(SHEET.STAGES);
    var last = sh.getLastRow();
    var rows = last < 2 ? [] : sh.getRange(2, 1, last - 1, STAGE_HEADERS.length).getValues();
    var stages = {};   // lower(stage) -> {name, order, active, subs:[], allSubs:{}}
    var orderSeq = 0;
    rows.forEach(function (r, idx) {
      var stage = str_(r[SM.STAGE - 1]);
      if (!stage) return;
      var key = stage.toLowerCase();
      var sub = str_(r[SM.SUBSTAGE - 1]);
      var active = same_(r[SM.ACTIVE - 1], ACTIVE);
      var order = parseFloat(r[SM.ORDER - 1]);
      if (!stages[key]) stages[key] = { name: stage, order: isNaN(order) ? 9999 : order, seq: orderSeq++, active: false, subs: [], allSubs: {} };
      var s = stages[key];
      if (!isNaN(order) && order < s.order) s.order = order;
      if (active) s.active = true;
      if (sub) {
        s.allSubs[sub.toLowerCase()] = sub;
        if (active && s.subs.map(function (x) { return x.toLowerCase(); }).indexOf(sub.toLowerCase()) < 0) s.subs.push(sub);
      }
    });
    var list = Object.keys(stages).map(function (k) { return stages[k]; })
      .sort(function (a, b) { return a.order - b.order || a.seq - b.seq; });
    return {
      list: list,
      activeStages: list.filter(function (s) { return s.active; }),
      get: function (stage) { return stages[str_(stage).toLowerCase()] || null; },
      canonicalStage: function (stage) { var s = stages[str_(stage).toLowerCase()]; return s ? s.name : ''; },
      isActiveStage: function (stage) { var s = stages[str_(stage).toLowerCase()]; return !!(s && s.active); },
      activeSubs: function (stage) { var s = stages[str_(stage).toLowerCase()]; return s ? s.subs.slice() : []; },
      isActivePair: function (stage, sub) {
        var s = stages[str_(stage).toLowerCase()];
        if (!s) return false;
        return s.subs.some(function (x) { return same_(x, sub); });
      },
      canonicalSub: function (stage, sub) {
        var s = stages[str_(stage).toLowerCase()];
        if (!s) return '';
        var hit = s.subs.filter(function (x) { return same_(x, sub); })[0];
        return hit || '';
      }
    };
  });
}

/** All counsellors from Counsellor Master. */
function getCounsellors_() {
  return memo_('counsellors', function () {
    var sh = ss_().getSheetByName(SHEET.COUNSELLORS);
    if (!sh) return [];
    var last = sh.getLastRow();
    if (last < 2) return [];
    return sh.getRange(2, 1, last - 1, COUNSELLOR_HEADERS.length).getValues()
      .filter(function (r) { return str_(r[CM.NAME - 1]); })
      .map(function (r) {
        return {
          id: str_(r[CM.ID - 1]), name: str_(r[CM.NAME - 1]), email: str_(r[CM.EMAIL - 1]).toLowerCase(),
          leader: str_(r[CM.LEADER - 1]), team: str_(r[CM.TEAM - 1]), active: same_(r[CM.ACTIVE - 1], ACTIVE)
        };
      });
  });
}

function activeCounsellorNames_() {
  return getCounsellors_().filter(function (c) { return c.active; }).map(function (c) { return c.name; });
}

function isActiveCounsellor_(name) {
  return getCounsellors_().some(function (c) { return c.active && same_(c.name, name); });
}

/**
 * Canonical form of an email for comparisons. Lower-case; for Gmail addresses dots and "+tags" in the
 * local part are ignored and googlemail.com = gmail.com (Google treats them as the same account).
 * Other providers are compared exactly (lower-case), because their rules differ.
 */
function normEmail_(email) {
  var e = str_(email).toLowerCase();
  var at = e.lastIndexOf('@');
  if (at < 1) return e;
  var local = e.substring(0, at), domain = e.substring(at + 1);
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.split('+')[0].replace(/\./g, '');
    domain = 'gmail.com';
  }
  return local + '@' + domain;
}

function sameEmail_(a, b) { return !!a && !!b && normEmail_(a) === normEmail_(b); }

function counsellorForEmail_(email) {
  if (!email) return null;
  return getCounsellors_().filter(function (c) { return sameEmail_(c.email, email); })[0] || null;
}

/* ================================================================== */
/* Identity                                                            */
/* ================================================================== */

/**
 * Best available identity of the person making the current change.
 * Order: edit event user -> Session active user -> temporary-key mapping
 * registered when the user opened the follow-up sidebar or ran "Identify me".
 * Returns {email, name, label}. label = counsellor name if mapped, else email, else 'Unidentified user'.
 */
function getActor_(e) {
  var email = '';
  var installable = !!(e && e.triggerUid);
  try { if (e && e.user && e.user.getEmail) email = e.user.getEmail() || ''; } catch (err) { /* not available */ }
  if (!email && !installable) { try { email = Session.getActiveUser().getEmail() || ''; } catch (err) { /* not available */ } }
  if (!email) {
    // Personal Google accounts: Google does not reveal the editor's email to a trigger owned by someone
    // else. The simple onEdit (running AS the editor) stores the editor's temporary key for this edit;
    // the key maps to an email the user registered by authorising the script (registerCurrentUser_).
    var key = '';
    if (installable && e.range) key = waitForEditorKey_(e);
    else { try { key = Session.getTemporaryActiveUserKey(); } catch (err) { /* not available */ } }
    if (key) email = PropertiesService.getScriptProperties().getProperty(PROP.USER_KEY_PREFIX + key) || '';
  }
  var c = counsellorForEmail_(email);
  var name = c ? c.name : '';
  return { email: email, name: name, label: name || email || 'Unidentified user', admin: isAdmin_(email),
    counsellor: c && c.active ? c.name : '' };
}

/* ---------- Editor key hand-off between the two edit triggers ---------- */

function editHandoffKey_(range, value) {
  var v = value === undefined ? '' : String(value);
  var digest = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, v, Utilities.Charset.UTF_8));
  return 'EDK_' + range.getSheet().getSheetId() + '_' + range.getA1Notation() + '_' + digest;
}

/** Simple onEdit (runs as the editor): remember who made this edit for the installable trigger. */
function rememberEditor_(e) {
  try {
    var key = Session.getTemporaryActiveUserKey();
    if (key) CacheService.getScriptCache().put(editHandoffKey_(e.range, e.value), key, 120);
  } catch (err) { /* not available */ }
}

/** Installable onEdit (runs as the owner): wait up to ~3 s for the simple trigger's hand-off. */
function waitForEditorKey_(e) {
  try {
    var cache = CacheService.getScriptCache();
    var k = editHandoffKey_(e.range, e.value);
    for (var i = 0; i < 12; i++) {
      var v = cache.get(k);
      if (v) return v;
      Utilities.sleep(250);
    }
  } catch (err) { /* ignore */ }
  return '';
}

/**
 * Called from authorised contexts (sidebar, every admin menu action). In these contexts the user has
 * authorised the script themselves, so Google returns their email even for personal accounts.
 * Stores temporaryKey -> email so later sheet edits by the same person can be attributed.
 * Google rotates the temporary key every 30 days; any menu use re-registers it.
 */
function registerCurrentUser_() {
  var email = '';
  try { email = Session.getActiveUser().getEmail() || ''; } catch (err) { /* ignore */ }
  if (email) {
    try {
      var key = Session.getTemporaryActiveUserKey();
      if (key) PropertiesService.getScriptProperties().setProperty(PROP.USER_KEY_PREFIX + key, email);
    } catch (err) { /* ignore */ }
  }
  var c = counsellorForEmail_(email);
  return { email: email, name: c ? c.name : '', label: (c && c.name) || email || 'Unidentified user',
    admin: isAdmin_(email), counsellor: c && c.active ? c.name : '' };
}

/** Admin Emails setting plus the spreadsheet owner (used for sheet protection and the Admin menu). */
function getAdminEmails_() {
  var list = getSettings_().adminEmails.slice();
  try {
    var owner = ss_().getOwner();
    if (owner && owner.getEmail() && !list.some(function (a) { return sameEmail_(a, owner.getEmail()); })) list.push(owner.getEmail().toLowerCase());
  } catch (e) { /* shared drive files have no owner */ }
  return list;
}

function isAdmin_(email) {
  if (!email) return false;
  return getAdminEmails_().some(function (a) { return sameEmail_(a, email); });
}

/** Listed in Lists & Settings > Admin Emails (the web app's admin rule: the list only). */
function isListedAdmin_(email) {
  return !!email && getSettings_().adminEmails.some(function (a) { return sameEmail_(a, email); });
}

/** Throws (and alerts) if the current user is not a CRM administrator. */
function requireAdmin_() {
  var email = '';
  try { email = Session.getActiveUser().getEmail(); } catch (e) { /* ignore */ }
  if (isAdmin_(email)) { registerCurrentUser_(); return email; }
  var msg = 'Only CRM administrators can do this.' +
    (email ? ' (' + email + ' is not in Lists & Settings > ' + SET.ADMINS + '.)' : ' Google did not tell the CRM who you are.');
  notify_(msg);   // non-blocking: ui.alert would pause the script until someone clicks OK
  throw new Error(msg);
}

/* ================================================================== */
/* IDs                                                                 */
/* ================================================================== */

/**
 * Reserves `count` consecutive numbers from a document-property counter and returns the first.
 * Caller MUST hold the document lock.
 */
function nextSeq_(key, count, initFn) {
  var props = PropertiesService.getDocumentProperties();
  var cur = parseInt(props.getProperty(key), 10);
  if (isNaN(cur)) cur = initFn();
  props.setProperty(key, String(cur + count));
  return cur + 1;
}

/** Highest running number used in a column for IDs of the form <prefix><digits>. */
function maxIdNumber_(sheet, col, prefix) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var re = new RegExp('^' + escapeRegex_(prefix) + '(\\d+)$', 'i');
  var max = 0;
  sheet.getRange(2, col, last - 1, 1).getValues().forEach(function (r) {
    var m = re.exec(str_(r[0]));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return max;
}

/** Last row on Lead Management that holds any lead data (ignores formula output columns). */
function lastLeadRow_(sheet) {
  var max = 1;
  var maxRows = sheet.getMaxRows();
  [LC.ID, LC.NAME, LC.MOBILE, LC.EMAIL, LC.OWNER, LC.STAGE].forEach(function (c) {
    var cell = sheet.getRange(maxRows, c);
    var r = cell.getValue() !== '' ? maxRows : cell.getNextDataCell(SpreadsheetApp.Direction.UP).getRow();
    if (r > max) max = r;
  });
  return max;
}

/** Finds a lead's current row by Lead ID (rows move when sorted, IDs do not). */
function findLeadRow_(sheet, leadId) {
  var id = str_(leadId);
  if (!id) return 0;
  var last = lastLeadRow_(sheet);
  if (last < 2) return 0;
  var hit = sheet.getRange(2, LC.ID, last - 1, 1).createTextFinder(id).matchEntireCell(true).findNext();
  return hit ? hit.getRow() : 0;
}

/* ================================================================== */
/* Lead snapshot (used to detect what changed, also for bulk edits)    */
/* ================================================================== */

/** Tracked fields: o = owner, s = stage, ss = substage, st = status, n = next follow-up (yyyy-MM-dd). */
function readTracked_(row) {
  return {
    o: str_(row[LC.OWNER - 1]),
    s: str_(row[LC.STAGE - 1]),
    ss: str_(row[LC.SUBSTAGE - 1]),
    st: str_(row[LC.STATUS - 1]),
    n: toDateKey_(row[LC.NEXT_FU - 1])
  };
}

/** Columns whose last accepted value is kept in the snapshot (everything except formulas, flags, snapshot). */
var SNAP_COLS = (function () {
  var out = [];
  for (var c = 1; c <= LEAD_COLS; c++) {
    if (c === LC.FU_COUNT || c === LC.ACTIVITY_TOTAL || c === LC.DQ_FLAGS || c === LC.SNAPSHOT) continue;
    out.push(c);
  }
  return out;
})();

function encodeVal_(v) {
  if (isDate_(v)) return { d: v.getTime() };
  return v === null || v === undefined ? '' : v;
}
function decodeVal_(x) {
  if (x && typeof x === 'object' && typeof x.d === 'number') return new Date(x.d);
  return x === null || x === undefined ? '' : x;
}
/** Comparable form of a cell value (dates by time, everything else as text). */
function cellKey_(v) {
  if (isDate_(v)) return 'D' + v.getTime();
  return v === null || v === undefined ? '' : String(v);
}
function isDate_(v) { return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime()); }

/**
 * Snapshot (hidden column AI) = the last ACCEPTED value of every lead column, plus:
 *   p  = required fields still missing because of a change (e.g. ["Next Follow-Up Date"] after an outcome change)
 *   pc = outcome changes made in the sheet that are not yet counted as follow-ups (lead incomplete)
 * The edit guard compares the sheet with this snapshot and restores anything that was not allowed.
 */
function buildSnapshot_(row, extra) {
  extra = extra || {};
  var t = readTracked_(row);
  var v = {};
  SNAP_COLS.forEach(function (c) {
    var x = row[c - 1];
    if (x !== '' && x !== null && x !== undefined) v[c] = encodeVal_(x);
  });
  t.v = v;
  if (extra.p && extra.p.length) t.p = extra.p;
  if (extra.pc && extra.pc.length) t.pc = extra.pc.slice(-10);
  return JSON.stringify(t);
}

function parseSnapshot_(v) {
  var s = str_(v);
  if (!s || s.charAt(0) !== '{') return null;
  try {
    var o = JSON.parse(s);
    return {
      o: str_(o.o), s: str_(o.s), ss: str_(o.ss), st: str_(o.st), n: str_(o.n),
      v: o.v && typeof o.v === 'object' ? o.v : null, p: Array.isArray(o.p) ? o.p : [], pc: Array.isArray(o.pc) ? o.pc : []
    };
  } catch (e) { return null; }
}

/** Last accepted value of a column ('' if none). Only meaningful for full (v2) snapshots. */
function snapValue_(snap, col) {
  if (!snap || !snap.v) return '';
  return decodeVal_(snap.v[col]);
}

function trackedKeyForCol_(col) {
  switch (col) {
    case LC.OWNER: return 'o';
    case LC.STAGE: return 's';
    case LC.SUBSTAGE: return 'ss';
    case LC.STATUS: return 'st';
    case LC.NEXT_FU: return 'n';
    default: return '';
  }
}

/* ================================================================== */
/* Column groups: editable / admin-only / automatic                    */
/* ================================================================== */

function isSystemCol_(c) { return LEAD_SYSTEM_COLS.indexOf(c) >= 0 || LEAD_FORMULA_COLS.indexOf(c) >= 0; }
function isCustomCol_(c) { return c >= LC.CUSTOM_FIRST && c <= LC.CUSTOM_LAST; }

/** Header label of a Lead Management column (custom fields use their Field Name). */
function leadLabel_(c) {
  if (isCustomCol_(c)) {
    try {
      var f = readCustomFields_()[c - LC.CUSTOM_FIRST];
      if (f && f.name) return f.name;
    } catch (e) { /* settings not built */ }
  }
  return LEAD_HEADERS[c - 1];
}

/** Names listed in Lists & Settings > Counsellor-Editable Fields (defaults until the list exists). */
function editableFieldNames_() {
  return memo_('editableNames', function () {
    var sh = ss_().getSheetByName(SHEET.SETTINGS);
    if (sh && sh.getMaxColumns() >= LS.EDITABLE && same_(sh.getRange(1, LS.EDITABLE).getValue(), EDITABLE_HEADER)) {
      var last = Math.max(sh.getLastRow(), 2);
      return sh.getRange(2, LS.EDITABLE, last - 1, 1).getValues().map(function (r) { return str_(r[0]); }).filter(String);
    }
    return DEFAULT_EDITABLE_FIELDS.slice();
  });
}

/** Columns counsellors may edit: the Counsellor-Editable Fields list (contact, assignment and system columns never). */
function editableCols_() {
  return memo_('editableCols', function () {
    var names = editableFieldNames_();
    var cols = [];
    var custom = [];
    try { custom = readCustomFields_(); } catch (e) { /* settings not built */ }
    names.forEach(function (n) {
      if (same_(n, ALL_CUSTOM_FIELDS)) {
        custom.forEach(function (f) { if (f.active) cols.push(customCol_(f.slot)); });
        return;
      }
      EDITABLE_CANDIDATE_COLS.forEach(function (c) { if (same_(LEAD_HEADERS[c - 1], n)) cols.push(c); });
      custom.forEach(function (f) { if (f.active && same_(f.name, n)) cols.push(customCol_(f.slot)); });
    });
    return cols.filter(function (c, i) { return cols.indexOf(c) === i; }).sort(function (a, b) { return a - b; });
  });
}

function isEditableCol_(col) { return editableCols_().indexOf(col) >= 0; }

/** Every column counsellors may NOT edit (grey). */
function lockedCols_() {
  return memo_('lockedCols', function () {
    var ed = editableCols_();
    var out = [];
    for (var c = 1; c <= LEAD_COLS; c++) if (ed.indexOf(c) < 0) out.push(c);
    return out;
  });
}

function isLockedCol_(col) { return lockedCols_().indexOf(col) >= 0; }

/** System-column correction window (Admin menu): {until: ms, by: email} or null. */
function correctionWindow_() {
  try {
    var raw = PropertiesService.getDocumentProperties().getProperty(PROP.CORRECTION);
    var o = raw ? JSON.parse(raw) : null;
    return o && o.until > Date.now() ? o : null;
  } catch (e) { return null; }
}

/** Groups sorted column numbers into [[first, last], ...] runs of adjacent columns. */
function colRuns_(cols) {
  var sorted = cols.slice().sort(function (a, b) { return a - b; });
  var runs = [];
  sorted.forEach(function (c) {
    var last = runs[runs.length - 1];
    if (last && c === last[1] + 1) last[1] = c; else runs.push([c, c]);
  });
  return runs;
}

/** Writes the given columns of a lead row back to the sheet, one setValues per run of adjacent columns. */
function writeRowCols_(sheet, rowNum, row, cols) {
  colRuns_(cols.filter(function (c) { return LEAD_FORMULA_COLS.indexOf(c) < 0; })).forEach(function (run) {
    sheet.getRange(rowNum, run[0], 1, run[1] - run[0] + 1).setValues([row.slice(run[0] - 1, run[1])]);
  });
}

/* ================================================================== */
/* Cached stage -> substage map (used by the fast onEdit path)          */
/* ================================================================== */

/** {lowerStage: {name, subs:[...]}} of ACTIVE stages; cached for 6 h, cleared when Stage Master changes. */
function cachedSubstageMap_() {
  var cache = CacheService.getDocumentCache();
  var raw = cache.get(PROP.SUBSTAGE_MAP);
  if (raw) { try { return JSON.parse(raw); } catch (e) { /* rebuild */ } }
  var map = {};
  getStageInfo_().activeStages.forEach(function (s) { map[s.name.toLowerCase()] = { name: s.name, subs: s.subs }; });
  try { cache.put(PROP.SUBSTAGE_MAP, JSON.stringify(map), 21600); } catch (e) { /* too large: uncached */ }
  return map;
}

function clearSubstageMapCache_() {
  try { CacheService.getDocumentCache().remove(PROP.SUBSTAGE_MAP); } catch (e) { /* ignore */ }
}
