import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileCheck, FileX } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReceiptUpload } from "@/components/ReceiptUpload";
import { useUserRole } from "@/hooks/useUserRole";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const History = () => {
  const [givings, setGivings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const { role: userRole } = useUserRole(userId);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    loadGivings();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/member/auth");
    }
  };

  const loadGivings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      // Finance and admin can see all givings, but with privacy protection
      const isFinanceOrAdmin = userRole === 'finance' || userRole === 'admin';
      
      let query = supabase
        .from("givings")
        .select(`
          *,
          giving_types(name),
          services(name, service_date),
          profiles(full_name, email),
          receipts(id, verification_status)
        `)
        .order("created_at", { ascending: false });

      // Regular members only see their own givings
      if (!isFinanceOrAdmin) {
        query = query.eq("profile_id", user.id);
      }

      const { data, error } = await query;

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

  if (loading) {
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
            <CardTitle className="text-2xl">
              {userRole === 'finance' || userRole === 'admin' 
                ? 'All Givings (Finance View)' 
                : 'Giving History'}
            </CardTitle>
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
                      {(userRole === 'finance' || userRole === 'admin') && (
                        <TableHead>Donor</TableHead>
                      )}
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Receipt</TableHead>
                      <TableHead>Actions</TableHead>
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
                        {(userRole === 'finance' || userRole === 'admin') && (
                          <TableCell>
                            {giving.is_anonymous ? (
                              <span className="text-muted-foreground italic">
                                Anonymous Donor
                              </span>
                            ) : (
                              <div>
                                <div className="font-medium">
                                  {giving.profiles?.full_name || 'Unknown'}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {giving.profiles?.email}
                                </div>
                              </div>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="font-semibold">
                          {giving.currency} {parseFloat(giving.amount).toLocaleString()}
                        </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(giving.status)}>
                      {giving.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {giving.receipts && giving.receipts.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <FileCheck className="h-4 w-4 text-green-600" />
                        <Badge variant={
                          giving.receipts[0].verification_status === 'approved' ? 'default' :
                          giving.receipts[0].verification_status === 'rejected' ? 'destructive' :
                          'secondary'
                        }>
                          {giving.receipts[0].verification_status}
                        </Badge>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <FileX className="h-4 w-4" />
                        <span className="text-sm">No receipt</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {(!giving.receipts || giving.receipts.length === 0) && (
                      <ReceiptUpload 
                        givingId={giving.id} 
                        onSuccess={loadGivings}
                      />
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
