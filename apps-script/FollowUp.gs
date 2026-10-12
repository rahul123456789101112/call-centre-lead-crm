/**
 * FollowUp.gs
 * The follow-up form (sidebar FollowUpSidebar.html), "My overdue follow-ups", the follow-up queue and the
 * optional daily reminder emails.
 *
 * The form is the recommended way to update a lead. It is deliberately small: Lead (pre-selected),
 * Outcome, Stage, Substage, Next Follow-Up Date, Remarks, Save. It refuses to save until every required
 * field is filled, so a lead saved with the form is always complete.
 *
 * How a save is written:
 *  - Admins: written at once (their account may write every column).
 *  - Counsellors: their own account may only write the white (counsellor-editable) cells, so those are
 *    written at once and the rest (Follow-Up Log entry, Last Updated By, dates, snapshot) is queued.
 *    The queue is processed by the owner's triggers: the next edit in the sheet, or within a minute
 *    (processQueuedFollowUps). The web app runs as the owner and always writes at once.
 * A per-form submission ID plus a short "fingerprint" cache stop the same follow-up being saved twice.
 */

function showFollowUpSidebar() { openSidebar_('form'); }
function showMyFollowUps() { openSidebar_('list'); }

function openSidebar_(mode) {
  registerCurrentUser_();
  var t = HtmlService.createTemplateFromFile('FollowUpSidebar');
  t.mode = mode;
  SpreadsheetApp.getUi().showSidebar(t.evaluate().setTitle(mode === 'list' ? 'My follow-ups' : 'Log follow-up'));
}

/** Lead ID of the row selected on Lead Management ('' if none). */
function getSelectedLeadId() {
  var sheet = SpreadsheetApp.getActiveSheet();
  if (!sheet || sheet.getName() !== SHEET.LEADS) return '';
  var cell = sheet.getActiveCell();
  if (!cell || cell.getRow() < 2) return '';
  return str_(sheet.getRange(cell.getRow(), LC.ID).getValue());
}

/** Selects a lead's row on Lead Management (from the "My follow-ups" list). */
function goToLead(leadId) {
  var sheet = getSheet_(SHEET.LEADS);
  var row = findLeadRow_(sheet, leadId);
  if (!row) return false;
  ss_().setActiveSheet(sheet);
  sheet.setActiveSelection(sheet.getRange(row, LC.ID, 1, 2));
  return true;
}

/** Who may save: admins, and active counsellors (own leads). */
function formAccess_(actor) {
  if (!actor.email) return { ok: false, message: 'Google did not tell Lead CRM who you are. Close this panel and open it again; if it keeps happening, ask an admin.' };
  if (actor.admin || actor.counsellor) return { ok: true };
  return { ok: false, message: 'Your Google account (' + actor.email + ') is not an active counsellor in Counsellor Master. Ask an admin to add exactly this email.' };
}

/** Everything the sidebar needs to render. Also registers the user's identity for sheet edits. */
function getFollowUpContext() {
  var actor = registerCurrentUser_();
  var env = validationEnv_();
  var s = env.settings;
  var access = formAccess_(actor);
  return {
    actor: { email: actor.email, name: actor.counsellor || actor.name, admin: actor.admin },
    canSave: access.ok, message: access.message || '',
    outcomes: env.lists.outcomes,
    stages: env.stageInfo.activeStages.map(function (x) { return { name: x.name, subs: x.subs }; }),
    rules: { requireRemarks: s.requireRemarks, requireNextFu: s.requireNextFu, requireSubstage: s.requireSubstage, maxRemarks: s.maxRemarks },
    closingStages: [s.autoSync ? s.convertedStage : '', s.autoSync ? s.lostStage : ''].filter(String),
    today: env.today, maxNextFu: addDaysKey_(env.today, s.maxFuDays),
    selectedLeadId: getSelectedLeadId()
  };
}

