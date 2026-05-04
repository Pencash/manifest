## Goal

When a member taps "Share via WhatsApp", we should go **straight to WhatsApp** (app on mobile, WhatsApp Web on desktop) pre-filled with the message and the recipient's number — no file downloads, no OS share sheet, no "Share cancelled" toast.

## Important technical reality

The `https://wa.me/<phone>?text=...` URL scheme that WhatsApp officially supports **only carries text** — it cannot pre-attach an image file. Attaching actual media requires either:
- The WhatsApp Business Cloud API (server-side, paid, template-approved), or
- The user manually picking the file in the WhatsApp composer.

So the realistic, "open WhatsApp and let me send" implementation is:
**Include the flyer's public URL inside the message text.** WhatsApp auto-renders a rich link preview with the flyer image at the top of the chat. The recipient sees the flyer + the message in a single send, and the sender does nothing extra.

This is the same pattern Eventbrite, Meetup, Luma, etc. use for WhatsApp sharing.

## Plan

### 1. `src/lib/share-event.ts` — simplify `shareEventToWhatsApp`

- Remove all `navigator.share` / `canShare` logic.
- Remove `fetchFlyerAsFile` and `downloadBlob` (and their call sites).
- Always build a `wa.me` URL and `window.open` it in a new tab:
  - With phone: `https://wa.me/<digits>?text=<caption>`
  - Without phone: `https://wa.me/?text=<caption>` (WhatsApp prompts user to pick a contact)
- Update `buildEventCaption` so that when `event.flyer_url` exists, the URL is appended on its own line near the top of the message (e.g. right under the title). WhatsApp will turn it into a link preview showing the flyer.
- Return type becomes simply `"opened"` — no more `"cancelled"` / `"shared"` / `"fallback_wa"` branches.

### 2. `src/components/event/InviteAndShareDialog.tsx`

- Drop the "Share cancelled…" toast branch. After `window.open` we always show: *"Invitation logged. WhatsApp is opening — send the message to complete the invite."*
- Update the small flyer hint box from *"Event flyer will be attached to your share."* to *"Flyer link is included in the message — WhatsApp will show a preview."*
- Message preview in the dialog will now show the flyer URL line, matching what gets sent.

### 3. Pop-up blocker safety

`window.open(...)` must be called **synchronously inside the click handler**, not after an `await`. Today it runs after the Supabase insert `await`, which on some browsers (Safari especially) blocks the popup and is likely contributing to the "cancelled" feel.

Fix: open `wa.me` first (synchronously) and fire-and-forget the invitation insert in parallel. If the insert fails we can still toast an error, but WhatsApp will already be open — which is what the user wants.

### 4. No other files need changes.

`MemberEventDetail.tsx`, the invitation stats hook, and the DB schema all stay as they are.

## Result

- Click "Share via WhatsApp" → WhatsApp (or WhatsApp Web) opens immediately on the recipient's chat with a message that already contains the flyer as a link preview.
- One tap to send. No downloads, no share sheet, no cancellation toast.
