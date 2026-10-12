# Confidentiality: Spreadsheet vs. Counsellor Web App

## Version 2: counsellors work in the spreadsheet

From version 2, counsellors are **Editors of the spreadsheet** and do their daily work in Lead Management. The web app described below is an **optional extra** for people who should not have the file at all.

Working in the spreadsheet is simpler and faster for counsellors, and the CRM controls what they can **change** (sheet protection, strict validation and the edit guard that undoes anything not allowed). It cannot control what they can **see or take away**. Before choosing, know the trade-off:

| | Counsellors as spreadsheet Editors (default) | Counsellors on the web app only |
|---|---|---|
| What they can **see** | **Every lead of every counsellor**, all hidden sheets (any editor can unhide them), Follow-Up Log, Access Log, settings | Only their own leads |
| Copy / download / print the whole file | **Yes, always.** File → Download, Make a copy, Print, select-all → copy. Protection and hidden sheets do not prevent it, and with a personal Gmail owner it is **not logged** anywhere | No (they never get the file) |
| What they can **change** | Only the white cells of their own leads, with valid values; everything else is undone and logged | Same rules, enforced on the server |
| The Apps Script project | **Any spreadsheet editor can open Extensions → Apps Script**, read the code and Script Properties (including the web-app sign-in secret and the identity map) and **change the code**. The owner's triggers then run the changed code. This cannot be prevented in a container-bound script | No access |
| Speed and ease | Fastest; they see the whole sheet, filter views, the follow-up form | Simple list + form in the browser |

**Recommendations**
- Give edit access only to counsellors you would trust with the whole lead list.
- In **Share → ⚙**, untick *Editors can change permissions and share*.
- People who must not take the lead list: remove them from the spreadsheet and give them the web app link instead.
- Check **Extensions → Apps Script → Project history / Executions** now and then; keep a copy of the code from this repository so it can be re-pasted.

The rest of this document describes the optional web app.

## The problem the web app solves

Anyone who can **edit or view** a Google Sheet can copy or export all of it. Protected ranges only stop *editing*, not *reading*, and Google Sheets cannot show a user only some rows.

## Proposal

Counsellors who should not have the file use a **web app built into the same Apps Script project**, plus a tiny **sign-in app** (a separate project) that tells the web app who they are.

```
 Counsellor (any Google account:            SIGN-IN APP (separate project)               MAIN WEB APP (CRM project)            Master spreadsheet
 Gmail, company email, other)               runs AS THE VISITOR                          runs AS THE OWNER                     (shared with admins only)
 ──────────────────────────────             ───────────────────────────────              ──────────────────────────             ─────────────────────────
 opens the counsellor link        ───►      Session.getActiveUser() = visitor's
                                            verified email (permission: "see your
                                            email address" - nothing else)
                                            token = email|expiry(5 min)|nonce
                                                    + HMAC-SHA256(shared secret)   ───►   verify signature, expiry, single use
                                                                                          access rule: ACTIVE in Counsellor
                                                                                          Master, or in Admin Emails
                                                                                          ├─ no  → "Access denied" + Access Log
                                                                                          └─ yes → 6-hour session (random ID)
 list / open / save / log follow-up  ─────────────────────────────────────────────►       every call: session → email →
                                                                                          access rule again → only own leads,     ◄──  Lead Management
                                                                                          only unlocked fields, same audit trail  ──►  Lead Management / Follow-Up Log
                                                                                          one Access Log row per view / edit      ──►  Access Log
```

### Why a separate sign-in app?

The owner is a personal Gmail account, and counsellors may use **any** email that has a Google account. The main web app has to run **as the owner** so that it can read the spreadsheet counsellors no longer have access to. It is open to **Anyone with a Google account**.

In that combination Google does **not** reveal the visitor's identity: `Session.getActiveUser().getEmail()` returns an empty string for everyone except the owner. That is Google's privacy rule for scripts that run as someone else, and it applies to personal accounts.

An app that runs **as the visitor** does get the visitor's email, once they approve the single permission "See your primary Google Account email address".

The sign-in app is that app:
- It has no other permissions and never touches the spreadsheet.
- It proves the email to the main app with a signed token.
- The main app only trusts tokens signed with the secret shared between the two projects (stored in Script Properties, never in code or URLs). Tokens expire after 5 minutes and work only once.
- After sign-in, the browser holds only a random 64-character session ID (in page memory, not in a cookie or URL). Every server call re-checks that session and the access rule.

A single app running as the visitor would also know the email. But it would then need the visitor to have access to the spreadsheet, which defeats the purpose. Putting both deployments in one project would show counsellors a permission screen listing all the CRM's permissions (spreadsheets, triggers, email sending). The separate project keeps their permission screen to "see your email address".

### Design decisions

