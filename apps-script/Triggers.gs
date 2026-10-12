/**
 * Triggers.gs
 * The edit guard for Lead Management, plus the other edit, change, open and time triggers.
 *
 * Counsellors are not expected to read or obey anything, so every edit is checked AFTER it happens and
 * anything that is not allowed is put back automatically:
 *  - system / formula columns: nobody may change them (Google protection never blocks the owner, so the
 *    guard restores the previous value, shows "This field is filled automatically" and logs the attempt);
 *  - contact / assignment columns: admins only (strict protection for counsellors; audited for admins);
 *  - counsellor-editable columns: only on the counsellor's own leads, and only valid values
 *    (wrong dates, junk, pasted text that is not in a dropdown list...);
 *  - rows without a Lead ID: nothing may be typed there (new leads come from Lead Entry).
 * The reference for "previous value" is the hidden Audit Snapshot column (AI), which holds the last
 * accepted value of every column. It works for typing, pasting, clearing, fill-down and undo.
 *
 * Two triggers fire for every edit:
 *  - onEdit(e) (simple, runs as the editor, starts fastest): the stage -> substage fast path, and it hands
 *    the editor's temporary user key to the installable trigger (identity for personal Google accounts);
 *  - onEditInstallable(e) (installable, created by setup, runs as the owner): the guard, audit trail,
 *    timestamps and data-quality flags. Running as the owner lets it write to locked columns.
 */

/* ================================================================== */
/* Entry points                                                        */
/* ================================================================== */

/** Simple trigger: stage-change fast path and identity hand-off only. */
function onEdit(e) {
  if (!e || !e.range) return;
  try {
    fastStageChange_(e);
  } catch (err) {
    console.warn('fastStageChange_: ' + (err && err.message ? err.message : err));
  }
  rememberEditor_(e);
}

/** Installable trigger (created by setup, runs as the owner). */
function onEditInstallable(e) {
  if (!e || !e.range) return;
  handleEdit_(e);
}

/**
 * The very first reaction to a Lead Stage change: clear Lead Substage and set the new stage's
 * dropdown for the edited row(s). Uses the cached stage map and the event values, so a single-cell
 * change costs two writes and no sheet reads. Checks and logging happen later in the installable trigger.
 */
function fastStageChange_(e) {
  var range = e.range;
  if (range.getColumn() !== LC.STAGE || range.getLastColumn() !== LC.STAGE) return false;
  var sheet = range.getSheet();
  if (sheet.getName() !== SHEET.LEADS) return false;
  var r1 = Math.max(range.getRow(), 2), r2 = range.getLastRow();
  if (r2 < r1) return false;
  var map = cachedSubstageMap_();
  var ruleCache = {};
  var ruleFor = function (stage) {
    var key = str_(stage).toLowerCase();
    if (!ruleCache[key]) {
      var s = map[key];
      ruleCache[key] = s && s.subs.length
        ? SpreadsheetApp.newDataValidation().requireValueInList(s.subs, true).setAllowInvalid(false)
          .setHelpText('Substages of "' + s.name + '".').build()
        : noSubstageRule_(s ? s.name : str_(stage));
    }
    return ruleCache[key];
  };

  if (r1 === r2 && range.getNumRows() === 1) {
    var newStage = e.value === undefined ? '' : e.value;
    if (e.oldValue !== undefined && same_(newStage, e.oldValue)) return false;
    var cell = sheet.getRange(r1, LC.SUBSTAGE);
    cell.clearContent();
    cell.setDataValidation(ruleFor(newStage));
    return true;
  }

  // Pasted / filled block: only rows whose stage actually changed (compared with the snapshot).
  var n = r2 - r1 + 1;
  var stages = sheet.getRange(r1, LC.STAGE, n, 1).getValues();
  var subs = sheet.getRange(r1, LC.SUBSTAGE, n, 1).getValues();
  var snaps = sheet.getRange(r1, LC.SNAPSHOT, n, 1).getValues();
  var rules = [], changed = false;
  for (var i = 0; i < n; i++) {
    var snap = parseSnapshot_(snaps[i][0]);
    if (snap && !same_(snap.s, stages[i][0])) { subs[i][0] = ''; changed = true; }
    rules.push([ruleFor(stages[i][0])]);
  }
  if (changed) sheet.getRange(r1, LC.SUBSTAGE, n, 1).setValues(subs);
  sheet.getRange(r1, LC.SUBSTAGE, n, 1).setDataValidations(rules);
  return changed;
}

