# Known Limitations

This CRM is built only on Google Sheets and Apps Script, owned by a personal Google account, used by people with any Google account. These are the limits that remain, stated plainly.

## What the sheet can and cannot enforce

1. **The sheet itself cannot stop someone leaving a cell empty.** Google Sheets has no "required cell". The CRM does the next best things:
   - **the follow-up form (sidebar and web app) refuses to save** until Outcome, Stage, Substage (when the stage has substages), Next Follow-Up Date (open leads) and Remarks are filled;
   - in the sheet, a dropdown or date that **had** a value cannot be emptied (the guard puts it back);
   - a stage or outcome change without a new follow-up date, or a stage without its substage, makes the lead **Incomplete**: red Lead ID, "Incomplete: …" in column AH, counted per counsellor on the Dashboard, listed first in *My overdue follow-ups*, in the reminder email, and its sheet updates do not count as worked or followed up until it is completed.
   A counsellor who simply never touches a lead is not "incomplete"; that shows as overdue / not contacted instead.
2. **Wrong edits are undone after they happen, not prevented.** Data validation refuses typed values, but pasting, fill-down and the owner bypass it, so the edit guard (installable trigger) checks every edit and puts back what is not allowed. For a few seconds the wrong value is visible; then it is replaced and a message appears. If Google does not run the trigger (rare outages), **Admin → Re-check all lead rows** repairs everything later.
3. **The reference for "the previous value" is the hidden Audit Snapshot (AI).** Pasting a whole row including the hidden column (only possible for admins) overwrites it; the CRM then warns "Press Ctrl+Z (Undo) now" and logs it, but cannot restore the row by itself.
4. **Repeating the same outcome in the sheet is not counted.** Choosing "Not Connected" again when the cell already says "Not Connected" is not a change. The follow-up form always records a follow-up.
5. **"A new follow-up date is needed" is only asked when the old date is today, in the past or empty.** If the lead already has a future follow-up date, changing the outcome keeps it.
6. **Counsellors cannot sort Lead Management or change the shared filter** (the sheet is protected). They use *Data → Create filter view* (personal) or *My overdue follow-ups*. They also cannot insert or delete rows or columns.
7. **Data validation dates are fixed dates moved forward once a day** (so the calendar picker appears). Past follow-up dates that were valid when entered show Google's small red "invalid" corner; the cell is also coloured red as overdue.
8. **Lead Status values** `Converted`, `Lost`, `Duplicate` are fixed words used by rules and reports.

## Identity, access and confidentiality

9. **Any spreadsheet Editor can copy, download or print everything** — every counsellor's leads, hidden sheets, logs — and with a personal Gmail owner this is **not logged** (no Drive audit log without Google Workspace). Hidden sheets can be unhidden by any editor. See [CONFIDENTIALITY.md](CONFIDENTIALITY.md); the optional web app is the only way to give someone their own leads without the file.
10. **Any spreadsheet Editor can open Extensions → Apps Script**, read the code and Script Properties (the web-app secret, the identity map) and change the code that the owner's triggers run. This is how container-bound scripts work and cannot be switched off. Share edit access only with people you trust not to tamper; keep this repository's code to re-paste.
11. **Identity in a personal-Gmail-owned script.** Google does not tell the owner's triggers who is editing. Edits are attributed through Google's temporary user key, registered when the person uses the Lead CRM menu (Google rotates it every 30 days; the next menu use re-registers it). With *Block Edits From Unknown Users* = Yes, an unidentified person's edits are undone until they click the menu once. If Google's key hand-off fails for your accounts (not verified in a live sheet), every counsellor edit would be undone: set the setting to No (then "own leads only" can only be checked for identified editors).
12. **Two edits of the same cell with the same value by different people within 2 minutes** could be attributed to the later editor.
13. **The owner account matters.** Triggers run as the account that created them. If ownership changes, the new owner must run *Set up / repair workbook*.
14. **Shared Google accounts cannot be told apart.**

## Triggers, timing and quotas

