# LinkedIn launch post

Copy the text between the lines. The first two lines show before "…see more".
Attach `images/01-cover-1200x1200.png` (or post `images/02-highlights-1080x1350.png` as the image and the cover in the first comment).

---

Small sales teams pay for CRMs nobody uses.
Or they run leads from a messy Excel file that breaks every week.

5 years as a CRM / MIS analyst taught me why:
counsellors ignore warnings, skip fields and type anything anywhere.

So I built a CRM that doesn't depend on anyone reading the rules.
100% Google Sheets + Apps Script. Zero licence cost.

What it does:
🔹 Rejects bad data: dropdowns, calendar dates, no free text except remarks
🔹 Puts wrong edits back automatically, with a one-line message
🔹 Stage → substage dropdowns that always match
🔹 Missing follow-up date? The lead turns red and shows up on the manager's dashboard
🔹 Full history: every call, change and refused edit is logged
🔹 Dashboard: 13 KPIs, stage, counsellor and ageing reports
🔹 Safe delete / restore and a one-click go-live reset
🔹 Sized for 10,000 leads

How I built it:
I designed the system from real counsellor behaviour and built it with Claude Code (AI-assisted development).
The AI wrote fast; my job was the rules, the edge cases and the testing: 179 automated checks.

Biggest lesson: don't build for the ideal user. Build for the tired one at 6 pm.

Running a sales or admissions team on spreadsheets?
Comment "CRM" and I'll share the template.

#CRM #GoogleSheets #AppsScript #DataAnalytics #SalesOperations

---

## Alternative 1 — short (~600 characters)

---

Most small sales teams don't need an expensive CRM.
They need one their counsellors can't break.

I built a lead CRM in Google Sheets + Apps Script:
🔹 bad data is refused, wrong edits are undone automatically
🔹 missing follow-ups turn red and show on the dashboard
🔹 full audit trail, 13-KPI dashboard, 10,000 leads
🔹 zero licence cost

Designed from 5 years of MIS work, built with Claude Code.

Want the template? Comment "CRM".

#CRM #GoogleSheets #SalesOperations

---

## Alternative 2 — technical

---

How do you make a Google Sheet "counsellor-proof"?
Validation alone isn't enough: pasting, fill-down and the file owner all bypass it.

My Lead CRM (Google Sheets + Apps Script) uses four layers:

🔹 Protection: the whole sheet is locked; only the editable columns of existing lead rows are open
🔹 Strict validation: reject-mode dropdowns and date ranges, refreshed daily
🔹 An edit guard: an installable onEdit trigger (runs as the owner) compares every edit with a hidden per-row snapshot and reverts anything not allowed (other counsellors' leads, system columns, bad values; via typing, paste, clear, fill-down or undo) and logs it
🔹 Required fields: a stage/outcome change without a new follow-up date marks the lead "Incomplete" and excludes it from "worked" KPIs until fixed

Also inside:
• Dependent stage → substage rules generated from a master sheet
• Script-computed dashboard instead of ~1,000 live formulas (much faster sheet)
• Resumable setup and reset that fit Apps Script's 6-minute limit
• Optional web app with HMAC-signed Google sign-in for personal accounts
• 179 scenario checks against an in-memory mock of the Sheets API

~6,600 lines, built with Claude Code. I owned the design, edge cases and tests; AI sped up the writing.

Happy to compare notes with anyone doing CRM / MIS on Google Workspace.

#AppsScript #GoogleSheets #CRM #DataAnalytics #Automation
