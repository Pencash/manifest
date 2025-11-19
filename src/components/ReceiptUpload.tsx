import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";

interface ReceiptUploadProps {
  givingId: string;
  onSuccess?: () => void;
}

export const ReceiptUpload = ({ givingId, onSuccess }: ReceiptUploadProps) => {
  const [open, setOpen] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!receiptFile) {
      toast.error("Please select a receipt file");
      return;
    }

    // Validate file size (max 5MB)
    if (receiptFile.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!validTypes.includes(receiptFile.type)) {
      toast.error("Only JPG, PNG, and PDF files are supported");
      return;
    }

    try {
      setUploading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = receiptFile.name.split(".").pop();
      const fileName = `${givingId}/${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(filePath, receiptFile);

      if (uploadError) throw uploadError;

      const { error: receiptError } = await supabase
        .from("receipts")
        .insert({
          giving_id: givingId,
          storage_path: filePath,
        });

      if (receiptError) throw receiptError;

      toast.success("Receipt uploaded successfully! It will be reviewed by the finance team.");
      setOpen(false);
      setReceiptFile(null);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error uploading receipt:", error);
      toast.error("Failed to upload receipt. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Upload className="h-4 w-4" />
        Upload Receipt
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Receipt</DialogTitle>
            <DialogDescription>
              Upload a receipt for this giving. Accepted formats: JPG, PNG, PDF (max 5MB)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="receipt">Receipt File</Label>
              <Input
                id="receipt"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                disabled={uploading}
              />
              {receiptFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {receiptFile.name} ({(receiptFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !receiptFile}>
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload Receipt"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
