import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface BulkAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  disabled?: boolean;
}

interface BulkActionBarProps {
  selectedCount: number;
  onSelectAll?: () => void;
  onClearSelection: () => void;
  actions: BulkAction[];
  className?: string;
}

export const BulkActionBar = ({
  selectedCount,
  onSelectAll,
  onClearSelection,
  actions,
  className,
}: BulkActionBarProps) => {
  if (selectedCount === 0) return null;

  return (
    <div className={cn(
      "bg-primary/10 border border-primary/20 rounded-lg p-4 mb-4",
      "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
      className
    )}>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">
          {selectedCount} item{selectedCount !== 1 ? "s" : ""} selected
        </span>
        <div className="flex gap-2">
          {onSelectAll && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSelectAll}
            >
              Select All
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
          >
            Clear Selection
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Button
              key={index}
              variant={action.variant || "default"}
              size="sm"
              onClick={action.onClick}
              disabled={action.disabled}
            >
              <Icon className="h-4 w-4 mr-2" />
              {action.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
};
