# Acceptance Tests (version 2)

Run these in a **copy** of the CRM (**File → Make a copy**) or before go-live, then remove the test data (ADMIN.md → *Resetting IDs before go-live*). Every rule in the version-2 request has at least one test. Record Pass / Fail for each.

**Accounts (any email providers):**
- **Owner**: the account that ran setup.
- **Admin**: listed in *Admin Emails*, not the owner.
- **Counsellor A**: email on *Sample Counsellor 1* in Counsellor Master. **Counsellor B**: on *Sample Counsellor 2*. Neither is an admin. Both are Editors of the spreadsheet.
- **Outsider**: an Editor of the spreadsheet who is in neither list (for the identity tests only).

**Preparation:** run `setupWorkbookQuickTest` as the Owner (SETUP.md §1). Put the counsellors' emails in Counsellor Master and the Admin's email in *Admin Emails*, run *Reapply protections*, share the file. Each person opens **Lead CRM → My overdue follow-ups** once (identification). "T" = today, "T+1" = tomorrow.

"Undone" below means: the cell shows its previous value again within a few seconds, a short message appears at the bottom right, and Follow-Up Log (Admin → Show admin sheets) has an **Edit Reverted** row with who, the field, the kept value and the attempted value.

---

## A. Structure, sheets and setup

| # | Role | Steps | Expected |
|---|---|---|---|
| A1 | Owner | Open the file after setup | **Start Here** is the first tab, fits on one screen, says what each sheet is for and 3 daily steps for counsellors and admins |
| A2 | Counsellor A | Look at the tabs | Only Start Here, Lead Management, Dashboard, Field Guide are visible |
| A3 | Admin | Admin → Show admin sheets, then Hide admin sheets | Lead Entry, Follow-Up Log, Stage Master, Counsellor Master, Lists & Settings, Access Log, Deleted Leads appear, then disappear |
| A4 | Counsellor A | Admin → Show admin sheets | "Only CRM administrators can do this." Nothing changes |
| A5 | Any | Lead Management | 35 columns A–AI, no columns after AI; Audit Snapshot (AI) and inactive custom columns hidden; white columns = Counsellor-Editable Fields, all others grey |
| A6 | Any | Hover over each header | Note starts with "Editable (your own leads)", "Locked - admin only" or "Auto - do not edit", then the meaning |
| A7 | Any | Field Guide | One row per Lead Management column (A–AI) with definition, type, who/when, source, format, locked?, admin edit?, validation, dashboard use; Lead Entry table below. Matches docs/COLUMN_DICTIONARY.md |
| A8 | Counsellor A | Type in Field Guide or Start Here | Refused (protected) |
| A9 | Owner | Admin → Run health check | All `OK` |
| A10 | Owner | Run Set up / repair workbook again | Leads, log, custom fields and settings kept; admin sheets hidden again |

## B. Lead Entry (adding leads)

| # | Role | Steps | Expected |
|---|---|---|---|
| B1 | Admin | In Lead Entry type: `Ravi Kumar`, `98765 43210`, course (active custom field), counsellor *Sample Counsellor 1*, source *Website*, priority *Hot*, remarks. Run **Add leads from Lead Entry** | Lead Management gets LD-… with mobile `9876543210`, Lead Created Date, default stage/substage/status, Lead Assigned Date, remarks; Lead Entry row cleared, R = Created, T = Lead ID; Follow-Up Log *Lead Created* |
| B2 | Admin | Rows with mobile `12345`; empty name; email `asha@example`; counsellor `Nobody`; a custom value outside Allowed Values. Run again | Each row stays, red, R = Error, S = plain message ("Mobile number must be 10 digits.", "Lead Name cannot be empty.", "… is not a valid email address.", "… is not an active counsellor…", "… is not allowed in …") |
| B3 | Admin | Paste 300 valid rows (values only) and run | All 300 created in one run with consecutive IDs; dropdowns in Lead Entry still work after the paste |
| B4 | Admin | *Duplicate Mobile Check* = Warn; add a lead with an existing mobile | Created; S says "Mobile number is also used by LD-…"; both leads show "Duplicate mobile" in AH, mobile cells orange |
| B5 | Admin | Set it to Block; add the same mobile again (also twice in one batch) | Refused: "Mobile number already belongs to LD-…" |
| B6 | Counsellor A | Lead CRM → Add leads from Lead Entry | "Only CRM administrators can do this." |
| B7 | Counsellor A, Admin, Owner | Type a name and mobile in an empty row of Lead Management | Undone: "New leads can only be added by an admin in the Lead Entry sheet…" (for counsellors the protection already refuses) |

