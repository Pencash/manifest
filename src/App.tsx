import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import AdminAuth from "./pages/AdminAuth";
import MemberAuth from "./pages/MemberAuth";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import EventsManagement from "./pages/EventsManagement";
import AttendanceLog from "./pages/AttendanceLog";
import ReceiptVerification from "./pages/ReceiptVerification";
import Give from "./pages/Give";
import History from "./pages/History";
import Testimony from "./pages/Testimony";
import Prayer from "./pages/Prayer";
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
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/events" element={<EventsManagement />} />
          <Route path="/admin/attendance/:serviceId" element={<AttendanceLog />} />
          <Route path="/admin/receipts" element={<ReceiptVerification />} />
          <Route path="/give" element={<Give />} />
          <Route path="/history" element={<History />} />
          <Route path="/testimony" element={<Testimony />} />
          <Route path="/prayer" element={<Prayer />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
