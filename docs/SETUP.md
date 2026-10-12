# Setup Guide: Install and Authorise the Lead CRM

This builds the complete Call Centre Lead CRM inside a **blank Google Sheet** using the Apps Script files in [`/apps-script`](../apps-script). It needs no paid CRM, add-on or external API.

---

## 1. Install (about 10 minutes, done once by the administrator)

1. Create a new, blank Google Sheet (sheets.new), for example "Lead CRM".
   Use the Google account that will **own** the CRM: a **@companyname.com** Workspace account, ideally a shared team account and not a counsellor's personal account.
   **The owner must run setup and deploy the web app.** The installable triggers and the web app run as that account, which is what lets them write to columns counsellors cannot edit.
2. Set the sheet's time zone: **File → Settings → General → Time zone** (for example, *(GMT+05:30) India Standard Time*).
   All dates, "today", overdue checks and timestamps use this time zone.
3. Open **Extensions → Apps Script**. Rename the project to "Lead CRM".
4. Create these files and paste in the contents from `/apps-script`. Use exactly these names; Apps Script adds `.gs` itself.

   | File in repo | Create in Apps Script as |
   |---|---|
   | `Config.gs` | Script → `Config` |
   | `Setup.gs` | Script → `Setup` |
   | `Triggers.gs` | Script → `Triggers` |
   | `FollowUp.gs` | Script → `FollowUp` |
   | `Menu.gs` | Script → `Menu` |
   | `CustomFields.gs` | Script → `CustomFields` |
   | `DataQuality.gs` | Script → `DataQuality` |
   | `Dashboard.gs` | Script → `Dashboard` |
   | `Web.gs` | Script → `Web` |
   | `FollowUpSidebar.html` | HTML → `FollowUpSidebar` (the name must match exactly) |
   | `Portal.html` | HTML → `Portal` (the name must match exactly) |

   Delete the default `Code.gs` (or replace its contents with one of the files).
5. **Manifest (recommended):** go to **Project Settings (⚙) → tick "Show 'appsscript.json' manifest file in editor"**. Open `appsscript.json` and replace its contents with [`apps-script/appsscript.json`](../apps-script/appsscript.json).
   This limits the script to *the current spreadsheet only* and to the five scopes listed in §3.
   Change `"timeZone"` to match step 2 if you are not in India.
6. Save (Ctrl/Cmd + S).
7. In the function dropdown at the top of the editor, choose **`setupWorkbook`** and click **Run**. Use **Run**, not **Debug**: the debugger is much slower and can hit the time limit.
   - To try the CRM quickly first, choose **`setupWorkbookQuickTest`** instead. It builds the same workbook with **1,000** lead rows instead of 10,000. You can grow it later with *Admin → Extend Lead Management by 5,000 rows*, or by running `setupWorkbook`.
8. Authorise when prompted (see §2).
9. Keep the spreadsheet tab open. Each stage shows a toast there ("Stage 3 of 10: …"), and the execution log in the editor records how long each stage took.
10. **If the message says "Setup is NOT finished yet", run `setupWorkbook` again.** See *Setup runs in stages* below.
11. When the message says **"Lead CRM created"**, go back to the spreadsheet and **reload the page**. A **Lead CRM** menu appears after a few seconds.

### Setup runs in stages

Apps Script stops any run after 6 minutes, so setup is split into 10 stages:

1. Create sheets
2. Lists & Settings
3. Stage Master & Counsellor Master
4. Lead Management layout
5. Lead Management validation & colours
6. Follow-Up Log
7. Lead Management formulas
8. Dashboard reports
9. Dashboard charts
10. Protections & triggers

How a run proceeds:
- Progress is saved in the document's properties after each stage.
- A run will not start a stage it expects to push it past about 4.5 minutes. It stops cleanly and shows *"Setup is NOT finished yet: completed N of 10 stages… run it again to continue from stage N+1"*.
- Running `setupWorkbook` again continues from the next stage; finished stages are not repeated.
- Each stage is safe to repeat. If a run is killed mid-stage (for example by the 6-minute limit), the next run simply redoes that stage.
- On a typical sheet setup finishes in one or two runs.
- **Lead CRM → Admin → Restart setup from the first stage** forgets the saved progress. Your data is not touched.
- **Lead CRM → Admin → Run health check** shows "Setup unfinished" while stages remain.

