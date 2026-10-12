/**
 * Triggers.gs
 * Edit handling: Lead IDs, fixed timestamps, dependent stage/substage dropdowns,
 * stage-change validation, duplicate checks and the audit trail.
 *
 * Two modes (see docs/SETUP.md):
 *  - "simple" (default): the simple onEdit(e) trigger runs as the person editing. Their
 *    identity is resolved via Session / the temporary-key mapping in Config.gs.
 *  - "installable": an installable onEdit trigger (created by an admin) runs as that admin.
 *    Recommended only for a single Google Workspace domain, where e.user is populated.
 * Only one of the two handlers does work at a time.
 */

/* ================================================================== */
/* Entry points                                                        */
/* ================================================================== */

/** Simple trigger. Runs for every editor without authorisation. */
function onEdit(e) {
  if (!e || !e.range) return;
  if (getEditMode_() === 'installable') return;
  handleEdit_(e);
}

/** Installable trigger handler (Admin > Use installable edit trigger). */
function onEditInstallable(e) {
  if (!e || !e.range) return;
  if (getEditMode_() !== 'installable') return;
  handleEdit_(e);
}

/**
 * Installable onChange trigger created by setup. Sorting, inserting or deleting rows can leave
 * per-row substage dropdowns out of step with the Lead Stage, so they are rebuilt (throttled).
 */
function onChangeInstallable(e) {
  var type = e && e.changeType;
  if (['OTHER', 'INSERT_ROW', 'REMOVE_ROW'].indexOf(type) < 0) return;
  var cache = CacheService.getDocumentCache();
  if (cache.get(PROP.LAST_SUBSTAGE_REFRESH)) return;
  cache.put(PROP.LAST_SUBSTAGE_REFRESH, '1', 30);
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(20000)) return;
  try {
    refreshAllSubstageValidations_();
  } finally {
    lock.releaseLock();
  }
}

function handleEdit_(e) {
  var range = e.range;
  var sheet = range.getSheet();
  try {
    switch (sheet.getName()) {
      case SHEET.LEADS: onLeadSheetEdit_(e, sheet, range); break;
      case SHEET.STAGES: onStageMasterEdit_(e, sheet, range); break;
      case SHEET.COUNSELLORS: onCounsellorMasterEdit_(e, sheet, range); break;
      case SHEET.LOG: onLogEdit_(e, sheet, range); break;
      case SHEET.DASHBOARD: onDashboardEdit_(e, sheet, range); break;
      default: break;
    }
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    toast_('Lead CRM automation error: ' + (err && err.message ? err.message : err), 10);
  }
}

/* ================================================================== */
/* Lead Management                                                     */
/* ================================================================== */

function onLeadSheetEdit_(e, sheet, range) {
  var r1 = Math.max(range.getRow(), 2);
  var r2 = range.getLastRow();
  var c1 = range.getColumn();
  var c2 = range.getLastColumn();
  if (r2 < 2 || c1 > LEAD_COLS) return;
  var n = r2 - r1 + 1;

  // Typing into a formula-output column blocks the ARRAYFORMULA in the header: undo it.
  var formulaHit = LEAD_FORMULA_COLS.filter(function (c) { return c >= c1 && c <= c2; });
  if (formulaHit.length) {
    formulaHit.forEach(function (c) { sheet.getRange(r1, c, n, 1).clearContent(); });
    toast_('"' + LEAD_HEADERS[formulaHit[0] - 1] + '" is calculated automatically; your entry was removed.');
    if (c1 === c2) return;
  }

  var single = range.getNumRows() === 1 && range.getNumColumns() === 1;
  if (single && LEAD_SYSTEM_COLS.indexOf(c1) >= 0 && c1 !== LC.ID) {
    toast_('"' + LEAD_HEADERS[c1 - 1] + '" is maintained by the system and will be overwritten by the next tracked activity.');
  }

  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(15000)) {
    toast_('The CRM is busy saving another change. Your edit is saved; IDs and tracking will be applied on the next edit of this row (or via Admin > Process imported / pasted leads).', 10);
    return;
  }
  try {
    var res = processLeadRows_(sheet, r1, n, {
      c1: c1, c2: c2, single: single, oldValue: e.oldValue, actor: getActor_(e), source: 'edit'
    });
    if (res.messages.length) {
      var extra = res.messages.length > 2 ? ' (+' + (res.messages.length - 2) + ' more)' : '';
      toast_(res.messages.slice(0, 2).join(' ') + extra, 10);
    }
  } finally {
    lock.releaseLock();
  }
}

