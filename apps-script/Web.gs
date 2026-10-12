/**
 * Web.gs
 * Counsellor web app ("portal"). Deploy as: Execute as = Me (the CRM owner), Who has access =
 * Anyone with a Google account. Sign-in goes through the separate identity app (/identity-app).
 * See docs/CONFIDENTIALITY.md and docs/SETUP.md.
 *
 * - Every request re-checks the signed-in user against the access rule: an ACTIVE counsellor in
 *   Counsellor Master or an email in Admin Emails. Nothing else (any email provider is fine).
 * - A counsellor only ever receives leads assigned to them; every check runs on the server.
 * - Only fields that are not in "Counsellor-Locked Fields" can be changed.
 * - Every list view, lead view, edit, follow-up, denied attempt and reported browser copy is
 *   written to the Access Log sheet with user and timestamp.
 * Because the app runs as the owner, the master spreadsheet can be shared with admins only.
 */

var ACCESS = {
  PORTAL_OPENED: 'Portal Opened', LIST_VIEWED: 'Leads Listed', LEAD_VIEWED: 'Lead Viewed',
  LEAD_UPDATED: 'Lead Updated', FOLLOW_UP: 'Follow-Up Logged', DENIED: 'Access Denied',
  SHEET_OPENED: 'Spreadsheet Opened', CLIENT_COPY: 'Copy In Browser (reported)'
};

/* ================================================================== */
/* Entry point and sign-in                                             */
/* ================================================================== */
/*
 * Who is the visitor?  This app executes as the owner (a personal Google account) and is open to
 * "Anyone with a Google account", so Google does NOT tell it the visitor's email
 * (Session.getActiveUser() is blank for everybody except the owner). Identity therefore comes from a
 * second, tiny "sign-in" web app (folder /identity-app) that runs AS THE VISITOR with only the
 * "see your email address" permission. It reads the visitor's verified email from Google and sends
 * them here with a short-lived token signed with a shared secret (HMAC-SHA256). This app verifies
 * the signature, expiry (5 min) and single use, then opens a 6-hour session whose random ID lives
 * only in the page and is sent with every request.
 */

var SESSION_TTL = 21600;   // seconds (CacheService maximum)

