# Troubleshooting

Start with **Lead CRM → Admin → Run health check**. It reports most configuration problems.

## Menu, setup and authorisation

| Symptom | Cause | Fix |
|---|---|---|
| No **Lead CRM** menu | Page not reloaded after install, or `onOpen` failed | Reload the tab and wait 5–10 seconds. If it is still missing, open Extensions → Apps Script → *Executions* to see the error. |
| "Authorization required" every time | Scopes changed after a code update | Run any menu item and accept again |
| "Google hasn't verified this app" | Private script, normal | Advanced → *Go to Lead CRM (unsafe)* → Allow |
| `Exception: Specified permissions are not sufficient` | Manifest scopes missing or edited | Restore `appsscript.json` from the repo, save, run `setupWorkbook` again |
| "This action is restricted to CRM administrators" | Your email is not in *Admin Emails*, or your email is hidden | Ask the owner to add you, or run as the owner. The owner always counts as an admin, except for files in a Shared Drive, where the *Admin Emails* list is required. |
| Setup stops at "Exceeded maximum execution time" (6 minutes) | Apps Script's per-run limit. Common causes: running with **Debug** instead of **Run**; a stage that waits on recalculation of a large sheet; or (code before the staged setup) an "OK" dialog waiting in an unwatched spreadsheet tab | Run `setupWorkbook` again with **Run**. Progress is saved per stage, so it continues from the stage that was interrupted (see SETUP.md *Setup runs in stages*). The execution log lists each stage's duration (`Setup stage 5/10 … took 48 s`), so note which stage is slow. To test quickly, use `setupWorkbookQuickTest` (1,000 rows). |
| Message "Setup is NOT finished yet" | Setup stopped safely before the time limit | Run `setupWorkbook` again (repeat until "Lead CRM created") |
| Setup keeps repeating the same stage | That one stage alone exceeds 6 minutes (very slow sheet), or saved progress is inconsistent | Use **Admin → Restart setup from the first stage**, close other heavy tabs, and run `setupWorkbookQuickTest` to check that setup works at 1,000 rows. Then report the slow stage name from the execution log. |
| Edits made during an unfinished setup show "Lead CRM automation error: Sheet … is missing" | Setup has not created every sheet yet | Finish setup first |
| `Sheet "…" is missing` | A CRM sheet was renamed or deleted | Rename it back exactly, or run **Admin → Set up / repair workbook** to recreate it |
| "Cannot call SpreadsheetApp.getUi() from this context" in logs | Function run from a trigger/editor without UI | Harmless; messages go to the execution log |

## Lead IDs, timestamps and tracking

| Symptom | Cause | Fix |
|---|---|---|
| New row has no Lead ID | Edit made while the CRM was busy (toast said so), a paste over 30 s, or an edit made by another script/API (no trigger fires) | **Admin → Process imported / pasted leads** |
| Lead ID jumped (e.g. 000007 → 000010) | IDs reserved by a rejected or duplicate paste | Expected; IDs are unique, not gap-free |
| Duplicate Lead ID highlighted red | ID typed or pasted manually, or copy-pasted rows | Clear the duplicate cell and edit any field in the row. A new ID is generated. Or run *Process imported / pasted leads*. |
| "Last Updated By" = *Unidentified user* | Google did not share the editor's email (consumer account / other domain) and they have not opened the sidebar in the last 30 days | Ask the user to run **Lead CRM → Identify me** or open **Log Follow-Up** once. Check that their email is in Counsellor Master. See SETUP.md §5. |
| "Last Updated By" shows an email instead of a name | Email not in Counsellor Master | Add the email to that counsellor's row |
| Every edit attributed to the admin or "Unidentified" after switching mode | Installable mode used with consumer/cross-domain accounts | **Admin → Use simple edit trigger** |
| Changes made but no audit entries | Edit trigger did not run (another script, very large paste, Sheets API) | *Process imported / pasted leads* compares each row with its snapshot and writes the missing audit entries |

## Dropdowns and validation