## C. Who may change what in Lead Management

| # | Role | Steps | Expected |
|---|---|---|---|
| C1 | Counsellor A | Change Stage, Substage, Priority, Next Follow-Up Date, Outcome, Remarks, Status, an active custom field on **own** lead | Accepted; Last Updated By = Sample Counsellor 1, Last Activity Timestamp set; audit rows (old → new) |
| C2 | Counsellor A | Try to type in Lead Name, Mobile, Email, Assigned Counsellor, Lead Source | Google's "protected cell" message; nothing changes |
| C3 | Counsellor A | Type in a white cell of a lead assigned to Counsellor B | Undone: "Lead … is assigned to Sample Counsellor 2. You can only change your own leads." |
| C4 | Admin | Change Mobile to `98765-12345` | Accepted as `9876512345`; Follow-Up Log *Field Updated* Mobile Number old → new |
| C5 | Admin | Change Assigned Counsellor | Accepted; *Lead Assigned*; Previous Counsellor and Lead Assigned Date set |
| C6 | Owner and Admin | Type in Lead ID, Last Updated By, Lead Created Date, Last Stage Change Date, Previous Counsellor | Undone: "… is filled automatically." |
| C7 | Owner | Clear (Delete key) a Lead ID; paste over AA2:AF2; fill down Last Updated By | All undone |
| C8 | Owner | Type a number in Follow-Up Count (V) or Total Activities (AG) | Removed; formula result returns |
| C9 | Admin | Admin → Allow system-column correction for 10 minutes; change Previous Counsellor | Accepted and logged *System Field Corrected*; a *Correction Window Opened* row exists. Changing Lead ID is still undone. After 10 minutes changes are undone again |
| C10 | Outsider | Edit a white cell | Undone: "…not an active counsellor or admin…" |
| C11 | Counsellor A (before ever using the menu, or after Admin clears their key) | Edit a white cell | Undone: "Lead CRM does not know who you are yet. Click Lead CRM > My overdue follow-ups once…" Then use the menu and edit again: accepted |
| C12 | Admin | Lists & Settings → remove *Lead Remarks* from Counsellor-Editable Fields | Column Y turns grey; Counsellor A's edits there are refused; put it back: white again |

## D. Careless-user tests (each must be refused or fixed automatically)

| # | Role | Steps | Expected |
|---|---|---|---|
| D1 | Counsellor A | Type `tomorrow` (text) in Next Follow-Up Date | Refused by validation; if pasted: undone, "must be a real date. Double-click the cell and pick it from the calendar." |
| D2 | Counsellor A | Type a past date / a date more than 365 days ahead in Next Follow-Up Date (open lead) | Refused / undone |
| D3 | Counsellor A | Copy six junk cells from Notepad and paste over Stage … Outcome of own lead | Every cell put back; dropdowns still work in those cells; one *Edit Reverted* row per cell |
| D4 | Counsellor A | Select Stage, press Delete | Undone: "Lead Stage cannot be emptied…". Same for Priority, Outcome, Status, Next Follow-Up Date (open lead) |
| D5 | Counsellor A | Type in an empty row below the last lead | Refused by protection |
| D6 | Counsellor A | Type in a grey column (e.g. Mobile, Last Updated By) | Refused by protection |
| D7 | Counsellor A | Edit Counsellor B's lead | Undone (C3) |
| D8 | Counsellor A | After a call change only Outcome to *Not Connected* (no new date) | Lead ID + name turn red; AH "Incomplete: Next Follow-Up Date"; no follow-up counted yet. Then set Next Follow-Up Date T+1: red disappears, a *Sheet Update* Contact entry appears, Last Contact Date = T |
| D9 | Counsellor A | Fill down Stage *Interested* over own lead and Counsellor B's lead | Own lead changed (substage emptied, Incomplete: Lead Substage), B's lead put back |
| D10 | Counsellor A | Change Stage, then Ctrl+Z (Undo) | The previous stage returns and is audited as a normal change |
| D11 | Admin | Paste a new lead (ID, name, mobile) directly into Lead Management | Undone; message points to Lead Entry |
| D12 | Counsellor A | Type `=1+1` in Lead Remarks | Undone: "Formulas are not allowed…" |
| D13 | Counsellor A | Paste 600 characters into Lead Remarks | Undone: "Lead Remarks can have at most 500 characters…" |
| D14 | Counsellor A | Type `Payment Pending` in the Substage of an *Interested* lead | Refused / undone: "…is not a substage of "Interested"." |
| D15 | Counsellor A | Try to sort Lead Management or delete a row | Refused by protection (use Data → Create filter view) |
| D16 | Admin | Insert an empty column in Lead Management | Removed within seconds: "…empty column(s) that were added were removed." |
| D17 | Admin | Move or delete a column | Message "Lead CRM is paused…"; Follow-Up Log row "Lead Management columns"; edits are not processed. Ctrl+Z, then Admin → Re-check all lead rows: OK again |
| D18 | Admin | Delete a lead row directly | Message "…deleted directly. Use Undo…"; Follow-Up Log row with the lead counts |