function doGet(e) {
  var params = (e && e.parameter) || {};
  var lead = str_(params.lead).substring(0, 40);
  var email = '';
  var how = '';
  if (params.t) {
    email = verifyIdentityToken_(String(params.t));
    how = 'sign-in token';
    if (!email) return simplePage_('Sign-in link expired', 'This sign-in link is invalid, expired or was already used. ' + signInLinkHtml_(lead));
  } else {
    try { email = Session.getActiveUser().getEmail() || ''; } catch (err) { /* blank for visitors */ }
    how = 'Google session';
  }
  if (!email) {
    if (!getIdentityUrl_()) return simplePage_('Lead CRM', 'Sign-in is not configured yet. Ask a CRM administrator to deploy the sign-in app (docs/SETUP.md).');
    return simplePage_('Lead CRM', 'Please sign in to continue. ' + signInLinkHtml_(lead));
  }
  var user = accessFor_(email);
  if (!user) {
    logAccess_(email, ACCESS.DENIED, lead, 'Not an active counsellor or admin (' + how + ')', 'Web app');
    return simplePage_('Access denied', 'The Google account <b>' + escHtml_(email) + '</b> is not an active counsellor or administrator in this CRM. ' +
      'Ask a CRM administrator to add exactly this email to Counsellor Master, or sign in with a different Google account. ' + signInLinkHtml_(lead));
  }
  var sid = createPortalSession_(user.email);
  logAccess_(user.email, ACCESS.PORTAL_OPENED, lead, 'Signed in via ' + how, 'Web app');
  var t = HtmlService.createTemplateFromFile('Portal');
  // Injected into a <script> block: escape "<" so a crafted ?lead= value cannot close the tag.
  t.boot = JSON.stringify({ lead: lead, sid: sid, signIn: signInUrl_('') }).replace(/</g, '\\u003c');
  return t.evaluate()
    .setTitle('Lead CRM - My Leads')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function escHtml_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function simplePage_(title, html) {
  return HtmlService.createHtmlOutput(
    '<div style="font-family:Roboto,Arial;max-width:560px;margin:40px auto;padding:0 16px;line-height:1.55">' +
    '<h2 style="color:#1F3864">' + escHtml_(title) + '</h2><p>' + html + '</p></div>')
    .setTitle('Lead CRM').addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** The /exec URL of the main (counsellor) web app ('' if not deployed). */
function getWebAppUrl_() {
  var u = '';
  try { u = ScriptApp.getService().getUrl() || ''; } catch (e) { /* not deployed */ }
  if (!u) u = PropertiesService.getScriptProperties().getProperty(PROP.WEB_APP_URL) || '';
  return u;
}

function getIdentityUrl_() {
  return PropertiesService.getScriptProperties().getProperty(PROP.IDENTITY_URL) || '';
}

/** Link counsellors use: the sign-in app, which then sends them to the main app. */
function signInUrl_(lead) {
  var u = getIdentityUrl_();
  if (!u) return '';
  return u + (lead ? (u.indexOf('?') < 0 ? '?' : '&') + 'lead=' + encodeURIComponent(lead) : '');
}

function signInLinkHtml_(lead) {
  var u = signInUrl_(lead);
  return u ? '<br><br><a href="' + escHtml_(u) + '" target="_top" style="font-weight:bold">Sign in with Google</a>' : '';
}

/** Admin > Web app sign-in setup: creates the shared secret and stores both URLs. */
function setupWebAppSignIn() {
  requireAdmin_();
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty(PROP.IDENTITY_SECRET);
  if (!secret) {
    secret = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    props.setProperty(PROP.IDENTITY_SECRET, secret);
  }
  var main = getWebAppUrl_();
  var r = ui.prompt(CRM_TITLE,
    'STEP A - in the separate sign-in project (identity-app), open Project Settings > Script properties and add:\n\n' +
    '  IDENTITY_SECRET = ' + secret + '\n' +
    '  MAIN_APP_URL = ' + (main || '(deploy this project as a web app first, then run this again)') + '\n\n' +
    'STEP B - deploy the sign-in project (Execute as: User accessing the web app; Who has access: Anyone with a Google account) ' +
    'and paste its /exec URL below.\n\nCurrent sign-in URL: ' + (getIdentityUrl_() || 'not set'), ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var url = str_(r.getResponseText());
  if (!url) return;
  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) { ui.alert(CRM_TITLE, 'That does not look like a web app /exec URL.', ui.ButtonSet.OK); return; }
  props.setProperty(PROP.IDENTITY_URL, url);
  toast_('Sign-in app URL saved. Counsellor link: ' + url);
}

/** Admin > Set counsellor web app URL (only needed if the URL cannot be detected automatically). */
function setWebAppUrl() {
  requireAdmin_();
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt(CRM_TITLE, 'Paste the main web app URL (ends with /exec):\n\nCurrent: ' + (getWebAppUrl_() || 'not set'), ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var url = str_(r.getResponseText());
  if (url && !/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) { ui.alert(CRM_TITLE, 'That does not look like a web app /exec URL.', ui.ButtonSet.OK); return; }
  PropertiesService.getScriptProperties().setProperty(PROP.WEB_APP_URL, url);
  toast_('Web app URL saved.');
}

/* ---------- Token verification and sessions ---------- */

function bytesToString_(bytes) { return Utilities.newBlob(bytes).getDataAsString(); }

/** Constant-time string comparison. */
function safeEqual_(a, b) {
  if (a.length !== b.length) return false;
  var x = 0;
  for (var i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

/**
 * Token = base64url(email|expiresMs|nonce) + '.' + base64url(HMAC_SHA256(payload, secret)).
 * Returns the email when the signature is valid, the token is unexpired and not used before; else ''.
 */
function verifyIdentityToken_(token) {
  try {
    var secret = PropertiesService.getScriptProperties().getProperty(PROP.IDENTITY_SECRET);
    if (!secret || token.length > 2000) return '';
    var parts = token.split('.');
    if (parts.length !== 2) return '';
    var payload = bytesToString_(Utilities.base64DecodeWebSafe(parts[0]));
    var expected = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, secret));
    if (!safeEqual_(expected, parts[1])) return '';
    var f = payload.split('|');
    if (f.length !== 3 || !/@/.test(f[0])) return '';
    if (!(Number(f[1]) > Date.now())) return '';
    var cache = CacheService.getScriptCache();
    if (cache.get('NONCE_' + f[2])) return '';          // single use
    cache.put('NONCE_' + f[2], '1', 900);
    return f[0];
  } catch (e) {
    return '';
  }
}

function createPortalSession_(email) {
  var sid = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').toLowerCase();
  CacheService.getScriptCache().put('PS_' + sid, email, SESSION_TTL);
  return sid;
}

function sessionEmail_(sid) {
  sid = str_(sid);
  if (!/^[a-f0-9]{64}$/.test(sid)) return '';
  var cache = CacheService.getScriptCache();
  var email = cache.get('PS_' + sid) || '';
  if (email) cache.put('PS_' + sid, email, SESSION_TTL);   // sliding expiry
  return email;
}

/* ================================================================== */
/* Identity and access log                                             */
/* ================================================================== */

/**
 * The ONLY access rule: an Active counsellor in Counsellor Master, or an email in Lists & Settings >
 * Admin Emails. Any Google account / email provider is fine. Returns the user or null.
 */
function accessFor_(email) {
  if (!email) return null;
  clearMemo_('counsellors');
  clearMemo_('settings');
  clearMemo_('settingsMap');
  var c = counsellorForEmail_(email);
  var activeC = c && c.active ? c : null;
  var admin = isListedAdmin_(email);
  if (!activeC && !admin) return null;
  var name = activeC ? activeC.name : '';
  return { email: email.toLowerCase(), name: name, admin: admin, label: name || email };
}

/** Signed-in web app user for an API call, or throws (and logs). sid = session ID from the page. */
function portalUser_(sid) {
  var email = sessionEmail_(sid);
  if (!email) throw new Error('SESSION_EXPIRED');
  var u = accessFor_(email);
  if (!u) {
    logAccess_(email, ACCESS.DENIED, '', 'No longer an active counsellor or admin', 'Web app');
    throw new Error('ACCESS_DENIED');
  }
  return u;
}

/** Appends one row to the Access Log (never throws). */
function logAccess_(email, action, leadId, details, source) {
  try {
    var sh = ss_().getSheetByName(SHEET.ACCESS_LOG);
    if (!sh) return;
    var c = counsellorForEmail_(email);
    sh.appendRow([new Date(), email || '(unknown)', c ? c.name : '', action, leadId || '',
      safeText_(String(details || '').substring(0, 45000)), source || 'Web app']);
  } catch (e) {
    console.warn('logAccess_: ' + e);
  }
}

/* ================================================================== */
/* Field metadata                                                      */
/* ================================================================== */

var PORTAL_LIST_FIELDS = { OWNER: 1, STAGE: 1, SUBSTAGE: 1, PRIORITY: 1, OUTCOME: 1, SOURCE: 1, STATUS: 1 };
var PORTAL_DATE_FIELDS = { LAST_CONTACT: 1, NEXT_FU: 1, CREATED: 1 };

function lcKeyForCol_(col) {
  for (var k in LC) if (LC[k] === col && k !== 'CUSTOM_FIRST' && k !== 'CUSTOM_LAST') return k;
  return col >= LC.CUSTOM_FIRST && col <= LC.CUSTOM_LAST ? 'CUSTOM_' + (col - LC.CUSTOM_FIRST + 1) : '';
}

/** Fields shown in the web app: [{key, col, label, type, editable}]. Inactive custom fields are omitted. */
function portalFieldMeta_() {
  var custom = {};
  readCustomFields_().forEach(function (f) { custom[customCol_(f.slot)] = f; });
  var hidden = [LC.SNAPSHOT, LC.PREV_OWNER, LC.STAGE_CHANGED, LC.ASSIGNED_DATE, LC.ACTIVITY_TOTAL, LC.LAST_FU_DATE];
  var out = [];
  for (var c = 1; c <= LEAD_COLS; c++) {
    if (hidden.indexOf(c) >= 0) continue;
    var cf = custom[c];
    if (cf && !cf.active) continue;
    var key = lcKeyForCol_(c);
    var system = LEAD_SYSTEM_COLS.indexOf(c) >= 0 || LEAD_FORMULA_COLS.indexOf(c) >= 0;
    out.push({
      key: key, col: c,
      label: cf ? (cf.name || defaultCustomName_(cf.slot)) : LEAD_HEADERS[c - 1],
      type: PORTAL_LIST_FIELDS[key] ? 'list' : PORTAL_DATE_FIELDS[key] ? 'date' : key === 'REMARKS' ? 'textarea' : 'text',
      editable: !system && !isLockedCol_(c)
    });
  }
  return out;
}

function portalValue_(v, type) {
  if (isDate_(v)) return type === 'date' ? toDateKey_(v) : displayDateTime_(v);
  return v === null || v === undefined ? '' : (typeof v === 'number' ? v : String(v));
}

/* ================================================================== */
/* API called from Portal.html                                         */
/* ================================================================== */

function portalInit(sid) {
  var u = portalUser_(sid);
  var lists = getLists_();
  var settings = getSettings_();
  return {
    user: u,
    fields: portalFieldMeta_(),
    stages: getStageInfo_().activeStages.map(function (s) { return { name: s.name, subs: s.subs }; }),
    statuses: lists.statuses, priorities: lists.priorities, outcomes: lists.outcomes, sources: lists.sources,
    counsellors: activeCounsellorNames_(),
    activityTypes: lists.activityTypes.filter(function (a) { return a.sidebar; }),
    closedStatuses: CLOSED_STATUSES,
    rules: { requireRemarks: settings.requireRemarks, requireNextFu: settings.requireNextFu, maxBackdateDays: settings.maxBackdateDays },
    today: todayKey_(), maxNextFu: addDaysKey_(todayKey_(), 365)
  };
}

/** Leads visible to the user. filter: 'due' | 'open' | 'all'; search: text in ID / name / mobile. */
function portalListLeads(sid, filter, search) {
  var u = portalUser_(sid);
  var sheet = getSheet_(SHEET.LEADS);
  var last = lastLeadRow_(sheet);
  var data = last >= 2 ? sheet.getRange(2, 1, last - 1, LEAD_COLS).getValues() : [];
  var tomorrow = dateFromKey_(addDaysKey_(todayKey_(), 1)).getTime();
  var today = todayDate_().getTime();
  var q = str_(search).toLowerCase();
  var mine = data.filter(function (r) {
    return str_(r[LC.ID - 1]) && (u.admin || same_(r[LC.OWNER - 1], u.name));
  });
  var isOpen = function (r) { return !isClosedStatus_(r[LC.STATUS - 1]); };
  var next = function (r) { return isDate_(r[LC.NEXT_FU - 1]) ? r[LC.NEXT_FU - 1].getTime() : NaN; };
  var stats = { total: mine.length, open: 0, due: 0, overdue: 0 };
  mine.forEach(function (r) {
    if (!isOpen(r)) return;
    stats.open++;
    if (next(r) < tomorrow) stats.due++;
    if (next(r) < today) stats.overdue++;
  });
  var rows = mine.filter(function (r) {
    if (filter === 'due' && !(isOpen(r) && next(r) < tomorrow)) return false;
    if (filter === 'open' && !isOpen(r)) return false;
    if (q) {
      var hay = [r[LC.ID - 1], r[LC.NAME - 1], r[LC.MOBILE - 1]].join(' ').toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  });
  rows.sort(function (a, b) {
    var na = next(a), nb = next(b);
    if (isNaN(na)) na = Infinity;
    if (isNaN(nb)) nb = Infinity;
    return na - nb;
  });
  var shown = rows.slice(0, 300);
  logAccess_(u.email, ACCESS.LIST_VIEWED, '', 'filter=' + (filter || 'all') + (q ? '; search=' + q : '') + '; shown ' + shown.length +
    ' of ' + rows.length + ': ' + shown.map(function (r) { return r[LC.ID - 1]; }).join(', '), 'Web app');
  return {
    stats: stats, total: rows.length,
    leads: shown.map(function (r) {
      var n = next(r);
      return {
        id: str_(r[LC.ID - 1]), name: str_(r[LC.NAME - 1]), mobile: str_(r[LC.MOBILE - 1]), owner: str_(r[LC.OWNER - 1]),
        stage: str_(r[LC.STAGE - 1]), substage: str_(r[LC.SUBSTAGE - 1]), status: str_(r[LC.STATUS - 1]),
        priority: str_(r[LC.PRIORITY - 1]), next: toDateKey_(r[LC.NEXT_FU - 1]),
        due: isOpen(r) && n < tomorrow, overdue: isOpen(r) && n < today
      };
    })
  };
}

/** One lead with its allowed fields and recent history (ownership checked). */
function portalGetLead(sid, leadId) {
  var u = portalUser_(sid);
  var sheet = getSheet_(SHEET.LEADS);
  var rowNum = findLeadRow_(sheet, leadId);
  if (!rowNum) throw new Error('Lead ' + leadId + ' was not found.');
  var row = sheet.getRange(rowNum, 1, 1, LEAD_COLS).getValues()[0];
  if (!u.admin && !same_(row[LC.OWNER - 1], u.name)) {
    logAccess_(u.email, ACCESS.DENIED, leadId, 'Tried to open a lead assigned to someone else', 'Web app');
    throw new Error('Lead ' + leadId + ' is not assigned to you.');
  }
  logAccess_(u.email, ACCESS.LEAD_VIEWED, leadId, '', 'Web app');
  return portalLeadPayload_(row);
}

function portalLeadPayload_(row) {
  var values = {};
  portalFieldMeta_().forEach(function (f) { values[f.key] = portalValue_(row[f.col - 1], f.type); });
  return { id: str_(row[LC.ID - 1]), values: values, recent: recentActivities_(str_(row[LC.ID - 1]), 10) };
}

/**
 * Saves edits to allowed fields. changes: {fieldKey: value}. Locked/system fields are rejected on the
 * server even if the browser sends them.
 */
function portalSaveLead(sid, leadId, changes) {
  var u = portalUser_(sid);
  var actor = { email: u.email, name: u.name, label: u.label };
  var meta = {};
  portalFieldMeta_().forEach(function (f) { meta[f.key] = f; });
  var settings = getSettings_();
  var stageInfo = getStageInfo_();
  var lists = getLists_();
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(20000)) return { ok: false, errors: ['Another update is being saved. Please try again.'] };
  try {
    var sheet = getSheet_(SHEET.LEADS);
    var rowNum = findLeadRow_(sheet, leadId);
    if (!rowNum) return { ok: false, errors: ['Lead ' + leadId + ' was not found.'] };
    var row = sheet.getRange(rowNum, 1, 1, LEAD_COLS).getValues()[0];
    if (!u.admin && !same_(row[LC.OWNER - 1], u.name)) {
      logAccess_(u.email, ACCESS.DENIED, leadId, 'Tried to edit a lead assigned to someone else', 'Web app');
      return { ok: false, errors: ['Lead ' + leadId + ' is not assigned to you.'] };
    }
    var before = parseSnapshot_(row[LC.SNAPSHOT - 1]) || readTracked_(row);
    var errors = [], cols = [], diffs = [];
    var keys = Object.keys(changes || {});
    // Apply the stage before the substage so the substage is validated against the new stage.
    keys.sort(function (a, b) { return (a === 'STAGE' ? -1 : 0) - (b === 'STAGE' ? -1 : 0); });
    keys.forEach(function (key) {
      var f = meta[key];
      if (!f || !f.editable) { errors.push('"' + (f ? f.label : key) + '" cannot be changed here.'); return; }
      var v = str_(changes[key]);
      var old = row[f.col - 1];
      if (f.type === 'date') {
        if (v && !dateFromKey_(v)) { errors.push(f.label + ': invalid date.'); return; }
        if (key === 'LAST_CONTACT' && v > todayKey_()) { errors.push(f.label + ' cannot be in the future.'); return; }
        if (toDateKey_(old) === v) return;
        row[f.col - 1] = v ? dateFromKey_(v) : '';
      } else {
        if (key === 'STAGE' && v && !stageInfo.isActiveStage(v)) { errors.push('Stage "' + v + '" is not active.'); return; }
        if (key === 'OWNER' && v && !isActiveCounsellor_(v)) { errors.push('"' + v + '" is not an active counsellor.'); return; }
        var listFor = { PRIORITY: lists.priorities, OUTCOME: lists.outcomes, STATUS: lists.statuses }[key];
        if (listFor && v && !listFor.some(function (x) { return same_(x, v); })) { errors.push(f.label + ': "' + v + '" is not a valid choice.'); return; }
        if (v.length > 2000) { errors.push(f.label + ' is too long.'); return; }
        if (same_(old, v) && str_(old) === v) return;
        row[f.col - 1] = key === 'STAGE' ? stageInfo.canonicalStage(v) || v : safeText_(v);
      }
      cols.push(f.col);
      diffs.push(f.label + ': "' + displayValue_(old) + '" -> "' + v + '"');
    });
    var stageChanged = !same_(row[LC.STAGE - 1], before.s);
    if (stageChanged && keys.indexOf('SUBSTAGE') < 0) { row[LC.SUBSTAGE - 1] = ''; cols.push(LC.SUBSTAGE); }
    var sub = str_(row[LC.SUBSTAGE - 1]);
    if (sub && !stageInfo.isActivePair(row[LC.STAGE - 1], sub)) errors.push('Substage "' + sub + '" does not belong to stage "' + str_(row[LC.STAGE - 1]) + '".');
    if (sub) row[LC.SUBSTAGE - 1] = stageInfo.canonicalSub(row[LC.STAGE - 1], sub);
    if (errors.length) return { ok: false, errors: errors };
    if (!cols.length) return { ok: true, unchanged: true, lead: portalLeadPayload_(row) };

    var now = new Date();
    row[LC.UPDATED_BY - 1] = actor.label;
    row[LC.LAST_ACTIVITY - 1] = now;
    var res = trackLeadChanges_(row, before, {
      actor: actor, now: now, stageInfo: stageInfo, settings: settings,
      statusExplicit: keys.indexOf('STATUS') >= 0, logNextFu: true, note: 'Via counsellor web app'
    });
    row[LC.DQ_FLAGS - 1] = computeDqFlags_(row, buildDqEnv_(sheet));
    writeRowCols_(sheet, rowNum, row, cols.concat(res.cols, [LC.UPDATED_BY, LC.LAST_ACTIVITY, LC.DQ_FLAGS, LC.SNAPSHOT]));
    if (stageChanged || res.stageChanged) {
      sheet.getRange(rowNum, LC.SUBSTAGE).setDataValidation(substageRuleFor_(row[LC.STAGE - 1], stageInfo, {}));
    }
    if (res.entries.length) appendLogRows_(res.entries);
    logAccess_(u.email, ACCESS.LEAD_UPDATED, leadId, diffs.join('; '), 'Web app');
    return { ok: true, lead: portalLeadPayload_(row), messages: res.messages };
  } finally {
    lock.releaseLock();
  }
}

/** Logs a follow-up from the web app (counsellor = the signed-in user; own leads only). */
function portalSubmitFollowUp(sid, p) {
  var u = portalUser_(sid);
  var res = submitFollowUpAs_(p, { email: u.email, name: u.name, label: u.label }, {
    source: 'counsellor web app',
    forceCounsellor: u.name || null,
    ownerOnly: u.admin ? null : u.name
  });
  if (res.ok) logAccess_(u.email, ACCESS.FOLLOW_UP, p && p.leadId, res.activityId, 'Web app');
  else if (res.errors && /not assigned to you/.test(res.errors.join())) logAccess_(u.email, ACCESS.DENIED, p && p.leadId, 'Follow-up on a lead assigned to someone else', 'Web app');
  return res;
}

/** Best-effort report of a copy action in the browser (can be bypassed; see docs/CONFIDENTIALITY.md). */
function portalLogClientEvent(sid, kind, leadId) {
  var u = portalUser_(sid);
  var cache = CacheService.getDocumentCache();
  var key = 'CE_' + Utilities.base64Encode(u.email + '|' + kind + '|' + leadId).substring(0, 200);
  if (cache.get(key)) return false;
  cache.put(key, '1', 30);
  logAccess_(u.email, ACCESS.CLIENT_COPY, str_(leadId).substring(0, 40), str_(kind).substring(0, 60), 'Web app');
  return true;
}
