# Column Dictionary and Daily Use

Every column of **Lead Management** and **Lead Entry**, exactly as the code treats it. The same text is in the read-only **Field Guide** sheet (it is generated from `FIELD_DICTIONARY` in `apps-script/Guide.gs`; run `node tools/build-column-dictionary.js` to regenerate the tables below).

"Locked for counsellors" shows the **default** Counsellor-Editable Fields list (Lists & Settings, column AE). "Reject" means the value is refused or put back automatically, never just flagged.

**Types:** Manual = typed by a person · Dropdown = chosen from a list · Script-filled = written by the CRM · Formula = calculated by a header formula · Hidden system = internal.

## Lead Management

### Summary

| Col | Field | Type | Counsellors can edit? | Admins can edit? |
|---|---|---|---|---|
| A | Lead ID | Script-filled | No | No (any change is undone) |
| B | Lead Name | Manual | No | Yes (audited old/new) |
| C | Mobile Number | Manual | No | Yes (audited old/new) |
| D | Email ID | Manual | No | Yes (audited old/new) |
| E-N | Custom Field 1-10 | Manual, or Dropdown when Allowed Values are set | Yes (own leads) | Yes |
| O | Assigned Counsellor | Dropdown | No | Yes (audited, Lead Assigned entry) |
| P | Lead Stage | Dropdown | Yes (own leads) | Yes |
| Q | Lead Substage | Dropdown (depends on Lead Stage) | Yes (own leads) | Yes |
| R | Lead Priority | Dropdown | Yes (own leads) | Yes |
| S | Last Contact Date | Script-filled | No | Yes |
| T | Next Follow-Up Date | Date (calendar: double-click the cell) | Yes (own leads) | Yes |
| U | Last Follow-Up Outcome | Dropdown | Yes (own leads) | Yes |
| V | Follow-Up Count | Formula | No | No (any entry is removed) |
| W | Last Updated By | Script-filled | No | No (only in a correction window) |
| X | Last Activity Timestamp | Script-filled | No | No (only in a correction window) |
| Y | Lead Remarks | Manual | Yes (own leads) | Yes |
| Z | Lead Source | Dropdown | No | Yes (audited old/new) |
| AA | Lead Created Date | Script-filled | No | No (only in a correction window) |
| AB | Lead Status | Dropdown | Yes (own leads) | Yes |
| AC | Last Follow-Up Date | Script-filled | No | No (only in a correction window) |
| AD | Last Stage Change Date | Script-filled | No | No (only in a correction window) |
| AE | Lead Assigned Date | Script-filled | No | No (only in a correction window) |
| AF | Previous Counsellor | Script-filled | No | No (only in a correction window) |
| AG | Total Activities | Formula | No | No (any entry is removed) |
| AH | Data Quality Flags | Script-filled | No | No |
| AI | Audit Snapshot (system) | Hidden system | No | No |

### A - Lead ID

| | |
|---|---|
| **Definition** | Unique, permanent number of the lead. |
| **Type** | Script-filled |
| **Updated by** | Script |
| **When it is updated** | Once, when the lead is created from Lead Entry. |
| **Value comes from** | Lists & Settings: Lead ID Prefix + Lead ID Digits |
| **Allowed values / format (example)** | LD-000123 |
| **Locked for counsellors?** | Yes |
| **Admins can edit?** | No (any change is undone) |
| **Validation** | Reject: any change is undone and logged |
| **Used in the Dashboard** | Every lead count; links the lead to Follow-Up Log |

### B - Lead Name

| | |
|---|---|
| **Definition** | Name of the person. |
| **Type** | Manual |
| **Updated by** | Admin |
| **When it is updated** | When the lead is added; an admin may correct it. |
| **Value comes from** | Lead Entry |
| **Allowed values / format (example)** | Text, required, up to 100 characters (Ravi Kumar) |
| **Locked for counsellors?** | Yes |
| **Admins can edit?** | Yes (audited old/new) |
| **Validation** | Reject: empty or too long |
| **Used in the Dashboard** | Lists in reports E and G |

