/**
 * FollowUp.gs
 * Server side of the follow-up sidebar (FollowUpSidebar.html) and optional email reminders.
 *
 * Each submission is appended to Follow-Up Log (never overwriting history), then the latest
 * activity details are written to the lead's row in Lead Management. LockService serialises
 * concurrent submissions and edits; a per-form submission ID plus a short "fingerprint" cache
 * prevent the same activity being recorded twice.
 */

function showFollowUpSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('FollowUpSidebar').setTitle('Log Follow-Up');
  SpreadsheetApp.getUi().showSidebar(html);
}

/** Lead ID of the row selected on Lead Management ('' if none). */
function getSelectedLeadId() {
  var sheet = SpreadsheetApp.getActiveSheet();
  if (!sheet || sheet.getName() !== SHEET.LEADS) return '';
  var cell = sheet.getActiveCell();
  if (!cell || cell.getRow() < 2) return '';
  return str_(sheet.getRange(cell.getRow(), LC.ID).getValue());
}

/** Everything the sidebar needs to render. Also registers the caller's identity mapping. */
function getFollowUpContext() {
  var actor = registerCurrentUser_();
  var webAppUrl = getWebAppUrl_();
  if (strictMode_() && !isAdmin_(actor.email)) {
    // Counsellors: the sidebar embeds the web app, which runs as the owner and can write locked columns.
    var lead = getSelectedLeadId();
    return { useWebApp: true, webAppUrl: webAppUrl ? webAppUrl + '?embed=1' + (lead ? '&lead=' + encodeURIComponent(lead) : '') : '', actor: actor };
  }
  var settings = getSettings_();
  var lists = getLists_();
  var stageInfo = getStageInfo_();
  var now = new Date();
  return {
    actor: actor,
    counsellors: activeCounsellorNames_(),
    activityTypes: lists.activityTypes.filter(function (a) { return a.sidebar; }),
    outcomes: lists.outcomes,
    statuses: lists.statuses,
    priorities: lists.priorities,
    stages: stageInfo.activeStages.map(function (s) { return { name: s.name, subs: s.subs }; }),
    closedStatuses: CLOSED_STATUSES,
    rules: {
      requireRemarks: settings.requireRemarks,
      requireNextFu: settings.requireNextFu,
      maxBackdateDays: settings.maxBackdateDays
    },
    nowLocal: Utilities.formatDate(now, sheetTz_(), "yyyy-MM-dd'T'HH:mm"),
    today: todayKey_(),
    maxNextFu: addDaysKey_(todayKey_(), 365),
    selectedLeadId: getSelectedLeadId()
  };
}

/**
 * Finds a lead by Lead ID, or by mobile number. Returns {found, lead, matches, message}.
 */
function getLeadForSidebar(query) {
  var q = str_(query);
  if (!q) return { found: false, message: 'Enter a Lead ID or mobile number.' };
  var sheet = getSheet_(SHEET.LEADS);
  var row = findLeadRow_(sheet, q);
  if (!row) {
    var last = lastLeadRow_(sheet);
    if (last >= 2) {
      var hits = sheet.getRange(2, LC.MOBILE, last - 1, 1).createTextFinder(q).matchEntireCell(true).findAll();
      if (hits.length === 1) row = hits[0].getRow();
      else if (hits.length > 1) {
        return {
          found: false,
          matches: hits.slice(0, 10).map(function (h) {
            var v = sheet.getRange(h.getRow(), 1, 1, LC.OWNER).getValues()[0];
            return { id: str_(v[LC.ID - 1]), name: str_(v[LC.NAME - 1]), owner: str_(v[LC.OWNER - 1]) };
          }),
          message: hits.length + ' leads share this mobile number - choose one.'
        };
      }
    }
  }
  if (!row) return { found: false, message: 'No lead found for "' + q + '".' };
  return { found: true, lead: leadSummary_(sheet, row) };
}

