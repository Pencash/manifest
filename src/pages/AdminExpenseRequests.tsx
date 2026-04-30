import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Eye, Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import { ResponsiveDataView, type ResponsiveDataViewRow } from "@/components/ResponsiveDataView";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { statusBadgeClasses } from "@/lib/expense-format";
import { getHighestRole, hasAdminAccess } from "@/lib/roles";
import { cn, formatAmount } from "@/lib/utils";

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
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/admin/auth");
      return;
    }

    const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);

    const mainRole = getHighestRole(rolesData?.map(({ role }) => role));
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

  const filteredRequests = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return requests;

    return requests.filter((request) => {
      const description = request.description.toLowerCase();
      const requestNumber = request.request_number?.toLowerCase() ?? "";
      const requester = request.profiles.full_name.toLowerCase();
      const category = `${request.expense_categories.code} ${request.expense_categories.name}`.toLowerCase();
      return [description, requestNumber, requester, category].some((entry) => entry.includes(query));
    });
  }, [requests, searchTerm]);

  const getPriorityBadge = (priority: string) => {
    const variants = {
      low: "secondary",
      medium: "default",
      high: "secondary",
      urgent: "destructive",
    } as const;
    return <Badge variant={variants[priority as keyof typeof variants] || "secondary"}>{priority.toUpperCase()}</Badge>;
  };

  const rows: ResponsiveDataViewRow[] = useMemo(
    () =>
      filteredRequests.map((request) => {
        const requesterCell = (
          <>
            <div className="font-medium">{request.profiles.full_name}</div>
            <div className="text-xs text-muted-foreground">{request.profiles.email || "No email"}</div>
          </>
        );

        const categoryCell = (
          <>
            <div className="font-medium">{request.expense_categories.code}</div>
            <div className="text-xs text-muted-foreground">{request.expense_categories.name}</div>
          </>
        );

        const statusBadge = (
          <Badge className={cn("border", statusBadgeClasses[request.status] || statusBadgeClasses.draft)}>
            {request.status.replace(/_/g, " ").toUpperCase()}
          </Badge>
        );

        return {
          id: request.id,
          title: request.request_number || "Request",
          subtitle: request.description,
          desktopCells: [
            <span className="font-mono text-sm">{request.request_number || "—"}</span>,
            requesterCell,
            categoryCell,
            <span className="line-clamp-1 max-w-xs">{request.description}</span>,
            <span className="font-mono">{formatAmount(request.amount, request.currency)}</span>,
            getPriorityBadge(request.priority),
            statusBadge,
            <span className="text-sm text-muted-foreground">{format(new Date(request.created_at), "PPP")}</span>,
          ],
          essentials: [
            { label: "Status", value: statusBadge },
            { label: "Amount", value: <span className="font-mono">{formatAmount(request.amount, request.currency)}</span> },
            { label: "Person", value: request.profiles.full_name },
            { label: "Date", value: format(new Date(request.created_at), "PPP") },
          ],
          details: [
            { label: "Category", value: `${request.expense_categories.code} — ${request.expense_categories.name}` },
            { label: "Priority", value: getPriorityBadge(request.priority) },
            { label: "Description", value: request.description },
          ],
          actions: (
            <Button size="sm" variant="outline" onClick={() => navigate(`/admin/expenses/${request.id}`)}>
              <Eye className="mr-1 h-4 w-4" />
              View
            </Button>
          ),
        };
      }),
    [filteredRequests, navigate],
  );

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
            <div>
              <CardTitle>Expense Register ({filteredRequests.length})</CardTitle>
              <CardDescription>All expense requests across every status</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveDataView
              columns={["Request #", "Requester", "Category", "Description", "Amount", "Priority", "Status", "Date"]}
              rows={rows}
              controls={
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search by request number, person, category, or description"
                      className="pl-9"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full md:w-[220px]">
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
              }
              emptyState={
                <div className="py-12 text-center">
                  <p className="text-muted-foreground">No expense requests found</p>
                </div>
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
