/**
 * Reset.gs
 * Admin > Reset CRM to fresh start: for going live after testing. Deletes every lead, Lead Entry row,
 * Follow-Up Log, Access Log and Deleted Leads entry, and resets the Lead / Activity ID counters, so the
 * next lead is LD-000001 and the next activity ACT-000001.
 *
 * KEPT: Stage Master, Counsellor Master, Lists & Settings (lists, settings, Admin Emails, custom fields,
 * Counsellor-Editable Fields, ageing buckets), custom column names / visibility, every format, validation
 * rule, protection, hidden sheet and trigger, Start Here, Field Guide, web-app settings and the registered
 * user identities (Script Properties UK_...).
 *
 * Safety: admin-only (server-side), a summary and the word RESET before anything is deleted, and a backup
 * of every cleared sheet in a new hidden admin-only sheet "Backup <date time>" first. Admin > Restore from
 * reset backup puts the data back while the CRM is still empty.
 *
 * Why a backup sheet and not a copy of the whole file: copying the file needs the Google Drive
 * permission, which this script does not have (it may only touch this spreadsheet). File > Version history
 * is the built-in alternative and also works.
 *
 * Runs in steps with saved progress (like setup), so 10,000 leads and large logs fit the 6-minute limit:
 * running the menu item again continues an unfinished reset.
 */

var RESET_STATE_KEY = 'RESET_STATE';
var RESET_BUDGET_MS = 270000;
var RESET_CHUNK = 5000;
var BACKUP_PREFIX = 'Backup ';
var BACKUP_MARK = '### BACKUP OF';
/** Sheets cleared by the reset, in backup order. */
var RESET_SHEETS = [SHEET.LEADS, SHEET.ENTRY, SHEET.LOG, SHEET.ACCESS_LOG, SHEET.DELETED];

function resetWidth_(name) {
  return { 'Lead Management': LEAD_COLS, 'Lead Entry': LE_COLS, 'Follow-Up Log': LOG_COLS, 'Access Log': AL_HEADERS.length, 'Deleted Leads': DL_COLS }[name];
}

/** Last row holding data on a cleared sheet (Lead Management: ignores formula spill columns). */
function resetLastRow_(sh) {
  return sh.getName() === SHEET.LEADS ? lastLeadRow_(sh) : sh.getLastRow();
}

function backupSheets_() {
  return ss_().getSheets().filter(function (s) { return s.getName().indexOf(BACKUP_PREFIX) === 0; });
}

function resetCounts_() {
  var ss = ss_();
  var rows = function (n) { var s = ss.getSheetByName(n); return s ? Math.max(resetLastRow_(s) - 1, 0) : 0; };
  return { leads: countLeads_(), log: rows(SHEET.LOG), entry: rows(SHEET.ENTRY), access: rows(SHEET.ACCESS_LOG), deleted: rows(SHEET.DELETED) };
}

/* ================================================================== */
/* Menu: Admin > Reset CRM to fresh start                              */
/* ================================================================== */

function resetCrmToFreshStart() {
  var email = requireAdmin_();
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getDocumentProperties();
  var state = null;
  try { state = JSON.parse(props.getProperty(RESET_STATE_KEY) || 'null'); } catch (e) { state = null; }
  if (state) {
    var go = ui.alert(CRM_TITLE, 'A reset started by ' + state.by + ' is not finished yet (step ' + (state.i + 1) + ' of ' + state.tasks.length +
      ').\n\nContinue it now?', ui.ButtonSet.YES_NO);
    if (go !== ui.Button.YES) return;
    runReset_(state);
    return;
  }
  var c = resetCounts_();
  var r = ui.prompt(CRM_TITLE, 'This will delete ' + c.leads + ' leads and ' + c.log + ' log entries' +
    ' (also ' + c.entry + ' Lead Entry rows, ' + c.access + ' Access Log rows and ' + c.deleted + ' deleted leads).\n' +
    'Stages, counsellors and settings are kept. The next lead will be LD-000001.\n\n' +
    'A backup of everything deleted is saved first in a hidden sheet "Backup <date time>".\n\n' +
    'Type RESET to confirm:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK || str_(r.getResponseText()) !== 'RESET') {
    ui.alert(CRM_TITLE, 'Not confirmed. Nothing was deleted.', ui.ButtonSet.OK);
    return;
  }
  var tasks = [];
  RESET_SHEETS.forEach(function (n) { if (ss_().getSheetByName(n)) tasks.push({ t: 'backup', s: n, r: 2 }); });
  tasks.push({ t: 'clear' }, { t: 'finish' });
  state = {
    by: email, started: new Date().toISOString(), counts: c, i: 0, tasks: tasks,
    backup: BACKUP_PREFIX + Utilities.formatDate(new Date(), sheetTz_(), 'yyyy-MM-dd HH:mm:ss')
  };
  for (var k = 2; ss_().getSheetByName(state.backup); k++) state.backup = state.backup.replace(/ \(\d+\)$/, '') + ' (' + k + ')';
  props.setProperty(RESET_STATE_KEY, JSON.stringify(state));
  runReset_(state);
}

