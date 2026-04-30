import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { AlertCircle, CheckCircle, Eye, Search, XCircle } from "lucide-react";
import { toast } from "sonner";

import { BulkActionBar } from "@/components/BulkActionBar";
import { ResponsiveDataView, type ResponsiveDataViewRow } from "@/components/ResponsiveDataView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { triggerNotificationRefresh } from "@/lib/notification-events";
import { getHighestRole, hasAdminAccess } from "@/lib/roles";
import { formatAmount } from "@/lib/utils";

interface ExpenseRequest {
  id: string;
  request_number: string;
  amount: number;
  currency: string;
  description: string;
  justification: string;
  priority: string;
  status: string;
  created_at: string;
  profiles: { full_name: string; email: string | null };
  expense_categories: { name: string; code: string };
  services: { name: string } | null;
}

export default function PendingExpenseApprovals() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ExpenseRequest | null>(null);
  const [action, setAction] = useState<"approve" | "reject" | "changes">("approve");
  const [comments, setComments] = useState("");
  const [processing, setProcessing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

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
      const { data: requestsData, error } = await supabase
        .from("expense_requests")
        .select("id, request_number, amount, currency, description, justification, priority, status, created_at, requester_id, category_id, service_id")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const requesterIds = [...new Set((requestsData || []).map((req) => req.requester_id).filter(Boolean))];
      const categoryIds = [...new Set((requestsData || []).map((req) => req.category_id).filter(Boolean))];
      const serviceIds = [...new Set((requestsData || []).map((req) => req.service_id).filter(Boolean))];

      const [profilesRes, categoriesRes, servicesRes] = await Promise.all([
        requesterIds.length
          ? supabase.from("profiles").select("id, full_name, email").in("id", requesterIds)
          : Promise.resolve({ data: [], error: null }),
        categoryIds.length
          ? supabase.from("expense_categories").select("id, name, code").in("id", categoryIds)
          : Promise.resolve({ data: [], error: null }),
        serviceIds.length
          ? supabase.from("services").select("id, name").in("id", serviceIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (servicesRes.error) throw servicesRes.error;

      const profilesMap = new Map((profilesRes.data || []).map((profile) => [profile.id, profile]));
      const categoriesMap = new Map((categoriesRes.data || []).map((category) => [category.id, category]));
      const servicesMap = new Map((servicesRes.data || []).map((service) => [service.id, service]));

      const hydratedRequests = (requestsData || []).map((req) => ({
        ...req,
        profiles: profilesMap.get(req.requester_id) || { full_name: "Unknown", email: "" },
        expense_categories: categoriesMap.get(req.category_id) || { name: "Unknown", code: "" },
        services: req.service_id ? servicesMap.get(req.service_id) || null : null,
      }));

      setRequests(hydratedRequests);
    } catch (error: any) {
      toast.error("Failed to load pending requests");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openApprovalDialog = (request: ExpenseRequest | null, approvalAction: "approve" | "reject" | "changes", isBulk = false) => {
    setSelectedRequest(request);
    setAction(approvalAction);
    setComments("");
    setBulkAction(isBulk);
    setDialogOpen(true);
  };

  const handleApproval = async () => {
    setProcessing(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (action === "approve") {
        const { data: profile } = await supabase.from("profiles").select("email").eq("id", user.id).single();

        if (profile?.email !== "pnderitu2@gmail.com") {
          toast.error("Only the main administrator (pnderitu2@gmail.com) can approve expense requests.");
          setProcessing(false);
          return;
        }
      }

      const newStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "changes_requested";
      const requestIdsToProcess = bulkAction ? selectedIds : [selectedRequest!.id];

      const { error: updateError } = await supabase
        .from("expense_requests")
        .update({
          status: newStatus,
          rejection_reason: action === "reject" ? comments : null,
        })
        .in("id", requestIdsToProcess);

      if (updateError) throw updateError;

      const approvals = requestIdsToProcess.map((id) => ({
        expense_request_id: id,
        approver_id: user.id,
        action: action === "approve" ? "approved" : action === "reject" ? "rejected" : "changes_requested",
        comments: comments || null,
      }));

      const { error: approvalError } = await supabase.from("expense_approvals").insert(approvals);

      if (approvalError) throw approvalError;

      toast.success(
        bulkAction ? `${requestIdsToProcess.length} requests ${newStatus.replace("_", " ")}` : `Request ${newStatus.replace("_", " ")}`,
      );
      setDialogOpen(false);
      setSelectedIds([]);
      loadRequests();
      triggerNotificationRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to process approval");
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const filteredRequests = useMemo(() => {
    const searchQuery = searchTerm.trim().toLowerCase();
    return requests.filter((request) => {
      const matchesPriority = priorityFilter === "all" || request.priority === priorityFilter;
      if (!matchesPriority) return false;

      if (!searchQuery) return true;
      const searchable = [
        request.request_number,
        request.description,
        request.justification,
        request.profiles.full_name,
        request.expense_categories.code,
        request.expense_categories.name,
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(searchQuery);
    });
  }, [requests, searchTerm, priorityFilter]);

  const toggleSelectAllFiltered = () => {
    const visibleIds = filteredRequests.map((r) => r.id);
    const allSelected = visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: "secondary",
      medium: "default",
      high: "secondary",
      urgent: "destructive",
    } as const;
    return <Badge variant={colors[priority as keyof typeof colors] || "secondary"}>{priority.toUpperCase()}</Badge>;
  };

  const rows: ResponsiveDataViewRow[] = useMemo(
    () =>
      filteredRequests.map((request) => {
        const requesterCell = (
          <>
            <div className="font-medium">{request.profiles.full_name}</div>
            <div className="text-xs text-muted-foreground">{request.profiles.email}</div>
          </>
        );

        const categoryCell = (
          <>
            <div className="font-medium">{request.expense_categories.code}</div>
            <div className="text-xs text-muted-foreground">{request.expense_categories.name}</div>
          </>
        );

        return {
          id: request.id,
          title: request.request_number,
          subtitle: request.description,
          desktopCells: [
            <Checkbox checked={selectedIds.includes(request.id)} onCheckedChange={() => toggleSelection(request.id)} />,
            <span className="font-mono text-sm">{request.request_number}</span>,
            requesterCell,
            categoryCell,
            <div className="max-w-xs">
              <div className="font-medium">{request.description}</div>
              <div className="line-clamp-2 text-xs text-muted-foreground">{request.justification}</div>
            </div>,
            <span className="font-mono">{formatAmount(request.amount, request.currency)}</span>,
            getPriorityBadge(request.priority),
            <span className="text-sm text-muted-foreground">{format(new Date(request.created_at), "PPP")}</span>,
          ],
          essentials: [
            { label: "Status", value: <Badge variant="secondary">PENDING</Badge> },
            { label: "Amount", value: <span className="font-mono">{formatAmount(request.amount, request.currency)}</span> },
            { label: "Person", value: request.profiles.full_name },
            { label: "Date", value: format(new Date(request.created_at), "PPP") },
          ],
          details: [
            { label: "Request #", value: request.request_number },
            { label: "Category", value: `${request.expense_categories.code} — ${request.expense_categories.name}` },
            { label: "Priority", value: getPriorityBadge(request.priority) },
            { label: "Description", value: request.description },
            { label: "Justification", value: request.justification },
            { label: "Service", value: request.services?.name || "—" },
          ],
          actions: (
            <>
              <Button variant={selectedIds.includes(request.id) ? "default" : "outline"} onClick={() => toggleSelection(request.id)}>
                {selectedIds.includes(request.id) ? "Selected" : "Select"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate(`/admin/expenses/${request.id}`)}>
                <Eye className="mr-1 h-4 w-4" />
                View Details
              </Button>
              <Button size="sm" onClick={() => openApprovalDialog(request, "approve", false)}>
                <CheckCircle className="mr-1 h-4 w-4" />
                Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => openApprovalDialog(request, "reject", false)}>
                <XCircle className="mr-1 h-4 w-4" />
                Reject
              </Button>
              <Button size="sm" variant="outline" onClick={() => openApprovalDialog(request, "changes", false)}>
                <AlertCircle className="mr-1 h-4 w-4" />
                Request Changes
              </Button>
            </>
          ),
        };
      }),
    [filteredRequests, navigate, selectedIds],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading pending approvals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pending Approvals</h1>
          <p className="text-muted-foreground">Review and approve expense requests</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Requests Awaiting Approval ({filteredRequests.length})</CardTitle>
            <CardDescription>Review details and approve or reject expense requests</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <BulkActionBar
              selectedCount={selectedIds.length}
              onSelectAll={toggleSelectAllFiltered}
              onClearSelection={() => setSelectedIds([])}
              actions={[
                {
                  label: "Approve Selected",
                  icon: CheckCircle,
                  onClick: () => openApprovalDialog(null, "approve", true),
                  variant: "default",
                },
                {
                  label: "Reject Selected",
                  icon: XCircle,
                  onClick: () => openApprovalDialog(null, "reject", true),
                  variant: "destructive",
                },
                {
                  label: "Request Changes",
                  icon: AlertCircle,
                  onClick: () => openApprovalDialog(null, "changes", true),
                  variant: "outline",
                },
              ]}
            />

            <ResponsiveDataView
              columns={["Select", "Request #", "Requester", "Category", "Description", "Amount", "Priority", "Date"]}
              rows={rows}
              controls={
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search by request, person, category, description"
                      className="pl-9"
                    />
                  </div>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-full md:w-[220px]">
                      <SelectValue placeholder="Filter by priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              }
              emptyState={
                <div className="py-12 text-center">
                  <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
                  <p className="text-muted-foreground">No pending approvals</p>
                </div>
              }
            />
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {action === "approve" ? "Approve" : action === "reject" ? "Reject" : "Request Changes"}
                {bulkAction && ` ${selectedIds.length} Request${selectedIds.length !== 1 ? "s" : ""}`}
              </DialogTitle>
              <DialogDescription>
                {!bulkAction &&
                  selectedRequest &&
                  `${selectedRequest.expense_categories.code} - ${formatAmount(selectedRequest.amount, selectedRequest.currency)}`}
                {bulkAction && `You are about to ${action} ${selectedIds.length} expense request${selectedIds.length !== 1 ? "s" : ""}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="comments">{action === "reject" ? "Reason for Rejection *" : "Comments (Optional)"}</Label>
                <Textarea
                  id="comments"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder={action === "reject" ? "Explain why this request is being rejected" : "Add any comments or feedback"}
                  rows={4}
                  required={action === "reject"}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={processing}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleApproval}
                disabled={processing || (action === "reject" && !comments)}
                variant={action === "approve" ? "default" : "destructive"}
              >
                {processing ? "Processing..." : action === "approve" ? "Approve" : action === "reject" ? "Reject" : "Request Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
