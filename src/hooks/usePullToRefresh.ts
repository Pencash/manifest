import { useState, useCallback } from 'react';
import { useGesture } from 'react-use-gesture';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
}

export const usePullToRefresh = ({ onRefresh, threshold = 80 }: UsePullToRefreshOptions) => {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const bind = useGesture({
    onDrag: ({ movement: [, my], first, last, memo = 0 }) => {
      // Only allow pull down when at top of page
      if (first && window.scrollY > 0) return memo;
      
      if (my > 0 && my < threshold * 2) {
        setIsPulling(true);
        setPullDistance(my);
      }

      if (last) {
        if (my > threshold && !isRefreshing) {
          setIsRefreshing(true);
          onRefresh().finally(() => {
            setIsRefreshing(false);
            setIsPulling(false);
            setPullDistance(0);
          });
        } else {
          setIsPulling(false);
          setPullDistance(0);
        }
      }

      return memo;
    },
  });

  return {
    bind,
    isPulling,
    pullDistance,
    isRefreshing,
    threshold,
  };
};