/** Runs the remaining reset steps until done or the time budget is used (progress saved after each step). */
function runReset_(state) {
  var t0 = Date.now();
  var props = PropertiesService.getDocumentProperties();
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  var ran = false;
  try {
    while (state.i < state.tasks.length) {
      if (ran && Date.now() - t0 > RESET_BUDGET_MS) break;
      var task = state.tasks[state.i];
      clearMemo_();
      if (task.t === 'backup') { if (resetBackupChunk_(state, task)) state.i++; }
      else if (task.t === 'clear') { resetClearSheets_(); state.i++; }
      else { resetFinish_(state); state.i++; }
      ran = true;
      if (state.i < state.tasks.length) props.setProperty(RESET_STATE_KEY, JSON.stringify(state));
    }
  } finally {
    lock.releaseLock();
  }
  if (state.i < state.tasks.length) {
    notify_('The reset is NOT finished yet (step ' + (state.i + 1) + ' of ' + state.tasks.length + ').\n\n' +
      'Run Lead CRM > Admin > Reset CRM to fresh start again to continue. Nothing is lost: the backup sheet "' + state.backup + '" is being filled first.');
    return false;
  }
  props.deleteProperty(RESET_STATE_KEY);
  var lines = healthCheckLines_();
  var problems = lines.filter(function (l) { return /^CHECK/.test(l); });
  notify_((problems.length ? 'CRM reset finished, but the health check found something to look at.' : 'CRM is ready to use.') + '\n\n' +
    'Deleted: ' + state.counts.leads + ' leads, ' + state.counts.log + ' log entries, ' + state.counts.entry + ' Lead Entry rows, ' +
    state.counts.access + ' Access Log rows, ' + state.counts.deleted + ' deleted leads. The next lead is LD-000001.\n\n' +
    'Backup: hidden sheet "' + state.backup + '".\n' +
    ' - To undo the reset (only while the CRM is still empty): Lead CRM > Admin > Restore from reset backup.\n' +
    ' - To delete the backup: Admin > Show admin sheets, right-click the "' + state.backup + '" tab > Delete.\n\n' +
    (problems.length ? problems.join('\n') : 'Health check: all OK.'));
  return true;
}

