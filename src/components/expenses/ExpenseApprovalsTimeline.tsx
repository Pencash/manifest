import { CheckCircle2, FileClock, ShieldCheck, XCircle } from "lucide-react";

import { ExpenseEmptyState } from "@/components/expenses/ExpenseEmptyState";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { approvalBadgeClasses, formatDateTime } from "@/features/expenses/presentation";
import { cn } from "@/lib/utils";
import type { ApprovalRecord, NamedProfile } from "@/features/expenses/types";

interface ExpenseApprovalsTimelineProps {
  approvals: ApprovalRecord[];
  profilesMap: Record<string, NamedProfile>;
}

export function ExpenseApprovalsTimeline({ approvals, profilesMap }: ExpenseApprovalsTimelineProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval timeline</CardTitle>
        <CardDescription>Immutable decision history captured for this expense request.</CardDescription>
      </CardHeader>
      <CardContent>
        {approvals.length === 0 ? (
          <ExpenseEmptyState
            icon={ShieldCheck}
            title="No approval activity yet"
            description="Approval decisions will appear here once reviewers take action."
          />
        ) : (
          <div className="space-y-4">
            {approvals.map((approval, index) => (
              <div key={approval.id} className="relative rounded-xl border bg-card p-4 shadow-sm">
                {index < approvals.length - 1 && <div className="absolute left-7 top-16 h-[calc(100%-2rem)] w-px bg-border" />}
                <div className="flex gap-4">
                  <div className="mt-1 rounded-full border bg-background p-2">
                    {approval.action === "approved" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : approval.action === "rejected" ? (
                      <XCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <FileClock className="h-4 w-4 text-orange-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold">{profilesMap[approval.approver_id]?.full_name || "Unknown approver"}</p>
                        <p className="text-sm text-muted-foreground">{profilesMap[approval.approver_id]?.email || "No email available"}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={cn("border", approvalBadgeClasses[approval.action] || approvalBadgeClasses.changes_requested)}>
                          {approval.action.replace(/_/g, " ").toUpperCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{formatDateTime(approval.created_at)}</span>
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-3 text-sm text-foreground">
                      {approval.comments?.trim() ? approval.comments : "No additional comments were supplied for this action."}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