function leadSummary_(sheet, row) {
  var v = sheet.getRange(row, 1, 1, LEAD_COLS).getValues()[0];
  var id = str_(v[LC.ID - 1]);
  return {
    id: id,
    name: str_(v[LC.NAME - 1]),
    mobile: str_(v[LC.MOBILE - 1]),
    email: str_(v[LC.EMAIL - 1]),
    owner: str_(v[LC.OWNER - 1]),
    stage: str_(v[LC.STAGE - 1]),
    substage: str_(v[LC.SUBSTAGE - 1]),
    priority: str_(v[LC.PRIORITY - 1]),
    status: str_(v[LC.STATUS - 1]),
    nextFollowUp: toDateKey_(v[LC.NEXT_FU - 1]),
    lastOutcome: str_(v[LC.OUTCOME - 1]),
    followUpCount: v[LC.FU_COUNT - 1] === '' ? 0 : v[LC.FU_COUNT - 1],
    lastUpdatedBy: str_(v[LC.UPDATED_BY - 1]),
    lastActivity: displayDateTime_(v[LC.LAST_ACTIVITY - 1]),
    remarks: str_(v[LC.REMARKS - 1]),
    recent: recentActivities_(id, 5)
  };
}

/** Latest `limit` log entries for a lead (newest first). */
function recentActivities_(leadId, limit) {
  if (!leadId) return [];
  var log = getSheet_(SHEET.LOG);
  var last = log.getLastRow();
  if (last < 2) return [];
  var hits = log.getRange(2, LG.LEAD_ID, last - 1, 1).createTextFinder(leadId).matchEntireCell(true).findAll();
  return hits.slice(-limit).reverse().map(function (h) {
    var v = log.getRange(h.getRow(), 1, 1, LOG_COLS).getValues()[0];
    return {
      id: str_(v[LG.ACT_ID - 1]),
      time: displayDateTime_(v[LG.TIME - 1]),
      type: str_(v[LG.TYPE - 1]),
      category: str_(v[LG.CATEGORY - 1]),
      outcome: str_(v[LG.OUTCOME - 1]),
      counsellor: str_(v[LG.COUNSELLOR - 1]),
      remarks: str_(v[LG.REMARKS - 1]) || (str_(v[LG.FIELD - 1]) ? v[LG.FIELD - 1] + ': ' + displayValue_(v[LG.OLD - 1]) + ' -> ' + displayValue_(v[LG.NEW - 1]) : '')
    };
  });
}

/**
 * Records one follow-up.
 * p: {submissionId, leadId, counsellor, activityType, outcome, activityTime ('yyyy-MM-ddTHH:mm', optional),
 *     stage, substage, status, priority, nextFollowUp ('yyyy-MM-dd' or ''), remarks}
 * Returns {ok, activityId, lead} or {ok:false, errors:[...], duplicate?}.
 */
function submitFollowUp(p) {
  var actor = registerCurrentUser_();
  // Under strict protection a counsellor's own session cannot write locked/system columns. Counsellors
  // log follow-ups through the web app (which runs as the owner); the sidebar embeds it for them.
  if (strictMode_() && !isAdmin_(actor.email)) {
    return { ok: false, errors: ['Counsellors log follow-ups in the counsellor web app (Lead CRM > Log Follow-Up opens it). Ask an admin to deploy it if it does not open.'] };
  }
  return submitFollowUpAs_(p, actor, { source: 'Sheet sidebar' });
}

/**
 * Records one follow-up as the given actor. Used by the sheet sidebar (admins) and the web app
 * (runs as the owner; actor = the signed-in counsellor). opts: {source, forceCounsellor, ownerOnly}
 */
