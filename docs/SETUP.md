# Setup Guide: Install and Authorise the Lead CRM (version 2)

This builds the complete Call Centre Lead CRM inside a **blank Google Sheet** using the Apps Script files in [`/apps-script`](../apps-script). It needs no paid CRM, add-on or external API.

**Who the design is for.** Counsellors are salespeople, not IT people: they ignore warnings, type into any cell they can, use wrong date formats and leave fields empty. So the CRM does not rely on anyone reading or obeying anything:
- wrong values are **refused**, never just flagged;
- anything typed where it is not allowed is **put back automatically** with a short message;
- what is missing is shown in **red** and counted on the Dashboard;
- the follow-up form **will not save** until every required field is filled.

---

## 1. Install (about 10 minutes, done once by the owner)

1. Create a new, blank Google Sheet (sheets.new), for example "Lead CRM".
   Use the Google account that will **own** the CRM. A personal Gmail account is fine; ideally use a dedicated account rather than a counsellor's own.
   **The owner must run setup.** The installable triggers run as that account, which is what lets them write to columns counsellors cannot edit and put back wrong changes.
2. Set the sheet's time zone: **File → Settings → General → Time zone** (for example *(GMT+05:30) India Standard Time*). All dates, "today" and overdue checks use it.
3. Open **Extensions → Apps Script**. Rename the project to "Lead CRM".
4. Create these files and paste in the contents from `/apps-script`. Use exactly these names; Apps Script adds `.gs` itself.

   | File in repo | Create in Apps Script as |
   |---|---|
   | `Config.gs` | Script → `Config` |
   | `Validation.gs` | Script → `Validation` (new in version 2) |
   | `Setup.gs` | Script → `Setup` |
   | `Triggers.gs` | Script → `Triggers` |
   | `LeadEntry.gs` | Script → `LeadEntry` (new in version 2) |
   | `DeleteLeads.gs` | Script → `DeleteLeads` (new in version 2) |
   | `Guide.gs` | Script → `Guide` (new in version 2) |
   | `FollowUp.gs` | Script → `FollowUp` |
   | `Menu.gs` | Script → `Menu` |
   | `CustomFields.gs` | Script → `CustomFields` |
   | `DataQuality.gs` | Script → `DataQuality` |
   | `Dashboard.gs` | Script → `Dashboard` |
   | `Web.gs` | Script → `Web` |
   | `FollowUpSidebar.html` | HTML → `FollowUpSidebar` (the name must match exactly) |
   | `Portal.html` | HTML → `Portal` (the name must match exactly) |

   Delete the default `Code.gs`.
5. **Manifest:** **Project Settings (⚙) → tick "Show 'appsscript.json' manifest file in editor"**. Replace `appsscript.json` with [`apps-script/appsscript.json`](../apps-script/appsscript.json). Change `"timeZone"` if you are not in India.
6. Save (Ctrl/Cmd + S).
7. In the function dropdown choose **`setupWorkbook`** and click **Run** (not *Debug*). To try it first with 1,000 rows, run **`setupWorkbookQuickTest`** instead.
8. Authorise when prompted (§2).
9. **If the message says "Setup is NOT finished yet", run `setupWorkbook` again** (see below).
10. When it says **"Lead CRM created"**, go back to the spreadsheet and **reload the page**. The **Lead CRM** menu appears after a few seconds, and the **Start Here** tab is shown first.

### Setup runs in stages

Apps Script stops any run after 6 minutes, so setup has 11 resumable stages:

1. Create sheets
2. Lists & Settings
3. Stage Master & Counsellor Master
4. Lead Management layout
5. Lead Management validation & colours
6. Follow-Up Log, Access Log & Deleted Leads
7. Lead rows, formulas & data quality
8. Lead Entry, Start Here & Field Guide
9. Dashboard layout
10. Dashboard data & charts
11. Protections, hidden sheets & triggers

Progress is saved after each stage; a run stops cleanly before the limit and the next run continues. Every stage is safe to repeat. **Lead CRM → Admin → Restart setup from the first stage** forgets the saved progress (data is not touched).

> Re-running `setupWorkbook` after setup has finished is a safe **repair**: it keeps every lead, log entry, master row, setting and custom field, and rebuilds formatting, validation, protections, hidden sheets and the Dashboard.

## 2. Authorisation

