# Supabase security review

**Date:** 2025-11-30

Summary of the current schema controls for the Manifest platform:

- **Row Level Security (RLS)** is enabled on all core tables introduced in migrations, including `profiles`, `services`, `givings`, `receipts`, `attendance`, `contacts`, `event_reminders`, and `visitor_followups` as of the latest migration set. Access is constrained by user-specific checks or role-aware policies such as `has_role(auth.uid(), 'admin'::app_role)`.
- **Role scoping**: Admin/finance/pastor-only policies protect administrative write paths (e.g., service approval, follow-ups, and giving inserts for privileged roles). Member-facing inserts and reads (giving, receipts, attendance) are restricted to `auth.uid()` matches.
- **Data quality constraints**: Validation constraints such as `valid_contact_type` for `contacts.contact_type`, status enumerations on giving/attendance/testimony records, and unique keys on attendance records help prevent malformed or duplicate data from bypassing policy intent.

No permissive `ALL` policies were found that bypass role checks, and the latest migrations continue to enforce RLS on new tables to keep privileged actions scoped to administrators, finance, or pastors as appropriate.