Setup messages appear in a small dialog that does **not** pause the script. (An "OK"-style alert would make the script wait until someone clicked it in the spreadsheet tab.)

> Re-running `setupWorkbook` (or **Lead CRM → Admin → Set up / repair workbook**) after setup has finished is a safe repair. It keeps every lead, log entry, master row, setting and renamed custom field, and rebuilds formatting, validation, protections and the Dashboard.

## 2. Authorisation

The first time you run setup, Google shows **"Authorization required"**:

1. Click **Review permissions** and choose your account.
2. You may see **"Google hasn't verified this app"**. This is normal for a private script you wrote yourself. Click **Advanced → Go to Lead CRM (unsafe)**.
3. Click **Allow**.

### Counsellor web app (recommended for confidentiality)

Counsellors work in a web app instead of the spreadsheet; [CONFIDENTIALITY.md](CONFIDENTIALITY.md) explains why. As the **owner**:

1. In the Apps Script editor: **Deploy → New deployment → ⚙ Select type → Web app**.
2. Description: `Counsellor portal`.
3. **Execute as: Me (owner@companyname.com)**.
4. **Who has access: Anyone within companyname.com**. Not "Anyone". The included `appsscript.json` pre-sets these two values (`executeAs: USER_DEPLOYING`, `access: DOMAIN`).
5. Click **Deploy**, authorise, and copy the **Web app URL** (ends with `/exec`).
6. Back in the sheet, **Lead CRM → Open counsellor web app** should show the URL. If it says "not deployed", use **Admin → Set counsellor web app URL**.
7. Send the URL to counsellors. Each must be an **Active** row in Counsellor Master with their @companyname.com email.
8. **Stop sharing the spreadsheet with counsellors** (Share → remove them). Keep admins only.

**After every code change:** Deploy → Manage deployments → ✏ → Version: **New version** → Deploy. The URL stays the same.

### Counsellors still using the spreadsheet (transition)

If counsellors keep editor access for a while:
- they can edit only unlocked (non-grey) columns;
- **Lead CRM → Log Follow-Up** shows them the web app inside the sidebar;
- the sidebar includes an *open in a new tab* link if the embedded view does not load.

Admins use the classic sidebar directly.

## 3. Permissions the script uses

| Scope | Why |
|---|---|
| `spreadsheets.currentonly` | Read/write **this** spreadsheet only (no access to your other files) |
| `script.container.ui` | Menu, sidebar, dialogs |
| `script.scriptapp` | Create the installable triggers (onEdit, onChange, onOpen, hourly maintenance, optional reminders) |
| `script.send_mail` | Optional daily reminder emails, which stay **off** until an admin enables them |
| `userinfo.email` | Identify the person making a change (Last Updated By, audit trail) |

The script stores no passwords or credentials. The only person-related data it adds is:
- account emails in the Follow-Up Log's "Updated By" column and in the Access Log, and
- an internal key→email mapping (Script Properties), used only in legacy simple mode.

The web app needs no extra scopes. It runs with the owner's authorisation, and visitors only sign in to Google.

## 4. First configuration (admin)