/** Installable onOpen (created by setup): records who opened the master spreadsheet. */
function onOpenInstallable(e) {
  try {
    var email = e && e.user && e.user.getEmail ? e.user.getEmail() : '';
    if (!email) {
      // Same hand-off as for edits: the simple onOpen (runs as the opener) cached their temporary key.
      var cache = CacheService.getScriptCache();
      for (var i = 0; i < 8 && !email; i++) {
        var key = cache.get('OPK');
        if (key) email = PropertiesService.getScriptProperties().getProperty(PROP.USER_KEY_PREFIX + key) || '';
        if (!email) Utilities.sleep(250);
      }
    }
    logAccess_(email, ACCESS.SHEET_OPENED, '', '', 'Spreadsheet');
  } catch (err) { /* never block opening */ }
}

/** Hourly time trigger (created by setup): date rules, data-quality flags, dashboard. */
function scheduledMaintenance() {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(60000)) return;
  try {
    clearMemo_();
    processFollowUpQueue_();
    refreshDateValidations_(false);
    refreshDataQuality_();
  } finally {
    lock.releaseLock();
  }
  refreshDashboardData_();
}

/**
 * Installable onChange trigger created by setup.
 *  - Inserted / deleted / moved columns on Lead Management: empty inserted columns are removed; anything
 *    else pauses the CRM and tells admins to undo.
 *  - Rows deleted directly (not with Admin > Delete lead(s)) are recorded.
 *  - Sorting, inserting or deleting rows can leave per-row substage dropdowns out of step: rebuilt (throttled).
 */
function onChangeInstallable(e) {
  var type = e && e.changeType;
  if (['INSERT_COLUMN', 'REMOVE_COLUMN', 'OTHER', 'INSERT_ROW', 'REMOVE_ROW'].indexOf(type) < 0) return;
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(20000)) return;
  try {
    clearMemo_();
    var layout = checkLeadColumns_(true);
    if (!layout.ok) return;
    if (type === 'REMOVE_ROW') checkDeletedRows_();
    if (['OTHER', 'INSERT_ROW', 'REMOVE_ROW'].indexOf(type) >= 0) {
      var cache = CacheService.getDocumentCache();
      if (!cache.get(PROP.LAST_SUBSTAGE_REFRESH)) {
        cache.put(PROP.LAST_SUBSTAGE_REFRESH, '1', 30);
        refreshAllSubstageValidations_();
      }
    }
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
      case SHEET.ENTRY: onLeadEntryEdit_(e, sheet, range); break;
      case SHEET.STAGES: onStageMasterEdit_(e, sheet, range); break;
      case SHEET.SETTINGS: onSettingsEdit_(range); break;
      case SHEET.COUNSELLORS: onCounsellorMasterEdit_(e, sheet, range); break;
      case SHEET.LOG: onLogEdit_(e, sheet, range); break;
      case SHEET.DASHBOARD: onDashboardEdit_(e, sheet, range); break;
      default: break;
    }
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    toast_('Lead CRM could not check this change: ' + (err && err.message ? err.message : err), 10);
  }
}

/* ================================================================== */
/* Lead Management: the edit guard                                     */
/* ================================================================== */

function onLeadSheetEdit_(e, sheet, range) {
  var r1 = range.getRow(), r2 = range.getLastRow();
  var c1 = range.getColumn(), c2 = range.getLastColumn();
  if (r1 === 1) {
    onLeadHeaderEdit_(sheet, c1, c2);
    if (r2 === 1) return;
    r1 = 2;
  }
  if (c1 > LEAD_COLS) return;   // columns beyond AI are removed by setup / the column check
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(60000)) {
    toast_('Lead CRM is very busy. If your change looks wrong, do it again in a minute.', 10);
    return;
  }
  try {
    if (!checkLeadColumns_(false).ok) {
      toast_('Lead CRM is paused because columns of Lead Management were moved or deleted. An admin must undo that (Ctrl+Z) first.', 15);
      return;
    }
    processFollowUpQueue_();
    var single = range.getNumRows() === 1 && range.getNumColumns() === 1;
    var res = guardLeadRows_(sheet, r1, r2 - r1 + 1, c1, Math.min(c2, LEAD_COLS), getActor_(e), {
      note: single ? 'Edited in sheet' : 'Pasted / filled in sheet'
    });
    if (res.messages.length) {
      var extra = res.messages.length > 2 ? ' (+' + (res.messages.length - 2) + ' more)' : '';
      toast_(res.messages.slice(0, 2).join(' ') + extra, 12);
    }
  } finally {
    lock.releaseLock();
  }
}

/** Header row (admins / owner only: it is protected). Custom field names may be renamed; the rest is restored. */
function onLeadHeaderEdit_(sheet, c1, c2) {
  if (c2 >= LC.CUSTOM_FIRST && c1 <= LC.CUSTOM_LAST) onCustomHeaderEdit_(sheet, { getColumn: function () { return c1; }, getLastColumn: function () { return c2; } });
  var fixed = false;
  for (var c = Math.max(c1, 1); c <= Math.min(c2, LEAD_COLS); c++) {
    if (isCustomCol_(c)) continue;
    fixed = true;
  }
  if (fixed) {
    restoreLeadHeaders_(sheet);
    toast_('Column names in Lead Management are fixed. The original name was put back.');
  }
}

