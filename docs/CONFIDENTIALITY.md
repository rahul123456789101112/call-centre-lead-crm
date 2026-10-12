# Confidentiality: Counsellor Web App (Design and Build)

## The problem

Anyone who can **edit or view** a Google Sheet can copy or export all of it:
- File → Make a copy
- File → Download (xlsx/csv/pdf)
- File → Print
- select all → copy

Protected ranges only stop *editing*, not *reading*. Google Sheets cannot show a user only some rows. So as long as counsellors are editors of the master spreadsheet, they can take every lead, including other counsellors' leads.

## Proposal

Counsellors stop opening the spreadsheet. They use a **web app built into the same Apps Script project**:

```
 Counsellor's browser                     Google (Apps Script, runs as the CRM owner)          Master spreadsheet
 ───────────────────                      ─────────────────────────────────────────           (shared with admins only)
 https://script.google.com/.../exec  ──►  doGet(): who is signed in?  (Session.getActiveUser)
                                          ├─ not an ACTIVE counsellor/admin → "Access denied" + Access Log
                                          └─ portal page
 list / open / save / log follow-up  ──►  portal*() functions:
                                          1. re-identify the user on EVERY call
                                          2. only rows whose Assigned Counsellor = this user   ◄──  Lead Management
                                          3. only fields NOT in "Counsellor-Locked Fields"     ──►  Lead Management
                                          4. same validation, IDs, audit trail as the sheet    ──►  Follow-Up Log
                                          5. one Access Log row per view / edit / denial       ──►  Access Log
```

| Decision | Why |
|---|---|
| **Execute as: Me (owner)** | The script reads and writes the spreadsheet with the owner's rights, so counsellors need **no access to the file** at all. |
| **Who has access: Anyone within *companyname.com*** | Google requires a signed-in account from your domain. Because visitor and owner are in the same Workspace domain, `Session.getActiveUser().getEmail()` returns the visitor's real email. |
| **Counsellor Master is the allow-list** | An email that is not an **Active** counsellor (or a CRM admin) gets "Access denied". Deactivating a counsellor removes access immediately; no redeploy is needed. |
| **Server-side filtering** | The browser only ever receives that counsellor's leads (max 300 per list), and only the fields the app shows. Ownership is re-checked on every open, save and follow-up, so a crafted request for another Lead ID is refused and logged. |
| **Server-side field locks** | Edits to fields in *Counsellor-Locked Fields* (and all system fields) are rejected on the server even if the browser sends them. |
| **One write path** | Saves use the same functions as the sheet: lead IDs, the stage→substage rule, the audit trail in Follow-Up Log, data-quality flags and the LockService locking. |
| **Access Log sheet** | Admin-only. One row per event: *Portal Opened, Leads Listed* (with the IDs shown), *Lead Viewed, Lead Updated* (field: old → new), *Follow-Up Logged, Access Denied, Copy In Browser (reported)*, *Spreadsheet Opened* (admins, via installable onOpen). |

**Counsellors can:**
- see their own leads, filtered by due/overdue, open or all, and search them;
- open a lead and call it (the mobile number is a `tel:` link);
- edit unlocked fields: stage/substage (the substage is cleared on a stage change), priority, next follow-up, outcome, remarks, status, active custom fields;
- log follow-ups;
- see recent history.

**Admins** using the web app see all leads.

The sheet's **Log Follow-Up** sidebar embeds the same web app for non-admins. That keeps one code path that works under strict protection.

### Go-live steps
1. Deploy the web app (SETUP.md → *Counsellor web app*).
2. Send counsellors the link (**Lead CRM → Open counsellor web app** shows it).
3. Remove counsellors from the spreadsheet's sharing (Share → remove, or set them to no access). Keep only admins as editors.
4. Optional: in the Share dialog → ⚙, untick *Viewers and commenters can see the option to download, print, and copy*.

## What can and cannot be logged

| Event | Logged? | How |
|---|---|---|
| Web app opened, list viewed (IDs shown), lead opened, lead edited (old → new), follow-up saved, access refused | **Yes**, reliably | Access Log sheet, written by the server with the authenticated email and a timestamp |
| Field changes made in the spreadsheet by admins | **Yes** | Follow-Up Log audit entries (owner/stage/substage/status/next follow-up) plus Last Updated By/Timestamp; e.user identifies the editor in your Workspace domain |
| Admin opened the spreadsheet | **Yes** | Installable onOpen trigger → Access Log (*Spreadsheet Opened*) |
| Copy (Ctrl+C) inside the web app | **Partly** | The page reports a `copy` event (throttled to one per 30 s). It is easily bypassed (screenshots, phone camera, browser dev tools, disabled JavaScript), so treat it as an indicator, not proof. |
| Screenshot, photo of the screen, print of the web page, browser "Save page" | **No** | No web technology can detect these reliably |
| File → Download / Make a copy / Print **of the spreadsheet** | **Not by Apps Script** | Scripts get no event for these. They appear in the **Google Workspace Drive audit log** (Admin console → Reporting → Audit and investigation → *Drive log events*): Download, Copy, Print, View and Change access, with user, file and time. Availability and retention depend on your Workspace edition (for example, Business Standard/Plus and Enterprise include Drive log events; check your edition). A Workspace admin can also create alerts or reporting rules on these events. |
| Data copied out of Google entirely | **No** | Use policy and access minimisation: counsellors only ever receive their own leads |

**Additional Workspace controls** (configured by your Google Workspace administrator, not by this script):
- Drive sharing settings: block sharing outside the domain.
- Restricting download/print/copy for viewers and commenters.
- Data-loss-prevention (DLP) rules and Context-Aware Access (edition dependent).

## Residual risks (and why the design still helps)
- **A counsellor can still record what is on screen.** The difference from before is that they only ever see **their own** leads, and every access is logged.
- **Admins and the owner keep full access** and can download the master file. Keep this group small; the Drive audit log covers them.
- **Hidden ≠ secret** applies only to the spreadsheet, which counsellors no longer open.
- **Deployment access.** If the web app is mistakenly deployed as *Anyone* (including anonymous) instead of *Anyone within companyname.com*, `getActiveUser()` returns an empty email and the app denies everyone. It fails safe, but redeploy correctly.
- **Code changes.** Apps Script web apps serve the code version chosen in the deployment. After updating the code, edit the deployment and select **New version** (SETUP.md).
