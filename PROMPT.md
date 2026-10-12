# Project Prompt: Google Sheets-Based Call Centre Lead Management System

Act as an expert Google Sheets developer, CRM consultant, MIS analyst, and Google Apps Script automation specialist.

I want you to design and build a **professional, blank Google Sheets-based Call Centre Lead Management System (Lead CRM)**. The system will be used by multiple callers/counsellors to manage leads manually, record follow-ups, track the latest user activity, update lead stages, and generate basic MIS reports.

The solution must be easy to use, scalable, visually professional, and suitable for daily operations. Use Google Sheets, formulas, data validation, conditional formatting, pivot tables or QUERY formulas, and Google Apps Script wherever required.

Do not create a complicated CRM. Keep the interface simple for callers and provide a separate backend for administrators.

## 1. Create the Following Sheets

Create these worksheets:

1. **Lead Management** — Main sheet used by callers to work on leads.
2. **Follow-Up Log** — Historical record of every follow-up and activity.
3. **Stage Master** — Backend configuration for lead stages and substages.
4. **Counsellor Master** — List of counsellors and their active/inactive status.
5. **Dashboard** — Management reporting and performance analysis.
6. **Lists & Settings** — Configuration for dropdowns, follow-up outcomes, priorities, and other settings.

Use a professional naming convention and freeze the header rows.

## 2. Lead Management Sheet

This is the primary working sheet. All leads will be added and updated manually.

Create the following columns in this exact order:

| Column | Field Name | Purpose |
|---|---|---|
| A | Lead ID | Unique lead identifier |
| B | Lead Name | Name of the lead/student/customer |
| C | Mobile Number | Contact number |
| D | Email ID | Email address |
| E | Assigned Counsellor | Dropdown from Counsellor Master |
| F | Lead Stage | Dropdown from Stage Master |
| G | Lead Substage | Dependent dropdown based on Lead Stage |
| H | Lead Priority | Hot / Warm / Cold / Critical |
| I | Last Contact Date | Most recent contact date |
| J | Next Follow-Up Date | Next scheduled follow-up |
| K | Last Follow-Up Outcome | Connected / Not Connected / Interested / Not Interested / Call Back / etc. |
| L | Follow-Up Count | Automatically calculated from Follow-Up Log |
| M | Last Updated By | Latest user who updated the lead |
| N | Last Activity Timestamp | Date and time of the latest tracked activity |
| O | Lead Remarks | Latest remarks from the caller |
| P | Lead Source | Dropdown or manually configured source |
| Q | Custom Field 1 | Blank, user-defined field |
| R | Custom Field 2 | Blank, user-defined field |
| S | Custom Field 3 | Blank, user-defined field |
| T | Custom Field 4 | Blank, user-defined field |
| U | Custom Field 5 | Blank, user-defined field |
| V | Custom Field 6 | Blank, user-defined field |
| W | Custom Field 7 | Blank, user-defined field |
| X | Custom Field 8 | Blank, user-defined field |
| Y | Custom Field 9 | Blank, user-defined field |
| Z | Custom Field 10 | Blank, user-defined field |
| AA | Lead Created Date | Automatically recorded |
| AB | Lead Status | Open / On Hold / Converted / Lost / Duplicate |

**Important:** Keep all 10 custom fields blank and editable. Do not assign predefined business meanings to them. Explain how the administrator can rename these headers and continue using the system.

The system must support manual lead entry and must not depend on an external CRM or paid API.

### Lead Management Features

- Generate a unique Lead ID when a new lead is created.
- Prevent accidental duplicate Lead IDs.
- Allow administrators to assign leads manually to counsellors.
- Provide dropdowns for counsellors, stages, substages, priority, outcome, source, and status.
- Highlight overdue follow-ups in red.
- Highlight follow-ups due today in yellow.
- Highlight upcoming follow-ups in a different, subtle colour.
- Highlight converted leads in green and lost leads in grey.
- Highlight critical or high-priority leads appropriately.
- Prevent invalid dates and incorrect dropdown values.
- Keep the header row frozen and enable filters.
- Apply alternating row colours and consistent formatting.
- Protect formula-driven columns from accidental edits.
- Keep the sheet usable for at least 10,000 leads.

## 3. Stage Master: Backend Configuration