/** True when any column in c1..c2 is a column the user maintains (not system / formula). */
function touchesUserCols_(c1, c2) {
  for (var c = c1; c <= Math.min(c2, LEAD_COLS); c++) {
    if (LEAD_SYSTEM_COLS.indexOf(c) < 0 && LEAD_FORMULA_COLS.indexOf(c) < 0) return true;
  }
  return false;
}

/** A row is a lead when any user-maintained field has a value. */
function hasLeadData_(row) {
  for (var c = LC.NAME; c <= LEAD_COLS; c++) {
    if (LEAD_SYSTEM_COLS.indexOf(c) >= 0 || LEAD_FORMULA_COLS.indexOf(c) >= 0) continue;
    if (str_(row[c - 1]) !== '') return true;
  }
  return false;
}

/** Lead IDs (lower-case) of every row OUTSIDE the block being processed. */
function buildIdIndex_(sheet, startRow, n) {
  var idx = {};
  var last = lastLeadRow_(sheet);
  if (last < 2) return idx;
  sheet.getRange(2, LC.ID, last - 1, 1).getValues().forEach(function (r, i) {
    var row = i + 2;
    if (row >= startRow && row < startRow + n) return;
    var id = str_(r[0]).toLowerCase();
    if (id) idx[id] = true;
  });
  return idx;
}

/**
 * Core processor for a block of Lead Management rows. Used by onEdit and by
 * Admin > Process imported / pasted leads. Caller MUST hold the document lock.
 * ctx: {c1, c2, single, oldValue, actor, source: 'edit' | 'bulk'}
 */
function processLeadRows_(sheet, startRow, n, ctx) {
  var settings = getSettings_();
  var stageInfo = getStageInfo_();
  var now = new Date();
  var actor = ctx.actor || getActor_();
  var isEdit = ctx.source === 'edit';
  var data = sheet.getRange(startRow, 1, n, LEAD_COLS).getValues();
  var changed = {};
  var mark = function (i, col) {
    var c = changed[col];
    if (!c) changed[col] = [i, i];
    else { if (i < c[0]) c[0] = i; if (i > c[1]) c[1] = i; }
  };
  var entries = [];
  var messages = [];
  var validationIdx = [];
  var editedUserCols = isEdit && touchesUserCols_(ctx.c1, ctx.c2);
  var idTouched = !isEdit || (ctx.c1 <= LC.ID && ctx.c2 >= LC.ID);
  var substageTouched = isEdit && ctx.c1 <= LC.SUBSTAGE && ctx.c2 >= LC.SUBSTAGE;
  var statusTouched = isEdit && ctx.c1 <= LC.STATUS && ctx.c2 >= LC.STATUS;
  var idIndex = null;
  var getIdIndex = function () { if (!idIndex) idIndex = buildIdIndex_(sheet, startRow, n); return idIndex; };
  var seen = {};
  var maxImported = 0;
  var idRe = new RegExp('^' + escapeRegex_(settings.leadPrefix) + '(\\d+)$', 'i');

  for (var i = 0; i < n; i++) {
    var row = data[i];
    var r = startRow + i;

    // A single typed change to an existing Lead ID is reverted.
    if (isEdit && ctx.single && ctx.c1 === LC.ID && ctx.oldValue !== undefined && str_(ctx.oldValue) !== '' &&
        str_(row[LC.ID - 1]) !== str_(ctx.oldValue)) {
      row[LC.ID - 1] = ctx.oldValue;
      mark(i, LC.ID);
      messages.push('Lead IDs are generated by the system; ' + ctx.oldValue + ' was restored.');
    }
    if (!hasLeadData_(row)) continue;

    var id = str_(row[LC.ID - 1]);
    if (id && idTouched) {
      var key = id.toLowerCase();
      if (getIdIndex()[key] || seen[key]) {
        messages.push('Duplicate Lead ID ' + id + ' on row ' + r + ' was replaced with a new ID.');
        id = '';
        row[LC.SNAPSHOT - 1] = '';
        row[LC.CREATED - 1] = '';
      } else {
        var m = idRe.exec(id);
        if (m) maxImported = Math.max(maxImported, parseInt(m[1], 10));
      }
    }

    if (isEdit && n <= 50) checkDuplicateContacts_(sheet, r, row, i, ctx, settings, messages, mark);

    // A row with an ID but no snapshot and no created date is an imported lead: initialise it like a new one.
    var importedNew = !!id && !parseSnapshot_(row[LC.SNAPSHOT - 1]) && !row[LC.CREATED - 1];
    if (!id || importedNew) {
      if (!id) {
        id = generateLeadId_(settings, getIdIndex(), seen);
        row[LC.ID - 1] = id;
        mark(i, LC.ID);
      }
      seen[id.toLowerCase()] = true;
      var created = initialiseNewLead_(row, settings, stageInfo, now, actor);
      created.cols.forEach(function (c) { mark(i, c); });
      entries = entries.concat(created.entries);
      messages = messages.concat(created.messages);
      validationIdx.push(i);
      continue;
    }
    seen[id.toLowerCase()] = true;

    // Existing lead: compare against the snapshot taken after the previous tracked change.
    var snap = parseSnapshot_(row[LC.SNAPSHOT - 1]);
    if (!snap) {
      snap = readTracked_(row);
      var tKey = trackedKeyForCol_(ctx.c1);
      if (isEdit && ctx.single && tKey) {
        snap[tKey] = tKey === 'n' ? toDateKey_(ctx.oldValue) : str_(ctx.oldValue);
      }
      if (!row[LC.CREATED - 1]) { row[LC.CREATED - 1] = now; mark(i, LC.CREATED); }
    }
    var res = trackLeadChanges_(row, snap, {
      actor: actor, now: now, stageInfo: stageInfo, settings: settings,
      statusExplicit: statusTouched, logNextFu: true,
      note: isEdit ? (n > 1 ? 'Bulk edit in sheet' : 'Edited in sheet') : 'Processed by Admin > Process imported / pasted leads'
    });
    res.cols.forEach(function (c) { mark(i, c); });
    entries = entries.concat(res.entries);
    messages = messages.concat(res.messages);
    if (res.stageChanged || substageTouched) validationIdx.push(i);

    if (editedUserCols || res.entries.length) {
      row[LC.UPDATED_BY - 1] = actor.label;
      row[LC.LAST_ACTIVITY - 1] = now;
      mark(i, LC.UPDATED_BY);
      mark(i, LC.LAST_ACTIVITY);
    }
  }

  if (maxImported) bumpLeadSeq_(maxImported);
  writeChangedColumns_(sheet, startRow, data, changed);
  if (validationIdx.length) applySubstageValidations_(sheet, startRow, data, validationIdx, stageInfo);
  if (entries.length) appendLogRows_(entries);
  return { messages: messages, logged: entries.length };
}