### C - Mobile Number

| | |
|---|---|
| **Definition** | Main phone number. |
| **Type** | Manual |
| **Updated by** | Admin |
| **When it is updated** | When the lead is added; an admin may correct it. |
| **Value comes from** | Lead Entry |
| **Allowed values / format (example)** | Numbers only, must match Mobile Number Pattern (default 10 digits: 9876543210). Spaces and dashes are removed. |
| **Locked for counsellors?** | Yes |
| **Admins can edit?** | Yes (audited old/new) |
| **Validation** | Reject: empty, letters, wrong length; duplicates refused if Duplicate Mobile Check = Block |
| **Used in the Dashboard** | Reports E and G; duplicate flag |

### D - Email ID

| | |
|---|---|
| **Definition** | Email address. |
| **Type** | Manual |
| **Updated by** | Admin |
| **When it is updated** | When the lead is added; an admin may correct it. |
| **Value comes from** | Lead Entry |
| **Allowed values / format (example)** | Optional, a valid email (ravi@example.com) |
| **Locked for counsellors?** | Yes |
| **Admins can edit?** | Yes (audited old/new) |
| **Validation** | Reject: not an email; duplicates refused if Duplicate Email Check = Block |
| **Used in the Dashboard** | Duplicate flag only |

### E-N - Custom Field 1-10

| | |
|---|---|
| **Definition** | Optional extra field (for example "Course Interested"). Only active fields are shown. |
| **Type** | Manual, or Dropdown when Allowed Values are set |
| **Updated by** | Counsellor (own leads) or Admin |
| **When it is updated** | Any time. |
| **Value comes from** | Lists & Settings: Custom Fields table (name, Active, Allowed Values) |
| **Allowed values / format (example)** | A value from Allowed Values, or text up to 100 characters (MBA) |
| **Locked for counsellors?** | No, while active and "All Custom Fields" is in Counsellor-Editable Fields |
| **Admins can edit?** | Yes |
| **Validation** | Reject: not in Allowed Values or too long |
| **Used in the Dashboard** | Not used |

### O - Assigned Counsellor

| | |
|---|---|
| **Definition** | Counsellor responsible for the lead. |
| **Type** | Dropdown |
| **Updated by** | Admin |
| **When it is updated** | When the lead is added, or when an admin reassigns it. |
| **Value comes from** | Counsellor Master (Active counsellors) |
| **Allowed values / format (example)** | An active counsellor name (Priya Sharma), or empty = unassigned |
| **Locked for counsellors?** | Yes |
| **Admins can edit?** | Yes (audited, Lead Assigned entry) |
| **Validation** | Reject: not an active counsellor |
| **Used in the Dashboard** | Counsellor filter, report C, report E, unassigned list (G), reminders |

### P - Lead Stage

| | |
|---|---|
| **Definition** | Where the lead is in the sales process. |
| **Type** | Dropdown |
| **Updated by** | Counsellor (own leads) or Admin |
| **When it is updated** | With the follow-up form, or in the sheet. |
| **Value comes from** | Stage Master (Active stages). New leads get Default Lead Stage. |
| **Allowed values / format (example)** | An active stage (Interested) |
| **Locked for counsellors?** | No |
| **Admins can edit?** | Yes |
| **Validation** | Reject: not in the list, or emptied. A change needs a new Next Follow-Up Date |
| **Used in the Dashboard** | Report A (stage-wise), chart |

### Q - Lead Substage

| | |
|---|---|
| **Definition** | Detail of the stage (for Lost: the lost reason). |
| **Type** | Dropdown (depends on Lead Stage) |
| **Updated by** | Counsellor (own leads) or Admin |
| **When it is updated** | With the follow-up form or in the sheet; emptied automatically when the stage changes. |
| **Value comes from** | Stage Master (substages of the chosen stage) |
| **Allowed values / format (example)** | A substage of the current stage (Highly Interested) |
| **Locked for counsellors?** | No |
| **Admins can edit?** | Yes |
| **Validation** | Reject: not a substage of the current stage. Required when the stage has substages (else Incomplete) |
| **Used in the Dashboard** | Report B (substage-wise) |

