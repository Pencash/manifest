import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { hasAdminAccess, type AppRole } from "@/lib/roles";
import { fetchCurrentUserAccess } from "@/lib/auth-access";
import { toast } from "sonner";

export interface Giving {
  id: string;
  amount: number;
  created_at: string;
  currency: string;
  giving_type_id: string;
  is_anonymous: boolean;
  note: string | null;
  payment_method: string;
  payment_reference: string | null;
  profile_id: string;
  rejection_reason: string | null;
  service_id: string | null;
  source?: string;
  confirmed_not_basket?: boolean;
  duplicate_of?: string | null;
  status: string;
  profiles: { full_name: string; email: string };
  giving_types: { name: string };
  services: { name: string; service_date: string; approval_status?: string } | null;
}

export const statusColors = {
  pending: "secondary",
  verified: "default",
  rejected: "destructive",
} as const;

export const REJECTION_REASONS = [
  "Invalid transaction code",
  "Transaction not found",
  "Amount mismatch",
  "Duplicate payment",
  "Insufficient verification details",
  "Other",
];

export const OFFLINE_GIVING_SCHEMA_OPTIONAL_COLUMNS = ["entry_source", "recorded_by", "requires_admin_verification"] as const;

export const extractMissingGivingColumn = (error: { message?: string; details?: string } | null) => {
  const errorText = `${error?.message || ""} ${error?.details || ""}`;
  const match = errorText.match(/Could not find the '([^']+)' column of 'givings' in the schema cache/i);
  if (!match) return null;
  const missingColumn = match[1];
  return OFFLINE_GIVING_SCHEMA_OPTIONAL_COLUMNS.includes(missingColumn as (typeof OFFLINE_GIVING_SCHEMA_OPTIONAL_COLUMNS)[number])
    ? missingColumn
    : null;
};

export const createInitialOfflineForm = () => ({
  memberId: "",
  givingTypeId: "",
  amount: "",
  currency: "MWK",
  paymentMethod: "",
  paymentReference: "",
  receivedDate: new Date(),
  serviceId: "",
  note: "",
});

export type OfflineForm = ReturnType<typeof createInitialOfflineForm>;

export function useGivingsAuth() {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/admin/auth");
        return;
      }
      const { role } = await fetchCurrentUserAccess(session.user.id);

      if (!hasAdminAccess(role)) {
        toast.error("Access denied. Admin privileges required.");
        navigate("/dashboard");
        return;
      }
      setCurrentUserId(session.user.id);
      setCurrentRole(role as AppRole);
      setLoading(false);
    };
    check();
  }, [navigate]);

  return { currentUserId, currentRole, loading };
}

export function useGivingsMetadata() {
  const [givingTypes, setGivingTypes] = useState<{ id: string; name: string }[]>([]);
  const [members, setMembers] = useState<{ id: string; full_name: string; email: string | null; phone: string | null }[]>([]);
  const [events, setEvents] = useState<{ id: string; name: string; service_date: string; is_archived: boolean | null }[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const loadGivingTypes = async () => {
    try {
      const { data, error } = await supabase.from("giving_types").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      setGivingTypes(data || []);
    } catch (error: any) {
      console.error("Error loading giving types:", error);
      toast.error("Failed to load giving types");
    }
  };

  const loadMembers = async () => {
    try {
      setLoadingMembers(true);
      const { data, error } = await supabase.from("profiles").select("id, full_name, email, phone").order("full_name", { ascending: true });
      if (error) throw error;
      setMembers(data || []);
    } catch (error: any) {
      console.error("Error loading members:", error);
      toast.error("Failed to load members list");
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase.from("services").select("id, name, service_date, is_archived").order("service_date", { ascending: false });
      if (error) throw error;
      setEvents(data || []);
    } catch (error: any) {
      console.error("Error loading events:", error);
      toast.error("Failed to load events");
    }
  };

  useEffect(() => {
    loadGivingTypes();
    loadMembers();
    loadEvents();
  }, []);

  return { givingTypes, members, events, loadingMembers };
}

export function useGivingsList(filterStatus: string, filterPaymentMethod: string) {
  const [givings, setGivings] = useState<Giving[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ verified: 0, pending: 0, rejected: 0, totalReceived: 0 });

  const loadGivings = async () => {
    try {
      let query = supabase
        .from("givings")
        .select(`*, giving_types(name), services(name, service_date, approval_status)`)
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") query = query.eq("status", filterStatus);
      if (filterPaymentMethod !== "all") query = query.eq("payment_method", filterPaymentMethod);

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        const givingsWithProfiles = await Promise.all(
          data.map(async (giving) => {
            const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", giving.profile_id).single();
            return { ...giving, profiles: profile || { full_name: "Anonymous", email: "N/A" } };
          }),
        );
        setGivings(givingsWithProfiles as Giving[]);
      }

      const allData = await supabase.from("givings").select("amount, status");
      if (allData.data) {
        const verified = allData.data.filter((g) => g.status === "verified").reduce((sum, g) => sum + Number(g.amount), 0);
        const pending = allData.data.filter((g) => g.status === "pending").reduce((sum, g) => sum + Number(g.amount), 0);
        const rejected = allData.data.filter((g) => g.status === "rejected").reduce((sum, g) => sum + Number(g.amount), 0);
        setStats({ verified, pending, rejected, totalReceived: verified + pending });
      }
    } catch (error: any) {
      console.error("Error loading givings:", error);
      toast.error("Failed to load givings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGivings();
  }, [filterStatus, filterPaymentMethod]);

  return { givings, loading, stats, loadGivings };
}
