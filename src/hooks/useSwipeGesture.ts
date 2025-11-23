import { useState } from 'react';
import { useGesture } from 'react-use-gesture';

interface UseSwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

export const useSwipeGesture = ({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
}: UseSwipeGestureOptions) => {
  const [isSwipping, setIsSwipping] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const bind = useGesture({
    onDrag: ({ movement, last, velocity }) => {
      const mx = Array.isArray(movement) ? movement[0] : 0;
      const vx = Array.isArray(velocity) ? velocity[0] : 0;
      
      if (!last) {
        setIsSwipping(true);
        setSwipeOffset(mx);
      } else {
        setIsSwipping(false);
        setSwipeOffset(0);

        // Detect swipe based on velocity and distance
        if (Math.abs(mx) > threshold || Math.abs(vx) > 0.5) {
          if (mx < -threshold && onSwipeLeft) {
            onSwipeLeft();
          } else if (mx > threshold && onSwipeRight) {
            onSwipeRight();
          }
        }
      }
    },
  });

  return {
    bind,
    isSwipping,
    swipeOffset,
  };
};
