import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Download, Eye, Plus, Receipt, TrendingUp, Wallet } from "lucide-react";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { hasAdminAccess } from "@/lib/roles";
import { calculatePostedPaymentsTotal, calculateRemainingBalance } from "@/lib/expense-payments";
import { cn, formatAmount } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

interface ExpenseRequestRow {
  id: string;
  request_number: string | null;
  requester_id: string;
  amount: number;
  currency: string;
  description: string;
  priority: string;
  status: string;
  created_at: string;
  expense_categories: { name: string; code: string } | null;
  services: { name: string } | null;
  profiles: { full_name: string; email: string | null };
  paidTotal: number;
  remainingBalance: number;
  paymentCount: number;
}

const statusBadgeClasses: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  pending: "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-900",
  approved: "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-300 dark:border-blue-900",
  partially_paid: "bg-violet-500/10 text-violet-700 border-violet-200 dark:text-violet-300 dark:border-violet-900",
  paid: "bg-green-500/10 text-green-700 border-green-200 dark:text-green-300 dark:border-green-900",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  changes_requested: "bg-orange-500/10 text-orange-700 border-orange-200 dark:text-orange-300 dark:border-orange-900",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const priorityBadgeClasses: Record<string, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-primary/10 text-primary border-primary/20",
  high: "bg-orange-500/10 text-orange-700 border-orange-200 dark:text-orange-300 dark:border-orange-900",
  urgent: "bg-destructive/10 text-destructive border-destructive/20",
};

const paymentStateBadgeClasses = {
  none: "bg-muted text-muted-foreground border-border",
  partial: "bg-violet-500/10 text-violet-700 border-violet-200 dark:text-violet-300 dark:border-violet-900",
  paid: "bg-green-500/10 text-green-700 border-green-200 dark:text-green-300 dark:border-green-900",
};

const getPaymentState = (row: ExpenseRequestRow) => {
  if (row.paidTotal <= 0) return "none" as const;
  if (row.remainingBalance > 0) return "partial" as const;
  return "paid" as const;
};

