/**
 * Notifications Module Exports
 *
 * Central export for push notification utilities.
 */

export {
  // Availability check
  isPushNotificationsAvailable,

  // Permission and token management
  requestNotificationPermission,
  getExpoPushToken,
  getDevicePlatform,

  // Notification listeners
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  getLastNotificationResponse,

  // Local notifications
  scheduleLocalNotification,
  cancelAllScheduledNotifications,

  // Badge management
  getBadgeCount,
  setBadgeCount,
  clearBadgeCount,

  // Notification management
  dismissAllNotifications,

  // Types
  type NotificationData,
  type PushNotificationContent,
} from "./push";
