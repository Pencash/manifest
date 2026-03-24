import { CalendarDays, FolderOpen, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDateOnly, formatDateTime, formatMethodLabel } from "@/features/expenses/presentation";
import type { ExpenseRequestDetail, NamedProfile } from "@/features/expenses/types";

interface ExpenseOverviewPanelProps {
  expense: ExpenseRequestDetail;
  requesterProfile: NamedProfile | null;
  paidByProfile: NamedProfile | null;
}

export function ExpenseOverviewPanel({ expense, requesterProfile, paidByProfile }: ExpenseOverviewPanelProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
      <Card>
        <CardHeader>
          <CardTitle>Request narrative</CardTitle>
          <CardDescription>What was requested and why it was justified.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Description</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{expense.description}</p>
          </div>
          <Separator />
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Justification</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{expense.justification}</p>
          </div>
          {expense.rejection_reason && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-destructive">Latest rejection reason</h3>
                <p className="mt-2 whitespace-pre-wrap rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm leading-6 text-foreground">
                  {expense.rejection_reason}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Ownership & routing</CardTitle>
            <CardDescription>Who owns the request and where it belongs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="font-medium">Requester</p>
                <p>{requesterProfile?.full_name || "Unknown user"}</p>
                <p className="text-muted-foreground">{requesterProfile?.email || "No email available"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FolderOpen className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="font-medium">Category</p>
                <p>{expense.expense_categories?.name || "Unknown category"}</p>
                <p className="text-muted-foreground">{expense.expense_categories?.code || "No category code"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="font-medium">Service / event</p>
                <p>{expense.services?.name || "General expense"}</p>
                <p className="text-muted-foreground">{expense.services?.service_date ? formatDateOnly(expense.services.service_date) : "Not tied to a service"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workflow metadata</CardTitle>
            <CardDescription>Operational facts for finance and approvers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Current status</span>
              <span className="font-medium">{expense.status.replace(/_/g, " ")}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Due date</span>
              <span className="font-medium">{formatDateOnly(expense.due_date)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Created</span>
              <span className="font-medium">{formatDateTime(expense.created_at)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Last updated</span>
              <span className="font-medium">{formatDateTime(expense.updated_at)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Latest payment method</span>
              <span className="font-medium">{formatMethodLabel(expense.payment_method)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Latest payment reference</span>
              <span className="font-medium">{expense.payment_reference || "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Latest paid at</span>
              <span className="font-medium">{formatDateTime(expense.paid_at)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Recorded by</span>
              <span className="font-medium">{paidByProfile?.full_name || "—"}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
