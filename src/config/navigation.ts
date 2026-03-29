import { Home, DollarSign, MessageSquare, HandHeart, History, Users, Calendar, FileText, Receipt, UserCog, TrendingUp, FolderOpen, Shield, FileCheck, Clock, Settings, Sparkles } from "lucide-react";
import { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  badge?: string;
  notificationCount?: number;
}

export const memberNavItems: NavItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: Home },
  { label: "Give", path: "/give", icon: DollarSign },
  { label: "Prayer", path: "/prayer", icon: MessageSquare },
  { label: "Testimony", path: "/testimony", icon: HandHeart },
  { label: "History", path: "/history", icon: History },
  { label: "Mobilization", path: "/mobilization", icon: Users },
  { label: "Settings", path: "/settings", icon: Settings },
];

export const adminNavItems: NavItem[] = [
  { label: "Dashboard", path: "/admin/dashboard", icon: Home },
  
  // Conversion Tracking
  { label: "Conversion Dashboard", path: "/admin/conversions", icon: Sparkles, badge: "New" },
  
  // Financial Management
  { label: "Payment Verification", path: "/admin/givings", icon: DollarSign },
  { label: "Record Offline Giving", path: "/admin/givings/offline", icon: FileText },
  { label: "Financial Reports", path: "/admin/reports/financial", icon: TrendingUp },
  
  // Expense Management
  { label: "New Expense", path: "/admin/expenses/request", icon: FileText },
  { label: "All Expenses", path: "/admin/expenses/all", icon: Receipt },
  { label: "Expense Approvals", path: "/admin/expenses/pending", icon: FileCheck },
  { label: "Expense Categories", path: "/admin/expenses/categories", icon: FolderOpen },
  
  // Events & Attendance
  { label: "Events", path: "/admin/events", icon: Calendar },
  { label: "Pending Services", path: "/admin/pending-services", icon: Clock },
  { label: "Attendance", path: "/admin/reports/attendance", icon: Users },
  
  // Administration
  { label: "Users", path: "/admin/users", icon: UserCog },
  { label: "Mobilization", path: "/admin/mobilization", icon: Users },
];
