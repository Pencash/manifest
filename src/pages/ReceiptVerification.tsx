import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { ArrowLeft, CheckCircle, XCircle, Eye, FileText } from "lucide-react";
import { format } from "date-fns";

interface Receipt {
  id: string;
  giving_id: string;
  storage_path: string;
  parsed_amount: number | null;
  parsed_currency: string | null;
  parsed_reference: string | null;
  parsed_date: string | null;
  parse_status: string;
  verification_status: string;
  verification_notes: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  givings: {
    amount: number;
    currency: string;
    payment_method: string;
    payment_reference: string | null;
    created_at: string;
    profiles: {
      full_name: string;
      email: string;
    } | null;
    giving_types: {
      name: string;
    } | null;
  } | null;
}

const ReceiptVerification = () => {
  const [user, setUser] = useState<User | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [verificationNotes, setVerificationNotes] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const navigate = useNavigate();

  useEffect(() => {
    checkUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      
      setUser(session.user);
      
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error) throw error;
      
      if (profileData.role !== 'admin' && profileData.role !== 'finance') {
        toast.error("Access denied. Finance or admin privileges required.");
        navigate("/dashboard");
        return;
      }
      
      await loadReceipts();
    } catch (error: any) {
      console.error("Error loading profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const loadReceipts = async () => {
    try {
      const { data, error } = await supabase
        .from("receipts")
        .select(`
          *,
          givings (
            amount,
            currency,
            payment_method,
            payment_reference,
            created_at,
            profiles (full_name, email),
            giving_types (name)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReceipts(data || []);
    } catch (error: any) {
      console.error("Error loading receipts:", error);
      toast.error("Failed to load receipts");
    }
  };

  const handleVerify = async (receiptId: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from("receipts")
        .update({
          verification_status: status,
          verification_notes: verificationNotes || null,
          verified_by: user?.id,
          verified_at: new Date().toISOString(),
        })
        .eq('id', receiptId);

      if (error) throw error;

      toast.success(`Receipt ${status === 'approved' ? 'approved' : 'rejected'} successfully!`);
      setSelectedReceipt(null);
      setVerificationNotes("");
      await loadReceipts();
    } catch (error: any) {
      console.error("Error verifying receipt:", error);
      toast.error("Failed to verify receipt");
    }
  };

  const viewReceipt = async (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setVerificationNotes(receipt.verification_notes || "");
    
    try {
      const { data } = await supabase.storage
        .from('receipts')
        .createSignedUrl(receipt.storage_path, 3600);
      
      if (data?.signedUrl) {
        setImageUrl(data.signedUrl);
      }
    } catch (error) {
      console.error("Error loading receipt image:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500">Rejected</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500">Pending</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const filteredReceipts = receipts.filter(receipt => {
    if (filterStatus === 'all') return true;
    return receipt.verification_status === filterStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Receipt Verification</CardTitle>
            <CardDescription>
              Review and verify uploaded receipts from members
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 flex gap-2">
              <Button
                variant={filterStatus === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('all')}
              >
                All ({receipts.length})
              </Button>
              <Button
                variant={filterStatus === 'pending' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('pending')}
              >
                Pending ({receipts.filter(r => r.verification_status === 'pending').length})
              </Button>
              <Button
                variant={filterStatus === 'approved' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('approved')}
              >
                Approved ({receipts.filter(r => r.verification_status === 'approved').length})
              </Button>
              <Button
                variant={filterStatus === 'rejected' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('rejected')}
              >
                Rejected ({receipts.filter(r => r.verification_status === 'rejected').length})
              </Button>
            </div>

            {filteredReceipts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No receipts found for this filter</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredReceipts.map((receipt) => (
                  <Card key={receipt.id} className="border-l-4" style={{
                    borderLeftColor: 
                      receipt.verification_status === 'approved' ? '#22c55e' :
                      receipt.verification_status === 'rejected' ? '#ef4444' :
                      '#eab308'
                  }}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">
                              {receipt.givings?.profiles?.full_name || 'Unknown'}
                            </h3>
                            {getStatusBadge(receipt.verification_status)}
                          </div>
                          
                          <div className="grid md:grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Email:</span>{" "}
                              {receipt.givings?.profiles?.email || 'N/A'}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Type:</span>{" "}
                              {receipt.givings?.giving_types?.name || 'N/A'}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Amount:</span>{" "}
                              {receipt.givings?.currency} {receipt.givings?.amount.toLocaleString()}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Payment Method:</span>{" "}
                              {receipt.givings?.payment_method}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Submitted:</span>{" "}
                              {format(new Date(receipt.created_at), 'PPP')}
                            </div>
                            {receipt.verified_at && (
                              <div>
                                <span className="text-muted-foreground">Verified:</span>{" "}
                                {format(new Date(receipt.verified_at), 'PPP')}
                              </div>
                            )}
                          </div>

                          {receipt.verification_notes && (
                            <div className="mt-2 p-2 bg-muted rounded text-sm">
                              <span className="font-medium">Notes:</span> {receipt.verification_notes}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => viewReceipt(receipt)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedReceipt} onOpenChange={() => {
        setSelectedReceipt(null);
        setImageUrl(null);
        setVerificationNotes("");
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receipt Details</DialogTitle>
            <DialogDescription>
              Review receipt and add verification notes
            </DialogDescription>
          </DialogHeader>

          {selectedReceipt && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold">Giving Information</h4>
                  <div className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">Member:</span> {selectedReceipt.givings?.profiles?.full_name}</p>
                    <p><span className="text-muted-foreground">Amount:</span> {selectedReceipt.givings?.currency} {selectedReceipt.givings?.amount.toLocaleString()}</p>
                    <p><span className="text-muted-foreground">Type:</span> {selectedReceipt.givings?.giving_types?.name}</p>
                    <p><span className="text-muted-foreground">Payment Method:</span> {selectedReceipt.givings?.payment_method}</p>
                    {selectedReceipt.givings?.payment_reference && (
                      <p><span className="text-muted-foreground">Reference:</span> {selectedReceipt.givings.payment_reference}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold">Parsed Information</h4>
                  <div className="text-sm space-y-1">
                    {selectedReceipt.parsed_amount && (
                      <p><span className="text-muted-foreground">Parsed Amount:</span> {selectedReceipt.parsed_currency} {selectedReceipt.parsed_amount}</p>
                    )}
                    {selectedReceipt.parsed_reference && (
                      <p><span className="text-muted-foreground">Parsed Reference:</span> {selectedReceipt.parsed_reference}</p>
                    )}
                    {selectedReceipt.parsed_date && (
                      <p><span className="text-muted-foreground">Parsed Date:</span> {format(new Date(selectedReceipt.parsed_date), 'PPP')}</p>
                    )}
                    <p><span className="text-muted-foreground">Parse Status:</span> {selectedReceipt.parse_status}</p>
                  </div>
                </div>
              </div>

              {imageUrl && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <h4 className="font-semibold mb-2">Receipt Image</h4>
                  <img 
                    src={imageUrl} 
                    alt="Receipt" 
                    className="max-w-full h-auto rounded border"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Verification Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add notes about this receipt verification..."
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  className="min-h-[100px]"
                />
                <p className="text-sm text-muted-foreground">
                  These notes will be saved with the verification status
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {selectedReceipt?.verification_status === 'pending' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => selectedReceipt && handleVerify(selectedReceipt.id, 'rejected')}
                  className="border-red-500 text-red-500 hover:bg-red-50"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  onClick={() => selectedReceipt && handleVerify(selectedReceipt.id, 'approved')}
                  className="bg-green-500 hover:bg-green-600"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </>
            )}
            {selectedReceipt?.verification_status !== 'pending' && (
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedReceipt(null);
                  setImageUrl(null);
                  setVerificationNotes("");
                }}
              >
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReceiptVerification;
