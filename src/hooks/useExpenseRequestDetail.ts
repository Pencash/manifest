import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchExpenseRequestDetail,
  getExpenseReceiptSignedUrl,
  recordExpensePayment,
  voidExpensePayment,
} from "@/features/expenses/api";
import type { RecordExpensePaymentInput, VoidExpensePaymentInput } from "@/features/expenses/types";

export const useExpenseRequestDetail = (expenseId?: string, enabled = true) =>
  useQuery({
    queryKey: ["expense-request-detail", expenseId],
    enabled: Boolean(expenseId) && enabled,
    queryFn: () => fetchExpenseRequestDetail(expenseId!),
  });

export const useRecordExpensePayment = (expenseId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RecordExpensePaymentInput) => recordExpensePayment(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["expense-request-detail", expenseId] }),
        queryClient.invalidateQueries({ queryKey: ["expense-register"] }),
      ]);
    },
  });
};

export const useVoidExpensePayment = (expenseId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: VoidExpensePaymentInput) => voidExpensePayment(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["expense-request-detail", expenseId] }),
        queryClient.invalidateQueries({ queryKey: ["expense-register"] }),
      ]);
    },
  });
};

export const useExpenseReceiptUrl = () =>
  useMutation({
    mutationFn: (storagePath: string) => getExpenseReceiptSignedUrl(storagePath),
  });
