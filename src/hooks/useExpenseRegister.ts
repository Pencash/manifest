import { useQuery } from "@tanstack/react-query";

import { fetchExpenseRegister } from "@/features/expenses/api";

export const useExpenseRegister = (filterStatus: string, enabled = true) =>
  useQuery({
    queryKey: ["expense-register", filterStatus],
    enabled,
    queryFn: () => fetchExpenseRegister(filterStatus),
  });
