/**
 * Menu.gs
 * The "Lead CRM" menu (everyday items at the top, everything else under Admin), help and health check.
 */

function onOpen(e) {
  // Identity hand-off for the installable onOpen (Access Log): runs as the person opening the file.
  try { CacheService.getScriptCache().put('OPK', Session.getTemporaryActiveUserKey(), 60); } catch (err) { /* ignore */ }
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Lead CRM')
    .addItem('Log follow-up', 'showFollowUpSidebar')
    .addItem('My overdue follow-ups', 'showMyFollowUps')
    .addItem('Refresh dashboard', 'refreshDashboard')
    .addItem('Add leads from Lead Entry (admins)', 'addLeadsFromEntry')
    .addSeparator()
    .addItem('Help', 'showHelp')
    .addSubMenu(ui.createMenu('Admin')
      .addItem('Show admin sheets', 'showAdminSheets')
      .addItem('Hide admin sheets', 'hideAdminSheets')
      .addSeparator()
      .addItem('Delete lead(s)...', 'deleteLeads')
      .addItem('Restore deleted lead...', 'restoreDeletedLead')
      .addItem('Purge deleted lead permanently...', 'purgeDeletedLead')
      .addSeparator()
      .addItem('Allow system-column correction for 10 minutes', 'allowSystemCorrection')
      .addItem('Add custom field...', 'addCustomField')
      .addItem('Remove custom field...', 'removeCustomField')
      .addItem('Re-check all lead rows', 'recheckAllLeads')
      .addItem('Recalculate data-quality flags', 'recalculateDataQuality')
      .addItem('Refresh substage dropdowns', 'refreshAllSubstageValidations')
      .addItem('Reapply protections', 'reapplyProtections')
      .addSeparator()
      .addItem('Set up / repair workbook (10,000 rows)', 'setupWorkbook')
      .addItem('Quick test setup (1,000 rows)', 'setupWorkbookQuickTest')
      .addItem('Restart setup from the first stage', 'restartSetup')
      .addItem('Extend Lead Management by 5,000 rows', 'extendLeadSheet')
      .addItem('Recalculate ID counters', 'recalculateIdCounters')
      .addSeparator()
      .addItem('Counsellor web app link (optional)', 'showWebAppLink')
      .addItem('Web app sign-in setup', 'setupWebAppSignIn')
      .addItem('Set counsellor web app URL', 'setWebAppUrl')
      .addSeparator()
      .addItem('Enable daily email reminders', 'enableEmailReminders')
      .addItem('Disable daily email reminders', 'disableEmailReminders')
      .addItem('Send reminders now (test)', 'sendRemindersNow')
      .addSeparator()
      .addItem('Run health check', 'runHealthCheck'))
    .addToUi();
}

/* ---------- System-column correction window ---------- */

/** Admin > Allow system-column correction for 10 minutes (for genuine fixes; every correction is logged). */
function allowSystemCorrection() {
  var email = requireAdmin_();
  var until = Date.now() + 10 * 60000;
  PropertiesService.getDocumentProperties().setProperty(PROP.CORRECTION, JSON.stringify({ until: until, by: email }));
  var blank = new Array(LEAD_COLS);
  for (var b = 0; b < LEAD_COLS; b++) blank[b] = '';
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    appendLogRows_([buildLogEntry_({
      row: blank, time: new Date(), type: ACT.CORRECTION_OPENED, category: CATEGORY.SYSTEM, counsellor: 'System', updatedBy: email,
      field: 'Automatic columns', newValue: 'Admins may correct them until ' + displayDateTime_(new Date(until)),
      remarks: 'Opened with Admin > Allow system-column correction for 10 minutes'
    })]);
  } finally {
    lock.releaseLock();
  }
  logAccess_(email, 'System Correction Allowed', '', 'For 10 minutes', 'Spreadsheet');
  notify_('For the next 10 minutes, admins may correct automatic columns (Last Updated By, dates, Previous Counsellor...) in Lead Management. ' +
    'Every correction is logged as "System Field Corrected". Lead ID, Follow-Up Count, Total Activities, Data Quality Flags and the snapshot still cannot be changed.');
}

