const NOTIFICATION_EVENT = "notification-counts-changed";

export const triggerNotificationRefresh = () => {
  window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT));
};

export const subscribeToNotificationRefresh = (callback: () => void) => {
  window.addEventListener(NOTIFICATION_EVENT, callback);
  return () => window.removeEventListener(NOTIFICATION_EVENT, callback);
};