function generateLeadId_(settings, idIndex, seen) {
  var id;
  do {
    var nextNum = nextSeq_(PROP.LEAD_SEQ, 1, function () {
      return maxIdNumber_(getSheet_(SHEET.LEADS), LC.ID, settings.leadPrefix);
    });
    id = settings.leadPrefix + pad_(nextNum, settings.leadDigits);
  } while (idIndex[id.toLowerCase()] || seen[id.toLowerCase()]);
  return id;
}

/** Keeps the counter ahead of IDs that were pasted / imported. */
function bumpLeadSeq_(num) {
  var props = PropertiesService.getDocumentProperties();
  var cur = parseInt(props.getProperty(PROP.LEAD_SEQ), 10);
  if (isNaN(cur) || num > cur) props.setProperty(PROP.LEAD_SEQ, String(num));
}

/** Sets created date, defaults, assignment / stage dates and logs a single "Lead Created" entry. */
function initialiseNewLead_(row, settings, stageInfo, now, actor) {
  var cols = [LC.CREATED, LC.STATUS, LC.STAGE, LC.SUBSTAGE, LC.STAGE_CHANGED, LC.ASSIGNED_DATE,
    LC.UPDATED_BY, LC.LAST_ACTIVITY, LC.SNAPSHOT];
  var messages = [];
  row[LC.CREATED - 1] = now;
  if (!str_(row[LC.STATUS - 1])) row[LC.STATUS - 1] = settings.defaultStatus;

  if (!str_(row[LC.STAGE - 1]) && settings.defaultStage && stageInfo.isActiveStage(settings.defaultStage)) {
    row[LC.STAGE - 1] = stageInfo.canonicalStage(settings.defaultStage);
    if (!str_(row[LC.SUBSTAGE - 1]) && stageInfo.isActivePair(row[LC.STAGE - 1], settings.defaultSubstage)) {
      row[LC.SUBSTAGE - 1] = stageInfo.canonicalSub(row[LC.STAGE - 1], settings.defaultSubstage);
    }
  }
  var sub = str_(row[LC.SUBSTAGE - 1]);
  if (sub && !stageInfo.isActivePair(row[LC.STAGE - 1], sub)) {
    messages.push('Substage "' + sub + '" does not belong to stage "' + str_(row[LC.STAGE - 1]) + '" and was cleared.');
    row[LC.SUBSTAGE - 1] = '';
  }
  if (str_(row[LC.STAGE - 1])) row[LC.STAGE_CHANGED - 1] = now;
  if (str_(row[LC.OWNER - 1])) row[LC.ASSIGNED_DATE - 1] = now;
  var sync = statusForStage_(row[LC.STAGE - 1], row[LC.STATUS - 1], settings);
  if (sync) row[LC.STATUS - 1] = sync;

  row[LC.UPDATED_BY - 1] = actor.label;
  row[LC.LAST_ACTIVITY - 1] = now;
  var t = readTracked_(row);
  row[LC.SNAPSHOT - 1] = JSON.stringify(t);

  var summary = 'Owner: ' + (t.o || '-') + '; Stage: ' + (t.s || '-') + (t.ss ? ' / ' + t.ss : '') +
    '; Status: ' + (t.st || '-') + (t.n ? '; Next follow-up: ' + t.n : '');
  var entry = buildLogEntry_({
    row: row, time: now, type: ACT.LEAD_CREATED, category: CATEGORY.SYSTEM, counsellor: 'System',
    updatedBy: actor.email || actor.label, field: 'Lead', newValue: summary, remarks: 'New lead entered'
  });
  return { cols: cols, entries: [entry], messages: messages };
}

