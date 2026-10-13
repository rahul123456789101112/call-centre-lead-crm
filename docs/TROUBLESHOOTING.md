# Troubleshooting

Start with **Lead CRM → Admin → Run health check**. Errors of triggers are listed in **Extensions → Apps Script → Executions**.

## Menu, setup and authorisation

| Symptom | Cause | Fix |
|---|---|---|
| No **Lead CRM** menu | Page not reloaded after install, or `onOpen` failed | Reload and wait 5–10 s; check Executions |
| "Google hasn't verified this app" | Private script, normal | Advanced → *Go to Lead CRM (unsafe)* → Allow |
| `Specified permissions are not sufficient` | Manifest changed | Restore `appsscript.json` from the repo, run `setupWorkbook` |
| "Only CRM administrators can do this." | Your email is not in *Admin Emails* | Ask the owner to add it, then *Reapply protections* |
| "Setup is NOT finished yet" / "Exceeded maximum execution time" | 6-minute limit | Run `setupWorkbook` again with **Run** (not Debug); progress is kept per stage. To test fast use `setupWorkbookQuickTest` |
| Setup stops at stage 5 with "Exception: Ranges must have at least one range." | Version 2.0.0 bug: the Counsellor-Editable Fields list (Lists & Settings, column AE) gave no usable column, and an empty colour rule was refused by Google | Fixed: re-paste `Config.gs` and `Setup.gs`, run `setupWorkbook` again (it continues at stage 5). Then check column AE: the CRM now falls back to the default list when AE is empty or unreadable |
| Setup repeats the same stage | That stage alone takes over 6 minutes | *Admin → Restart setup from the first stage*, close other tabs, try the quick test, report the slow stage from the execution log |
| `Sheet "…" is missing` | A CRM sheet was renamed or deleted | Rename it back, or run *Set up / repair workbook* |
| I cannot find Lead Entry / Stage Master / Lists & Settings | Admin sheets are hidden | *Lead CRM → Admin → Show admin sheets* |
| "The reset is NOT finished yet" | Large sheets, 6-minute limit | Run *Admin → Reset CRM to fresh start* again and answer Yes |
| Restore from reset backup: "already holds leads" | Leads were added after the reset | Use File → Version history, or delete the new leads first |

## "My change was undone"

The edit guard puts back anything that is not allowed and says why at the bottom right. Every case is logged in Follow-Up Log as *Edit Reverted*.

| Message | Why | What to do |
|---|---|---|
| "… is filled automatically. Your change was undone." | Automatic column (nobody may change it) | Nothing. For a genuine fix an admin uses *Admin → Allow system-column correction for 10 minutes* |
| "Only an admin can change …" | Contact / assignment column, or a column not in Counsellor-Editable Fields | Ask an admin |
| "Lead … is assigned to … You can only change your own leads." | Not your lead | Ask an admin to reassign it |
| "New leads can only be added by an admin in the Lead Entry sheet…" | Typing in a row without a Lead ID | Admin: use Lead Entry |
| "… must be a real date. Double-click the cell…" | Text or a number in a date cell | Double-click and pick the date |
| "Next Follow-Up Date cannot be in the past." / "…must be within 365 days…" | Date outside the allowed range | Pick today or later (or change *Max Next Follow-Up Days*) |
| "… cannot be emptied. Choose a value instead." | Delete pressed on a dropdown or date | Choose another value |
| "… is not a substage of …" | Substage of another stage | Pick from the dropdown |
| "A lead can be "Converted" only when Lead Stage is "Converted"…" | Status / stage rule | Change the stage; the status follows |
| "Formulas are not allowed in …" | A cell started with `=` | Type plain text |
| "Lead CRM does not know who you are yet…" | The CRM could not identify you | Click *Lead CRM → My overdue follow-ups* once, then edit again |
| "…your Google account is not an active counsellor or admin…" | Your email is not Active in Counsellor Master | Admin: add exactly that email / set Active |
| Every counsellor edit is undone with "does not know who you are" even after using the menu | Google's temporary-key hand-off does not work for these accounts | Admin: set *Block Edits From Unknown Users* = No (LIMITATIONS.md 11), and report it |
| "You pasted over the hidden Audit Snapshot column…" | A full row was pasted including column AI | Ctrl+Z immediately |