function submitFollowUpAs_(p, actor, opts) {
  p = p || {};
  opts = opts || {};
  if (opts.forceCounsellor) p.counsellor = opts.forceCounsellor;
  var settings = getSettings_();
  var lists = getLists_();
  var stageInfo = getStageInfo_();
  var errors = [];
  var now = new Date();

  // ---- validation that does not need the lock ----
  var leadId = str_(p.leadId);
  var counsellor = str_(p.counsellor);
  var type = str_(p.activityType);
  var outcome = str_(p.outcome);
  var remarks = str_(p.remarks);
  if (!leadId) errors.push('Lead ID is required.');
  if (!counsellor) errors.push('Counsellor is required.');
  else if (!getCounsellors_().some(function (c) { return same_(c.name, counsellor); })) errors.push('Counsellor "' + counsellor + '" is not in Counsellor Master.');
  var typeDef = lists.activityTypes.filter(function (a) { return same_(a.type, type) && a.sidebar; })[0];
  if (!typeDef) errors.push('Choose a valid Activity Type.');
  if (!outcome) errors.push('Contact Outcome is required.');
  else if (!lists.outcomes.some(function (o) { return same_(o, outcome); })) errors.push('Choose a valid Contact Outcome.');
  if (settings.requireRemarks && !remarks) errors.push('Remarks are required.');
  if (remarks.length > 2000) errors.push('Remarks must be 2,000 characters or fewer.');

  var activityTime = now;
  if (str_(p.activityTime)) {
    activityTime = dateTimeFromLocal_(p.activityTime);
    if (!activityTime) errors.push('Activity date/time is not valid.');
    else if (activityTime.getTime() > now.getTime() + 5 * 60000) errors.push('Activity date/time cannot be in the future.');
    else if (toDateKey_(activityTime) < addDaysKey_(todayKey_(), -settings.maxBackdateDays)) {
      errors.push('Activity date cannot be more than ' + settings.maxBackdateDays + ' days in the past.');
    }
  }
  var activityKey = activityTime ? toDateKey_(activityTime) : todayKey_();

  var nextKey = str_(p.nextFollowUp);
  if (nextKey) {
    if (!dateFromKey_(nextKey)) errors.push('Next follow-up date is not valid.');
    else if (nextKey < activityKey) errors.push('Next follow-up date cannot be before the activity date.');
    else if (nextKey > addDaysKey_(todayKey_(), 365)) errors.push('Next follow-up date must be within one year.');
  }
  if (p.status && !lists.statuses.some(function (s) { return same_(s, p.status); })) errors.push('Choose a valid Lead Status.');
  if (p.priority && !lists.priorities.some(function (s) { return same_(s, p.priority); })) errors.push('Choose a valid Lead Priority.');
  if (errors.length) return { ok: false, errors: errors };

  var cache = CacheService.getDocumentCache();
  var fingerprint = 'FP_' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5,
    [leadId, type, outcome, remarks, nextKey, actor.email || counsellor].join('|').toLowerCase(), Utilities.Charset.UTF_8));

  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(20000)) return { ok: false, errors: ['Another update is being saved. Please press Save again in a few seconds.'] };
  try {
    // ---- duplicate submission protection ----
    var subId = str_(p.submissionId);
    if (subId && (cache.get('SUB_' + subId) || submissionLogged_(subId))) {
      return { ok: false, duplicate: true, errors: ['This follow-up was already saved (duplicate submission blocked).'] };
    }
    if (cache.get(fingerprint)) {
      return { ok: false, duplicate: true, errors: ['An identical follow-up for this lead was saved less than 2 minutes ago. If this is a new activity, change the remarks and save again.'] };
    }

    var sheet = getSheet_(SHEET.LEADS);
    var rowNum = findLeadRow_(sheet, leadId);           // re-located inside the lock: rows may have been sorted
    if (!rowNum) return { ok: false, errors: ['Lead ' + leadId + ' was not found (was it deleted?).'] };
    var row = sheet.getRange(rowNum, 1, 1, LEAD_COLS).getValues()[0];
    if (opts.ownerOnly && !same_(row[LC.OWNER - 1], opts.ownerOnly)) {
      return { ok: false, errors: ['Lead ' + leadId + ' is not assigned to you.'] };
    }
    var before = parseSnapshot_(row[LC.SNAPSHOT - 1]) || readTracked_(row);

    // ---- stage / substage / status / priority changes made in the form ----
    var stage = str_(p.stage) || str_(row[LC.STAGE - 1]);
    var substage = str_(p.substage);
    var stageChanged = !same_(stage, row[LC.STAGE - 1]);
    var subChanged = !same_(substage, row[LC.SUBSTAGE - 1]);
    if (stageChanged && !stageInfo.isActiveStage(stage)) errors.push('Stage "' + stage + '" is not active.');
    if (stageChanged || subChanged) {
      var subs = stageInfo.activeSubs(stage);
      if (subs.length && !substage) errors.push('Choose a substage for "' + stage + '".');
      else if (substage && !stageInfo.isActivePair(stage, substage)) errors.push('Substage "' + substage + '" does not belong to stage "' + stage + '".');
    }
    var status = str_(p.status) || str_(row[LC.STATUS - 1]);
    var statusExplicit = !same_(status, row[LC.STATUS - 1]);
    var implied = statusExplicit || !stageChanged ? '' : statusForStage_(stage, status, settings);
    var finalStatus = implied || status;
    var closed = isClosedStatus_(finalStatus);
    if (!closed && settings.requireNextFu && !nextKey) errors.push('Next follow-up date is required while the lead is open.');
    if (errors.length) return { ok: false, errors: errors };

    if (stageChanged) row[LC.STAGE - 1] = stageInfo.canonicalStage(stage);
    if (stageChanged || subChanged) row[LC.SUBSTAGE - 1] = substage ? stageInfo.canonicalSub(stage, substage) : '';
    row[LC.STATUS - 1] = status;
    if (p.priority) row[LC.PRIORITY - 1] = p.priority;

    // ---- latest activity on the lead row ----
    var activityDate = dateFromKey_(activityKey);
    if (typeDef.category === CATEGORY.CONTACT) {
      var lastContact = toDateKey_(row[LC.LAST_CONTACT - 1]);
      if (!lastContact || activityKey >= lastContact) row[LC.LAST_CONTACT - 1] = activityDate;
    }
    if (nextKey) row[LC.NEXT_FU - 1] = dateFromKey_(nextKey);
    else if (closed) row[LC.NEXT_FU - 1] = '';
    row[LC.OUTCOME - 1] = outcome;
    row[LC.REMARKS - 1] = safeText_(remarks);
    row[LC.UPDATED_BY - 1] = actor.label !== 'Unidentified user' ? actor.label : counsellor + ' (selected)';
    row[LC.LAST_ACTIVITY - 1] = now;
    var lastFu = toDateKey_(row[LC.LAST_FU_DATE - 1]);
    if (!lastFu || activityKey >= lastFu) row[LC.LAST_FU_DATE - 1] = activityDate;

    var res = trackLeadChanges_(row, before, {
      actor: { email: actor.email, name: actor.name, label: actor.name || counsellor },
      now: now, stageInfo: stageInfo, settings: settings, statusExplicit: statusExplicit,
      logNextFu: false, note: 'Via ' + (opts.source || 'follow-up form')
    });
    row[LC.DQ_FLAGS - 1] = computeDqFlags_(row, buildDqEnv_(sheet));

    var main = buildLogEntry_({
      row: row, time: activityTime, type: typeDef.type, category: typeDef.category, counsellor: counsellor,
      updatedBy: actor.email || ('Unidentified (selected ' + counsellor + ')'), outcome: outcome,
      nextFu: nextKey ? dateFromKey_(nextKey) : '', remarks: remarks, submissionId: subId
    });

    writeLeadRowCells_(sheet, rowNum, row);
    if (stageChanged || subChanged || res.stageChanged) {
      sheet.getRange(rowNum, LC.SUBSTAGE).setDataValidation(substageRuleFor_(row[LC.STAGE - 1], stageInfo, {}));
    }
    var ids = appendLogRows_([main].concat(res.entries));
    SpreadsheetApp.flush();
    if (subId) cache.put('SUB_' + subId, ids[0], 21600);
    cache.put(fingerprint, ids[0], 120);
    return { ok: true, activityId: ids[0], lead: leadSummary_(sheet, rowNum), messages: res.messages };
  } finally {
    lock.releaseLock();
  }
}