/** Status implied by moving to the configured Converted / Lost stage ('' = no change). */
function statusForStage_(stage, currentStatus, settings) {
  if (!settings.autoSync || !str_(stage)) return '';
  var target = '';
  if (settings.convertedStage && same_(stage, settings.convertedStage)) target = STATUS.CONVERTED;
  else if (settings.lostStage && same_(stage, settings.lostStage)) target = STATUS.LOST;
  if (!target || same_(currentStatus, target) || same_(currentStatus, STATUS.DUPLICATE)) return '';
  return target;
}

/**
 * Compares a lead row with its previous snapshot, applies the dependent rules and builds audit
 * entries. Mutates `row`. Shared by onEdit and the follow-up sidebar.
 * ctx: {actor, now, stageInfo, settings, statusExplicit, logNextFu, note}
 * Returns {entries, messages, cols, stageChanged}.
 */
function trackLeadChanges_(row, snap, ctx) {
  var out = { entries: [], messages: [], cols: [], stageChanged: false };
  var cur = readTracked_(row);
  var actor = ctx.actor;
  var by = actor.email || actor.label;
  var audit = function (type, category, field, oldV, newV, remarks) {
    out.entries.push(buildLogEntry_({
      row: row, time: ctx.now, type: type, category: category,
      counsellor: category === CATEGORY.SYSTEM ? 'System' : actor.label,
      updatedBy: by, field: field, oldValue: oldV, newValue: newV, remarks: remarks || ctx.note
    }));
  };
  var setCol = function (col, v) { row[col - 1] = v; if (out.cols.indexOf(col) < 0) out.cols.push(col); };

  // 1. Stage
  if (!same_(cur.s, snap.s)) {
    out.stageChanged = true;
    setCol(LC.STAGE_CHANGED, ctx.now);
    audit(ACT.STAGE_UPDATED, CATEGORY.RECORD, 'Lead Stage', snap.s, cur.s);
    if (cur.s && !ctx.stageInfo.isActiveStage(cur.s)) {
      out.messages.push('Stage "' + cur.s + '" is not an active stage in Stage Master.');
    }
  }

  // 2. Substage must belong to the (new) stage — cleared when it does not.
  var subChanged = !same_(cur.ss, snap.ss);
  var cleared = '';
  if ((out.stageChanged || subChanged) && cur.ss && !ctx.stageInfo.isActivePair(cur.s, cur.ss)) {
    cleared = cur.ss;
    setCol(LC.SUBSTAGE, '');
    cur.ss = '';
    audit(ACT.SUBSTAGE_CLEARED, CATEGORY.SYSTEM, 'Lead Substage', cleared, '',
      'Substage "' + cleared + '" is not an active substage of "' + (cur.s || '(no stage)') + '"');
    out.messages.push('Substage "' + cleared + '" does not belong to "' + (cur.s || '(no stage)') + '" and was cleared - please choose a new substage.');
    subChanged = !same_(cur.ss, snap.ss);
  }
  if (subChanged && !(cleared && same_(snap.ss, cleared))) {
    audit(ACT.STAGE_UPDATED, CATEGORY.RECORD, 'Lead Substage', snap.ss, cur.ss);
    if (!out.stageChanged) setCol(LC.STAGE_CHANGED, ctx.now);
  }

  // 3. Status (manual, or implied by Converted / Lost stage)
  var autoStatus = false;
  if (out.stageChanged && !ctx.statusExplicit) {
    var target = statusForStage_(cur.s, cur.st, ctx.settings);
    if (target) { setCol(LC.STATUS, target); cur.st = target; autoStatus = true; }
  }
  if (!same_(cur.st, snap.st)) {
    audit(ACT.STATUS_UPDATED, autoStatus ? CATEGORY.SYSTEM : CATEGORY.RECORD, 'Lead Status', snap.st, cur.st,
      autoStatus ? 'Status set automatically from stage "' + cur.s + '"' : ctx.note);
  }

  // 4. Owner (assignment / reassignment)
  if (!same_(cur.o, snap.o)) {
    if (snap.o) setCol(LC.PREV_OWNER, snap.o);
    setCol(LC.ASSIGNED_DATE, ctx.now);
    audit(ACT.LEAD_ASSIGNED, CATEGORY.RECORD, 'Assigned Counsellor', snap.o, cur.o,
      snap.o ? 'Reassigned' : 'Assigned');
    if (cur.o && !isActiveCounsellor_(cur.o)) {
      out.messages.push('"' + cur.o + '" is not an active counsellor in Counsellor Master.');
    }
  }

  // 5. Next follow-up date
  if (cur.n !== snap.n) {
    if (ctx.logNextFu) audit(ACT.FU_SCHEDULED, CATEGORY.RECORD, 'Next Follow-Up Date', snap.n, cur.n);
    if (cur.n && cur.n < todayKey_() && !isClosedStatus_(cur.st)) {
      out.messages.push('Next follow-up date ' + cur.n + ' is in the past (the lead now shows as overdue).');
    }
  }

  setCol(LC.SNAPSHOT, JSON.stringify(readTracked_(row)));
  return out;
}