/**
 * Checks (and repairs) one block of Lead Management rows after an edit. Caller holds the document lock.
 * actor: from getActor_ ({email, label, admin, counsellor}). opts: {note}
 * Returns {messages, reverted}.
 */
function guardLeadRows_(sheet, startRow, n, c1, c2, actor, opts) {
  opts = opts || {};
  var env = validationEnv_();
  var settings = env.settings;
  var now = new Date();
  var data = sheet.getRange(startRow, 1, n, LEAD_COLS).getValues();
  var formulas = sheet.getRange(startRow, c1, n, c2 - c1 + 1).getFormulas();
  var cols = [];
  for (var c = c1; c <= c2; c++) cols.push(c);
  if (c1 <= LC.STAGE && c2 >= LC.STAGE && cols.indexOf(LC.SUBSTAGE) < 0) cols.push(LC.SUBSTAGE);   // fast path may have cleared it

  var changed = {};
  var mark = function (i, col) {
    var x = changed[col];
    if (!x) changed[col] = [i, i];
    else { if (i < x[0]) x[0] = i; if (i > x[1]) x[1] = i; }
  };
  var out = { messages: [], reverted: 0 };
  var say = function (m) { if (out.messages.indexOf(m) < 0) out.messages.push(m); };
  var entries = [], revertEntries = 0;
  var emptyRows = [], leadIdx = [];
  var unknown = !actor.email;
  var blockUnknown = unknown && settings.blockUnknown;
  var notAllowed = !!actor.email && !actor.admin && !actor.counsellor;
  var corr = correctionWindow_();
  var canCorrect = !!corr && actor.admin;
  var by = actor.email || actor.label;

  var logRevert = function (row, col, kept, attempted, reason) {
    out.reverted++;
    if (revertEntries++ >= 50) return;
    entries.push(buildLogEntry_({
      row: row, time: now, type: ACT.EDIT_REVERTED, category: CATEGORY.SYSTEM, counsellor: 'System', updatedBy: by,
      field: leadLabel_(col), oldValue: kept, newValue: attempted, remarks: reason
    }));
  };

  for (var i = 0; i < n; i++) {
    var row = data[i];
    var r = startRow + i;
    var snap = parseSnapshot_(row[LC.SNAPSHOT - 1]);

    // ---- rows that are not leads: nothing may be typed there ----
    if (!snap) {
      if (str_(row[LC.ID - 1]) && row[LC.CREATED - 1]) {
        // A lead from before this version (or whose snapshot was pasted over): accept it as it is now.
        row[LC.SNAPSHOT - 1] = buildSnapshot_(row);
        mark(i, LC.SNAPSHOT);
        leadIdx.push(i);
        continue;
      }
      var typed = false;
      cols.forEach(function (col) {
        if (isSystemCol_(col) && LEAD_FORMULA_COLS.indexOf(col) >= 0) return;
        if (cellKey_(row[col - 1]) !== '' || (formulas[i][col - c1] || '')) { typed = true; row[col - 1] = ''; mark(i, col); }
      });
      if (typed) emptyRows.push(r);
      continue;
    }
    leadIdx.push(i);
    if (!snap.v) snap = upgradeSnapshot_(snap, row);

    var old = function (col) { return snapValue_(snap, col); };
    var edited = cols.filter(function (col) {
      if (LEAD_FORMULA_COLS.indexOf(col) >= 0 || col === LC.DQ_FLAGS || col === LC.SNAPSHOT) return false;
      return cellKey_(row[col - 1]) !== cellKey_(old(col)) || !!(col <= c2 && col >= c1 && formulas[i][col - c1]);
    });
    if (!edited.length) continue;

    var leadId = str_(old(LC.ID)) || str_(row[LC.ID - 1]);
    var owner = str_(old(LC.OWNER));
    var revert = function (col, reason) {
      var attempted = formulas[i][col - c1] || row[col - 1];
      row[col - 1] = old(col);
      mark(i, col);
      logRevert(row, col, old(col), attempted, reason);
    };

    // ---- who may change what ----
    if (blockUnknown || notAllowed) {
      edited.forEach(function (col) { revert(col, blockUnknown ? 'Editor not identified' : 'Not a counsellor or admin'); });
      say(blockUnknown
        ? 'Your change was undone because Lead CRM does not know who you are yet. Click Lead CRM > My overdue follow-ups once, then try again.'
        : 'Your change was undone: your Google account is not an active counsellor or admin in this CRM.');
      continue;
    }
    var accepted = [];
    edited.forEach(function (col) {
      var label = leadLabel_(col);
      if (col <= c2 && col >= c1 && formulas[i][col - c1]) { revert(col, 'Formula typed'); say('Formulas are not allowed in ' + label + '. Your entry was undone.'); return; }
      if (isSystemCol_(col)) {
        if (canCorrect && col !== LC.ID) { accepted.push(col); return; }
        revert(col, 'System column');
        say('"' + label + '" is filled automatically. Your change was undone.');
        return;
      }
      if (!isEditableCol_(col) && !actor.admin) { revert(col, 'Admin-only column'); say('Only an admin can change ' + label + '. Your change was undone.'); return; }
      if (!actor.admin && actor.counsellor && !same_(owner, actor.counsellor)) {
        revert(col, 'Lead assigned to ' + (owner || 'nobody'));
        say('Lead ' + leadId + ' is assigned to ' + (owner || 'nobody') + '. You can only change your own leads.');
        return;
      }
      accepted.push(col);
    });

    // ---- values: stage first (other rules depend on it), then status, substage, follow-up date, the rest ----
    var orderOf = function (col) { var k = [LC.STAGE, LC.STATUS, LC.SUBSTAGE, LC.NEXT_FU].indexOf(col); return k < 0 ? 10 : k; };
    accepted.sort(function (a, b) { return orderOf(a) - orderOf(b) || a - b; });
    var kept = [];
    accepted.forEach(function (col) {
      if (isSystemCol_(col)) { kept.push(col); return; }   // correction window (admin)
      var raw = row[col - 1];
      var res = checkLeadValue_(col, raw, old(col), row, env);
      if (!res.ok) { revert(col, res.msg); say(res.msg + ' Your entry was undone.'); return; }
      if (cellKey_(res.value) !== cellKey_(raw)) mark(i, col);   // cleaned value (trimmed, canonical case, date only)
      row[col - 1] = res.value;
      if (cellKey_(res.value) !== cellKey_(old(col))) kept.push(col);
    });
    if (!kept.length) continue;

    // ---- duplicates (admins changing mobile / email) ----
    [[LC.MOBILE, settings.dupMobile, 'mobile number'], [LC.EMAIL, settings.dupEmail, 'email ID']].forEach(function (d) {
      if (kept.indexOf(d[0]) < 0 || same_(d[1], 'Off') || !str_(row[d[0] - 1])) return;
      var others = findDuplicateLeads_(d[0], row[d[0] - 1], leadId);
      if (!others.length) return;
      if (same_(d[1], 'Block')) {
        kept.splice(kept.indexOf(d[0]), 1);
        revert(d[0], 'Duplicate ' + d[2]);
        say('This ' + d[2] + ' already belongs to ' + others.slice(0, 3).join(', ') + '. Your change was undone.');
      } else {
        say('Note: this ' + d[2] + ' is also used by ' + others.slice(0, 3).join(', ') + '.');
      }
    });
    if (!kept.length) continue;

    var fin = finishLeadChange_(row, snap, kept, actor, env, now, opts.note || 'Edited in sheet', corr);
    fin.cols.forEach(function (col) { mark(i, col); });
    entries = entries.concat(fin.entries);
    fin.messages.forEach(say);
    mark(i, LC.SNAPSHOT);
  }

  if (emptyRows.length) {
    say('New leads can only be added by an admin in the Lead Entry sheet. What you typed in row ' +
      (emptyRows.length > 1 ? emptyRows[0] + '-' + emptyRows[emptyRows.length - 1] : emptyRows[0]) + ' was removed.');
    var blank = new Array(LEAD_COLS);
    for (var b = 0; b < LEAD_COLS; b++) blank[b] = '';
    entries.push(buildLogEntry_({
      row: blank, time: now, type: ACT.EDIT_REVERTED, category: CATEGORY.SYSTEM, counsellor: 'System', updatedBy: by,
      field: 'Row(s) without Lead ID: ' + emptyRows.slice(0, 20).join(', ') + (emptyRows.length > 20 ? ' ...' : ''),
      remarks: 'Typing in empty rows of Lead Management is not allowed'
    }));
    out.reverted += emptyRows.length;
  }

  if (c2 >= LC.SNAPSHOT && leadIdx.length) {
    // The hidden Audit Snapshot column was pasted over: the reference values of these rows are gone.
    say('You pasted over the hidden Audit Snapshot column (AI). Press Ctrl+Z (Undo) now, then paste only into the visible columns.');
    var blankRow = new Array(LEAD_COLS);
    for (var q = 0; q < LEAD_COLS; q++) blankRow[q] = '';
    entries.push(buildLogEntry_({
      row: blankRow, time: now, type: ACT.EDIT_REVERTED, category: CATEGORY.SYSTEM, counsellor: 'System', updatedBy: by,
      field: 'Audit Snapshot rows ' + startRow + '-' + (startRow + n - 1), remarks: 'Hidden column AI was pasted over; ask the editor to undo'
    }));
  }
  writeChangedColumns_(sheet, startRow, data, changed);
  LEAD_FORMULA_COLS.forEach(function (fc) { if (fc >= c1 && fc <= c2) sheet.getRange(startRow, fc, n, 1).clearContent(); });
  restoreLeadValidations_(sheet, startRow, n, c1, c2, data);
  if (leadIdx.length) writeDqFlagsForBlock_(sheet, startRow, data, leadIdx);
  if (entries.length) appendLogRows_(entries);
  return out;
}