| Symptom | Cause | Fix |
|---|---|---|
| Substage dropdown missing, shows the wrong stage's list, or "Select a Lead Stage first" although a stage is set | Rows sorted / moved before the onChange refresh ran, or Stage Master changed by import | **Lead CRM → Refresh substage dropdowns** |
| New stage not in the Stage dropdown | Active Status not `Active`, or a typo/trailing space in Lead Stage | Fix the Stage Master row; check `'Lists & Settings'!R:R` |
| New counsellor missing from dropdown | Status not `Active`, or no name | Fix Counsellor Master; check `'Lists & Settings'!T:T` |
| "Invalid: input must fall within specified range" | Strict dropdown, value not in list | Choose from the list, or ask an admin to add the value |
| Red triangle on an existing value | The value was valid once but has since been deactivated (stage/counsellor/list) | Pick a current value; AH explains the problem |
| Cannot type a past date in Last Contact Date | It must be a valid date, not in the future | Check the date format of the sheet's locale |
| Mobile number loses leading `+` or `0` | Column format changed from Plain text | Select C2:C → Format → Number → *Plain text*, re-enter the value |
| Duplicate warning for a legitimate shared number | Duplicate Mobile Check = Warn (by design) | Ignore, or set the check to `Off` |

## Follow-up form (sidebar)

| Symptom | Cause | Fix |
|---|---|---|
| "No lead found" | Typo, or the lead has no ID yet | Use **Use selected row** on the lead row; check column A |
| "Another update is being saved…" | Another user was saving at the same moment for more than 20 s | Press Save again |
| "already saved (duplicate submission blocked)" | Double click, or network retry of a save that succeeded | Nothing to do; check Follow-Up Log |
| "identical follow-up … less than 2 minutes ago" | Same lead, type, outcome, remarks and date saved twice | If it really is a new activity, change the remarks |
| Save button stays disabled / "Error: …" | Network or authorisation problem | Close and reopen the sidebar; your form data is kept until you close it |
| Counsellor list is empty | No active counsellors | Admin: fix Counsellor Master |
| Stage list empty | No active stages | Admin: fix Stage Master |

## Dashboard

| Symptom | Cause | Fix |
|---|---|---|
| `#REF!` in a report | A spill was blocked because someone typed inside a report area | Admin: delete the typed value, or run *Set up / repair workbook* (rebuilds the Dashboard) |
| `#NAME?` in Data Quality Flags (AH) | Named ranges `SET_…` missing | Run *Set up / repair workbook* |
| Chart shows blank categories or misses a new stage/counsellor | Chart ranges are sized when an admin edits master data or refreshes | Admin: **Lead CRM → Refresh Dashboard** |
| Numbers look wrong for "today" | Spreadsheet time zone not set | File → Settings → Time zone, and `appsscript.json` timeZone |
| Two users fight over the filter | Dashboard filter cells are shared by everyone | Agree on usage, or make a personal copy (File → Make a copy) for analysis |
| Slow recalculation with many leads | Heavy dashboard / data-quality formulas over 10,000+ rows | Close the Dashboard tab while entering data. Archive old log rows. Duplicate highlighting in C/D can be turned off with Duplicate Mobile/Email Check = `Off`; the script still checks single entries. |

## Views, protections and triggers

| Symptom | Cause | Fix |
|---|---|---|
| Rows disappeared | A **Views** menu item set the shared filter | **Lead CRM → Views → Clear view filters**. For personal views use Data → Filter views. |
| Warning dialog on every sort | Warning-only protection on system columns | Click OK; this is intended |
| Callers can edit master sheets | Protections not applied with the correct admin list | **Admin → Reapply protections** |
| Admin cannot edit a master sheet | Admin email missing from the setting | Owner adds it and reapplies protections |
| Reminder emails not arriving | Not enabled, counsellor inactive or without email, or daily mail quota exhausted | Health check; **Admin → Send reminders now (test)**; consumer accounts have about a 100/day quota |
| Duplicate triggers | Code pasted into a copy that already had triggers | Apps Script → Triggers (clock icon) → delete duplicates, then run *Set up / repair workbook* |

## Where to see errors

Open **Extensions → Apps Script → Executions**. Every failed trigger or menu run is listed with its stack trace. Edit-trigger errors also appear briefly as a toast: "Lead CRM automation error: …".
