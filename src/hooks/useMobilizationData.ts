import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Invitation {
  id: string;
  invitee_name: string;
  invitee_phone: string | null;
  invitee_email?: string;
  status: string;
  invitation_method?: string;
  notes?: string;
  invited_at?: string;
  confirmed_at?: string;
  attended_at?: string;
  created_at: string;
  target_service_id?: string;
  services?: {
    name: string;
    service_date: string;
  };
}

export const fetchUpcomingServices = async () => {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("is_published", true)
    .gte("service_date", new Date().toISOString().split('T')[0])
    .order("service_date", { ascending: true })
    .limit(20);

  if (error) throw error;
  return data || [];
};

export const fetchInvitations = async (userId: string) => {
  const { data, error } = await supabase
    .from("member_invitations")
    .select("*, services(name, service_date)")
    .eq("member_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as Invitation[];
};

export const useUpcomingServices = () => {
  return useQuery({
    queryKey: ['upcoming-services'],
    queryFn: fetchUpcomingServices,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};

export const useInvitations = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['member-invitations', userId],
    queryFn: () => fetchInvitations(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
};

export const useAddInvitation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      userId: string;
      invitee_name: string;
      invitee_phone: string | null;
      invitee_email: string | null;
      target_service_id: string;
      invitation_method: string | null;
      notes: string | null;
    }) => {
      const { error } = await supabase.from("member_invitations").insert({
        member_id: data.userId,
        invitee_name: data.invitee_name,
        invitee_phone: data.invitee_phone,
        invitee_email: data.invitee_email,
        target_service_id: data.target_service_id,
        invitation_method: data.invitation_method,
        notes: data.notes,
        status: "pending_invite"
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['member-invitations', variables.userId] });
    },
  });
};

export const useUpdateInvitationStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, status, userId }: { id: string; status: string; userId: string }) => {
      const updates: Record<string, string> = { status };
      if (status === "invited") updates.invited_at = new Date().toISOString();
      if (status === "confirmed") updates.confirmed_at = new Date().toISOString();
      if (status === "attended") updates.attended_at = new Date().toISOString();

      const { error } = await supabase
        .from("member_invitations")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
      return { id, status, userId };
    },
    onMutate: async ({ id, status, userId }) => {
      await queryClient.cancelQueries({ queryKey: ['member-invitations', userId] });
      const previous = queryClient.getQueryData<Invitation[]>(['member-invitations', userId]);
      
      queryClient.setQueryData<Invitation[]>(['member-invitations', userId], (old) =>
        old?.map(inv => inv.id === id ? { ...inv, status } : inv) || []
      );
      
      return { previous, userId };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['member-invitations', context.userId], context.previous);
      }
    },
  });
};

export const useDeleteInvitation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      const { error } = await supabase
        .from("member_invitations")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { id, userId };
    },
    onMutate: async ({ id, userId }) => {
      await queryClient.cancelQueries({ queryKey: ['member-invitations', userId] });
      const previous = queryClient.getQueryData<Invitation[]>(['member-invitations', userId]);
      
      queryClient.setQueryData<Invitation[]>(['member-invitations', userId], (old) =>
        old?.filter(inv => inv.id !== id) || []
      );
      
      return { previous, userId };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['member-invitations', context.userId], context.previous);
      }
    },
  });
};

export const useBulkUpdateStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ ids, status, userId }: { ids: string[]; status: string; userId: string }) => {
      const updates: Record<string, string> = { status };
      if (status === "invited") updates.invited_at = new Date().toISOString();
      if (status === "confirmed") updates.confirmed_at = new Date().toISOString();
      if (status === "attended") updates.attended_at = new Date().toISOString();

      const { error } = await supabase
        .from("member_invitations")
        .update(updates)
        .in("id", ids);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['member-invitations', variables.userId] });
    },
  });
};

export const useBulkDelete = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ ids, userId }: { ids: string[]; userId: string }) => {
      const { error } = await supabase
        .from("member_invitations")
        .delete()
        .in("id", ids);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['member-invitations', variables.userId] });
    },
  });
};