/**
 * After accepted changes to a lead row (sheet edit or web app): required-field bookkeeping, counting
 * outcome changes as follow-ups once the lead is complete, automatic dependent changes, audit entries,
 * Last Updated By / Last Activity and the new snapshot. Mutates `row`. Returns {entries, messages, cols}.
 * kept = columns whose new value was accepted; corr = open correction window (or null).
 */
function finishLeadChange_(row, snap, kept, actor, env, now, note, corr) {
  var settings = env.settings;
  var by = actor.email || actor.label;
  var out = { entries: [], messages: [], cols: [] };
  var touch = function (col) { if (out.cols.indexOf(col) < 0) out.cols.push(col); };
  var old = function (col) { return snapValue_(snap, col); };
  var owner = str_(old(LC.OWNER));

  // ---- required fields created by this change ----
  var pending = snap.p.slice(), contacts = snap.pc.slice();
  var nfKey = toDateKey_(row[LC.NEXT_FU - 1]);
  var nfChanged = kept.indexOf(LC.NEXT_FU) >= 0 && !!nfKey;
  if (nfChanged) pending = pending.filter(function (x) { return x !== REQ_NEXT_FU; });
  if ((kept.indexOf(LC.STAGE) >= 0 || kept.indexOf(LC.OUTCOME) >= 0) && !nfChanged &&
      (!nfKey || nfKey <= env.today) && pending.indexOf(REQ_NEXT_FU) < 0) pending.push(REQ_NEXT_FU);
  if (kept.indexOf(LC.OUTCOME) >= 0 && str_(row[LC.OUTCOME - 1])) {
    contacts.push({ o: str_(row[LC.OUTCOME - 1]), t: now.getTime(), c: actor.counsellor || owner || actor.label, e: by });
  }

  // ---- audit trail and dependent automatic changes ----
  var tracked = { o: owner, s: str_(old(LC.STAGE)), ss: str_(old(LC.SUBSTAGE)), st: str_(old(LC.STATUS)), n: toDateKey_(old(LC.NEXT_FU)) };
  var res = trackLeadChanges_(row, tracked, {
    actor: actor, now: now, stageInfo: env.stageInfo, settings: settings,
    statusExplicit: kept.indexOf(LC.STATUS) >= 0, logNextFu: true, note: note
  });
  res.cols.forEach(touch);
  out.entries = out.entries.concat(res.entries);
  out.messages = out.messages.concat(res.messages);
  kept.forEach(function (col) {
    if (trackedKeyForCol_(col)) return;
    out.entries.push(buildLogEntry_({
      row: row, time: now, type: isSystemCol_(col) ? ACT.SYS_CORRECTED : ACT.FIELD_UPDATED, category: CATEGORY.RECORD,
      counsellor: actor.label, updatedBy: by, field: leadLabel_(col), oldValue: old(col), newValue: row[col - 1],
      remarks: isSystemCol_(col) ? 'Admin correction (window opened by ' + (corr ? corr.by : '?') + ')' : note
    }));
  });
  if (isClosedStatus_(row[LC.STATUS - 1])) pending = pending.filter(function (x) { return x !== REQ_NEXT_FU; });
  if (pending.length) out.messages.push('Lead ' + str_(row[LC.ID - 1]) + ' is incomplete: choose a new ' + pending.join(', ') + '.');

  // ---- outcome changes count as follow-ups once the lead is complete ----
  if (contacts.length && !incompleteFields_(row, pending, env).length) {
    contacts.forEach(function (pc) {
      var t = new Date(pc.t);
      out.entries.push(buildLogEntry_({
        row: row, time: t, type: ACT.SHEET_UPDATE, category: CATEGORY.CONTACT, counsellor: pc.c, updatedBy: pc.e,
        outcome: pc.o, nextFu: row[LC.NEXT_FU - 1], remarks: 'Outcome changed in the sheet'
      }));
      var tk = toDateKey_(t);
      [LC.LAST_CONTACT, LC.LAST_FU_DATE].forEach(function (col) {
        if (!isDate_(row[col - 1]) || toDateKey_(row[col - 1]) < tk) { row[col - 1] = dateFromKey_(tk); touch(col); }
      });
    });
    contacts = [];
  }

  if (kept.some(function (col) { return !isSystemCol_(col); })) {
    row[LC.UPDATED_BY - 1] = actor.label;
    row[LC.LAST_ACTIVITY - 1] = now;
    touch(LC.UPDATED_BY);
    touch(LC.LAST_ACTIVITY);
  }
  row[LC.SNAPSHOT - 1] = buildSnapshot_(row, { p: pending, pc: contacts });
  touch(LC.SNAPSHOT);
  return out;
}

