import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, XCircle, FileText, CreditCard } from "lucide-react";
import { format } from "date-fns";

interface PendingGiving {
  id: string;
  amount: number;
  payment_method: string;
  payment_reference: string | null;
  created_at: string;
  status: string;
  profiles: {
    full_name: string;
    email: string;
  };
  giving_types: {
    name: string;
  };
  receipts?: Array<{
    id: string;
    storage_path: string;
    verification_status: string;
    parsed_amount: number | null;
    parsed_date: string | null;
  }>;
}

const PendingVerifications = () => {
  const navigate = useNavigate();
  const [pendingGivings, setPendingGivings] = useState<PendingGiving[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | undefined>();
  const { role, loading: roleLoading } = useUserRole(userId);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verificationNotes, setVerificationNotes] = useState("");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/admin/auth");
      return;
    }
    setUserId(session.user.id);
  };

  useEffect(() => {
    if (!roleLoading && role !== "admin" && role !== "finance") {
      toast.error("Access denied. Finance or Admin role required.");
      navigate("/admin/dashboard");
      return;
    }

    if (!roleLoading && (role === "admin" || role === "finance")) {
      loadPendingVerifications();
    }
  }, [role, roleLoading]);

  const loadPendingVerifications = async () => {
    setLoading(true);

    // Get givings that have either:
    // 1. A receipt with pending verification status
    // 2. A payment_reference (mobile money) with pending status
    const { data, error } = await supabase
      .from("givings")
      .select(`
        id,
        amount,
        payment_method,
        payment_reference,
        created_at,
        status,
        profiles!givings_profile_id_fkey(full_name, email),
        giving_types(name),
        receipts(id, storage_path, verification_status, parsed_amount, parsed_date)
      `)
      .or("status.eq.pending,receipts.verification_status.eq.pending")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load pending verifications");
      setLoading(false);
      return;
    }

    // Filter to only include givings that actually need verification
    const filtered = data?.filter((giving: any) => {
      const hasUploadedReceipt = giving.receipts?.some((r: any) => r.verification_status === "pending");
      const hasPendingMobilePayment = giving.payment_method === "mobile_money" && giving.payment_reference && giving.status === "pending";
      return hasUploadedReceipt || hasPendingMobilePayment;
    }) || [];

    setPendingGivings(filtered);
    setLoading(false);
  };

  const handleVerify = async (givingId: string, receiptId: string | null, approved: boolean) => {
    setVerifyingId(givingId);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // If there's a receipt, update it
      if (receiptId) {
        const { error: receiptError } = await supabase
          .from("receipts")
          .update({
            verification_status: approved ? "approved" : "rejected",
            verified_by: user.id,
            verified_at: new Date().toISOString(),
            verification_notes: verificationNotes || null,
          })
          .eq("id", receiptId);

        if (receiptError) throw receiptError;
      }

      // Update giving status
      const { error: givingError } = await supabase
        .from("givings")
        .update({
          status: approved ? "verified" : "rejected",
        })
        .eq("id", givingId);

      if (givingError) throw givingError;

      toast.success(approved ? "Giving approved!" : "Giving rejected");
      setVerificationNotes("");
      loadPendingVerifications();
    } catch (error: any) {
      toast.error(error.message || "Failed to verify giving");
    } finally {
      setVerifyingId(null);
    }
  };

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/admin/dashboard")} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Pending Verifications</CardTitle>
            <CardDescription>
              Review and verify givings with receipts or mobile money payment references
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingGivings.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
                <p className="text-muted-foreground">No pending verifications! All caught up.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingGivings.map((giving) => {
                  const hasReceipt = giving.receipts && giving.receipts.length > 0;
                  const pendingReceipt = giving.receipts?.find((r) => r.verification_status === "pending");

                  return (
                    <Card key={giving.id} className="bg-gradient-to-r from-yellow-500/5 to-transparent">
                      <CardContent className="p-6 space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              {hasReceipt ? (
                                <FileText className="w-5 h-5 text-blue-500" />
                              ) : (
                                <CreditCard className="w-5 h-5 text-purple-500" />
                              )}
                              <h3 className="font-semibold text-lg">{giving.profiles.full_name}</h3>
                              <Badge variant="outline">{giving.giving_types.name}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>Amount: MWK {giving.amount.toLocaleString()}</p>
                              <p>Payment Method: {giving.payment_method.replace("_", " ")}</p>
                              {giving.payment_reference && (
                                <p className="flex items-center gap-1">
                                  <CreditCard className="w-4 h-4" />
                                  Reference: <span className="font-mono font-semibold">{giving.payment_reference}</span>
                                </p>
                              )}
                              <p>Submitted: {format(new Date(giving.created_at), "MMM d, yyyy h:mm a")}</p>
                            </div>
                            {hasReceipt && pendingReceipt && (
                              <div className="mt-2">
                                <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-300">
                                  Has Uploaded Receipt
                                </Badge>
                              </div>
                            )}
                            {!hasReceipt && giving.payment_reference && (
                              <div className="mt-2">
                                <Badge className="bg-purple-500/10 text-purple-700 dark:text-purple-300">
                                  Mobile Money Payment
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Verification Notes (Optional)</label>
                          <Textarea
                            placeholder="Add any notes about this verification..."
                            value={verifyingId === giving.id ? verificationNotes : ""}
                            onChange={(e) => {
                              setVerifyingId(giving.id);
                              setVerificationNotes(e.target.value);
                            }}
                            rows={2}
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            onClick={() => handleVerify(giving.id, pendingReceipt?.id || null, true)}
                            disabled={verifyingId === giving.id}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            className="flex-1"
                            onClick={() => handleVerify(giving.id, pendingReceipt?.id || null, false)}
                            disabled={verifyingId === giving.id}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PendingVerifications;