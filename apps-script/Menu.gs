/**
 * Menu.gs
 * The "Lead CRM" custom menu, quick views, identity helper, help and health check.
 */

function onOpen(e) {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Lead CRM')
    .addItem('Log Follow-Up...', 'showFollowUpSidebar')
    .addItem('Go to Lead...', 'menuGoToLead')
    .addSeparator()
    .addSubMenu(ui.createMenu('Views (changes the shared filter)')
      .addItem('My follow-ups due (today + overdue)', 'viewMyDueFollowUps')
      .addItem('All overdue follow-ups', 'viewOverdue')
      .addItem('Follow-ups due today', 'viewDueToday')
      .addItem('Unassigned leads', 'viewUnassigned')
      .addItem('Unworked leads (no activity)', 'viewUnworked')
      .addItem('Leads with data-quality flags', 'viewDataQuality')
      .addSeparator()
      .addItem('Clear view filters', 'viewClear'))
    .addItem('Refresh Dashboard', 'refreshDashboard')
    .addItem('Open counsellor web app', 'showWebAppLink')
    .addItem('Add custom field...', 'addCustomField')
    .addItem('Remove custom field...', 'removeCustomField')
    .addItem('Refresh substage dropdowns', 'refreshAllSubstageValidations')
    .addItem('Identify me', 'identifyMe')
    .addSeparator()
    .addSubMenu(ui.createMenu('Admin')
      .addItem('Set up / repair workbook (10,000 rows)', 'setupWorkbook')
      .addItem('Quick test setup (1,000 rows)', 'setupWorkbookQuickTest')
      .addItem('Restart setup from the first stage', 'restartSetup')
      .addItem('Process imported / pasted leads', 'processAllLeads')
      .addItem('Extend Lead Management by 5,000 rows', 'extendLeadSheet')
      .addItem('Reapply protections', 'reapplyProtections')
      .addItem('Recalculate ID counters', 'recalculateIdCounters')
      .addSeparator()
      .addItem('Use installable edit trigger + strict locking (default)', 'useInstallableEditTrigger')
      .addItem('Use legacy simple edit trigger (warning-only locking)', 'useSimpleEditTrigger')
      .addItem('Recalculate data-quality flags', 'recalculateDataQuality')
      .addItem('Set counsellor web app URL', 'setWebAppUrl')
      .addSeparator()
      .addItem('Enable daily email reminders', 'enableEmailReminders')
      .addItem('Disable daily email reminders', 'disableEmailReminders')
      .addItem('Send reminders now (test)', 'sendRemindersNow')
      .addSeparator()
      .addItem('Run health check', 'runHealthCheck'))
    .addItem('Help', 'showHelp')
    .addToUi();
}

/* ---------- Navigation ---------- */

function menuGoToLead() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt(CRM_TITLE, 'Lead ID or mobile number:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var q = str_(r.getResponseText());
  var sheet = getSheet_(SHEET.LEADS);
  var row = findLeadRow_(sheet, q);
  if (!row && q) {
    var last = lastLeadRow_(sheet);
    var hit = last >= 2 ? sheet.getRange(2, LC.MOBILE, last - 1, 1).createTextFinder(q).matchEntireCell(true).findNext() : null;
    if (hit) row = hit.getRow();
  }
  if (!row) { ui.alert(CRM_TITLE, 'No lead found for "' + q + '".', ui.ButtonSet.OK); return; }
  ss_().setActiveSheet(sheet);
  sheet.setActiveSelection(sheet.getRange(row, LC.ID, 1, LC.NEXT_FU));
}

/* ---------- Views (basic filter on Lead Management) ---------- */

function leadFilter_() {
  var sheet = getSheet_(SHEET.LEADS);
  var f = sheet.getFilter() || sheet.getRange(1, 1, sheet.getMaxRows(), LEAD_COLS).createFilter();
  for (var c = 1; c <= LEAD_COLS; c++) {
    if (f.getColumnFilterCriteria(c)) f.removeColumnFilterCriteria(c);
  }
  ss_().setActiveSheet(sheet);
  return f;
}

