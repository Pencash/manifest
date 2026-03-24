import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import LoadingFallback from "./components/LoadingFallback";
import SupabaseEnvAlert from "./components/SupabaseEnvAlert";
import { getMissingSupabaseEnvVars } from "./lib/env";
import { PageMetadataManager } from "./components/PageMetadataManager";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "@/components/routing/ProtectedRoute";
import { RoleRoute } from "@/components/routing/RoleRoute";

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
const AdminExpenseRequestDetails = lazy(() => import("./pages/AdminExpenseRequestDetails"));
const AdminGivings = lazy(() => import("./pages/AdminGivings"));
const MobilizationReport = lazy(() => import("./pages/MobilizationReport"));
const MemberInvitationsDetail = lazy(() => import("./pages/MemberInvitationsDetail"));
const ServiceMobilizationDetail = lazy(() => import("./pages/ServiceMobilizationDetail"));
const ConversionDashboard = lazy(() => import("./pages/ConversionDashboard"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));

// 404 page
const NotFound = lazy(() => import("./pages/NotFound"));

// Configure QueryClient with caching for performance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data considered fresh
      gcTime: 10 * 60 * 1000, // 10 minutes - cache retention
      refetchOnWindowFocus: false, // Don't refetch when tab regains focus
      retry: 1, // Only retry once on failure
    },
  },
});

const App = () => {
  const missingSupabaseEnvVars = getMissingSupabaseEnvVars();

  if (missingSupabaseEnvVars.length) {
    return <SupabaseEnvAlert />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <PageMetadataManager />
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/admin/auth" element={<AdminAuth />} />
                <Route path="/member/auth" element={<MemberAuth />} />

                {/* Member Routes */}
                <Route path="/dashboard" element={<ProtectedRoute redirectTo="/member/auth"><MemberLayout><Dashboard /></MemberLayout></ProtectedRoute>} />
                <Route path="/give" element={<ProtectedRoute redirectTo="/member/auth"><MemberLayout><Give /></MemberLayout></ProtectedRoute>} />
                <Route path="/history" element={<ProtectedRoute redirectTo="/member/auth"><MemberLayout><History /></MemberLayout></ProtectedRoute>} />
                <Route path="/testimony" element={<ProtectedRoute redirectTo="/member/auth"><MemberLayout><Testimony /></MemberLayout></ProtectedRoute>} />
                <Route path="/prayer" element={<ProtectedRoute redirectTo="/member/auth"><MemberLayout><Prayer /></MemberLayout></ProtectedRoute>} />
                <Route path="/mobilization" element={<ProtectedRoute redirectTo="/member/auth"><MemberLayout><MemberMobilization /></MemberLayout></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute redirectTo="/member/auth"><MemberLayout><Settings /></MemberLayout></ProtectedRoute>} />

                {/* Admin Routes */}
                <Route path="/admin/dashboard" element={<RoleRoute allowedRoles={["admin", "finance", "pastor"]}><AdminLayout><AdminDashboard /></AdminLayout></RoleRoute>} />
                <Route path="/admin/events" element={<RoleRoute allowedRoles={["admin", "finance", "pastor"]}><AdminLayout><EventsManagement /></AdminLayout></RoleRoute>} />
                <Route path="/admin/pending-services" element={<RoleRoute allowedRoles={["admin", "finance", "pastor"]}><AdminLayout><AdminPendingServices /></AdminLayout></RoleRoute>} />
                <Route path="/admin/attendance/:serviceId" element={<RoleRoute allowedRoles={["admin", "finance", "pastor"]}><AdminLayout><AttendanceLog /></AdminLayout></RoleRoute>} />
                <Route path="/admin/attendance/:serviceId/bulk-import" element={<RoleRoute allowedRoles={["admin", "finance", "pastor"]}><AdminLayout><BulkAttendanceImport /></AdminLayout></RoleRoute>} />
                <Route path="/admin/reports/attendance" element={<RoleRoute allowedRoles={["admin", "finance", "pastor"]}><AdminLayout><AttendanceReport /></AdminLayout></RoleRoute>} />
                <Route path="/admin/reports/financial" element={<RoleRoute allowedRoles={["admin", "finance", "pastor"]}><AdminLayout><FinancialReports /></AdminLayout></RoleRoute>} />
                <Route path="/admin/givings" element={<RoleRoute allowedRoles={["admin", "finance", "pastor"]}><AdminLayout><AdminGivings /></AdminLayout></RoleRoute>} />
                <Route path="/admin/expenses/request" element={<RoleRoute allowedRoles={["admin", "finance", "pastor"]}><AdminLayout><ExpenseRequest /></AdminLayout></RoleRoute>} />
                <Route path="/admin/expenses/all" element={<RoleRoute allowedRoles={["admin", "finance", "pastor"]}><AdminLayout><AdminExpenseRequests /></AdminLayout></RoleRoute>} />
                <Route path="/admin/expenses/:expenseId" element={<RoleRoute allowedRoles={["admin", "finance", "pastor"]}><AdminLayout><AdminExpenseRequestDetails /></AdminLayout></RoleRoute>} />
                <Route path="/admin/expenses/categories" element={<RoleRoute allowedRoles={["admin", "finance", "pastor"]}><AdminLayout><ExpenseCategories /></AdminLayout></RoleRoute>} />
                <Route path="/admin/expenses/pending" element={<RoleRoute allowedRoles={["admin", "finance", "pastor"]}><AdminLayout><PendingExpenseApprovals /></AdminLayout></RoleRoute>} />
                <Route path="/admin/reminders" element={<RoleRoute allowedRoles={["admin", "finance", "pastor"]}><AdminLayout><EventReminders /></AdminLayout></RoleRoute>} />
                <Route path="/admin/visitor-followup" element={<RoleRoute allowedRoles={["admin", "finance", "pastor"]}><AdminLayout><VisitorFollowup /></AdminLayout></RoleRoute>} />
                <Route path="/admin/users" element={<RoleRoute allowedRoles={["admin", "finance", "pastor"]}><AdminLayout><UserManagement /></AdminLayout></RoleRoute>} />
                <Route path="/admin/mobilization" element={<RoleRoute allowedRoles={["admin", "finance", "pastor"]}><AdminLayout><MobilizationReport /></AdminLayout></RoleRoute>} />
                <Route path="/admin/mobilization/member/:memberId" element={<RoleRoute allowedRoles={["admin", "finance", "pastor"]}><AdminLayout><MemberInvitationsDetail /></AdminLayout></RoleRoute>} />
                <Route path="/admin/mobilization/service/:serviceId" element={<RoleRoute allowedRoles={["admin", "finance", "pastor"]}><AdminLayout><ServiceMobilizationDetail /></AdminLayout></RoleRoute>} />
                <Route path="/admin/conversions" element={<RoleRoute allowedRoles={["admin", "finance", "pastor"]}><AdminLayout><ConversionDashboard /></AdminLayout></RoleRoute>} />
                <Route path="/admin/audit-logs" element={<RoleRoute allowedRoles={["admin", "finance", "pastor"]}><AdminLayout><AuditLogs /></AdminLayout></RoleRoute>} />

                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