### R - Lead Priority

| | |
|---|---|
| **Definition** | How urgent the lead is. |
| **Type** | Dropdown |
| **Updated by** | Counsellor (own leads) or Admin |
| **When it is updated** | Any time. |
| **Value comes from** | Lists & Settings: Lead Priority |
| **Allowed values / format (example)** | Critical, Hot, Warm, Cold |
| **Locked for counsellors?** | No |
| **Admins can edit?** | Yes |
| **Validation** | Reject: not in the list, or emptied |
| **Used in the Dashboard** | Not used (colour only) |

### S - Last Contact Date

| | |
|---|---|
| **Definition** | Date of the latest real contact (call, message, meeting). |
| **Type** | Script-filled |
| **Updated by** | Script (admin may correct) |
| **When it is updated** | When a follow-up is saved with the form, or when an outcome changed in the sheet is counted. |
| **Value comes from** | Follow-up form / Follow-Up Log |
| **Allowed values / format (example)** | A date, not in the future (12-Oct-2026) |
| **Locked for counsellors?** | Yes |
| **Admins can edit?** | Yes |
| **Validation** | Reject: not a date, or in the future |
| **Used in the Dashboard** | Not used |

### T - Next Follow-Up Date

| | |
|---|---|
| **Definition** | When the lead must be contacted next. |
| **Type** | Date (calendar: double-click the cell) |
| **Updated by** | Counsellor (own leads) or Admin |
| **When it is updated** | With the follow-up form or in the sheet. |
| **Value comes from** | Follow-up form or the sheet |
| **Allowed values / format (example)** | From today up to Max Next Follow-Up Days ahead (default 365) for open leads (20-Oct-2026) |
| **Locked for counsellors?** | No |
| **Admins can edit?** | Yes |
| **Validation** | Reject: not a date, in the past, too far ahead, or emptied on an open lead. Required after a stage or outcome change |
| **Used in the Dashboard** | Follow-Ups Pending / Overdue, report E, follow-up ageing (F), reminders |

### U - Last Follow-Up Outcome

| | |
|---|---|
| **Definition** | Result of the latest contact. |
| **Type** | Dropdown |
| **Updated by** | Counsellor (own leads) or Admin |
| **When it is updated** | With the follow-up form or in the sheet. |
| **Value comes from** | Lists & Settings: Contact Outcome |
| **Allowed values / format (example)** | Connected, Not Connected, Interested, ... (Call Back) |
| **Locked for counsellors?** | No |
| **Admins can edit?** | Yes |
| **Validation** | Reject: not in the list, or emptied. A change needs a new Next Follow-Up Date |
| **Used in the Dashboard** | A change counts as a follow-up (Follow-Ups Completed) once the lead is complete |

### V - Follow-Up Count

| | |
|---|---|
| **Definition** | Number of follow-ups (Contact entries) in Follow-Up Log for this lead. |
| **Type** | Formula |
| **Updated by** | Formula |
| **When it is updated** | Recalculates automatically. |
| **Value comes from** | Follow-Up Log |
| **Allowed values / format (example)** | Whole number (3) |
| **Locked for counsellors?** | Yes |
| **Admins can edit?** | No (any entry is removed) |
| **Validation** | Reject: typed values are removed |
| **Used in the Dashboard** | Not used (the dashboard counts the log itself) |

### W - Last Updated By

| | |
|---|---|
| **Definition** | Who made the latest change (counsellor name, or email). |
| **Type** | Script-filled |
| **Updated by** | Script |
| **When it is updated** | After every accepted change. |
| **Value comes from** | Counsellor Master (name for the signed-in email) |
| **Allowed values / format (example)** | Priya Sharma |
| **Locked for counsellors?** | Yes |
| **Admins can edit?** | No (only in a correction window) |
| **Validation** | Reject: any change is undone and logged |
| **Used in the Dashboard** | Not used |

