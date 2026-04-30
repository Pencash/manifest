import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { ArrowLeft, Download, Wallet, TrendingUp, TrendingDown, CalendarRange, HandCoins, Receipt, ArrowRight, CircleAlert } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import * as XLSX from "xlsx";
import { getHighestRole, hasAdminAccess } from "@/lib/roles";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { formatAmount } from "@/lib/utils";
import { buildRestrictedFundMonths, summarizeRestrictedFunds, RESTRICTED_GIVING_KEYWORDS } from "@/lib/restricted-funds";

type DatePreset = "this_month" | "last_3_months" | "this_year" | "custom";

const FinancialReports = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [givings, setGivings] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [remittances, setRemittances] = useState<any[]>([]);
  const [givingTypes, setGivingTypes] = useState<any[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [startDate, setStartDate] = useState<string>(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState<string>(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [datePreset, setDatePreset] = useState<DatePreset>("this_month");
  const [selectedGivingType, setSelectedGivingType] = useState<string>("all");
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<string>("all");
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPreset = (preset: DatePreset) => {
    const now = new Date();
    setDatePreset(preset);

    if (preset === "custom") return;

    if (preset === "this_month") {
      setStartDate(format(startOfMonth(now), "yyyy-MM-dd"));
      setEndDate(format(endOfMonth(now), "yyyy-MM-dd"));
      return;
    }

    if (preset === "last_3_months") {
      setStartDate(format(startOfMonth(subMonths(now, 2)), "yyyy-MM-dd"));
      setEndDate(format(endOfMonth(now), "yyyy-MM-dd"));
      return;
    }

    setStartDate(format(new Date(now.getFullYear(), 0, 1), "yyyy-MM-dd"));
    setEndDate(format(new Date(now.getFullYear(), 11, 31), "yyyy-MM-dd"));
  };

  const checkAuth = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        navigate("/admin/auth");
        return;
      }

      setUser(session.user);

      const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      const mainRole = getHighestRole(rolesData?.map(({ role }) => role));

      if (!hasAdminAccess(mainRole)) {
        toast.error("Access denied. Admin privileges required.");
        navigate("/dashboard");
        return;
      }

      await loadFinancialData();
    } catch (error: any) {
      console.error("Error:", error);
      toast.error("Failed to load financial data");
    } finally {
      setLoading(false);
    }
  };

  const loadFinancialData = async () => {
    try {
      const [typesRes, categoriesRes] = await Promise.all([
        supabase.from("giving_types").select("id, name").eq("is_active", true).order("name"),
        supabase.from("expense_categories").select("id, name").eq("is_active", true).order("name"),
      ]);

      setGivingTypes(typesRes.data || []);
      setExpenseCategories(categoriesRes.data || []);

      let givingsQuery = supabase
        .from("givings")
        .select("id, created_at, amount, currency, status, payment_method, giving_types(name)")
        .order("created_at", { ascending: false });

      if (startDate) givingsQuery = givingsQuery.gte("created_at", `${startDate}T00:00:00`);
      if (endDate) givingsQuery = givingsQuery.lte("created_at", `${endDate}T23:59:59`);
      if (selectedGivingType !== "all") givingsQuery = givingsQuery.eq("giving_type_id", selectedGivingType);

      let expensesQuery = supabase
        .from("expense_requests")
        .select("id, amount, status, created_at, category_id, expense_categories(name), expense_payments(amount, status, payment_date)")
        .order("created_at", { ascending: false });

      if (startDate) expensesQuery = expensesQuery.gte("created_at", `${startDate}T00:00:00`);
      if (endDate) expensesQuery = expensesQuery.lte("created_at", `${endDate}T23:59:59`);
      if (selectedExpenseCategory !== "all") expensesQuery = expensesQuery.eq("category_id", selectedExpenseCategory);

      let remittancesQuery = (supabase as any)
        .from("restricted_fund_remittances")
        .select("*")
        .order("remittance_month", { ascending: false });
      if (startDate) remittancesQuery = remittancesQuery.gte("remitted_at", `${startDate}T00:00:00`);
      if (endDate) remittancesQuery = remittancesQuery.lte("remitted_at", `${endDate}T23:59:59`);

      const [givingsRes, expensesRes, remittancesRes] = await Promise.all([givingsQuery, expensesQuery, remittancesQuery]);
      if (givingsRes.error) throw givingsRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (remittancesRes.error) throw remittancesRes.error;

      setGivings(givingsRes.data || []);
      setExpenses(expensesRes.data || []);
      setRemittances(remittancesRes.data || []);
    } catch (error: any) {
      console.error("Error loading financial data:", error);
      toast.error("Failed to load financial data");
    }
  };

  const analytics = useMemo(() => {
    const verifiedGivings = givings.filter((g) => g.status === "verified");
    const fundedExpenses = expenses.filter((expense) => ["approved", "partially_paid", "paid"].includes(expense.status));
    const pendingExpenses = expenses.filter((expense) => expense.status === "pending");

    let totalIncoming = 0;
    let eligibleIncoming = 0;
    let restrictedIncoming = 0;

    verifiedGivings.forEach((giving) => {
      const amount = Number(giving.amount) || 0;
      const typeName = (giving.giving_types?.name || "").toLowerCase().trim();
      const isRestricted = RESTRICTED_GIVING_KEYWORDS.some((keyword) => typeName.includes(keyword));

      totalIncoming += amount;
      if (isRestricted) restrictedIncoming += amount;
      else eligibleIncoming += amount;
    });

    const totalExpenses = fundedExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    const pendingExpenseAmount = pendingExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    const availableActivityFunds = eligibleIncoming - totalExpenses;
    const expenseCoveragePct = eligibleIncoming > 0 ? (totalExpenses / eligibleIncoming) * 100 : 0;

    const givingsByTypeMap = new Map<string, number>();
    verifiedGivings.forEach((giving) => {
      const name = giving.giving_types?.name || "Unknown";
      givingsByTypeMap.set(name, (givingsByTypeMap.get(name) || 0) + Number(giving.amount));
    });

    const expenseByCategoryMap = new Map<string, number>();
    fundedExpenses.forEach((expense) => {
      const name = expense.expense_categories?.name || "Uncategorized";
      expenseByCategoryMap.set(name, (expenseByCategoryMap.get(name) || 0) + Number(expense.amount));
    });

    const monthlyMap = new Map<string, { incoming: number; expenses: number }>();

    verifiedGivings.forEach((giving) => {
      const key = format(new Date(giving.created_at), "MMM yyyy");
      const current = monthlyMap.get(key) || { incoming: 0, expenses: 0 };
      current.incoming += Number(giving.amount);
      monthlyMap.set(key, current);
    });

    fundedExpenses.forEach((expense) => {
      const key = format(new Date(expense.created_at), "MMM yyyy");
      const current = monthlyMap.get(key) || { incoming: 0, expenses: 0 };
      current.expenses += Number(expense.amount);
      monthlyMap.set(key, current);
    });

    const monthlyMovement = Array.from(monthlyMap.entries())
      .map(([month, values]) => ({ month, ...values, net: values.incoming - values.expenses }))
      .slice(-12);

    const givingsByType = Array.from(givingsByTypeMap.entries()).map(([name, value]) => ({ name, value }));
    const expensesByCategory = Array.from(expenseByCategoryMap.entries()).map(([name, value]) => ({ name, value }));
    const restrictedMonths = buildRestrictedFundMonths(verifiedGivings, remittances);
    const restrictedSummary = summarizeRestrictedFunds(restrictedMonths);

    return {
      totalIncoming,
      eligibleIncoming,
      restrictedIncoming,
      totalExpenses,
      pendingExpenseAmount,
      pendingExpenseCount: pendingExpenses.length,
      availableActivityFunds,
      expenseCoveragePct,
      netMovement: eligibleIncoming - totalExpenses,
      givingsByType,
      expensesByCategory,
      monthlyMovement,
      restrictedMonths,
      restrictedRemitted: restrictedSummary.totalRemitted,
      restrictedPending: restrictedSummary.totalPending,
      restrictedPendingMonths: restrictedSummary.pendingMonthCount,
    };
  }, [expenses, givings, remittances]);

  const exportSummaryToExcel = () => {
    const summaryRows = [
      { Metric: "Reporting Period", Value: `${startDate || "N/A"} to ${endDate || "N/A"}` },
      { Metric: "Total Verified Incoming", Value: analytics.totalIncoming },
      { Metric: "Eligible Incoming (activity-supporting)", Value: analytics.eligibleIncoming },
      { Metric: "Restricted Incoming (excluded)", Value: analytics.restrictedIncoming },
      { Metric: "Restricted Remitted", Value: analytics.restrictedRemitted },
      { Metric: "Restricted Pending Remittance", Value: analytics.restrictedPending },
      { Metric: "Funded Expenses", Value: analytics.totalExpenses },
      { Metric: "Pending Expense Amount", Value: analytics.pendingExpenseAmount },
      { Metric: "Net Movement (Eligible Incoming - Funded Expenses)", Value: analytics.netMovement },
      { Metric: "Available Activity Funds", Value: analytics.availableActivityFunds },
      { Metric: "Expense Coverage %", Value: `${analytics.expenseCoveragePct.toFixed(1)}%` },
    ];

    const incomingBreakdownRows = analytics.givingsByType.map((item) => ({ Bucket: item.name, Amount: item.value }));
    const expenseBreakdownRows = analytics.expensesByCategory.map((item) => ({ Category: item.name, Amount: item.value }));
    const movementRows = analytics.monthlyMovement.map((item) => ({ Month: item.month, Incoming: item.incoming, Expenses: item.expenses, Net: item.net }));
    const restrictedRows = analytics.restrictedMonths.map((item) => ({ Month: item.monthLabel, Collected: item.collected, Remitted: item.remitted, Pending: item.pending, Status: item.status }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(incomingBreakdownRows), "Incoming Breakdown");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenseBreakdownRows), "Expense Breakdown");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(movementRows), "Monthly Movement");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(restrictedRows), "Restricted Remittances");

    XLSX.writeFile(wb, `financial_summary_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("Financial summary exported successfully");
  };

  const COLORS = ["hsl(40 50% 57%)", "hsl(216 60% 35%)", "hsl(142 76% 36%)", "hsl(15 55% 45%)", "hsl(262 83% 58%)", "hsl(346 77% 50%)", "hsl(48 96% 53%)"];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <p className="text-muted-foreground">Loading financial reports...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-3 sm:p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Financial Reports</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Financial movement statement focused on incoming, expenses, and available activity funds</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/givings")} className="gap-1.5 text-xs sm:text-sm">
              Givings Ledger
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/expenses/all")} className="gap-1.5 text-xs sm:text-sm">
              Expense Ledger
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/financial/remittances")} className="gap-1.5 text-xs sm:text-sm">
              Restricted Remittances
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" onClick={exportSummaryToExcel} className="gap-1.5 text-xs sm:text-sm">
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Report Scope</CardTitle>
            <CardDescription>Define the reporting window and slices for audit-friendly summaries.</CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
              <div>
                <Label>Date Preset</Label>
                <Select value={datePreset} onValueChange={(value: DatePreset) => applyPreset(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                    <SelectItem value="this_year">This Year</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Start Date</Label>
                <Input type="date" value={startDate} onChange={(e) => { setDatePreset("custom"); setStartDate(e.target.value); }} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={endDate} onChange={(e) => { setDatePreset("custom"); setEndDate(e.target.value); }} />
              </div>

              <div>
                <Label>Giving Type</Label>
                <Select value={selectedGivingType} onValueChange={setSelectedGivingType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {givingTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Expense Category</Label>
                <Select value={selectedExpenseCategory} onValueChange={setSelectedExpenseCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {expenseCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button onClick={loadFinancialData} className="w-full">Apply Scope</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Activity-Support Inflows</CardTitle>
              <Wallet className="h-4 w-4 text-primary/60" />
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold truncate">{formatAmount(analytics.eligibleIncoming)}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Verified incoming for activities</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Activity Outflows</CardTitle>
              <Receipt className="h-4 w-4 text-primary/60" />
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold truncate">{formatAmount(analytics.totalExpenses)}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Approved / partially paid / paid</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Closing Activity Balance</CardTitle>
              {analytics.netMovement >= 0 ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
              <div className={`text-xl sm:text-2xl font-bold truncate ${analytics.netMovement >= 0 ? "text-green-700 dark:text-green-400" : "text-destructive"}`}>{formatAmount(analytics.netMovement)}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Inflows minus outflows</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Restricted Pending</CardTitle>
              <CalendarRange className="h-4 w-4 text-primary/60" />
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
              <div className={`text-xl sm:text-2xl font-bold truncate ${analytics.restrictedPending > 0 ? "text-destructive" : "text-primary"}`}>{formatAmount(analytics.restrictedPending)}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">{analytics.restrictedPendingMonths} month{analytics.restrictedPendingMonths === 1 ? "" : "s"} requiring remittance</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Monthly Movement</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Incoming vs expenses for the selected scope</CardDescription>
            </CardHeader>
            <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={analytics.monthlyMovement} margin={{ left: -10, right: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => (value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value.toString())} width={70} />
                  <Tooltip formatter={(value: any) => formatAmount(Number(value))} />
                  <Legend />
                  <Bar dataKey="incoming" name="Incoming" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Incoming Composition</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Giving mix including restricted buckets</CardDescription>
            </CardHeader>
            <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
              {analytics.givingsByType.length === 0 ? (
                <div className="h-[320px] flex items-center justify-center text-muted-foreground">No incoming data for selected scope</div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie data={analytics.givingsByType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}>
                      {analytics.givingsByType.map((_, index) => (
                        <Cell key={`giving-type-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatAmount(Number(value))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Expense Allocation by Category</CardTitle>
              <CardDescription>Where approved spending has gone in this period</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.expensesByCategory} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(value) => (value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value.toString())} />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip formatter={(value: any) => formatAmount(Number(value))} />
                  <Bar dataKey="value" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Governance Watch</CardTitle>
              <CardDescription>Risk and control indicators for this reporting scope</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Restricted Incoming (Excluded)</p>
                    <p className="text-2xl font-bold mt-1">{formatAmount(analytics.restrictedIncoming)}</p>
                  </div>
                  <CalendarRange className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">This amount is tracked for accountability and is not available for activity spending.</p>
                <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                  <div className="rounded-md bg-muted/50 p-2"><p className="text-xs text-muted-foreground">Remitted</p><p className="font-mono font-semibold">{formatAmount(analytics.restrictedRemitted)}</p></div>
                  <div className="rounded-md bg-muted/50 p-2"><p className="text-xs text-muted-foreground">Pending</p><p className="font-mono font-semibold text-destructive">{formatAmount(analytics.restrictedPending)}</p></div>
                </div>
                <Button variant="link" className="px-0 h-auto mt-2" onClick={() => navigate("/admin/financial/remittances")}>Open remittance ledger<ArrowRight className="h-4 w-4 ml-1" /></Button>
              </div>

              <div className="rounded-md border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Pending Expense Queue</p>
                    <p className="text-2xl font-bold mt-1">{analytics.pendingExpenseCount}</p>
                  </div>
                  <HandCoins className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">{formatAmount(analytics.pendingExpenseAmount)} waiting for review/approval.</p>
                <Button variant="link" className="px-0 h-auto mt-2" onClick={() => navigate("/admin/expenses/pending")}>
                  Review pending approvals
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>

              {analytics.netMovement < 0 && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm flex items-start gap-2">
                  <CircleAlert className="h-4 w-4 text-destructive mt-0.5" />
                  <p className="text-destructive">Activity outflows are above activity-support inflows for this period. Review expense timing and funding source mix.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default FinancialReports;
