import { ReactNode } from 'react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { Loader2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  threshold?: number;
}

export const PullToRefresh = ({ onRefresh, children, threshold = 80 }: PullToRefreshProps) => {
  const isMobile = useIsMobile();
  const { bind, isPulling, pullDistance, isRefreshing, threshold: th } = usePullToRefresh({
    onRefresh,
    threshold,
  });

  if (!isMobile) {
    return <>{children}</>;
  }

  const pullProgress = Math.min(pullDistance / th, 1);
  const shouldRelease = pullDistance >= th;

  return (
    <div {...bind()} className="relative">
      {/* Pull indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center transition-all duration-200 z-50"
        style={{
          height: `${Math.min(pullDistance, th)}px`,
          opacity: pullProgress,
        }}
      >
        <div className="bg-background/95 backdrop-blur-sm rounded-full p-2 shadow-lg border">
          {isRefreshing ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <div
              className="h-5 w-5 rounded-full border-2 border-primary transition-transform"
              style={{
                transform: `rotate(${pullProgress * 360}deg)`,
                borderTopColor: shouldRelease ? 'hsl(var(--primary))' : 'transparent',
              }}
            />
          )}
        </div>
        <span className="ml-2 text-sm font-medium text-foreground">
          {isRefreshing ? 'Refreshing...' : shouldRelease ? 'Release to refresh' : 'Pull to refresh'}
        </span>
      </div>

      {/* Content */}
      <div
        style={{
          transform: isPulling ? `translateY(${Math.min(pullDistance / 2, th / 2)}px)` : 'translateY(0)',
          transition: isPulling ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
};
