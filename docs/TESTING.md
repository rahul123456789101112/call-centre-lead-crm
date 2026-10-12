# Acceptance Tests

These step-by-step checks cover every scenario in section 13 of `PROMPT.md`. Run them in a **copy** of the CRM (**File → Make a copy**), or before go-live, then delete the test data (see ADMIN.md → *Resetting IDs before go-live*).

**Preparation**
1. Complete [SETUP.md](SETUP.md) §1–§2. `setupWorkbookQuickTest` (1,000 rows) is enough for these tests.
2. In Counsellor Master, set the email of *Sample Counsellor 1* to **your** Google account email.
3. Have a second Google account ready for test 15 (multi-user), and add its email to *Sample Counsellor 2*.
4. Run **Lead CRM → Identify me**. It should say you are recognised as "Sample Counsellor 1".

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
- Q2 becomes empty
- a toast says "Substage "Details Shared" does not belong to "Payment" and was cleared…"
- the Q2 dropdown now lists Payment substages
- the log has `Stage Updated` (Interested → Payment) and `Substage Cleared` (System, old value Details Shared)
- AD2 = now

Also try typing `Not Eligible` into Q2 while P2 = Payment. It is rejected by validation, or cleared by the script if pasted.

### 5. Record multiple follow-ups against one Lead ID
1. Select any cell in row 2 → **Lead CRM → Log Follow-Up…**. The sidebar loads LD-000001 automatically.
2. Fill in: Activity type `Outbound Call`, Outcome `Interested`, Stage `Interested` / `Highly Interested`, Next follow-up T+1, Remarks `Call 1` → **Save**.
3. Save a second one: `WhatsApp`, `Details Shared`, next follow-up T+2, remarks `Call 2`.
4. Save a third one: `Inbound Call`, `Call Back`, next follow-up T+3, remarks `Call 3`.

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
1. Account A has row 2 selected and Account B has row 3. Both open **Log Follow-Up**.
2. Both click **Save** at the same moment.
3. Meanwhile, a third tab edits F4.

**Expected:**
- Both activities are saved with distinct, sequential Activity IDs and no lost or duplicate rows (LockService serialises them)
- Each lead row shows the right W (user) and X (time)
- Account B's rows show *Sample Counsellor 2* (or B's email if B is not in Counsellor Master)
- If B is a gmail.com account, W shows B's name once B has opened the sidebar at least once (temporary-key mapping). Before that it shows "Unidentified user". This is a documented limitation.

### 16. Confirm dashboard metrics respond to the selected date range
1. Cycle the Reporting Period through Today, Yesterday, Last 7 Days, Last 30 Days, Current Month, Previous Month.
2. Then choose Custom Date Range with From = T−10 and To = T−5.

**Expected:**
- *Applied From/To* change each time
- activity-based KPIs, reports A–D and the daily trend chart change accordingly (custom range in the past → 0 activity)
- *Last Refreshed* updates
- Total Leads, Pending, Overdue and status counts do **not** change (they are defined as current or as-of-today)
- From > To shows the red warning

### 17. Confirm sorting and filtering do not break Lead IDs or formulas
1. Note the IDs and Follow-Up Counts of rows 2–4.
2. Sort Lead Management by Lead Name Z→A (Data → Sort range, or the filter menu); accept the protection warning.
3. Filter by Lead Stage = Interested, then clear the filter.

**Expected:**
- every lead keeps its Lead ID, and the counts move with their lead (formulas are in V1/AG1/AH1 and recalculate by ID)
- no `#REF!` errors
- after a few seconds the substage dropdowns follow their rows (onChange refresh); if not, run **Lead CRM → Refresh substage dropdowns**
- logging a follow-up for LD-000001 updates the row it now sits on, because the script looks rows up by ID, not row number

---

## Additional checks (sections 8–10)

| Check | Steps | Expected |
|---|---|---|
| Duplicate mobile (warn) | Enter `9876543210` on a new lead | Toast "also used by LD-000001"; both C cells orange |
| Duplicate mobile (block) | Set *Duplicate Mobile Check* = Block, repeat | Value cleared, toast "Blocked" |
| Invalid mobile | Enter `12ab` | Warning triangle; AH "Invalid mobile format" (still allowed) |
| Lead ID protection | Type over A2 | Warning dialog; value restored |
| Formula protection | Type in V2 | Entry removed automatically |
| Append-only log | Edit any log cell | Warning; a `Log Edited` System row records old/new |
| Mandatory form fields | Save the form with no outcome / remarks / next date | Clear error list, nothing saved |
| Future last contact date | Type T+1 into S2 | Rejected |
| Import | Paste 200 rows of names/mobiles in B:C | IDs, created dates, defaults, Lead Created entries |
| Reassignment history | Change O2 twice | AF = previous owner; two `Lead Assigned` rows |
| All custom slots used | Add fields until 10 are active, then add one more | Message: all slots in use; nothing changes |
| Custom field via table | Set slot 3 Active = Yes in Lists & Settings | Column G is shown immediately with its Field Name |
| Upgrade from old layout | In a copy of a sheet built by the first version (custom fields Q–Z), run *Set up / repair workbook* | Custom data moves to E–N; used/renamed fields active, others hidden; Assigned Counsellor now in O |
| Health check | Admin → Run health check | All `OK` (or explained `CHECK`) |

## Automated pre-release check (developers)

[`test/`](../test) contains an in-memory mock of the Sheets services and a scenario script. It runs `setupWorkbookQuickTest()`, an old-layout migration, the custom-field add/remove/rename flows, and a staged `setupWorkbook()` (forced to stop after every stage, to prove it resumes), simulates edits, pastes, sorting, sidebar submissions, Stage/Counsellor Master changes and log tampering, and asserts the results. It also checks that every formula the script writes has balanced parentheses, braces and quotes.

```
node test/run-mock-tests.js apps-script
```

It cannot evaluate Google Sheets formulas, render charts or enforce real protections or trigger timing. The manual tests above remain the acceptance criteria.
