/**
 * Dashboard.gs
 * The Dashboard is a static layout whose numbers are computed by the script and written as values.
 *
 * Why not live formulas? The previous version used ~1,000 COUNTIFS / FILTER formulas over the full
 * Lead Management and Follow-Up Log columns. Google Sheets recalculated them after every edit to
 * those columns, which made typing on Lead Management slow for everybody. Computing the same
 * numbers in Apps Script takes a few seconds and costs nothing between refreshes.
 *
 * Refreshes happen when a Dashboard filter cell changes (installable edit trigger), from
 * Lead CRM > Refresh Dashboard, and hourly (scheduledMaintenance). "Last Refreshed" shows the time.
 */

var DASH_SIZES = { stage: 25, substage: 80, counsellor: 40, ageing: 10, exceptions: 25, daily: 62, pending: 500 };

/* ================================================================== */
/* Layout (built by setup)                                             */
/* ================================================================== */

function setupDashboard_(sh) {
  var keep = {};
  [DASH.PERIOD, DASH.CUSTOM_FROM, DASH.CUSTOM_TO, DASH.COUNSELLOR].forEach(function (a1) {
    keep[a1] = sh.getRange(a1).getValue();
  });
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart().clearDataValidations();
  sh.clear();
  sh.clearConditionalFormatRules();
  sh.getBandings().forEach(function (b) { b.remove(); });
  ensureSize_(sh, 900, 30);
  sh.setHiddenGridlines(true);
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).setFontFamily('Roboto').setFontSize(10).setVerticalAlignment('middle');
  sh.setColumnWidth(1, 18);
  sh.setColumnWidths(2, 11, 118);
  sh.setColumnWidth(13, 24);

  // ---- Title and controls ----
  sh.getRange('B1').setValue('Lead CRM - MIS Dashboard').setFontSize(20).setFontWeight('bold').setFontColor(COLORS.navy);
  sh.getRange('B2').setValue('Numbers are calculated by the script (see Last Refreshed). They refresh when you change a yellow filter, ' +
    'hourly, or via Lead CRM > Refresh Dashboard. Activity metrics use Follow-Up Log dates; lead-generation metrics use Lead Created Date; ' +
    'follow-up status metrics are as of today.').setFontColor('#566573').setFontStyle('italic');
  var label = function (a1, text) { sh.getRange(a1).setValue(text).setFontWeight('bold').setFontColor('#566573').setHorizontalAlignment('right'); };
  label('B4', 'Reporting Period');
  label('E4', 'Custom From');
  label('H4', 'Custom To');
  label('K4', 'Counsellor');
  label('B5', 'Applied From');
  label('E5', 'Applied To');
  label('H5', 'Last Refreshed');
  [DASH.PERIOD, DASH.CUSTOM_FROM, DASH.CUSTOM_TO, DASH.COUNSELLOR].forEach(function (a1) {
    sh.getRange(a1).setBackground('#FFF9E6').setBorder(true, true, true, true, false, false, '#E6B800', SpreadsheetApp.BorderStyle.SOLID)
      .setFontWeight('bold').setHorizontalAlignment('center');
  });
  var settings = getSheet_(SHEET.SETTINGS);
  sh.getRange(DASH.PERIOD).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInRange(settings.getRange('V2:V'), true).setAllowInvalid(false).build())
    .setValue(keep[DASH.PERIOD] || 'Last 30 Days');
  [DASH.CUSTOM_FROM, DASH.CUSTOM_TO].forEach(function (a1) {
    sh.getRange(a1).setNumberFormat('dd-mmm-yyyy').setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false)
      .setHelpText('Used when Reporting Period = Custom Date Range.').build());
    if (keep[a1]) sh.getRange(a1).setValue(keep[a1]);
  });
  sh.getRange(DASH.COUNSELLOR).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInRange(settings.getRange('U2:U'), true).setAllowInvalid(false).build())
    .setValue(keep[DASH.COUNSELLOR] || ALL_COUNSELLORS);
  sh.getRange('C5:F5').setNumberFormat('dd-mmm-yyyy').setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange(DASH.REFRESHED).setNumberFormat('dd-mmm-yyyy hh:mm').setHorizontalAlignment('center').setFontWeight('bold');
  sh.getRange('K5').setFontColor(COLORS.red).setFontWeight('bold');

  // ---- KPI cards ----
  var cards = {};
  DASH_KPIS.forEach(function (k, idx) {
    var g = Math.floor(idx / 6), pos = idx % 6;
    var col = 2 + pos * 2, row = 7 + g * 4;
    cards[k[1]] = [row + 1, col];
    sh.getRange(row, col, 3, 2).setBackground(COLORS.card)
      .setBorder(true, true, true, true, false, false, '#D5D8DC', SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(row, col, 1, 2).merge().setFontWeight('bold').setFontColor('#566573').setHorizontalAlignment('center');
    sh.getRange(row, col).setValue(k[1]);
    sh.getRange(row + 1, col, 1, 2).merge().setFontSize(22).setFontWeight('bold').setFontColor(COLORS.navy)
      .setHorizontalAlignment('center').setNumberFormat(k[3]);
    sh.getRange(row + 2, col, 1, 2).merge().setFontSize(8).setFontColor('#7F8C8D').setWrap(true)
      .setHorizontalAlignment('center').setVerticalAlignment('top');
    sh.getRange(row + 2, col).setValue(k[2]);
    sh.getRange(row, col).setNote(k[2]);
  });
  [7, 11].forEach(function (r) { sh.setRowHeight(r, 24); sh.setRowHeight(r + 1, 40); sh.setRowHeight(r + 2, 34); });

  var layout = { cards: cards };
  var row = 16;
  var A = section_(sh, row, 'A. Stage-Wise Report', ['Lead Stage', 'Total Current Leads', 'Leads Worked (Period)',
    'Follow-Ups Completed (Period)', 'Overdue Follow-Ups', 'Converted Leads', '% of Total Leads'], DASH_SIZES.stage);
  sh.getRange(A.data, 8, A.n, 1).setNumberFormat('0.0%');
  layout.stage = A; row = A.end + 2;

  var B = section_(sh, row, 'B. Substage-Wise Report', ['Lead Stage', 'Lead Substage', 'Current Lead Count',
    'Leads Worked (Period)', 'Conversion Count'], DASH_SIZES.substage);
  layout.substage = B; row = B.end + 2;

  var C = section_(sh, row, 'C. Counsellor-Wise Performance', ['Counsellor Name', 'Assigned Leads', 'Unique Leads Worked (Period)',
    'Follow-Ups Completed (Period)', 'Pending Follow-Ups', 'Overdue Follow-Ups', 'Conversions', 'Conversion Rate',
    'Leads Not Contacted', 'Avg Activities per Lead'], DASH_SIZES.counsellor);
  sh.getRange(C.data, 9, C.n, 1).setNumberFormat('0.0%');
  sh.getRange(C.data, 11, C.n, 1).setNumberFormat('0.0');
  layout.counsellor = C; row = C.end + 2;

  var F = section_(sh, row, 'F. Lead Ageing & Follow-Up Ageing', ['Ageing Bucket', 'Min Days', 'Max Days',
    'Open Leads (age since Lead Created Date)', 'Due/Overdue Follow-Ups (days overdue)'], DASH_SIZES.ageing);
  headerCells_(sh.getRange(F.data - 1, 8, 1, 2), ['Lead Status', 'Leads']);
  headerCells_(sh.getRange(F.data - 1, 11, 1, 2), ['Lead Source', 'Leads']);
  layout.ageing = F; row = F.end + 2;

  var G = section_(sh, row, 'G. Exceptions - Unassigned & Unworked Leads (first 25; full lists via Lead CRM > Views)', [
    'Unassigned Lead ID', 'Lead Name', 'Mobile', 'Created', '', 'Unworked Lead ID', 'Lead Name', 'Counsellor', 'Created'], DASH_SIZES.exceptions);
  sh.getRange(G.data - 1, 6).setBackground(null);
  sh.getRange(G.title, 8).setFontColor(COLORS.amber).setFontWeight('bold');
  sh.getRange(G.data, 5, G.n, 1).setNumberFormat('dd-mmm-yyyy');
  sh.getRange(G.data, 10, G.n, 1).setNumberFormat('dd-mmm-yyyy');
  layout.exceptions = G; row = G.end + 2;

  var D = section_(sh, row, 'D. Daily Productivity Trend (up to 62 days of the selected period)', ['Activity Date',
    'Activities (Contact + Record Update)', 'Unique Leads Contacted', 'Follow-Ups Completed', 'Conversions'], DASH_SIZES.daily);
  sh.getRange(D.data, 2, D.n, 1).setNumberFormat('dd-mmm-yyyy');
  layout.daily = D; row = D.end + 2;

  var E = section_(sh, row, 'E. Follow-Ups Due Today or Overdue (most overdue first, up to 500)', ['Lead ID', 'Lead Name', 'Mobile Number',
    'Counsellor', 'Lead Stage', 'Lead Substage', 'Next Follow-Up Date', 'Days Overdue', 'Last Activity Timestamp'], DASH_SIZES.pending);
  ensureSize_(sh, E.end + 5, 30);
  sh.getRange(E.data, 8, E.n, 1).setNumberFormat('dd-mmm-yyyy');
  sh.getRange(E.data, 9, E.n, 1).setNumberFormat('0');
  sh.getRange(E.data, 10, E.n, 1).setNumberFormat('dd-mmm-yyyy hh:mm');
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND(ISNUMBER($I' + E.data + '),$I' + E.data + '>0)')
      .setFontColor(COLORS.red).setBold(true).setRanges([sh.getRange(E.data, 9, E.n, 1)]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND(ISNUMBER($I' + E.data + '),$I' + E.data + '=0)')
      .setFontColor('#7D6608').setBold(true).setRanges([sh.getRange(E.data, 9, E.n, 1)]).build()
  ]);
  layout.pending = E;

  PropertiesService.getDocumentProperties().setProperty(PROP.DASH_LAYOUT, JSON.stringify(layout));
  PropertiesService.getDocumentProperties().deleteProperty(PROP.DASH_CHART_COUNTS);
  sh.setFrozenRows(5);
}

