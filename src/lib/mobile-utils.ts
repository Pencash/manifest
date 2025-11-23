/**
 * Mobile-specific utility functions
 */

/**
 * Check if device supports touch
 */
export const isTouchDevice = (): boolean => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

/**
 * Trigger haptic feedback on supported devices
 */
export const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
  if ('vibrate' in navigator) {
    const patterns = {
      light: 10,
      medium: 20,
      heavy: 30,
    };
    navigator.vibrate(patterns[type]);
  }
};

/**
 * Prevent default touch behavior
 */
export const preventDefault = (e: TouchEvent) => {
  e.preventDefault();
};

/**
 * Get viewport height accounting for mobile browser chrome
 */
export const getViewportHeight = (): number => {
  return window.visualViewport?.height || window.innerHeight;
};

/**
 * Scroll element into view with mobile-friendly options
 */
export const scrollIntoView = (element: HTMLElement, options?: ScrollIntoViewOptions) => {
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    ...options,
  });
};

/**
 * Format phone number for tel: links
 */
export const formatPhoneLink = (phone: string): string => {
  return `tel:${phone.replace(/\s+/g, '')}`;
};

/**
 * Check if keyboard is likely visible (iOS)
 */
export const isKeyboardVisible = (): boolean => {
  const viewport = window.visualViewport;
  if (!viewport) return false;
  return viewport.height < window.innerHeight * 0.75;
};
