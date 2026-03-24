import { format } from "date-fns";

export const currencySafe = (value?: string | null) => value || "MWK";

export const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  return format(new Date(value), "dd MMM yyyy, HH:mm");
};

export const formatDateOnly = (value?: string | null) => {
  if (!value) return "—";
  return format(new Date(value), "dd MMM yyyy");
};

export const formatFileSize = (value?: number | null) => {
  if (!value || value <= 0) return "Unknown size";

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

export const formatMethodLabel = (value?: string | null) => {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

export const statusBadgeClasses: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  pending: "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-900",
  approved: "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-300 dark:border-blue-900",
  partially_paid: "bg-violet-500/10 text-violet-700 border-violet-200 dark:text-violet-300 dark:border-violet-900",
  paid: "bg-green-500/10 text-green-700 border-green-200 dark:text-green-300 dark:border-green-900",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  changes_requested: "bg-orange-500/10 text-orange-700 border-orange-200 dark:text-orange-300 dark:border-orange-900",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export const priorityBadgeClasses: Record<string, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-primary/10 text-primary border-primary/20",
  high: "bg-orange-500/10 text-orange-700 border-orange-200 dark:text-orange-300 dark:border-orange-900",
  urgent: "bg-destructive/10 text-destructive border-destructive/20",
};

export const approvalBadgeClasses: Record<string, string> = {
  approved: "bg-green-500/10 text-green-700 border-green-200 dark:text-green-300 dark:border-green-900",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  changes_requested: "bg-orange-500/10 text-orange-700 border-orange-200 dark:text-orange-300 dark:border-orange-900",
};