The first run shows **"Authorization required"** → *Review permissions* → choose the account → *Advanced → Go to Lead CRM (unsafe)* (normal for a private script) → **Allow**.

Each counsellor is asked once, the first time they use the Lead CRM menu, to allow the script. That is also how the CRM learns who they are (§5).

## 3. Permissions the script uses

| Scope | Why |
|---|---|
| `spreadsheets.currentonly` | Read/write **this** spreadsheet only |
| `script.container.ui` | Menu, sidebar, dialogs |
| `script.scriptapp` | The installable triggers (edit guard, change check, open log, hourly maintenance, every-minute follow-up queue, optional reminders) |
| `script.send_mail` | Optional daily reminder emails (off until an admin enables them) |
| `userinfo.email` | Identify the person making a change |

No passwords or credentials are stored. Person-related data added by the script: account emails in Follow-Up Log "Updated By", the Access Log and Deleted Leads, and an internal temporary-key → email map (Script Properties, §5).

## 4. First configuration (admin)

1. **Lead CRM → Admin → Show admin sheets.**
2. **Stage Master**: replace the rows marked `SAMPLE - replace with your own process` ([ADMIN.md](ADMIN.md#stages-and-substages)).
3. **Counsellor Master**: replace the sample counsellors. Enter each person's **Google account email**.
4. **Lists & Settings**:
   - check the priority, outcome, source and status lists;
   - put every administrator's email in **Admin Emails** (comma separated);
   - set **Lead ID Prefix** and **Mobile Number Pattern / Message** before you add real leads (default: exactly 10 digits);
   - review **Counsellor-Editable Fields** (column AE): the only columns counsellors may change.
5. **Lead CRM → Admin → Reapply protections** so the admin list takes effect.
6. Add leads: paste them in **Lead Entry**, then **Lead CRM → Add leads from Lead Entry**.
7. **Lead CRM → Admin → Hide admin sheets**, then **Run health check** and fix anything marked `CHECK`.
8. **Share the spreadsheet with counsellors as Editors.** Ask each counsellor to open **Lead CRM → My overdue follow-ups** once (this identifies them).

> Counsellors work in the spreadsheet. The [counsellor web app](#7-optional-counsellor-web-app) is an optional extra. Read the trade-off in [CONFIDENTIALITY.md](CONFIDENTIALITY.md): **anyone who can edit a Google Sheet can also copy or download all of it.**

## 5. How users are identified

The owner is a personal Google account and counsellors may use any Google account. Google then **does not give the owner's triggers the editor's email** (`e.user` / `Session.getActiveUser()` are blank). The CRM uses the cases that are reliable:

| Where | Runs as | How the user is identified |
|---|---|---|
| Lead CRM menu, sidebar | The user (they authorised the script) | `Session.getActiveUser()`. At the same time the user's Google **temporary key** → email is stored ("registration"). |
| Edits in the spreadsheet | Simple `onEdit` as the editor + installable `onEditInstallable` as the owner | The simple trigger caches the editor's temporary key for that exact edit; the installable trigger picks it up (waits up to 3 s) and looks up the registered email. |
| Web app | Owner + the separate sign-in app (as the visitor) | Signed, single-use token from the sign-in app ([CONFIDENTIALITY.md](CONFIDENTIALITY.md)). |

Registration happens whenever someone uses the Lead CRM menu. Google rotates the key every 30 days; the next menu use re-registers it.

**Unknown editors are not trusted.** With *Block Edits From Unknown Users* = Yes (default), an edit by someone the CRM cannot identify is **undone** with the message "Lead CRM does not know who you are yet. Click Lead CRM > My overdue follow-ups once, then try again." This is what makes "counsellors may only change their own leads" enforceable. Set it to No only if identification fails in your setup (see TROUBLESHOOTING).

## 6. What setup builds

### Sheets

| Sheet | Visible to counsellors? | Purpose | Who edits |
|---|---|---|---|
| **Start Here** | Yes (first tab) | One screen: what each sheet is for, the daily steps | Admins |
| **Lead Management** | Yes | The daily working sheet, one row per lead (10,000 rows) | Counsellors: white cells of their own leads. Admins: also contact/assignment. Nobody: automatic columns |
| **Dashboard** | Yes | KPIs, reports A–G, 6 charts (calculated by the script) | Filter cells only |
| **Field Guide** | Yes | What every column means (read-only) | Admins |
| Lead Entry | Hidden | The only way to add new leads | Admins |
| Follow-Up Log | Hidden | Append-only history and audit trail | The script |
| Stage Master | Hidden | Stages / substages | Admins |
| Counsellor Master | Hidden | Counsellors, emails, teams | Admins |
| Lists & Settings | Hidden | Lists, settings, custom fields, Counsellor-Editable Fields | Admins |
| Access Log | Hidden | Spreadsheet opens, web-app views/edits, correction windows | The script |
| Deleted Leads | Hidden | Leads removed with Admin > Delete lead(s) | The script |

Hidden sheets are hidden for everybody; admins use **Lead CRM → Admin → Show / Hide admin sheets**. Hiding is a convenience, not security: protected sheets cannot be changed by counsellors, but an editor can unhide and read them (LIMITATIONS.md).

### Lead Management columns

Every column, its type, who updates it, its allowed values and where it is used is in **[COLUMN_DICTIONARY.md](COLUMN_DICTIONARY.md)** (the same text is in the Field Guide sheet).

In short:
- **White (editable):** the Counsellor-Editable Fields list. Default: Lead Stage, Lead Substage, Lead Priority, Next Follow-Up Date, Last Follow-Up Outcome, Lead Remarks, Lead Status and all active custom fields.
- **Grey, admin only:** Lead Name, Mobile Number, Email ID, Assigned Counsellor, Lead Source, Last Contact Date. Strictly protected for counsellors; admins may edit them and every change is audited old → new.
- **Grey, automatic:** Lead ID, Follow-Up Count, Last Updated By, Last Activity Timestamp, Lead Created Date, Last Follow-Up Date, Last Stage Change Date, Lead Assigned Date, Previous Counsellor, Total Activities, Data Quality Flags, Audit Snapshot. **Nobody may change them**, not even the owner (§8).
- Every header has a note: "Editable (your own leads)", "Locked - admin only" or "Auto - do not edit", plus what the column means.
- Unused custom columns and the Audit Snapshot are hidden. There are no columns after AI.

### Colours

| Colour | Meaning |
|---|---|
| White cell | You may change it (your own leads) |
| Grey cell | Automatic or admin only |
| **Red Lead ID + Name** | **Incomplete**: a required field is missing; column AH says which |
| Red / yellow / blue Next Follow-Up Date | Overdue / due today / due soon |
| Green Lead Status | Converted; grey italic = Lost / Duplicate |
| Dark red / orange priority | Critical / Hot |
| Orange mobile / email | Duplicate (per the Duplicate Mobile/Email Check setting) |

## 7. Optional: counsellor web app

The web app lets a counsellor see and update only their own leads without opening the spreadsheet (useful for anyone who should not be able to download the whole sheet). It is optional; the spreadsheet works without it.

**A. Deploy the main web app** (as the owner): **Deploy → New deployment → Web app**, *Execute as: Me*, *Who has access: Anyone with a Google account*. Note the `/exec` URL.

**B. Create the sign-in app:** script.google.com → New project `Lead CRM sign-in` → paste [`identity-app/Identity.gs`](../identity-app/Identity.gs) and [`identity-app/appsscript.json`](../identity-app/appsscript.json).

**C. Connect them:** **Lead CRM → Admin → Web app sign-in setup** shows a secret. In the sign-in project add Script properties `IDENTITY_SECRET` (that secret) and `MAIN_APP_URL` (the main URL). Deploy the sign-in project (*Execute as: User accessing the web app*, *Anyone with a Google account*) and paste its URL into the dialog.

**D. Share** the link from **Lead CRM → Admin → Counsellor web app link**. Access: Active counsellors and Admin Emails only.

The web app uses exactly the same rules as the sheet (same validation, same required fields, own leads only). **After every code change:** Deploy → Manage deployments → ✏ → **New version**.

## 8. How the CRM protects the data

1. **Strict protection.** Lead Management is protected as a whole; only the white columns of rows that hold a lead are open to counsellors. Header row, empty rows, grey columns, row deletion, sorting and column changes are closed to them. Every other sheet is admins-only.
2. **Strict validation.** Every white cell has a rule that **rejects** wrong values: dropdowns for Stage, Substage (only the chosen stage's substages), Priority, Outcome, Status; a calendar date for Next Follow-Up Date (today up to *Max Next Follow-Up Days*); Lead Remarks is the only free-text cell (up to *Max Remarks Length*). Admin columns too: Mobile must match the pattern, Email must be an email, Counsellor and Source from their lists.
3. **The edit guard** (installable trigger, runs as the owner) checks every edit after it happens, because protection never blocks the owner and pasting skips validation. It compares each edited cell with the hidden Audit Snapshot (the last accepted values) and **puts back**:
   - any change to an automatic column, by anyone (message: "This field is filled automatically"; logged). An admin can open **Admin → Allow system-column correction for 10 minutes** for a genuine fix (logged; Lead ID still cannot change);
   - a counsellor's change to an admin-only column, or to a lead assigned to someone else;
   - anything typed in a row without a Lead ID (new leads come only from Lead Entry);
   - invalid values (wrong dates, junk pasted over several columns, a formula, a value not in a list, Converted/Lost without the matching stage, emptying a dropdown or date);
   - every change by an unknown user (§5).
   It works for typing, pasting, clearing, fill-down and undo, re-applies dropdowns that a paste removed, and logs each attempt in Follow-Up Log as **Edit Reverted** (who, what, kept value, attempted value).
4. **Column layout check** (onChange trigger): an empty column inserted into Lead Management is deleted automatically; a moved or deleted column pauses the CRM (edits are not processed) and tells admins to press Undo. **Admin → Re-check all lead rows** then checks every row again.
5. **Required fields.** After a stage or outcome change an open lead needs a **new Next Follow-Up Date**; a stage with substages needs a substage (for Lost: the lost reason). Until then the lead is **Incomplete**: red Lead ID, "Incomplete: …" in column AH, counted per counsellor on the Dashboard, and its sheet updates do not count as worked or as a follow-up.

## 9. The follow-up form

**Lead CRM → Log follow-up** (select the lead row first) opens a small form: **Lead** (pre-selected), **Outcome**, **Stage**, **Substage**, **Next Follow-Up Date**, **Remarks**, **Save**. It refuses to save until everything required is filled, so a lead saved with the form is always complete. It is the recommended way to update a lead.

- Admins' saves are written at once.
- A counsellor's own account may only write white cells, so those are written at once and the rest (Follow-Up Log entry, Last Updated By, dates) is written by the owner's trigger within a minute (or at the next edit). The form says so.
- **Lead CRM → My overdue follow-ups** shows the counsellor's incomplete leads first, then follow-ups due today or overdue; clicking one selects the row and opens the form.

## 10. Dashboard

Unchanged from version 1 except:
- new KPI **Incomplete Leads** and a new **Incomplete Leads** column in the counsellor report (C);
- "Leads Worked" ignores Record Update entries of leads that are still incomplete;
- deleted leads are not in any current-lead count (their history stays in the log);
- counsellors cannot write the Dashboard, so **Lead CRM → Refresh dashboard** from a counsellor is done by the owner's trigger within a minute.

The numbers are calculated by the script and refresh when a yellow filter cell changes, hourly, and on **Refresh dashboard**. KPI and report definitions are in [ADMIN.md](ADMIN.md#dashboard).

## 11. Optional: daily email reminders

Off by default. **Lead CRM → Admin → Enable daily email reminders**: each active counsellor with an email receives one daily list of their **incomplete** leads and their follow-ups **due today or overdue**.

## 12. Updating from version 1

1. Paste every file again (four are new: `Validation`, `LeadEntry`, `DeleteLeads`, `Guide`; `FollowUpSidebar.html` and `Portal.html` changed).
2. Run **`setupWorkbook`** (again if it says it is not finished). It:
   - adds the new sheets (Start Here, Field Guide, Lead Entry, Deleted Leads) and hides the admin sheets;
   - removes extra empty columns to the right of AI;
   - gives a Lead ID to any row that had data but no ID, and builds a full Audit Snapshot for every lead;
   - replaces *Counsellor-Locked Fields* (AD) by **Counsellor-Editable Fields** (AE, default list), adds the new settings and removes *Max Backdate Days*;
   - changes the default **Mobile Number Pattern** only on new installs. On an existing sheet check the pattern and *Mobile Number Message* yourself;
   - turns on strict validation, sheet-level protection and the new triggers (every-minute follow-up queue).
3. Share the spreadsheet with counsellors as Editors (if they used only the web app before) and ask them to open **Lead CRM → My overdue follow-ups** once.
4. If you use the web app, deploy a **New version**.
