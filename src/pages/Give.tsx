import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { ServiceSelector } from "@/components/ServiceSelector";

const givingSchema = z.object({
  givingTypeId: z.string().min(1, "Please select a giving type"),
  amount: z.string().min(1, "Amount is required").refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Amount must be a positive number"),
  paymentMethod: z.string().min(1, "Please select a payment method"),
  paymentReference: z.string().optional(),
}).refine((data) => {
  // If payment method is mobile_money, payment reference is required
  if (data.paymentMethod === "mobile_money" && (!data.paymentReference || data.paymentReference.length < 6)) {
    return false;
  }
  return true;
}, {
  message: "Payment reference is required for mobile money payments (minimum 6 characters)",
  path: ["paymentReference"],
});

const Give = () => {
  const [givingTypes, setGivingTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedServiceName, setSelectedServiceName] = useState("");
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    givingTypeId: "",
    serviceId: "",
    amount: "",
    paymentMethod: "",
    paymentReference: "",
    note: "",
    isAnonymous: false,
  });

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/member/auth");
    }
  };

  const loadData = async () => {
    const { data: typesRes } = await supabase
      .from("giving_types")
      .select("*")
      .eq("is_active", true);

    if (typesRes) setGivingTypes(typesRes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form data
    try {
      givingSchema.parse({
        givingTypeId: formData.givingTypeId,
        amount: formData.amount,
        paymentMethod: formData.paymentMethod,
        paymentReference: formData.paymentReference,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { data: giving, error: givingError } = await supabase
        .from("givings")
        .insert({
          profile_id: profile.id,
          giving_type_id: formData.givingTypeId,
          service_id: selectedServiceId || null,
          amount: parseFloat(formData.amount),
          payment_method: formData.paymentMethod,
          payment_reference: formData.paymentReference || null,
          note: formData.note || null,
          is_anonymous: formData.isAnonymous,
        })
        .select()
        .single();

      if (givingError) throw givingError;

      if (receiptFile && giving) {
        const fileExt = receiptFile.name.split(".").pop();
        const fileName = `${giving.id}/${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("receipts")
          .upload(filePath, receiptFile);

        if (uploadError) throw uploadError;

        const { error: receiptError } = await supabase
          .from("receipts")
          .insert({
            giving_id: giving.id,
            storage_path: filePath,
          });

        if (receiptError) throw receiptError;
      }

      toast.success("Giving recorded successfully!");
      
      setFormData({
        givingTypeId: "",
        serviceId: "",
        amount: "",
        paymentMethod: "",
        paymentReference: "",
        note: "",
        isAnonymous: false,
      });
      setReceiptFile(null);

      setTimeout(() => navigate("/history"), 1500);
    } catch (error: any) {
      console.error("Error recording giving:", error);
      toast.error(error.message || "Failed to record giving");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
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
            <CardTitle className="text-2xl">Record a Giving</CardTitle>
            <CardDescription>
              Record your tithes, offerings, and other contributions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information Section */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <h3 className="font-semibold text-lg">Basic Information</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="givingType">Giving Type *</Label>
                  <Select
                    value={formData.givingTypeId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, givingTypeId: value })
                    }
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select giving type" />
                    </SelectTrigger>
                    <SelectContent>
                      {givingTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">Choose the type of contribution</p>
                </div>

                <div className="space-y-4">
                  <ServiceSelector
                    onServiceSelect={(serviceId, serviceName) => {
                      setSelectedServiceId(serviceId);
                      setSelectedServiceName(serviceName);
                      setFormData({ ...formData, serviceId });
                    }}
                    selectedServiceId={selectedServiceId}
                  />
                  {selectedServiceName && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {selectedServiceName}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (MWK) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    required
                    className="bg-background"
                  />
                  <p className="text-sm text-muted-foreground">Enter the amount in Malawian Kwacha</p>
                </div>
              </div>

              {/* Payment Details Section */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <h3 className="font-semibold text-lg">Payment Details</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Payment Method *</Label>
                  <Select
                    value={formData.paymentMethod}
                    onValueChange={(value) =>
                      setFormData({ ...formData, paymentMethod: value })
                    }
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">How did you make the payment?</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentReference">
                    Payment Reference/Transaction ID {formData.paymentMethod === "mobile_money" && (<span className="text-destructive">*</span>)}
                  </Label>
                  <Input
                    id="paymentReference"
                    placeholder="e.g., ABC123XYZ"
                    value={formData.paymentReference}
                    onChange={(e) =>
                      setFormData({ ...formData, paymentReference: e.target.value })
                    }
                    required={formData.paymentMethod === "mobile_money"}
                    minLength={formData.paymentMethod === "mobile_money" ? 6 : undefined}
                    className="bg-background font-mono"
                  />
                  <p className="text-sm text-muted-foreground">
                    {formData.paymentMethod === "mobile_money" 
                      ? "Required: Enter your mobile money transaction reference (minimum 6 characters)"
                      : "Optional: Transaction reference or code"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="receipt">Upload Receipt (Optional)</Label>
                  <Input
                    id="receipt"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                    className="bg-background"
                  />
                  <p className="text-sm text-muted-foreground">Upload proof of payment</p>
                </div>
              </div>

              {/* Additional Information Section */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <h3 className="font-semibold text-lg">Additional Information</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="note">Note (Optional)</Label>
                  <Textarea
                    id="note"
                    placeholder="Add any additional notes or comments"
                    value={formData.note}
                    onChange={(e) =>
                      setFormData({ ...formData, note: e.target.value })
                    }
                    className="bg-background min-h-[100px]"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="anonymous"
                    checked={formData.isAnonymous}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isAnonymous: checked === true })
                    }
                  />
                  <Label htmlFor="anonymous" className="cursor-pointer">
                    Make this contribution anonymous
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground">Your identity will be hidden from public records</p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Recording..." : "Submit Giving"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Give;
