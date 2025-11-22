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
import { Plus, FileText, Download } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { formatAmount } from "@/lib/utils";

interface ExpenseRequest {
  id: string;
  request_number: string | null;
  amount: number;
  currency: string;
  description: string;
  priority: string;
  status: string;
  created_at: string;
  expense_categories: { name: string; code: string };
  services: { name: string } | null;
  profiles: { full_name: string; email: string };
}

const statusColors = {
  draft: "secondary",
  pending: "default",
  approved: "default",
  rejected: "destructive",
  changes_requested: "secondary",
  paid: "default",
  cancelled: "secondary",
} as const;

const priorityColors = {
  low: "secondary",
  medium: "default",
  high: "secondary",
  urgent: "destructive",
} as const;

export default function AdminExpenseRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/admin/auth");
      return;
    }

    // Check admin access
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", session.user.id)
      .single();

    if (!profile) {
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

    loadRequests();
  };

  const loadRequests = async () => {
    try {
      let query = supabase
        .from("expense_requests")
        .select(`
          *,
          expense_categories(name, code),
          services(name)
        `)
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch profile data separately for each request
      if (data) {
        const requestsWithProfiles = await Promise.all(
          data.map(async (req) => {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("id", req.requester_id)
              .single();

            return {
              ...req,
              profiles: profile || { full_name: "Unknown", email: "N/A" },
            };
          })
        );
        setRequests(requestsWithProfiles as any);
      }
    } catch (error: any) {
      toast.error("Failed to load expense requests");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) loadRequests();
  }, [filterStatus]);

  const exportToExcel = () => {
    const exportData = requests.map(req => ({
      "Request #": req.request_number || "Draft",
      "Requester": req.profiles.full_name,
      "Email": req.profiles.email,
      "Category": req.expense_categories.name,
      "Service": req.services?.name || "N/A",
      "Amount": `${req.currency} ${req.amount}`,
      "Priority": req.priority.toUpperCase(),
      "Status": req.status.toUpperCase(),
      "Description": req.description,
      "Created": format(new Date(req.created_at), "dd MMM yyyy"),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expense Requests");
    XLSX.writeFile(wb, `expense-requests-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("Exported to Excel");
  };

  const getStatusBadge = (status: string) => {
    const variant = statusColors[status as keyof typeof statusColors] || "secondary";
    return (
      <Badge variant={variant}>
        {status.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const variant = priorityColors[priority as keyof typeof priorityColors] || "secondary";
    return (
      <Badge variant={variant}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">All Expense Requests</h1>
          <p className="text-muted-foreground">View and manage all expense requests</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToExcel} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => navigate("/admin/expenses/request")}>
            <Plus className="h-4 w-4 mr-2" />
            New Request
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Expense Requests</CardTitle>
              <CardDescription>
                {requests.length} total request{requests.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="changes_requested">Changes Requested</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No requests found</p>
              <p className="text-muted-foreground mb-4">
                {filterStatus === "all" 
                  ? "Get started by creating your first expense request" 
                  : `No requests with status: ${filterStatus}`}
              </p>
              <Button onClick={() => navigate("/admin/expenses/request")}>
                <Plus className="h-4 w-4 mr-2" />
                Create Request
              </Button>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        {request.request_number || (
                          <Badge variant="secondary">Draft</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{request.profiles.full_name}</span>
                          <span className="text-xs text-muted-foreground">{request.profiles.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{request.expense_categories.name}</span>
                          {request.services && (
                            <span className="text-xs text-muted-foreground">
                              {request.services.name}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {request.description}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatAmount(request.amount, request.currency)}
                      </TableCell>
                      <TableCell>{getPriorityBadge(request.priority)}</TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(request.created_at), "dd MMM yyyy")}
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
  );
}