const isMissingExpensePaymentsTableError = (error: { message?: string; details?: string; code?: string } | null) => {
  if (!error) return false;
  if (error.code === "42P01") return true;

  const errorText = `${error.message || ""} ${error.details || ""}`;
  return /could not find the table ['"]?public\.expense_payments['"]? in the schema cache/i.test(errorText)
    || /relation ['"]?public\.expense_payments['"]? does not exist/i.test(errorText)
    || /relation ['"]?expense_payments['"]? does not exist/i.test(errorText);
};

export default function AdminExpenseRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ExpenseRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    void checkAuth();
  }, []);

  useEffect(() => {
    if (!loading) {
      void loadRequests();
    }
  }, [filterStatus]);

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

    await loadRequests();
  };

  const loadRequests = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from("expense_requests")
        .select(`
          id,
          request_number,
          requester_id,
          amount,
          currency,
          description,
          priority,
          status,
          created_at,
          expense_categories(name, code),
          services(name)
        `)
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      const requestRows = data || [];
      const requesterIds = [...new Set(requestRows.map((row) => row.requester_id).filter(Boolean))];
      const requestIds = requestRows.map((row) => row.id);

      const [profilesRes, paymentsRes] = await Promise.all([
        requesterIds.length
          ? supabase.from("profiles").select("id, full_name, email").in("id", requesterIds)
          : Promise.resolve({ data: [], error: null }),
        requestIds.length
          ? (supabase.from("expense_payments" as any) as any).select("expense_request_id, amount, status").in("expense_request_id", requestIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (paymentsRes.error && !isMissingExpensePaymentsTableError(paymentsRes.error)) throw paymentsRes.error;

      const profilesMap = new Map(
        (profilesRes.data || []).map((profile) => [profile.id, { full_name: profile.full_name || "Unknown user", email: profile.email }]),
      );

      const paymentsByRequest = new Map<string, Array<{ amount: number; status: string }>>();
      const safePaymentsData = paymentsRes.error ? [] : (paymentsRes.data || []);

      safePaymentsData.forEach((payment) => {
        const existing = paymentsByRequest.get(payment.expense_request_id) || [];
        existing.push({ amount: Number(payment.amount), status: payment.status });
        paymentsByRequest.set(payment.expense_request_id, existing);
      });

      const hydratedRequests = requestRows.map((request) => {
        const requestPayments = paymentsByRequest.get(request.id) || [];
        const paidTotal = calculatePostedPaymentsTotal(requestPayments);

        return {
          ...request,
          profiles: profilesMap.get(request.requester_id) || { full_name: "Unknown user", email: null },
          paidTotal,
          remainingBalance: calculateRemainingBalance(Number(request.amount), paidTotal),
          paymentCount: requestPayments.filter((payment) => payment.status === "posted").length,
        } as ExpenseRequestRow;
      });

      setRequests(hydratedRequests);
    } catch (error: any) {
      toast.error("Failed to load expense requests");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const summary = useMemo(() => {
    const requestedTotal = requests.reduce((sum, request) => sum + Number(request.amount), 0);
    const paidTotal = requests.reduce((sum, request) => sum + request.paidTotal, 0);
    const outstandingTotal = requests.reduce((sum, request) => sum + request.remainingBalance, 0);
    const activeCount = requests.filter((request) => ["pending", "approved", "partially_paid"].includes(request.status)).length;

    return {
      requestedTotal,
      paidTotal,
      outstandingTotal,
      activeCount,
    };
  }, [requests]);

  const exportToExcel = () => {
    const exportData = requests.map((req) => ({
      "Request #": req.request_number || "Draft",
      Requester: req.profiles.full_name,
      Email: req.profiles.email || "N/A",
      Category: req.expense_categories?.name || "Unknown",
      Service: req.services?.name || "General",
      Amount: formatAmount(req.amount, req.currency),
      "Paid Total": formatAmount(req.paidTotal, req.currency),
      Balance: formatAmount(req.remainingBalance, req.currency),
      Priority: req.priority.toUpperCase(),
      Status: req.status.replace(/_/g, " ").toUpperCase(),
      Description: req.description,
      Created: format(new Date(req.created_at), "dd MMM yyyy"),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expense Requests");
    XLSX.writeFile(wb, `expense-requests-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("Expense register exported to Excel.");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground">Loading expense register...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Expense Requests</h1>
          <p className="text-muted-foreground">
            Track every request from submission through approval, payment progress, and final settlement.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportToExcel} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export register
          </Button>
          <Button onClick={() => navigate("/admin/expenses/request")} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New request
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total requested</CardDescription>
            <CardTitle>{formatAmount(summary.requestedTotal)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Across {requests.length} filtered request{requests.length === 1 ? "" : "s"}.</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paid through ledger</CardDescription>
            <CardTitle className="text-green-600">{formatAmount(summary.paidTotal)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Backed by posted payment entries.</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Outstanding balance</CardDescription>
            <CardTitle>{formatAmount(summary.outstandingTotal)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Requested value still awaiting settlement.</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open workflow items</CardDescription>
            <CardTitle>{summary.activeCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Pending, approved, or partially paid requests.</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Expense register</CardTitle>
              <CardDescription>
                Use the detail view to inspect approvals, receipts, and every payment entry for a request.
              </CardDescription>
            </div>
            <div className="w-full sm:w-52">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="partially_paid">Partially paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="changes_requested">Changes requested</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="rounded-xl border border-dashed px-6 py-16 text-center">
              <Receipt className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">No expense requests found</p>
              <p className="mt-2 text-muted-foreground">
                {filterStatus === "all"
                  ? "Create your first request to begin tracking approvals and payments."
                  : `No expense requests currently match the status filter: ${filterStatus.replace(/_/g, " ")}.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment state</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => {
                    const paymentState = getPaymentState(request);

                    return (
                      <TableRow key={request.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{request.request_number || "Draft request"}</span>
                            <span className="max-w-xs truncate text-xs text-muted-foreground">{request.description}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{request.profiles.full_name}</span>
                            <span className="text-xs text-muted-foreground">{request.profiles.email || "No email"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{request.expense_categories?.code || "—"}</span>
                            <span className="text-xs text-muted-foreground">{request.services?.name || request.expense_categories?.name || "Unknown category"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{formatAmount(request.amount, request.currency)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 font-medium text-green-600">
                            <Wallet className="h-4 w-4" />
                            {formatAmount(request.paidTotal, request.currency)}
                          </div>
                          <p className="text-xs text-muted-foreground">{request.paymentCount} posted payment{request.paymentCount === 1 ? "" : "s"}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 font-medium">
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            {formatAmount(request.remainingBalance, request.currency)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("border", priorityBadgeClasses[request.priority] || priorityBadgeClasses.medium)}>
                            {request.priority.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("border", statusBadgeClasses[request.status] || statusBadgeClasses.draft)}>
                            {request.status.replace(/_/g, " ").toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("border", paymentStateBadgeClasses[paymentState])}>
                            {paymentState === "none" ? "UNPAID" : paymentState === "partial" ? "PARTIAL" : "FULLY PAID"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{format(new Date(request.created_at), "dd MMM yyyy")}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => navigate(`/admin/expenses/${request.id}`)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View details
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
