import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EventInvitationStats {
  invited: number;
  confirmed: number;
  attended: number;
  pending: number;
  total: number;
  score: number;
}

const SCORE = { attended: 10, confirmed: 5, invited: 2, pending: 1 };

export const useEventInvitationStats = (eventId: string | undefined, memberId: string | undefined) => {
  return useQuery<EventInvitationStats>({
    queryKey: ["event-invitation-stats", eventId, memberId],
    enabled: !!eventId && !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_invitations")
        .select("status")
        .eq("target_service_id", eventId!)
        .eq("member_id", memberId!);
      if (error) throw error;

      const counts = { invited: 0, confirmed: 0, attended: 0, pending: 0 };
      (data || []).forEach((row: { status: string }) => {
        if (row.status === "invited") counts.invited += 1;
        else if (row.status === "confirmed") counts.confirmed += 1;
        else if (row.status === "attended") counts.attended += 1;
        else if (row.status === "pending_invite") counts.pending += 1;
      });
      const total = counts.invited + counts.confirmed + counts.attended + counts.pending;
      const score =
        counts.attended * SCORE.attended +
        counts.confirmed * SCORE.confirmed +
        counts.invited * SCORE.invited +
        counts.pending * SCORE.pending;
      return { ...counts, total, score };
    },
    staleTime: 60 * 1000,
  });
};
