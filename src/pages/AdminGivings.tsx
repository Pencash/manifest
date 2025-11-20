import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { hasAdminAccess } from "@/lib/roles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { DollarSign, Download } from "lucide-react";
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
  created_at: string;
  profiles: { full_name: string; email: string };
  giving_types: { name: string };
  services: { name: string; service_date: string } | null;
  receipts: Array<{ verification_status: string }>;
}

const statusColors = {
  pending: "secondary",
  verified: "default",
  rejected: "destructive",
} as const;

const verificationColors = {
  pending: "secondary",
  verified: "default",
  rejected: "destructive",
  none: "outline",
} as const;

export default function AdminGivings() {
  const navigate = useNavigate();
  const [givings, setGivings] = useState<Giving[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [stats, setStats] = useState({
    total: 0,
    verified: 0,
    pending: 0,
    rejected: 0,
  });

  useEffect(() => {
    checkAuth();
  }, []);

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
          services(name, service_date),
          receipts(verification_status)
        `)
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch profile data separately for each giving
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

      // Calculate stats
      const allData = await supabase
        .from("givings")
        .select("amount, status");

      if (allData.data) {
        const total = allData.data.reduce((sum, g) => sum + Number(g.amount), 0);
        const verified = allData.data
          .filter(g => g.status === "verified")
          .reduce((sum, g) => sum + Number(g.amount), 0);
        const pending = allData.data
          .filter(g => g.status === "pending")
          .reduce((sum, g) => sum + Number(g.amount), 0);
        const rejected = allData.data
          .filter(g => g.status === "rejected")
          .reduce((sum, g) => sum + Number(g.amount), 0);

        setStats({ total, verified, pending, rejected });
      }
    } catch (error: any) {
      toast.error("Failed to load givings");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) loadGivings();
  }, [filterStatus]);

  const exportToExcel = () => {
    const exportData = givings.map(giving => ({
      "Date": format(new Date(giving.created_at), "dd MMM yyyy HH:mm"),
      "Giver": giving.profiles.full_name,
      "Email": giving.profiles.email,
      "Type": giving.giving_types.name,
      "Service": giving.services?.name || "N/A",
      "Amount": `${giving.currency} ${giving.amount}`,
      "Payment Method": giving.payment_method.replace("_", " ").toUpperCase(),
      "Reference": giving.payment_reference || "N/A",
      "Status": giving.status.toUpperCase(),
      "Receipt Status": giving.receipts[0]?.verification_status.toUpperCase() || "NONE",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Givings");
    XLSX.writeFile(wb, `givings-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("Exported to Excel");
  };

  const getStatusBadge = (status: string) => {
    const variant = statusColors[status as keyof typeof statusColors] || "secondary";
    return (
      <Badge variant={variant}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getReceiptBadge = (receipts: Array<{ verification_status: string }>) => {
    if (!receipts || receipts.length === 0) {
      return <Badge variant="outline">NO RECEIPT</Badge>;
    }
    const status = receipts[0].verification_status;
    const variant = verificationColors[status as keyof typeof verificationColors] || "secondary";
    return (
      <Badge variant={variant}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading givings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">All Givings</h1>
          <p className="text-muted-foreground">View and manage all church givings</p>
        </div>
        <Button onClick={exportToExcel} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Givings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">MWK {stats.total.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Verified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">MWK {stats.verified.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">MWK {stats.pending.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">MWK {stats.rejected.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Giving Records</CardTitle>
              <CardDescription>
                {givings.length} total record{givings.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {givings.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No givings found</p>
              <p className="text-muted-foreground">
                {filterStatus === "all" 
                  ? "No givings have been recorded yet" 
                  : `No givings with status: ${filterStatus}`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Giver</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {givings.map((giving) => (
                    <TableRow key={giving.id}>
                      <TableCell className="text-sm">
                        {format(new Date(giving.created_at), "dd MMM yyyy")}
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(giving.created_at), "HH:mm")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{giving.profiles.full_name}</span>
                          <span className="text-xs text-muted-foreground">{giving.profiles.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>{giving.giving_types.name}</TableCell>
                      <TableCell>
                        {giving.services ? (
                          <div className="flex flex-col">
                            <span className="text-sm">{giving.services.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(giving.services.service_date), "dd MMM yyyy")}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">General</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {giving.currency} {giving.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{giving.payment_method.replace("_", " ").toUpperCase()}</span>
                          {giving.payment_reference && (
                            <span className="text-xs text-muted-foreground">{giving.payment_reference}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(giving.status)}</TableCell>
                      <TableCell>{getReceiptBadge(giving.receipts)}</TableCell>
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
