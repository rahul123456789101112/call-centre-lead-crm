# Known Limitations

This CRM is built only on Google Sheets and Apps Script, for one Google Workspace organisation (@companyname.com). These are the trade-offs and platform limits that remain.

## Identity, access and confidentiality
1. **Identity depends on the Workspace domain.**
   - The installable edit trigger (`e.user`) and the web app (`Session.getActiveUser()`) only receive the user's email when that user is in the same Workspace domain as the owner.
   - Guests from other domains appear as *Unidentified user* in the sheet and are always denied by the web app.
   - The legacy temporary-key mapping is used only in legacy simple mode.
2. **The owner account matters.**
   - The installable triggers and the web app run as the account that created them, so that account must stay active and keep edit rights on everything.
   - If ownership changes, the new owner must run *Set up / repair workbook* and redeploy the web app.
3. **Protections are not a confidentiality boundary.**
   - Anyone with any access to the spreadsheet (editor, commenter or viewer) can copy, download or print all of it.
   - Confidentiality therefore relies on **not sharing the spreadsheet with counsellors** and using the web app (CONFIDENTIALITY.md).
   - Admins and the owner always have full access.
4. **Copy/download/screenshot detection is limited.**
   - Apps Script receives no event for downloads, copies or prints of the spreadsheet. These appear only in the Workspace **Drive audit log**, which depends on your edition.
   - The web app reports Ctrl+C copies on a best-effort basis; screenshots, photos and printing the page cannot be detected.
5. **Strict locking side effects (counsellors still in the spreadsheet):**
   - they cannot sort Lead Management (sorting would move locked cells) and may not be able to change the shared filter; they should use personal *filter views*;
   - deleting whole rows is also blocked for them, which is intended.
6. The web app shows at most **300 leads per list** (search narrows it). Admins see all leads.
7. **Web app code changes need a new deployment version.** Until it is redeployed the web app keeps running the old code (SETUP.md §11).
8. Dashboard filter cells are **shared**: one admin changing the period changes it for everyone viewing.
9. *Views* in the menu use the sheet's shared basic filter. Personal views need *Data → Filter views*, which Apps Script cannot create without the Advanced Sheets API.

## Triggers and timing
10. **The stage→substage fast path runs in the simple `onEdit` trigger.**
    - It uses a cached copy of Stage Master (refreshed when Stage Master is edited, and at least every 6 hours). A stage list changed by an import or another script is picked up by *Refresh substage dropdowns* or after the cache expires.
    - Google still needs a moment (normally well under a second) to run it after the edit is saved.
    - If the same substage name exists under two stages, the fast path still clears it on a stage change (by design: always re-pick the substage).
11. **Installable triggers do not fire for edits made by scripts, the Sheets API or imports, and have a 30-second limit per simple trigger / 6 minutes per installable trigger.**
    - Very large pastes, or edits made while another save holds the lock for more than 15 s, may be left unprocessed until the next edit of that row, or until *Admin → Process imported / pasted leads* runs.
12. Row deletions do not fire `onEdit`. Deleting a lead row leaves its history in the log, which is intended, and nothing records the deletion.
13. **Audit "old values" come from the hidden snapshot column (AI).**
    - A lead that existed before the script, or whose snapshot was overwritten by a paste, has no reliable old value for its first change. After that the trail is exact.
    - Do not edit or paste into AI.
14. **Substage dropdowns are per-row rules written by the script.**
    - After sorting, inserting or deleting rows they are refreshed by the onChange trigger (throttled to every 30 s). Whether Google fires onChange for a sort has not been confirmed.
    - *Refresh substage dropdowns* is the fallback, and the script re-validates every substage change regardless.

## Reporting and data quality (performance trade-offs)
15. **The dashboard is not live.** It is computed by the script and refreshed:
    - when a filter changes;
    - hourly;
    - on *Refresh Dashboard*.
    It can therefore be up to an hour old. *Last Refreshed* shows its age.
    This replaced ~1,000 formulas that recalculated on every edit and made the sheet slow for everyone.
