# Call Centre Lead CRM (Google Sheets + Apps Script)

A blank, manually maintained lead CRM for call centres and counselling teams, built entirely in Google Sheets with Apps Script. It needs no paid CRM or external API. The requirements are in [PROMPT.md](PROMPT.md).

Running `setupWorkbook()` in a blank Google Sheet builds:
- **Lead Management**: 10,000 pre-formatted rows, 10 optional custom-field slots (hidden until an admin adds a field), auto Lead IDs, fixed timestamps, dependent stage/substage dropdowns, colour-coded follow-ups and data-quality flags.
- **Follow-Up Log**: an append-only activity history and audit trail (contact activity / record update / system activity).
- **Stage Master** and **Counsellor Master**: configurable, with sample data you replace.
- **Dashboard**: 12 KPIs, stage, substage, counsellor, ageing, exception, daily-trend and pending reports, and 6 charts, controlled by a date-range and counsellor filter.
- **Lists & Settings**: dropdown lists, ageing buckets and settings.
- A **Lead CRM** menu and a **Log Follow-Up** sidebar (LockService + duplicate-submission protection).
- A **counsellor web app** (runs as the owner): each counsellor sees and edits only their own leads, with every view and edit recorded in an **Access Log**. The master sheet is shared with admins only.
- **Strict, configurable column locking** for counsellors. An installable trigger running as the owner does the system writes.

| Folder | Contents |
|---|---|
| [`apps-script/`](apps-script) | `Config.gs`, `Setup.gs`, `Triggers.gs`, `FollowUp.gs`, `FollowUpSidebar.html`, `Menu.gs`, `CustomFields.gs`, `DataQuality.gs`, `Dashboard.gs`, `Web.gs`, `Portal.html`, `appsscript.json` |
| [`docs/`](docs) | [SETUP](docs/SETUP.md) · [ADMIN](docs/ADMIN.md) · [CONFIDENTIALITY](docs/CONFIDENTIALITY.md) · [TESTING](docs/TESTING.md) · [TROUBLESHOOTING](docs/TROUBLESHOOTING.md) · [LIMITATIONS](docs/LIMITATIONS.md) |
| [`test/`](test) | Node.js mock of the Sheets services and scenario tests (`node test/run-mock-tests.js apps-script`) |

**Quick start:**
1. Create a blank Google Sheet.
2. Open Extensions → Apps Script and paste in the files from `apps-script/`.
3. Run `setupWorkbook`, authorise, then reload the sheet.

See [docs/SETUP.md](docs/SETUP.md) for details.
