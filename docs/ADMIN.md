# Administrator Guide

Administrators are the emails in **Lists & Settings → Admin Emails** plus the file owner. Every admin action checks this list on the server, whatever menu a person sees. After changing the list, run **Lead CRM → Admin → Reapply protections**.

Day-to-day routines for admins and counsellors are in [COLUMN_DICTIONARY.md → How to use the CRM day to day](COLUMN_DICTIONARY.md#how-to-use-the-crm-day-to-day). Every column is explained in the same document.

> **Golden rule:** never insert, delete or move columns in Lead Management (A–AI) or Follow-Up Log (A–R). An empty inserted column is removed automatically; anything else pauses the CRM until you press **Undo** (Ctrl+Z) and run **Admin → Re-check all lead rows**.

---

## The Lead CRM menu

| Item | Who | What it does |
|---|---|---|
| Log follow-up | Everyone | The follow-up form for the selected lead |
| My overdue follow-ups | Everyone | Your incomplete leads, then follow-ups due today / overdue |
| Refresh dashboard | Everyone | Admins: at once. Counsellors: done by the owner's trigger within a minute |
| Add leads from Lead Entry (admins) | Admins | Checks Lead Entry and creates the valid leads |
| Help | Everyone | One-screen help |
| **Admin ▸** Show / Hide admin sheets | Admins | Lead Entry, Follow-Up Log, masters, settings, logs, Deleted Leads |
| Admin ▸ Delete lead(s)… / Restore deleted lead… / Purge deleted lead permanently… | Admins | See [Deleting leads](#deleting-restoring-and-purging-leads) |
| Admin ▸ Allow system-column correction for 10 minutes | Admins | Lets admins fix an automatic column (logged) |
| Admin ▸ Add / Remove custom field… | Admins | [Custom fields](#custom-fields-en) |
| Admin ▸ Re-check all lead rows | Admins | Runs the edit guard over every row |
| Admin ▸ Recalculate data-quality flags · Refresh substage dropdowns · Reapply protections | Admins | Repairs |
| Admin ▸ Set up / repair workbook · Quick test setup · Restart setup · Extend Lead Management by 5,000 rows · Recalculate ID counters | Admins | Setup and capacity |
| Admin ▸ Reset CRM to fresh start (delete all leads and logs) · Restore from reset backup… | Admins | Going live after testing ([below](#going-live-reset-crm-to-fresh-start)) |
| Admin ▸ Counsellor web app link · Web app sign-in setup · Set counsellor web app URL | Admins | Optional web app |
| Admin ▸ Enable / Disable daily email reminders · Send reminders now (test) | Admins | Reminders |
| Admin ▸ Run health check | Admins | Checks sheets, triggers, protection, layout, queue, settings |

The menu is the same for everybody (Google cannot show a different menu per user); admin items refuse non-admins with "Only CRM administrators can do this."

---

## Adding leads (Lead Entry)

New leads can **only** be added through the hidden **Lead Entry** sheet. Typing a new lead into Lead Management is undone automatically.

1. **Admin → Show admin sheets**, open **Lead Entry**.
2. Type or paste rows: Lead Name and Mobile Number are required; Email ID, the active custom fields, Assigned Counsellor, Lead Source, Lead Priority and Remarks are optional. Paste values only (Ctrl+Shift+V) if you copy from another file; the dropdowns are put back after a paste.
3. **Lead CRM → Add leads from Lead Entry.** Every row is checked with the same rules as Lead Management:
   - **valid rows** are created in Lead Management (Lead ID, Lead Created Date, default stage/substage/status from Lists & Settings, Lead Assigned Date if a counsellor is given, a "Lead Created" log entry) and are **cleared** from Lead Entry, leaving *Result = Created*, a message and the new Lead ID;
   - **invalid rows stay** at the top, in red, with *Result = Error* and a plain-English **Message** such as "Mobile number must be 10 digits." Fix them and run again.
4. Duplicates are checked against existing leads and earlier rows of the same batch, according to *Duplicate Mobile Check* / *Duplicate Email Check*: **Block** refuses the row; **Warn** creates it with a note.

Thousands of rows can be added at once (one write per column block). A run stops after about 4 minutes and says how many rows were not checked yet; run it again. Lead Management grows by 5,000 rows automatically when it is full.

## Assigning and reassigning

Admins choose **Assigned Counsellor** (column O) in Lead Management, or give it in Lead Entry. Each change is audited (*Lead Assigned*), stamps *Lead Assigned Date* and keeps *Previous Counsellor*. To reassign many leads, filter by the old counsellor and paste the new name into the selected O cells: every row is checked and audited.

## Deleting, restoring and purging leads

Counsellors can never delete (the sheet protection blocks row deletion). Admins should not delete rows directly either: that is detected and logged, but the lead is lost unless you press Undo.

- **Admin → Delete lead(s)…** — enter one or more Lead IDs (commas or spaces). The confirmation shows each lead (ID, name, mobile, counsellor, stage/status). A **reason is required**. Each lead is moved to the hidden **Deleted Leads** sheet with *Deleted At*, *Deleted By* and *Reason*, a **Lead Deleted** System entry is written to Follow-Up Log, and the row is removed from Lead Management. Its log history stays (shown struck through in Follow-Up Log). Deleted leads are not in any Dashboard lead count.
- **Admin → Restore deleted lead…** — brings a lead back with its **original Lead ID** (and its snapshot), logged as **Lead Restored**.
- **Admin → Purge deleted lead permanently…** — only for leads already in Deleted Leads. Two confirmations (Yes, then type `PURGE`). The row is removed for good and a **Lead Purged** entry is written. Follow-Up Log entries of the lead are kept.

## Correcting automatic columns

Automatic columns (Lead ID, Follow-Up Count, Last Updated By, Last Activity Timestamp, Lead Created Date, Last Follow-Up Date, Last Stage Change Date, Lead Assigned Date, Previous Counsellor, Total Activities, Data Quality Flags, Audit Snapshot) cannot be changed by anyone; the edit guard puts any change back and logs it.

For a genuine fix: **Admin → Allow system-column correction for 10 minutes.** During those 10 minutes admins may change Last Updated By, the dates and Previous Counsellor; each change is logged as **System Field Corrected**. Lead ID, the two formula columns, Data Quality Flags and the snapshot still cannot be changed. The window is logged in Follow-Up Log and the Access Log, and closes by itself.

---

## Custom fields (E–N)

Lead Management has **10 optional custom-field slots** in columns E–N (Lead Entry D–M). They are set in **Lists & Settings → Custom Fields** (Z–AC):

| Column | Meaning |
|---|---|
| Custom Field Slot | 1–10, fixed. Slot N = Lead Management column E + (N − 1) |
| Field Name | Header shown in Lead Management and Lead Entry |
| Active (Yes/No) | Yes = shown; No = hidden (data kept) |
| **Allowed Values** | Optional, comma separated (e.g. `MBA, BBA, BCom`). The column becomes a dropdown that refuses anything else. Blank = free text up to 100 characters. |

- **Add:** **Admin → Add custom field…**, type the name. It uses the next free slot (preferring an empty one), shows the column in Lead Management and Lead Entry, and makes it editable for counsellors when *All Custom Fields* is in Counsellor-Editable Fields.
- **Remove:** **Admin → Remove custom field…**. The column is **hidden**, never deleted; its data is kept.
- **Rename:** change Field Name in the table, or the header in row 1 (E1–N1).
- Columns are never inserted or deleted, only shown or hidden.

## Counsellor-Editable Fields

**Lists & Settings → Counsellor-Editable Fields** (column AE) lists the only Lead Management columns counsellors may change, and only on leads assigned to them. Default: Lead Stage, Lead Substage, Lead Priority, Next Follow-Up Date, Last Follow-Up Outcome, Lead Remarks, Lead Status, All Custom Fields.

- Allowed entries: those fields, Last Contact Date, *All Custom Fields*, or one custom field by its Field Name.
- Contact and assignment columns (Lead Name, Mobile, Email, Assigned Counsellor, Lead Source) and automatic columns can never be added.
- A change applies at once: white/grey colours, header notes, the open (unprotected) ranges and the web app.

---

## Stages and substages

Stage Master has **one row per stage + substage pair**: Stage ID (auto), Lead Stage, Substage (blank for a stage without substages), Stage Description, Stage Order (same number on every row of a stage), Active Status, Admin Remarks.

- **Add a substage / stage:** add a row with the stage spelling, substage, order and `Active`. All Substage dropdowns are rebuilt automatically.
- **Deactivate:** set the row(s) to `Inactive`. It disappears from new choices; leads that already use it keep it (an inactive value may stay, but cannot be newly chosen).
- **Rename:** add the new name as a new row, move leads across, set the old row Inactive. Log history keeps the old text.
- **Converted / Lost stage** (Lists & Settings): Lead Status *Converted* is only allowed in the *Converted Stage* and *Lost* only in the *Lost Stage*. Moving a lead into those stages sets the status; moving it out sets the default status again (with *Auto-Set Status From Stage* = Yes). Give the Lost stage substages for the lost reasons: with *Require Substage* = Yes a Lost lead without a reason is Incomplete.

If Stage Master is changed by an import or another script, run **Admin → Refresh substage dropdowns**.

## Counsellors

Counsellor Master: Counsellor ID (auto), Counsellor Name, **Email ID** (their Google account), Team Leader (text only, no extra rights), Team Name, Active / Inactive Status, Date Added (auto).

- **Add:** type the name; ID, `Active` and today's date are filled in. Add the email of the Google account they will use. Share the spreadsheet with that account as **Editor**.
- **Deactivate:** set `Inactive`. They disappear from the assignment dropdown; their edits are undone ("not an active counsellor or admin"); the web app refuses them. History stays. Reassign their leads.
- **Do not rename** a counsellor with history; add a new row instead.

---

## Lists & Settings

**Lists (A–H):** Lead Priority, Contact Outcome, Lead Source, Lead Status (keep `Open`, `On Hold`, `Converted`, `Lost`, `Duplicate` spelled exactly), Activity Type / Category / Show in Follow-Up Form. Keep the script's own activity types (Lead Created, Lead Assigned, Stage Updated, Status Updated, Follow-Up Scheduled, Substage Cleared, Log Edited, Field Updated, Sheet Update, Edit Reverted, System Field Corrected, Correction Window Opened, Lead Deleted, Lead Restored, Lead Purged).

**Ageing buckets (J–L)** drive Dashboard report F.

**Settings (N–P):** edit only the **Value** column.

| Setting | Effect |
|---|---|
| Lead ID Prefix / Digits, Activity ID Prefix | Format of new IDs |
| Default Lead Status / Stage / Substage | Given to every new lead |
| Converted Stage / Lost Stage / Auto-Set Status From Stage | Status ↔ stage rules (above) |
| Duplicate Mobile Check / Duplicate Email Check | `Off`, `Warn` (allow + flag) or `Block` (refuse) — Lead Entry and admin edits |
| Mobile Number Pattern / Mobile Number Message | Pattern the mobile must match after spaces and dashes are removed (default `^[0-9]{10}$`), and the message shown when it does not |
| Upcoming Follow-Up Window (Days) | Blue highlight |
| Require Next Follow-Up For Open Leads | After a stage or outcome change an open lead needs a new Next Follow-Up Date (else Incomplete); the form requires it |
| Require Substage | A substage is needed when the stage has substages |
| Require Remarks On Follow-Up | The form requires remarks |
| Max Next Follow-Up Days | Latest allowed next follow-up date (default 365) |
| Max Remarks Length | Limit for Lead Remarks and form remarks (default 500) |
| Follow-Up Form Activity Type | Activity Type logged by the form (default Outbound Call) |
| Block Edits From Unknown Users | Yes = undo edits when the editor cannot be identified (SETUP.md §5) |
| Email Reminders Enabled / Reminder Hour | Use the Admin menu |
| Admin Emails | Administrators (comma separated). Then *Reapply protections* |

Changing a setting value re-applies the Lead Management rules at once. Columns R–X are automatic helper lists.

---

## Dashboard

The numbers are calculated by the script (fast sheet; refreshed on a filter change, hourly and on *Refresh dashboard*; **Last Refreshed** shows when).

| KPI | Definition | Date basis |
|---|---|---|
| Total Leads | Leads with a Lead ID in Lead Management (deleted leads excluded) | none |
| Leads Created (Period) | Lead Created Date in the period | creation |
| Leads Worked (Period) | Unique leads with a Contact or Record Update entry in the period. Record Updates of leads that are **still incomplete** do not count | activity |
| Unique Leads Contacted | Unique leads with a Contact entry in the period | activity |
| Follow-Ups Completed | Contact entries in the period (form saves, and sheet outcome changes once the lead is complete) | activity |
| Follow-Ups Pending / Overdue | Open leads with Next Follow-Up Date ≥ today / < today | today |
| Converted / Lost Leads | Current status | current |
| Leads Not Contacted | Open leads with no Contact entry ever | current |
| Leads With No Activity | No Contact or Record Update entry ever | current |
| Conversion Rate | Converted ÷ Total | current |
| **Incomplete Leads** | Open leads whose Data Quality Flags start with "Incomplete" | current |

Reports: **A** stage-wise, **B** substage-wise, **C** counsellor-wise (now with **Incomplete Leads** per counsellor), **F** ageing + status + source, **G** unassigned / unworked (summary also shows Incomplete), **D** daily trend, **E** follow-ups due / overdue. Six charts.

## Access, protection and confidentiality

| Area | Protection |
|---|---|
| Lead Management | Whole sheet strict (admins); open to counsellors: the Counsellor-Editable columns of rows 2 … last lead. Plus the edit guard for everyone |
| Lead Entry, Stage Master, Counsellor Master, Lists & Settings, Start Here, Field Guide, Deleted Leads, Access Log | Strict, admins only |
| Follow-Up Log | Strict; written by the script. An admin's manual edit is recorded as *Log Edited* |
| Dashboard | Strict except the four filter cells |

Counsellors work in the spreadsheet. **Any editor can copy, download or print the whole spreadsheet**, including hidden sheets; protection and hiding do not stop that. If that is not acceptable for some people, give them only the optional web app ([CONFIDENTIALITY.md](CONFIDENTIALITY.md)).

## Health check and repairs

- **Run health check**: sheets, columns in order, header formula, sheet protection, triggers (edit guard, change, open, hourly, every-minute queue), queued follow-ups, correction window, hidden admin sheets, editable columns, identities, admin list, counsellors without email.
- **Re-check all lead rows**: after Undo of a column change, after the CRM was busy, or after another tool changed the sheet.
- **Before go-live:** use **Reset CRM to fresh start** (next section).

## Going live: Reset CRM to fresh start

**Lead CRM → Admin → Reset CRM to fresh start (delete all leads and logs)** removes all test data in one go.

| Kept (not touched) | Cleared |
|---|---|
| Stage Master, Counsellor Master, Lists & Settings (all lists, settings, Admin Emails, Custom Fields table, Counsellor-Editable Fields, ageing buckets) | Every lead row in Lead Management (header, header formulas and the 10,000 formatted empty rows stay) |
| Custom field names and shown / hidden columns | Lead Entry rows |
| All formatting, validation, protections, hidden sheets, triggers | Follow-Up Log, Access Log, Deleted Leads (headers stay) |
| Start Here, Field Guide | Dashboard numbers (refreshed: all zeros) |
| Web app URL and sign-in settings | Data Quality Flags, Audit Snapshots, per-row substage rules of old leads |
| Registered user identities (counsellors need not use the menu again) | Lead / Activity ID counters (next lead LD-000001, next activity ACT-000001), queued form saves, unfinished setup progress, correction window |

**How it runs**
1. Admin only (checked on the server).
2. A summary first: "This will delete X leads and Y log entries… Stages, counsellors and settings are kept." Type **RESET** to confirm; anything else cancels and nothing is deleted.
3. **Backup first:** every cleared sheet is copied (values) into a new hidden, admin-only sheet **"Backup <date time>"**, one block per sheet.
   *Why not a copy of the whole file?* Copying a file needs the Google Drive permission, which this script deliberately does not have (it may only touch this spreadsheet). **File → Version history** also lets you go back to the moment before the reset.
4. The sheets are cleared and the counters reset. One **CRM Reset** entry (who, when, counts; Activity ID `RESET`, so real activities still start at ACT-000001) is written into the empty Follow-Up Log.
5. The health check runs and the message says **"CRM is ready to use"** (or lists what to check).

**Large sheets:** the reset works in steps of 5,000 rows and saves its progress, like setup. If it says "The reset is NOT finished yet", run the same menu item again and answer Yes to continue.

**Undo / backup:**
- **Undo:** **Admin → Restore from reset backup…** puts all leads and logs back from a backup and continues the ID counters. It only works while Lead Management is still empty (right after the reset). Otherwise use **File → Version history**.
- **Delete the backup** when you are sure: **Admin → Show admin sheets**, right-click the *Backup …* tab → **Delete**. A backup doubles the space the data uses (a spreadsheet allows 10 million cells).