/* ---------- Counsellor web app ---------- */

function showWebAppLink() {
  var url = signInUrl_('');
  if (!getWebAppUrl_() || !url) { alert_('The counsellor web app or its sign-in app is not set up yet. See docs/SETUP.md, "Counsellor web app".'); return; }
  var html = HtmlService.createHtmlOutput('<div style="font-family:Roboto,Arial;font-size:13px;line-height:1.6">' +
    'Counsellor link (share this; it signs them in and opens the web app):<br><a href="' + url + '" target="_blank" rel="noopener">' + url + '</a></div>')
    .setWidth(520).setHeight(120);
  SpreadsheetApp.getUi().showModalDialog(html, CRM_TITLE);
}

/* ---------- Help & health check ---------- */

function showHelp() {
  var html = HtmlService.createHtmlOutput(
    '<div style="font-family:Roboto,Arial;font-size:13px;line-height:1.55">' +
    '<h3 style="color:#1F3864;margin:0 0 8px">Lead CRM - quick help</h3>' +
    '<b>Your calls today:</b> Lead CRM &gt; My overdue follow-ups.<br>' +
    '<b>After a call:</b> select the lead row, Lead CRM &gt; Log follow-up, fill it in, Save.<br>' +
    '<b>White cells</b> you may change on your own leads. <b>Grey cells</b> are automatic or admin-only.<br>' +
    '<b>Red Lead ID:</b> something is missing. Column AH says what.<br>' +
    '<b>Dates:</b> double-click the cell and pick from the calendar.<br>' +
    '<b>New leads:</b> only admins add them, in Lead Entry.<br><br>' +
    'Wrong changes are undone automatically with a short message. The Field Guide sheet explains every column.' +
    '</div>').setWidth(460).setHeight(300);
  SpreadsheetApp.getUi().showModalDialog(html, CRM_TITLE + ' help');
}

