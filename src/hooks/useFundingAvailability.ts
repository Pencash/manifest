import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeAvailableFunds, sumAmounts } from "@/lib/funding";
import { startOfMonth, endOfMonth, format } from "date-fns";

interface Params {
  selectedCategoryId?: string;
  selectedServiceId?: string;
  /** The reference month for funding; defaults to now */
  referenceDate?: Date;
}

export const useFundingAvailability = ({
  selectedCategoryId,
  selectedServiceId,
  referenceDate,
}: Params) => {
  const ref = referenceDate ?? new Date();
  const monthStart = format(startOfMonth(ref), "yyyy-MM-dd'T'00:00:00");
  const monthEnd = format(endOfMonth(ref), "yyyy-MM-dd'T'23:59:59");

  return useQuery({
    queryKey: [
      "funding-availability",
      selectedCategoryId ?? null,
      selectedServiceId ?? null,
      monthStart,
    ],
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
          monthLabel: format(ref, "MMMM yyyy"),
        };
      }

      // Total offerings for the month
      const { data: totalOfferingsData } = await supabase
        .from("givings")
        .select("amount")
        .eq("status", "verified")
        .eq("giving_type_id", offeringType.id)
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd);

      const totalOfferings = sumAmounts(totalOfferingsData);

      let serviceOfferings = 0;
      let generalOfferings = 0;
      let availableForExpense = 0;

      if (selectedServiceId) {
        const [{ data: serviceData }, { data: generalData }] =
          await Promise.all([
            supabase
              .from("givings")
              .select("amount")
              .eq("status", "verified")
              .eq("giving_type_id", offeringType.id)
              .eq("service_id", selectedServiceId)
              .gte("created_at", monthStart)
              .lte("created_at", monthEnd),
            supabase
              .from("givings")
              .select("amount")
              .eq("status", "verified")
              .eq("giving_type_id", offeringType.id)
              .is("service_id", null)
              .gte("created_at", monthStart)
              .lte("created_at", monthEnd),
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
          .is("service_id", null)
          .gte("created_at", monthStart)
          .lte("created_at", monthEnd);

        generalOfferings = sumAmounts(generalData);
        availableForExpense = generalOfferings;
      }

      // Expenses allocated in the same month
      let expenseQuery = supabase
        .from("expense_requests")
        .select("amount")
        .in("status", ["approved", "partially_paid", "paid"])
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd);

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
        availableFunds: computeAvailableFunds(
          availableForExpense,
          allocatedExpenses
        ),
        monthLabel: format(ref, "MMMM yyyy"),
      };
    },
  });
};