function formulaCriteria_(formula) {
  return SpreadsheetApp.newFilterCriteria().whenFormulaSatisfied(lcf_(formula)).build();
}

var OPEN_FILTER_FORMULA = '=AND(${STATUS}2<>"Converted",${STATUS}2<>"Lost",${STATUS}2<>"Duplicate")';

function viewMyDueFollowUps() {
  var actor = registerCurrentUser_();
  if (!actor.name) {
    alert_('Your Google account is not mapped to a counsellor. Ask an administrator to add your email (' +
      (actor.email || 'not visible') + ') in Counsellor Master.');
    return;
  }
  var f = leadFilter_();
  f.setColumnFilterCriteria(LC.OWNER, SpreadsheetApp.newFilterCriteria().whenTextEqualTo(actor.name).build());
  f.setColumnFilterCriteria(LC.NEXT_FU, formulaCriteria_('=AND(ISNUMBER(${NEXT_FU}2),INT(${NEXT_FU}2)<=TODAY())'));
  f.setColumnFilterCriteria(LC.STATUS, formulaCriteria_(OPEN_FILTER_FORMULA));
  toast_('Showing follow-ups due today or overdue for ' + actor.name + '.');
}

function viewOverdue() {
  var f = leadFilter_();
  f.setColumnFilterCriteria(LC.NEXT_FU, formulaCriteria_('=AND(ISNUMBER(${NEXT_FU}2),${NEXT_FU}2<TODAY())'));
  f.setColumnFilterCriteria(LC.STATUS, formulaCriteria_(OPEN_FILTER_FORMULA));
  toast_('Showing overdue follow-ups (open leads).');
}

function viewDueToday() {
  var f = leadFilter_();
  f.setColumnFilterCriteria(LC.NEXT_FU, formulaCriteria_('=AND(ISNUMBER(${NEXT_FU}2),INT(${NEXT_FU}2)=TODAY())'));
  f.setColumnFilterCriteria(LC.STATUS, formulaCriteria_(OPEN_FILTER_FORMULA));
  toast_('Showing follow-ups due today.');
}

function viewUnassigned() {
  var f = leadFilter_();
  f.setColumnFilterCriteria(LC.ID, SpreadsheetApp.newFilterCriteria().whenCellNotEmpty().build());
  f.setColumnFilterCriteria(LC.OWNER, SpreadsheetApp.newFilterCriteria().whenCellEmpty().build());
  toast_('Showing leads without an assigned counsellor.');
}

function viewUnworked() {
  var f = leadFilter_();
  f.setColumnFilterCriteria(LC.ID, SpreadsheetApp.newFilterCriteria().whenCellNotEmpty().build());
  f.setColumnFilterCriteria(LC.ACTIVITY_TOTAL, SpreadsheetApp.newFilterCriteria().whenNumberEqualTo(0).build());
  toast_('Showing leads that have never had a logged activity.');
}

function viewDataQuality() {
  var f = leadFilter_();
  f.setColumnFilterCriteria(LC.DQ_FLAGS, SpreadsheetApp.newFilterCriteria().whenCellNotEmpty().build());
  toast_('Showing leads with data-quality flags (see column AH).');
}

function viewClear() {
  leadFilter_();
  toast_('Filters cleared.');
}

/* ---------- Counsellor web app ---------- */

function showWebAppLink() {
  var url = getWebAppUrl_();
  if (!url) { alert_('The counsellor web app is not deployed yet. See docs/SETUP.md, "Counsellor web app".'); return; }
  var html = HtmlService.createHtmlOutput('<div style="font-family:Roboto,Arial;font-size:13px;line-height:1.6">' +
    'Counsellor web app (share this link with counsellors):<br><a href="' + url + '" target="_blank" rel="noopener">' + url + '</a></div>')
    .setWidth(520).setHeight(120);
  SpreadsheetApp.getUi().showModalDialog(html, CRM_TITLE);
}

