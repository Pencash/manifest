## Goal
Build a clear restricted-funds remittance workflow so admins and finance users can see:

- How much restricted giving was collected.
- How much has been remitted to the mother church.
- How much is still pending.
- Which months have carryover.
- What action is needed to bring restricted-fund balance back to zero.

Restricted funds will continue to mean givings whose type contains: Tithe, First Fruit/First Fruits, Seed, or Pledge. These funds remain excluded from activity/expense availability.

## Proposed user experience

### 1. Add a dedicated admin page: “Restricted Remittances”
Add a new financial section page at:

```text
/admin/financial/remittances
```

It will appear in the admin sidebar under Financial, near Payment Verification and Financial Reports.

The page will be organized around monthly remittance status:

```text
Restricted Remittances
-------------------------------------------------
[Current pending] [This month restricted] [Remitted] [Overdue carryover]

Month       Restricted Collected   Remitted   Pending   Status      Action
Jan 2026    MWK 500,000            500,000    0         Cleared     View
Feb 2026    MWK 420,000            300,000    120,000   Partial     Remit
Mar 2026    MWK 380,000            0          380,000   Pending     Remit
```

Each month row will open a detail panel showing:
- Restricted giving breakdown by type: Tithes, First Fruits, Seed, Pledges.
- Total collected that month.
- Total already remitted.
- Balance pending.
- Remittance history for that month.
- Button to record a remittance if balance is pending.

### 2. Record remittance movement
Admins and finance users will be able to record remittance transactions with:

- Remittance date.
- Amount remitted.
- Month/fund period being remitted.
- Payment method: bank transfer, cash deposit, mobile money, other.
- Reference number / transaction code.
- Optional notes.
- Optional attachment support can be added later; for this first version I recommend starting with reference + notes to keep it stable.

The system will validate:
- Amount must be greater than zero.
- Amount cannot exceed pending restricted balance for that month.
- A reference is required for bank/mobile transfers.
- Only admin/finance can create remittance records.
- Pastoral users can view but not record/edit remittances, unless you want pastors to have finance action rights too.

### 3. Status logic
For each calendar month:

```text
restricted_collected = verified restricted givings in that month
remitted_amount      = posted remittances assigned to that month
pending_balance      = restricted_collected - remitted_amount
```

Statuses:

```text
Cleared:   restricted_collected > 0 and pending_balance = 0
Partial:   remitted_amount > 0 and pending_balance > 0
Pending:   restricted_collected > 0 and remitted_amount = 0
Overdue:   pending_balance > 0 and the month is already closed
No funds:  restricted_collected = 0
```

At the beginning of a new month, if previous months still have pending balance, those months will show as overdue carryover until remitted.

This avoids mixing restricted funds with normal expenses. Remittance is treated as a restricted-fund transfer, not an activity expense.

### 4. Dashboard notification and callout
Update the Admin Dashboard “Activity Support Funds Snapshot” area with a restricted-remittance summary:

- Restricted funds pending remittance.
- Oldest month with pending balance.
- “Record remittance” action.
- Clear visual warning if there is overdue carryover.

Example:

```text
Restricted Funds Remittance
Pending: MWK 120,000
Oldest pending month: February 2026
Action needed: remit to mother church
[Open remittance center]
```

When all restricted balances are cleared, show a positive state:

```text
All restricted funds remitted. Current balance: MWK 0
```

### 5. Sidebar notification badge
Extend the existing notification badge system so the Financial sidebar shows a badge for restricted remittances.

Recommended badge count:
- Number of months with pending restricted balance.

For example:

```text
Restricted Remittances  2
```

The badge clears automatically once all pending balances become zero.

### 6. Financial Reports integration
Enhance Financial Reports to include restricted-remittance metrics:

- Restricted collected.
- Restricted remitted.
- Restricted pending.
- Monthly remittance movement.

Also extend Excel export with a “Restricted Remittances” sheet showing monthly collected/remitted/pending values.

## Data model
Add a new table for remittance records.

```text
restricted_fund_remittances
- id
- remittance_month: date          first day of the month being remitted
- amount: numeric
- currency: text default MWK
- remitted_at: timestamp
- payment_method: text
- payment_reference: text nullable
- notes: text nullable
- status: posted/voided
- recorded_by: user id
- voided_by: user id nullable
- voided_at: timestamp nullable
- void_reason: text nullable
- created_at
- updated_at
```

Why this model:
- It preserves an audit trail.
- It supports partial remittances.
- It supports carryover without creating artificial opening balances.
- It allows mistakes to be voided rather than deleted.
- It keeps restricted-fund movement separate from normal expenses.

## Security and permissions
Use Lovable Cloud database policies:

- Admin, Finance, Pastor: can view remittance records and summaries.
- Admin and Finance: can record remittances.
- Admin only: can void remittance records.
- No hard deletes from the app.
- All access remains role-based using the existing `user_roles` system.

## Technical implementation

### Backend/database
1. Create `restricted_fund_remittances` table.
2. Add RLS policies following existing role rules.
3. Add helper database functions or client-side aggregation for:
   - restricted collected by month,
   - remitted by month,
   - pending balance by month.
4. Add indexes for `remittance_month`, `status`, and `recorded_by`.

### Frontend
1. Add shared restricted-funds helpers:
   - detect restricted giving types,
   - group financial data by month,
   - compute collected/remitted/pending/status.
2. Add `RestrictedRemittances.tsx` page.
3. Add route in `App.tsx`.
4. Add sidebar nav item in `navigation.ts`.
5. Update `AppSidebar.tsx` notification counts and realtime refresh.
6. Update `AdminDashboard.tsx` with the remittance alert/card.
7. Update `FinancialReports.tsx` and Excel export.
8. Use existing design patterns: cards, badges, tables, dialogs, semantic colors, deep navy/gold/ivory styling.

## Recommended first version scope
I recommend implementing the full workflow, but keeping attachments out of version one:

Included now:
- monthly dashboard,
- record remittance,
- partial remittances,
- pending/overdue status,
- dashboard callout,
- sidebar badge,
- financial report/export integration,
- void support for admin corrections.

Add later if needed:
- receipt/proof upload for remittance transactions,
- approval step before a remittance becomes posted,
- scheduled email reminders.

## Why this is the best fit
This approach treats restricted funds as a separate accountability ledger instead of forcing them into expenses. It gives admin/finance a clean monthly close process:

```text
Verify givings -> restricted funds accumulate -> remit to mother church -> pending returns to zero
```

It also gives immediate visibility when the expected month-end transfer was missed, while preserving a proper record of every remittance movement.