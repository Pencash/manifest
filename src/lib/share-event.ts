import { format } from "date-fns";

export interface ShareableEvent {
  id: string;
  name: string;
  service_date: string;
  start_time?: string | null;
  location?: string | null;
  description?: string | null;
  flyer_url?: string | null;
  flyer_alt?: string | null;
}

const MAX_DESCRIPTION_CHARS = 140;
const MAX_CAPTION_CHARS = 1000;

const formatTime = (time?: string | null) => {
  if (!time) return "";
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr ?? "0", 10);
  if (Number.isNaN(h)) return "";
  const date = new Date();
  date.setHours(h, m || 0, 0, 0);
  return format(date, "h:mm a");
};

export const buildEventCaption = (event: ShareableEvent, friendName: string) => {
  const dateStr = format(new Date(event.service_date), "EEE, d MMM yyyy");
  const timeStr = formatTime(event.start_time);
  const dateLine = timeStr ? `🗓 ${dateStr} · ${timeStr}` : `🗓 ${dateStr}`;
  const locationLine = event.location ? `📍 ${event.location}` : "";
  const desc = (event.description || "").trim().slice(0, MAX_DESCRIPTION_CHARS);
  const cleanFriend = friendName.trim().slice(0, 80) || "friend";
  const flyerLine = event.flyer_url ? `\n${event.flyer_url}` : "";

  const lines = [
    `Hi ${cleanFriend}, you're invited to ${event.name}`,
    flyerLine,
    dateLine,
    locationLine,
    desc ? `\n${desc}` : "",
    `\nHope to see you there! 🙌`,
  ].filter(Boolean);

  return lines.join("\n").slice(0, MAX_CAPTION_CHARS);
};

const sanitizePhone = (phone?: string | null) => {
  if (!phone) return "";
  return phone.replace(/[^\d]/g, "");
};

export type ShareOutcome = "opened";

/**
 * Build a wa.me URL for the given event/friend. Pure — safe to call synchronously.
 */
export const buildWhatsAppUrl = (
  event: ShareableEvent,
  friendName: string,
  friendPhone?: string | null,
): string => {
  const caption = buildEventCaption(event, friendName);
  const phoneDigits = sanitizePhone(friendPhone);
  return phoneDigits
    ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(caption)}`
    : `https://wa.me/?text=${encodeURIComponent(caption)}`;
};

/**
 * Open WhatsApp (app on mobile, WhatsApp Web on desktop) with the message
 * pre-filled. Flyer (if any) is included as a URL so WhatsApp renders a link
 * preview with the image. MUST be called synchronously from a user gesture.
 */
export const shareEventToWhatsApp = (
  event: ShareableEvent,
  friendName: string,
  friendPhone?: string | null,
): ShareOutcome => {
  const url = buildWhatsAppUrl(event, friendName, friendPhone);
  window.open(url, "_blank", "noopener,noreferrer");
  return "opened";
};
