/**
 * Identity.gs - Lead CRM sign-in app (a SEPARATE, standalone Apps Script project).
 *
 * Why it exists: the main counsellor web app runs as the CRM owner (a personal Google account) and is
 * open to "Anyone with a Google account". In that configuration Google does not tell the main app who
 * the visitor is. This tiny app is deployed with "Execute as: User accessing the web app", so the
 * visitor authorises it once (permission: "See your primary Google Account email address") and
 * Session.getActiveUser().getEmail() returns their real, Google-verified email - for Gmail and any
 * other Google account alike.
 *
 * It signs  email|expiry|nonce  with HMAC-SHA256 using a secret shared with the main project and
 * sends the visitor to the main app, which verifies the signature, the 5-minute expiry and single use.
 * This project never touches the spreadsheet and has no other permissions.
 *
 * Script properties (Project Settings > Script properties):
 *   IDENTITY_SECRET  - copied from the main project (Lead CRM > Admin > Web app sign-in setup)
 *   MAIN_APP_URL     - the main counsellor web app URL (ends with /exec)
 */

var TOKEN_LIFETIME_MS = 5 * 60 * 1000;

function doGet(e) {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('IDENTITY_SECRET');
  var main = props.getProperty('MAIN_APP_URL');
  if (!secret || !main) return page_('Sign-in is not configured', 'Ask the CRM administrator to finish the sign-in setup (docs/SETUP.md).', '');

  var email = '';
  try { email = Session.getActiveUser().getEmail() || ''; } catch (err) { /* not available */ }
  if (!email) {
    return page_('Could not read your Google account', 'Google did not share your email address. Make sure you are signed in ' +
      'to Google and accepted the permission request, then reload this page.', '');
  }

  var payload = [email.toLowerCase(), Date.now() + TOKEN_LIFETIME_MS, Utilities.getUuid()].join('|');
  var sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, secret));
  var token = Utilities.base64EncodeWebSafe(payload) + '.' + sig;
  var lead = String((e && e.parameter && e.parameter.lead) || '').replace(/[^A-Za-z0-9_-]/g, '').substring(0, 40);
  var url = main + '?t=' + encodeURIComponent(token) + (lead ? '&lead=' + encodeURIComponent(lead) : '');
  return page_('Signed in', 'You are signed in as <b>' + esc_(email) + '</b>.', url);
}

function esc_(s) {
  return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}

function page_(title, text, url) {
  var link = url
    ? '<p><a id="go" href="' + esc_(url) + '" target="_top" style="display:inline-block;background:#1F3864;color:#fff;padding:10px 16px;' +
      'border-radius:4px;text-decoration:none;font-weight:600">Continue to Lead CRM</a></p>' +
      '<p style="font-size:12px;color:#5F6B76">The link is valid for 5 minutes and can be used once. Not you? Sign out of Google and open the link again.</p>' +
      '<script>try { window.top.location.href = document.getElementById("go").href; } catch (e) {}</script>'
    : '';
  return HtmlService.createHtmlOutput('<div style="font-family:Roboto,Arial;max-width:560px;margin:40px auto;padding:0 16px;line-height:1.55">' +
    '<h2 style="color:#1F3864">' + esc_(title) + '</h2><p>' + text + '</p>' + link + '</div>')
    .setTitle('Lead CRM sign-in')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