15. **Counsellor form saves are written in two steps.** The white cells change at once; the Follow-Up Log entry, Last Updated By, dates and counts follow within about a minute (the owner's every-minute trigger, or the next edit in the sheet). Admin and web-app saves are written at once.
16. **Daily trigger time quota.** Personal Google accounts get about **90 minutes of trigger run time per day** (Google Workspace: 6 hours). Every edit runs the guard (typically 1–3 seconds, including up to 3 s waiting for the identity hand-off); the every-minute queue check takes well under a second when there is nothing to do. A team making several thousand sheet edits per day can reach the limit; the follow-up form is cheaper per update. When the quota is used up, Google stops running triggers until the next day; run **Admin → Re-check all lead rows** afterwards.
17. **Very large pastes** (thousands of rows) or edits made while another save holds the lock for over a minute may not be processed; **Admin → Re-check all lead rows** processes them.
18. **Rows deleted directly** (by an admin, not with *Delete lead(s)*) are detected by count only: the CRM logs how many leads disappeared and asks for Undo; it cannot tell which ones.
19. **Column moves:** an inserted empty column is removed automatically; a moved or deleted column cannot be repaired by the script. The CRM pauses until an admin presses Undo and runs *Re-check all lead rows*. Whether Google fires onChange for every kind of column move has not been verified.
20. **Substage dropdowns are per-row rules.** After sorting (admins) they are rebuilt by the onChange trigger (throttled to every 30 s); *Admin → Refresh substage dropdowns* is the fallback, and every substage value is checked anyway.

## Reporting

21. **The Dashboard is not live.** It is calculated by the script on a filter change, hourly and on *Refresh dashboard* (for counsellors: by the owner's trigger within a minute). *Last Refreshed* shows its age.
22. **Data Quality Flags (AH)** are updated for edited rows at once and for all rows hourly; date-based flags ("Overdue follow-up") can lag by up to an hour after midnight.
23. **Fixed report sizes:** 25 stages, 80 stage/substage pairs, 40 counsellors, 10 ageing buckets, 62 days of trend, 500 due/overdue rows, the first 25 unassigned/unworked leads. Larger lists are cut, not broken (`DASH_SIZES` in Dashboard.gs).
24. **"Worked" and "incomplete".** Record Update entries of a lead that is incomplete *now* are not counted as worked; once it is completed, they count again (also for earlier periods).
25. **Counsellor attribution:** activity metrics use the counsellor on the activity; lead metrics use the current Assigned Counsellor. Renaming a counsellor splits their history.
26. **Follow-Up Count (V) and Total Activities (AG)** are ARRAYFORMULAs over the log: about a second of recalculation after each save on very large logs. Archive old log rows yearly.

## Data entry and storage

27. **Columns must not be inserted, deleted or reordered** in Lead Management (A–AI) or Follow-Up Log (A–R). Custom fields use 10 fixed, hideable slots (E–N); more than 10 are not supported.
28. **Lead IDs are unique and permanent but not gap-free.**
29. **Purging a deleted lead keeps its Follow-Up Log entries**, which contain the lead's name. To erase a person completely, an admin must also delete those log rows by hand (recorded as *Log Edited*).
30. **Lead Entry** checks up to about 4 minutes of rows per run (thousands of rows); the rest are left for the next run.
31. **Email reminders** depend on Google's daily mail quota (about 100 recipients/day for a personal Gmail owner).
32. **Access Log, Follow-Up Log and Deleted Leads grow without limit.** Archive them yearly (a spreadsheet allows 10 million cells).
33. **Setup must be run with *Run*, not *Debug*, by the owner,** and may need more than one run.

## What was verified, and how

The code was written without access to a live Google Sheets environment.
- Every `.gs` file and the scripts in both HTML files were syntax-checked with Node.js.
- An in-memory imitation of the Sheets/Apps Script services ran **151 scenario checks** (`node test/run-mock-tests.js apps-script`, TESTING.md). They cover setup and upgrade, Lead Entry, every "careless user" case in TESTING.md, the edit guard for counsellors / admins / owner, the correction window, column-layout detection, the follow-up form and its queue, delete / restore / purge, the dashboard numbers, the web app and its sign-in, and identity hand-off.
- **Not verified in a real spreadsheet:**
  - how fast the guard reverts in practice, and what Google's protected-cell message looks like;
  - that Google fires `onEdit` for undo, fill-down and multi-range pastes exactly as assumed, and onChange for every column change;
  - that `Session.getTemporaryActiveUserKey()` works in simple triggers for your accounts, and the 3-second hand-off timing;
  - that a normal paste replaces data validation the way described, and that re-applying it after the paste is enough;
  - the calendar picker with date-between validation, colours over the white/grey rules, chart appearance;
  - the trigger-time quota used by a real team;
  - real execution times on 10,000 rows.

Run the manual tests in TESTING.md before go-live.
