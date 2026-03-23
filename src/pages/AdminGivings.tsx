import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, isSameDay } from "date-fns";
import {
  AlertCircle,
  Banknote,
  CalendarIcon,
  Check,
  Copy,
  Download,
  Pencil,
  Smartphone,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { triggerNotificationRefresh } from "@/lib/notification-events";
import { hasAdminAccess, type AppRole } from "@/lib/roles";
import { cn, formatAmount } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Giving {
  id: string;
  amount: number;
  created_at: string;
  currency: string;
  entry_source: string;
  giving_type_id: string;
  is_anonymous: boolean;
  note: string | null;
  payment_method: string;
  payment_reference: string | null;
  profile_id: string;
  recorded_by: string | null;
  rejection_reason: string | null;
  requires_admin_verification: boolean;
  service_id: string | null;
  status: string;
  profiles: { full_name: string; email: string };
  giving_types: { name: string };
  services: { name: string; service_date: string; approval_status?: string } | null;
}

const statusColors = {
  pending: "secondary",
  verified: "default",
  rejected: "destructive",
} as const;

const REJECTION_REASONS = [
  "Invalid transaction code",
  "Transaction not found",
  "Amount mismatch",
  "Duplicate payment",
  "Insufficient verification details",
  "Other",
];

const createInitialOfflineForm = () => ({
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

export default function AdminGivings() {
  const navigate = useNavigate();
  const [givings, setGivings] = useState<Giving[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<AppRole | null>(null);
  const [givingTypes, setGivingTypes] = useState<{ id: string; name: string }[]>([]);
  const [members, setMembers] = useState<{ id: string; full_name: string; email: string | null; phone: string | null }[]>([]);
  const [events, setEvents] = useState<{ id: string; name: string; service_date: string; is_archived: boolean | null }[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [submittingOffline, setSubmittingOffline] = useState(false);
  const [editingGivingId, setEditingGivingId] = useState<string | null>(null);
  const [offlineForm, setOfflineForm] = useState(createInitialOfflineForm());
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>("all");
  const [selectedGivings, setSelectedGivings] = useState<string[]>([]);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectGivingId, setRejectGivingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [stats, setStats] = useState({
    verified: 0,
    pending: 0,
    rejected: 0,
    totalReceived: 0,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadGivings();
    }
  }, [filterStatus, filterPaymentMethod]);

  const resetOfflineForm = () => {
    setOfflineForm(createInitialOfflineForm());
    setEditingGivingId(null);
  };

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      navigate("/admin/auth");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    if (!roleData || !hasAdminAccess(roleData.role)) {
      toast.error("Access denied. Admin privileges required.");
      navigate("/dashboard");
      return;
    }

    setCurrentUserId(session.user.id);
    setCurrentRole(roleData.role as AppRole);

    await loadMetadata();
    loadMembers();
    loadEvents();
    loadGivings();
  };

  const loadGivings = async () => {
    try {
      let query = supabase
        .from("givings")
        .select(`
          *,
          giving_types(name),
          services(name, service_date, approval_status)
        `)
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      if (filterPaymentMethod !== "all") {
        query = query.eq("payment_method", filterPaymentMethod);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        const givingsWithProfiles = await Promise.all(
          data.map(async (giving) => {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("id", giving.profile_id)
              .single();

            return {
              ...giving,
              profiles: profile || { full_name: "Anonymous", email: "N/A" },
            };
          }),
        );

        setGivings(givingsWithProfiles as Giving[]);
      }

      const allData = await supabase.from("givings").select("amount, status");
      if (allData.data) {
        const verified = allData.data.filter((g) => g.status === "verified").reduce((sum, g) => sum + Number(g.amount), 0);
        const pending = allData.data.filter((g) => g.status === "pending").reduce((sum, g) => sum + Number(g.amount), 0);
        const rejected = allData.data.filter((g) => g.status === "rejected").reduce((sum, g) => sum + Number(g.amount), 0);

        setStats({
          verified,
          pending,
          rejected,
          totalReceived: verified + pending,
        });
      }
    } catch (error: any) {
      console.error("Error loading givings:", error);
      toast.error("Failed to load givings");
    } finally {
      setLoading(false);
    }
  };

  const loadMetadata = async () => {
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

  const canManagePendingFinanceOfflineGiving = (giving: Giving) => {
    return (
      currentRole === "finance" &&
      currentUserId === giving.recorded_by &&
      giving.entry_source === "offline" &&
      giving.requires_admin_verification &&
      giving.status === "pending"
    );
  };

  const canVerifyPendingGiving = (giving: Giving) => {
    if (giving.status !== "pending") return false;
    if (currentRole === "admin") return true;
    if (currentRole === "finance") return !giving.requires_admin_verification;
    return false;
  };

  const verifiablePendingGivings = givings.filter((giving) => canVerifyPendingGiving(giving));

  const handleVerifyPayment = async (givingIds: string[]) => {
    const allowedIds = givingIds.filter((id) => {
      const giving = givings.find((item) => item.id === id);
      return giving ? canVerifyPendingGiving(giving) : false;
    });

    if (allowedIds.length === 0) {
      toast.error("You can only verify records that are eligible for your role.");
      return;
    }

    try {
      const { error } = await supabase.from("givings").update({ status: "verified", rejection_reason: null }).in("id", allowedIds);
      if (error) throw error;

      toast.success(`${allowedIds.length} payment(s) verified successfully`);
      setSelectedGivings([]);
      loadGivings();
      triggerNotificationRefresh();
    } catch (error: any) {
      console.error("Error verifying payment:", error);
      toast.error("Failed to verify payment");
    }
  };

  const openRejectDialog = (givingId: string) => {
    setRejectGivingId(givingId);
    setRejectionReason("");
    setCustomReason("");
    setShowRejectDialog(true);
  };

  const handleRejectPayment = async () => {
    if (!rejectGivingId) return;

    const giving = givings.find((item) => item.id === rejectGivingId);
    if (!giving || !canVerifyPendingGiving(giving)) {
      toast.error("You can only reject records that are eligible for your role.");
      return;
    }

    const finalReason = rejectionReason === "Other" ? customReason : rejectionReason;
    if (!finalReason) {
      toast.error("Please provide a rejection reason");
      return;
    }

    try {
      const { error } = await supabase
        .from("givings")
        .update({
          status: "rejected",
          rejection_reason: finalReason,
        })
        .eq("id", rejectGivingId);

      if (error) throw error;

      toast.success("Payment rejected");
      setShowRejectDialog(false);
      setRejectGivingId(null);
      loadGivings();
      triggerNotificationRefresh();
    } catch (error: any) {
      console.error("Error rejecting payment:", error);
      toast.error("Failed to reject payment");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const toggleSelectGiving = (givingId: string) => {
    setSelectedGivings((prev) => (prev.includes(givingId) ? prev.filter((id) => id !== givingId) : [...prev, givingId]));
  };

  const toggleSelectAll = () => {
    if (selectedGivings.length === verifiablePendingGivings.length) {
      setSelectedGivings([]);
      return;
    }

    setSelectedGivings(verifiablePendingGivings.map((giving) => giving.id));
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case "mobile_money":
        return <Smartphone className="h-4 w-4" />;
      case "bank_transfer":
        return <Banknote className="h-4 w-4" />;
      case "cash":
        return <Wallet className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getRowClass = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-50 dark:bg-yellow-950/10";
      case "verified":
        return "bg-green-50 dark:bg-green-950/10";
      case "rejected":
        return "bg-red-50 dark:bg-red-950/10";
      default:
        return "";
    }
  };

  const exportToExcel = () => {
    const exportData = givings.map((g) => ({
      Date: format(new Date(g.created_at), "yyyy-MM-dd HH:mm"),
      Giver: g.profiles.full_name,
      Type: g.giving_types.name,
      Amount: g.amount,
      "Payment Method": g.payment_method?.replace("_", " "),
      "Transaction Code": g.payment_reference || "N/A",
      Source: g.entry_source,
      Status: g.status,
      "Needs Admin Verification": g.requires_admin_verification ? "Yes" : "No",
      "Rejection Reason": g.rejection_reason || "N/A",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Givings");
    XLSX.writeFile(wb, `givings_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("Export completed");
  };

  const formatAmountWithSeparators = (value: string) => {
    const numericValue = parseFloat(value.replace(/,/g, ""));
    if (isNaN(numericValue)) return value.replace(/,/g, "");

    return numericValue.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleAmountBlur = () => {
    if (!offlineForm.amount) return;
    setOfflineForm((prev) => ({
      ...prev,
      amount: formatAmountWithSeparators(prev.amount),
    }));
  };

  const handleAmountFocus = () => {
    setOfflineForm((prev) => ({
      ...prev,
      amount: prev.amount.replace(/,/g, ""),
    }));
  };

  const handleEditOfflineGiving = (giving: Giving) => {
    setEditingGivingId(giving.id);
    setOfflineForm({
      memberId: giving.profile_id,
      givingTypeId: giving.giving_type_id,
      amount: Number(giving.amount).toFixed(2),
      currency: giving.currency,
      paymentMethod: giving.payment_method,
      paymentReference: giving.payment_reference || "",
      receivedDate: new Date(giving.created_at),
      serviceId: giving.service_id || "",
      note: giving.note || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteOfflineGiving = async (giving: Giving) => {
    if (!canManagePendingFinanceOfflineGiving(giving)) {
      toast.error("You can only delete your own pending offline records awaiting admin verification.");
      return;
    }

    const confirmed = window.confirm(`Delete the offline giving for ${giving.profiles.full_name} (${formatAmount(Number(giving.amount), giving.currency)})?`);
    if (!confirmed) return;

    try {
      const { error } = await supabase.from("givings").delete().eq("id", giving.id);
      if (error) throw error;

      if (editingGivingId === giving.id) {
        resetOfflineForm();
      }

      toast.success("Offline giving deleted");
      loadGivings();
      triggerNotificationRefresh();
    } catch (error: any) {
      console.error("Error deleting offline giving:", error);
      toast.error(error.message || "Failed to delete giving");
    }
  };

  const handleOfflineGivingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!offlineForm.memberId) {
      toast.error("Please select a registered member");
      return;
    }

    if (!offlineForm.givingTypeId) {
      toast.error("Please select a purpose of giving");
      return;
    }

    const amountValue = parseFloat(offlineForm.amount.replace(/,/g, ""));
    if (isNaN(amountValue) || amountValue <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!offlineForm.paymentMethod) {
      toast.error("Please select a mode of giving");
      return;
    }

    if (
      (offlineForm.paymentMethod === "mobile_money" || offlineForm.paymentMethod === "bank_transfer") &&
      (!offlineForm.paymentReference || offlineForm.paymentReference.length < 4)
    ) {
      toast.error("Payment reference is required for mobile money or bank transfers");
      return;
    }

    setSubmittingOffline(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      const receivedAt = new Date(offlineForm.receivedDate);
      receivedAt.setHours(12, 0, 0, 0);

      const isFinanceOfflineRecord = currentRole === "finance";
      const payload = {
        profile_id: offlineForm.memberId,
        giving_type_id: offlineForm.givingTypeId,
        amount: amountValue,
        currency: offlineForm.currency,
        payment_method: offlineForm.paymentMethod,
        payment_reference: offlineForm.paymentReference || null,
        service_id: offlineForm.serviceId || null,
        note: offlineForm.note || null,
        created_at: receivedAt.toISOString(),
        status: isFinanceOfflineRecord ? "pending" : "verified",
        is_anonymous: false,
        entry_source: "offline",
        recorded_by: user.id,
        requires_admin_verification: isFinanceOfflineRecord,
        rejection_reason: null,
      };

      if (editingGivingId) {
        const { error: updateError } = await supabase.from("givings").update(payload).eq("id", editingGivingId);
        if (updateError) throw updateError;

        toast.success("Offline giving updated. It still requires admin verification.");
      } else {
        const { error: givingError } = await supabase.from("givings").insert(payload);
        if (givingError) throw givingError;

        toast.success(isFinanceOfflineRecord ? "Offline giving recorded and sent for admin verification" : "Offline giving recorded successfully");
      }

      resetOfflineForm();
      loadGivings();
      triggerNotificationRefresh();
    } catch (error: any) {
      console.error("Error recording offline giving:", error);
      toast.error(error.message || "Failed to record giving");
    } finally {
      setSubmittingOffline(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const dateMatchedEvents = events.filter((event) => isSameDay(new Date(event.service_date), offlineForm.receivedDate));
  const prioritizedEvents = [...dateMatchedEvents, ...events.filter((event) => !dateMatchedEvents.some((matched) => matched.id === event.id))];
  const selectedEvent = events.find((event) => event.id === offlineForm.serviceId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{editingGivingId ? "Edit Offline Giving" : "Record Offline Giving"}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Capture cash or manual contributions for members without app access.
            {currentRole === "finance" ? " Finance-recorded offline givings stay pending until an admin verifies them." : ""}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleOfflineGivingSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="member">Member *</Label>
                <Select
                  value={offlineForm.memberId}
                  onValueChange={(value) => setOfflineForm({ ...offlineForm, memberId: value })}
                  disabled={loadingMembers || submittingOffline}
                >
                  <SelectTrigger id="member">
                    <SelectValue placeholder={loadingMembers ? "Loading members..." : "Select registered member"} />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name} {member.email ? `(${member.email})` : ""}
                      </SelectItem>
                    ))}
                    {!members.length && !loadingMembers && (
                      <SelectItem value="no-members" disabled>
                        No registered members found
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {offlineForm.memberId && (
                  <p className="text-xs text-muted-foreground">
                    Selected member contact: {members.find((m) => m.id === offlineForm.memberId)?.email || "No email"} |{" "}
                    {members.find((m) => m.id === offlineForm.memberId)?.phone || "No phone"}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="givingType">Purpose of Giving *</Label>
                <Select value={offlineForm.givingTypeId} onValueChange={(value) => setOfflineForm({ ...offlineForm, givingTypeId: value })}>
                  <SelectTrigger id="givingType">
                    <SelectValue placeholder="Select purpose" />
                  </SelectTrigger>
                  <SelectContent>
                    {givingTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="text"
                  value={offlineForm.amount}
                  onChange={(e) => setOfflineForm({ ...offlineForm, amount: e.target.value })}
                  onBlur={handleAmountBlur}
                  onFocus={handleAmountFocus}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" value={offlineForm.currency} onChange={(e) => setOfflineForm({ ...offlineForm, currency: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Mode of Giving *</Label>
                <Select value={offlineForm.paymentMethod} onValueChange={(value) => setOfflineForm({ ...offlineForm, paymentMethod: value })}>
                  <SelectTrigger id="paymentMethod">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="card">Card / POS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date Received *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !offlineForm.receivedDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(offlineForm.receivedDate, "PPP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={offlineForm.receivedDate}
                      onSelect={(date) => date && setOfflineForm({ ...offlineForm, receivedDate: date })}
                      initialFocus
                      captionLayout="dropdown-buttons"
                      fromYear={new Date().getFullYear() - 10}
                      toYear={new Date().getFullYear() + 10}
                      className="p-4 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="relatedEvent">Related Event (Optional)</Label>
                <Select
                  value={offlineForm.serviceId || "none"}
                  onValueChange={(value) => setOfflineForm({ ...offlineForm, serviceId: value === "none" ? "" : value })}
                >
                  <SelectTrigger id="relatedEvent">
                    <SelectValue placeholder="Link to an event" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No related event</SelectItem>
                    {prioritizedEvents.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name} — {format(new Date(event.service_date), "PPP")}
                        {event.is_archived ? " (Archived)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {dateMatchedEvents.length > 0 && (
                  <p className="text-xs text-muted-foreground">{dateMatchedEvents.length} event(s) match the selected date and appear first.</p>
                )}
                {selectedEvent && !isSameDay(new Date(selectedEvent.service_date), offlineForm.receivedDate) && (
                  <p className="text-xs text-muted-foreground">Selected event date: {format(new Date(selectedEvent.service_date), "PPP")}</p>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="paymentReference">Payment Reference</Label>
                <Input
                  id="paymentReference"
                  value={offlineForm.paymentReference}
                  onChange={(e) => setOfflineForm({ ...offlineForm, paymentReference: e.target.value })}
                  placeholder="Txn code or receipt number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={members.find((m) => m.id === offlineForm.memberId)?.email || ""} readOnly placeholder="Member email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={members.find((m) => m.id === offlineForm.memberId)?.phone || ""} readOnly placeholder="Member phone" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Notes</Label>
              <Textarea
                id="note"
                value={offlineForm.note}
                onChange={(e) => setOfflineForm({ ...offlineForm, note: e.target.value })}
                placeholder="Add any helpful details about this giving"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              {editingGivingId && (
                <Button type="button" variant="outline" onClick={resetOfflineForm}>
                  Cancel Edit
                </Button>
              )}
              <Button type="submit" disabled={submittingOffline}>
                {submittingOffline ? "Saving..." : editingGivingId ? "Update Giving" : "Record Giving"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Payment Verification</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Verify mobile money and bank transaction codes. Prioritize Airtel Money and TNM Mpamba transactions.
          </p>
        </div>
        <Button onClick={exportToExcel} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Available Funds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatAmount(stats.verified)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatAmount(stats.pending)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatAmount(stats.rejected)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Received</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatAmount(stats.totalReceived)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-4 flex-wrap">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectContent>
            </Select>
            {selectedGivings.length > 0 && (
              <Button onClick={() => handleVerifyPayment(selectedGivings)} className="bg-green-600">
                <Check className="mr-2 h-4 w-4" />
                Verify {selectedGivings.length}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  {verifiablePendingGivings.length > 0 && (
                    <Checkbox checked={selectedGivings.length === verifiablePendingGivings.length} onCheckedChange={toggleSelectAll} />
                  )}
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Giver</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {givings.map((giving) => {
                const canVerify = canVerifyPendingGiving(giving);
                const canManagePendingOffline = canManagePendingFinanceOfflineGiving(giving);

                return (
                  <TableRow key={giving.id} className={getRowClass(giving.status)}>
                    <TableCell>
                      {canVerify && (
                        <Checkbox checked={selectedGivings.includes(giving.id)} onCheckedChange={() => toggleSelectGiving(giving.id)} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[giving.status as keyof typeof statusColors]}>{giving.status}</Badge>
                      {giving.requires_admin_verification && giving.status === "pending" && (
                        <div className="mt-2">
                          <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-700 bg-amber-500/10">
                            Awaiting admin verification
                          </Badge>
                        </div>
                      )}
                      {giving.rejection_reason && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-destructive">
                          <AlertCircle className="h-3 w-3" />
                          {giving.rejection_reason}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getPaymentMethodIcon(giving.payment_method)}
                        <span className="capitalize">{giving.payment_method?.replace("_", " ")}</span>
                      </div>
                      {giving.payment_reference && (
                        <div className="flex items-center gap-1 mt-1">
                          <code className="text-xs bg-muted px-1">{giving.payment_reference}</code>
                          <Button size="sm" variant="ghost" onClick={() => copyToClipboard(giving.payment_reference!)} className="h-5 w-5 p-0">
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      {giving.entry_source === "offline" && (
                        <div className="text-xs text-muted-foreground mt-1">Offline record</div>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold">{formatAmount(Number(giving.amount), giving.currency)}</TableCell>
                    <TableCell>{giving.profiles.full_name}</TableCell>
                    <TableCell>{giving.giving_types.name}</TableCell>
                    <TableCell>
                      {giving.services ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{giving.services.name}</span>
                          {giving.services.approval_status === "pending_admin_approval" && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
                              Pending
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">General</span>
                      )}
                    </TableCell>
                    <TableCell>{format(new Date(giving.created_at), "MMM dd")}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {canVerify && (
                          <>
                            <Button size="sm" onClick={() => handleVerifyPayment([giving.id])} className="bg-green-600">
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => openRejectDialog(giving.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {canManagePendingOffline && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => handleEditOfflineGiving(giving)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDeleteOfflineGiving(giving)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payment</DialogTitle>
            <DialogDescription>Provide a reason for rejection</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={rejectionReason} onValueChange={setRejectionReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {REJECTION_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {rejectionReason === "Other" && (
              <Textarea value={customReason} onChange={(e) => setCustomReason(e.target.value)} placeholder="Enter reason..." rows={3} />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRejectPayment}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
