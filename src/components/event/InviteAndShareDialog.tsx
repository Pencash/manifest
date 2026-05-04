import { useState } from "react";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Send, ImageIcon } from "lucide-react";
import {
  buildEventCaption,
  shareEventToWhatsApp,
  type ShareableEvent,
} from "@/lib/share-event";

const inviteSchema = z.object({
  invitee_name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must be 80 characters or less"),
  invitee_phone: z
    .string()
    .trim()
    .max(20, "Phone too long")
    .regex(/^[+0-9 ()-]{7,20}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
});

interface InviteAndShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: ShareableEvent;
}

export const InviteAndShareDialog = ({ open, onOpenChange, event }: InviteAndShareDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  const reset = () => {
    setName("");
    setPhone("");
    setErrors({});
  };

  const [submitting, setSubmitting] = useState(false);

  const handleShare = async () => {
    if (submitting) return;

    if (!user?.id) {
      toast.error("You must be signed in to invite friends.");
      return;
    }

    const parsed = inviteSchema.safeParse({
      invitee_name: name,
      invitee_phone: phone || undefined,
    });
    if (!parsed.success) {
      const fieldErrors: { name?: string; phone?: string } = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === "invitee_name") fieldErrors.name = issue.message;
        if (issue.path[0] === "invitee_phone") fieldErrors.phone = issue.message;
      }
      setErrors(fieldErrors);
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setErrors({});

    const cleanPhone = parsed.data.invitee_phone?.trim() || null;

    // 1. Open WhatsApp synchronously (must be inside the user gesture to avoid popup blockers)
    shareEventToWhatsApp(event, parsed.data.invitee_name, cleanPhone);

    setSubmitting(true);
    // 2. Log the invitation in the background
    try {
      const { error: insertError } = await supabase.from("member_invitations").insert({
        member_id: user.id,
        invitee_name: parsed.data.invitee_name,
        invitee_phone: cleanPhone,
        target_service_id: event.id,
        invitation_method: "whatsapp",
        status: "invited",
        invited_at: new Date().toISOString(),
      });
      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ["event-invitation-stats", event.id] });
      queryClient.invalidateQueries({ queryKey: ["member-invitations"] });
      toast.success("Invitation logged. WhatsApp is opening — send the message to complete the invite.");
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Could not log invitation");
    } finally {
      setSubmitting(false);
    }
  };

  const previewCaption = buildEventCaption(event, name || "friend");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a friend via WhatsApp</DialogTitle>
          <DialogDescription>
            We'll log the invitation and open WhatsApp with a ready-to-send message.
          </DialogDescription>
        </DialogHeader>

        {event.flyer_url ? (
          <div className="-mt-2 rounded-md overflow-hidden border border-border">
            <img
              src={event.flyer_url}
              alt={event.flyer_alt || event.name}
              className="w-full h-32 object-cover"
            />
          </div>
        ) : null}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invitee_name">Friend's name *</Label>
            <Input
              id="invitee_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. James Banda"
              maxLength={80}
              disabled={submitting}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invitee_phone">Friend's phone (optional)</Label>
            <Input
              id="invitee_phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+265 999 000 111"
              maxLength={20}
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">
              If provided, WhatsApp opens that chat directly.
            </p>
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>

          {event.flyer_url ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-md border bg-muted/30 px-3 py-2">
              <ImageIcon className="h-4 w-4 text-accent" />
              Flyer link is included — WhatsApp will show a preview.
            </div>
          ) : null}

          <div className="rounded-md border bg-muted/30 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Message preview</p>
            <pre className="text-xs whitespace-pre-wrap font-sans text-foreground/90">
              {previewCaption}
            </pre>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={() => handleShare()}
            disabled={submitting || !name.trim()}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sharing…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Share via WhatsApp
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
