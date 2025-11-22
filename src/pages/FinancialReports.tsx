import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { ArrowLeft, Download, DollarSign, TrendingUp, FileText, Calendar } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { hasAdminAccess } from "../lib/roles";
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { formatAmount } from "@/lib/utils";

const FinancialReports = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [givings, setGivings] = useState<any[]>([]);
  const [givingTypes, setGivingTypes] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedGivingType, setSelectedGivingType] = useState<string>("all");
  const [selectedService, setSelectedService] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("all");
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate("/admin/auth");
        return;
      }
      
      setUser(session.user);

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      const mainRole = rolesData && rolesData.length > 0 ? rolesData[0].role : null;

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
      // Load giving types
      const { data: typesData } = await supabase
        .from("giving_types")
        .select("*")
        .eq("is_active", true)
        .order("name");
      setGivingTypes(typesData || []);

      // Load services
      const { data: servicesData } = await supabase
        .from("services")
        .select("*")
        .order("service_date", { ascending: false });
      setServices(servicesData || []);

      // Load givings with filters
      let query = supabase
        .from("givings")
        .select(`
          *,
          profiles(full_name, email),
          giving_types(name),
          services(name, service_date),
          receipts(id, verification_status)
        `)
        .order("created_at", { ascending: false });

      if (startDate) query = query.gte("created_at", startDate);
      if (endDate) query = query.lte("created_at", endDate);
      if (selectedGivingType !== "all") query = query.eq("giving_type_id", selectedGivingType);
      if (selectedService !== "all") query = query.eq("service_id", selectedService);
      if (selectedStatus !== "all") query = query.eq("status", selectedStatus);
      if (selectedPaymentMethod !== "all") query = query.eq("payment_method", selectedPaymentMethod);

      const { data: givingsData, error } = await query;

      if (error) throw error;
      setGivings(givingsData || []);
    } catch (error: any) {
      console.error("Error loading financial data:", error);
      toast.error("Failed to load financial data");
    }
  };

  const getSummaryMetrics = () => {
    const totalAmount = givings.reduce((sum, g) => sum + Number(g.amount), 0);
    const totalTransactions = givings.length;
    const averageGiving = totalTransactions > 0 ? totalAmount / totalTransactions : 0;
    const pendingCount = givings.filter(g => g.status === "pending").length;

    return { totalAmount, totalTransactions, averageGiving, pendingCount };
  };

  const getGivingsByTypeData = () => {
    const typeMap = new Map<string, number>();
    givings.forEach(g => {
      const typeName = g.giving_types?.name || "Unknown";
      typeMap.set(typeName, (typeMap.get(typeName) || 0) + Number(g.amount));
    });

    return Array.from(typeMap.entries()).map(([name, amount]) => ({
      name,
      value: amount
    }));
  };

  const getMonthlyTrendsData = () => {
    const monthMap = new Map<string, number>();
    givings.forEach(g => {
      const month = format(new Date(g.created_at), "MMM yyyy");
      monthMap.set(month, (monthMap.get(month) || 0) + Number(g.amount));
    });

    return Array.from(monthMap.entries())
      .map(([month, amount]) => ({ month, amount }))
      .reverse()
      .slice(0, 12);
  };

  const exportToExcel = () => {
    const exportData = givings.map(g => ({
      "Date": format(new Date(g.created_at), "PPP"),
      "Donor": g.is_anonymous ? "Anonymous" : g.profiles?.full_name || "N/A",
      "Email": g.is_anonymous ? "Anonymous" : g.profiles?.email || "N/A",
      "Type": g.giving_types?.name || "N/A",
      "Service": g.services?.name || "N/A",
      "Service Date": g.services?.service_date ? format(new Date(g.services.service_date), "PPP") : "N/A",
      "Amount (MWK)": g.amount,
      "Payment Method": g.payment_method,
      "Reference": g.payment_reference || "N/A",
      "Status": g.status,
      "Receipt Status": g.receipts?.[0]?.verification_status || "No receipt"
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Financial Report");
    XLSX.writeFile(wb, `financial_report_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("Report exported successfully");
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      verified: "default",
      pending: "secondary",
      rejected: "destructive"
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))', '#82ca9d', '#ffc658'];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <p className="text-muted-foreground">Loading financial reports...</p>
      </div>
    );
  }

  const metrics = getSummaryMetrics();
  const pieData = getGivingsByTypeData();
  const monthlyData = getMonthlyTrendsData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/admin/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Financial Reports
              </h1>
              <p className="text-muted-foreground">Comprehensive giving analytics and insights</p>
            </div>
          </div>
          <Button onClick={exportToExcel} className="gap-2">
            <Download className="h-4 w-4" />
            Export to Excel
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Customize your report view</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Giving Type</Label>
                <Select value={selectedGivingType} onValueChange={setSelectedGivingType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {givingTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Service</Label>
                <Select value={selectedService} onValueChange={setSelectedService}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Services</SelectItem>
                    {services.map(service => (
                      <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={loadFinancialData} className="mt-4">Apply Filters</Button>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
              <DollarSign className="h-4 w-4 text-primary/60" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatAmount(metrics.totalAmount)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <FileText className="h-4 w-4 text-primary/60" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalTransactions}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Average Giving</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary/60" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatAmount(metrics.averageGiving)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Verifications</CardTitle>
              <Calendar className="h-4 w-4 text-primary/60" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.pendingCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Givings by Type</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent, value }) => {
                      const shortName = name.length > 15 ? name.substring(0, 12) + '...' : name;
                      return `${shortName}: ${(percent * 100).toFixed(1)}%`;
                    }}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatAmount(value)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis 
                    tickFormatter={(value) => {
                      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                      if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                      return value.toString();
                    }}
                    width={80}
                    label={{ 
                      value: 'Amount (MWK)', 
                      angle: -90, 
                      position: 'insideLeft',
                      style: { textAnchor: 'middle' }
                    }}
                  />
                  <Tooltip formatter={(value: any) => formatAmount(value)} />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Table */}
        <Card>
          <CardHeader>
            <CardTitle>Detailed Transactions</CardTitle>
            <CardDescription>Complete list of all giving records</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Donor</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {givings.map((giving) => (
                    <TableRow key={giving.id}>
                      <TableCell>{format(new Date(giving.created_at), "PPP")}</TableCell>
                      <TableCell>
                        {giving.is_anonymous ? (
                          <span className="text-muted-foreground italic">Anonymous</span>
                        ) : (
                          <div>
                            <div className="font-medium">{giving.profiles?.full_name || "N/A"}</div>
                            <div className="text-xs text-muted-foreground">{giving.profiles?.email || ""}</div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{giving.giving_types?.name || "N/A"}</TableCell>
                      <TableCell>
                        {giving.services ? (
                          <div>
                            <div className="font-medium">{giving.services.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(giving.services.service_date), "PP")}
                            </div>
                          </div>
                        ) : (
                          "N/A"
                        )}
                      </TableCell>
                      <TableCell className="font-semibold">{formatAmount(Number(giving.amount), giving.currency)}</TableCell>
                      <TableCell>{giving.payment_method.replace("_", " ")}</TableCell>
                      <TableCell className="text-xs">{giving.payment_reference || "N/A"}</TableCell>
                      <TableCell>{getStatusBadge(giving.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {givings.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No transactions found for the selected filters
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FinancialReports;