/** v1 snapshot (tracked fields only): use today's row as the reference, with the tracked fields from the snapshot. */
function upgradeSnapshot_(snap, row) {
  var base = row.slice();
  base[LC.OWNER - 1] = snap.o; base[LC.STAGE - 1] = snap.s; base[LC.SUBSTAGE - 1] = snap.ss; base[LC.STATUS - 1] = snap.st;
  base[LC.NEXT_FU - 1] = snap.n ? dateFromKey_(snap.n) : '';
  var full = parseSnapshot_(buildSnapshot_(base, { p: snap.p, pc: snap.pc }));
  return full;
}

/** Lead IDs (other than exceptId) whose mobile (last 10 digits) or email equals the value. */
function findDuplicateLeads_(col, value, exceptId) {
  var sheet = getSheet_(SHEET.LEADS);
  var last = lastLeadRow_(sheet);
  if (last < 2) return [];
  var key = col === LC.MOBILE ? mobileKey_(value) : str_(value).toLowerCase();
  var vals = sheet.getRange(2, 1, last - 1, Math.max(col, LC.ID)).getValues();
  var out = [];
  vals.forEach(function (r) {
    var id = str_(r[LC.ID - 1]);
    if (!id || same_(id, exceptId)) return;
    var v = col === LC.MOBILE ? mobileKey_(r[col - 1]) : str_(r[col - 1]).toLowerCase();
    if (v && v === key) out.push(id);
  });
  return out;
}

