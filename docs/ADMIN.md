# Administrator Guide

Administrators are the emails listed in **Lists & Settings → Admin Emails** (plus the file owner). Only they can:
- edit Stage Master, Counsellor Master, Lists & Settings, the Lead Management header row and the Dashboard;
- run the **Lead CRM → Admin** menu.

After changing the admin list, run **Lead CRM → Admin → Reapply protections**.

> **Golden rule:** never insert, delete or move columns in Lead Management (A–AI) or Follow-Up Log (A–R). The script finds fields by position. For extra information, use the 10 optional custom fields; they are switched on and off by hiding/showing fixed columns E–N.

---

## Custom fields (E–N)

Lead Management has **10 optional custom-field slots** in columns **E–N**, directly after Email ID:

| Slot | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Column | E | F | G | H | I | J | K | L | M | N |

Custom fields are blank, free-text and editable by callers. The script never reads, validates or reports on them; any data in them counts as lead data.

**After setup all 10 slots are inactive and their columns hidden.** The settings live in **Lists & Settings → Custom Fields** (columns Z–AB):

| Column | Meaning |
|---|---|
| Custom Field Slot | 1–10, fixed. Slot N is Lead Management column E + (N − 1). |
| Field Name | Header shown on Lead Management |
| Active (Yes/No) | Yes = column shown; No = column hidden (its data is kept) |

**Columns are never inserted or deleted** for custom fields, only shown or hidden, so every other column, formula and report keeps its position.

### Add a custom field
1. **Lead CRM → Add custom field…** (admins only).
2. Type the name, for example `Course Interested`. It must not repeat another column's name.

The script takes the next free slot, preferring one whose column is empty. It marks the slot Active, writes the name as the header, shows the column and selects it.
- If every free slot still holds data from a removed field, you are warned that the old data will appear under the new name, and asked to confirm.
- When all 10 slots are in use, you are told to remove one first.

### Remove a custom field
1. **Lead CRM → Remove custom field…**.
2. Enter the number or name of the field from the list shown.

If the column contains data, you see how many values it holds and must confirm. The column is then **hidden** and the slot marked inactive. **The data is not deleted.** It reappears if that slot is activated again: set Active = Yes in the table, or add a field when this is the only free slot.

### Rename a custom field
Either of these works; the other place updates automatically:
- change **Field Name** in the Custom Fields table;
- type a new header in Lead Management row 1 (E1–N1).

### Other notes
- **Editing the table directly:** setting Active to Yes/No in Lists & Settings shows/hides the column immediately (edit trigger). If something gets out of step, run **Admin → Set up / repair workbook**. It re-applies names and visibility from the table.
- **Re-running setup** keeps every field name, Active status and all custom data.
- **Upgrading from the original layout** (custom fields in Q–Z): the first repair run moves those columns to E–N, keeping their data. Fields with data or a renamed header become active.
- **Hidden ≠ secure:** anyone with edit access can unhide a column (right-click → *Unhide*). Do not store sensitive data in custom fields.
- **A dropdown for a custom field:** select the column cells from row 2 down → **Data → Data validation** → *Dropdown (from a range)*, pointing at a new list in an empty column of Lists & Settings. Setup/repair clears validation on Lead Management, so re-apply it afterwards.
- **Show the field in reports:** add a COUNTIFS on the column to the Dashboard (admins can edit it), or build a pivot table on a new sheet with **Insert → Pivot table** using `'Lead Management'!A:AH`.

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

**Add a counsellor:**
1. Type the name in the next empty row. ID, `Active` and today's date are filled in automatically.
2. Add the email of **the Google account they will sign in with**. Any provider is fine (Gmail, company email, others), as long as it is a Google account. For Gmail, dots and `+tags` don't matter.
3. Send them the counsellor link (**Lead CRM → Open counsellor web app**). Do **not** share the spreadsheet with them.

The Assigned Counsellor dropdown updates immediately; no formula change is needed.

**Deactivate:** set Status to `Inactive`. Their web-app access ends at their next click: every request re-checks Counsellor Master and they get "Access denied", which is logged. They also vanish from the assignment dropdown and the follow-up form. Their history stays in the log, and they remain selectable in the Dashboard counsellor filter. Leads still assigned to them are flagged "Inactive/unknown counsellor" in column AH. Reassign them by selecting a new counsellor; each change records `Lead Assigned`, Previous Counsellor and Lead Assigned Date.

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

