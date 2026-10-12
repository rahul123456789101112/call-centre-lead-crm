# Acceptance Tests

These step-by-step checks cover every scenario in section 13 of `PROMPT.md`. Run them in a **copy** of the CRM (**File → Make a copy**), or before go-live, then delete the test data (see ADMIN.md → *Resetting IDs before go-live*).

**Preparation**
1. Complete [SETUP.md](SETUP.md) §1–§2. `setupWorkbookQuickTest` (1,000 rows) is enough for these tests.
2. **Run setup as the owner** (a personal Gmail account is fine). Deploy the counsellor web app **and** the sign-in app (SETUP.md §2).
3. You need two more Google accounts with **different email providers**, for example one Gmail and one company or Outlook address that has a Google account:
   - **Counsellor A**: put its email on *Sample Counsellor 1* in Counsellor Master;
   - **Counsellor B**: put its email on *Sample Counsellor 2*.
   Neither may be in *Admin Emails*.
   You also need a third Google account that is in neither list (**Outsider**).
4. Tests 1–14 are run as the admin in the spreadsheet unless stated otherwise. Tests marked **(web app)** are run as a counsellor in the web app.
5. Run **Lead CRM → Identify me** as the admin. It should show your email and "CRM administrator: yes".

Dates below use "today" (T) and "tomorrow" (T+1). Record each result as Pass or Fail.

---

### 1. Add a new lead manually
1. On **Lead Management**, row 2, type `Test Lead One` in **Lead Name (B)** and `9876543210` in **Mobile Number (C)**.

**Expected** (within about 2 seconds):
- A2 = `LD-000001`
- AA2 = today's date and time (fixed; it does not change on reload)
- AB2 = `Open`
- P2 = `New Lead`, Q2 = `Not Contacted` (the default settings)
- W2 = `Sample Counsellor 1`; X2 = current date-time
- Follow-Up Log has a new `Lead Created` row with Activity Category `System`
- AH2 shows flags such as "Unassigned; No next follow-up date"

### 2. Assign a counsellor from the dropdown
1. Click O2 (**Assigned Counsellor**). The dropdown lists only **active** counsellors (Sample Counsellor 3 is inactive and absent).
2. Choose *Sample Counsellor 1*.

**Expected:**
- AE2 = now
- Follow-Up Log has a `Lead Assigned` row (Record Update), Old Value blank, New Value `Sample Counsellor 1`
- Typing a name that is not in the list is rejected

### 3. Select a stage and confirm only its substages appear
1. Set P2 (**Lead Stage**) = `Interested`.
2. Open the Q2 (**Lead Substage**) dropdown.

**Expected:** only `Highly Interested`, `Details Shared` and `Follow-Up Required` are offered. Repeat with `Application` and `Payment`: each shows only its own substages, never the whole list.

### 4. Change the stage and confirm the old substage is cleared or flagged
1. Set Q2 = `Details Shared`.
2. Change P2 to `Payment`.

**Expected:**
- Q2 becomes empty and its dropdown lists **Payment** substages **immediately**: within about a second, before you can click Q2.
- Open the Q2 dropdown straight away: it never shows the previous stage's substages, and picking one never causes a validation error.
- the log has `Stage Updated` (Interested → Payment) and `Substage Cleared` (System, old value Details Shared)
- AD2 = now

Also try typing `Not Eligible` into Q2 while P2 = Payment. It is rejected by validation, or cleared by the script if pasted.

### 5. Record multiple follow-ups against one Lead ID (web app)
1. Make sure LD-000001 is assigned to *Sample Counsellor 1*.
2. As **Counsellor A**, open the web app link, tap LD-000001, then fill in the "Log a follow-up" form.
   An admin can do the same through **Lead CRM → Log Follow-Up…** in the sheet.
