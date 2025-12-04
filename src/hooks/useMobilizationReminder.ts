import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

export const useMobilizationReminder = (userId: string | null) => {
  const hasShownReminder = useRef(false);

  useEffect(() => {
    if (!userId || hasShownReminder.current) return;

    const checkPendingInvitations = async () => {
      try {
        // Get pending invitations for the current user
        const { data: invitations, error } = await supabase
          .from("member_invitations")
          .select(`
            id,
            invitee_name,
            status,
            target_service_id,
            services:target_service_id (
              name,
              service_date
            )
          `)
          .eq("member_id", userId)
          .in("status", ["pending_invite", "invited"])
          .gte("services.service_date", new Date().toISOString().split("T")[0]);

        if (error) throw error;

        // Filter out invitations without valid service data
        const validInvitations = invitations?.filter(
          (inv: any) => inv.services && inv.services.service_date >= new Date().toISOString().split("T")[0]
        ) || [];

        if (validInvitations.length > 0) {
          hasShownReminder.current = true;
          
          // Group by service
          const serviceMap = new Map<string, { serviceName: string; serviceDate: string; count: number }>();
          validInvitations.forEach((inv: any) => {
            const serviceId = inv.target_service_id;
            if (!serviceMap.has(serviceId)) {
              serviceMap.set(serviceId, {
                serviceName: inv.services.name,
                serviceDate: inv.services.service_date,
                count: 0
              });
            }
            serviceMap.get(serviceId)!.count++;
          });

          // Show reminder toast
          const serviceList = Array.from(serviceMap.values());
          if (serviceList.length === 1) {
            const service = serviceList[0];
            toast.info(
              `Mobilization Reminder: You have ${service.count} pending invitation${service.count > 1 ? "s" : ""} for ${service.serviceName} on ${format(new Date(service.serviceDate), "PPP")}`,
              {
                duration: 8000,
                action: {
                  label: "View",
                  onClick: () => window.location.href = "/mobilization"
                }
              }
            );
          } else {
            toast.info(
              `Mobilization Reminder: You have ${validInvitations.length} pending invitations across ${serviceList.length} upcoming events`,
              {
                duration: 8000,
                action: {
                  label: "View",
                  onClick: () => window.location.href = "/mobilization"
                }
              }
            );
          }
        }
      } catch (error) {
        console.error("Error checking pending invitations:", error);
      }
    };

    // Small delay to let the page load first
    const timer = setTimeout(checkPendingInvitations, 1500);
    return () => clearTimeout(timer);
  }, [userId]);
};