## E. Validation rules (reject, never warn)

| # | Role | Steps | Expected |
|---|---|---|---|
| E1 | Any | Look at Data → Data validation for each white column | Every rule is "Reject the input" |
| E2 | Counsellor A | Double-click Next Follow-Up Date | Calendar appears; only today … today+365 accepted |
| E3 | Admin | Last Contact Date = T+1 | Refused |
| E4 | Admin | Mobile `98765abc`, `12345`, empty | Refused: "numbers only" / Mobile Number Message / "cannot be empty" |
| E5 | Admin | Email `abc` | Refused |
| E6 | Counsellor A | Status *Converted* while Stage is *Interested* | Undone: "A lead can be "Converted" only when Lead Stage is "Converted"." Same for Lost |
| E7 | Counsellor A | Stage → *Converted*, then back to *Interested* | Status becomes Converted, then Open, both logged |
| E8 | Admin | Set Allowed Values `MBA, BBA` on a custom field; Counsellor A types `PhD` | Refused; dropdown shows MBA, BBA |

## F. Required fields

| # | Role | Steps | Expected |
|---|---|---|---|
| F1 | Counsellor A | Stage change on an open lead whose Next Follow-Up Date is today or empty | Incomplete: Next Follow-Up Date (red Lead ID) until a new date is chosen |
| F2 | Counsellor A | Stage *Lost* without a substage | "Incomplete: Lead Substage (lost reason)"; choose a reason: complete |
| F3 | Admin | Dashboard | *Incomplete Leads* KPI and the *Incomplete Leads* column for each counsellor match the red rows |
| F4 | Admin | Note *Leads Worked (Period)*; make an incomplete stage change on a new lead; refresh | Not counted while incomplete; counted after it is completed |
| F5 | Owner | Enable reminders, Send reminders now (test) | Counsellor A's email lists incomplete leads and follow-ups due / overdue |

## G. Follow-up form

| # | Role | Steps | Expected |
|---|---|---|---|
| G1 | Counsellor A | Select own lead row → Lead CRM → Log follow-up | The lead is pre-selected; fields: Outcome, Stage, Substage, Next Follow-Up Date, Remarks, Save |
| G2 | Counsellor A | Press Save with fields missing (one at a time) | "Not saved yet:" with what is missing; nothing changes |
| G3 | Counsellor A | Fill everything, Save | "Saved. The history and counts update within a minute." White cells change at once; within a minute: Follow-Up Log Contact entry (Outbound Call, Sample Counsellor 1), Last Contact / Last Follow-Up / Last Updated By / Last Activity, Follow-Up Count +1, AH not Incomplete |
| G4 | Counsellor A | Double-click Save, or Save the same thing twice within 2 minutes | Second save refused ("already saved" / "less than 2 minutes ago") |
| G5 | Counsellor A | Open the form for Counsellor B's lead | Form hidden: "This lead is assigned to … You can only log follow-ups for your own leads." |
| G6 | Admin | Save a follow-up choosing Stage *Converted* | Saved at once; no next date required; Status Converted |
| G7 | Counsellor A | Lead CRM → My overdue follow-ups | Own incomplete leads first (red "Missing: …"), then due today / overdue; clicking selects the row and opens the form |

## H. Deleting, restoring, purging

