import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Calendar, Clock, ImageIcon, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface UpcomingEvent {
  id: string;
  name: string;
  service_date: string;
  start_time: string | null;
  location: string | null;
  service_type: string | null;
  flyer_url: string | null;
}

const fetchUpcomingForMember = async (): Promise<UpcomingEvent[]> => {
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("services")
    .select("id, name, service_date, start_time, location, service_type, flyer_url")
    .eq("is_published", true)
    .eq("approval_status", "approved")
    .gte("service_date", today)
    .order("service_date", { ascending: true })
    .limit(50);
  if (error) throw error;
  return (data || []) as UpcomingEvent[];
};

const formatTime = (time: string | null) => {
  if (!time) return "";
  const [h, m] = time.split(":");
  const d = new Date();
  d.setHours(parseInt(h, 10), parseInt(m || "0", 10), 0, 0);
  return format(d, "h:mm a");
};

const UpcomingEvents = () => {
  const navigate = useNavigate();
  const { data: events, isLoading } = useQuery({
    queryKey: ["member-upcoming-events"],
    queryFn: fetchUpcomingForMember,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 max-w-3xl mx-auto"
    >
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      <div>
        <h1 className="heading-display text-3xl sm:text-4xl text-foreground">
          Upcoming <span className="text-accent">Events</span>
        </h1>
        <p className="text-muted-foreground mt-1 font-sans">
          Tap an event to mobilize friends or give toward it.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : !events || events.length === 0 ? (
        <Card className="card-elevated p-10 text-center">
          <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No upcoming events yet — check back soon.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <Card
              key={event.id}
              className="card-elevated cursor-pointer group p-4 sm:p-5 hover:bg-card/80 transition-colors"
              onClick={() => navigate(`/events/${event.id}`)}
            >
              <div className="flex items-start gap-4">
                {event.flyer_url ? (
                  <img
                    src={event.flyer_url}
                    alt=""
                    loading="lazy"
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover flex-shrink-0 border"
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10 border">
                    <Calendar className="h-7 w-7 text-accent" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-foreground truncate">{event.name}</h3>
                    {event.flyer_url && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <ImageIcon className="h-3 w-3" />
                        Flyer
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap text-xs sm:text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(new Date(event.service_date), "EEE, d MMM yyyy")}
                    </span>
                    {event.start_time && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatTime(event.start_time)}
                      </span>
                    )}
                    {event.location && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <MapPin className="h-3.5 w-3.5" />
                        {event.location}
                      </span>
                    )}
                  </div>
                </div>

                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-accent transition-colors flex-shrink-0 mt-1" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default UpcomingEvents;