3. Fill in: Activity type `Outbound Call`, Outcome `Interested`, Stage `Interested` / `Highly Interested`, Next follow-up T+1, Remarks `Call 1` → **Save**.
4. Save a second one: `WhatsApp`, `Details Shared`, next follow-up T+2, remarks `Call 2`.
5. Save a third one: `Inbound Call`, `Call Back`, next follow-up T+3, remarks `Call 3`.

**Expected:** each save shows "Saved as ACT-…" with a new ID. Pressing Save twice quickly, or re-saving identical content within 2 minutes, is rejected as a duplicate.

### 6. Confirm every follow-up remains in the historical log
1. Filter Follow-Up Log by Lead ID = LD-000001.

**Expected:**
- All three Contact rows are present, in order, with their own remarks, outcomes, stage/substage at that time and next follow-up dates. Nothing was overwritten.
- Earlier audit rows (Created, Assigned, Stage Updated…) are still there.
- The sidebar's "Recent activity" list shows the latest entries.

### 7. Confirm the latest activity timestamp and user are displayed correctly
**Expected** on row 2:
- U (Outcome) = `Call Back`; Y (Remarks) = `Call 3`
- T (Next Follow-Up) = T+3; S (Last Contact) = today; AC = today
- W (Last Updated By) = `Sample Counsellor 1`; X (Last Activity) = time of the third save

Reload the sheet: X and AA do not change (they are stored values, not formulas).

### 8. Confirm follow-up counts and date-range reports are accurate
**Expected:**
- V2 (Follow-Up Count) = 3, counting only Contact activities, not audit rows
- AG2 (Total Activities) = 3 + the Record Update rows
- On the Dashboard with Period = *Today*: Follow-Ups Completed = 3 and Unique Leads Contacted = 1
- Period = *Yesterday*: Follow-Ups Completed = 0

**Optional backdating:** log a follow-up with Activity date & time set to yesterday (within *Max Backdate Days*). Then *Yesterday* shows 1, and the daily trend shows it on yesterday's row.

### 9. Confirm the same lead is counted only once in unique leads worked
**Expected:** with three follow-ups on LD-000001 today:
- Follow-Ups Completed = 3
- **Unique Leads Contacted = 1**
- Counsellor report → Unique Leads Worked = 1 for Sample Counsellor 1, Avg Activities per Lead = 3.0

Add a follow-up on a second lead. Unique Leads Contacted then becomes 2.

### 10. Confirm overdue follow-ups are highlighted
1. Add a second lead (row 3) and type a Next Follow-Up Date of T−2 in T3.

**Expected:**
- A toast warns that the date is in the past
- A3 and T3 turn **red**
- AH3 contains "Overdue follow-up"
- Dashboard *Follow-Ups Overdue* increases, and the lead appears in report E with Days Overdue = 2

Also check:
- set T3 = today → yellow
- set T3 = T+2 → light blue (with the default window of 3 days)
- set AB3 = `Converted` → the whole row turns green and the overdue colours no longer apply
- set AB3 = `Lost` → the row turns grey

### 11. Confirm counsellor-wise reports work correctly
1. Assign lead 3 to *Sample Counsellor 2*.
2. Log one follow-up on lead 3, selecting Counsellor = Sample Counsellor 2 in the form.

**Expected** in Dashboard report C:
- Sample Counsellor 1: Assigned 1, Unique Leads Worked 1, Follow-Ups 3+
- Sample Counsellor 2: Assigned 1, Unique Leads Worked 1, Follow-Ups 1

Set the Counsellor filter to *Sample Counsellor 2*: every KPI and report reduces to that counsellor's numbers.

### 12. Add a new stage and substage and verify dropdowns update
1. As admin, add a row in Stage Master: Lead Stage `Counselling`, Substage `Session Booked`, Stage Order `3.5` (leave ID and status blank).

**Expected:**
- A toast says "substage dropdowns refreshed"
- ID `STG-017` and `Active` are filled in automatically
- the Lead Stage dropdown (P) on Lead Management now includes `Counselling`, between Interested and Application
- Choosing it offers only `Session Booked` in G
- The follow-up form (reopen it) lists the new stage
- Dashboard reports A and B include it