### X - Last Activity Timestamp

| | |
|---|---|
| **Definition** | Date and time of the latest change or follow-up. |
| **Type** | Script-filled |
| **Updated by** | Script |
| **When it is updated** | After every accepted change or follow-up. |
| **Value comes from** | The CRM clock |
| **Allowed values / format (example)** | 12-Oct-2026 14:05 |
| **Locked for counsellors?** | Yes |
| **Admins can edit?** | No (only in a correction window) |
| **Validation** | Reject: any change is undone and logged |
| **Used in the Dashboard** | Report E |

### Y - Lead Remarks

| | |
|---|---|
| **Definition** | Short note about the latest contact. The only free-text cell for counsellors. |
| **Type** | Manual |
| **Updated by** | Counsellor (own leads) or Admin |
| **When it is updated** | With the follow-up form or in the sheet. |
| **Value comes from** | Follow-up form or the sheet |
| **Allowed values / format (example)** | Text up to Max Remarks Length (default 500 characters) |
| **Locked for counsellors?** | No |
| **Admins can edit?** | Yes |
| **Validation** | Reject: too long, or a formula |
| **Used in the Dashboard** | Not used |

### Z - Lead Source

| | |
|---|---|
| **Definition** | Where the lead came from. |
| **Type** | Dropdown |
| **Updated by** | Admin |
| **When it is updated** | When the lead is added; an admin may correct it. |
| **Value comes from** | Lists & Settings: Lead Source |
| **Allowed values / format (example)** | Website, Walk-In, Referral, ... |
| **Locked for counsellors?** | Yes |
| **Admins can edit?** | Yes (audited old/new) |
| **Validation** | Reject: not in the list, or emptied |
| **Used in the Dashboard** | Lead Source table (report F area) |

### AA - Lead Created Date

| | |
|---|---|
| **Definition** | When the lead was added. |
| **Type** | Script-filled |
| **Updated by** | Script |
| **When it is updated** | Once, when the lead is created. |
| **Value comes from** | The CRM clock |
| **Allowed values / format (example)** | 12-Oct-2026 09:30 |
| **Locked for counsellors?** | Yes |
| **Admins can edit?** | No (only in a correction window) |
| **Validation** | Reject: any change is undone and logged |
| **Used in the Dashboard** | Leads Created (Period), lead ageing (F), lists in G |

### AB - Lead Status

| | |
|---|---|
| **Definition** | Overall state: Open, On Hold, Converted, Lost, Duplicate. |
| **Type** | Dropdown |
| **Updated by** | Counsellor (own leads) or Admin; set automatically from the stage |
| **When it is updated** | In the sheet; automatically when the stage becomes the Converted / Lost Stage (or leaves it). |
| **Value comes from** | Lists & Settings: Lead Status |
| **Allowed values / format (example)** | Open, On Hold, Converted, Lost, Duplicate |
| **Locked for counsellors?** | No |
| **Admins can edit?** | Yes |
| **Validation** | Reject: not in the list, emptied, or Converted / Lost without the matching stage |
| **Used in the Dashboard** | Converted / Lost KPIs, conversion rate, open-lead counts, status chart |

### AC - Last Follow-Up Date

| | |
|---|---|
| **Definition** | Date of the latest follow-up (any activity type). |
| **Type** | Script-filled |
| **Updated by** | Script |
| **When it is updated** | When a follow-up is saved, or an outcome changed in the sheet is counted. |
| **Value comes from** | Follow-up form / Follow-Up Log |
| **Allowed values / format (example)** | 12-Oct-2026 |
| **Locked for counsellors?** | Yes |
| **Admins can edit?** | No (only in a correction window) |
| **Validation** | Reject: any change is undone and logged |
| **Used in the Dashboard** | Not used |

### AD - Last Stage Change Date