/** Copies the next chunk of a sheet into the backup sheet. Returns true when the sheet is fully copied. */
function resetBackupChunk_(state, task) {
  var ss = ss_();
  var src = ss.getSheetByName(task.s);
  var width = resetWidth_(task.s);
  var last = resetLastRow_(src);
  var bk = ss.getSheetByName(state.backup);
  if (!bk) {
    bk = ss.insertSheet(state.backup);
    bk.hideSheet();
    var p = bk.protect().setDescription('CRM: Reset backup (admins)').setWarningOnly(false);
    try { p.addEditors(getAdminEmails_()); p.removeEditors(p.getEditors().filter(function (u) { return getAdminEmails_().indexOf(String(u.getEmail()).toLowerCase()) < 0; })); } catch (e) { /* owner only */ }
    bk.getRange(1, 1, 1, 4).setValues([['Lead CRM reset backup', 'Made by ' + state.by, state.started, 'Restore: Lead CRM > Admin > Restore from reset backup']]);
  }
  var out = [];
  if (task.r === 2) {
    out.push([BACKUP_MARK, task.s, Math.max(last - 1, 0), width]);
    out.push(src.getRange(1, 1, 1, width).getValues()[0]);
  }
  var n = Math.min(RESET_CHUNK, last - task.r + 1);
  if (n > 0) {
    src.getRange(task.r, 1, n, width).getValues().forEach(function (row) {
      out.push(row.map(function (v) { return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v; }));
    });
    task.r += n;
  }
  if (out.length) {
    var start = bk.getLastRow() + 1;
    var w = Math.max(width, 4);
    if (bk.getMaxColumns() < w) bk.insertColumnsAfter(bk.getMaxColumns(), w - bk.getMaxColumns());
    if (bk.getMaxRows() < start + out.length - 1) bk.insertRowsAfter(bk.getMaxRows(), start + out.length - 1 - bk.getMaxRows());
    bk.getRange(start, 1, out.length, w).setValues(out.map(function (r) { var x = r.slice(0, w); while (x.length < w) x.push(''); return x; }));
  }
  return task.r > last;
}

/** Empties every cleared sheet below its header (formats, validation and header formulas stay). */
function resetClearSheets_() {
  var ss = ss_();
  RESET_SHEETS.forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (!sh || sh.getMaxRows() < 2) return;
    sh.getRange(2, 1, sh.getMaxRows() - 1, resetWidth_(n)).clearContent();
  });
  var leads = getSheet_(SHEET.LEADS);
  leads.getRange(2, LC.SUBSTAGE, leads.getMaxRows() - 1, 1).setDataValidation(null);   // per-row rules of old leads
}

/** Counters, queue and old progress; the "CRM Reset" entry; protection and dashboard. */
function resetFinish_(state) {
  var props = PropertiesService.getDocumentProperties();
  props.setProperty(PROP.LEAD_SEQ, '0');
  props.setProperty(PROP.ACT_SEQ, '0');
  props.setProperty('LEAD_COUNT', '0');
  [SETUP_STATE_KEY, PROP.DASH_CHART_COUNTS, PROP.CORRECTION, 'LAYOUT_BROKEN'].forEach(function (k) { props.deleteProperty(k); });
  var sp = PropertiesService.getScriptProperties();
  sp.getKeys().forEach(function (k) { if (k.indexOf(PROP.QUEUE_PREFIX) === 0) sp.deleteProperty(k); });   // queued saves of old leads
  try { CacheService.getDocumentCache().remove('DASH_REFRESH_REQUESTED'); } catch (e) { /* ignore */ }
  writeUnnumberedLogEntry_('RESET', ACT.CRM_RESET, state.by, 'Leads: ' + state.counts.leads + '; log entries: ' + state.counts.log +
    '; Lead Entry rows: ' + state.counts.entry + '; Access Log rows: ' + state.counts.access + '; deleted leads: ' + state.counts.deleted,
    'Reset to fresh start. Backup sheet: ' + state.backup);
  updateLeadProtection_();
  refreshDashboardCharts_();
  hideAdminSheets_();
}

/** A System entry with a fixed Activity ID, so the numbering of real activities still starts at ACT-000001. */
function writeUnnumberedLogEntry_(id, type, by, newValue, remarks) {
  var blank = new Array(LEAD_COLS);
  for (var b = 0; b < LEAD_COLS; b++) blank[b] = '';
  var e = buildLogEntry_({ row: blank, time: new Date(), type: type, category: CATEGORY.SYSTEM, counsellor: 'System',
    updatedBy: by, field: 'Whole CRM', newValue: newValue, remarks: remarks });
  e[LG.ACT_ID - 1] = id;
  var log = getSheet_(SHEET.LOG);
  log.getRange(log.getLastRow() + 1, 1, 1, LOG_COLS).setValues([e]);
}

/* ================================================================== */
/* Menu: Admin > Restore from reset backup                             */
/* ================================================================== */

