I found the core issue: the payment ledger exists and the MWK 400,000 payment was recorded, but the database currently has no active trigger/function installed to synchronize `expense_requests.status` from the `expense_payments` ledger. For the shown request `EXP-2026-013`, the database has:

```text
expense_requests.status = approved
posted expense_payments total = MWK 400,000
expense_requests.amount = MWK 400,000
```

So the detail page can calculate “paid” locally from the ledger, but other pages still read the stale request status (`approved`). That is why the register/reports still show it as approved, and why the page still allows another payment attempt.

## Plan to fix the expense management process

### 1. Make the database the source of truth for expense payment state
Create a migration that installs a robust payment-state synchronization layer:

- Add/repair a database function that recalculates an expense request from its posted payment ledger:
  - `0 paid` → `approved`
  - `0 < paid < requested amount` → `partially_paid`
  - `paid >= requested amount` → `paid`
- Update these request fields atomically whenever payments change:
  - `status`
  - `paid_at`
  - `paid_by`
  - `payment_method`
  - `payment_reference`
  - `updated_at`
- Add an `AFTER INSERT OR UPDATE OR DELETE` trigger on `expense_payments` so payment inserts, voids, edits, and deletes immediately refresh the parent expense request.
- Backfill existing requests so `EXP-2026-013` and any other stale expense requests are corrected immediately.

### 2. Prevent overpayment and invalid payment recording at the database level
The current UI checks remaining balance, but the database does not fully enforce it. I will add trigger validation so no UI bug or double-click can create inconsistent payment data.

Rules to enforce:

- Payments can only be posted against requests in payable statuses: `approved` or `partially_paid`.
- A posted payment cannot cause total posted payments to exceed the requested amount.
- Payments cannot be added to `paid`, `rejected`, `cancelled`, `draft`, or `changes_requested` requests.
- Voiding a payment recalculates the request back to `partially_paid` or `approved` when appropriate.
- Keep payment voids as audit-friendly updates instead of deleting history where possible.

### 3. Replace direct payment insert/update operations with safe RPC functions
For stronger transactional integrity, add database functions for payment actions and call them from the app:

- `record_expense_payment(...)`
  - validates permission
  - checks payable status
  - checks remaining balance
  - inserts the payment
  - refreshes parent status in the same transaction
- `void_expense_payment(...)`
  - validates permission
  - marks payment as voided with reason
  - refreshes parent status in the same transaction

Then update `useExpenseRequestDetail.ts` to use these functions instead of directly inserting/updating `expense_payments`.

### 4. Fix the UI so paid requests cannot open payment recording
Update the detail page and hook so the UI uses the final backend-synchronized status and ledger-derived remaining balance consistently:

- Hide or disable “Record payment” when remaining balance is 0.
- Hide or disable “Record payment” when derived status is `paid`, even before a refresh completes.
- In the payment dialog, do not default the amount to the full expense amount when remaining balance is 0.
- Show a clear paid/completed message instead of offering another payment.
- After payment recording or voiding, invalidate/refetch relevant data so list pages, dashboards, badges, and reports update.

### 5. Update affected pages to use consistent status and financial movement rules
Review and adjust these pages/hooks so they do not disagree about expense state:

- `AdminExpenseRequests.tsx`
  - should display the stored synchronized status.
  - add paid/partially paid filters that now work reliably.
- `AdminExpenseRequestDetails.tsx`
  - use the corrected `canRecordPayment` logic.
- `PendingExpenseApprovals.tsx`
  - approval should transition only pending requests.
  - avoid non-atomic “update request then insert approval” drift where possible.
- `FinancialReports.tsx`
  - distinguish between committed/approved expenses and actual cash paid.
  - use payment ledger totals for disbursements instead of assuming the full approved amount is already paid.
- `useFundingAvailability.ts`
  - clarify whether funds are reserved at approval or consumed at payment.
  - keep current “allocated” behavior if desired, but make paid/disbursed calculations ledger-based.
- Dashboard widgets using expense totals/status.

### 6. Add archive support for old expense transactions
Rather than moving records into a separate table immediately, use a safe soft-archive pattern first. This preserves links to approvals, payments, receipts, budgets, and reports.

Database additions:

- Add archive fields to `expense_requests`:
  - `is_archived boolean default false`
  - `archived_at timestamptz`
  - `archived_by uuid`
  - `archive_reason text`
- Add indexes for active vs archived filtering.
- Add an admin/finance-only function to archive eligible requests.

Archive eligibility:

- Only final-state requests should be archivable by default:
  - `paid`
  - `rejected`
  - `cancelled`
- Optionally auto-archive paid/rejected/cancelled requests older than a chosen period, such as 90 days.

UI changes:

- Add an “Archived” filter/tab in All Expenses.
- Default All Expenses to active records only.
- Provide “Archive” and “Restore” actions for permitted users.
- Allow reports to include/exclude archived records as needed.

### 7. Add auditability and consistency checks
Add lightweight integrity tools:

- A database view or function to identify mismatches:
  - posted payments total vs request status
  - overpaid requests
  - paid requests with missing `paid_at`
  - approved requests with full posted payment
- Add tests for:
  - partial payment → `partially_paid`
  - full payment → `paid`
  - void full payment → `approved` or `partially_paid`
  - overpayment rejection
  - no payment allowed after paid
  - archive/restore behavior

### 8. Verify with your actual data
After implementation, I will verify the live data specifically for:

- `EXP-2026-013` becomes `paid` everywhere.
- The “Record payment” button no longer appears for fully paid expenses.
- All expense register shows correct statuses.
- Financial reports separate approved/committed totals from actually paid/disbursed totals.
- Existing 11 approved expense records are checked for payment/status mismatches and corrected where appropriate.

## Technical notes

Current broken chain:

```text
Record payment in UI
  -> inserts row in expense_payments
  -> detail page calculates paid locally
  -> expense_requests.status remains approved
  -> list/report pages read approved
  -> record payment still allowed because status is still approved
```

Target chain:

```text
Record payment via database function
  -> validate role, status, remaining balance
  -> insert payment
  -> trigger/function recalculates parent request
  -> expense_requests.status becomes partially_paid/paid
  -> all pages read the same state
  -> paid requests cannot accept more payments
```

This will make the process reliable across request, approval, payment recording, reports, dashboards, and archiving.