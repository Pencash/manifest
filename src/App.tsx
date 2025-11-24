import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import LoadingFallback from "./components/LoadingFallback";
import PageLoadingFallback from "./components/PageLoadingFallback";

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
            <Route path="/dashboard" element={<MemberLayout><Suspense fallback={<PageLoadingFallback />}><Dashboard /></Suspense></MemberLayout>} />
            <Route path="/give" element={<MemberLayout><Suspense fallback={<PageLoadingFallback />}><Give /></Suspense></MemberLayout>} />
            <Route path="/history" element={<MemberLayout><Suspense fallback={<PageLoadingFallback />}><History /></Suspense></MemberLayout>} />
            <Route path="/testimony" element={<MemberLayout><Suspense fallback={<PageLoadingFallback />}><Testimony /></Suspense></MemberLayout>} />
            <Route path="/prayer" element={<MemberLayout><Suspense fallback={<PageLoadingFallback />}><Prayer /></Suspense></MemberLayout>} />
            <Route path="/mobilization" element={<MemberLayout><Suspense fallback={<PageLoadingFallback />}><MemberMobilization /></Suspense></MemberLayout>} />
            <Route path="/settings" element={<MemberLayout><Suspense fallback={<PageLoadingFallback />}><Settings /></Suspense></MemberLayout>} />
            
            {/* Admin Routes */}
            <Route path="/admin/dashboard" element={<AdminLayout><Suspense fallback={<PageLoadingFallback />}><AdminDashboard /></Suspense></AdminLayout>} />
            <Route path="/admin/events" element={<AdminLayout><Suspense fallback={<PageLoadingFallback />}><EventsManagement /></Suspense></AdminLayout>} />
            <Route path="/admin/pending-services" element={<AdminLayout><Suspense fallback={<PageLoadingFallback />}><AdminPendingServices /></Suspense></AdminLayout>} />
            <Route path="/admin/attendance/:serviceId" element={<AdminLayout><Suspense fallback={<PageLoadingFallback />}><AttendanceLog /></Suspense></AdminLayout>} />
            <Route path="/admin/attendance/:serviceId/bulk-import" element={<AdminLayout><Suspense fallback={<PageLoadingFallback />}><BulkAttendanceImport /></Suspense></AdminLayout>} />
            <Route path="/admin/reports/attendance" element={<AdminLayout><Suspense fallback={<PageLoadingFallback />}><AttendanceReport /></Suspense></AdminLayout>} />
            <Route path="/admin/reports/financial" element={<AdminLayout><Suspense fallback={<PageLoadingFallback />}><FinancialReports /></Suspense></AdminLayout>} />
            <Route path="/admin/givings" element={<AdminLayout><Suspense fallback={<PageLoadingFallback />}><AdminGivings /></Suspense></AdminLayout>} />
            <Route path="/admin/expenses/request" element={<AdminLayout><Suspense fallback={<PageLoadingFallback />}><ExpenseRequest /></Suspense></AdminLayout>} />
            <Route path="/admin/expenses/all" element={<AdminLayout><Suspense fallback={<PageLoadingFallback />}><AdminExpenseRequests /></Suspense></AdminLayout>} />
            <Route path="/admin/expenses/categories" element={<AdminLayout><Suspense fallback={<PageLoadingFallback />}><ExpenseCategories /></Suspense></AdminLayout>} />
            <Route path="/admin/expenses/pending" element={<AdminLayout><Suspense fallback={<PageLoadingFallback />}><PendingExpenseApprovals /></Suspense></AdminLayout>} />
            <Route path="/admin/reminders" element={<AdminLayout><Suspense fallback={<PageLoadingFallback />}><EventReminders /></Suspense></AdminLayout>} />
            <Route path="/admin/visitor-followup" element={<AdminLayout><Suspense fallback={<PageLoadingFallback />}><VisitorFollowup /></Suspense></AdminLayout>} />
            <Route path="/admin/users" element={<AdminLayout><Suspense fallback={<PageLoadingFallback />}><UserManagement /></Suspense></AdminLayout>} />
            <Route path="/admin/mobilization" element={<AdminLayout><Suspense fallback={<PageLoadingFallback />}><MobilizationReport /></Suspense></AdminLayout>} />
            <Route path="/admin/conversions" element={<AdminLayout><Suspense fallback={<PageLoadingFallback />}><ConversionDashboard /></Suspense></AdminLayout>} />
            <Route path="/admin/audit-logs" element={<AdminLayout><Suspense fallback={<PageLoadingFallback />}><AuditLogs /></Suspense></AdminLayout>} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