| | |
|---|---|
| **Definition** | When the stage or substage last changed. |
| **Type** | Script-filled |
| **Updated by** | Script |
| **When it is updated** | On every stage or substage change. |
| **Value comes from** | The CRM clock |
| **Allowed values / format (example)** | 12-Oct-2026 14:05 |
| **Locked for counsellors?** | Yes |
| **Admins can edit?** | No (only in a correction window) |
| **Validation** | Reject: any change is undone and logged |
| **Used in the Dashboard** | Not used |

### AE - Lead Assigned Date

| | |
|---|---|
| **Definition** | When the lead was last (re)assigned. |
| **Type** | Script-filled |
| **Updated by** | Script |
| **When it is updated** | When Assigned Counsellor changes (or on creation with a counsellor). |
| **Value comes from** | The CRM clock |
| **Allowed values / format (example)** | 12-Oct-2026 09:30 |
| **Locked for counsellors?** | Yes |
| **Admins can edit?** | No (only in a correction window) |
| **Validation** | Reject: any change is undone and logged |
| **Used in the Dashboard** | Not used |

### AF - Previous Counsellor

| | |
|---|---|
| **Definition** | Counsellor before the latest reassignment. |
| **Type** | Script-filled |
| **Updated by** | Script |
| **When it is updated** | When the lead is reassigned. |
| **Value comes from** | Assigned Counsellor before the change |
| **Allowed values / format (example)** | Amit Verma |
| **Locked for counsellors?** | Yes |
| **Admins can edit?** | No (only in a correction window) |
| **Validation** | Reject: any change is undone and logged |
| **Used in the Dashboard** | Not used |

### AG - Total Activities

| | |
|---|---|
| **Definition** | Number of follow-ups and record updates in Follow-Up Log (automatic System entries not counted). |
| **Type** | Formula |
| **Updated by** | Formula |
| **When it is updated** | Recalculates automatically. |
| **Value comes from** | Follow-Up Log |
| **Allowed values / format (example)** | Whole number (7) |
| **Locked for counsellors?** | Yes |
| **Admins can edit?** | No (any entry is removed) |
| **Validation** | Reject: typed values are removed |
| **Used in the Dashboard** | Not used (the dashboard counts the log itself) |

### AH - Data Quality Flags

| | |
|---|---|
| **Definition** | Problems with the lead. Starts with "Incomplete: ..." when a required field is missing (the Lead ID turns red). |
| **Type** | Script-filled |
| **Updated by** | Script |
| **When it is updated** | After every change; all rows hourly. |
| **Value comes from** | Calculated from the row and Lists & Settings rules |
| **Allowed values / format (example)** | Incomplete: Next Follow-Up Date; Duplicate mobile |
| **Locked for counsellors?** | Yes |
| **Admins can edit?** | No |
| **Validation** | Recalculated after any change |
| **Used in the Dashboard** | Incomplete Leads KPI and counsellor column, exceptions summary (G) |

### AI - Audit Snapshot (system)

| | |
|---|---|
| **Definition** | Hidden copy of the last accepted values, used to undo wrong changes and to write the audit trail. |
| **Type** | Hidden system |
| **Updated by** | Script |
| **When it is updated** | After every accepted change. |
| **Value comes from** | The CRM |
| **Allowed values / format (example)** | Hidden |
| **Locked for counsellors?** | Yes |
| **Admins can edit?** | No |
| **Validation** | Never edit or paste here |
| **Used in the Dashboard** | Not used |

### Lead Entry sheet (admins only)

