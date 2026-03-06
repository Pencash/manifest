export const sumAmounts = (rows: Array<{ amount: number | string }> | null | undefined): number =>
  rows?.reduce((sum, row) => sum + Number(row.amount), 0) ?? 0;

export const computeAvailableFunds = (availableForExpense: number, allocatedExpenses: number): number =>
  availableForExpense - allocatedExpenses;
