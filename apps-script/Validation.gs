/**
 * Validation.gs
 * One set of rules for every way a lead value can change: typing or pasting in Lead Management
 * (the edit guard in Triggers.gs), Lead Entry, the follow-up form and the web app.
 * Wrong values are refused (never just flagged) with a short plain-English message.
 */

var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
var MAX_NAME_LENGTH = 100;
var MAX_CUSTOM_LENGTH = 100;

/** Everything the rules need, built once per execution. */
function validationEnv_() {
  return memo_('validationEnv', function () {
    var settings = getSettings_();
    var re = null;
    try { re = settings.mobilePattern ? new RegExp(settings.mobilePattern) : null; } catch (e) { re = null; }
    var allowed = {};
    try {
      readCustomFields_().forEach(function (f) { if (f.allowed.length) allowed[customCol_(f.slot)] = f.allowed; });
    } catch (e) { /* settings not built yet */ }
    return {
      settings: settings, stageInfo: getStageInfo_(), lists: getLists_(), mobileRe: re, customAllowed: allowed,
      today: todayKey_()
    };
  });
}

/** Value from a list, matched without regard to case; '' when not in the list. */
function pick_(list, v) {
  var hit = (list || []).filter(function (x) { return same_(x, v); })[0];
  return hit === undefined ? '' : hit;
}

/** Removes spaces, dashes, dots and brackets people type in phone numbers. */
function cleanMobile_(v) { return String(v === null || v === undefined ? '' : v).replace(/[\s\-().]/g, ''); }

/** Columns that hold a dropdown or a date: once filled they cannot be emptied. */
var NO_EMPTY_COLS = [LC.STAGE, LC.PRIORITY, LC.LAST_CONTACT, LC.NEXT_FU, LC.OUTCOME, LC.SOURCE, LC.STATUS];

/**
 * Checks one Lead Management value. `row` holds the row's final values (used for rules that depend on
 * another column, e.g. Substage vs Stage, Status vs Stage, Next Follow-Up vs Status).
 * Returns {ok: true, value: cleanedValue} or {ok: false, msg: 'plain English'}.
 */
