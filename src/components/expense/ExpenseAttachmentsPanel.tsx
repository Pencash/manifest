import { ArrowUpRight, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatFileSize } from "@/lib/expense-format";
import { EmptyState } from "./EmptyState";
import type { ReceiptRecord, NamedProfile } from "@/lib/expense-detail-types";

interface Props {
  receipts: ReceiptRecord[];
  profilesMap: Record<string, NamedProfile>;
  onOpenReceipt: (receipt: ReceiptRecord) => void;
}

export const ExpenseAttachmentsPanel = ({ receipts, profilesMap, onOpenReceipt }: Props) => (
  <Card>
    <CardHeader>
      <CardTitle>Receipts & supporting files</CardTitle>
      <CardDescription>Documents uploaded against this request for review and verification.</CardDescription>
    </CardHeader>
    <CardContent>
      {receipts.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No attachments uploaded"
          description="Invoices, receipts, and transfer proof will appear here after upload."
        />
      ) : (
        <div className="space-y-3">
          {receipts.map((receipt) => (
            <div key={receipt.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="truncate font-medium">{receipt.file_name}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>{formatFileSize(receipt.file_size)}</span>
                  <span>Uploaded {formatDateTime(receipt.uploaded_at)}</span>
                  <span>By {profilesMap[receipt.uploaded_by]?.full_name || "Unknown user"}</span>
                </div>
              </div>
              <Button variant="outline" onClick={() => onOpenReceipt(receipt)}>
                <ArrowUpRight className="mr-2 h-4 w-4" />
                Open file
              </Button>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);
