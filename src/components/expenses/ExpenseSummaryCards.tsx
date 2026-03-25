import { Banknote, CircleDollarSign, Clock3, HandCoins } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn, formatAmount } from "@/lib/utils";
import { currencySafe, formatDateOnly, formatDateTime, formatMethodLabel, statusBadgeClasses } from "@/features/expenses/presentation";
import type { ExpenseRequestDetail, PaymentRecord } from "@/features/expenses/types";

interface ExpenseSummaryCardsProps {
  expense: ExpenseRequestDetail;
  postedTotal: number;
  remainingBalance: number;
  derivedPaymentStatus: string;
  paymentProgress: number;
  latestPostedPayment: PaymentRecord | null;
  postedPaymentCount: number;
  settledAt?: string | null;
  settledByName?: string | null;
}

export function ExpenseSummaryCards({
  expense,
  postedTotal,
  remainingBalance,
  derivedPaymentStatus,
  paymentProgress,
  latestPostedPayment,
  postedPaymentCount,
  settledAt,
  settledByName,
}: ExpenseSummaryCardsProps) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardDescription>Requested amount</CardDescription>
            <CardTitle className="text-2xl">{formatAmount(expense.amount, currencySafe(expense.currency))}</CardTitle>
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
            <CardTitle className="text-2xl text-green-600">{formatAmount(postedTotal, currencySafe(expense.currency))}</CardTitle>
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
            <CardTitle className="text-2xl text-foreground">{formatAmount(remainingBalance, currencySafe(expense.currency))}</CardTitle>
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

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Payment progress</CardTitle>
              <CardDescription>The payment ledger below drives the current disbursement state for this request.</CardDescription>
            </div>
            <Badge className={cn("border", statusBadgeClasses[derivedPaymentStatus] || statusBadgeClasses.approved)}>
              {derivedPaymentStatus.replace(/_/g, " ").toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={paymentProgress} className="h-3" />
          <div className="flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
            <span>
              {formatAmount(postedTotal, currencySafe(expense.currency))} of {formatAmount(expense.amount, currencySafe(expense.currency))} has been disbursed.
            </span>
            <span>{paymentProgress.toFixed(1)}% complete</span>
          </div>
          {derivedPaymentStatus === "paid" && settledAt && (
            <p className="text-sm text-green-700 dark:text-green-300">
              Settled on {formatDateTime(settledAt)}
              {settledByName ? ` by ${settledByName}` : ""}.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
