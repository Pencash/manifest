import { endOfMonth, format, isBefore, parseISO, startOfMonth } from "date-fns";

export const RESTRICTED_GIVING_KEYWORDS = ["tithe", "first fruit", "firstfruit", "seed", "pledge"];

export type RestrictedGivingRow = {
  amount: number | string;
  created_at: string;
  status?: string | null;
  giving_types?: { name?: string | null } | null;
};

export type RestrictedRemittanceRow = {
  id: string;
  amount: number | string;
  remittance_month: string;
  remitted_at: string;
  currency: string;
  payment_method: string;
  payment_reference: string | null;
  notes: string | null;
  status: "posted" | "voided" | string;
  recorded_by: string;
  voided_by?: string | null;
  voided_at?: string | null;
  void_reason?: string | null;
  created_at?: string;
};

export type RestrictedFundMonthStatus = "cleared" | "partial" | "pending" | "overdue" | "no_funds";

export type RestrictedFundMonth = {
  monthKey: string;
  monthLabel: string;
  monthStart: Date;
  monthEnd: Date;
  collected: number;
  remitted: number;
  pending: number;
  status: RestrictedFundMonthStatus;
  breakdown: Record<string, number>;
  remittances: RestrictedRemittanceRow[];
};

export const isRestrictedGivingType = (name?: string | null) => {
  const normalized = (name || "").toLowerCase().trim();
  return RESTRICTED_GIVING_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

export const getMonthKey = (value: string | Date) => format(startOfMonth(typeof value === "string" ? parseISO(value) : value), "yyyy-MM-dd");

export const buildRestrictedFundMonths = (
  givings: RestrictedGivingRow[],
  remittances: RestrictedRemittanceRow[],
) => {
  const monthMap = new Map<string, RestrictedFundMonth>();
  const nowMonth = startOfMonth(new Date());

  const ensureMonth = (monthKey: string) => {
    const existing = monthMap.get(monthKey);
    if (existing) return existing;
    const monthStart = parseISO(monthKey);
    const month: RestrictedFundMonth = {
      monthKey,
      monthLabel: format(monthStart, "MMMM yyyy"),
      monthStart,
      monthEnd: endOfMonth(monthStart),
      collected: 0,
      remitted: 0,
      pending: 0,
      status: "no_funds",
      breakdown: {},
      remittances: [],
    };
    monthMap.set(monthKey, month);
    return month;
  };

  givings.filter((giving) => giving.status === "verified" && isRestrictedGivingType(giving.giving_types?.name)).forEach((giving) => {
    const month = ensureMonth(getMonthKey(giving.created_at));
    const amount = Number(giving.amount) || 0;
    const typeName = giving.giving_types?.name || "Restricted";
    month.collected += amount;
    month.breakdown[typeName] = (month.breakdown[typeName] || 0) + amount;
  });

  remittances.forEach((remittance) => {
    const month = ensureMonth(getMonthKey(remittance.remittance_month));
    month.remittances.push(remittance);
    if (remittance.status === "posted") month.remitted += Number(remittance.amount) || 0;
  });

  return Array.from(monthMap.values())
    .map((month) => {
      const pending = Math.max(month.collected - month.remitted, 0);
      const status: RestrictedFundMonthStatus = month.collected <= 0
        ? "no_funds"
        : pending <= 0
          ? "cleared"
          : month.remitted > 0
            ? "partial"
            : isBefore(month.monthStart, nowMonth)
              ? "overdue"
              : "pending";

      return {
        ...month,
        pending,
        status: pending > 0 && isBefore(month.monthStart, nowMonth) ? "overdue" : status,
        remittances: month.remittances.sort((a, b) => new Date(b.remitted_at).getTime() - new Date(a.remitted_at).getTime()),
      };
    })
    .filter((month) => month.collected > 0 || month.remittances.length > 0)
    .sort((a, b) => b.monthStart.getTime() - a.monthStart.getTime());
};

export const summarizeRestrictedFunds = (months: RestrictedFundMonth[]) => {
  const pendingMonths = months.filter((month) => month.pending > 0);
  const oldestPending = [...pendingMonths].sort((a, b) => a.monthStart.getTime() - b.monthStart.getTime())[0] || null;

  return {
    totalCollected: months.reduce((sum, month) => sum + month.collected, 0),
    totalRemitted: months.reduce((sum, month) => sum + month.remitted, 0),
    totalPending: months.reduce((sum, month) => sum + month.pending, 0),
    pendingMonthCount: pendingMonths.length,
    overdueMonthCount: months.filter((month) => month.status === "overdue").length,
    oldestPending,
  };
};