import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { hasAdminAccess } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";

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
  profiles: { full_name: string; email: string };
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
      const { data: requestsData, error } = await supabase
        .from("expense_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch related data separately
      const requestsWithProfiles = await Promise.all(
        (requestsData || []).map(async (req) => {
          const [profileRes, categoryRes, serviceRes] = await Promise.all([
            supabase.from("profiles").select("full_name, email").eq("id", req.requester_id).single(),
            supabase.from("expense_categories").select("name, code").eq("id", req.category_id).single(),
            req.service_id ? supabase.from("services").select("name").eq("id", req.service_id).maybeSingle() : Promise.resolve({ data: null })
          ]);

          return {
            ...req,
            profiles: profileRes.data || { full_name: "Unknown", email: "" },
            expense_categories: categoryRes.data || { name: "Unknown", code: "" },
            services: serviceRes.data
          };
        })
      );

      setRequests(requestsWithProfiles);
    } catch (error: any) {
      toast.error("Failed to load pending requests");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openApprovalDialog = (request: ExpenseRequest, approvalAction: "approve" | "reject" | "changes") => {
    setSelectedRequest(request);
    setAction(approvalAction);
    setComments("");
    setDialogOpen(true);
  };

  const handleApproval = async () => {
    if (!selectedRequest) return;
    setProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if user is main admin for approval action
      if (action === "approve") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", user.id)
          .single();

        if (profile?.email !== "pnderitu2@gmail.com") {
          toast.error("Only the main administrator (pnderitu2@gmail.com) can approve expense requests.");
          setProcessing(false);
          return;
        }
      }

      const newStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "changes_requested";

      // Update expense request status
      const { error: updateError } = await supabase
        .from("expense_requests")
        .update({
          status: newStatus,
          rejection_reason: action === "reject" ? comments : null,
        })
        .eq("id", selectedRequest.id);

      if (updateError) throw updateError;

      // Log approval action
      const { error: approvalError } = await supabase
        .from("expense_approvals")
        .insert({
          expense_request_id: selectedRequest.id,
          approver_id: user.id,
          action: action === "approve" ? "approved" : action === "reject" ? "rejected" : "changes_requested",
          comments: comments || null,
        });

      if (approvalError) throw approvalError;

      toast.success(`Request ${newStatus.replace("_", " ")}`);
      setDialogOpen(false);
      loadRequests();
    } catch (error: any) {
      toast.error(error.message || "Failed to process approval");
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: "secondary",
      medium: "default",
      high: "secondary",
      urgent: "destructive",
    } as const;
    return (
      <Badge variant={colors[priority as keyof typeof colors] || "secondary"}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

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
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pending Approvals</h1>
          <p className="text-muted-foreground">Review and approve expense requests</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Requests Awaiting Approval ({requests.length})</CardTitle>
            <CardDescription>Review details and approve or reject expense requests</CardDescription>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-muted-foreground">No pending approvals</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request #</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-mono text-sm">{request.request_number}</TableCell>
                      <TableCell>
                        <div className="font-medium">{request.profiles.full_name}</div>
                        <div className="text-xs text-muted-foreground">{request.profiles.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{request.expense_categories.code}</div>
                        <div className="text-xs text-muted-foreground">{request.expense_categories.name}</div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="font-medium">{request.description}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{request.justification}</div>
                      </TableCell>
                      <TableCell className="font-mono">
                        {request.currency} {request.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>{getPriorityBadge(request.priority)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(request.created_at), "PPP")}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => openApprovalDialog(request, "approve")}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openApprovalDialog(request, "reject")}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openApprovalDialog(request, "changes")}
                        >
                          <AlertCircle className="h-4 w-4 mr-1" />
                          Request Changes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {action === "approve" ? "Approve" : action === "reject" ? "Reject" : "Request Changes"}
              </DialogTitle>
              <DialogDescription>
                {selectedRequest && `${selectedRequest.expense_categories.code} - ${selectedRequest.currency} ${selectedRequest.amount.toLocaleString()}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="comments">
                  {action === "reject" ? "Reason for Rejection *" : "Comments (Optional)"}
                </Label>
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
