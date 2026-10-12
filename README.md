# Call Centre Lead CRM (Google Sheets + Apps Script)

A blank, manually maintained lead CRM for call centres and counselling teams, built entirely in Google Sheets with Apps Script. It needs no paid CRM or external API. The requirements are in [PROMPT.md](PROMPT.md).

Version 2 is built for counsellors who are salespeople, not IT people: wrong values are refused, anything typed where it is not allowed is put back automatically, missing data turns red and is counted, and the follow-up form will not save until it is complete.

Running `setupWorkbook()` in a blank Google Sheet builds:
- **Start Here** (first tab): what each sheet is for and the daily steps, on one screen.
- **Lead Management**: the daily working sheet. Counsellors may change only the white cells of their own leads; contact, assignment and automatic columns are grey. Strict validation (dropdowns, calendar dates) and an **edit guard** that undoes and logs anything not allowed, including pastes, clearing, fill-down and owner edits of automatic columns.
- **Lead Entry** (admins): the only way to add leads, with row-by-row checks and plain-English errors.
- **Follow-Up Log** (append-only audit trail), **Deleted Leads** (safe delete / restore / purge), **Access Log**.
- **Stage Master**, **Counsellor Master**, **Lists & Settings** (lists, settings, custom fields, Counsellor-Editable Fields).
- **Dashboard**: 13 KPIs including **Incomplete Leads**, stage / substage / counsellor / ageing / exception / trend / due reports, 6 charts.
- **Field Guide**: every column explained (same text as [docs/COLUMN_DICTIONARY.md](docs/COLUMN_DICTIONARY.md)).
- A short **Lead CRM** menu, a minimal **follow-up form** and **My overdue follow-ups**.
- An optional **counsellor web app** for people who should not have the spreadsheet.

| Folder | Contents |
|---|---|
| [`apps-script/`](apps-script) | `Config.gs`, `Validation.gs`, `Reset.gs`, `Setup.gs`, `Triggers.gs`, `LeadEntry.gs`, `DeleteLeads.gs`, `Guide.gs`, `FollowUp.gs`, `FollowUpSidebar.html`, `Menu.gs`, `CustomFields.gs`, `DataQuality.gs`, `Dashboard.gs`, `Web.gs`, `Portal.html`, `appsscript.json` |
| [`docs/`](docs) | [SETUP](docs/SETUP.md) · [ADMIN](docs/ADMIN.md) · [COLUMN DICTIONARY](docs/COLUMN_DICTIONARY.md) · [CONFIDENTIALITY](docs/CONFIDENTIALITY.md) · [TESTING](docs/TESTING.md) · [TROUBLESHOOTING](docs/TROUBLESHOOTING.md) · [LIMITATIONS](docs/LIMITATIONS.md) · [Visual guide (PowerPoint)](docs/Lead_CRM_System_Guide.pptx) |
| [`identity-app/`](identity-app) | Tiny separate sign-in app (runs as the visitor, permission: see your email only) that tells the counsellor web app who is signed in |
| [`test/`](test) | Node.js mock of the Sheets services and scenario tests (`node test/run-mock-tests.js apps-script`) |
| [`tools/`](tools) | `build-column-dictionary.js`: regenerates the column tables of COLUMN_DICTIONARY.md from the code |

**Quick start:**
1. Create a blank Google Sheet.
2. Open Extensions → Apps Script and paste in the files from `apps-script/`.
3. Run `setupWorkbook`, authorise, then reload the sheet.
4. Add leads in Lead Entry, share the file with counsellors as Editors.

See [docs/SETUP.md](docs/SETUP.md) for details.