/** Re-applies the column rules on an edited block (a normal paste replaces the target's dropdowns). */
function restoreLeadValidations_(sheet, startRow, n, c1, c2, data) {
  for (var c = c1; c <= c2; c++) {
    if (c === LC.SUBSTAGE) continue;
    var rule = leadColumnRule_(c);
    sheet.getRange(startRow, c, n, 1).setDataValidation(rule);
  }
  if (c1 <= LC.SUBSTAGE && c2 >= LC.STAGE || (c1 <= LC.SUBSTAGE && c2 >= LC.SUBSTAGE)) {
    var stageInfo = getStageInfo_();
    var cache = {};
    var rules = data.map(function (row) {
      return [str_(row[LC.ID - 1]) ? substageRuleFor_(row[LC.STAGE - 1], stageInfo, cache) : null];
    });
    sheet.getRange(startRow, LC.SUBSTAGE, n, 1).setDataValidations(rules);
  }
}

/* ================================================================== */
/* Column layout check (inserted / deleted / moved columns)            */
/* ================================================================== */

/** Header text expected in each Lead Management column. */
function expectedLeadHeaders_() {
  var h = LEAD_HEADERS.slice();
  try { readCustomFields_().forEach(function (f) { h[customCol_(f.slot) - 1] = f.name || defaultCustomName_(f.slot); }); } catch (e) { /* ignore */ }
  return h;
}

/**
 * Compares row 1 with the expected layout. With repair=true, empty columns that were inserted (and empty
 * extra columns at the right) are deleted. Returns {ok}. A layout that cannot be repaired is reported once.
 */
