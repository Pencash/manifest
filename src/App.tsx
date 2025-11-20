import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MemberLayout } from "./layouts/MemberLayout";
import { AdminLayout } from "./layouts/AdminLayout";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import AdminAuth from "./pages/AdminAuth";
import MemberAuth from "./pages/MemberAuth";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import EventsManagement from "./pages/EventsManagement";
import AttendanceLog from "./pages/AttendanceLog";
import BulkAttendanceImport from "./pages/BulkAttendanceImport";
import AttendanceReport from "./pages/AttendanceReport";
import EventReminders from "./pages/EventReminders";
import VisitorFollowup from "./pages/VisitorFollowup";
import UserManagement from "./pages/UserManagement";
import FinancialReports from "./pages/FinancialReports";
import ExpenseCategories from "./pages/ExpenseCategories";
import ExpenseRequest from "./pages/ExpenseRequest";
import AdminExpenseRequests from "./pages/AdminExpenseRequests";
import PendingExpenseApprovals from "./pages/PendingExpenseApprovals";
import AdminGivings from "./pages/AdminGivings";
import AdminPendingServices from "./pages/AdminPendingServices";
import Give from "./pages/Give";
import History from "./pages/History";
import Testimony from "./pages/Testimony";
import Prayer from "./pages/Prayer";
import MemberMobilization from "./pages/MemberMobilization";
import MobilizationReport from "./pages/MobilizationReport";
import AuditLogs from "./pages/AuditLogs";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
          <Route path="/admin/audit-logs" element={<AdminLayout><AuditLogs /></AdminLayout>} />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
