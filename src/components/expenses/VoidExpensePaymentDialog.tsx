import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { currencySafe, formatDateTime, formatMethodLabel } from "@/features/expenses/presentation";
import type { PaymentRecord } from "@/features/expenses/types";
import { formatAmount } from "@/lib/utils";

interface VoidExpensePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: PaymentRecord | null;
  voidReason: string;
  onVoidReasonChange: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  currency: string;
}

export function VoidExpensePaymentDialog({
  open,
  onOpenChange,
  payment,
  voidReason,
  onVoidReasonChange,
  onSubmit,
  submitting,
  currency,
}: VoidExpensePaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void payment entry</DialogTitle>
          <DialogDescription>
            This keeps the ledger history intact while removing the payment from posted totals and request status calculations.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            <p className="font-medium">{payment ? formatAmount(payment.amount, currencySafe(currency)) : "—"}</p>
            <p className="mt-1 text-muted-foreground">{payment ? `${formatMethodLabel(payment.payment_method)} • ${formatDateTime(payment.payment_date)}` : ""}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="void_reason">Void reason</Label>
            <Textarea
              id="void_reason"
              rows={4}
              value={voidReason}
              onChange={(event) => onVoidReasonChange(event.target.value)}
              placeholder="Explain why this payment entry is being voided for audit and reconciliation clarity."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Keep payment
          </Button>
          <Button variant="destructive" onClick={onSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Void payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
