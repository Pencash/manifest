## Goal

Keep the dashboard exactly as it is today (4 lean stat cards), but make the **Upcoming Events** card a real entry point into a small, focused mobilization flow:

```text
Dashboard
   └─ Upcoming Events card  (count, click → list)
        └─ Upcoming Events list  (one row per event)
             └─ Event detail
                  ├─ Mobilize  → Invite friends → Share via WhatsApp (with flyer if available)
                  └─ Give      → Record giving toward this event
```

Every WhatsApp share is automatically logged as an invitation with status `invited`, contributing to the member's mobilization score.

---

## Part 1 — Make the Upcoming Events card clickable

No visual change to the dashboard. The existing card already navigates somewhere via `path: "/mobilization"`. Change that destination to a new dedicated route:

- New route: `/events/upcoming` (member-facing list of upcoming, published, approved services).
- Updated stat tile destination: `/events/upcoming` instead of `/mobilization`.

Card behaviour remains identical — same number, same icon, same animation. Only the destination changes.

---

## Part 2 — Upcoming Events list page (`/events/upcoming`)

A clean, mobile-first list. One row per upcoming service, ordered soonest first.

Each row shows:
- Event name + small type badge
- Date (e.g. "Sun, 10 May") and start time
- Location
- A small "Flyer" badge if a flyer is uploaded (visual cue that share will be richer)
- Tap anywhere on the row → event detail page

Empty state: "No upcoming events yet — check back soon."

Reuses the existing `fetchUpcomingServices` query; no new data fetching.

---

## Part 3 — Member event detail page (`/events/:id`)

A focused page with three sections:

1. **Hero** — flyer image (if uploaded) or branded placeholder with event name. Date, time, location, description below.
2. **Two primary actions** — large, equal-weight cards:
   - **Mobilize for this event** → opens Invite + Share flow (Part 4)
   - **Give toward this event** → navigates to `/give` with the `service_id` preselected (existing Give page already supports a service field)
3. **Your involvement so far** — small footer section showing:
   - "You've invited X friend(s) to this event"
   - Mobilization score contribution from this event (using existing scoring formula)

Access: any authenticated member can view (the service must already be published + approved per existing RLS).

---

## Part 4 — Invite + Share via WhatsApp flow

Triggered from the event detail "Mobilize" action. Single dialog with:

- **Friend's name** (required, 2–80 chars, validated with zod)
- **Friend's phone** (optional, validated as phone format if provided)
- Brief preview of the WhatsApp message that will be sent
- Big **Share via WhatsApp** button

On submit:

1. Insert a `member_invitations` row:
   - `member_id` = current user
   - `target_service_id` = event id
   - `invitee_name` = entered name
   - `invitee_phone` = entered phone (or null)
   - `invitation_method` = `'whatsapp'`
   - `status` = `'invited'` (per your decision)
   - `invited_at` = now
2. Build the WhatsApp message:

   **With flyer uploaded** — share the flyer image + caption via Web Share API (`navigator.share({ files, text })`). Mobile native share sheet picks WhatsApp. Desktop fallback: download flyer + open `wa.me` with caption.

   **Without flyer** — open `https://wa.me/<phone-or-empty>?text=<caption>` (text-only). If `invitee_phone` is provided, target it directly so WhatsApp opens that chat; otherwise opens contact picker.

3. Caption template:

   ```text
   Hi {Friend Name}, you're invited to {Event Name}
   🗓 {Sun, 10 May} · {6:00 PM}
   📍 {Location}

   {first 140 chars of description}

   Join us 👉 https://manifestmalawi.com
   ```

4. Toast confirmation: "Invitation sent and logged. Thank you for mobilizing!" — then close dialog and refresh the "Your involvement" section so the count updates immediately.

If the share API call is cancelled by the user mid-flow, the invitation row is still created (the act of preparing it counts as `invited`, matching your decision). Members can always remove an accidental invite from the Mobilization page.

---

## Part 5 — Admin: upload event flyer

Add a **Flyer image** field to the existing event create/edit form on Events Management.

- Field: file input (PNG, JPG, WEBP), max 5 MB, recommended 1080×1350.
- Stored in a new public storage bucket: `event-flyers`.
- Path convention: `event-flyers/{service_id}/{uuid}.{ext}`.
- The public URL is saved to a new `services.flyer_url text` column.
- Edit form shows current flyer with a Replace / Remove control.
- Optional: add a small alt-text field (`services.flyer_alt`) for accessibility.

Permissions: only admin/pastor (existing services UPDATE policy) can upload. The bucket is public-read so flyers can be fetched without auth — required for WhatsApp shares to render previews when forwarded.

---

## Part 6 — Database changes (single migration)

```sql
-- 1. Flyer fields on services
ALTER TABLE public.services
  ADD COLUMN flyer_url text,
  ADD COLUMN flyer_alt text;

-- 2. New public storage bucket for flyers
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-flyers', 'event-flyers', true);

-- 3. Storage policies
-- Public read (so WhatsApp link previews work)
CREATE POLICY "Public can view flyers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-flyers');

-- Admin/pastor upload + replace + delete
CREATE POLICY "Admins/pastors can upload flyers"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'event-flyers'
    AND (authz.has_role(auth.uid(),'admin') OR authz.has_role(auth.uid(),'pastor'))
  );
-- (UPDATE + DELETE policies mirror INSERT)
```

No changes to `member_invitations` (existing schema already supports `target_service_id`, `invitation_method`, status `invited`, `invited_at`).

---

## Technical details

**New files**
- `src/pages/UpcomingEvents.tsx` — list view
- `src/pages/MemberEventDetail.tsx` — event detail with Mobilize / Give actions
- `src/components/event/InviteAndShareDialog.tsx` — name/phone form + share trigger
- `src/lib/share-event.ts` — builds caption, calls Web Share API or `wa.me`, handles fallbacks
- `src/hooks/useEventInvitationStats.ts` — count of current member's invites for one event

**Modified files**
- `src/pages/Dashboard.tsx` — change Upcoming Events tile path to `/events/upcoming`
- `src/App.tsx` — register the two new routes inside `MemberLayout`
- `src/pages/EventsManagement.tsx` (admin) + the create/edit form — add flyer upload field
- `src/pages/Give.tsx` — accept `?service_id=` query param to preselect the event

**Validation (zod)**
- Friend name: trimmed, 2–80 chars
- Friend phone: optional, regex `^[+0-9 ()-]{7,20}$`
- Caption: hard-cap whole message at 1,000 chars before passing to `encodeURIComponent`
- Flyer upload: MIME in `image/png|jpeg|webp`, size ≤ 5 MB

**No new dependencies.** Web Share API is native; `wa.me` is just a URL.

**QA checklist**
- iOS Safari: Web Share with file works → WhatsApp shows flyer + caption.
- Android Chrome: same.
- Desktop: falls back to flyer download + `wa.me` text link.
- Event without flyer: text-only WhatsApp link works.
- Invitation row appears on the member's Mobilization page immediately, status `invited`.
- Mobilization scoring picks it up automatically (already counts `invited`).
- Admin upload, replace, remove flyer all work; old file deleted on replace.

---

## Out of scope (future)

- Public per-event landing page with OpenGraph preview (so the WhatsApp link itself shows a card).
- Tracking which shared invites actually convert to attendance (would link `member_invitations` → `attendance` via phone match).
- Member-uploaded custom flyers per share (probably never — keep brand control with admins).

Ready to build this once you approve.