Create a separate backend sheet where administrators can add, edit, or deactivate lead stages and substages without modifying the main sheet's formulas.

Use the following columns:

| Column | Field |
|---|---|
| A | Stage ID |
| B | Lead Stage |
| C | Substage |
| D | Stage Description |
| E | Stage Order |
| F | Active Status |
| G | Admin Remarks |

Add a few sample stages and substages to demonstrate the functionality, but make it easy to replace them with our actual process.

Example:

| Lead Stage | Substage |
|---|---|
| New Lead | Not Contacted |
| New Lead | First Attempt Pending |
| Contacted | Connected |
| Contacted | Not Connected |
| Contacted | Call Back Requested |
| Interested | Highly Interested |
| Interested | Details Shared |
| Interested | Follow-Up Required |
| Application | Application Started |
| Application | Application Submitted |
| Application | Documents Pending |
| Payment | Payment Pending |
| Payment | Partial Payment |
| Converted | Successfully Converted |
| Lost | Not Interested |
| Lost | Not Eligible |

These are only sample values. All stages and substages must be configurable.

### Critical Requirement: Dependent Dropdowns

Implement a true dependent dropdown system.

For example:
- If the caller selects `New Lead`, the Substage dropdown should show only substages belonging to `New Lead`.
- If the caller selects `Interested`, only substages mapped to `Interested` should appear.
- If the administrator adds a new stage or substage in Stage Master, the relevant dropdown options should update automatically.
- Inactive stages and substages must not appear in new selections.
- If a caller changes the Lead Stage, validate the existing Substage. If it no longer belongs to that stage, clear it or flag it for correction.
- Do not display every substage for every stage.
- Use Google Apps Script or a reliable dynamic named-range approach if standard data validation is insufficient.

Document the exact implementation method and avoid fragile formulas that break when new stages are added.

## 4. Follow-Up Log

Create a separate historical activity sheet.

Every time a caller records a follow-up, append a new record instead of overwriting the previous record.

Required columns:

1. Activity ID
2. Lead ID
3. Lead Name
4. Counsellor Name
5. Activity Date and Time
6. Activity Type
7. Contact Outcome
8. Lead Stage at Time of Activity
9. Lead Substage at Time of Activity
10. Next Follow-Up Date
11. Remarks
12. Updated By

Include activity types such as:
- Outbound Call
- Inbound Call
- WhatsApp
- Email
- SMS
- Follow-Up Scheduled
- Stage Updated
- Lead Assigned
- Other

Contact outcomes should be configurable through Lists & Settings.

### Follow-Up Workflow

Provide a simple, caller-friendly way to record a follow-up.

When the caller submits an activity:
- Record the Lead ID and counsellor.
- Capture the activity date and time.
- Record the contact outcome and remarks.
- Record the next follow-up date if required.
- Append the activity to Follow-Up Log.
- Update the latest activity details in Lead Management.
- Update the follow-up count.
- Preserve previous activity records.
- Show the latest activity timestamp and user.

Use a Google Apps Script sidebar, simple form, or another reliable workflow that works within Google Sheets.

Do not silently overwrite historical activities.

## 5. Last User Activity Tracking

I need to identify which counsellor last worked on a lead and when.

Implement:
- Last Updated By
- Last Activity Timestamp
- Last Contact Date
- Last Follow-Up Date
- Last Stage Change Date, if practical
- Lead Created Date
- Lead Assigned Date, if practical

Use Apps Script to record the authenticated Google account when available and permitted by Google Workspace settings. If the user's email is unavailable, provide a manual counsellor selection or an administrator-controlled mapping as a fallback.

Do not use `NOW()` as a permanent activity timestamp because it recalculates.

Differentiate between:
1. **Contact activity:** An actual call, message, or email.
2. **Record update:** A change to the lead's details.
3. **System activity:** Automated changes made by the script.

A timestamp must be stored as a fixed value when the relevant event occurs.

Important: A simple Google Sheets edit trigger may not reliably identify the individual editor in every account configuration. Explain any limitations and implement the most reliable practical method.

## 6. Counsellor Master

Create a separate sheet with:

- Counsellor ID
- Counsellor Name
- Email ID
- Team Leader
- Team Name
- Active / Inactive Status
- Date Added