/**
 * Builds one Follow-Up Log row (Activity ID is assigned in appendLogRows_).
 * o: {row, time, type, category, counsellor, updatedBy, outcome, nextFu, remarks, field,
 *     oldValue, newValue, submissionId}
 */
function buildLogEntry_(o) {
  var row = o.row;
  var e = new Array(LOG_COLS);
  for (var i = 0; i < LOG_COLS; i++) e[i] = '';
  e[LG.LEAD_ID - 1] = str_(row[LC.ID - 1]);
  e[LG.LEAD_NAME - 1] = safeText_(row[LC.NAME - 1]);
  e[LG.COUNSELLOR - 1] = safeText_(o.counsellor);
  e[LG.TIME - 1] = o.time;
  e[LG.TYPE - 1] = o.type;
  e[LG.OUTCOME - 1] = safeText_(o.outcome);
  e[LG.STAGE - 1] = safeText_(row[LC.STAGE - 1]);
  e[LG.SUBSTAGE - 1] = safeText_(row[LC.SUBSTAGE - 1]);
  e[LG.NEXT_FU - 1] = o.nextFu || '';
  e[LG.REMARKS - 1] = safeText_(o.remarks);
  e[LG.UPDATED_BY - 1] = safeText_(o.updatedBy);
  e[LG.CATEGORY - 1] = o.category;
  e[LG.FIELD - 1] = safeText_(o.field);
  e[LG.OLD - 1] = safeText_(displayValue_(o.oldValue));
  e[LG.NEW - 1] = safeText_(displayValue_(o.newValue));
  e[LG.OWNER - 1] = safeText_(row[LC.OWNER - 1]);
  e[LG.SUBMISSION - 1] = o.submissionId || '';
  return e;
}

/**
 * Appends entries to Follow-Up Log in one batch, assigning Activity IDs.
 * Caller MUST hold the document lock. Returns the Activity IDs.
 */
