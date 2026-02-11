import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Pencil } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

type AppRole = Database["public"]["Enums"]["app_role"];

type GivingRow = Database["public"]["Tables"]["givings"]["Row"] & {
  giving_types: { name: string } | null;
  services: { name: string; service_date: string } | null;
  profiles: { full_name: string; email: string | null } | null;
};

type GivingType = Pick<Database["public"]["Tables"]["giving_types"]["Row"], "id" | "name">;

interface EditGivingForm {
  givingTypeId: string;
  amount: string;
  paymentMethod: string;
  paymentReference: string;
  note: string;
  isAnonymous: boolean;
}

const History = () => {
  const [givings, setGivings] = useState<GivingRow[]>([]);
  const [givingTypes, setGivingTypes] = useState<GivingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingGiving, setEditingGiving] = useState<GivingRow | null>(null);
  const [editForm, setEditForm] = useState<EditGivingForm>({
    givingTypeId: "",
    amount: "",
    paymentMethod: "",
    paymentReference: "",
    note: "",
    isAnonymous: false,
  });
  const { role: userRole, loading: roleLoading } = useUserRole(userId);
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/member/auth");
        return;
      }
      setUserId(session.user.id);
    };
    init();
  }, [navigate]);

  useEffect(() => {
    if (userId && !roleLoading) {
      loadData();
    }
  }, [userId, roleLoading]);

  const loadData = async () => {
    try {
      if (!userId) return;

      const [givingsRes, typesRes] = await Promise.all([
        supabase
          .from("givings")
          .select(`
            *,
            giving_types(name),
            services(name, service_date),
            profiles(full_name, email)
          `)
          .eq("profile_id", userId)
          .order("created_at", { ascending: false }),
        supabase.from("giving_types").select("id, name").eq("is_active", true).order("name"),
      ]);

      if (givingsRes.error) throw givingsRes.error;
      if (typesRes.error) throw typesRes.error;

      setGivings((givingsRes.data || []) as GivingRow[]);
      setGivingTypes(typesRes.data || []);
    } catch (error) {
      console.error("Error loading givings:", error);
      toast.error("Failed to load giving history");
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

  const openEditDialog = (giving: GivingRow) => {
    if (giving.status === "verified") {
      toast.error("Verified givings cannot be edited");
      return;
    }

    setEditingGiving(giving);
    setEditForm({
      givingTypeId: giving.giving_type_id,
      amount: String(giving.amount),
      paymentMethod: giving.payment_method,
      paymentReference: giving.payment_reference || "",
      note: giving.note || "",
      isAnonymous: giving.is_anonymous,
    });
    setIsEditDialogOpen(true);
  };

  const validateEditForm = () => {
    const amountNum = Number(editForm.amount);
    if (!editForm.givingTypeId) {
      toast.error("Please select a giving type");
      return false;
    }
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error("Amount must be a positive number");
      return false;
    }
    if (!editForm.paymentMethod) {
      toast.error("Please select a payment method");
      return false;
    }

    if (
      (editForm.paymentMethod === "mobile_money" || editForm.paymentMethod === "bank_transfer") &&
      editForm.paymentReference.trim().length < 6
    ) {
      toast.error("Payment reference is required for mobile money/bank transfer (minimum 6 characters)");
      return false;
    }

    return true;
  };

  const handleUpdateGiving = async () => {
    if (!editingGiving || !userId) return;
    if (!validateEditForm()) return;

    try {
      setSaving(true);

      const { data, error } = await supabase
        .from("givings")
        .update({
          giving_type_id: editForm.givingTypeId,
          amount: Number(editForm.amount),
          payment_method: editForm.paymentMethod,
          payment_reference: editForm.paymentReference.trim() || null,
          note: editForm.note.trim() || null,
          is_anonymous: editForm.isAnonymous,
        })
        .eq("id", editingGiving.id)
        .eq("profile_id", userId)
        .neq("status", "verified")
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error("This giving can no longer be edited.");
        return;
      }

      toast.success("Giving updated successfully");
      setIsEditDialogOpen(false);
      setEditingGiving(null);
      await loadData();
    } catch (error: any) {
      console.error("Error updating giving:", error);
      toast.error(error.message || "Failed to update giving");
    } finally {
      setSaving(false);
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
        .eq("profile_id", userId)
        .order("created_at", { ascending: false });

      const givingsSheet =
        givingsData?.map((g) => ({
          Date: new Date(g.created_at).toLocaleDateString(),
          Type: g.giving_types?.name || "N/A",
          Amount: g.amount,
          Currency: g.currency,
          "Payment Method": g.payment_method,
          Reference: g.payment_reference || "N/A",
          Service: g.services?.name || "N/A",
          Status: g.status,
        })) || [];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(givingsSheet);

      XLSX.utils.book_append_sheet(wb, ws, "Giving History");
      XLSX.writeFile(wb, `my_giving_history_${new Date().toISOString().split("T")[0]}.xlsx`);

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
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-6">
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
                <p className="text-muted-foreground mb-4">No giving records yet</p>
                <Button onClick={() => navigate("/give")}>Record Your First Giving</Button>
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
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {givings.map((giving) => (
                      <TableRow key={giving.id}>
                        <TableCell>{new Date(giving.created_at).toLocaleDateString()}</TableCell>
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
                          {formatAmount(parseFloat(String(giving.amount)), giving.currency)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="capitalize">{giving.payment_method?.replace("_", " ")}</span>
                            {giving.payment_reference && (
                              <span className="text-xs text-muted-foreground">Ref: {giving.payment_reference}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(giving.status)}>{giving.status}</Badge>
                          {giving.status === "rejected" && giving.rejection_reason && (
                            <div className="text-xs text-destructive mt-1">{giving.rejection_reason}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(giving)}
                            disabled={giving.status === "verified"}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Edit Giving</DialogTitle>
              <DialogDescription>
                You can edit this giving while it is not verified.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Giving Type</Label>
                <Select
                  value={editForm.givingTypeId}
                  onValueChange={(value) => setEditForm((prev) => ({ ...prev, givingTypeId: value }))}
                >
                  <SelectTrigger>
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
              </div>

              <div className="space-y-2">
                <Label>Amount (MWK)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, amount: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select
                  value={editForm.paymentMethod}
                  onValueChange={(value) => setEditForm((prev) => ({ ...prev, paymentMethod: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Payment Reference</Label>
                <Input
                  value={editForm.paymentReference}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, paymentReference: e.target.value }))}
                  placeholder="Transaction ID / Ref"
                />
              </div>

              <div className="space-y-2">
                <Label>Note</Label>
                <Textarea
                  value={editForm.note}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder="Optional note"
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={editForm.isAnonymous}
                  onCheckedChange={(checked) => setEditForm((prev) => ({ ...prev, isAnonymous: Boolean(checked) }))}
                />
                <Label>Make this giving anonymous</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateGiving} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default History;
