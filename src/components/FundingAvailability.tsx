import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, DollarSign } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface FundingAvailabilityProps {
  selectedCategoryId?: string;
  selectedServiceId?: string;
  requestedAmount?: number;
}

export default function FundingAvailability({ 
  selectedCategoryId, 
  selectedServiceId,
  requestedAmount = 0 
}: FundingAvailabilityProps) {
  const [loading, setLoading] = useState(true);
  const [totalGivings, setTotalGivings] = useState(0);
  const [serviceGivings, setServiceGivings] = useState(0);
  const [allocatedExpenses, setAllocatedExpenses] = useState(0);
  const [availableFunds, setAvailableFunds] = useState(0);

  useEffect(() => {
    loadFundingData();
  }, [selectedCategoryId, selectedServiceId]);

  const loadFundingData = async () => {
    try {
      setLoading(true);

      // Get total verified givings
      const { data: totalData } = await supabase
        .from("givings")
        .select("amount")
        .eq("status", "verified");

      const total = totalData?.reduce((sum, g) => sum + Number(g.amount), 0) || 0;
      setTotalGivings(total);

      // Get service-specific givings if service is selected
      let serviceTotal = 0;
      if (selectedServiceId) {
        const { data: serviceData } = await supabase
          .from("givings")
          .select("amount")
          .eq("service_id", selectedServiceId)
          .eq("status", "verified");

        serviceTotal = serviceData?.reduce((sum, g) => sum + Number(g.amount), 0) || 0;
        setServiceGivings(serviceTotal);
      } else {
        setServiceGivings(0);
      }

      // Get allocated expenses (approved or paid)
      let expenseQuery = supabase
        .from("expense_requests")
        .select("amount")
        .in("status", ["approved", "paid"]);

      if (selectedCategoryId) {
        expenseQuery = expenseQuery.eq("category_id", selectedCategoryId);
      }

      if (selectedServiceId) {
        expenseQuery = expenseQuery.eq("service_id", selectedServiceId);
      }

      const { data: expenseData } = await expenseQuery;
      const allocated = expenseData?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
      setAllocatedExpenses(allocated);

      // Calculate available funds
      const fundsBase = selectedServiceId ? serviceTotal : total;
      const available = fundsBase - allocated;
      setAvailableFunds(available);

    } catch (error) {
      console.error("Failed to load funding data:", error);
    } finally {
      setLoading(false);
    }
  };

  const utilizationPercent = totalGivings > 0 ? (allocatedExpenses / totalGivings) * 100 : 0;
  const isSufficient = availableFunds >= requestedAmount;
  const shortfall = requestedAmount - availableFunds;

  if (loading) {
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
            <p className="text-sm text-muted-foreground">Total Givings</p>
            <p className="text-lg font-semibold">MWK {totalGivings.toLocaleString()}</p>
          </div>
          {selectedServiceId && serviceGivings > 0 && (
            <div>
              <p className="text-sm text-muted-foreground">Service Givings</p>
              <p className="text-lg font-semibold">MWK {serviceGivings.toLocaleString()}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-muted-foreground">Allocated</p>
            <p className="text-lg font-semibold">MWK {allocatedExpenses.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Available</p>
            <p className={`text-lg font-semibold ${availableFunds < 0 ? 'text-destructive' : 'text-primary'}`}>
              MWK {availableFunds.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Budget Utilization</span>
            <span className="font-medium">{utilizationPercent.toFixed(1)}%</span>
          </div>
          <Progress value={utilizationPercent} className="h-2" />
        </div>

        {requestedAmount > 0 && (
          <Alert variant={isSufficient ? "default" : "destructive"}>
            {isSufficient ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              {isSufficient ? (
                <>
                  <strong>Sufficient funding available.</strong> Your request of MWK {requestedAmount.toLocaleString()} can be covered by available funds.
                </>
              ) : (
                <>
                  <strong>Funding shortfall: MWK {shortfall.toLocaleString()}</strong>
                  <br />
                  This expense exceeds available funds. Approval may require additional funding or budget reallocation.
                </>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
