import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { hasAdminAccess } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Eye, Plus, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { formatAmount } from "@/lib/utils";
import { statusBadgeClasses } from "@/lib/expense-format";
import { cn } from "@/lib/utils";

interface ExpenseRequest {
  id: string;
  request_number: string | null;
  amount: number;
  currency: string;
  description: string;
  priority: string;
  status: string;
  created_at: string;
  requester_id: string;
  category_id: string;
  service_id: string | null;
  profiles: { full_name: string; email: string | null };
  expense_categories: { name: string; code: string };
}

export default function AdminExpenseRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/admin/auth");
      return;
    }

    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    const mainRole = rolesData?.[0]?.role;
    if (!hasAdminAccess(mainRole)) {
      toast.error("Access denied. Admin privileges required.");
      navigate("/dashboard");
      return;
    }

    loadRequests();
  };

  const loadRequests = async () => {
    try {
      setRefreshing(true);

      let query = supabase
        .from("expense_requests")
        .select("id, request_number, amount, currency, description, priority, status, created_at, requester_id, category_id, service_id")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data: requestsData, error } = await query;
      if (error) throw error;

      const requesterIds = [...new Set((requestsData || []).map((r) => r.requester_id).filter(Boolean))];
      const categoryIds = [...new Set((requestsData || []).map((r) => r.category_id).filter(Boolean))];

      const [profilesRes, categoriesRes] = await Promise.all([
        requesterIds.length
          ? supabase.from("profiles").select("id, full_name, email").in("id", requesterIds)
          : Promise.resolve({ data: [], error: null }),
        categoryIds.length
          ? supabase.from("expense_categories").select("id, name, code").in("id", categoryIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      const profilesMap = new Map((profilesRes.data || []).map((p) => [p.id, p]));
      const categoriesMap = new Map((categoriesRes.data || []).map((c) => [c.id, c]));

      const hydrated = (requestsData || []).map((req) => ({
        ...req,
        profiles: profilesMap.get(req.requester_id) || { full_name: "Unknown", email: null },
        expense_categories: categoriesMap.get(req.category_id) || { name: "Unknown", code: "—" },
      }));

      setRequests(hydrated);
    } catch (error: any) {
      toast.error("Failed to load expense requests");
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      loadRequests();
    }
  }, [statusFilter]);

  const getPriorityBadge = (priority: string) => {
    const variants = {
      low: "secondary",
      medium: "default",
      high: "secondary",
      urgent: "destructive",
    } as const;
    return (
      <Badge variant={variants[priority as keyof typeof variants] || "secondary"}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading expense requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">All Expense Requests</h1>
            <p className="text-muted-foreground">View and manage all expense requests</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={loadRequests} disabled={refreshing}>
              <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
              Refresh
            </Button>
            <Button onClick={() => navigate("/admin/expenses/request")}>
              <Plus className="mr-2 h-4 w-4" />
              New Request
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Expense Register ({requests.length})</CardTitle>
                <CardDescription>All expense requests across every status</CardDescription>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="changes_requested">Changes Requested</SelectItem>
                  <SelectItem value="partially_paid">Partially Paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No expense requests found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request #</TableHead>
                      <TableHead>Requester</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-mono text-sm">{request.request_number || "—"}</TableCell>
                        <TableCell>
                          <div className="font-medium">{request.profiles.full_name}</div>
                          <div className="text-xs text-muted-foreground">{request.profiles.email}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{request.expense_categories.code}</div>
                          <div className="text-xs text-muted-foreground">{request.expense_categories.name}</div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{request.description}</TableCell>
                        <TableCell className="font-mono">
                          {formatAmount(request.amount, request.currency)}
                        </TableCell>
                        <TableCell>{getPriorityBadge(request.priority)}</TableCell>
                        <TableCell>
                          <Badge className={cn("border", statusBadgeClasses[request.status] || statusBadgeClasses.draft)}>
                            {request.status.replace(/_/g, " ").toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(request.created_at), "PPP")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/admin/expenses/${request.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