function appendLogRows_(entries) {
  if (!entries.length) return [];
  var settings = getSettings_();
  var log = getSheet_(SHEET.LOG);
  var start = log.getLastRow() + 1;
  var needed = start + entries.length - 1;
  if (needed > log.getMaxRows()) {
    log.insertRowsAfter(log.getMaxRows(), Math.max(LOG_GROW_BY, needed - log.getMaxRows()));
  }
  var first = nextSeq_(PROP.ACT_SEQ, entries.length, function () {
    return maxIdNumber_(log, LG.ACT_ID, settings.actPrefix);
  });
  var ids = entries.map(function (e, k) {
    e[LG.ACT_ID - 1] = settings.actPrefix + pad_(first + k, 6);
    return e[LG.ACT_ID - 1];
  });
  log.getRange(start, 1, entries.length, LOG_COLS).setValues(entries);
  return ids;
}

/** Writes only the columns that changed, one batch per column (formula columns are never written). */
function writeChangedColumns_(sheet, startRow, data, changed) {
  Object.keys(changed).forEach(function (k) {
    var col = parseInt(k, 10);
    if (LEAD_FORMULA_COLS.indexOf(col) >= 0) return;
    var span = changed[k];
    var vals = [];
    for (var i = span[0]; i <= span[1]; i++) vals.push([data[i][col - 1]]);
    sheet.getRange(startRow + span[0], col, vals.length, 1).setValues(vals);
  });
}

/** Contact duplicate checks for single / small edits (bulk pastes rely on Data Quality Flags). */
function checkDuplicateContacts_(sheet, r, row, i, ctx, settings, messages, mark) {
  var checks = [
    { col: LC.MOBILE, mode: settings.dupMobile, label: 'mobile number' },
    { col: LC.EMAIL, mode: settings.dupEmail, label: 'email ID' }
  ];
  checks.forEach(function (chk) {
    if (same_(chk.mode, 'Off') || chk.col < ctx.c1 || chk.col > ctx.c2) return;
    var v = str_(row[chk.col - 1]);
    if (!v) return;
    var last = lastLeadRow_(sheet);
    if (last < 2) return;
    var hits = sheet.getRange(2, chk.col, last - 1, 1).createTextFinder(v).matchEntireCell(true).findAll()
      .filter(function (h) { return h.getRow() !== r; });
    if (!hits.length) return;
    var ids = hits.slice(0, 3).map(function (h) { return str_(sheet.getRange(h.getRow(), LC.ID).getValue()) || ('row ' + h.getRow()); });
    if (same_(chk.mode, 'Block')) {
      row[chk.col - 1] = ctx.single && ctx.oldValue !== undefined ? ctx.oldValue : '';
      mark(i, chk.col);
      messages.push('Blocked: ' + chk.label + ' ' + v + ' already belongs to ' + ids.join(', ') + '.');
    } else {
      messages.push('Warning: ' + chk.label + ' ' + v + ' is also used by ' + ids.join(', ') + (hits.length > 3 ? ' and others' : '') + '.');
    }
  });
}

/* ================================================================== */
/* Dependent substage dropdowns                                        */
/* ================================================================== */

/** Rule used where no stage is selected (or a stage has no active substages). Warning-only so pastes still work. */
function noSubstageRule_(stage) {
  return SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied('=FALSE')
    .setAllowInvalid(true)
    .setHelpText(stage ? 'Stage "' + stage + '" has no active substages - leave blank.' : 'Select a Lead Stage first; the substage list depends on it.')
    .build();
}

function substageRuleFor_(stage, stageInfo, cache) {
  var key = str_(stage).toLowerCase();
  if (cache[key]) return cache[key];
  var subs = key ? stageInfo.activeSubs(stage) : [];
  var rule = subs.length
    ? SpreadsheetApp.newDataValidation().requireValueInList(subs, true).setAllowInvalid(false)
      .setHelpText('Substages of "' + stageInfo.canonicalStage(stage) + '" (from Stage Master).').build()
    : noSubstageRule_(stageInfo.canonicalStage(stage) || str_(stage));
  cache[key] = rule;
  return rule;
}