/* ---------- Identity ---------- */

function identifyMe() {
  var actor = registerCurrentUser_();
  var msg;
  if (actor.name) msg = 'You are recognised as counsellor "' + actor.name + '" (' + actor.email + ').\nYour edits will show this name in Last Updated By.';
  else if (actor.email) msg = 'You are signed in as ' + actor.email + ', which is not in Counsellor Master.\nEdits will show your email. An administrator can add it to Counsellor Master > Email ID.';
  else msg = 'Google did not share your email address with the script (account or domain policy).\nEdits will show "Unidentified user"; in the follow-up form, select your name manually.';
  msg += '\n\nCRM administrator: ' + (isAdmin_(actor.email) ? 'yes' : 'no') + '.';
  alert_(msg);
}

/* ---------- Help & health check ---------- */

function showHelp() {
  var html = HtmlService.createHtmlOutput(
    '<div style="font-family:Roboto,Arial;font-size:13px;line-height:1.5">' +
    '<h3 style="color:#1F3864;margin:0 0 8px">Lead CRM - quick guide</h3>' +
    '<b>Add a lead:</b> type the name, mobile and other details in the next empty row of Lead Management. The Lead ID, created date and defaults appear automatically.<br>' +
    '<b>Stage &amp; substage:</b> pick the Lead Stage first; the Substage dropdown then shows only that stage\'s substages.<br>' +
    '<b>Record a call / message:</b> select the lead row and use <i>Lead CRM &gt; Log Follow-Up</i>. Every entry is kept in Follow-Up Log.<br>' +
    '<b>Colours:</b> red = overdue follow-up, yellow = due today, blue = upcoming, green row = converted, grey row = lost / duplicate.<br>' +
    '<b>Do not type</b> in grey/green header columns (system or formula columns).<br>' +
    '<b>Dashboard:</b> choose the period and counsellor in the yellow cells.<br><br>' +
    'Full documentation: docs/SETUP.md, ADMIN.md, TESTING.md, TROUBLESHOOTING.md, LIMITATIONS.md in the project repository.' +
    '</div>').setWidth(460).setHeight(320);
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
    ok(/^=/.test(leads.getRange(1, LC.DQ_FLAGS).getFormula()), 'Data Quality header formula present (AH1)');
    var target = parseInt(PropertiesService.getDocumentProperties().getProperty(SETUP_ROWS_KEY), 10) || LEAD_DATA_ROWS;
    ok(leads.getMaxRows() - 1 >= target, 'Lead Management has ' + (leads.getMaxRows() - 1) + ' data rows (setup target ' + target + ')');
    ok(!!leads.getFilter(), 'Filter enabled on Lead Management');
  }
  Object.keys(NAMED).forEach(function (k) { ok(!!ss.getRangeByName(NAMED[k].name), 'Named range ' + NAMED[k].name); });
  var triggers = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  ok(triggers.indexOf('onChangeInstallable') >= 0, 'onChange trigger installed (refreshes dropdowns after sort/insert)');
  var mode = getEditMode_();
  ok(mode === 'simple' || triggers.indexOf('onEditInstallable') >= 0, 'Edit tracking mode: ' + mode + (mode === 'installable' ? ' (strict locking)' : ' (warning-only locking)'));
  ok(triggers.indexOf('scheduledMaintenance') >= 0, 'Hourly maintenance trigger (data quality + dashboard)');
  ok(!!getWebAppUrl_(), 'Counsellor web app URL: ' + (getWebAppUrl_() || 'not deployed'));
  ok(true, 'Counsellor-locked columns: ' + lockedCols_().map(function (c) { return colLetter_(c); }).join(', '));
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
