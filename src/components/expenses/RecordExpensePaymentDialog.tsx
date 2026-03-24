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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { currencySafe } from "@/features/expenses/presentation";
import type { ExpensePaymentFormValues } from "@/features/expenses/types";
import { formatAmount } from "@/lib/utils";

interface RecordExpensePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  values: ExpensePaymentFormValues;
  onChange: (values: ExpensePaymentFormValues) => void;
  onSubmit: () => void;
  submitting: boolean;
  remainingBalance: number;
  currency: string;
}

export function RecordExpensePaymentDialog({
  open,
  onOpenChange,
  values,
  onChange,
  onSubmit,
  submitting,
  remainingBalance,
  currency,
}: RecordExpensePaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Add a new payment entry for this expense request. The request status will update automatically based on the ledger total.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="payment_amount">Amount</Label>
            <Input
              id="payment_amount"
              type="number"
              min="0"
              step="0.01"
              value={values.amount}
              onChange={(event) => onChange({ ...values, amount: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">Remaining balance: {formatAmount(remainingBalance, currencySafe(currency))}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment_date">Payment date & time</Label>
            <Input
              id="payment_date"
              type="datetime-local"
              value={values.payment_date}
              onChange={(event) => onChange({ ...values, payment_date: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Payment method</Label>
            <Select value={values.payment_method} onValueChange={(value) => onChange({ ...values, payment_method: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                <SelectItem value="mobile_money">Mobile money</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment_reference">Payment reference</Label>
            <Input
              id="payment_reference"
              value={values.payment_reference}
              onChange={(event) => onChange({ ...values, payment_reference: event.target.value })}
              placeholder="Bank reference, transaction code, cheque number..."
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="payee_name">Paid to</Label>
            <Input
              id="payee_name"
              value={values.payee_name}
              onChange={(event) => onChange({ ...values, payee_name: event.target.value })}
              placeholder="Vendor, beneficiary, or ministry owner"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="payment_notes">Payment notes</Label>
            <Textarea
              id="payment_notes"
              value={values.notes}
              onChange={(event) => onChange({ ...values, notes: event.target.value })}
              placeholder="Capture what was paid for, voucher details, or reconciliation notes."
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