/** True if a log row already carries this submission ID (survives cache expiry). */
function submissionLogged_(subId) {
  var log = getSheet_(SHEET.LOG);
  var last = log.getLastRow();
  if (last < 2) return false;
  return !!log.getRange(2, LG.SUBMISSION, last - 1, 1).createTextFinder(subId).matchEntireCell(true).findNext();
}

/** Writes a lead row back in contiguous runs, skipping formula-output columns. */
function writeLeadRowCells_(sheet, rowNum, row) {
  // Only the columns the form owns are rewritten (never names, contacts, custom fields or formula
  // columns), grouped into runs of adjacent columns: one setValues call per run.
  var owned = [LC.STAGE, LC.SUBSTAGE, LC.PRIORITY, LC.LAST_CONTACT, LC.NEXT_FU, LC.OUTCOME, LC.UPDATED_BY,
    LC.LAST_ACTIVITY, LC.REMARKS, LC.STATUS, LC.LAST_FU_DATE, LC.STAGE_CHANGED, LC.ASSIGNED_DATE, LC.PREV_OWNER,
    LC.DQ_FLAGS, LC.SNAPSHOT]
    .filter(function (c) { return LEAD_FORMULA_COLS.indexOf(c) < 0; })
    .sort(function (a, b) { return a - b; });
  var start = owned[0];
  for (var i = 1; i <= owned.length; i++) {
    if (i < owned.length && owned[i] === owned[i - 1] + 1) continue;
    var end = owned[i - 1];
    sheet.getRange(rowNum, start, 1, end - start + 1).setValues([row.slice(start - 1, end)]);
    start = owned[i];
  }
}