16. **Data Quality Flags (AH) are script values.**
    - Edited rows update immediately; all rows hourly.
    - Date-dependent flags ("Overdue follow-up") can lag by up to an hour after midnight.
    - Changes made outside the triggers show after the next hourly run.
17. **Duplicate detection** compares the last 10 digits of mobile numbers and full email addresses. It flags duplicates in AH and colours C/D, and does not block them (unless *Block* is set, for single entries).
18. **The dashboard reserves fixed space:**
    - 25 stages, 80 stage/substage pairs, 40 counsellors, 10 ageing buckets, 10 statuses/sources;
    - 62 days in the daily trend;
    - 500 rows in the due/overdue list;
    - the first 25 unassigned/unworked leads.
    Beyond these limits lists are truncated, not broken. Admins can enlarge them in `DASH_SIZES` (Dashboard.gs) and re-run setup.
19. **Snapshot vs period metrics.**
    - Total, Pending, Overdue, Converted, Lost, Not Contacted, No Activity and ageing are current or as-of-today, not historical.
    - Conversions *by day* come from `Lead Status → Converted` audit entries.
20. **Counsellor attribution.**
    - Activity metrics use the counsellor recorded on the activity (the signed-in counsellor in the web app).
    - Lead metrics use the *current* Assigned Counsellor.
    - Renaming a counsellor splits their history; add a new counsellor row instead.
21. **Follow-Up Count (V) and Total Activities (AG) remain `ARRAYFORMULA`s over the log.** On very large logs (over ~100k rows) they add about a second of background recalculation after each save. Archive old log rows yearly.
22. **Access Log and Follow-Up Log grow without limit.** Archive them yearly (a spreadsheet allows 10 million cells).
23. **Setup must be run with *Run*, not *Debug*, by the owner, and may need more than one run** on slow sheets. Progress is kept per stage.

## Data entry
24. **Lead Status values** `Converted`, `Lost`, `Duplicate` are fixed words used by reports and colours. Other lists are fully configurable.
25. **Columns must not be inserted, deleted or reordered** in Lead Management (A–AI) or Follow-Up Log (A–R).
    - Custom fields use 10 fixed, hideable slots (E–N); more than 10 are not supported.
    - A hidden column is not private for spreadsheet users.
26. **Lead IDs are unique and stable but not gap-free:** rejected or concurrent attempts can skip numbers.
27. **Activity backdating** is limited by *Max Backdate Days*. Activities typed directly into the log are not supported (they are recorded as tampering).
28. **Email reminders** depend on Google's daily MailApp quota (about 1,500 recipients/day for Workspace).

## What was verified, and how
The code was written without access to a live Google Sheets environment.
- Every `.gs` file and the scripts in both HTML files were syntax-checked with Node.js.
- An in-memory imitation of the Sheets/Apps Script services ran 113 scenario checks (TESTING.md → *Automated pre-release check*). They cover:
  - setup, edits and the stage fast path;
  - strict-locking configuration;
  - dashboard numbers and data-quality flags;
  - the web app's access control, ownership checks, field locks and Access Log;
  - migrations.
- **Not verified in a real spreadsheet/web app:**
  - actual trigger latency (how quickly the simple `onEdit` runs after a stage change, and that the dropdown refreshes in the open sheet without a reload);
  - Google's enforcement messages for strict protection;
  - conditional-format colours over banding;
  - chart appearance;
  - that the web app loads inside the spreadsheet sidebar iframe (third-party-cookie settings can block it; the sidebar then offers an *open in a new tab* link);
  - `e.user` / `Session.getActiveUser()` behaviour in your specific Workspace configuration;
  - whether sorting fires onChange;
  - real execution times on 10,000 rows.

Run the manual acceptance tests in TESTING.md before go-live.
