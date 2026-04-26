## Plan: Improve Event Management and Giving Date Selection

### Goals

1. Admins should be able to edit events regardless of whether they are upcoming, today, past, or archived.
2. Admins should be able to remove events from active lists and archived lists when needed.
3. Admins should still be able to log or correct attendance after an event has passed, so missing attendee names can be captured later.
4. Members should be able to relate a giving to a past event, or create/select a giving date when the event was not created before.

### What will change

**1. Events page actions**
- Add **Edit** and **Log Attendance** actions to every active event card, including past events.
- Keep **Reschedule** available for past events, but no longer hide edit/attendance actions.
- Add a clearer **Archive** action for active events.
- Add **Edit**, **Log Attendance**, **Restore**, and **Delete** actions to archived event cards.

**2. Delete behavior**
- Keep the current safe behavior for active events as **Archive** instead of immediately destroying records.
- Add a separate **Delete Permanently** action for archived events only.
- The delete confirmation will warn that attendance/mobilization/reporting links may be affected.

**3. Attendance correction after an event**
- The existing Attendance Log page already supports adding members/visitors and saving attendance against a service.
- The events page will expose that page for past and archived events, so admins can capture missing attendee names later.

**4. Member giving event/date selection**
- Update the giving service selector so members can choose existing past events, not only visible future/current dates.
- Allow members to create a missing event for a past date when they are recording a giving.
- Remove the current restriction that prevents choosing a past date in the member-created event dialog.
- Keep member-created events as **Pending Admin Approval** and unpublished, preserving the current approval workflow.

**5. Data safety and permissions**
- No database schema change is required.
- Existing backend security already allows admins/pastors to update/delete events and members to submit pending events.
- If permanent deletion fails because related attendance/giving records exist, the UI will show a clear error and recommend archiving instead.

### Technical details

**Files to modify:**
- `src/pages/EventsManagement.tsx`
  - Refactor card action buttons so edit and attendance are available for all statuses.
  - Add permanent delete handling for archived events.
  - Reuse the existing edit dialog for archived events.
  - Refresh both active and archived lists after edits/deletes.

- `src/components/ServiceSelector.tsx`
  - Ensure past approved events remain selectable.
  - Remove the `min={today}` restriction from member event creation.
  - Improve helper text so members understand they can select an event date or submit a missing event for approval.

- `src/pages/Give.tsx`
  - Minor copy update around event selection to clarify that giving can be linked to a past event or to a newly submitted event.

### Expected result

Admins will be able to correct event details and attendance after the fact, including for past and archived events. Members recording giving will be able to connect contributions to a past event or submit a missing event date for admin approval.