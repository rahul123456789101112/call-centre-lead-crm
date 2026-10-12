/**
 * DataQuality.gs
 * Data Quality Flags (Lead Management column AH) are computed by the script. They begin with
 * "Incomplete: ..." when a required field is missing (Validation.gs). They used to be a 10,000-row
 * ARRAYFORMULA, which recalculated for EVERY edit and was the largest single cause of sheet slowness.
 *
 * Flags are rewritten:
 *  - for the edited rows by the installable edit trigger and the follow-up form / web app;
 *  - for all rows by the hourly maintenance trigger ("Overdue follow-up" changes with the date)
 *    and by Lead CRM > Admin > Recalculate data-quality flags.
 */

/** Duplicate key for a phone number: last 10 digits (so +91 98..., 098... and 98... match). */
function mobileKey_(v) {
  var d = str_(v).replace(/\D/g, '');
  return d.length > 10 ? d.slice(-10) : d;
}

/** Everything needed to compute flags, built once per execution. extraRows = leads not written yet. */
function buildDqEnv_(sheet, extraRows) {
  var settings = getSettings_();
  var mobiles = {}, emails = {};
  var count = function (m, e) {
    m = mobileKey_(m); e = str_(e).toLowerCase();
    if (m) mobiles[m] = (mobiles[m] || 0) + 1;
    if (e) emails[e] = (emails[e] || 0) + 1;
  };
  var last = lastLeadRow_(sheet);
  if (last >= 2) sheet.getRange(2, LC.MOBILE, last - 1, 2).getValues().forEach(function (r) { count(r[0], r[1]); });
  (extraRows || []).forEach(function (r) { count(r[LC.MOBILE - 1], r[LC.EMAIL - 1]); });
  var re = null;
  try { re = settings.mobilePattern ? new RegExp(settings.mobilePattern) : null; } catch (e) { re = null; }
  var active = {};
  activeCounsellorNames_().forEach(function (n) { active[n.toLowerCase()] = true; });
  return {
    settings: settings, stageInfo: getStageInfo_(), mobileRe: re, mobiles: mobiles, emails: emails,
    activeCns: active, todayStart: todayDate_().getTime(), validation: validationEnv_()
  };
}


/**
 * Flags for one lead row ('' = no problems). Missing required fields come first as
 * "Incomplete: <fields>" (that text turns the Lead ID red and is counted on the Dashboard).
 */
function computeDqFlags_(row, env) {
  if (!str_(row[LC.ID - 1])) return '';
  var f = [];
  var snap = parseSnapshot_(row[LC.SNAPSHOT - 1]);
  var missing = incompleteFields_(row, snap ? snap.p : [], env.validation);
  if (missing.length) f.push('Incomplete: ' + missing.join(', '));
  var mobile = str_(row[LC.MOBILE - 1]);
  if (!mobile) f.push('Missing mobile');
  else {
    if (env.mobileRe && !env.mobileRe.test(mobile)) f.push('Invalid mobile format');
    if (!same_(env.settings.dupMobile, 'Off') && env.mobiles[mobileKey_(mobile)] > 1) f.push('Duplicate mobile');
  }
  var email = str_(row[LC.EMAIL - 1]);
  if (email) {
    if (!EMAIL_RE.test(email)) f.push('Invalid email');
    if (!same_(env.settings.dupEmail, 'Off') && env.emails[email.toLowerCase()] > 1) f.push('Duplicate email');
  }
  var owner = str_(row[LC.OWNER - 1]);
  if (!owner) f.push('Unassigned');
  else if (!env.activeCns[owner.toLowerCase()]) f.push('Inactive/unknown counsellor');
  var stage = str_(row[LC.STAGE - 1]), sub = str_(row[LC.SUBSTAGE - 1]);
  if (stage && !env.stageInfo.isActiveStage(stage)) f.push('Inactive/unknown stage');
  if (sub && !env.stageInfo.isActivePair(stage, sub)) f.push('Substage not valid for stage');
  var lc = row[LC.LAST_CONTACT - 1];
  if (lc !== '' && !isDate_(lc)) f.push('Invalid last contact date');
  var open = !isClosedStatus_(row[LC.STATUS - 1]);
  var nf = row[LC.NEXT_FU - 1];
  if (nf === '' || nf === null) { if (open) f.push('No next follow-up date'); }
  else if (!isDate_(nf)) f.push('Invalid follow-up date');
  else if (open && nf.getTime() < env.todayStart) f.push('Overdue follow-up');
  return f.join('; ');
}

/** Writes flags for the given row indexes of a processed block (one setValues for the span). */
function writeDqFlagsForBlock_(sheet, startRow, data, idxList) {
  var env = buildDqEnv_(sheet);
  var min = Math.min.apply(null, idxList), max = Math.max.apply(null, idxList);
  var current = sheet.getRange(startRow + min, LC.DQ_FLAGS, max - min + 1, 1).getValues();
  idxList.forEach(function (i) { current[i - min][0] = computeDqFlags_(data[i], env); });
  sheet.getRange(startRow + min, LC.DQ_FLAGS, max - min + 1, 1).setValues(current);
}

/** Recomputes the flags of every lead (one read, one write). Caller should hold the lock. */
function refreshDataQuality_() {
  var sheet = getSheet_(SHEET.LEADS);
  var last = lastLeadRow_(sheet);
  if (last < 2) return 0;
  var env = buildDqEnv_(sheet);
  var data = sheet.getRange(2, 1, last - 1, LEAD_COLS).getValues();
  sheet.getRange(2, LC.DQ_FLAGS, data.length, 1).setValues(data.map(function (r) { return [computeDqFlags_(r, env)]; }));
  return data.length;
}

/** Admin > Recalculate data-quality flags. */
function recalculateDataQuality() {
  requireAdmin_();
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var n = refreshDataQuality_();
    toast_('Data-quality flags recalculated for ' + n + ' rows.');
  } finally {
    lock.releaseLock();
  }
}