/** Finds a lead by Lead ID or mobile number. Returns {found, lead, matches, message}. */
function getLeadForSidebar(query) {
  var q = str_(query);
  if (!q) return { found: false, message: 'Enter a Lead ID or mobile number.' };
  var sheet = getSheet_(SHEET.LEADS);
  var row = findLeadRow_(sheet, q);
  if (!row) {
    var last = lastLeadRow_(sheet);
    if (last >= 2) {
      var hits = sheet.getRange(2, LC.MOBILE, last - 1, 1).createTextFinder(cleanMobile_(q)).matchEntireCell(true).findAll();
      if (hits.length === 1) row = hits[0].getRow();
      else if (hits.length > 1) {
        return {
          found: false,
          matches: hits.slice(0, 10).map(function (h) {
            var v = sheet.getRange(h.getRow(), 1, 1, LC.OWNER).getValues()[0];
            return { id: str_(v[LC.ID - 1]), name: str_(v[LC.NAME - 1]), owner: str_(v[LC.OWNER - 1]) };
          }),
          message: hits.length + ' leads have this mobile number. Choose one.'
        };
      }
    }
  }
  if (!row) return { found: false, message: 'No lead found for "' + q + '".' };
  var lead = leadSummary_(sheet, row);
  var actor = registerCurrentUser_();
  lead.mine = actor.admin || same_(lead.owner, actor.counsellor);
  return { found: true, lead: lead };
}

