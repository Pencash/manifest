import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import LoadingFallback from "./components/LoadingFallback";

// Lazy load layouts
const MemberLayout = lazy(() => import("./layouts/MemberLayout"));
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));

// Lazy load auth pages
const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const AdminAuth = lazy(() => import("./pages/AdminAuth"));
const MemberAuth = lazy(() => import("./pages/MemberAuth"));

// Lazy load member pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Give = lazy(() => import("./pages/Give"));
const History = lazy(() => import("./pages/History"));
const Testimony = lazy(() => import("./pages/Testimony"));
const Prayer = lazy(() => import("./pages/Prayer"));
const MemberMobilization = lazy(() => import("./pages/MemberMobilization"));
const Settings = lazy(() => import("./pages/Settings"));

// Lazy load admin pages
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const EventsManagement = lazy(() => import("./pages/EventsManagement"));
const AdminPendingServices = lazy(() => import("./pages/AdminPendingServices"));
const AttendanceLog = lazy(() => import("./pages/AttendanceLog"));
const BulkAttendanceImport = lazy(() => import("./pages/BulkAttendanceImport"));
const AttendanceReport = lazy(() => import("./pages/AttendanceReport"));
const EventReminders = lazy(() => import("./pages/EventReminders"));
const VisitorFollowup = lazy(() => import("./pages/VisitorFollowup"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const FinancialReports = lazy(() => import("./pages/FinancialReports"));
const ExpenseCategories = lazy(() => import("./pages/ExpenseCategories"));
const ExpenseRequest = lazy(() => import("./pages/ExpenseRequest"));
const AdminExpenseRequests = lazy(() => import("./pages/AdminExpenseRequests"));
const PendingExpenseApprovals = lazy(() => import("./pages/PendingExpenseApprovals"));
const AdminGivings = lazy(() => import("./pages/AdminGivings"));
const MobilizationReport = lazy(() => import("./pages/MobilizationReport"));
const ConversionDashboard = lazy(() => import("./pages/ConversionDashboard"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));

// 404 page
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin/auth" element={<AdminAuth />} />
            <Route path="/member/auth" element={<MemberAuth />} />
            
            {/* Member Routes */}
            <Route path="/dashboard" element={<MemberLayout><Dashboard /></MemberLayout>} />
            <Route path="/give" element={<MemberLayout><Give /></MemberLayout>} />
            <Route path="/history" element={<MemberLayout><History /></MemberLayout>} />
            <Route path="/testimony" element={<MemberLayout><Testimony /></MemberLayout>} />
            <Route path="/prayer" element={<MemberLayout><Prayer /></MemberLayout>} />
            <Route path="/mobilization" element={<MemberLayout><MemberMobilization /></MemberLayout>} />
            <Route path="/settings" element={<MemberLayout><Settings /></MemberLayout>} />
            
            {/* Admin Routes */}
            <Route path="/admin/dashboard" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
            <Route path="/admin/events" element={<AdminLayout><EventsManagement /></AdminLayout>} />
            <Route path="/admin/pending-services" element={<AdminLayout><AdminPendingServices /></AdminLayout>} />
            <Route path="/admin/attendance/:serviceId" element={<AdminLayout><AttendanceLog /></AdminLayout>} />
            <Route path="/admin/attendance/:serviceId/bulk-import" element={<AdminLayout><BulkAttendanceImport /></AdminLayout>} />
            <Route path="/admin/reports/attendance" element={<AdminLayout><AttendanceReport /></AdminLayout>} />
            <Route path="/admin/reports/financial" element={<AdminLayout><FinancialReports /></AdminLayout>} />
            <Route path="/admin/givings" element={<AdminLayout><AdminGivings /></AdminLayout>} />
            <Route path="/admin/expenses/request" element={<AdminLayout><ExpenseRequest /></AdminLayout>} />
            <Route path="/admin/expenses/all" element={<AdminLayout><AdminExpenseRequests /></AdminLayout>} />
            <Route path="/admin/expenses/categories" element={<AdminLayout><ExpenseCategories /></AdminLayout>} />
            <Route path="/admin/expenses/pending" element={<AdminLayout><PendingExpenseApprovals /></AdminLayout>} />
            <Route path="/admin/reminders" element={<AdminLayout><EventReminders /></AdminLayout>} />
            <Route path="/admin/visitor-followup" element={<AdminLayout><VisitorFollowup /></AdminLayout>} />
            <Route path="/admin/users" element={<AdminLayout><UserManagement /></AdminLayout>} />
            <Route path="/admin/mobilization" element={<AdminLayout><MobilizationReport /></AdminLayout>} />
            <Route path="/admin/conversions" element={<AdminLayout><ConversionDashboard /></AdminLayout>} />
            <Route path="/admin/audit-logs" element={<AdminLayout><AuditLogs /></AdminLayout>} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
