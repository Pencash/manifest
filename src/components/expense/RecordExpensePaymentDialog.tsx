import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatAmount } from "@/lib/utils";

export interface PaymentFormState {
  amount: string;
  payment_method: string;
  payment_reference: string;
  payee_name: string;
  payment_date: string;
  notes: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: PaymentFormState;
  onFormChange: (form: PaymentFormState) => void;
  remainingBalance: number;
  currency: string;
  submitting: boolean;
  onSubmit: () => void;
}

export const RecordExpensePaymentDialog = ({
  open,
  onOpenChange,
  form,
  onFormChange,
  remainingBalance,
  currency,
  submitting,
  onSubmit,
}: Props) => (
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
            value={form.amount}
            onChange={(e) => onFormChange({ ...form, amount: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Remaining balance: {formatAmount(remainingBalance, currency)}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="payment_date">Payment date & time</Label>
          <Input
            id="payment_date"
            type="datetime-local"
            value={form.payment_date}
            onChange={(e) => onFormChange({ ...form, payment_date: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Payment method</Label>
          <Select value={form.payment_method} onValueChange={(v) => onFormChange({ ...form, payment_method: v })}>
            <SelectTrigger><SelectValue placeholder="Choose a method" /></SelectTrigger>
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
            value={form.payment_reference}
            onChange={(e) => onFormChange({ ...form, payment_reference: e.target.value })}
            placeholder="Bank reference, transaction code, cheque number..."
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="payee_name">Paid to</Label>
          <Input
            id="payee_name"
            value={form.payee_name}
            onChange={(e) => onFormChange({ ...form, payee_name: e.target.value })}
            placeholder="Vendor, beneficiary, or ministry owner"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="payment_notes">Payment notes</Label>
          <Textarea
            id="payment_notes"
            value={form.notes}
            onChange={(e) => onFormChange({ ...form, notes: e.target.value })}
            placeholder="Capture what was paid for, voucher details, or reconciliation notes."
            rows={4}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
        <Button onClick={onSubmit} disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save payment
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
