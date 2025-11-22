import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { hasAdminAccess } from "@/lib/roles";
import { triggerNotificationRefresh } from "@/lib/notification-events";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Download, Check, X, Copy, Smartphone, Banknote, Wallet, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";

interface Giving {
  id: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_reference: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
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

export default function AdminGivings() {
  const navigate = useNavigate();
  const [givings, setGivings] = useState<Giving[]>([]);
  const [loading, setLoading] = useState(true);
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

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
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
          })
        );
        setGivings(givingsWithProfiles as any);
      }

      const allData = await supabase
        .from("givings")
        .select("amount, status");

      if (allData.data) {
        const verified = allData.data
          .filter(g => g.status === "verified")
          .reduce((sum, g) => sum + Number(g.amount), 0);
        const pending = allData.data
          .filter(g => g.status === "pending")
          .reduce((sum, g) => sum + Number(g.amount), 0);
        const rejected = allData.data
          .filter(g => g.status === "rejected")
          .reduce((sum, g) => sum + Number(g.amount), 0);

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

  const handleVerifyPayment = async (givingIds: string[]) => {
    try {
      const { error } = await supabase
        .from("givings")
        .update({ status: "verified" })
        .in("id", givingIds);

      if (error) throw error;

      toast.success(`${givingIds.length} payment(s) verified successfully`);
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
          rejection_reason: finalReason
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
    setSelectedGivings(prev =>
      prev.includes(givingId)
        ? prev.filter(id => id !== givingId)
        : [...prev, givingId]
    );
  };

  const toggleSelectAll = () => {
    const pendingGivings = givings.filter(g => g.status === "pending");
    if (selectedGivings.length === pendingGivings.length) {
      setSelectedGivings([]);
    } else {
      setSelectedGivings(pendingGivings.map(g => g.id));
    }
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
    const exportData = givings.map(g => ({
      Date: format(new Date(g.created_at), "yyyy-MM-dd HH:mm"),
      Giver: g.profiles.full_name,
      Type: g.giving_types.name,
      Amount: g.amount,
      "Payment Method": g.payment_method?.replace("_", " "),
      "Transaction Code": g.payment_reference || "N/A",
      Status: g.status,
      "Rejection Reason": g.rejection_reason || "N/A",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Givings");
    XLSX.writeFile(wb, `givings_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("Export completed");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const pendingGivings = givings.filter(g => g.status === "pending");

  return (
    <div className="space-y-6">
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
            <div className="text-2xl font-bold text-green-600">MWK {stats.verified.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">MWK {stats.pending.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">MWK {stats.rejected.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Received</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">MWK {stats.totalReceived.toLocaleString()}</div>
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
                  {pendingGivings.length > 0 && (
                    <Checkbox
                      checked={selectedGivings.length === pendingGivings.length}
                      onCheckedChange={toggleSelectAll}
                    />
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
              {givings.map((giving) => (
                <TableRow key={giving.id} className={getRowClass(giving.status)}>
                  <TableCell>
                    {giving.status === "pending" && (
                      <Checkbox
                        checked={selectedGivings.includes(giving.id)}
                        onCheckedChange={() => toggleSelectGiving(giving.id)}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusColors[giving.status as keyof typeof statusColors]}>
                      {giving.status}
                    </Badge>
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
                  </TableCell>
                  <TableCell className="font-semibold">{giving.currency} {Number(giving.amount).toLocaleString()}</TableCell>
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
                    {giving.status === "pending" && (
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => handleVerifyPayment([giving.id])} className="bg-green-600">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => openRejectDialog(giving.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
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
                  <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {rejectionReason === "Other" && (
              <Textarea value={customReason} onChange={(e) => setCustomReason(e.target.value)} placeholder="Enter reason..." rows={3} />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRejectPayment}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
