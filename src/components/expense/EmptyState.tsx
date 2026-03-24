import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const EmptyState = ({ icon: Icon, title, description }: EmptyStateProps) => (
  <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
    <Icon className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
    <h3 className="text-lg font-semibold">{title}</h3>
    <p className="mt-2 text-sm text-muted-foreground">{description}</p>
  </div>
);
