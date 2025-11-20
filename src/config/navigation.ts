import { Home, DollarSign, MessageSquare, HandHeart, History, Users, Calendar, FileText, Receipt, UserCog, TrendingUp, FolderOpen, Shield, FileCheck } from "lucide-react";
import { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  badge?: string;
}

export const memberNavItems: NavItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: Home },
  { label: "Give", path: "/give", icon: DollarSign },
  { label: "Prayer", path: "/prayer", icon: MessageSquare },
  { label: "Testimony", path: "/testimony", icon: HandHeart },
  { label: "History", path: "/history", icon: History },
  { label: "Mobilization", path: "/mobilization", icon: Users },
];

export const adminNavItems: NavItem[] = [
  { label: "Dashboard", path: "/admin/dashboard", icon: Home },
  { label: "Events", path: "/admin/events", icon: Calendar },
  { label: "Attendance", path: "/admin/reports/attendance", icon: Users },
  { label: "Givings", path: "/admin/givings", icon: DollarSign },
  { label: "Expense Requests", path: "/admin/expenses/request", icon: FileText },
  { label: "All Requests", path: "/admin/expenses/all", icon: Receipt },
  { label: "Categories", path: "/admin/expenses/categories", icon: FolderOpen },
  { label: "Pending Approvals", path: "/admin/expenses/pending", icon: FileCheck },
  { label: "Verifications", path: "/admin/verifications", icon: Shield },
  { label: "Reports", path: "/admin/reports/financial", icon: TrendingUp },
  { label: "Users", path: "/admin/users", icon: UserCog },
  { label: "Mobilization", path: "/admin/mobilization", icon: Users },
];