/* ================================================================== */
/* Optional daily email reminders (disabled by default)                */
/* ================================================================== */

/** Sends each active counsellor a list of their open leads due today or overdue. */
function sendFollowUpReminders() {
  clearMemo_();
  var settings = getSettings_();
  if (!settings.remindersEnabled) {
    console.log('Email reminders are disabled (Lists & Settings > ' + SET.REMINDERS + ').');
    return 0;
  }
  var sheet = getSheet_(SHEET.LEADS);
  var last = lastLeadRow_(sheet);
  if (last < 2) return 0;
  var today = todayKey_();
  var byOwner = {};
  sheet.getRange(2, 1, last - 1, LEAD_COLS).getValues().forEach(function (v) {
    var id = str_(v[LC.ID - 1]);
    var due = toDateKey_(v[LC.NEXT_FU - 1]);
    if (!id || !due || due > today || isClosedStatus_(v[LC.STATUS - 1])) return;
    var owner = str_(v[LC.OWNER - 1]).toLowerCase();
    (byOwner[owner] = byOwner[owner] || []).push(id + ' | ' + str_(v[LC.NAME - 1]) + ' | ' + str_(v[LC.MOBILE - 1]) +
      ' | due ' + due + (due < today ? ' (OVERDUE)' : '') + ' | ' + str_(v[LC.STAGE - 1]));
  });
  var sent = 0;
  getCounsellors_().forEach(function (c) {
    var items = byOwner[c.name.toLowerCase()];
    if (!c.active || !c.email || !items || !items.length) return;
    if (MailApp.getRemainingDailyQuota() < 1) return;
    MailApp.sendEmail(c.email, 'Lead CRM: ' + items.length + ' follow-up(s) due today or overdue',
      'Hello ' + c.name + ',\n\nThese leads are due today or overdue:\n\n' + items.slice(0, 100).join('\n') +
      (items.length > 100 ? '\n... and ' + (items.length - 100) + ' more.' : '') +
      '\n\nOpen the CRM: ' + ss_().getUrl() + '\n\n(This reminder can be turned off by a CRM administrator.)');
    sent++;
  });
  console.log('Reminder emails sent: ' + sent);
  return sent;
}

function enableEmailReminders() {
  requireAdmin_();
  disableReminderTriggers_();
  setSettingValue_(SET.REMINDERS, 'Yes');
  var hour = getSettings_().reminderHour;
  ScriptApp.newTrigger('sendFollowUpReminders').timeBased().everyDays(1).atHour(hour).create();
  toast_('Daily reminders enabled (around ' + hour + ':00, ' + Session.getScriptTimeZone() + ' script time zone).');
}

function disableEmailReminders() {
  requireAdmin_();
  disableReminderTriggers_();
  setSettingValue_(SET.REMINDERS, 'No');
  toast_('Daily reminders disabled.');
}

function disableReminderTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendFollowUpReminders') ScriptApp.deleteTrigger(t);
  });
}

/** Admin > Send reminders now (test). */
function sendRemindersNow() {
  requireAdmin_();
  var n = sendFollowUpReminders();
  toast_(getSettings_().remindersEnabled ? 'Reminder emails sent: ' + n : 'Reminders are disabled - enable them first.');
}
