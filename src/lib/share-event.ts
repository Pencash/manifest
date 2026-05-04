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
  // time is "HH:MM" or "HH:MM:SS"
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

  const lines = [
    `Hi ${cleanFriend}, you're invited to ${event.name}`,
    dateLine,
    locationLine,
    desc ? `\n${desc}` : "",
    `\nHope to see you there! 🙌`,
  ].filter(Boolean);

  return lines.join("\n").slice(0, MAX_CAPTION_CHARS);
};

const sanitizePhone = (phone?: string | null) => {
  if (!phone) return "";
  return phone.replace(/[^\d]/g, ""); // strip all non-digits for wa.me
};

const fetchFlyerAsFile = async (url: string): Promise<File | null> => {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const ext = blob.type.split("/")[1] || "jpg";
    return new File([blob], `event-flyer.${ext}`, { type: blob.type });
  } catch (err) {
    console.warn("Could not fetch flyer for sharing:", err);
    return null;
  }
};

const downloadBlob = (file: File) => {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};

export type ShareOutcome = "shared" | "fallback_wa" | "cancelled";

/**
 * Share an event to WhatsApp.
 * - If flyer + Web Share API with files supported → native share sheet (image + caption)
 * - Otherwise → opens wa.me with caption (and optional phone), downloads flyer first if present
 */
export const shareEventToWhatsApp = async (
  event: ShareableEvent,
  friendName: string,
  friendPhone?: string | null,
): Promise<ShareOutcome> => {
  const caption = buildEventCaption(event, friendName);
  const phoneDigits = sanitizePhone(friendPhone);

  // Detect mobile — Web Share API on desktop typically opens an OS share sheet
  // that does NOT route to WhatsApp directly, so we skip it there and use wa.me.
  const isMobile =
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  // Try Web Share API with file (mobile native share sheet) — mobile only
  if (isMobile && event.flyer_url && typeof navigator !== "undefined" && "share" in navigator) {
    const file = await fetchFlyerAsFile(event.flyer_url);
    if (file && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: caption, title: event.name });
        return "shared";
      } catch (err: any) {
        // If user aborted or share failed, fall through to wa.me so WhatsApp still opens
        if (err?.name !== "AbortError") {
          console.warn("navigator.share failed, falling back to wa.me:", err);
        }
      }
    }
    // Fallback: download the flyer so the user can attach it manually in WhatsApp
    if (file) downloadBlob(file);
  } else if (event.flyer_url) {
    // Desktop with flyer: download it so user can drag into WhatsApp Web
    const file = await fetchFlyerAsFile(event.flyer_url);
    if (file) downloadBlob(file);
  }

  const waUrl = phoneDigits
    ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(caption)}`
    : `https://wa.me/?text=${encodeURIComponent(caption)}`;

  window.open(waUrl, "_blank", "noopener,noreferrer");
  return "fallback_wa";
};