function runHealthCheck() {
  requireAdmin_();
  var ss = ss_();
  var lines = [];
  var ok = function (cond, text) { lines.push((cond ? 'OK    ' : 'CHECK ') + text); };
  SHEET_ORDER.forEach(function (n) { ok(!!ss.getSheetByName(n), 'Sheet "' + n + '" exists'); });
  var leads = ss.getSheetByName(SHEET.LEADS);
  if (leads) {
    ok(str_(leads.getRange(1, LC.ID).getValue()) === 'Lead ID', 'Lead Management A1 = "Lead ID" (columns not moved)');
    ok(same_(leads.getRange(1, LC.OWNER).getValue(), 'Assigned Counsellor'), 'Lead Management ' + colLetter_(LC.OWNER) + '1 = "Assigned Counsellor" (current column layout)');
    var cfs = readCustomFields_().filter(function (f) { return f.active; });
    ok(true, 'Active custom fields: ' + (cfs.map(function (f) { return f.name + ' (' + colLetter_(customCol_(f.slot)) + ')'; }).join(', ') || 'none'));
    ok(/^=/.test(leads.getRange(1, LC.FU_COUNT).getFormula()), 'Follow-Up Count header formula present (L1)');
    var target = parseInt(PropertiesService.getDocumentProperties().getProperty(SETUP_ROWS_KEY), 10) || LEAD_DATA_ROWS;
    ok(leads.getMaxRows() - 1 >= target, 'Lead Management has ' + (leads.getMaxRows() - 1) + ' data rows (setup target ' + target + ')');
    ok(!!leads.getFilter(), 'Filter enabled on Lead Management');
    ok(leads.getProtections(SpreadsheetApp.ProtectionType.SHEET).some(function (p) { return /^CRM:/.test(p.getDescription() || ''); }), 'Lead Management sheet is protected (counsellors edit white cells only)');
  }
  Object.keys(NAMED).forEach(function (k) { ok(!!ss.getRangeByName(NAMED[k].name), 'Named range ' + NAMED[k].name); });
  var triggers = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  ok(triggers.indexOf('onChangeInstallable') >= 0, 'onChange trigger installed (refreshes dropdowns after sort/insert)');
  ok(triggers.indexOf('onEditInstallable') >= 0, 'Edit guard trigger installed (onEditInstallable)');
  ok(triggers.indexOf('processQueuedFollowUps') >= 0, 'Follow-up queue trigger installed (every minute)');
  ok(checkLeadColumns_(false).ok, 'Lead Management columns are in the expected order');
  ok(!correctionWindow_(), correctionWindow_() ? 'System-column correction window is OPEN' : 'No correction window open');
  var queued = PropertiesService.getScriptProperties().getKeys().filter(function (k) { return k.indexOf(PROP.QUEUE_PREFIX) === 0; }).length;
  ok(queued === 0, 'Follow-ups waiting in the queue: ' + queued);
  ok(triggers.indexOf('scheduledMaintenance') >= 0, 'Hourly maintenance trigger (data quality + dashboard)');
  ok(!!getWebAppUrl_(), 'Counsellor web app URL: ' + (getWebAppUrl_() || 'not deployed'));
  ok(!!getIdentityUrl_() && !!PropertiesService.getScriptProperties().getProperty(PROP.IDENTITY_SECRET),
    'Web app sign-in app: ' + (getIdentityUrl_() || 'not configured (Admin > Web app sign-in setup)'));
  var mapped = PropertiesService.getScriptProperties().getKeys().filter(function (k) { return k.indexOf(PROP.USER_KEY_PREFIX) === 0; }).length;
  ok(mapped > 0, 'Registered editor identities (for sheet edits): ' + mapped);
  ok(true, 'Counsellor-editable columns: ' + editableCols_().map(function (c) { return colLetter_(c) + ' ' + leadLabel_(c); }).join(', '));
  ok(ADMIN_SHEETS.every(function (n) { var x = ss.getSheetByName(n); return !x || x.isSheetHidden(); }), 'Admin sheets hidden from counsellors');
  var props = PropertiesService.getDocumentProperties();
  var pending = props.getProperty(SETUP_STATE_KEY);
  ok(!pending, pending ? 'Setup unfinished - run Set up / repair workbook again (' + pending + ')' : 'Setup completed');
  ok(!!props.getProperty(PROP.LEAD_SEQ), 'Lead ID counter = ' + props.getProperty(PROP.LEAD_SEQ));
  ok(!!props.getProperty(PROP.ACT_SEQ), 'Activity ID counter = ' + props.getProperty(PROP.ACT_SEQ));
  var actor = registerCurrentUser_();
  ok(!!actor.email, 'Your email visible to script: ' + (actor.email || 'NO'));
  ok(getSettings_().adminEmails.length > 0, 'Admin emails configured: ' + getSettings_().adminEmails.join(', '));
  ok(getStageInfo_().activeStages.length > 0, 'Active stages: ' + getStageInfo_().activeStages.length);
  ok(activeCounsellorNames_().length > 0, 'Active counsellors: ' + activeCounsellorNames_().length);
  var unmapped = getCounsellors_().filter(function (c) { return c.active && !c.email; }).map(function (c) { return c.name; });
  ok(!unmapped.length, 'Active counsellors without email: ' + (unmapped.join(', ') || 'none'));
  ok(getSettings_().remindersEnabled === (triggers.indexOf('sendFollowUpReminders') >= 0),
    'Email reminders: ' + (getSettings_().remindersEnabled ? 'enabled' : 'disabled') + ' (trigger ' + (triggers.indexOf('sendFollowUpReminders') >= 0 ? 'present' : 'absent') + ')');
  alert_('Health check (' + CRM_TITLE + ' ' + CRM_VERSION + ')\n\n' + lines.join('\n'));
}
