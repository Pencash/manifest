import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Download, Eye, Plus, Receipt, TrendingUp, Wallet } from "lucide-react";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPaymentState, paymentStateBadgeClasses, priorityBadgeClasses, statusBadgeClasses } from "@/features/expenses/presentation";
import { useExpenseRegister } from "@/hooks/useExpenseRegister";
import { supabase } from "@/integrations/supabase/client";
import { hasAdminAccess } from "@/lib/roles";
import { cn, formatAmount } from "@/lib/utils";
import { toast } from "sonner";

export default function AdminExpenseRequests() {
  const navigate = useNavigate();
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const checkAuth = useCallback(async () => {
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

    setLoadingAccess(false);

    const registerQuery = useExpenseRegister(filterStatus, !loadingAccess);
    const requests = useMemo(() => registerQuery.data || [], [registerQuery.data]);

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
        "Settled At": req.paid_at ? format(new Date(req.paid_at), "dd MMM yyyy, HH:mm") : "N/A",
        "Settled By": req.settledByProfile?.full_name || "N/A",
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
  }, [navigate]);

    useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  if (loadingAccess || registerQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground">Loading expense register...</p>
        </div>
      </div>
    );
  }

  if (registerQuery.isError) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>Unable to load expense register</CardTitle>
            <CardDescription>
              {registerQuery.error instanceof Error ? registerQuery.error.message : "Please refresh and try again."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Expense Requests</h1>
          <p className="text-muted-foreground">Track every request from submission through approval, payment progress, and final settlement.</p>
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
              <CardDescription>Use the detail view to inspect approvals, receipts, and every payment entry for a request.</CardDescription>
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
                          <div className="space-y-1">
                            <Badge className={cn("border", paymentStateBadgeClasses[paymentState])}>
                              {paymentState === "none" ? "UNPAID" : paymentState === "partial" ? "PARTIAL" : "FULLY PAID"}
                            </Badge>
                            {request.status === "paid" && request.paid_at && (
                              <p className="text-xs text-muted-foreground">
                                Settled {format(new Date(request.paid_at), "dd MMM yyyy")}
                                {request.settledByProfile?.full_name ? ` by ${request.settledByProfile.full_name}` : ""}
                              </p>
                            )}
                          </div>
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