| Decision | Why |
|---|---|
| **Main app: Execute as Me (owner), access Anyone with a Google account** | Counsellors need **no access to the file**. Any Google account can reach the app, and the access rule decides who may use it. |
| **Access rule = Counsellor Master (Active) + Admin Emails, nothing else** | No domain or account-type restrictions. Deactivating a counsellor or removing an admin email takes effect on their next click; no redeploy is needed. |
| **Email matching** | Case-insensitive. For Gmail, dots, `+tags` and `googlemail.com` are ignored, because Google treats `Jane.Doe@gmail.com` and `janedoe@googlemail.com` as the same account. Other providers must match exactly. |
| **Server-side filtering** | The browser only receives that counsellor's leads (max 300 per list). Ownership is re-checked on every open, save and follow-up, so a crafted request for another Lead ID is refused and logged. |
| **Server-side field rules** | Only *Counsellor-Editable Fields* can be changed, with the same validation as the sheet (Validation.gs); anything else is refused on the server even if the browser sends it. |
| **One write path** | Saves use the same functions as the sheet: the stage→substage rule, required fields (Incomplete), the audit trail in Follow-Up Log, data-quality flags and LockService locking. The follow-up form has the same fields and refuses to save until they are filled. |
| **Access Log sheet** | Admin-only. One row per event: *Portal Opened, Leads Listed* (with the IDs shown), *Lead Viewed, Lead Updated* (field: old → new), *Follow-Up Logged, Access Denied, Copy In Browser (reported)*, *Spreadsheet Opened*. |

**Counsellors can:**
- see their own leads, filtered by due/overdue, open or all, and search them;
- open a lead and call it (the mobile number is a `tel:` link);
- edit their editable fields;
- log follow-ups (Outcome, Stage, Substage, Next Follow-Up Date, Remarks);
- see recent history.

**Admins** (Admin Emails) using the web app see all leads.

### Go-live steps
1. Deploy the main web app and the sign-in app (SETUP.md §7).
2. Send the **counsellor link** (the sign-in app's URL, shown by **Lead CRM → Admin → Counsellor web app link**) to the people who should use it.
3. Remove those people from the spreadsheet's sharing.
4. Optional: in the Share dialog → ⚙, untick *Viewers and commenters can see the option to download, print, and copy*.

## What can and cannot be logged

| Event | Logged? | How |
|---|---|---|
| Web app opened, list viewed (IDs shown), lead opened, lead edited (old → new), follow-up saved, access refused | **Yes**, reliably | Access Log, written by the server using the Google-verified email from the sign-in app |
| Field changes made in the spreadsheet | **Yes** | Follow-Up Log audit entries (old → new), Last Updated By / Timestamp, and *Edit Reverted* entries for refused changes. The editor is identified by the temporary-key hand-off (SETUP.md §5); edits by people the CRM cannot identify are undone (setting *Block Edits From Unknown Users*). |
| Someone opened the spreadsheet | **Yes**, for registered editors | Installable onOpen trigger + key hand-off → Access Log (*Spreadsheet Opened*) |
| Copy (Ctrl+C) inside the web app | **Partly** | The page reports a `copy` event (at most one per 30 s). Easily bypassed (screenshots, phone camera, dev tools, disabled JavaScript): an indicator, not proof. |
| Screenshot, photo of the screen, print of the web page, browser "Save page" | **No** | No web technology can detect these reliably |
| File → Download / Make a copy / Print **of the spreadsheet** | **No** | Apps Script gets no event for these. With a **personal Gmail owner there is no Drive audit log** (that is a paid Google Workspace admin feature). Version history (File → Version history) shows edits only, not views or downloads. |
| Data copied out of Google entirely | **No** | Only prevention helps: counsellors only ever receive their own leads |

So, with a personal Gmail owner, the only reliable protection against bulk export is **not giving a person access to the file at all**, which the web app makes possible. If you ever move the CRM to a Google Workspace (paid) account, the Workspace admin console adds Drive audit logs (download/copy/print/view events), DLP and sharing controls on top.

## Residual risks
- **Counsellors who are spreadsheet Editors can take everything** (see the table at the top). This is the price of working in the sheet.
- **A web-app counsellor can still record what is on screen**, but only **their own** leads, and every access is logged.
- **Admins and the owner keep full access** and can download the master file without any record. Keep the Admin Emails list small.
- **A counsellor can forward their sign-in link.** It only works for whoever signs in with a listed Google account, so a forwarded link is useless to others.
- **Shared Google accounts:** if two people use one Google account, the log cannot tell them apart.
- **The shared secret** lives in Script Properties of both projects. Anyone who can edit either Apps Script project can read it, **and every spreadsheet Editor can open the main project**: with counsellors as Editors, a counsellor could forge a web-app sign-in. Use the web app's access log as an indicator, not as proof, while counsellors are Editors. Keep both projects owned by the CRM owner and do not share them. To rotate it: delete `IDENTITY_SECRET` in the main project's Script Properties, run *Admin → Web app sign-in setup* again, and copy the new value to the sign-in project.
- **Code changes:** web apps serve the version chosen in their deployment. After updating code, edit the deployment and select **New version** (SETUP.md).