function leadSummary_(sheet, row) {
  var v = sheet.getRange(row, 1, 1, LEAD_COLS).getValues()[0];
  var id = str_(v[LC.ID - 1]);
  return {
    id: id,
    name: str_(v[LC.NAME - 1]),
    mobile: str_(v[LC.MOBILE - 1]),
    owner: str_(v[LC.OWNER - 1]),
    stage: str_(v[LC.STAGE - 1]),
    substage: str_(v[LC.SUBSTAGE - 1]),
    status: str_(v[LC.STATUS - 1]),
    nextFollowUp: toDateKey_(v[LC.NEXT_FU - 1]),
    lastOutcome: str_(v[LC.OUTCOME - 1]),
    followUpCount: v[LC.FU_COUNT - 1] === '' ? 0 : v[LC.FU_COUNT - 1],
    lastUpdatedBy: str_(v[LC.UPDATED_BY - 1]),
    lastActivity: displayDateTime_(v[LC.LAST_ACTIVITY - 1]),
    flags: str_(v[LC.DQ_FLAGS - 1]),
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

/* ================================================================== */
/* My overdue follow-ups                                               */
/* ================================================================== */

/**
 * The user's leads that need attention: incomplete ones first, then follow-ups due today or overdue
 * (oldest first). Admins who are not counsellors see everyone's (first 200).
 */
function getMyFollowUps() {
  var actor = registerCurrentUser_();
  var access = formAccess_(actor);
  if (!access.ok) return { ok: false, message: access.message };
  var sheet = getSheet_(SHEET.LEADS);
  var last = lastLeadRow_(sheet);
  var data = last >= 2 ? sheet.getRange(2, 1, last - 1, LEAD_COLS).getValues() : [];
  var today = todayKey_();
  var everyone = !actor.counsellor;
  var items = [];
  data.forEach(function (r) {
    var id = str_(r[LC.ID - 1]);
    if (!id || (!everyone && !same_(r[LC.OWNER - 1], actor.counsellor)) || isClosedStatus_(r[LC.STATUS - 1])) return;
    var next = toDateKey_(r[LC.NEXT_FU - 1]);
    var incomplete = /^Incomplete/.test(str_(r[LC.DQ_FLAGS - 1]));
    if (!incomplete && !(next && next <= today)) return;
    items.push({
      id: id, name: str_(r[LC.NAME - 1]), mobile: str_(r[LC.MOBILE - 1]), owner: str_(r[LC.OWNER - 1]),
      stage: str_(r[LC.STAGE - 1]), next: next, overdue: !!next && next < today, incomplete: incomplete,
      missing: incomplete ? str_(r[LC.DQ_FLAGS - 1]).split(';')[0].replace(/^Incomplete:\s*/, '') : ''
    });
  });
  items.sort(function (a, b) {
    return (b.incomplete - a.incomplete) || ((a.next || '9999') < (b.next || '9999') ? -1 : (a.next || '9999') > (b.next || '9999') ? 1 : 0);
  });
  return { ok: true, name: actor.counsellor || actor.email, everyone: everyone, total: items.length, items: items.slice(0, 200), today: today };
}

/* ================================================================== */
/* Saving a follow-up                                                  */
/* ================================================================== */

/**
 * Sidebar save. p: {submissionId, leadId, outcome, stage, substage, nextFollowUp ('yyyy-MM-dd' or ''), remarks}
 * Returns {ok, activityId?, queued?, lead} or {ok:false, errors:[...], duplicate?}.
 */
function submitFollowUp(p) {
  var actor = registerCurrentUser_();
  var access = formAccess_(actor);
  if (!access.ok) return { ok: false, errors: [access.message] };
  if (actor.admin) return submitFollowUpAs_(p, actor, { source: 'follow-up form' });

  // Counsellor: write the white cells now, queue the rest for the owner's trigger.
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(20000)) return { ok: false, errors: ['Lead CRM is busy saving another change. Press Save again.'] };
  try {
    var opts = { source: 'follow-up form', forceCounsellor: actor.counsellor, ownerOnly: actor.counsellor, dryRun: true, haveLock: true };
    var res = submitFollowUpAs_(p, actor, opts);
    if (!res.ok) return res;
    var sheet = getSheet_(SHEET.LEADS);
    var direct = [LC.STAGE, LC.SUBSTAGE, LC.NEXT_FU, LC.OUTCOME, LC.REMARKS, LC.STATUS].filter(isEditableCol_);
    try {
      writeRowCols_(sheet, res.rowNum, res.row, direct);
      sheet.getRange(res.rowNum, LC.SUBSTAGE).setDataValidation(substageRuleFor_(res.row[LC.STAGE - 1], getStageInfo_(), {}));
    } catch (e) {
      direct = [];   // the owner's trigger writes everything instead
    }
    var item = { p: p, actor: { email: actor.email, name: actor.name, label: actor.label, counsellor: actor.counsellor, admin: false },
      t: Date.now(), direct: direct };
    PropertiesService.getScriptProperties().setProperty(PROP.QUEUE_PREFIX + Date.now() + '_' + Utilities.getUuid().substring(0, 8), JSON.stringify(item));
    rememberSubmission_(p, res.fingerprint, 'queued');
    return { ok: true, queued: true, lead: leadSummary_(sheet, res.rowNum) };
  } finally {
    lock.releaseLock();
  }
}

function rememberSubmission_(p, fingerprint, id) {
  var cache = CacheService.getDocumentCache();
  if (str_(p.submissionId)) cache.put('SUB_' + str_(p.submissionId), id, 21600);
  if (fingerprint) cache.put(fingerprint, id, 120);
}

/**
 * Records one follow-up as the given actor. Used by the sidebar (admins directly; counsellors in two
 * steps), the queue and the web app (runs as the owner; actor = the signed-in counsellor).
 * opts: {source, forceCounsellor, ownerOnly, dryRun, haveLock, trusted (queued: checked already),
 *        skipWriteCols (already written by the counsellor), now}
 */
function submitFollowUpAs_(p, actor, opts) {
  p = p || {};
  opts = opts || {};
  var env = validationEnv_();
  var settings = env.settings, stageInfo = env.stageInfo, lists = env.lists;
  var errors = [];
  var now = opts.now || new Date();
  var today = toDateKey_(now) > env.today ? toDateKey_(now) : env.today;

  var leadId = str_(p.leadId);
  var outcome = pick_(lists.outcomes, p.outcome);
  var remarks = str_(p.remarks);
  var nextKey = str_(p.nextFollowUp);
  if (!leadId) errors.push('Choose a lead first.');
  if (!str_(p.outcome)) errors.push('Choose the outcome of the call.');
  else if (!outcome) errors.push('Choose an outcome from the list.');
  if (settings.requireRemarks && !remarks) errors.push('Write a short remark.');
  if (remarks.length > settings.maxRemarks) errors.push('Remarks can have at most ' + settings.maxRemarks + ' characters.');
  if (nextKey) {
    if (!dateFromKey_(nextKey)) errors.push('Next follow-up date is not a real date.');
    else if (!opts.trusted && nextKey < today) errors.push('Next follow-up date cannot be in the past.');
    else if (nextKey > addDaysKey_(today, settings.maxFuDays)) errors.push('Next follow-up date must be within ' + settings.maxFuDays + ' days.');
  }
  var typeDef = lists.activityTypes.filter(function (a) { return same_(a.type, settings.formActivity); })[0];
  var type = typeDef ? typeDef.type : settings.formActivity;
  var category = typeDef ? typeDef.category : CATEGORY.CONTACT;
  if (errors.length && !opts.trusted) return { ok: false, errors: errors };

  var cache = CacheService.getDocumentCache();
  var fingerprint = 'FP_' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5,
    [leadId, outcome, remarks, nextKey, actor.email].join('|').toLowerCase(), Utilities.Charset.UTF_8));
  var subId = str_(p.submissionId);

  var lock = LockService.getDocumentLock();
  if (!opts.haveLock && !lock.tryLock(20000)) return { ok: false, errors: ['Lead CRM is busy saving another change. Press Save again.'] };
  try {
    if (!opts.trusted) {
      if (subId && (cache.get('SUB_' + subId) || submissionLogged_(subId))) {
        return { ok: false, duplicate: true, errors: ['This follow-up was already saved.'] };
      }
      if (cache.get(fingerprint)) {
        return { ok: false, duplicate: true, errors: ['The same follow-up for this lead was saved less than 2 minutes ago. If this is a new call, change the remarks and save again.'] };
      }
    }
    var sheet = getSheet_(SHEET.LEADS);
    var rowNum = findLeadRow_(sheet, leadId);           // found inside the lock: rows may have been sorted
    if (!rowNum) return { ok: false, errors: ['Lead ' + leadId + ' was not found (was it deleted?).'] };
    var row = sheet.getRange(rowNum, 1, 1, LEAD_COLS).getValues()[0];
    var snap = parseSnapshot_(row[LC.SNAPSHOT - 1]) || parseSnapshot_(buildSnapshot_(row));
    if (!snap.v) snap = upgradeSnapshot_(snap, row);
    // The snapshot holds the last accepted values: compare and write against it, not against cells a
    // counsellor may have changed since.
    SNAP_COLS.forEach(function (c) { if (!opts.skipWriteCols || opts.skipWriteCols.indexOf(c) < 0) row[c - 1] = snapValue_(snap, c); });
    var owner = str_(snapValue_(snap, LC.OWNER));
    if (opts.ownerOnly && !same_(owner, opts.ownerOnly)) {
      return { ok: false, errors: ['Lead ' + leadId + ' is assigned to ' + (owner || 'nobody') + '. You can only update your own leads.'] };
    }
    var before = { o: owner, s: str_(snap.s), ss: str_(snap.ss), st: str_(snap.st), n: str_(snap.n) };

    // ---- stage, substage, status ----
    var stage = str_(p.stage) || before.s;
    var stageChanged = !same_(stage, before.s);
    if (stageChanged && !stageInfo.isActiveStage(stage)) errors.push('"' + stage + '" is not a Lead Stage.');
    else stage = stageInfo.canonicalStage(stage) || stage;
    var substage = str_(p.substage);
    var subs = stageInfo.activeSubs(stage);
    if (substage && !stageInfo.isActivePair(stage, substage) && !(same_(substage, before.ss) && !stageChanged)) {
      errors.push('"' + substage + '" is not a substage of "' + stage + '".');
    }
    if (!substage && subs.length && settings.requireSubstage) errors.push('Choose a substage.');
    var status = statusForStage_(stage, before.st, settings) || before.st;
    var closed = isClosedStatus_(status);
    if (!closed && settings.requireNextFu && !nextKey) errors.push('Choose the next follow-up date.');
    if (errors.length && !opts.trusted) return { ok: false, errors: errors };

    // ---- the lead row after this follow-up ----
    row[LC.STAGE - 1] = stage;
    row[LC.SUBSTAGE - 1] = substage ? (stageInfo.canonicalSub(stage, substage) || substage) : '';
    row[LC.OUTCOME - 1] = outcome || str_(p.outcome);
    row[LC.REMARKS - 1] = safeText_(remarks);
    row[LC.NEXT_FU - 1] = nextKey ? dateFromKey_(nextKey) : (closed ? '' : row[LC.NEXT_FU - 1]);
    var dayKey = toDateKey_(now);
    var activityDate = dateFromKey_(dayKey);
    if (category === CATEGORY.CONTACT && (!isDate_(row[LC.LAST_CONTACT - 1]) || toDateKey_(row[LC.LAST_CONTACT - 1]) <= dayKey)) row[LC.LAST_CONTACT - 1] = activityDate;
    if (!isDate_(row[LC.LAST_FU_DATE - 1]) || toDateKey_(row[LC.LAST_FU_DATE - 1]) <= dayKey) row[LC.LAST_FU_DATE - 1] = activityDate;
    var counsellor = opts.forceCounsellor || actor.counsellor || owner || actor.label;
    row[LC.UPDATED_BY - 1] = actor.counsellor || actor.label;
    row[LC.LAST_ACTIVITY - 1] = now;

    var res = trackLeadChanges_(row, before, {
      actor: { email: actor.email, name: actor.name, label: actor.counsellor || actor.label },
      now: now, stageInfo: stageInfo, settings: settings, statusExplicit: false,
      logNextFu: false, note: 'Via ' + (opts.source || 'follow-up form')
    });
    var entries = [];
    // Outcome changes made earlier in the sheet while the lead was incomplete now count as follow-ups.
    (snap.pc || []).forEach(function (pc) {
      entries.push(buildLogEntry_({ row: row, time: new Date(pc.t), type: ACT.SHEET_UPDATE, category: CATEGORY.CONTACT,
        counsellor: pc.c, updatedBy: pc.e, outcome: pc.o, remarks: 'Outcome changed in the sheet' }));
    });
    entries.push(buildLogEntry_({
      row: row, time: now, type: type, category: category, counsellor: counsellor, updatedBy: actor.email || actor.label,
      outcome: row[LC.OUTCOME - 1], nextFu: nextKey ? dateFromKey_(nextKey) : '', remarks: remarks, submissionId: subId
    }));
    entries = entries.concat(res.entries);
    row[LC.SNAPSHOT - 1] = buildSnapshot_(row, {});   // the form only saves complete leads
    row[LC.DQ_FLAGS - 1] = computeDqFlags_(row, buildDqEnv_(sheet));
    if (opts.dryRun) return { ok: true, row: row, rowNum: rowNum, fingerprint: fingerprint };

    var owned = [LC.STAGE, LC.SUBSTAGE, LC.PRIORITY, LC.LAST_CONTACT, LC.NEXT_FU, LC.OUTCOME, LC.UPDATED_BY,
      LC.LAST_ACTIVITY, LC.REMARKS, LC.STATUS, LC.LAST_FU_DATE, LC.STAGE_CHANGED, LC.ASSIGNED_DATE, LC.PREV_OWNER,
      LC.DQ_FLAGS, LC.SNAPSHOT].filter(function (c) { return !opts.skipWriteCols || opts.skipWriteCols.indexOf(c) < 0; });
    writeRowCols_(sheet, rowNum, row, owned);
    if (stageChanged || res.stageChanged) {
      sheet.getRange(rowNum, LC.SUBSTAGE).setDataValidation(substageRuleFor_(row[LC.STAGE - 1], stageInfo, {}));
    }
    var ids = appendLogRows_(entries);
    var mainId = ids[(snap.pc || []).length];
    rememberSubmission_(p, fingerprint, mainId);
    return { ok: true, activityId: mainId, lead: opts.trusted ? null : leadSummary_(sheet, rowNum), messages: res.messages };
  } finally {
    if (!opts.haveLock) lock.releaseLock();
  }
}

