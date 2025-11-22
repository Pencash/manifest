interface NotificationBadgeProps {
  count: number;
  variant?: "default" | "warning";
}

export const NotificationBadge = ({ count, variant = "default" }: NotificationBadgeProps) => {
  if (count <= 0) return null;

  return (
    <span
      className={`absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[0.625rem] font-bold text-white ${
        variant === "warning" ? "bg-amber-500" : "bg-destructive"
      }`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
};