| # | Role | Steps | Expected |
|---|---|---|---|
| H1 | Counsellor A | Admin → Delete lead(s) | "Only CRM administrators can do this." |
| H2 | Admin | Delete lead(s): enter two IDs and an unknown ID; confirm; leave the reason empty | "A reason is required. Nothing was deleted." |
| H3 | Admin | Repeat with a reason | Confirmation lists both leads; they move to Deleted Leads with Deleted At / By / Reason; *Lead Deleted* in Follow-Up Log; their older log rows are struck through; Dashboard Total Leads drops by 2 |
| H4 | Admin | Restore deleted lead (one ID) | Back in Lead Management with the same Lead ID and values; *Lead Restored* |
| H5 | Admin | Purge: answer the second question with anything but `PURGE` | "Not confirmed. Nothing was removed." |
| H6 | Admin | Purge with `PURGE` | Removed from Deleted Leads; *Lead Purged* logged; log history kept |

## I. Menu and messages

| # | Role | Steps | Expected |
|---|---|---|---|
| I1 | Any | Open the Lead CRM menu | Top: Log follow-up, My overdue follow-ups, Refresh dashboard, Add leads from Lead Entry (admins), Help; everything else under Admin |
| I2 | Counsellor A | Refresh dashboard | "The dashboard will refresh within a minute." Last Refreshed updates within a minute |
| I3 | All | Read every message seen in sections B–H | Short, plain English, no technical words |

## J. Dashboard

| # | Role | Steps | Expected |
|---|---|---|---|
| J1 | Admin | Log 2 follow-ups on one lead; refresh | Follow-Ups Completed 2, Unique Leads Contacted 1 |
| J2 | Admin | Change Reporting Period / Counsellor | Numbers refresh; Applied From / To and Last Refreshed change |
| J3 | Admin | Compare Total / Converted / Lost / Overdue with Lead Management filters | Equal (deleted leads excluded) |

## K. Optional web app

| # | Role | Steps | Expected |
|---|---|---|---|
| K1 | Outsider | Open the counsellor link | "Access denied" with their email; Access Log row |
| K2 | Counsellor A | Open the link | Only own leads; grey fields read-only |
| K3 | Counsellor A | Change Next Follow-Up Date to a past date / a custom field to a value outside Allowed Values | Refused with the same messages as the sheet; nothing saved |
| K4 | Counsellor A | Change Stage | Substage emptied, lead Incomplete; log a follow-up with all fields: complete again |
| K5 | Admin | Deactivate Counsellor A; Counsellor A clicks anything | "Access denied" |

## L. Speed and quota

| # | Steps | Expected |
|---|---|---|
| L1 | With 1,000+ leads, change Stage on several rows quickly | The Substage dropdown is right when you click it; typing is not delayed |
| L2 | Apps Script → Executions | `onEdit` well under a second; `onEditInstallable` typically 1–3 s; `processQueuedFollowUps` under a second when idle |
| L3 | After a normal working day, Apps Script → Executions | Total trigger time well below 90 minutes (personal-account quota, LIMITATIONS.md 16) |

---

## Automated pre-release check (developers)

[`test/`](../test) has an in-memory imitation of the Sheets / Apps Script services and 151 scenario checks:

```
node test/run-mock-tests.js apps-script
```

It covers: staged and quick setup, sheet visibility and protection, strict validation rules, custom fields with Allowed Values; Lead Entry (valid, invalid, duplicates Warn/Block, counsellor refused); the careless-user cases D1–D14 (text in a date cell, past / far dates, junk pasted over six columns with dropdowns restored, clearing cells, locked and system columns, empty rows, a lead typed directly, another counsellor's lead, formulas, over-long remarks, wrong substage, fill-down, undo, Converted without stage, unknown editor); admin and owner rules, the correction window, header restore; column insert / move detection and Re-check; the follow-up form (required fields, own leads only, the two-step counsellor save and its queue, duplicate saves, admin save); My overdue follow-ups; delete / restore / purge; dashboard Incomplete KPI and per-counsellor column, counsellor refresh; settings (Counsellor-Editable Fields); the web app and its sign-in; identity hand-off; maintenance, health check, reminders, repair and the upgrade from version 1.

It cannot evaluate Google Sheets formulas, enforce real protection, show the calendar picker or measure trigger timing. The manual tests above are the acceptance criteria.
