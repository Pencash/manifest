import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, DollarSign } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatAmount } from "@/lib/utils";
import { useFundingAvailability } from "@/hooks/useFundingAvailability";

interface FundingAvailabilityProps {
  selectedCategoryId?: string;
  selectedServiceId?: string;
  requestedAmount?: number;
}

export default function FundingAvailability({
  selectedCategoryId,
  selectedServiceId,
  requestedAmount = 0,
}: FundingAvailabilityProps) {
  const { data, isLoading } = useFundingAvailability({ selectedCategoryId, selectedServiceId });

  const totalOfferings = data?.totalOfferings ?? 0;
  const serviceOfferings = data?.serviceOfferings ?? 0;
  const generalOfferings = data?.generalOfferings ?? 0;
  const allocatedExpenses = data?.allocatedExpenses ?? 0;
  const availableFunds = data?.availableFunds ?? 0;

  const utilizationPercent = totalOfferings > 0 ? (allocatedExpenses / totalOfferings) * 100 : 0;
  const isSufficient = availableFunds >= requestedAmount;
  const shortfall = requestedAmount - availableFunds;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Funding Availability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-sm text-muted-foreground">Loading funding data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Funding Availability
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Offerings</p>
            <p className="text-lg font-semibold">{formatAmount(totalOfferings)}</p>
            <p className="text-xs text-muted-foreground mt-1">Excludes Tithes/First Fruits/Seed/Pledges</p>
          </div>

          {selectedServiceId && (
            <>
              <div>
                <p className="text-sm text-muted-foreground">Service Offerings</p>
                <p className="text-lg font-semibold">{formatAmount(serviceOfferings)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">General Offerings</p>
                <p className="text-lg font-semibold">{formatAmount(generalOfferings)}</p>
              </div>
            </>
          )}

          {!selectedServiceId && (
            <div>
              <p className="text-sm text-muted-foreground">General Offerings</p>
              <p className="text-lg font-semibold">{formatAmount(generalOfferings)}</p>
            </div>
          )}

          <div>
            <p className="text-sm text-muted-foreground">Allocated</p>
            <p className="text-lg font-semibold">{formatAmount(allocatedExpenses)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Available for This Expense</p>
            <p className={`text-lg font-semibold ${availableFunds < 0 ? "text-destructive" : "text-primary"}`}>
              {formatAmount(availableFunds)}
            </p>
          </div>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Funding Rules:</strong>
            {selectedServiceId ? (
              <p className="mt-1">Service expenses can use Offerings from this service + general Offerings.</p>
            ) : (
              <p className="mt-1">General expenses can only use general Offerings (not tied to a service).</p>
            )}
            <p className="text-xs mt-2 text-muted-foreground">Note: Tithes, First Fruits, Seed, and Building Pledges are restricted and not available for expenses.</p>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Fund Utilization</span>
            <span>{utilizationPercent.toFixed(1)}%</span>
          </div>
          <Progress value={Math.min(utilizationPercent, 100)} className="h-2" />
        </div>

        {requestedAmount > 0 && (
          <Alert className={isSufficient ? "border-green-500" : "border-destructive"}>
            {isSufficient ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-destructive" />
            )}
            <AlertDescription>
              {isSufficient ? (
                <span className="text-green-700 dark:text-green-400">
                  Sufficient funds available for this request ({formatAmount(requestedAmount)}).
                </span>
              ) : (
                <span className="text-destructive">
                  Insufficient funds. Shortfall: {formatAmount(shortfall)}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