Set its Active Status to `Inactive`. It disappears from new selections. A lead already using it keeps the value, flagged in AH.

### 13. Add a new counsellor and verify the assignment dropdown updates
1. As admin, type `Test Counsellor` in the next empty Counsellor Master row.

**Expected:**
- ID `CNS-004`, `Active` and today's date are filled in
- the Assigned Counsellor dropdown and the follow-up form's counsellor list include them
- the Dashboard counsellor filter includes them

### 14. Custom fields: add, rename, remove; data stays editable
1. Check that columns E–N are hidden after setup. In Lists & Settings → Custom Fields (Z–AB), all 10 slots show Active = `No`.
2. As admin, **Lead CRM → Add custom field…** → type `Course Interested`.
   **Expected:** column **E** appears with header `Course Interested`; slot 1 is Active = `Yes`.
3. Type `MBA` in E2. As a caller, edit it to `MBA Finance`.
   **Expected:** it is editable; W2/X2 update (it counts as a record update); nothing else changes.
4. Add a second field `City`. **Expected:** column F appears.
5. Rename it to `Home City`:
   - by changing *Field Name* in the table → F1 changes;
   - then type `Town` in F1 → the table shows `Town`.
6. Try adding a field called `Lead Source`. **Expected:** rejected as an existing column name.
7. **Lead CRM → Remove custom field…** → enter `1` (Course Interested).
   **Expected:** a warning that column E contains 1 value; answer **No** → nothing changes. Repeat and answer **Yes** → column E is hidden, slot 1 Active = `No`, and E2 still holds `MBA Finance` (right-click the column header → Unhide to check, then hide it again).
8. Add a field `Batch`. **Expected:** it takes the next *empty* free slot (column G), not column E with the old data.
9. Run **Admin → Set up / repair workbook**.
   **Expected:** `Town` (F) and `Batch` (G) are still shown with their names, E is still hidden with its data, and all other leads, formulas and colours are intact.
10. Confirm no columns were inserted or deleted: Assigned Counsellor is still column **O** and Lead Status still **AB**.

### 15. Test multiple users making updates
1. Assign one lead to Counsellor A and one to Counsellor B.
2. Both open the web app and log a follow-up, pressing **Save** at the same moment.
3. Meanwhile, the admin edits the stage of a third lead in the spreadsheet.

**Expected:**
- Both activities are saved with distinct, sequential Activity IDs and no lost or duplicate rows (LockService serialises them)
- Each lead row shows the right W (user) and X (time): *Sample Counsellor 1* / *Sample Counsellor 2*
- The admin's edit shows the admin's email or name in W (identified through the temporary-key hand-off, because the admin has used the Lead CRM menu)

### 16. Confirm dashboard metrics respond to the selected date range
1. Cycle the Reporting Period through Today, Yesterday, Last 7 Days, Last 30 Days, Current Month, Previous Month.
2. Then choose Custom Date Range with From = T−10 and To = T−5.

**Expected:**
- after each change a toast "Updating dashboard..." appears, then *Applied From/To* and *Last Refreshed* update (a few seconds)
- activity-based KPIs, reports A–D and the daily trend chart change accordingly (custom range in the past → 0 activity)
- after logging a new follow-up, the dashboard does not change until a filter changes, the hourly refresh runs, or **Lead CRM → Refresh Dashboard** is used (by design: SETUP.md §9)
- Total Leads, Pending, Overdue and status counts do **not** change (they are defined as current or as-of-today)
- From > To shows the red warning

### 17. Confirm sorting and filtering do not break Lead IDs or formulas
1. Note the IDs and Follow-Up Counts of rows 2–4.
2. As the admin, sort Lead Management by Lead Name Z→A (Data → Sort range, or the filter menu). Counsellors cannot sort because of the locked columns; they use **Data → Create filter view**.
3. Filter by Lead Stage = Interested, then clear the filter.