function checkLeadColumns_(repair) {
  var sh = ss_().getSheetByName(SHEET.LEADS);
  if (!sh) return { ok: true };
  var maxC = sh.getMaxColumns();
  var head = sh.getRange(1, 1, 1, maxC).getValues()[0];
  var exp = expectedLeadHeaders_();
  var match = function (i, j) { return same_(head[i - 1], exp[j - 1]); };
  var perfect = maxC === LEAD_COLS;
  for (var k = 1; perfect && k <= LEAD_COLS; k++) if (!match(k, k)) perfect = false;
  if (perfect) { PropertiesService.getDocumentProperties().deleteProperty('LAYOUT_BROKEN'); return { ok: true }; }
  if (!repair) {
    // Cheap check during edits: only the first LEAD_COLS columns must match.
    for (var q = 1; q <= LEAD_COLS; q++) if (!match(q, q)) return { ok: false };
    return { ok: true };
  }
  var del = [], i = 1, j = 1;
  var lastRow = Math.max(sh.getLastRow(), 1);
  var emptyCol = function (c) {
    if (str_(head[c - 1])) return false;
    return !sh.getRange(1, c, lastRow, 1).getValues().some(function (x) { return str_(x[0]) !== ''; });
  };
  while (i <= maxC) {
    if (j <= LEAD_COLS && match(i, j)) { i++; j++; continue; }
    if (emptyCol(i)) { del.push(i); i++; continue; }
    break;
  }
  var props = PropertiesService.getDocumentProperties();
  if (j > LEAD_COLS && i > maxC) {
    del.sort(function (a, b) { return b - a; }).forEach(function (c) { sh.deleteColumn(c); });
    props.deleteProperty('LAYOUT_BROKEN');
    if (del.length) toast_('Lead Management: ' + del.length + ' empty column(s) that were added were removed. Columns cannot be added here.', 10);
    return { ok: true };
  }
  if (!props.getProperty('LAYOUT_BROKEN')) {
    props.setProperty('LAYOUT_BROKEN', '1');
    var blank = new Array(LEAD_COLS);
    for (var b = 0; b < LEAD_COLS; b++) blank[b] = '';
    appendLogRows_([buildLogEntry_({
      row: blank, time: new Date(), type: ACT.EDIT_REVERTED, category: CATEGORY.SYSTEM, counsellor: 'System',
      updatedBy: 'System', field: 'Lead Management columns', newValue: 'Column ' + colLetter_(i) + ' is "' + str_(head[i - 1]) + '", expected "' + (exp[j - 1] || '') + '"',
      remarks: 'Columns were moved or deleted. The CRM is paused until an admin undoes it.'
    })]);
  }
  toast_('Columns of Lead Management were moved or deleted. Admin: press Ctrl+Z (Undo) now. Lead CRM is paused until the columns are back.', 20);
  return { ok: false };
}

/** Rows deleted directly in Lead Management (not with Admin > Delete lead(s)) are recorded. */
function checkDeletedRows_() {
  var props = PropertiesService.getDocumentProperties();
  var before = parseInt(props.getProperty('LEAD_COUNT'), 10);
  var now = countLeads_();
  props.setProperty('LEAD_COUNT', String(now));
  if (isNaN(before) || now >= before) return;
  var blank = new Array(LEAD_COLS);
  for (var b = 0; b < LEAD_COLS; b++) blank[b] = '';
  appendLogRows_([buildLogEntry_({
    row: blank, time: new Date(), type: ACT.EDIT_REVERTED, category: CATEGORY.SYSTEM, counsellor: 'System', updatedBy: 'System',
    field: 'Lead Management rows', oldValue: before + ' leads', newValue: now + ' leads',
    remarks: 'Rows were deleted directly instead of with Admin > Delete lead(s). Use Undo (Ctrl+Z) to bring them back.'
  })]);
  toast_((before - now) + ' lead row(s) were deleted directly. Use Undo (Ctrl+Z), then Lead CRM > Admin > Delete lead(s) instead.', 15);
}

function countLeads_() {
  var sh = getSheet_(SHEET.LEADS);
  var last = lastLeadRow_(sh);
  if (last < 2) return 0;
  return sh.getRange(2, LC.ID, last - 1, 1).getValues().filter(function (r) { return str_(r[0]) !== ''; }).length;
}

function rememberLeadCount_() {
  try { PropertiesService.getDocumentProperties().setProperty('LEAD_COUNT', String(countLeads_())); } catch (e) { /* ignore */ }
}

/* ================================================================== */
/* IDs, new leads, change tracking                                     */
/* ================================================================== */

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
  row[LC.SNAPSHOT - 1] = buildSnapshot_(row);

  var summary = 'Owner: ' + (t.o || '-') + '; Stage: ' + (t.s || '-') + (t.ss ? ' / ' + t.ss : '') +
    '; Status: ' + (t.st || '-') + (t.n ? '; Next follow-up: ' + t.n : '');
  var entry = buildLogEntry_({
    row: row, time: now, type: ACT.LEAD_CREATED, category: CATEGORY.SYSTEM, counsellor: 'System',
    updatedBy: actor.email || actor.label, field: 'Lead', newValue: summary, remarks: 'New lead entered'
  });
  return { cols: cols, entries: [entry], messages: messages };
}

/**
 * Status implied by the stage ('' = no change): moving to the Converted / Lost stage sets Converted / Lost;
 * moving a Converted / Lost lead to any other stage sets the default status (Status must match the stage).
 */