**Custom Fields (Z–AB).** Slot / Field Name / Active for the optional custom fields. See [Custom fields](#custom-fields-en).

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
| Admin Emails | Administrators (comma separated, any email provider). They may use the Admin menu and the web app (all leads). Then run *Reapply protections*. |

**Counsellor-Locked Fields (AD).** One Lead Management field name per row. Counsellors cannot edit these columns.
- In the spreadsheet: **strict** protection, light-grey header and cells.
- In the web app: shown read-only and rejected by the server.
- Defaults: Lead ID, Mobile Number, Email ID, Assigned Counsellor, Lead Created Date, Lead Source.
- System and formula columns are always locked, whatever the list says.
- A custom field can be listed by its Field Name.
- Adding or removing a name applies immediately: protection, colours and web-app permissions. If you later rename a listed custom field, update its name here too.

Columns **R–X** are automatic helper lists. Do not type there.

---

## Access and protection model

**Recommended setup:**
- The **owner** runs setup and deploys the web app.
- **Admins** are the only editors of the spreadsheet.
- **Counsellors** use only the web app (see [CONFIDENTIALITY.md](CONFIDENTIALITY.md)).

| Area | Protection |
|---|---|
| Stage Master, Counsellor Master, Lists & Settings, Access Log, Dashboard (except its 5 filter cells), Lead Management header row | **Strict**: admins only |
| Lead Management locked columns: all system/formula columns (A, V–X, AA, AC–AI) + *Counsellor-Locked Fields* (default also C, D, O, Z) | **Strict**: admins only. A counsellor typing there gets Google's standard "protected cell" error. Light-grey colouring marks them. |
| Lead Management editable columns (name, custom fields, stage, substage, priority, last contact, next follow-up, outcome, remarks, status) | Not protected |
| Follow-Up Log (whole sheet) | **Strict**: written by the script as the owner. An admin's manual edit is recorded as a `Log Edited` System entry. |

**How the script writes to strictly protected cells:**
- the **installable** onEdit trigger, the hourly maintenance and the **web app** all run as the owner;
- only the tiny substage fast path runs as the editor, and it writes only the unlocked Substage column.

In legacy simple mode (Admin menu) the same columns fall back to warning-only protection.

**Consequences for counsellors who still use the spreadsheet (transition):**
- they **cannot sort** Lead Management, because sorting would move locked cells. Use **Data → Create filter view**, a personal view that may sort and filter without affecting others;
- the shared basic filter and the *Views* menu may also be refused. Filter views avoid that.

**Protected ranges are safeguards, not a security boundary.** Anyone with Editor or Viewer access can copy, download or print the whole file. That is why counsellors should use the web app, which only ever sends them their own leads. Also:
- keep the owner account separate from day-to-day users;
- use **File → Version history** to recover;
- note that with a personal Gmail owner, **downloads and copies of the spreadsheet cannot be logged** (no Drive audit log). Keep the admin list small (CONFIDENTIALITY.md).

Do not store passwords, ID numbers or other sensitive personal data in custom fields.

---

## Counsellor web app and Access Log

- **Link:** **Lead CRM → Open counsellor web app**.
- **Deploying / updating:** SETUP.md §2. After code changes, deploy a **New version**.
- **Who can get in (the only rule):** emails that are **Active** in Counsellor Master, or listed in **Admin Emails**. Any Google account and any email provider; no domain restriction. The spreadsheet owner gets in only if listed. Admins see all leads; counsellors only see leads whose Assigned Counsellor is their name.
- **Sign-in:** counsellors use the counsellor link (the sign-in app). It proves their Google email to the web app with a signed, single-use token (SETUP.md §2 and §5).
- **Sheet editors:** each person who edits the spreadsheet should run **Lead CRM → Identify me** once. Otherwise their edits show "Unidentified user", because Google does not reveal personal accounts' emails to the owner's trigger (SETUP.md §5).
- **Reassigning a lead** moves it to the new counsellor's web app at their next refresh.
- **Access Log sheet** (admins only), one row per event:
  - Portal Opened
  - Leads Listed (filter and the Lead IDs shown)
  - Lead Viewed
  - Lead Updated (field: old → new)
  - Follow-Up Logged (Activity ID)
  - Access Denied (unknown account, inactive counsellor, or another counsellor's lead)
  - Copy In Browser (reported, best-effort)
  - Spreadsheet Opened (admins, by the installable onOpen trigger)

  It grows with use; archive it yearly (copy rows to another file, then delete them).

---

## Dashboard and data-quality refresh

Both are calculated by the script, not by live formulas, for speed (SETUP.md §9).
- **Dashboard:** recalculated when a yellow filter cell changes, hourly, and with **Lead CRM → Refresh Dashboard**. *Last Refreshed* shows the time.
- **Data Quality Flags (AH):** updated for each edited row immediately, for all rows hourly, and on demand with **Admin → Recalculate data-quality flags**.

---

## Importing or pasting many leads

1. Paste the data into Lead Management. Paste values only (Ctrl+Shift+V) into the data columns (B–U, Y–Z, AB; E–N only for active custom fields). As an admin you may also paste into locked columns such as mobile, email, owner and source. Leave column A empty, or include existing unique IDs.
2. Pastes of up to ~2,000 rows are processed automatically: IDs, created dates, defaults, dropdowns and "Lead Created" log entries.
3. For bigger imports, or if a toast said the system was busy, run **Lead CRM → Admin → Process imported / pasted leads**. It is safe to run any time.

The simple edit trigger has a 30-second limit, which is why very large pastes need step 3.

**More than 10,000 leads:** use **Admin → Extend Lead Management by 5,000 rows**, which also re-applies validation, colours and protection to the new rows. The Follow-Up Log grows automatically.

## Resetting IDs before go-live

1. Delete the test rows from Lead Management (select rows → right-click → *Delete rows*).
2. Delete them from Follow-Up Log too.
3. Run **Admin → Recalculate ID counters**. The next IDs continue after the highest ID still present, or start at 000001 if the sheets are empty.

## Edit trigger mode, reminders, health check

- **Admin → Use installable edit trigger + strict locking:** the default; setup creates it. It must be created by the owner or an admin who can edit every protected range.
- **Admin → Use legacy simple edit trigger:** only for setups without installable triggers. Locking becomes warning-only.
- **Admin → Enable / Disable daily email reminders**, and **Send reminders now (test)**.
- **Admin → Run health check:** sheets, header formulas, named ranges, triggers (edit, change, open, hourly), counters, identity, admin list, locked columns, web app URL, counsellors without emails.