/** True if a log row already carries this submission ID (survives cache expiry). */
function submissionLogged_(subId) {
  var log = getSheet_(SHEET.LOG);
  var last = log.getLastRow();
  if (last < 2) return false;
  return !!log.getRange(2, LG.SUBMISSION, last - 1, 1).createTextFinder(subId).matchEntireCell(true).findNext();
}

/* ================================================================== */
/* Queue of counsellor saves (processed by the owner's triggers)       */
/* ================================================================== */

/** Time trigger (every minute, created by setup). */
function processQueuedFollowUps() {
  var props = PropertiesService.getScriptProperties();
  var pending = props.getKeys().some(function (k) { return k.indexOf(PROP.QUEUE_PREFIX) === 0; });
  var dash = CacheService.getDocumentCache().get('DASH_REFRESH_REQUESTED');
  if (!pending && !dash) return;
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) return;
  try {
    processFollowUpQueue_();
  } finally {
    lock.releaseLock();
  }
  if (dash) {
    CacheService.getDocumentCache().remove('DASH_REFRESH_REQUESTED');
    refreshDashboardData_();
  }
}

/** Writes queued counsellor follow-ups (oldest first). Caller holds the document lock. */
function processFollowUpQueue_() {
  var props = PropertiesService.getScriptProperties();
  var keys = props.getKeys().filter(function (k) { return k.indexOf(PROP.QUEUE_PREFIX) === 0; }).sort();
  keys.forEach(function (k) {
    var raw = props.getProperty(k);
    props.deleteProperty(k);
    var item;
    try { item = JSON.parse(raw); } catch (e) { return; }
    try {
      var res = submitFollowUpAs_(item.p, item.actor, {
        source: 'follow-up form', forceCounsellor: item.actor.counsellor, trusted: true, haveLock: true,
        skipWriteCols: item.direct || [], now: new Date(item.t)
      });
      if (!res.ok) console.warn('Queued follow-up not written: ' + (res.errors || []).join(' '));
    } catch (e) {
      console.error('Queued follow-up failed: ' + (e && e.stack ? e.stack : e));
    }
  });
  return keys.length;
}