## Incomplete leads (red Lead ID)

| Symptom | Cause | Fix |
|---|---|---|
| "Incomplete: Next Follow-Up Date" | Stage or outcome changed without a new follow-up date | Choose a new Next Follow-Up Date, or use the follow-up form |
| "Incomplete: Lead Substage (lost reason)" / "Lead Substage" | The stage has substages and none is chosen | Choose the substage |
| Red stays after fixing | Flags of rows changed outside the triggers update hourly | *Admin → Recalculate data-quality flags* |

## Lead Entry

| Symptom | Cause | Fix |
|---|---|---|
| Row stays red with a message | It failed a check | Fix what the message says, run *Add leads from Lead Entry* again |
| "Mobile number must be 10 digits." for +91 numbers | Default pattern is exactly 10 digits | Remove +91, or change *Mobile Number Pattern* and *Mobile Number Message* |
| "… row(s) were not checked yet (time limit)" | Very large batch | Run it again |

## Follow-up form

| Symptom | Cause | Fix |
|---|---|---|
| "Not saved yet:" list | Required fields missing | Fill them |
| Form hidden: "This lead is assigned to …" | Not your lead | Choose one of your leads |
| Saved, but Follow-Up Log / Last Updated By not changed yet | Counsellor saves are finished by the owner's trigger | Wait a minute. If it never happens: health check → "Follow-up queue trigger installed"; re-run setup as the owner |
| "The same follow-up … less than 2 minutes ago" | Double save | Nothing to do; change the remarks if it really was a new call |
| "Lead CRM is busy…" | Another save held the lock | Press Save again |

## Lead Management

| Symptom | Cause | Fix |
|---|---|---|
| "Lead CRM is paused because columns … were moved or deleted" | Column layout changed | Admin: Ctrl+Z, then *Admin → Re-check all lead rows* |
| Counsellor cannot sort / filter | Sheet protection | *Data → Create filter view* (personal), or *My overdue follow-ups* |
| Substage dropdown shows the wrong list | Rows sorted by an admin before the refresh ran | *Admin → Refresh substage dropdowns* |
| Small red corner on old follow-up dates | The date rule moves forward daily; old dates are now in the past | Normal for overdue leads; set a new date |
| New lead rows not editable for counsellors | Protection not updated (another tool added rows) | *Admin → Re-check all lead rows* (updates the open ranges) |
| "… lead row(s) were deleted directly" | Rows deleted by hand | Ctrl+Z, then *Admin → Delete lead(s)* |

## Dashboard, reminders, web app

| Symptom | Cause | Fix |
|---|---|---|
| Numbers look old | Calculated, not live | Change a filter or *Refresh dashboard*; check *Last Refreshed* and the hourly trigger |
| Counsellor's refresh does nothing | Done by the every-minute trigger | Wait a minute; check the trigger in health check |
| Reminder emails not arriving | Not enabled, counsellor inactive / without email, or mail quota | Health check; *Send reminders now (test)* |
| Web app: "Access denied" | Signed-in email not Active in Counsellor Master / not in Admin Emails | Add exactly that email |
| Web app: "Please sign in" / "Sign-in link expired" | Main URL opened directly or old link | Use the counsellor link (sign-in app URL) |
| Web app shows old behaviour | Deployment still on the old version | Deploy → Manage deployments → New version |

## Triggers and quotas

| Symptom | Cause | Fix |
|---|---|---|
| Nothing is checked or undone any more; Executions shows "Service using too much computer time for one day" | Daily trigger quota (about 90 min for personal accounts) | Wait until the next day; then *Admin → Re-check all lead rows*. Encourage the follow-up form; see LIMITATIONS.md 16 |
| Duplicate triggers | Code pasted into a copy that already had triggers | Apps Script → Triggers: delete duplicates, run *Set up / repair workbook* |
| Triggers run as the wrong person | Setup was run by someone other than the owner | Owner: delete the triggers, run setup |
