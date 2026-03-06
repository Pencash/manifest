import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeAvailableFunds, sumAmounts } from "@/lib/funding";

interface Params {
  selectedCategoryId?: string;
  selectedServiceId?: string;
}

export const useFundingAvailability = ({ selectedCategoryId, selectedServiceId }: Params) =>
  useQuery({
    queryKey: ["funding-availability", selectedCategoryId ?? null, selectedServiceId ?? null],
    queryFn: async () => {
      const { data: offeringType } = await supabase
        .from("giving_types")
        .select("id")
        .eq("name", "Offering")
        .maybeSingle();

      if (!offeringType) {
        return {
          totalOfferings: 0,
          serviceOfferings: 0,
          generalOfferings: 0,
          allocatedExpenses: 0,
          availableFunds: 0,
        };
      }

      const { data: totalOfferingsData } = await supabase
        .from("givings")
        .select("amount")
        .eq("status", "verified")
        .eq("giving_type_id", offeringType.id);

      const totalOfferings = sumAmounts(totalOfferingsData);

      let serviceOfferings = 0;
      let generalOfferings = 0;
      let availableForExpense = 0;

      if (selectedServiceId) {
        const [{ data: serviceData }, { data: generalData }] = await Promise.all([
          supabase
            .from("givings")
            .select("amount")
            .eq("status", "verified")
            .eq("giving_type_id", offeringType.id)
            .eq("service_id", selectedServiceId),
          supabase
            .from("givings")
            .select("amount")
            .eq("status", "verified")
            .eq("giving_type_id", offeringType.id)
            .is("service_id", null),
        ]);

        serviceOfferings = sumAmounts(serviceData);
        generalOfferings = sumAmounts(generalData);
        availableForExpense = serviceOfferings + generalOfferings;
      } else {
        const { data: generalData } = await supabase
          .from("givings")
          .select("amount")
          .eq("status", "verified")
          .eq("giving_type_id", offeringType.id)
          .is("service_id", null);

        generalOfferings = sumAmounts(generalData);
        availableForExpense = generalOfferings;
      }

      let expenseQuery = supabase
        .from("expense_requests")
        .select("amount")
        .in("status", ["approved", "paid"]);

      expenseQuery = selectedServiceId
        ? expenseQuery.eq("service_id", selectedServiceId)
        : expenseQuery.is("service_id", null);

      if (selectedCategoryId) {
        expenseQuery = expenseQuery.eq("category_id", selectedCategoryId);
      }

      const { data: expenseData } = await expenseQuery;
      const allocatedExpenses = sumAmounts(expenseData);

      return {
        totalOfferings,
        serviceOfferings,
        generalOfferings,
        allocatedExpenses,
        availableFunds: computeAvailableFunds(availableForExpense, allocatedExpenses),
      };
    },
  });
