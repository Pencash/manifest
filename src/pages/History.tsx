import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
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
        return "bg-secondary text-secondary-foreground";
      case "pending":
        return "bg-yellow-500 text-white";
      case "rejected":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted text-muted-foreground";
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
            <CardTitle className="text-2xl">My Giving History</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              This is your personal giving history. Track your contributions and payment verification status.
            </p>
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
                          {giving.currency} {parseFloat(giving.amount).toLocaleString()}
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
