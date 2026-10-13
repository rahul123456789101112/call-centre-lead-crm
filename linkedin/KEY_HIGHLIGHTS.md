# Lead CRM — key highlights

Plain-language highlights, all based on what the code in this repository actually does. Numbers are from the repository at the time of writing.

1. **Zero-cost CRM on Google Sheets.** Built entirely with Google Sheets and Apps Script: no paid CRM, add-on or external API. One setup run builds 11 sheets in a blank spreadsheet, sized for **10,000 leads** (grows by 5,000 when full).

2. **Counsellor-proof by design.** Every editable cell rejects bad input (dropdowns, calendar dates, length limits). Lead Remarks is the only free-text cell counsellors get.

3. **Wrong edits are put back automatically.** An "edit guard" checks every change against a hidden copy of the last good values and undoes anything not allowed: editing someone else's lead, automatic columns (even by the owner), junk pasted over several columns, cleared dropdowns, formulas, typing in empty rows. Each attempt is logged.

4. **Stage → substage dropdowns that always match.** The substage list is rebuilt for each lead from the Stage Master sheet; changing the stage clears the old substage instantly.

5. **Required fields made visible.** Change a stage or outcome without a new follow-up date and the lead turns red ("Incomplete"), is counted per counsellor on the dashboard and does not count as worked until it is fixed. The follow-up form refuses to save until it is complete.

6. **Full follow-up history and audit trail.** Every call, field change (old → new), refused edit, deletion and reset is written to an append-only Follow-Up Log.

7. **Lead Entry with automatic IDs and duplicate checks.** Admins paste leads in bulk; each row is checked (mobile format, email, counsellor, source), duplicates are blocked or flagged, valid rows get IDs like LD-000001, invalid rows stay with a plain-English reason.

8. **Management dashboard.** 13 KPIs (leads worked, follow-ups done, overdue, conversions, incomplete leads…), 7 reports (stage, substage, counsellor, ageing, exceptions, daily trend, due/overdue) and 6 charts, with period and counsellor filters.

9. **Safe delete, restore and go-live reset.** Deleted leads move to an admin-only sheet with who / when / why and can be restored with their original ID. A one-click reset (type RESET, automatic backup) clears test data before launch.

10. **Optional secure web app.** Counsellors who shouldn't have the spreadsheet see only their own leads in a browser app with Google sign-in (signed, single-use tokens); every view and edit is logged.

## By the numbers

| | |
|---|---|
| Lines of code | ~6,600 (6,051 Apps Script + 592 HTML) |
| Code files | 16 in the CRM project + a 2-file sign-in app |
| Automated checks | 179 scenario checks against an in-memory mock of Google Sheets |
| Documentation | 8 guides (~18,000 words) incl. a column dictionary |
| Visual guide | 82-slide PowerPoint |
| Sheets built by setup | 11 |
| Lead capacity | 10,000 rows out of the box |

## How it was built

Designed from 5 years of CRM / MIS work with sales counsellors; developed with **Claude Code** (AI-assisted development). The AI accelerated the coding; the requirements, behaviour rules, edge cases, testing strategy and review were mine.