/** Applies per-row substage dropdowns for the given row indexes of a processed block. */
function applySubstageValidations_(sheet, startRow, data, idxList, stageInfo) {
  var min = Math.min.apply(null, idxList);
  var max = Math.max.apply(null, idxList);
  var cache = {};
  var rules = [];
  for (var i = min; i <= max; i++) rules.push([substageRuleFor_(data[i][LC.STAGE - 1], stageInfo, cache)]);
  sheet.getRange(startRow + min, LC.SUBSTAGE, rules.length, 1).setDataValidations(rules);
}

/** Rebuilds every row's substage dropdown from Stage Master in one batch call. */
function refreshAllSubstageValidations_() {
  clearMemo_('stageInfo');
  var sheet = getSheet_(SHEET.LEADS);
  var last = lastLeadRow_(sheet);
  if (last < 2) return 0;
  var stageInfo = getStageInfo_();
  var stages = sheet.getRange(2, LC.STAGE, last - 1, 1).getValues();
  var cache = {};
  var rules = stages.map(function (r) { return [substageRuleFor_(r[0], stageInfo, cache)]; });
  sheet.getRange(2, LC.SUBSTAGE, rules.length, 1).setDataValidations(rules);
  return rules.length;
}

/** Menu: Lead CRM > Refresh substage dropdowns. */
function refreshAllSubstageValidations() {
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var n = refreshAllSubstageValidations_();
    toast_('Substage dropdowns refreshed for ' + n + ' rows.');
  } finally {
    lock.releaseLock();
  }
}

/* ================================================================== */
/* Master sheets, log and dashboard edits                              */
/* ================================================================== */

function onStageMasterEdit_(e, sheet, range) {
  if (range.getLastRow() < 2) return;
  var last = sheet.getLastRow();
  if (last >= 2) {
    var vals = sheet.getRange(2, 1, last - 1, STAGE_HEADERS.length).getValues();
    var max = 0;
    vals.forEach(function (r) { var m = /^STG-(\d+)$/i.exec(str_(r[0])); if (m) max = Math.max(max, parseInt(m[1], 10)); });
    var idCol = [], activeCol = [], dirty = false;
    vals.forEach(function (r) {
      var hasStage = !!str_(r[SM.STAGE - 1]);
      if (hasStage && !str_(r[SM.ID - 1])) { r[SM.ID - 1] = 'STG-' + pad_(++max, 3); dirty = true; }
      if (hasStage && !str_(r[SM.ACTIVE - 1])) { r[SM.ACTIVE - 1] = ACTIVE; dirty = true; }
      idCol.push([r[SM.ID - 1]]);
      activeCol.push([r[SM.ACTIVE - 1]]);
    });
    if (dirty) {
      sheet.getRange(2, SM.ID, idCol.length, 1).setValues(idCol);
      sheet.getRange(2, SM.ACTIVE, activeCol.length, 1).setValues(activeCol);
    }
  }
  var c1 = range.getColumn(), c2 = range.getLastColumn();
  if (c2 < SM.STAGE || c1 > SM.ACTIVE) return;
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(20000)) { toast_('Busy - run Lead CRM > Refresh substage dropdowns in a moment.'); return; }
  try {
    var n = refreshAllSubstageValidations_();
    toast_('Stage Master changed: substage dropdowns refreshed for ' + n + ' lead rows.');
  } finally {
    lock.releaseLock();
  }
  try { refreshDashboardCharts_(); } catch (err) { /* charts resize later via Refresh Dashboard */ }
}

function onCounsellorMasterEdit_(e, sheet, range) {
  if (range.getLastRow() < 2) return;
  var last = sheet.getLastRow();
  var vals = sheet.getRange(2, 1, last - 1, COUNSELLOR_HEADERS.length).getValues();
  var max = 0;
  vals.forEach(function (r) { var m = /^CNS-(\d+)$/i.exec(str_(r[0])); if (m) max = Math.max(max, parseInt(m[1], 10)); });
  var dirty = false;
  var today = todayDate_();
  vals.forEach(function (r) {
    if (!str_(r[CM.NAME - 1])) return;
    if (!str_(r[CM.ID - 1])) { r[CM.ID - 1] = 'CNS-' + pad_(++max, 3); dirty = true; }
    if (!str_(r[CM.ACTIVE - 1])) { r[CM.ACTIVE - 1] = ACTIVE; dirty = true; }
    if (!r[CM.ADDED - 1]) { r[CM.ADDED - 1] = today; dirty = true; }
  });
  if (dirty) {
    sheet.getRange(2, CM.ID, vals.length, 1).setValues(vals.map(function (r) { return [r[CM.ID - 1]]; }));
    sheet.getRange(2, CM.ACTIVE, vals.length, 1).setValues(vals.map(function (r) { return [r[CM.ACTIVE - 1]]; }));
    sheet.getRange(2, CM.ADDED, vals.length, 1).setValues(vals.map(function (r) { return [r[CM.ADDED - 1]]; }));
  }
  try { refreshDashboardCharts_(); } catch (err) { /* ignore */ }
}