/** [key, label, definition, number format] — order = card position. */
var DASH_KPIS = [
  ['total', 'Total Leads', 'All leads with a Lead ID. Not date-filtered.', '#,##0'],
  ['created', 'Leads Created (Period)', 'Leads whose Lead Created Date is in the period.', '#,##0'],
  ['worked', 'Leads Worked (Period)', 'Unique Lead IDs with at least one Contact or Record Update activity in the period.', '#,##0'],
  ['contacted', 'Unique Leads Contacted', 'Unique Lead IDs with at least one Contact activity in the period (each lead counted once).', '#,##0'],
  ['fu', 'Follow-Ups Completed', 'Number of Contact activities logged in the period.', '#,##0'],
  ['pending', 'Follow-Ups Pending', 'Open leads with a next follow-up date today or later (as of today).', '#,##0'],
  ['overdue', 'Follow-Ups Overdue', 'Open leads whose next follow-up date is before today.', '#,##0'],
  ['converted', 'Converted Leads', 'Leads with Lead Status = Converted (current).', '#,##0'],
  ['lost', 'Lost Leads', 'Leads with Lead Status = Lost (current).', '#,##0'],
  ['notContacted', 'Leads Not Contacted', 'Open leads with zero Contact activities ever.', '#,##0'],
  ['noActivity', 'Leads With No Activity', 'Leads with no Contact or Record Update entry in the log ever (unworked).', '#,##0'],
  ['rate', 'Conversion Rate', 'Converted Leads / Total Leads.', '0.0%']
];

