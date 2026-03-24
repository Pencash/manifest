import { Receipt, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatAmount } from "@/lib/utils";
import { currencySafe, formatDateTime, formatMethodLabel } from "@/lib/expense-format";
import { EmptyState } from "./EmptyState";
import type { PaymentRecord, NamedProfile } from "@/lib/expense-detail-types";

interface Props {
  payments: PaymentRecord[];
  profilesMap: Record<string, NamedProfile>;
  currency: string | null;
  canRecordPayment: boolean;
  canManagePayments: boolean;
  onRecordPayment: () => void;
  onVoidPayment: (payment: PaymentRecord) => void;
}

export const ExpensePaymentLedger = ({
  payments,
  profilesMap,
  currency,
  canRecordPayment,
  canManagePayments,
  onRecordPayment,
  onVoidPayment,
}: Props) => {
  const cur = currencySafe(currency);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Payment ledger</CardTitle>
              <CardDescription>Every disbursement recorded against this request lives here.</CardDescription>
            </div>
            {canRecordPayment && (
              <Button onClick={onRecordPayment}>
                <Wallet className="mr-2 h-4 w-4" />
                Record another payment
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No payments recorded"
              description="Finance can start the ledger by recording the first payment for this approved request."
            />
          ) : (
            <ScrollArea className="w-full">
              <div className="min-w-[920px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Payee</TableHead>
                      <TableHead>Recorded by</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="text-sm">{formatDateTime(payment.payment_date)}</TableCell>
                        <TableCell className="font-semibold">{formatAmount(payment.amount, cur)}</TableCell>
                        <TableCell>{formatMethodLabel(payment.payment_method)}</TableCell>
                        <TableCell className="font-mono text-xs">{payment.payment_reference || "—"}</TableCell>
                        <TableCell>{payment.payee_name || "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{profilesMap[payment.recorded_by]?.full_name || "Unknown user"}</span>
                            <span className="text-xs text-muted-foreground">{profilesMap[payment.recorded_by]?.email || "No email"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "border",
                            payment.status === "posted"
                              ? "bg-green-500/10 text-green-700 border-green-200 dark:text-green-300 dark:border-green-900"
                              : "bg-muted text-muted-foreground border-border",
                          )}>
                            {payment.status.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs whitespace-pre-wrap text-sm text-muted-foreground">
                          {payment.notes || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {canManagePayments && payment.status === "posted" ? (
                            <Button variant="outline" size="sm" onClick={() => onVoidPayment(payment)}>
                              Void
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
