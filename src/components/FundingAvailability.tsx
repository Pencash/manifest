import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, DollarSign } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatAmount } from "@/lib/utils";

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
  const [totalOfferings, setTotalOfferings] = useState(0);
  const [serviceOfferings, setServiceOfferings] = useState(0);
  const [generalOfferings, setGeneralOfferings] = useState(0);
  const [allocatedExpenses, setAllocatedExpenses] = useState(0);
  const [availableFunds, setAvailableFunds] = useState(0);

  useEffect(() => {
    loadFundingData();
  }, [selectedCategoryId, selectedServiceId]);

  const loadFundingData = async () => {
    try {
      setLoading(true);

      // Step 1: Get the "Offering" giving type ID
      const { data: offeringType } = await supabase
        .from("giving_types")
        .select("id")
        .eq("name", "Offering")
        .maybeSingle();

      if (!offeringType) {
        console.error("Offering type not found");
        setLoading(false);
        return;
      }

      const offeringTypeId = offeringType.id;

      // Step 2: Get total verified Offerings (excluding restricted types)
      const { data: totalOfferingsData } = await supabase
        .from("givings")
        .select("amount")
        .eq("status", "verified")
        .eq("giving_type_id", offeringTypeId);

      const total = totalOfferingsData?.reduce((sum, g) => sum + Number(g.amount), 0) || 0;
      setTotalOfferings(total);

      // Step 3: Get service-specific and general Offerings
      let serviceTotal = 0;
      let generalTotal = 0;
      let availableForExpense = 0;

      if (selectedServiceId) {
        // Get service-specific Offerings
        const { data: serviceData } = await supabase
          .from("givings")
          .select("amount")
          .eq("status", "verified")
          .eq("giving_type_id", offeringTypeId)
          .eq("service_id", selectedServiceId);

        serviceTotal = serviceData?.reduce((sum, g) => sum + Number(g.amount), 0) || 0;
        setServiceOfferings(serviceTotal);

        // Get general Offerings (no service_id)
        const { data: generalData } = await supabase
          .from("givings")
          .select("amount")
          .eq("status", "verified")
          .eq("giving_type_id", offeringTypeId)
          .is("service_id", null);

        generalTotal = generalData?.reduce((sum, g) => sum + Number(g.amount), 0) || 0;
        setGeneralOfferings(generalTotal);

        // Available for service expense = service Offerings + general Offerings
        availableForExpense = serviceTotal + generalTotal;
      } else {
        // For general expenses, only general Offerings are available
        const { data: generalData } = await supabase
          .from("givings")
          .select("amount")
          .eq("status", "verified")
          .eq("giving_type_id", offeringTypeId)
          .is("service_id", null);

        generalTotal = generalData?.reduce((sum, g) => sum + Number(g.amount), 0) || 0;
        setGeneralOfferings(generalTotal);
        setServiceOfferings(0);

        availableForExpense = generalTotal;
      }

      // Step 4: Get allocated expenses
      let expenseQuery = supabase
        .from("expense_requests")
        .select("amount")
        .in("status", ["approved", "paid"]);

      if (selectedServiceId) {
        // For service expenses, only count expenses for this service
        expenseQuery = expenseQuery.eq("service_id", selectedServiceId);
      } else {
        // For general expenses, count all general expenses (no service)
        expenseQuery = expenseQuery.is("service_id", null);
      }

      if (selectedCategoryId) {
        expenseQuery = expenseQuery.eq("category_id", selectedCategoryId);
      }

      const { data: expenseData } = await expenseQuery;
      const allocated = expenseData?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
      setAllocatedExpenses(allocated);

      // Calculate available funds
      const available = availableForExpense - allocated;
      setAvailableFunds(available);

    } catch (error) {
      console.error("Failed to load funding data:", error);
    } finally {
      setLoading(false);
    }
  };

  const utilizationPercent = totalOfferings > 0 ? (allocatedExpenses / totalOfferings) * 100 : 0;
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
            <p className={`text-lg font-semibold ${availableFunds < 0 ? 'text-destructive' : 'text-primary'}`}>
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
                  <strong>Sufficient funding available.</strong> Your request of {formatAmount(requestedAmount)} can be covered by available funds.
                </>
              ) : (
                <>
                  <strong>Funding shortfall: {formatAmount(shortfall)}</strong>
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