/* ================================================================== */
/* Optional daily email reminders (disabled by default)                */
/* ================================================================== */

/** Sends each active counsellor their open leads that are incomplete, due today or overdue. */
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
    if (!id || isClosedStatus_(v[LC.STATUS - 1])) return;
    var due = toDateKey_(v[LC.NEXT_FU - 1]);
    var flags = str_(v[LC.DQ_FLAGS - 1]);
    var incomplete = /^Incomplete/.test(flags);
    if (!incomplete && !(due && due <= today)) return;
    var owner = str_(v[LC.OWNER - 1]).toLowerCase();
    var o = byOwner[owner] = byOwner[owner] || { incomplete: [], due: [] };
    var line = id + ' | ' + str_(v[LC.NAME - 1]) + ' | ' + str_(v[LC.MOBILE - 1]);
    if (incomplete) o.incomplete.push(line + ' | missing: ' + flags.split(';')[0].replace(/^Incomplete:\s*/, ''));
    if (due && due <= today) o.due.push(line + ' | due ' + due + (due < today ? ' (OVERDUE)' : ''));
  });
  var sent = 0;
  getCounsellors_().forEach(function (c) {
    var o = byOwner[c.name.toLowerCase()];
    if (!c.active || !c.email || !o) return;
    if (MailApp.getRemainingDailyQuota() < 1) return;
    var body = 'Hello ' + c.name + ',\n\n';
    if (o.incomplete.length) body += 'Please complete these leads (something is missing):\n' + o.incomplete.slice(0, 50).join('\n') + '\n\n';
    if (o.due.length) body += 'Follow-ups due today or overdue:\n' + o.due.slice(0, 100).join('\n') + (o.due.length > 100 ? '\n... and ' + (o.due.length - 100) + ' more.' : '') + '\n\n';
    MailApp.sendEmail(c.email, 'Lead CRM: ' + o.incomplete.length + ' incomplete, ' + o.due.length + ' due today or overdue',
      body + 'Open the CRM: ' + ss_().getUrl() + ' (Lead CRM > My overdue follow-ups)\n\n(An admin can turn these reminders off.)');
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
  toast_('Daily reminders enabled (around ' + hour + ':00, ' + Session.getScriptTimeZone() + ').');
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
  toast_(getSettings_().remindersEnabled ? 'Reminder emails sent: ' + n : 'Reminders are off. Turn them on first.');
}