/** The log is append-only through the workflow: manual edits are recorded, not silently accepted. */
function onLogEdit_(e, sheet, range) {
  if (range.getLastRow() < 2) return;
  var single = range.getNumRows() === 1 && range.getNumColumns() === 1;
  var actor = getActor_(e);
  var leadId = single ? str_(sheet.getRange(range.getRow(), LG.LEAD_ID).getValue()) : '';
  var row = new Array(LEAD_COLS);
  for (var i = 0; i < LEAD_COLS; i++) row[i] = '';
  row[LC.ID - 1] = leadId;
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(15000)) return;
  try {
    appendLogRows_([buildLogEntry_({
      row: row, time: new Date(), type: ACT.LOG_EDITED, category: CATEGORY.SYSTEM, counsellor: 'System',
      updatedBy: actor.email || actor.label, field: 'Follow-Up Log ' + range.getA1Notation(),
      oldValue: single ? (e.oldValue === undefined ? '' : e.oldValue) : '(multi-cell edit)',
      newValue: single ? (e.value === undefined ? '' : e.value) : '(multi-cell edit)',
      remarks: 'Manual edit of the activity log'
    })]);
  } finally {
    lock.releaseLock();
  }
  toast_('Follow-Up Log is append-only. Your manual edit was recorded in the audit trail. Use Lead CRM > Log Follow-Up to add activities.', 10);
}

function onDashboardEdit_(e, sheet, range) {
  var r = range.getRow();
  if (r !== DASH.CONTROL_ROW) return;
  writeDashboardTimestamp_(sheet);
  var period = str_(sheet.getRange(DASH.PERIOD).getValue());
  if (period === 'Custom Date Range') {
    var f = sheet.getRange(DASH.CUSTOM_FROM).getValue();
    var t = sheet.getRange(DASH.CUSTOM_TO).getValue();
    if (!f || !t) toast_('Enter both Custom From and Custom To dates.');
    else if (f > t) toast_('Custom From date is after Custom To date.');
  }
}

/* ================================================================== */
/* Admin actions related to triggers                                   */
/* ================================================================== */

/** Admin > Process imported / pasted leads: assigns missing IDs/dates and rebuilds tracking for every row. */
function processAllLeads() {
  requireAdmin_();
  var sheet = getSheet_(SHEET.LEADS);
  var last = lastLeadRow_(sheet);
  if (last < 2) { toast_('No leads found.'); return; }
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  var total = { messages: [], logged: 0 };
  try {
    var actor = getActor_();
    for (var start = 2; start <= last; start += 2000) {
      var n = Math.min(2000, last - start + 1);
      var res = processLeadRows_(sheet, start, n, { c1: 1, c2: LEAD_COLS, single: false, actor: actor, source: 'bulk' });
      total.messages = total.messages.concat(res.messages);
      total.logged += res.logged;
    }
    refreshAllSubstageValidations_();
  } finally {
    lock.releaseLock();
  }
  var msg = 'Processed rows 2-' + last + '. Audit entries written: ' + total.logged + '.' +
    (total.messages.length ? '\n\nNotes:\n- ' + total.messages.slice(0, 15).join('\n- ') : '');
  alert_(msg);
}

function useInstallableEditTrigger() {
  requireAdmin_();
  var ss = ss_();
  var exists = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'onEditInstallable'; });
  if (!exists) ScriptApp.newTrigger('onEditInstallable').forSpreadsheet(ss).onEdit().create();
  PropertiesService.getDocumentProperties().setProperty(PROP.EDIT_MODE, 'installable');
  toast_('Edit tracking now uses the installable trigger (runs as you). Simple onEdit is idle.');
}

function useSimpleEditTrigger() {
  requireAdmin_();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onEditInstallable') ScriptApp.deleteTrigger(t);
  });
  PropertiesService.getDocumentProperties().setProperty(PROP.EDIT_MODE, 'simple');
  toast_('Edit tracking now uses the simple onEdit trigger (runs as each editor).');
}
