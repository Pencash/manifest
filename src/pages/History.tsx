import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUserRole } from "@/hooks/useUserRole";
import type { Database } from "@/integrations/supabase/types";
import { formatAmount } from "@/lib/utils";
import * as XLSX from "xlsx";
import { toast } from "sonner";

type AppRole = Database["public"]["Enums"]["app_role"];

const History = () => {
  const [givings, setGivings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const { role: userRole, loading: roleLoading } = useUserRole(userId);
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/member/auth");
        return;
      }
      setUserId(session.user.id);
    };
    init();
  }, [navigate]);

  useEffect(() => {
    // Only load givings after we know the user's role
    if (userId && !roleLoading) {
      loadGivings();
    }
  }, [userId, roleLoading]);

  const loadGivings = async () => {
    try {
      if (!userId) return;

      // Always show only the current user's givings on this page
      // Admins use /admin/givings to view all records
      const { data, error } = await supabase
        .from("givings")
        .select(`
          *,
          giving_types(name),
          services(name, service_date),
          profiles(full_name, email)
        `)
        .eq("profile_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGivings(data || []);
    } catch (error) {
      console.error("Error loading givings:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "verified":
        return "bg-green-500/10 text-green-700 dark:text-green-400";
      case "pending":
        return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
      case "rejected":
        return "bg-red-500/10 text-red-700 dark:text-red-400";
      default:
        return "bg-gray-500/10 text-gray-700 dark:text-gray-400";
    }
  };

  const exportToExcel = async () => {
    try {
      toast.loading("Preparing export...");
      
      const { data: givingsData } = await supabase
        .from("givings")
        .select(`
          *,
          giving_types(name),
          services(name, service_date)
        `)
        .eq('profile_id', userId)
        .order('created_at', { ascending: false });

      const givingsSheet = givingsData?.map(g => ({
        'Date': new Date(g.created_at).toLocaleDateString(),
        'Type': g.giving_types?.name || 'N/A',
        'Amount': g.amount,
        'Currency': g.currency,
        'Payment Method': g.payment_method,
        'Reference': g.payment_reference || 'N/A',
        'Service': g.services?.name || 'N/A',
        'Status': g.status,
      })) || [];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(givingsSheet);
      
      XLSX.utils.book_append_sheet(wb, ws, "Giving History");
      XLSX.writeFile(wb, `my_giving_history_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast.dismiss();
      toast.success("Export completed successfully!");
    } catch (error: any) {
      toast.dismiss();
      console.error("Error exporting data:", error);
      toast.error("Failed to export data");
    }
  };

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">My Giving History</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                This is your personal giving history. Track your contributions and payment verification status.
              </p>
            </div>
            <Button variant="outline" onClick={exportToExcel} disabled={givings.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Download Excel
            </Button>
          </div>
        </CardHeader>
          <CardContent>
            {givings.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No giving records yet
                </p>
                <Button onClick={() => navigate("/give")}>
                  Record Your First Giving
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {givings.map((giving) => (
                      <TableRow key={giving.id}>
                        <TableCell>
                          {new Date(giving.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {giving.giving_types?.name}
                            {giving.is_anonymous && (
                              <Badge variant="outline" className="text-xs">
                                Anonymous
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {giving.services ? (
                            <>
                              {giving.services.name}
                              <br />
                              <span className="text-xs text-muted-foreground">
                                {new Date(giving.services.service_date).toLocaleDateString()}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatAmount(parseFloat(giving.amount), giving.currency)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="capitalize">{giving.payment_method?.replace('_', ' ')}</span>
                            {giving.payment_reference && (
                              <span className="text-xs text-muted-foreground">
                                Ref: {giving.payment_reference}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(giving.status)}>
                            {giving.status}
                          </Badge>
                          {giving.status === 'rejected' && giving.rejection_reason && (
                            <div className="text-xs text-destructive mt-1">
                              {giving.rejection_reason}
                            </div>
                          )}
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
};

export default History;
