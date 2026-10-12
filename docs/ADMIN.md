# Administrator Guide

Administrators are the emails listed in **Lists & Settings → Admin Emails** (plus the file owner). Only they can:
- edit Stage Master, Counsellor Master, Lists & Settings, the Lead Management header row and the Dashboard;
- run the **Lead CRM → Admin** menu.

After changing the admin list, run **Lead CRM → Admin → Reapply protections**.

> **Golden rule:** never insert, delete or move columns in Lead Management (A–AI) or Follow-Up Log (A–R). The script finds fields by position. Rename headers freely where this guide says so, and add extra information in the 10 custom fields.

---

## Custom fields (Q–Z)

The ten columns *Custom Field 1 … Custom Field 10* are blank, free-text and editable by callers. The script never reads or changes them.

**To rename one** (for example Custom Field 1 → "Course Interested"):
1. Click the header cell (Q1 … Z1) on **Lead Management**. You must be an admin, because the header row is protected.
2. Type the new name and press Enter.

That is all:
- existing data stays in place and stays editable;
- the system needs no formula or script change;
- re-running setup keeps your custom header names.

**Optional extras:**
- **A dropdown for a custom field:** select the column cells from row 2 down → **Data → Data validation** → *Dropdown (from a range)*. Point it at a new list you add in an empty column of Lists & Settings. Setup and repair keep custom-field validation only if you re-apply it, so note what you added.
- **Show the field in reports:** add a COUNTIFS on the column to the Dashboard (admins can edit it), or build a pivot table on a new sheet with **Insert → Pivot table** using `'Lead Management'!A:AH`.

To retire a custom field, rename it (for example "Unused 3") and clear its data. Do not delete the column.

---

## Stages and substages

Stage Master has **one row per stage + substage pair**:

| Column | Meaning |
|---|---|
| Stage ID | Auto-filled (`STG-017`) when you add a row; informational |
| Lead Stage | Stage name as shown in the dropdown |
| Substage | Substage name. Leave blank for a stage that has no substages. |
| Stage Description | Free text |
| Stage Order | Number that orders stages in dropdowns and reports. Use the same number on every row of a stage. |
| Active Status | `Active` / `Inactive` |
| Admin Remarks | Free text |

**Add a substage to an existing stage:** add a row with the same Lead Stage spelling, the new Substage, the stage's order and `Active`.

**Add a new stage:** add one row per substage, with a new order number (decimals such as `3.5` are fine to slot it between stages).

**What happens automatically:**
- the Stage dropdown (Lead Management F) updates through the helper list `'Lists & Settings'!R:R`;
- every row's Substage dropdown is rebuilt (you see a toast "substage dropdowns refreshed");
- the Dashboard stage and substage reports pick up the new rows (up to 25 stages and 80 pairs);
- the dashboard chart ranges are resized.

**Deactivate:**
- *A substage:* set its row to `Inactive`. It disappears from new selections. Leads that already use it keep the value. The cell shows a validation warning and Data Quality Flags says "Substage not valid for stage" so you can clean them up.
- *A whole stage:* set **all** its rows to `Inactive`.

**Rename a stage or substage:** existing leads and log history keep the old text.
1. Add the new name as a new row.
2. Use **filter → change** on Lead Management to move leads across. Each change is audited.
3. Set the old row to `Inactive`.

Avoid renaming in place: historical log entries are text and stay unchanged, so reports split between the old and new names.

**Converted / Lost stage link:** in Lists & Settings, *Converted Stage* and *Lost Stage* name the stages that automatically set Lead Status to Converted / Lost, when *Auto-Set Status From Stage* = Yes. Update them if you rename those stages.

**Replacing the sample process before go-live:** delete rows 2+ of Stage Master and type your own. Also update *Default Lead Stage* / *Default Lead Substage* in Lists & Settings (or blank them).

> If Stage Master is changed by something that does not fire edit triggers (an import, another script, the API), run **Lead CRM → Refresh substage dropdowns**.

---

## Counsellors

