import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  HandHeart,
  MapPin,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InviteAndShareDialog } from "@/components/event/InviteAndShareDialog";
import { useEventInvitationStats } from "@/hooks/useEventInvitationStats";
import type { ShareableEvent } from "@/lib/share-event";

const formatTime = (time: string | null | undefined) => {
  if (!time) return "";
  const [h, m] = time.split(":");
  const d = new Date();
  d.setHours(parseInt(h, 10), parseInt(m || "0", 10), 0, 0);
  return format(d, "h:mm a");
};

const MemberEventDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: event, isLoading, isError } = useQuery({
    queryKey: ["member-event-detail", id],
    enabled: !!id,
    queryFn: async (): Promise<ShareableEvent> => {
      const { data, error } = await supabase
        .from("services")
        .select(
          "id, name, service_date, start_time, location, description, flyer_url, flyer_alt",
        )
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Event not found");
      return data as ShareableEvent;
    },
  });

  const { data: stats } = useEventInvitationStats(id, user?.id);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !event) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center space-y-4">
        <p className="text-muted-foreground">Event not found or no longer available.</p>
        <Button onClick={() => navigate("/events/upcoming")}>Back to events</Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 max-w-3xl mx-auto"
    >
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/events/upcoming")}>
          <ArrowLeft className="h-4 w-4" />
          Back to events
        </Button>
      </div>

      {/* Hero */}
      <Card className="card-elevated overflow-hidden">
        {event.flyer_url ? (
          <img
            src={event.flyer_url}
            alt={event.flyer_alt || event.name}
            className="w-full max-h-96 object-cover"
          />
        ) : (
          <div className="w-full h-48 sm:h-64 flex items-center justify-center bg-gradient-to-br from-primary/10 via-accent/10 to-secondary/20">
            <Calendar className="h-16 w-16 text-accent/60" />
          </div>
        )}
        <div className="p-5 sm:p-6 space-y-3">
          <h1 className="heading-display text-2xl sm:text-3xl text-foreground">{event.name}</h1>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-accent" />
              {format(new Date(event.service_date), "EEEE, d MMMM yyyy")}
            </span>
            {event.start_time && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-accent" />
                {formatTime(event.start_time)}
              </span>
            )}
            {event.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-accent" />
                {event.location}
              </span>
            )}
          </div>
          {event.description && (
            <p className="text-sm sm:text-base text-foreground/80 whitespace-pre-wrap pt-2 border-t">
              {event.description}
            </p>
          )}
        </div>
      </Card>

      {/* Two actions */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card
          className="card-elevated cursor-pointer group p-5 hover:bg-card/80 transition-colors"
          onClick={() => setInviteOpen(true)}
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl icon-container-glass flex items-center justify-center bg-gradient-to-br from-accent/20 to-accent/5">
              <Users className="h-5 w-5 text-accent" />
            </div>
          </div>
          <h3 className="font-semibold text-foreground mb-1">Mobilize for this event</h3>
          <p className="text-sm text-muted-foreground">
            Invite a friend via WhatsApp{event.flyer_url ? " — flyer included" : ""}.
          </p>
          <Button className="w-full mt-4" size="sm">
            <HandHeart className="h-4 w-4" />
            Invite a friend
          </Button>
        </Card>

        <Card
          className="card-elevated cursor-pointer group p-5 hover:bg-card/80 transition-colors"
          onClick={() => navigate(`/give?service_id=${event.id}`)}
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl icon-container-glass flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
          </div>
          <h3 className="font-semibold text-foreground mb-1">Give toward this event</h3>
          <p className="text-sm text-muted-foreground">
            Record your tithe or offering linked to this service.
          </p>
          <Button variant="outline" className="w-full mt-4" size="sm">
            <DollarSign className="h-4 w-4" />
            Give now
          </Button>
        </Card>
      </div>

      {/* Your involvement */}
      {stats && stats.total > 0 && (
        <Card className="card-elevated p-5">
          <h4 className="font-semibold text-foreground mb-3">Your involvement so far</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div>
              <div className="stat-number text-2xl text-accent">{stats.total}</div>
              <div className="text-xs text-muted-foreground mt-1">Friends invited</div>
            </div>
            <div>
              <div className="stat-number text-2xl text-foreground">{stats.confirmed}</div>
              <div className="text-xs text-muted-foreground mt-1">Confirmed</div>
            </div>
            <div>
              <div className="stat-number text-2xl text-foreground">{stats.attended}</div>
              <div className="text-xs text-muted-foreground mt-1">Attended</div>
            </div>
            <div>
              <div className="stat-number text-2xl text-accent">{stats.score}</div>
              <div className="text-xs text-muted-foreground mt-1">Mobilization points</div>
            </div>
          </div>
        </Card>
      )}

      <InviteAndShareDialog open={inviteOpen} onOpenChange={setInviteOpen} event={event} />
    </motion.div>
  );
};

export default MemberEventDetail;