1. **Stage Master**: replace the rows marked `SAMPLE - replace with your own process` with your stages and substages. See [ADMIN.md](ADMIN.md#stages-and-substages).
2. **Counsellor Master**: replace the three sample counsellors. Enter each person's **Google account email**; this is how the script knows who is editing.
3. **Lists & Settings**:
   - check the priority, outcome, source, status and activity-type lists;
   - under *Setting / Value*, put every administrator's email in **Admin Emails** (comma separated);
   - set **Lead ID Prefix** before you add real leads.
   - review **Counsellor-Locked Fields** (column AD). The default list is Lead ID, Mobile Number, Email ID, Assigned Counsellor, Lead Created Date and Lead Source; all system and formula columns are always locked.
4. Run **Lead CRM → Admin → Reapply protections** so the admin list takes effect.
5. Deploy the counsellor web app (§2) and stop sharing the spreadsheet with counsellors.
6. Run **Lead CRM → Admin → Run health check** and resolve anything marked `CHECK`.
7. Delete any test leads and log rows. Optionally reset the counters (see [ADMIN.md](ADMIN.md#resetting-ids-before-go-live)).

## 5. How users are identified (Google Workspace, one organisation)

All counsellors and admins use **@companyname.com** accounts in the same Workspace organisation as the owner. That is the case where Google reliably tells a script who the user is.

| Where the change happens | Code runs as | How the user is identified |
|---|---|---|
| Edit in the spreadsheet (admins; counsellors during transition) | **Owner**: the installable `onEditInstallable` trigger created by setup | `e.user.getEmail()` in the edit event. Google fills it for editors in the same domain as the trigger's owner. |
| Counsellor web app | **Owner**: deployed "Execute as: Me" | `Session.getActiveUser().getEmail()`. Google returns the visitor's email for same-domain web apps, and the app rejects anyone else. |
| Admin sidebar / menu | The admin themself | `Session.getActiveUser().getEmail()` |
| Simple `onEdit` (stage fast path only) | The editor | Not needed: it only clears the substage and sets the dropdown |

The email is mapped to a name through **Counsellor Master → Email ID**. *Last Updated By* shows that name, or the email for admins without a counsellor row. In the unlikely case Google returns no email (for example a guest account from another domain), the edit is still saved and audited, labelled "Unidentified user".

**Edit-trigger modes** (Lead CRM → Admin):
- **Installable + strict locking (default):** described above. Locked columns use **strict** protection: Google rejects a counsellor's edit with its standard "You are trying to edit a protected cell or object" message, and only the owner/admins and the script can change them.
- **Legacy simple mode:** for setups without the installable trigger. `onEdit` runs as the editor, so locked columns fall back to **warning-only** protection. Not recommended for your organisation.

## 6. What setup builds

### Sheets

| Sheet | Purpose | Who edits |
|---|---|---|
| Lead Management | Working sheet, one row per lead (10,000 rows pre-formatted) | Admins (counsellors use the web app; during transition they can edit unlocked columns only) |
| Follow-Up Log | Append-only history of every activity and audited change | Script only (strict protection; the script writes as the owner) |
| Stage Master | Stages / substages / order / active flag | Admins |
| Counsellor Master | Counsellors, emails, teams, active flag | Admins |
| Dashboard | KPIs, reports A–G, 6 charts | Formulas (filter cells editable by all) |
| Lists & Settings | Dropdown lists, ageing buckets, settings, custom-field table, Counsellor-Locked Fields, auto helper lists | Admins |
| Access Log | Who opened the web app or spreadsheet, viewed or changed which lead, and when | Script only (admins can read) |

### Lead Management columns

A–AB hold every field from the specification. The 10 custom fields sit directly after Email ID. AC–AI are additional tracking columns.

| Col | Field | Type | Notes |
|---|---|---|---|
| A | Lead ID | System | `LD-000001`; unique; generated when a row first gets data |
| B | Lead Name | Caller | |
| C | Mobile Number | Caller | Plain-text format; pattern check (warning) and duplicate check |
| D | Email ID | Caller | Format check (warning); duplicate check |
| E–N | Custom Field 1–10 (slots 1–10) | Caller | **Optional.** All 10 are hidden after setup. An admin turns one on with **Lead CRM → Add custom field**, which shows the column with the chosen name. See [ADMIN.md](ADMIN.md#custom-fields-en). |
| O | Assigned Counsellor | Caller/Admin | Dropdown of **active** counsellors |
| P | Lead Stage | Caller | Dropdown of **active** stages, in Stage Order |
| Q | Lead Substage | Caller | **Dependent** dropdown (see §7) |
| R | Lead Priority | Caller | Critical / Hot / Warm / Cold |
| S | Last Contact Date | Script/Caller | Latest Contact activity date; cannot be in the future |
| T | Next Follow-Up Date | Caller/Script | Must be a valid date |
| U | Last Follow-Up Outcome | Script/Caller | Dropdown from Contact Outcome list |
| V | Follow-Up Count | Formula | Count of Contact activities in the log |
| W | Last Updated By | System | Counsellor name / email |
| X | Last Activity Timestamp | System | Fixed date-time value, never `NOW()` |
| Y | Lead Remarks | Caller/Script | Latest remarks |
| Z | Lead Source | Caller | Dropdown (other values allowed, flagged) |
| AA | Lead Created Date | System | Fixed timestamp |
| AB | Lead Status | Caller | Open / On Hold / Converted / Lost / Duplicate |
| AC | Last Follow-Up Date | System | Date of latest activity logged via the form |
| AD | Last Stage Change Date | System | Fixed timestamp |
| AE | Lead Assigned Date | System | Fixed timestamp of latest (re)assignment |
| AF | Previous Counsellor | System | Owner before the latest reassignment |
| AG | Total Activities | Formula | Contact + Record Update entries |
| AH | Data Quality Flags | Formula | Missing/invalid contact, unassigned, stage problems, overdue, missing follow-up date. Duplicates are shown by colour in C/D. |
| AI | Audit Snapshot | System (hidden) | JSON of owner/stage/substage/status/next FU used to detect changes, including bulk pastes |

Column positions are fixed. Custom fields are switched on and off by **showing and hiding** E–N, never by inserting or deleting columns. The script builds every formula's column letters from `LC` in `Config.gs` (via `lcf_()`), so formulas, validation, colours and the dashboard always point at the right columns.

> **Upgrading a sheet built with the original layout** (custom fields in Q–Z): run **Set up / repair workbook** once. It moves Q–Z to E–N with `moveColumns`, keeping all data. Any custom field that holds data or was renamed becomes an active field with that name; the rest are hidden.

**Header colours:**
- **light grey header with grey cells** = locked: counsellors cannot edit it. This covers system/formula columns plus *Counsellor-Locked Fields*.
- navy = editable field;
- purple = editable custom field.

**Row colours:**

| Colour | Meaning |
|---|---|
| Green row | Converted |
| Grey italic row | Lost / Duplicate |
| Red A + T | Follow-up overdue |
| Yellow A + T | Follow-up due today |
| Light blue T | Follow-up due within *Upcoming Follow-Up Window* days |
| Dark red R | Critical priority |
| Orange R | Hot priority |
| Orange C/D | Duplicate mobile/email (conditional formatting; follows the Duplicate Mobile/Email Check setting) |
| Red A | Duplicate Lead ID |

Alternating row banding, a frozen header (and frozen ID + Name columns) and a filter are enabled.

**Formulas live in the header row** (`V1`, `AG1`, `AH1` use `={"Header"; ARRAYFORMULA(...)}`), so sorting and filtering rows can never move or break them.

### Follow-Up Log columns

1 Activity ID · 2 Lead ID · 3 Lead Name · 4 Counsellor Name · 5 Activity Date and Time · 6 Activity Type · 7 Contact Outcome · 8 Lead Stage at Time of Activity · 9 Lead Substage at Time of Activity · 10 Next Follow-Up Date · 11 Remarks · 12 Updated By · *then audit columns* 13 Activity Category · 14 Field Changed · 15 Old Value · 16 New Value · 17 Lead Owner at Time · 18 Submission ID (hidden, duplicate protection).

**Activity Category** separates the three kinds of activity:

| Category | Examples | Counts as follow-up? |
|---|---|---|
| **Contact** | Outbound/Inbound Call, WhatsApp, Email, SMS, Meeting | Yes |
| **Record Update** | Stage Updated, Lead Assigned, Status Updated, Follow-Up Scheduled, Other | No (counts as "worked") |
| **System** | Lead Created, Substage Cleared, automatic status from stage, Log Edited | No |

The category is stored on each row when it is written, so later changes to the activity-type list do not rewrite history.

## 7. Dependent dropdown: exact implementation

- **Stage (P):** data validation "list from a range" pointing at `'Lists & Settings'!R2:R`. That range is an auto-formula: active stages from Stage Master, unique, sorted by Stage Order. It updates by itself when Stage Master changes; no script is needed.
- **Substage (Q):** the script sets a **per-row** validation rule ("list of items") containing only the active substages of that row's stage:
  - **When the stage changes in the sheet,** the *first and only* thing the simple `onEdit` trigger does is clear that row's substage and set the new stage's dropdown.
    - It uses the stage list cached in CacheService and the edit event's values.
    - A single-cell change costs two writes and no sheet reads, so the new list is ready before the user reaches the Substage cell.
    - The installable trigger then writes the audit trail separately: `Stage Updated`, and `Substage Cleared` with the old value.
  - In the web app and sidebar, changing the stage clears the substage list in the form immediately; the server applies the same rule.
  - **When Stage Master is edited:** all rows' rules are rebuilt in one batch call (a few seconds for 10,000 rows).
  - **After sorting / inserting / deleting rows:** the installable onChange trigger rebuilds them (throttled to once per 30 seconds). **Lead CRM → Refresh substage dropdowns** does the same on demand.
  - **Empty rows have no substage rule at all.** Setup does not create 10,000 per-row rules. A row gets its dropdown when a stage is first chosen in it (by typing, pasting, defaulting for a new lead, or through the follow-up form).
  - **A stage with no substages** gets a warning rule ("Stage … has no active substages") instead of a list. Pasting still works and the script validates the result.
  - **A substage typed into a row with no stage** is cleared by the script.
  - **Safety net:** every substage change is checked against Stage Master. The Data Quality Flags column shows "Substage not valid for stage" for anything that slipped through, such as a substage later deactivated by an admin.

Why not formulas or named ranges? A per-stage named-range layout breaks or shifts when stages are added, reordered or renamed. Rules generated from Stage Master avoid that and never list every substage for every stage.

## 8. Dashboard

The yellow cells are the controls:
- **Reporting Period**: Today, Yesterday, Last 7 Days, Last 30 Days, Current Month, Previous Month, Custom Date Range.
- **Custom From / To**: used only with Custom Date Range.
- **Counsellor**: *All Counsellors* or one person, including inactive counsellors so history stays reportable.

"Applied From/To" shows the dates actually used. **The numbers are calculated by the script, not by live formulas**, and written as values. They refresh:
- when a yellow filter cell changes (installable edit trigger);
- every hour (maintenance trigger);
- on **Lead CRM → Refresh Dashboard**.

**Last Refreshed** shows when. See *Performance* below for why.

### KPI definitions

| KPI | Definition | Date basis |
|---|---|---|
| Total Leads | Leads with a Lead ID | none |
| Leads Created (Period) | Lead Created Date in period | creation date |
| Leads Worked (Period) | **Unique** Lead IDs with ≥1 Contact or Record Update activity in period | activity date |
| Unique Leads Contacted | **Unique** Lead IDs with ≥1 Contact activity in period. A lead called 5 times counts once. | activity date |
| Follow-Ups Completed | Number of Contact activities in period | activity date |
| Follow-Ups Pending | Open leads with Next Follow-Up Date ≥ today | as of today |
| Follow-Ups Overdue | Open leads with Next Follow-Up Date < today | as of today |
| Converted / Lost Leads | Lead Status = Converted / Lost | current |
| Leads Not Contacted | Open leads with Follow-Up Count = 0 | current |
| Leads With No Activity | Leads with no Contact or Record Update entry ever | current |
| Conversion Rate | Converted ÷ Total Leads | current |

"Open" means Lead Status is not Converted, Lost or Duplicate.

The **counsellor filter** applies to:
- the *Assigned Counsellor* for lead-based metrics;
- the *Counsellor Name* in the log (who did the activity) for activity metrics;
- the *Lead Owner at Time* for conversions in the daily trend.

### Reports

| Report | Contents |
|---|---|
| A. Stage-wise | Stage-level counts (25 rows) |
| B. Substage-wise | Stage + substage pairs; each substage under its own parent (80 rows) |
| C. Counsellor-wise | Per-counsellor performance (40 rows) |
| F. Ageing | Open leads by age since creation, and due/overdue follow-ups by days overdue, using the buckets in Lists & Settings; plus distribution by status and by source |
| G. Exceptions | Unassigned and unworked leads (first 25 each, with totals) |
| D. Daily trend | One row per day of the period (up to 62 days) |
| E. Follow-ups due/overdue | Most overdue first (up to 500) |

**Charts:**
- leads by stage
- counsellor productivity
- daily activity trend
- lead distribution (status)
- lead and follow-up ageing
- leads by substage

## 9. Performance: what was slow and what changed

| Cause | Cost before | Now | Trade-off |
|---|---|---|---|
| **Data Quality Flags** `ARRAYFORMULA` over 10,000 rows (REGEXMATCH + several COUNTIFS against Stage Master per row) | Recalculated in full after **every** edit to mobile, email, owner, stage, substage, dates or status: millions of operations per keystroke | Script-computed values. Rows you edit are updated by the trigger; all rows hourly; also **Admin → Recalculate data-quality flags** | "Overdue follow-up" flags can be up to 1 hour late after midnight. Changes made outside the triggers (another script/API) show after the next hourly run. |
| **Dashboard**: ~1,000 COUNTIFS/FILTER/COUNTUNIQUE formulas over full Lead Management and Follow-Up Log columns | Every lead edit recalculated hundreds of them, even when nobody had the dashboard open | Calculated by the script in one pass and written as values | Not live: up to 1 hour old unless a filter is changed or *Refresh Dashboard* is used. **Last Refreshed** shows the age. |
| Duplicate-ID colour rule `COUNTIF($A$2:$A,$A2)` and the duplicate mobile/email COUNTIF rules | Evaluated for every visible cell on every repaint | Removed. IDs are unique by construction (script + validation); duplicates are found once by the script and coloured from the flag | Duplicate colouring updates with the flags, not instantly for edits made by other scripts |
| **onEdit work**: one handler did locking, sheet reads, logging and the substage change in sequence, so the substage changed seconds after the stage | The user often reached the Substage cell first, still seeing the old list (the reported bug) | Split: the simple trigger does only the substage fast path; the installable trigger does the rest; master data is cached; flags/log are written last | Two triggers per edit (both cheap). If the cache is stale for a few seconds after a Stage Master change, the onChange refresh and the installable trigger correct it. |
| Follow-Up Count (V) and Total Activities (AG) | Still `ARRAYFORMULA(VLOOKUP(QUERY(log)))` | Kept: they depend only on Follow-Up Log, which changes once per save, and they stay correct after sorting or manual log fixes | ~1 s background recalculation after each follow-up on very large logs |

Setup writes 14 formulas in total, instead of about 2,150 in the previous version.

## 10. Optional: daily email reminders

These are off by default. An admin can choose **Lead CRM → Admin → Enable daily email reminders**. Each active counsellor with an email then gets one daily list of their open leads that are due today or overdue, at the hour set in *Reminder Hour*. **Disable daily email reminders** removes the trigger.

## 11. Updating the code later

Paste the new file contents into the same Apps Script files. Then:
1. Run **Lead CRM → Admin → Set up / repair workbook**, again if it says it is not finished. Your data is kept.
2. Update the web app deployment to a **New version** (§2).

Repair converts an older workbook in place:
- the Data Quality Flags formula is replaced by script values;
- the dashboard formulas are replaced by script values;
- the installable triggers are created;
- locked columns switch to strict protection.
