import { Banknote, CircleDollarSign, Clock3, HandCoins } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount } from "@/lib/utils";
import { currencySafe, formatDateOnly, formatDateTime, formatMethodLabel } from "@/lib/expense-format";
import type { ExpenseRequestDetail, PaymentRecord } from "@/lib/expense-detail-types";

interface Props {
  expense: ExpenseRequestDetail;
  postedTotal: number;
  remainingBalance: number;
  derivedPaymentStatus: string;
  postedPaymentCount: number;
  latestPostedPayment: PaymentRecord | null;
}

export const ExpenseRequestSummaryCard = ({
  expense,
  postedTotal,
  remainingBalance,
  derivedPaymentStatus,
  postedPaymentCount,
  latestPostedPayment,
}: Props) => {
  const currency = currencySafe(expense.currency);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardDescription>Requested amount</CardDescription>
          <CardTitle className="text-2xl">{formatAmount(expense.amount, currency)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <HandCoins className="h-4 w-4" />
            Submitted {formatDateOnly(expense.created_at)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Paid so far</CardDescription>
          <CardTitle className="text-2xl text-green-600">{formatAmount(postedTotal, currency)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CircleDollarSign className="h-4 w-4" />
            {postedPaymentCount} posted payment{postedPaymentCount === 1 ? "" : "s"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Outstanding balance</CardDescription>
          <CardTitle className="text-2xl text-foreground">{formatAmount(remainingBalance, currency)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Banknote className="h-4 w-4" />
            {derivedPaymentStatus.replace(/_/g, " ")} payment state
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Latest posted payment</CardDescription>
          <CardTitle className="text-lg">{latestPostedPayment ? formatDateTime(latestPostedPayment.payment_date) : "No payment yet"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="h-4 w-4" />
            {latestPostedPayment ? formatMethodLabel(latestPostedPayment.payment_method) : "Awaiting finance action"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