**Expected:**
- every lead keeps its Lead ID, and the counts move with their lead (formulas are in V1/AG1 and recalculate by ID; AH values move with their row)
- no `#REF!` errors
- after a few seconds the substage dropdowns follow their rows (onChange refresh); if not, run **Lead CRM → Refresh substage dropdowns**
- logging a follow-up for LD-000001 updates the row it now sits on, because the script looks rows up by ID, not row number

---

## 18. Locked fields and editor identity (counsellor editing the spreadsheet during transition)
1. Share the spreadsheet with Counsellor A as **Editor** (only for this test).
   - As Counsellor A, change Lead Remarks on a lead **before** using any menu item. **Expected:** W = *Unidentified user* (not registered yet).
   - Then, as Counsellor A, run **Lead CRM → Identify me** (authorise when asked) and edit Remarks again. **Expected:** W = *Sample Counsellor 1*.
2. As Counsellor A, try to type in Mobile Number (C), Email ID (D), Assigned Counsellor (O), Lead Source (Z), Lead ID (A), Lead Created Date (AA), Follow-Up Count (V) and Data Quality Flags (AH).

**Expected:**
- each edit is refused with Google's standard message ("You are trying to edit a protected cell or object…");
- those columns have **light-grey headers and cells**.

3. As Counsellor A, change Lead Stage, Next Follow-Up Date and Remarks.

**Expected:**
- the edits are allowed;
- W/X update with *Sample Counsellor 1* and the time, even though W/X are locked (the installable trigger writes them as the owner);
- the Follow-Up Log gets the audit rows.

4. As Counsellor A, **Lead CRM → Log Follow-Up**. **Expected:** the sidebar shows an *Open the counsellor web app* button. It opens the sign-in app in a new tab, and saving a follow-up there works.
5. As admin, add `Lead Remarks` to *Counsellor-Locked Fields* (Lists & Settings AD).

**Expected:**
- column Y turns grey within seconds;
- Counsellor A can no longer edit it;
- in the web app Remarks shows as read-only, and the follow-up form still records remarks in the log.

Remove it again afterwards.
6. Stop sharing the spreadsheet with Counsellor A.

