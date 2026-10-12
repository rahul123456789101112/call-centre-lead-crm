# Known Limitations

This CRM is built only on Google Sheets and Apps Script. These are the trade-offs and platform limits that remain.

## Identity and security
1. **Editor identity is not always available.**
   - Google gives a simple `onEdit` trigger the editor's email only in some cases: the same Workspace domain, or the script owner.
   - For consumer (gmail.com) or cross-domain users, the CRM relies on a temporary-key mapping. That mapping exists only after the user has opened the follow-up form or *Identify me*, and Google rotates the key every 30 days (re-registered on next use).
   - Until then, sheet edits show *Unidentified user*. Follow-ups logged through the form always record a counsellor, because the caller selects one.
2. **Installable edit-trigger mode** runs as the admin. It attributes edits correctly only where Google populates `e.user`, which in practice means a single Workspace domain.
3. **Protections are safeguards, not a security boundary.**
   - System/formula columns and the Follow-Up Log use *warning* protection, because the edit trigger and the follow-up form run as the caller and callers must be able to sort.
   - A determined editor can bypass the warnings, edit or delete log rows, or restore old versions. Manual log edits are themselves logged, but deleting whole log rows does not fire `onEdit` and is not detected.
   - Use version history and periodic copies for assurance.
4. Dashboard filter cells are **shared**: one user changing the period changes it for everyone viewing.
5. *Views* in the menu use the sheet's shared basic filter. Personal views need *Data → Filter views*, which Apps Script cannot create without the Advanced Sheets API.

## Triggers and timing
6. **Simple triggers have a 30-second limit and do not fire for edits made by scripts, the Sheets API, imports or form submissions.**
   - Pastes of more than ~2,000 rows, or edits made while another save holds the lock for more than 15 s, may be left unprocessed until the next edit of that row, or until *Admin → Process imported / pasted leads* runs.
7. Row deletions do not fire `onEdit`. Deleting a lead row leaves its history in the log, which is intended, and nothing records the deletion.
8. **Audit "old values" come from the hidden snapshot column (AI).**
   - A lead that existed before the script, or whose snapshot was overwritten by a paste, has no reliable old value for its first change.
   - After that the trail is exact.
   - If a whole lead row is copy-pasted, the duplicate-ID check treats the pasted row as a new lead and rebuilds its snapshot. Pasting *only* the hidden column AI over another lead would corrupt that lead's baseline, so do not edit or paste into AI.
9. **Substage dropdowns are per-row rules written by the script.**
   - After sorting, inserting or deleting rows they are refreshed by the onChange trigger (throttled to every 30 s). Whether Google fires onChange for a sort has not been confirmed (see "What was verified" below).
   - *Refresh substage dropdowns* is the fallback, and the script re-validates every substage change regardless.
10. After choosing a stage, there is a short delay (usually under 2 seconds) before the matching substage list appears in the Lead Substage column (Q).

## Reporting
11. **The dashboard reserves fixed space:**
    - 25 stages, 80 stage/substage pairs, 40 counsellors, 10 ageing buckets, 10 statuses/sources;
    - 62 days in the daily trend;
    - 500 rows in the due/overdue list;
    - the first 25 unassigned/unworked leads.
    Beyond these limits lists are truncated, not broken. Admins can enlarge them by editing `setupDashboard_` (the section sizes) and re-running setup.
12. Chart ranges are resized only when an admin edits master data or runs *Refresh Dashboard*. Between refreshes a chart may show an empty category or omit a new one.
13. **Snapshot vs period metrics.**
    - Total, Pending, Overdue, Converted, Lost, Not Contacted, No Activity and ageing are current or as-of-today, not historical. Converted and Lost also include leads converted outside the period.
    - Conversions *by day* come from `Lead Status → Converted` audit entries, so conversions made before the script existed, or edits that bypassed the trigger, are not in the daily trend.
14. **Counsellor attribution.**
    - Activity metrics use the counsellor recorded on the activity, which is chosen in the form.
    - Lead metrics use the *current* Assigned Counsellor.
    - Historical names are kept as text, so renaming a counsellor splits their history; add a new counsellor row instead.
15. **Duplicate mobile/email highlighting** is conditional formatting (`COUNTIF` per visible cell), not a column formula, so it adds no whole-sheet recalculation. As a result:
    - duplicates are not listed in Data Quality Flags and cannot be filtered by text;
    - numbers stored with a leading `+` may not be matched by `COUNTIF`.
    The script's entry-time check (exact text match, with toast) still works.
16. **Setup must be run with *Run*, not *Debug*, and may need more than one run** on slow sheets. Progress is kept per stage (see SETUP.md). A single stage that alone takes more than 6 minutes cannot be resumed part-way; that has not been observed but cannot be ruled out without a real test.
17. Reports are formula-based (FILTER/COUNTIFS/QUERY) and not pivot tables. Admins can add pivot tables on extra sheets. Google Sheets' practical limit (10 million cells, recalculation speed) means very large logs (over ~200k activities) will slow the dashboard. Archive old log rows to another file yearly if needed.

## Data entry
18. **Lead Status values** `Converted`, `Lost`, `Duplicate` are fixed words used by reports and colours. Other lists are fully configurable.
19. **Columns must not be inserted, deleted or reordered** in Lead Management (A–AI) or Follow-Up Log (A–R). Custom fields use 10 fixed, hideable slots (E–N); more than 10 custom fields are not supported. A hidden custom column is not private: any editor can unhide it.
20. **Lead IDs are unique and stable but not gap-free:** rejected or concurrent attempts can skip numbers.
21. **Activity backdating** in the form is limited by *Max Backdate Days*. Activities typed directly into the log are not supported (they are recorded as tampering).
22. **Email reminders** depend on Google's daily MailApp quota (about 100 recipients/day for consumer accounts, about 1,500 for Workspace).

## What was verified, and how
The code was written without access to a live Google Sheets environment.
- Each `.gs` file and the sidebar script were syntax-checked with Node.js.
- A mock run executed setup, edits, pastes, sorting, sidebar submissions, master-data changes and log tampering against an in-memory imitation of the Sheets services (see TESTING.md).
- **Not verified in a real spreadsheet:**
  - the behaviour of the written Sheets formulas (QUERY/FILTER/ARRAYFORMULA results and performance at 10,000 rows);
  - conditional-format and data-validation rendering;
  - chart appearance;
  - real protection behaviour;
  - `Session.getTemporaryActiveUserKey()` availability inside simple triggers;
  - whether sorting fires onChange;
  - simple-trigger timing.

Run the manual acceptance tests in TESTING.md before go-live.