function restoreFromResetBackup() {
  var email = requireAdmin_();
  var ui = SpreadsheetApp.getUi();
  var backups = backupSheets_().map(function (s) { return s.getName(); }).sort();
  if (!backups.length) { ui.alert(CRM_TITLE, 'There is no reset backup in this file.', ui.ButtonSet.OK); return; }
  if (countLeads_() > 0) {
    ui.alert(CRM_TITLE, 'Lead Management already holds leads, so a backup cannot be restored on top of them.\n\n' +
      'To go back to the state before the reset anyway, use File > Version history.', ui.ButtonSet.OK);
    return;
  }
  var r = ui.prompt(CRM_TITLE, 'Backups in this file:\n' + backups.join('\n') + '\n\nType the backup name to restore (empty = the newest):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var name = str_(r.getResponseText()) || backups[backups.length - 1];
  if (backups.indexOf(name) < 0) { ui.alert(CRM_TITLE, '"' + name + '" is not a backup sheet. Nothing was changed.', ui.ButtonSet.OK); return; }
  var ok = ui.alert(CRM_TITLE, 'Put back all leads and logs from "' + name + '"? Settings are not changed.', ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;
  var res = restoreBackup_(name, email);
  notify_('Restored from "' + name + '": ' + res.leads + ' leads, ' + res.log + ' log entries.\n\nThe backup sheet is kept; delete it when you no longer need it (Admin > Show admin sheets, right-click the tab > Delete).');
}

function restoreBackup_(name, email) {
  var ss = ss_();
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  var res = { leads: 0, log: 0 };
  try {
    processFollowUpQueue_();
    var vals = ss.getSheetByName(name).getDataRange().getValues();
    var blocks = {}, cur = null;
    vals.forEach(function (row) {
      if (row[0] === BACKUP_MARK) { cur = { name: row[1], width: Number(row[3]), header: null, rows: [] }; blocks[cur.name] = cur; return; }
      if (!cur) return;
      if (!cur.header) { cur.header = true; return; }
      cur.rows.push(row.slice(0, cur.width));
    });
    Object.keys(blocks).forEach(function (n) {
      var b = blocks[n], sh = ss.getSheetByName(n);
      if (!sh || !b.rows.length) return;
      // Entries written since the reset (e.g. "CRM Reset") are kept after the restored rows.
      var keepN = n === SHEET.LEADS ? 0 : Math.max(sh.getLastRow() - 1, 0);
      var keep = keepN ? sh.getRange(2, 1, keepN, b.width).getValues() : [];
      var all = b.rows.concat(keep);
      if (n === SHEET.LEADS) ensureLeadCapacity_(all.length + 1);
      else if (sh.getMaxRows() < all.length + 1) sh.insertRowsAfter(sh.getMaxRows(), all.length + 1 - sh.getMaxRows());
      if (n === SHEET.LEADS) {
        colRuns_(SNAP_COLS.concat([LC.DQ_FLAGS, LC.SNAPSHOT])).forEach(function (run) {
          sh.getRange(2, run[0], all.length, run[1] - run[0] + 1).setValues(all.map(function (r) { return r.slice(run[0] - 1, run[1]); }));
        });
        res.leads = all.length;
      } else {
        sh.getRange(2, 1, all.length, b.width).setValues(all);
        if (n === SHEET.LOG) res.log = b.rows.length;
      }
    });
    var settings = getSettings_();
    var props = PropertiesService.getDocumentProperties();
    props.setProperty(PROP.LEAD_SEQ, String(maxIdNumber_(getSheet_(SHEET.LEADS), LC.ID, settings.leadPrefix)));
    props.setProperty(PROP.ACT_SEQ, String(maxIdNumber_(getSheet_(SHEET.LOG), LG.ACT_ID, settings.actPrefix)));
    writeUnnumberedLogEntry_('RESTORE', ACT.CRM_RESTORED, email, 'Leads: ' + res.leads + '; log entries: ' + res.log, 'Restored from ' + name);
    refreshAllSubstageValidations_();
    refreshDataQuality_();
    updateLeadProtection_();
    rememberLeadCount_();
  } finally {
    lock.releaseLock();
  }
  refreshDashboardCharts_();
  return res;
}