function checkLeadValue_(col, value, old, row, env) {
  var s = env.settings, si = env.stageInfo, L = env.lists;
  var label = leadLabel_(col);
  var v = typeof value === 'string' ? value.trim() : value;
  var empty = v === '' || v === null || v === undefined;
  var bad = function (msg) { return { ok: false, msg: msg }; };
  var good = function (x) { return { ok: true, value: x }; };
  var status = str_(row[LC.STATUS - 1]);
  var open = !isClosedStatus_(status);

  if (empty) {
    if (col === LC.NAME) return bad('Lead Name cannot be empty.');
    if (col === LC.MOBILE) return bad('Mobile Number cannot be empty.');
    if (col === LC.NEXT_FU && !open) return good('');
    if (NO_EMPTY_COLS.indexOf(col) >= 0 && str_(old) !== '') return bad(label + ' cannot be emptied. Choose a value instead.');
    return good('');
  }

  switch (col) {
    case LC.NAME:
      v = String(v).replace(/\s+/g, ' ');
      return v.length > MAX_NAME_LENGTH ? bad('Lead Name can have at most ' + MAX_NAME_LENGTH + ' characters.') : good(v);
    case LC.MOBILE:
      v = cleanMobile_(v);
      if (!/^\+?[0-9]+$/.test(v)) return bad('Mobile Number can contain numbers only.');
      if (env.mobileRe && !env.mobileRe.test(v)) return bad(s.mobileMessage);
      return good(v);
    case LC.EMAIL:
      v = String(v).toLowerCase();
      return EMAIL_RE.test(v) ? good(v) : bad('Email ID "' + v + '" is not a valid email address.');
    case LC.OWNER:
      var cns = pick_(activeCounsellorNames_(), v);
      return cns ? good(cns) : bad('"' + v + '" is not an active counsellor. Choose one from the list.');
    case LC.SOURCE:
      var src = pick_(L.sources, v);
      return src ? good(src) : bad('"' + v + '" is not a Lead Source. Choose one from the list.');
    case LC.STAGE:
      if (si.isActiveStage(v)) return good(si.canonicalStage(v));
      if (same_(v, old)) return good(old);   // an old, now inactive stage may stay
      return bad('"' + v + '" is not a Lead Stage. Choose one from the list.');
    case LC.SUBSTAGE:
      var stage = str_(row[LC.STAGE - 1]);
      if (si.isActivePair(stage, v)) return good(si.canonicalSub(stage, v));
      if (same_(v, old) && same_(stage, snapStageFor_(row))) return good(old);
      return bad('"' + v + '" is not a substage of "' + (stage || 'no stage') + '". Choose one from the list.');
    case LC.PRIORITY:
      var pr = pick_(L.priorities, v);
      return pr ? good(pr) : bad('"' + v + '" is not a Lead Priority. Choose one from the list.');
    case LC.OUTCOME:
      var oc = pick_(L.outcomes, v);
      return oc ? good(oc) : bad('"' + v + '" is not an outcome. Choose one from the list.');
    case LC.STATUS:
      var st = pick_(L.statuses, v);
      if (!st) return bad('"' + v + '" is not a Lead Status. Choose one from the list.');
      var stg = str_(row[LC.STAGE - 1]);
      if (s.convertedStage && same_(st, STATUS.CONVERTED) && !same_(stg, s.convertedStage)) {
        return bad('A lead can be "Converted" only when Lead Stage is "' + s.convertedStage + '". Change the stage first.');
      }
      if (s.lostStage && same_(st, STATUS.LOST) && !same_(stg, s.lostStage)) {
        return bad('A lead can be "Lost" only when Lead Stage is "' + s.lostStage + '". Change the stage first.');
      }
      return good(st);
    case LC.LAST_CONTACT:
      if (!isDate_(v)) return bad('Last Contact Date must be a real date. Double-click the cell and pick it from the calendar.');
      if (toDateKey_(v) > env.today) return bad('Last Contact Date cannot be in the future.');
      return good(dateFromKey_(toDateKey_(v)));
    case LC.NEXT_FU:
      if (!isDate_(v)) return bad('Next Follow-Up Date must be a real date. Double-click the cell and pick it from the calendar.');
      var k = toDateKey_(v);
      if (open && k < env.today) return bad('Next Follow-Up Date cannot be in the past.');
      if (k > addDaysKey_(env.today, s.maxFuDays)) return bad('Next Follow-Up Date must be within ' + s.maxFuDays + ' days from today.');
      return good(dateFromKey_(k));
    case LC.REMARKS:
      v = String(v);
      return v.length > s.maxRemarks ? bad('Lead Remarks can have at most ' + s.maxRemarks + ' characters (you entered ' + v.length + ').') : good(v);
    default:
      if (isCustomCol_(col)) {
        var allowed = env.customAllowed[col];
        if (allowed) {
          var cv = pick_(allowed, v);
          return cv ? good(cv) : bad('"' + v + '" is not allowed in ' + label + '. Choose one from the list.');
        }
        v = String(v);
        return v.length > MAX_CUSTOM_LENGTH ? bad(label + ' can have at most ' + MAX_CUSTOM_LENGTH + ' characters.') : good(v);
      }
      return good(v);
  }
}

/** Stage recorded in the row's snapshot (the stage before this edit). */
function snapStageFor_(row) {
  var snap = parseSnapshot_(row[LC.SNAPSHOT - 1]);
  return snap ? snap.s : '';
}

/* ================================================================== */
/* Required fields ("Incomplete")                                      */
/* ================================================================== */

var REQ_NEXT_FU = 'Next Follow-Up Date';

/**
 * Required fields a lead row is missing ([] = complete). `pending` = snapshot.p (requirements created by a
 * change, e.g. a new outcome needs a new follow-up date). Rules come from Lists & Settings.
 */
function incompleteFields_(row, pending, env) {
  if (!str_(row[LC.ID - 1])) return [];
  var s = env.settings, si = env.stageInfo;
  var out = [];
  var stage = str_(row[LC.STAGE - 1]);
  var status = str_(row[LC.STATUS - 1]);
  if (!stage) out.push('Lead Stage');
  if (!status) out.push('Lead Status');
  if (s.requireSubstage && stage && !str_(row[LC.SUBSTAGE - 1]) && si.activeSubs(stage).length) {
    out.push(s.lostStage && same_(stage, s.lostStage) ? 'Lead Substage (lost reason)' : 'Lead Substage');
  }
  // A new follow-up date is needed after a stage or outcome change (see the edit guard / follow-up form).
  if (s.requireNextFu && !isClosedStatus_(status) && (pending || []).indexOf(REQ_NEXT_FU) >= 0) out.push(REQ_NEXT_FU);
  return out;
}
