/**
 * Config.gs
 * Shared constants and helpers used by every other file in the Lead CRM project.
 *
 * Column numbers are 1-based. Do NOT insert, delete or reorder columns A:AI on
 * "Lead Management" or A:R on "Follow-Up Log" — rename headers only
 * (see docs/ADMIN.md). The script addresses columns by position.
 */

var CRM_TITLE = 'Lead CRM';
var CRM_VERSION = '1.0.0';

var SHEET = {
  LEADS: 'Lead Management',
  LOG: 'Follow-Up Log',
  STAGES: 'Stage Master',
  COUNSELLORS: 'Counsellor Master',
  DASHBOARD: 'Dashboard',
  SETTINGS: 'Lists & Settings'
};
var SHEET_ORDER = [SHEET.LEADS, SHEET.LOG, SHEET.STAGES, SHEET.COUNSELLORS, SHEET.DASHBOARD, SHEET.SETTINGS];

var LEAD_DATA_ROWS = 10000;   // pre-sized data rows on Lead Management
var LOG_INITIAL_ROWS = 5000;  // pre-sized rows on Follow-Up Log (grows automatically)
var LOG_GROW_BY = 5000;

/* ---------- Lead Management columns ---------- */
var LC = {
  ID: 1, NAME: 2, MOBILE: 3, EMAIL: 4, OWNER: 5, STAGE: 6, SUBSTAGE: 7, PRIORITY: 8,
  LAST_CONTACT: 9, NEXT_FU: 10, OUTCOME: 11, FU_COUNT: 12, UPDATED_BY: 13, LAST_ACTIVITY: 14,
  REMARKS: 15, SOURCE: 16, CUSTOM_FIRST: 17, CUSTOM_LAST: 26, CREATED: 27, STATUS: 28,
  LAST_FU_DATE: 29, STAGE_CHANGED: 30, ASSIGNED_DATE: 31, PREV_OWNER: 32,
  ACTIVITY_TOTAL: 33, DQ_FLAGS: 34, SNAPSHOT: 35
};
var LEAD_COLS = 35;

var LEAD_HEADERS = (function () {
  var h = ['Lead ID', 'Lead Name', 'Mobile Number', 'Email ID', 'Assigned Counsellor', 'Lead Stage',
    'Lead Substage', 'Lead Priority', 'Last Contact Date', 'Next Follow-Up Date', 'Last Follow-Up Outcome',
    'Follow-Up Count', 'Last Updated By', 'Last Activity Timestamp', 'Lead Remarks', 'Lead Source'];
  for (var i = 1; i <= 10; i++) h.push('Custom Field ' + i);
  return h.concat(['Lead Created Date', 'Lead Status', 'Last Follow-Up Date', 'Last Stage Change Date',
    'Lead Assigned Date', 'Previous Counsellor', 'Total Activities', 'Data Quality Flags',
    'Audit Snapshot (system)']);
})();

/** Columns whose cells are produced by an ARRAYFORMULA in the header row. */
var LEAD_FORMULA_COLS = [LC.FU_COUNT, LC.ACTIVITY_TOTAL, LC.DQ_FLAGS];
/** Columns written only by the script. */
var LEAD_SYSTEM_COLS = [LC.ID, LC.UPDATED_BY, LC.LAST_ACTIVITY, LC.CREATED, LC.LAST_FU_DATE,
  LC.STAGE_CHANGED, LC.ASSIGNED_DATE, LC.PREV_OWNER, LC.SNAPSHOT];

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
  H_PERIODS: 22, H_PAIRS: 23
};

var ACTIVE = 'Active';
var INACTIVE = 'Inactive';
var CATEGORY = { CONTACT: 'Contact', RECORD: 'Record Update', SYSTEM: 'System' };
var STATUS = { OPEN: 'Open', ON_HOLD: 'On Hold', CONVERTED: 'Converted', LOST: 'Lost', DUPLICATE: 'Duplicate' };
var CLOSED_STATUSES = [STATUS.CONVERTED, STATUS.LOST, STATUS.DUPLICATE];

/** Activity types the script itself writes (audit trail). */
var ACT = {
  LEAD_CREATED: 'Lead Created', LEAD_ASSIGNED: 'Lead Assigned', STAGE_UPDATED: 'Stage Updated',
  STATUS_UPDATED: 'Status Updated', FU_SCHEDULED: 'Follow-Up Scheduled',
  SUBSTAGE_CLEARED: 'Substage Cleared', LOG_EDITED: 'Log Edited'
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
  MAX_BACKDATE: 'Max Backdate Days For Activities',
  REMINDERS: 'Email Reminders Enabled',
  REMINDER_HOUR: 'Reminder Hour (0-23)',
  ADMINS: 'Admin Emails'
};

