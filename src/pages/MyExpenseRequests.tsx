import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, FileText } from "lucide-react";
import { format } from "date-fns";

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

export default function MyExpenseRequests() {
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
      navigate("/auth");
      return;
    }
    loadRequests();
  };

  const loadRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("expense_requests")
        .select(`
          *,
          expense_categories(name, code),
          services(name)
        `)
        .eq("requester_id", user.id)
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRequests(data || []);
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Expense Requests</h1>
            <p className="text-muted-foreground">View and manage your expense requests</p>
          </div>
          <Button onClick={() => navigate("/expenses/request")}>
            <Plus className="h-4 w-4 mr-2" />
            New Request
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Requests</CardTitle>
                <CardDescription>Track the status of your expense requests</CardDescription>
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
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No expense requests found</p>
                <Button variant="outline" className="mt-4" onClick={() => navigate("/expenses/request")}>
                  Create Your First Request
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request #</TableHead>
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
                      <TableCell className="font-mono text-sm">
                        {request.request_number || "DRAFT"}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{request.expense_categories.code}</div>
                        <div className="text-xs text-muted-foreground">{request.expense_categories.name}</div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="font-medium truncate">{request.description}</div>
                        {request.services && (
                          <div className="text-xs text-muted-foreground">{request.services.name}</div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono">
                        {request.currency} {request.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>{getPriorityBadge(request.priority)}</TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(request.created_at), "PPP")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
