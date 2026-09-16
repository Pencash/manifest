# MEIMS Development Roadmap

## Phase 1 — Baseline preservation
Preserve the current interface and master data in version control. Add automated regression checks for record counts and schema.

## Phase 2 — Data architecture
Move browser-local data to a persistent database/API while retaining the current UI.

## Phase 3 — Import engine
Support the latest Excel/CSV template, column mapping, validation, duplicate detection, project/activity upsert, error reporting and downloadable validation results.

## Phase 4 — Approval workflow
New or changed projects/activities enter Pending Approval. The approver is resolved from the designated approver email field. Record approval, rejection, timestamp and audit information.

## Phase 5 — Automated alerts
Implement the agreed delayed-activity rule and email notifications through a server-side scheduler/email service.

## Phase 6 — Dashboard analytics
Retain project-filtered budget summaries and interactive Mode of Implementation and Budget by Project visualizations. Add additional M&E analytics incrementally.

## Phase 7 — Production deployment
Authentication, role-based permissions, audit trail, secure database, email service, backups, monitoring and CI/CD.