## 19. Counsellor web app: sign-in, confidentiality and access log (web app)
1. As Counsellor A, open the **counsellor link** (the sign-in app's URL).

**Expected:**
- the first time, Google asks to allow "See your primary Google Account email address";
- then "Signed in as …" and the web app opens;
- only leads assigned to *Sample Counsellor 1* are listed. Tabs: Due & overdue / All open / All my leads; search works.

2. As Counsellor A, open the counsellor link with `?lead=<ID of a lead assigned to Counsellor B>` added.

**Expected:** "not assigned to you"; the Access Log shows *Access Denied* with that Lead ID.

3. As **Outsider**, open the counsellor link.

**Expected:** "Access denied" naming Outsider's email; logged.

   - Also open the **main** web app URL directly (not the counsellor link) in a private window. **Expected:** "Please sign in", with a *Sign in with Google* link.
   - Copy a `…/exec?t=…` URL from the browser history after signing in and open it again. **Expected:** "Sign-in link expired" (tokens are single-use and valid for 5 minutes).
   - Gmail check: if Counsellor A's Counsellor Master email is `first.last@gmail.com`, signing in as `firstlast@gmail.com` (the same Google account) is accepted.

4. Set Counsellor A to `Inactive` in Counsellor Master, then click anything in A's open web app.

**Expected:** access denied. Set A back to `Active`.

5. As Counsellor A, open a lead. Grey (locked) fields are read-only.
6. Change Priority and a custom field, then **Save changes**.

**Expected:** saved; the Access Log has *Lead Updated* with "field: old → new".

7. Change the stage in the web app.

**Expected:** the substage list empties and shows the new stage's substages; after saving, the substage is blank and Follow-Up Log has *Substage Cleared*.

8. Select text and copy it (Ctrl+C).

**Expected:** an Access Log row *Copy In Browser (reported)* (best-effort, at most one per 30 s).

9. Check the Access Log sheet for: *Portal Opened, Leads Listed* (with IDs), *Lead Viewed, Lead Updated, Follow-Up Logged, Access Denied, Spreadsheet Opened* (when an admin opens the sheet).
10. Add Counsellor B's email to *Admin Emails* (Lists & Settings). B now sees all leads in the web app. Remove it again afterwards.
11. Leave the web app open for more than 6 hours (or clear the site data), then click something. **Expected:** "Your session has expired - Sign in again".

Downloads and copies of the spreadsheet itself **cannot** be logged with a personal Gmail owner (no Drive audit log); see CONFIDENTIALITY.md.

## 20. Speed
1. With at least 1,000 leads (paste test data and run *Process imported / pasted leads*), change Lead Stage on several rows in a row.

**Expected:** each Substage dropdown is correct by the time you click it, and typing in other cells is not delayed.

2. In Apps Script → Executions, the `onEdit` runs for a stage change take well under a second. `onEditInstallable` runs separately (typically 1–3 s).

## Additional checks (sections 8–10)

| Check | Steps | Expected |
|---|---|---|
| Duplicate mobile (warn) | As admin, enter `9876543210` on a new lead | Toast "also used by LD-000001"; AH shows "Duplicate mobile" and both C cells turn orange |
| Duplicate mobile (block) | Set *Duplicate Mobile Check* = Block, repeat | Value cleared, toast "Blocked" |
| Invalid mobile | Enter `12ab` | Warning triangle; AH "Invalid mobile format" (still allowed) |
| Lead ID protection | As a counsellor, type over A2 | Refused (strict protection). As admin: value restored by the script |
| Formula protection | As admin, type in V2 | Entry removed automatically |
| Append-only log | As a counsellor: refused. As admin: edit any log cell | A `Log Edited` System row records old/new |
| Mandatory form fields | Save the form with no outcome / remarks / next date | Clear error list, nothing saved |
| Future last contact date | Type T+1 into S2 | Rejected |
| Import | Paste 200 rows of names/mobiles in B:C | IDs, created dates, defaults, Lead Created entries |
| Reassignment history | Change O2 twice | AF = previous owner; two `Lead Assigned` rows |
| All custom slots used | Add fields until 10 are active, then add one more | Message: all slots in use; nothing changes |
| Custom field via table | Set slot 3 Active = Yes in Lists & Settings | Column G is shown immediately with its Field Name |
| Upgrade from old layout | In a copy of a sheet built by the first version (custom fields Q–Z), run *Set up / repair workbook* | Custom data moves to E–N; used/renamed fields active, others hidden; Assigned Counsellor now in O |
| Health check | Admin → Run health check | All `OK` (or explained `CHECK`) |

## Automated pre-release check (developers)

[`test/`](../test) contains an in-memory mock of the Sheets services and a scenario script. It runs `setupWorkbookQuickTest()`, the stage-change fast path (checked before any logging), editor identity through the temporary-key hand-off (with blank `e.user`, as for personal accounts), the full sign-in flow through the real `identity-app/Identity.gs` (valid, reused, tampered and expired tokens; Gmail address variants; any-provider admins; deactivation), strict locking and the configurable locked list, script-computed data-quality flags and dashboard KPIs, the web app's access control, ownership checks, field locks and Access Log, an old-layout migration, the custom-field add/remove/rename flows, and a staged `setupWorkbook()` (forced to stop after every stage, to prove it resumes), simulates edits, pastes, sorting, sidebar submissions, Stage/Counsellor Master changes and log tampering, and asserts the results. It also checks that every formula the script writes has balanced parentheses, braces and quotes.

```
node test/run-mock-tests.js apps-script
```

It cannot evaluate Google Sheets formulas, render charts or enforce real protections or trigger timing. The manual tests above remain the acceptance criteria.