function statusForStage_(stage, currentStatus, settings) {
  if (!settings.autoSync || !str_(stage)) return '';
  var target = '';
  if (settings.convertedStage && same_(stage, settings.convertedStage)) target = STATUS.CONVERTED;
  else if (settings.lostStage && same_(stage, settings.lostStage)) target = STATUS.LOST;
  else if ((settings.convertedStage && same_(currentStatus, STATUS.CONVERTED)) ||
           (settings.lostStage && same_(currentStatus, STATUS.LOST))) target = settings.defaultStatus || STATUS.OPEN;
  if (!target || same_(currentStatus, target) || same_(currentStatus, STATUS.DUPLICATE)) return '';
  return target;
}

/**
 * Compares a lead row with its previous snapshot, applies the dependent rules and builds audit
 * entries. Mutates `row`. Shared by the edit guard, the follow-up form and the web app.
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
    if (out.stageChanged && !cur.ss && snap.ss) {
      // Cleared by the fast onEdit path (or the form) because the stage changed.
      audit(ACT.SUBSTAGE_CLEARED, CATEGORY.SYSTEM, 'Lead Substage', snap.ss, '',
        'Substage cleared because the stage changed to "' + (cur.s || '(no stage)') + '"');
    } else {
      audit(ACT.STAGE_UPDATED, CATEGORY.RECORD, 'Lead Substage', snap.ss, cur.ss);
    }
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
  if (cur.n !== snap.n && ctx.logNextFu) audit(ACT.FU_SCHEDULED, CATEGORY.RECORD, 'Next Follow-Up Date', snap.n, cur.n);
  // The caller writes the snapshot (buildSnapshot_) after all changes to the row are known.
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

/* ================================================================== */
/* Dependent substage dropdowns                                        */
/* ================================================================== */

/** Rule used where no stage is selected (or a stage has no active substages): nothing may be entered. */
function noSubstageRule_(stage) {
  return SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied('=FALSE')
    .setAllowInvalid(false)
    .setHelpText(stage ? 'Stage "' + stage + '" has no substages. Leave this empty.' : 'Choose a Lead Stage first.')
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
  clearSubstageMapCache_();
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
  clearSubstageMapCache_();
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
  var period = str_(sheet.getRange(DASH.PERIOD).getValue());
  if (period === 'Custom Date Range') {
    var f = sheet.getRange(DASH.CUSTOM_FROM).getValue();
    var t = sheet.getRange(DASH.CUSTOM_TO).getValue();
    if (!f || !t) { toast_('Enter both Custom From and Custom To dates.'); return; }
    if (f > t) toast_('Custom From date is after Custom To date.');
  }
  toast_('Updating dashboard...', 5);
  refreshDashboardData_();
}

/** Lists & Settings edits: custom-field table, Counsellor-Editable Fields, setting values. */
function onSettingsEdit_(range) {
  clearMemo_();
  if (onCustomFieldTableEdit_(range)) return;
  var c1 = range.getColumn(), c2 = range.getLastColumn();
  if (range.getLastRow() < 2) return;
  if (c1 <= LS.EDITABLE && c2 >= LS.EDITABLE) {
    applyLockedColumns_();
    toast_('Counsellors can now edit: ' + editableCols_().map(function (c) { return leadLabel_(c); }).join(', ') + '. Everything else is grey and locked.', 12);
    return;
  }
  if (c1 <= LS.SET_VALUE && c2 >= LS.SET_VALUE) {
    applyLeadSheetRules_(getSheet_(SHEET.LEADS));
    refreshDateValidations_(true);
    setupLeadEntryRules_();
  }
}

/* ================================================================== */
/* Admin actions related to triggers                                   */
/* ================================================================== */

/**
 * Admin > Re-check all lead rows: runs the edit guard over every row (as the admin running it). Use after
 * the CRM was busy, after an Undo of a column change, or after an import made by another tool.
 */
function recheckAllLeads() {
  var email = requireAdmin_();
  var sheet = getSheet_(SHEET.LEADS);
  var last = Math.max(lastLeadRow_(sheet), 2);
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  var total = { messages: [], reverted: 0 };
  try {
    var actor = getActor_();
    if (!actor.email) actor = { email: email, name: '', label: email, admin: true, counsellor: '' };
    for (var start = 2; start <= last; start += 2000) {
      var n = Math.min(2000, last - start + 1);
      var res = guardLeadRows_(sheet, start, n, 1, LEAD_COLS, actor, { note: 'Admin > Re-check all lead rows' });
      total.messages = total.messages.concat(res.messages);
      total.reverted += res.reverted;
    }
    refreshAllSubstageValidations_();
    updateLeadProtection_();
    rememberLeadCount_();
  } finally {
    lock.releaseLock();
  }
  notify_('Checked rows 2-' + last + '. Values put back: ' + total.reverted + '.' +
    (total.messages.length ? '\n\n- ' + total.messages.slice(0, 12).join('\n- ') : ''));
}