| Col | Field | Definition | Type | Format (example) |
|---|---|---|---|---|
| A | Lead Name | Name of the new lead. Required. | Manual | Text up to 100 characters |
| B | Mobile Number | Required. Numbers only; must match Mobile Number Pattern. | Manual | 9876543210 |
| C | Email ID | Optional. Must be a valid email. | Manual | ravi@example.com |
| D-M | Custom Field 1-10 | Same names and visibility as the Custom Fields table. Optional. | Manual / Dropdown | Allowed Values, or text up to 100 characters |
| N | Assigned Counsellor | Optional. Empty = unassigned. | Dropdown | Active counsellor |
| O | Lead Source | Optional. | Dropdown | Lists & Settings: Lead Source |
| P | Lead Priority | Optional. | Dropdown | Lists & Settings: Lead Priority |
| Q | Remarks | Optional. Copied to Lead Remarks. | Manual | Up to Max Remarks Length |
| R | Result | Created or Error. Filled by the CRM. | Script-filled | Created / Error |
| S | Message | Why the row was refused, or which lead was created. Filled by the CRM. | Script-filled | Mobile number must be 10 digits. |
| T | Lead ID | The new Lead ID. Filled by the CRM. | Script-filled | LD-000124 |

---

## How to use the CRM day to day

### Counsellor routine (every day)

1. **Lead CRM → My overdue follow-ups.** The panel lists your leads that are **incomplete** (red label "Missing: …") first, then follow-ups **due today or overdue**.
2. Click a lead: its row is selected and the follow-up form opens.
3. Call the lead. Then fill the form: **Outcome**, **Stage**, **Substage**, **Next Follow-Up Date**, **Remarks**, and press **Save**. The form does not save until everything needed is filled.
4. Repeat until the list is empty. A red Lead ID in Lead Management means something is missing; column AH says what.

You may also change the white cells of your own leads directly in Lead Management. If you change the outcome or stage there, also choose a new Next Follow-Up Date, or the lead turns red (Incomplete) and does not count as followed up until you do.

### Admin routine (every day)

1. Add new leads in **Lead Entry** and run **Lead CRM → Add leads from Lead Entry**. Fix any red rows (the message says why) and run it again.
2. Assign unassigned leads: Lead Management column O (Dashboard report G lists them).
3. Check the **Dashboard**: *Follow-Ups Overdue*, *Incomplete Leads* and the *Incomplete Leads* column per counsellor; talk to whoever skips data.
4. Weekly: **Admin → Run health check**.

### Adding leads

Only admins, only through Lead Entry (ADMIN.md → *Adding leads*). Required: Lead Name, Mobile Number (numbers only, must match the Mobile Number Pattern). New leads get Lead ID, Lead Created Date, the default stage/substage/status and a *Lead Created* log entry.

### Assigning

Admins choose Assigned Counsellor (column O) in Lead Entry or Lead Management. Every change is logged (*Lead Assigned*), with Lead Assigned Date and Previous Counsellor.

### Following up

Use the follow-up form (Lead CRM → Log follow-up, or from My overdue follow-ups). Each save writes one Contact entry to Follow-Up Log (Activity Type from *Follow-Up Form Activity Type*), updates Outcome, Stage, Substage, Next Follow-Up Date, Remarks, Last Contact Date, Last Follow-Up Date, Last Updated By and Last Activity Timestamp. For counsellors, the log entry and automatic columns appear within a minute.

### Closing a lead: Converted, Lost, Duplicate

- **Converted:** choose the stage named in *Converted Stage* (default "Converted") and its substage. Lead Status becomes Converted automatically; no next follow-up date is needed. Status "Converted" cannot be chosen while the stage is different.
- **Lost:** choose the *Lost Stage* (default "Lost") and the lost reason as substage (required). Status becomes Lost.
- **Duplicate:** set Lead Status to Duplicate (in the sheet). No next follow-up date is needed for a closed lead.
- Moving a Converted or Lost lead to another stage sets its status back to the default (Open).

### Deleting and restoring (admins)

Admin → Delete lead(s) (reason required) moves leads to the hidden Deleted Leads sheet; Restore deleted lead brings one back with the same Lead ID; Purge deleted lead permanently removes it for good after two confirmations. All three are logged. Counsellors cannot delete.

### Using the dashboard

Choose the **Reporting Period** and **Counsellor** in the yellow cells; the numbers refresh within seconds. Activity numbers use Follow-Up Log dates; lead numbers are as of today. **Last Refreshed** shows the age; it refreshes hourly anyway. Definitions: ADMIN.md → *Dashboard*.