Counsellor Master columns:
- Counsellor ID (auto `CNS-004`)
- Counsellor Name
- **Email ID** (the person's Google account; used for identification)
- Team Leader
- Team Name
- Active / Inactive Status
- Date Added (auto)

**Add a counsellor:** type the name in the next empty row. ID, `Active` and today's date are filled in automatically. Add their email, then share the spreadsheet with them as Editor. The Assigned Counsellor dropdown updates immediately; no formula change is needed.

**Deactivate:** set Status to `Inactive`. They vanish from the assignment dropdown and the follow-up form. Their history stays in the log, and they remain selectable in the Dashboard counsellor filter. Leads still assigned to them are flagged "Inactive/unknown counsellor" in column AH. Reassign them by selecting a new counsellor; each change records `Lead Assigned`, Previous Counsellor and Lead Assigned Date.

**Do not rename** a counsellor who already has history; add a new row instead. Historical log entries keep the name used at the time, which is intentional.

**Bulk reassignment:**
1. Filter Lead Management by the old counsellor.
2. Select the Assigned Counsellor cells and type or paste the new name.

Every row gets its own audit entry (the old owner comes from the hidden snapshot column, so bulk edits are still traceable).

---

## Lists & Settings

**Lists (columns A–H).** Add, remove or reorder values; dropdowns read the whole column, so nothing else needs changing.
- *Lead Priority:* `Critical` and `Hot` have colour rules.
- *Contact Outcome*
- *Lead Source*
- *Lead Status:* keep `Open`, `On Hold`, `Converted`, `Lost`, `Duplicate` with these exact spellings. Reports and colours use them. You may add more statuses; they are treated as open.
- *Activity Type / Activity Category / Show in Follow-Up Form:*
  - Category `Contact` counts as a follow-up and updates Last Contact Date.
  - `Record Update` counts as "worked" but not as a follow-up.
  - Set *Show in Follow-Up Form* = No to hide a type from callers.
  - Keep the script's own types: Lead Created, Lead Assigned, Stage Updated, Status Updated, Follow-Up Scheduled, Substage Cleared, Log Edited.

**Ageing buckets (J–L).** Label, Min Days, Max Days (blank = no upper limit). They drive Dashboard report F (up to 10 buckets).

**Settings (N–P).** Edit only the **Value** column. Settings are found by name.

| Setting | Effect |
|---|---|
| Lead ID Prefix / Digits | Format of new Lead IDs. Set before go-live; existing IDs never change. |
| Activity ID Prefix | Format of new Activity IDs |
| Default Lead Status / Stage / Substage | Applied to brand-new leads with those fields empty |
| Converted Stage / Lost Stage / Auto-Set Status From Stage | Automatic status when a lead reaches those stages |
| Duplicate Mobile Check / Duplicate Email Check | `Off`, `Warn` (allow + flag; default) or `Block` (reject when typed). Use Warn when families share a number. |
| Mobile Number Pattern | Regular expression. Default `^\+?[0-9]{10,15}$`; for India-only 10-digit use `^[6-9][0-9]{9}$`. |
| Upcoming Follow-Up Window (Days) | Light-blue highlight range |
| Require Next Follow-Up For Open Leads / Require Remarks On Follow-Up | Mandatory fields in the follow-up form |
| Max Backdate Days For Activities | How far back a caller can date an activity |
| Email Reminders Enabled / Reminder Hour | Change through the Admin menu, which also manages the trigger |
| Admin Emails | Administrators (comma separated). Then run *Reapply protections*. |

Columns **R–X** are automatic helper lists. Do not type there.

---

## Access and protection model

| Area | Protection |
|---|---|
| Stage Master, Counsellor Master, Lists & Settings, Dashboard (except its 5 filter cells), Lead Management header row | **Strict**: admins only |
| Lead Management system and formula columns (A, L, M–N, AA, AC–AI) | **Warning**: callers see a warning. Typing into a formula column is undone automatically; typing into Lead ID is reverted. |
| Follow-Up Log (whole sheet) | **Warning**: any manual edit is itself recorded as a `Log Edited` System entry |

Why warning-only? The edit trigger and the follow-up form run **as the caller**, so callers need technical write access. Callers must also be able to sort and filter.

**Protected ranges are safeguards, not a security boundary.** Anyone with Editor access can, with effort, copy the file, use version history, or remove data. For stronger separation:
- give managers **Viewer** or **Commenter** access;
- keep the owner account separate from callers;
- use **File → Version history** to recover;
- consider a periodic copy (**File → Make a copy**) as a backup.

Do not store passwords, ID numbers or other sensitive personal data in custom fields.

---

## Importing or pasting many leads

1. Paste the data into Lead Management. Paste values only (Ctrl+Shift+V) into the caller columns (B–K, O–Z, AB). Leave column A empty, or include existing unique IDs.
2. Pastes of up to ~2,000 rows are processed automatically: IDs, created dates, defaults, dropdowns and "Lead Created" log entries.
3. For bigger imports, or if a toast said the system was busy, run **Lead CRM → Admin → Process imported / pasted leads**. It is safe to run any time.

The simple edit trigger has a 30-second limit, which is why very large pastes need step 3.

**More than 10,000 leads:** use **Admin → Extend Lead Management by 5,000 rows**, which also re-applies validation, colours and protection to the new rows. The Follow-Up Log grows automatically.

## Resetting IDs before go-live

1. Delete the test rows from Lead Management (select rows → right-click → *Delete rows*).
2. Delete them from Follow-Up Log too.
3. Run **Admin → Recalculate ID counters**. The next IDs continue after the highest ID still present, or start at 000001 if the sheets are empty.

## Edit trigger mode, reminders, health check

- **Admin → Use installable edit trigger:** for a single Google Workspace domain only (see SETUP.md §5). **Use simple edit trigger** switches back.
- **Admin → Enable / Disable daily email reminders**, and **Send reminders now (test)**.
- **Admin → Run health check:** sheets, header formulas, named ranges, triggers, counters, identity, admin list, counsellors without emails.