/** Default settings: [key, value, description, allowed values (optional)]. */
var DEFAULT_SETTINGS = [
  [SET.LEAD_PREFIX, 'LD-', 'Text placed before the running number of every new Lead ID.'],
  [SET.LEAD_DIGITS, 6, 'Number of digits in the running number (LD-000001).'],
  [SET.ACT_PREFIX, 'ACT-', 'Text placed before every Activity ID in Follow-Up Log.'],
  [SET.DEFAULT_STATUS, STATUS.OPEN, 'Lead Status given to a new lead when none is entered.'],
  [SET.DEFAULT_STAGE, 'New Lead', 'Lead Stage given to a new lead when none is entered (blank = none).'],
  [SET.DEFAULT_SUBSTAGE, 'Not Contacted', 'Substage given with the default stage (must belong to it).'],
  [SET.CONVERTED_STAGE, 'Converted', 'Moving a lead to this stage sets Lead Status = Converted.'],
  [SET.LOST_STAGE, 'Lost', 'Moving a lead to this stage sets Lead Status = Lost.'],
  [SET.AUTO_SYNC, 'Yes', 'Yes = apply the two rules above automatically.', ['Yes', 'No']],
  [SET.DUP_MOBILE, 'Warn', 'Off = no check; Warn = allow but flag; Block = reject a duplicate mobile.', ['Off', 'Warn', 'Block']],
  [SET.DUP_EMAIL, 'Warn', 'Off = no check; Warn = allow but flag; Block = reject a duplicate email.', ['Off', 'Warn', 'Block']],
  [SET.MOBILE_PATTERN, '^\\+?[0-9]{10,15}$', 'Regular expression a valid mobile number must match (warning only).'],
  [SET.UPCOMING_DAYS, 3, 'Follow-ups due within this many days are highlighted as upcoming.'],
  [SET.REQUIRE_NEXT_FU, 'Yes', 'Yes = the follow-up form requires a next follow-up date while the lead stays open.', ['Yes', 'No']],
  [SET.REQUIRE_REMARKS, 'Yes', 'Yes = the follow-up form requires remarks.', ['Yes', 'No']],
  [SET.MAX_BACKDATE, 7, 'How many days in the past a caller may date an activity in the follow-up form.'],
  [SET.REMINDERS, 'No', 'Daily email reminders. Change only through Lead CRM > Admin > Enable daily email reminders.', ['Yes', 'No']],
  [SET.REMINDER_HOUR, 8, 'Hour of day (spreadsheet time zone) when reminders are sent.'],
  [SET.ADMINS, '', 'Comma-separated emails of CRM administrators (can edit master sheets and run Admin menu).']
];

/** Settings cells exposed as named ranges so formulas, validation and formatting can read them. */
var NAMED = {
  MOBILE_PATTERN: { name: 'SET_MOBILE_PATTERN', key: SET.MOBILE_PATTERN },
  UPCOMING_DAYS: { name: 'SET_UPCOMING_DAYS', key: SET.UPCOMING_DAYS },
  DUP_MOBILE: { name: 'SET_DUP_MOBILE', key: SET.DUP_MOBILE },
  DUP_EMAIL: { name: 'SET_DUP_EMAIL', key: SET.DUP_EMAIL }
};

var PROP = {
  LEAD_SEQ: 'LEAD_SEQ', ACT_SEQ: 'ACT_SEQ', EDIT_MODE: 'EDIT_MODE', USER_KEY_PREFIX: 'UK_',
  DASH_LAYOUT: 'DASH_LAYOUT', LAST_SUBSTAGE_REFRESH: 'LAST_SUBSTAGE_REFRESH'
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
      maxBackdateDays: Math.max(num(m[SET.MAX_BACKDATE], 7), 0),
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
    var sh = getSheet_(SHEET.COUNSELLORS);
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

function counsellorForEmail_(email) {
  if (!email) return null;
  var e = email.toLowerCase();
  return getCounsellors_().filter(function (c) { return c.email === e; })[0] || null;
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
  try { if (e && e.user && e.user.getEmail) email = e.user.getEmail() || ''; } catch (err) { /* not available */ }
  if (!email) { try { email = Session.getActiveUser().getEmail() || ''; } catch (err) { /* not available */ } }
  var installable = !!(e && e.triggerUid);
  if (!email && !installable) {
    // Temporary keys are only trusted when the code runs as the editing user (simple trigger / sidebar).
    try {
      var key = Session.getTemporaryActiveUserKey();
      if (key) email = PropertiesService.getScriptProperties().getProperty(PROP.USER_KEY_PREFIX + key) || '';
    } catch (err) { /* not available */ }
  }
  var c = counsellorForEmail_(email);
  var name = c ? c.name : '';
  return { email: email, name: name, label: name || email || 'Unidentified user' };
}

/**
 * Called from authorised contexts (sidebar, menu). Remembers the user's temporary key so later
 * simple-trigger edits by the same user can be attributed even on consumer (gmail.com) accounts.
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
  return { email: email, name: c ? c.name : '', label: (c && c.name) || email || 'Unidentified user' };
}

function getAdminEmails_() {
  var list = getSettings_().adminEmails.slice();
  try {
    var owner = ss_().getOwner();
    if (owner && owner.getEmail() && list.indexOf(owner.getEmail().toLowerCase()) < 0) list.push(owner.getEmail().toLowerCase());
  } catch (e) { /* shared drive files have no owner */ }
  return list;
}

function isAdmin_(email) {
  if (!email) return false;
  return getAdminEmails_().indexOf(email.toLowerCase()) >= 0;
}

/** Throws (and alerts) if the current user is not a CRM administrator. */
function requireAdmin_() {
  var email = '';
  try { email = Session.getActiveUser().getEmail(); } catch (e) { /* ignore */ }
  if (isAdmin_(email)) return email;
  var msg = 'This action is restricted to CRM administrators (Lists & Settings > "' + SET.ADMINS + '").' +
    (email ? '' : ' Your email address is not visible to the script.');
  alert_(msg);
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

function parseSnapshot_(v) {
  var s = str_(v);
  if (!s || s.charAt(0) !== '{') return null;
  try {
    var o = JSON.parse(s);
    return { o: str_(o.o), s: str_(o.s), ss: str_(o.ss), st: str_(o.st), n: str_(o.n) };
  } catch (e) { return null; }
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
/* Edit trigger mode                                                   */
/* ================================================================== */

function getEditMode_() {
  try {
    return PropertiesService.getDocumentProperties().getProperty(PROP.EDIT_MODE) || 'simple';
  } catch (e) { return 'simple'; }
}