Requirements:
- Counsellor names must come from this sheet.
- Use dropdowns in Lead Management.
- Inactive counsellors should not appear in new assignments.
- Historical reports must retain the original counsellor name for previous activities.
- Enable counsellor-wise lead allocation and workload reporting.

Allow the administrator to add new counsellors without changing formulas.

## 7. Dashboard: Basic MIS Reporting

Build a clean management dashboard with a date-range selector and counsellor filter.

### KPI Cards

Display:
- Total Leads
- Leads Created During Selected Period
- Leads Worked During Selected Period
- Unique Leads Worked
- Follow-Ups Completed
- Follow-Ups Pending
- Follow-Ups Overdue
- Converted Leads
- Lost Leads
- Leads Not Contacted
- Leads With No Activity
- Conversion Rate

Clearly define each KPI. For example, a lead worked during a period means a unique Lead ID with at least one qualifying activity in Follow-Up Log during that period.

Avoid counting multiple follow-ups on the same lead as multiple unique leads worked.

### Date-Range Reporting

Provide From Date and To Date selectors.

Allow reporting by:
- Today
- Yesterday
- Last 7 Days
- Last 30 Days
- Current Month
- Previous Month
- Custom Date Range

The selected date range must control the applicable dashboard metrics and charts.

Use the activity date for productivity reporting and the lead creation date for lead-generation reporting.

### Required Reports

**A. Stage-Wise Report**

Show:
- Lead Stage
- Total Current Leads
- Leads Worked During Selected Period
- Follow-Ups Completed
- Overdue Follow-Ups
- Converted Leads
- Percentage of Total Leads

**B. Substage-Wise Report**

Show:
- Lead Stage
- Lead Substage
- Current Lead Count
- Leads Worked During Selected Period
- Conversion Count, where relevant

Ensure each substage is counted under its correct parent stage.

**C. Counsellor-Wise Performance**

Show:
- Counsellor Name
- Assigned Leads
- Unique Leads Worked
- Follow-Ups Completed
- Pending Follow-Ups
- Overdue Follow-Ups
- Conversions
- Conversion Rate
- Leads Not Contacted
- Average Activities Per Lead

**D. Daily Productivity Trend**

Show:
- Activity Date
- Number of Activities
- Unique Leads Worked
- Follow-Ups Completed
- Conversions, where the conversion event can be reliably recorded

**E. Follow-Up Pending Report**

Display leads whose next follow-up date is today or overdue, including:
- Lead ID
- Lead Name
- Mobile Number
- Counsellor
- Lead Stage
- Lead Substage
- Next Follow-Up Date
- Days Overdue
- Last Activity Timestamp

**F. Lead Ageing Report**

Group open leads into configurable ageing buckets, such as:
- 0–3 Days
- 4–7 Days
- 8–15 Days
- 16–30 Days
- More Than 30 Days

Use Lead Created Date or another clearly defined reference date.

### Dashboard Visuals

Create:
- KPI cards
- Stage-wise bar chart
- Counsellor-wise productivity chart
- Daily activity trend
- Lead distribution chart
- Follow-up ageing chart

Use a consistent, professional colour palette, readable fonts, clear labels, and minimal clutter.

Include a dashboard refresh timestamp.

## 8. Full Data Validation

Apply validation wherever applicable.

Required validations include:

- Unique Lead ID
- Valid date fields
- Counsellor dropdown
- Stage dropdown
- Dependent Substage dropdown
- Priority dropdown
- Follow-up outcome dropdown
- Lead source dropdown
- Lead status dropdown
- Activity type dropdown
- Active/inactive controls in master sheets
- Mandatory fields for follow-up submissions
- Mobile number format checks
- Valid next follow-up dates
- Duplicate mobile/email warning, configurable because multiple leads may legitimately share contact details
- Validation of stage and substage combinations
- Prevention of invalid formula overwrites
- Warnings for overdue leads and missing follow-up dates

Use strict validation where appropriate and warning-based validation where legitimate exceptions may occur.

Do not make the sheet so restrictive that callers cannot handle real-world cases.

## 9. Additional Recommended Features

Implement the following where practical:

1. **Duplicate Lead Detection:** Flag matching mobile numbers or email IDs before adding a new lead.
2. **Unworked Leads Report:** Identify leads that have never had a logged activity.
3. **Unassigned Leads Report:** Identify leads without an assigned counsellor.
4. **Lead Reassignment Tracking:** Preserve the previous owner and record reassignment history.
5. **Stage Movement History:** Maintain a record of stage/substage changes.
6. **Follow-Up Reminders:** Visually highlight due and overdue follow-ups.
7. **Data Quality Checks:** Flag missing contact details, invalid dates, missing stages, and inconsistent assignments.
8. **Admin Controls:** Keep master sheets editable by administrators and restrict configuration changes for callers.
9. **Audit Trail:** Record important changes to stage, substage, owner, status, and follow-up date.
10. **Scalable Configuration:** New stages, substages, counsellors, and custom dropdown values should not require rewriting formulas.

If email reminders are suggested, keep them optional and disabled until an administrator enables them.

## 10. Access and Protection

Design the workbook for multiple callers.

- Callers should work primarily in Lead Management and the follow-up workflow.
- Administrators should manage master sheets and configuration.
- Protect formula-driven columns.
- Protect dashboard formulas and charts.
- Keep the activity log append-only through the standard workflow.
- Explain that Google Sheets protected ranges are safeguards, not a complete security boundary.
- Do not store passwords or sensitive personal data unnecessarily.

Where feasible, use separate Google Sheets permissions or Apps Script authorization for administrator-only functions.

## 11. Technical Implementation

Use:
- Google Sheets
- Google Apps Script
- Google Sheets formulas
- Data validation
- Conditional formatting
- QUERY, FILTER, COUNTIFS, SUMIFS, or equivalent formulas where appropriate
- Charts and pivot tables where useful

Requirements:
- Use scalable formulas that support at least 10,000 leads.
- Avoid volatile formulas for audit timestamps.
- Avoid scripts that rewrite the entire workbook after every edit.
- Use batch operations and efficient range updates.
- Prevent duplicate submissions and accidental duplicate activity records.
- Use locking where concurrent script submissions could create conflicts.
- Keep IDs stable even when rows are sorted.
- Do not rely on row numbers as permanent lead identifiers.
- Make script setup and authorization straightforward.

## 12. Deliverables

Provide the following:

1. A blank Google Sheets template with all six sheets configured.
2. Exact headers and recommended formatting for each sheet.
3. Stage Master with clearly labelled sample data that can be replaced.
4. Counsellor Master with example entries that can be removed.
5. All required dropdowns and dependent stage/substage validation.
6. Apps Script code for activity logging, timestamps, IDs, and dependent dropdowns.
7. Dashboard with working formulas and charts.
8. Clear instructions for installing and authorizing the script.
9. Instructions for renaming the 10 custom fields.
10. Instructions for adding or deactivating stages, substages, and counsellors.
11. Test cases demonstrating the workflow from lead entry through follow-up and dashboard reporting.
12. A troubleshooting guide for common validation, permission, and script errors.

**Do not provide only a conceptual explanation.** If you have access to Google Sheets creation or editing tools, create the actual workbook. Otherwise, provide a ready-to-run Apps Script that builds the workbook automatically when pasted into the Google Apps Script editor.

## 13. Acceptance Testing

Before considering the system complete, test these scenarios:

- Add a new lead manually.
- Assign a counsellor from the dropdown.
- Select a lead stage and confirm that only its corresponding substages appear.
- Change the stage and confirm the old invalid substage is cleared or flagged.
- Record multiple follow-ups against one Lead ID.
- Confirm that every follow-up remains in the historical log.
- Confirm that the latest activity timestamp and user are displayed correctly.
- Confirm that follow-up counts and date-range reports are accurate.
- Confirm that the same lead is counted only once in unique leads worked.
- Confirm that overdue follow-ups are highlighted.
- Confirm that counsellor-wise reports work correctly.
- Add a new stage and substage and verify that dropdowns update.
- Add a new counsellor and verify that the assignment dropdown updates.
- Rename one custom field and confirm that its data remains editable.
- Test multiple users making updates.
- Confirm that dashboard metrics respond to the selected date range.
- Confirm that sorting and filtering do not break Lead IDs or formulas.

Finally, provide a concise setup guide and a list of any limitations that remain.

The final objective is to create a **simple, reliable, blank, manually maintained Call Centre Lead CRM with proper stage/substage control, follow-up history, user activity tracking, and useful management MIS reporting**, without requiring a paid CRM subscription.