/** Section title + header row; returns {title, data, n, end}. */
function section_(sh, row, title, headers, n) {
  sh.getRange(row, 2).setValue(title).setFontSize(13).setFontWeight('bold').setFontColor(COLORS.navy);
  sh.getRange(row, 2, 1, 11).setBorder(null, null, true, null, null, null, COLORS.navy, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  headerCells_(sh.getRange(row + 1, 2, 1, headers.length), headers);
  sh.setRowHeight(row + 1, 36);
  sh.getRange(row + 2, 2, n, headers.length).setHorizontalAlignment('center');
  return { title: row, data: row + 2, n: n, end: row + 1 + n };
}

function headerCells_(range, headers) {
  range.setValues([headers]);
  range.setBackground(COLORS.navy).setFontColor('#FFFFFF').setFontWeight('bold').setWrap(true)
    .setHorizontalAlignment('center').setFontSize(9);
}

function writeDashboardTimestamp_(sh) {
  sh = sh || getSheet_(SHEET.DASHBOARD);
  sh.getRange(DASH.REFRESHED).setValue(new Date()).setNumberFormat('dd-mmm-yyyy hh:mm');
}

/* ================================================================== */
/* Computation                                                         */
/* ================================================================== */

/** Reporting period from the Dashboard controls: {fromKey, toKey, warning}. */
function dashboardPeriod_(period, customFrom, customTo) {
  var today = todayKey_();
  var month = today.substring(0, 8);           // yyyy-MM-
  var firstOfMonth = month + '01';
  var prevMonthEnd = addDaysKey_(firstOfMonth, -1);
  var p = {
    'Today': [today, today],
    'Yesterday': [addDaysKey_(today, -1), addDaysKey_(today, -1)],
    'Last 7 Days': [addDaysKey_(today, -6), today],
    'Last 30 Days': [addDaysKey_(today, -29), today],
    'Current Month': [firstOfMonth, today],
    'Previous Month': [prevMonthEnd.substring(0, 8) + '01', prevMonthEnd]
  }[period];
  if (!p) p = [toDateKey_(customFrom) || today, toDateKey_(customTo) || today];
  return { fromKey: p[0], toKey: p[1], warning: p[0] > p[1] ? 'Warning: From date is after To date' : '' };
}

/**
 * Pure computation of every dashboard figure from the sheet data (no sheet access): used by the
 * Dashboard and testable on its own.
 * input: {leads: [row arrays], log: [row arrays], stageInfo, counsellors: [names], buckets: [[label,min,max]],
 *         statuses, sources, fromKey, toKey, todayKey, selected ('' / All Counsellors / name)}
 */
function computeDashboard_(input) {
  var DAY = 86400000;
  var all = !input.selected || same_(input.selected, ALL_COUNSELLORS);
  var mineLead = function (r) { return all || same_(r[LC.OWNER - 1], input.selected); };
  var fromMs = dateFromKey_(input.fromKey).getTime();
  var toEndMs = dateFromKey_(addDaysKey_(input.toKey, 1)).getTime();
  var todayStart = dateFromKey_(input.todayKey).getTime();
  var tomorrowStart = dateFromKey_(addDaysKey_(input.todayKey, 1)).getTime();
  var ms = function (v) { return isDate_(v) ? v.getTime() : NaN; };
  var inc = function (o, k, by) { o[k] = (o[k] || 0) + (by || 1); };
  var lower = function (v) { return str_(v).toLowerCase(); };

  // Lifetime activity counts per lead
  var contactCount = {}, activityCount = {};
  input.log.forEach(function (l) {
    var id = lower(l[LG.LEAD_ID - 1]), cat = str_(l[LG.CATEGORY - 1]);
    if (!id || !cat || cat === CATEGORY.SYSTEM) return;
    inc(activityCount, id);
    if (cat === CATEGORY.CONTACT) inc(contactCount, id);
  });

  // Period log (activity metrics): counsellor filter on the log's Counsellor Name
  var logP = input.log.filter(function (l) {
    var t = ms(l[LG.TIME - 1]);
    return t >= fromMs && t < toEndMs;
  });
  var logPF = logP.filter(function (l) { return all || same_(l[LG.COUNSELLOR - 1], input.selected); });
  var uniq = function (rows, pred) {
    var set = {};
    rows.forEach(function (l) { if (pred(l)) set[lower(l[LG.LEAD_ID - 1])] = true; });
    delete set[''];
    return Object.keys(set).length;
  };
  var isContact = function (l) { return str_(l[LG.CATEGORY - 1]) === CATEGORY.CONTACT; };
  var isWork = function (l) { var c = str_(l[LG.CATEGORY - 1]); return c && c !== CATEGORY.SYSTEM; };

  var leads = input.leads.filter(function (r) { return str_(r[LC.ID - 1]); });
  var leadsF = leads.filter(mineLead);
  var isOpen = function (r) { return !isClosedStatus_(r[LC.STATUS - 1]); };
  var nextMs = function (r) { return ms(r[LC.NEXT_FU - 1]); };
  var isOverdue = function (r) { return isOpen(r) && nextMs(r) < todayStart; };
  var isPending = function (r) { return isOpen(r) && nextMs(r) >= todayStart; };
  var count = function (rows, pred) { var n = 0; rows.forEach(function (r) { if (pred(r)) n++; }); return n; };

  var k = {};
  k.total = leadsF.length;
  k.created = count(leadsF, function (r) { var t = ms(r[LC.CREATED - 1]); return t >= fromMs && t < toEndMs; });
  k.worked = uniq(logPF, isWork);
  k.contacted = uniq(logPF, isContact);
  k.fu = count(logPF, isContact);
  k.pending = count(leadsF, isPending);
  k.overdue = count(leadsF, isOverdue);
  k.converted = count(leadsF, function (r) { return same_(r[LC.STATUS - 1], STATUS.CONVERTED); });
  k.lost = count(leadsF, function (r) { return same_(r[LC.STATUS - 1], STATUS.LOST); });
  k.notContacted = count(leadsF, function (r) { return isOpen(r) && !contactCount[lower(r[LC.ID - 1])]; });
  k.noActivity = count(leadsF, function (r) { return !activityCount[lower(r[LC.ID - 1])]; });
  k.rate = k.total ? k.converted / k.total : 0;

  // A. Stage-wise (all stages in Stage Master order)
  var stageRows = input.stageInfo.list.slice(0, DASH_SIZES.stage).map(function (s) {
    var cur = leadsF.filter(function (r) { return same_(r[LC.STAGE - 1], s.name); });
    var lg = logPF.filter(function (l) { return isContact(l) && same_(l[LG.STAGE - 1], s.name); });
    return [s.name, cur.length, uniq(lg, function () { return true; }), lg.length, count(cur, isOverdue),
      count(cur, function (r) { return same_(r[LC.STATUS - 1], STATUS.CONVERTED); }), k.total ? cur.length / k.total : 0];
  });

  // B. Substage-wise: every stage/substage pair of Stage Master, under its own parent stage
  var pairs = [];
  input.stageInfo.list.forEach(function (s) {
    var subs = Object.keys(s.allSubs).map(function (x) { return s.allSubs[x]; });
    if (!subs.length) subs = [''];
    subs.forEach(function (sub) { pairs.push([s.name, sub]); });
  });
  var subRows = pairs.slice(0, DASH_SIZES.substage).map(function (p) {
    var cur = leadsF.filter(function (r) { return same_(r[LC.STAGE - 1], p[0]) && same_(r[LC.SUBSTAGE - 1], p[1]); });
    return [p[0], p[1], cur.length,
      uniq(logPF, function (l) { return isContact(l) && same_(l[LG.STAGE - 1], p[0]) && same_(l[LG.SUBSTAGE - 1], p[1]); }),
      count(cur, function (r) { return same_(r[LC.STATUS - 1], STATUS.CONVERTED); })];
  });

  // C. Counsellor-wise
  var names = all ? input.counsellors : [input.selected];
  var cnsRows = names.slice(0, DASH_SIZES.counsellor).map(function (n) {
    var mine = leads.filter(function (r) { return same_(r[LC.OWNER - 1], n); });
    var lg = logP.filter(function (l) { return isContact(l) && same_(l[LG.COUNSELLOR - 1], n); });
    var worked = uniq(lg, function () { return true; });
    var conv = count(mine, function (r) { return same_(r[LC.STATUS - 1], STATUS.CONVERTED); });
    return [n, mine.length, worked, lg.length, count(mine, isPending), count(mine, isOverdue), conv,
      mine.length ? conv / mine.length : 0,
      count(mine, function (r) { return isOpen(r) && !contactCount[lower(r[LC.ID - 1])]; }),
      worked ? lg.length / worked : 0];
  });

  // F. Ageing (open leads by age since creation; due/overdue follow-ups by days overdue)
  var ageDays = function (t) { return t >= todayStart ? 0 : Math.ceil((todayStart - t) / DAY); };
  var ageRows = input.buckets.slice(0, DASH_SIZES.ageing).map(function (b) {
    var min = Number(b[1]) || 0, max = b[2] === '' || b[2] === null ? Infinity : Number(b[2]);
    var openLeads = count(leadsF, function (r) {
      var t = ms(r[LC.CREATED - 1]);
      if (!isOpen(r) || isNaN(t)) return false;
      var a = ageDays(t); return a >= min && a <= max;
    });
    var fuAge = count(leadsF, function (r) {
      var t = nextMs(r);
      if (!isOpen(r) || isNaN(t) || t >= tomorrowStart) return false;
      var d = Math.round((todayStart - t) / DAY); return d >= min && d <= max;
    });
    return [b[0], min, b[2], openLeads, fuAge];
  });
  var distRows = function (list, col) {
    return list.slice(0, DASH_SIZES.ageing).map(function (v) {
      return [v, count(leadsF, function (r) { return same_(r[col - 1], v); })];
    });
  };

  // G. Exceptions
  var byCreated = function (a, b) { return (ms(a[LC.CREATED - 1]) || 0) - (ms(b[LC.CREATED - 1]) || 0); };
  var unassigned = leads.filter(function (r) { return isOpen(r) && !str_(r[LC.OWNER - 1]); }).sort(byCreated);
  var unworked = leadsF.filter(function (r) { return !activityCount[lower(r[LC.ID - 1])]; }).sort(byCreated);
  var flagged = count(leadsF, function (r) { return str_(r[LC.DQ_FLAGS - 1]) !== ''; });

  // D. Daily trend
  var dailyRows = [];
  for (var d = input.fromKey, i = 0; d <= input.toKey && i < DASH_SIZES.daily; d = addDaysKey_(d, 1), i++) {
    var s = dateFromKey_(d).getTime(), e = dateFromKey_(addDaysKey_(d, 1)).getTime();
    var day = logPF.filter(function (l) { var t = ms(l[LG.TIME - 1]); return t >= s && t < e; });
    var conv = logP.filter(function (l) {
      var t = ms(l[LG.TIME - 1]);
      return t >= s && t < e && same_(l[LG.FIELD - 1], 'Lead Status') && same_(l[LG.NEW - 1], STATUS.CONVERTED) &&
        (all || same_(l[LG.OWNER - 1], input.selected));
    }).length;
    dailyRows.push([dateFromKey_(d), count(day, isWork), uniq(day, isContact), count(day, isContact), conv]);
  }

  // E. Due today / overdue
  var pending = leadsF.filter(function (r) { var t = nextMs(r); return isOpen(r) && !isNaN(t) && t < tomorrowStart; })
    .map(function (r) {
      return [r[LC.ID - 1], r[LC.NAME - 1], r[LC.MOBILE - 1], r[LC.OWNER - 1], r[LC.STAGE - 1], r[LC.SUBSTAGE - 1],
        r[LC.NEXT_FU - 1], Math.round((todayStart - nextMs(r)) / DAY), r[LC.LAST_ACTIVITY - 1]];
    })
    .sort(function (a, b) { return b[7] - a[7]; });

  return {
    kpi: k, stage: stageRows, substage: subRows, counsellor: cnsRows, ageing: ageRows,
    status: distRows(input.statuses, LC.STATUS), source: distRows(input.sources, LC.SOURCE),
    unassigned: unassigned.slice(0, DASH_SIZES.exceptions).map(function (r) { return [r[LC.ID - 1], r[LC.NAME - 1], r[LC.MOBILE - 1], r[LC.CREATED - 1]]; }),
    unworked: unworked.slice(0, DASH_SIZES.exceptions).map(function (r) { return [r[LC.ID - 1], r[LC.NAME - 1], r[LC.OWNER - 1], r[LC.CREATED - 1]]; }),
    exceptionSummary: 'Unassigned (open): ' + unassigned.length + '   |   Unworked: ' + unworked.length +
      '   |   Leads with data-quality flags: ' + flagged,
    daily: dailyRows, pending: pending.slice(0, DASH_SIZES.pending), pendingTotal: pending.length
  };
}

/* ================================================================== */
/* Refresh (reads the sheets once, writes values in blocks)            */
/* ================================================================== */

function refreshDashboardData_() {
  var raw = PropertiesService.getDocumentProperties().getProperty(PROP.DASH_LAYOUT);
  if (!raw) return null;
  var layout = JSON.parse(raw);
  var sh = getSheet_(SHEET.DASHBOARD);
  clearMemo_();
  var ctl = sh.getRange('B4:L4').getValues()[0];   // B4..L4 -> indexes: C=1, F=4, I=7, L=10
  var period = dashboardPeriod_(str_(ctl[1]), ctl[4], ctl[7]);
  var selected = str_(ctl[10]);

  var leadsSheet = getSheet_(SHEET.LEADS);
  var last = lastLeadRow_(leadsSheet);
  var leads = last >= 2 ? leadsSheet.getRange(2, 1, last - 1, LEAD_COLS).getValues() : [];
  var logSheet = getSheet_(SHEET.LOG);
  var lastLog = logSheet.getLastRow();
  var log = lastLog >= 2 ? logSheet.getRange(2, 1, lastLog - 1, LOG_COLS).getValues() : [];
  var settings = getSheet_(SHEET.SETTINGS);
  var lastS = Math.max(settings.getLastRow(), 2);
  var lists = getLists_();
  var buckets = settings.getRange(2, LS.BUCKET_LABEL, lastS - 1, 3).getValues().filter(function (r) { return str_(r[0]); });

  var res = computeDashboard_({
    leads: leads, log: log, stageInfo: getStageInfo_(),
    counsellors: getCounsellors_().map(function (c) { return c.name; }),
    buckets: buckets, statuses: lists.statuses, sources: lists.sources,
    fromKey: period.fromKey, toKey: period.toKey, todayKey: todayKey_(), selected: selected
  });

  sh.getRange('C5').setValue(dateFromKey_(period.fromKey));
  sh.getRange('F5').setValue(dateFromKey_(period.toKey));
  sh.getRange('K5').setValue(period.warning);
  DASH_KPIS.forEach(function (kp) {
    var cell = layout.cards[kp[1]];
    if (cell) sh.getRange(cell[0], cell[1]).setValue(res.kpi[kp[0]]);
  });
  writeBlock_(sh, layout.stage, 2, 7, res.stage);
  writeBlock_(sh, layout.substage, 2, 5, res.substage);
  writeBlock_(sh, layout.counsellor, 2, 10, res.counsellor);
  writeBlock_(sh, layout.ageing, 2, 5, res.ageing);
  writeBlock_(sh, layout.ageing, 8, 2, res.status);
  writeBlock_(sh, layout.ageing, 11, 2, res.source);
  sh.getRange(layout.exceptions.title, 8).setValue(res.exceptionSummary);
  writeBlock_(sh, layout.exceptions, 2, 4, res.unassigned.length ? res.unassigned : [['None', '', '', '']]);
  writeBlock_(sh, layout.exceptions, 7, 4, res.unworked.length ? res.unworked : [['None', '', '', '']]);
  writeBlock_(sh, layout.daily, 2, 5, res.daily);
  writeBlock_(sh, layout.pending, 2, 9, res.pending.length ? res.pending : [['No follow-ups due today or overdue.', '', '', '', '', '', '', '', '']]);
  writeDashboardTimestamp_(sh);

  // Rebuild charts only when the number of rows they cover has changed.
  var counts = JSON.stringify({ stage: res.stage.length, substage: res.substage.length, counsellor: res.counsellor.length,
    status: res.status.length, ageing: res.ageing.length });
  var props = PropertiesService.getDocumentProperties();
  if (props.getProperty(PROP.DASH_CHART_COUNTS) !== counts) {
    try {
      buildDashboardCharts_(sh, layout, JSON.parse(counts));
      props.setProperty(PROP.DASH_CHART_COUNTS, counts);
    } catch (e) { console.warn('Charts not rebuilt: ' + e); }
  }
  return res;
}

/** Writes rows into a section block and blanks the unused rows below (one setValues). */
function writeBlock_(sh, sec, col, width, rows) {
  var out = [];
  for (var i = 0; i < sec.n; i++) {
    var r = rows[i] ? rows[i].slice(0, width) : [];
    while (r.length < width) r.push('');
    out.push(r.map(function (v) { return v === null || v === undefined || v === Infinity ? '' : v; }));
  }
  sh.getRange(sec.data, col, sec.n, width).setValues(out);
}

function buildDashboardCharts_(sh, layout, n) {
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  var hdr = function (sec, col, rows) { return sh.getRange(sec.data - 1, col, Math.max(rows, 1) + 1, 1); };
  var add = function (type, ranges, anchorRow, title, opts) {
    var b = sh.newChart().setChartType(type);
    ranges.forEach(function (r) { b.addRange(r); });
    b.setPosition(anchorRow, DASH.CHART_COL, 0, 0)
      .setNumHeaders(1)
      .setHiddenDimensionStrategy(Charts.ChartHiddenDimensionStrategy.IGNORE_BOTH)
      .setOption('title', title)
      .setOption('titleTextStyle', { color: COLORS.navy, fontSize: 13, bold: true })
      .setOption('legend', { position: 'bottom' })
      .setOption('colors', COLORS.palette)
      .setOption('width', 640)
      .setOption('height', 320)
      .setOption('backgroundColor', '#FFFFFF');
    Object.keys(opts || {}).forEach(function (k) { b.setOption(k, opts[k]); });
    sh.insertChart(b.build());
  };
  add(Charts.ChartType.BAR, [hdr(layout.stage, 2, n.stage), hdr(layout.stage, 3, n.stage), hdr(layout.stage, 4, n.stage)],
    layout.stage.title, 'Leads by Stage (current) and Leads Worked in Period');
  add(Charts.ChartType.COLUMN, [hdr(layout.counsellor, 2, n.counsellor), hdr(layout.counsellor, 4, n.counsellor), hdr(layout.counsellor, 5, n.counsellor)],
    layout.counsellor.title, 'Counsellor Productivity (selected period)');
  add(Charts.ChartType.LINE, [hdr(layout.daily, 2, layout.daily.n), hdr(layout.daily, 3, layout.daily.n),
    hdr(layout.daily, 4, layout.daily.n), hdr(layout.daily, 5, layout.daily.n)],
    layout.daily.title, 'Daily Activity Trend', { pointSize: 4 });
  add(Charts.ChartType.PIE, [hdr(layout.ageing, 8, n.status), hdr(layout.ageing, 9, n.status)],
    layout.ageing.title, 'Lead Distribution by Status', { pieHole: 0.45 });
  add(Charts.ChartType.COLUMN, [hdr(layout.ageing, 2, n.ageing), hdr(layout.ageing, 5, n.ageing), hdr(layout.ageing, 6, n.ageing)],
    layout.ageing.title + 17, 'Lead Ageing & Follow-Up Ageing (open leads)');
  add(Charts.ChartType.BAR, [hdr(layout.substage, 3, n.substage), hdr(layout.substage, 4, n.substage)],
    layout.substage.title, 'Current Leads by Substage', { height: Math.max(320, n.substage * 22) });
}

/** Forces a chart rebuild on the next refresh (e.g. after setup). */
function refreshDashboardCharts_() {
  PropertiesService.getDocumentProperties().deleteProperty(PROP.DASH_CHART_COUNTS);
  refreshDashboardData_();
}

/** Menu: Lead CRM > Refresh Dashboard. */
function refreshDashboard() {
  registerCurrentUser_();
  var sh = getSheet_(SHEET.DASHBOARD);
  try {
    refreshDashboardData_();
    ss_().setActiveSheet(sh);
    toast_('Dashboard refreshed.');
  } catch (e) {
    toast_('Dashboard could not be refreshed (' + e.message + '). Only CRM administrators can refresh it.', 10);
  }
}
