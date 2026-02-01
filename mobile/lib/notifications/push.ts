/**
 * Push Notifications Module
 *
 * Handles Expo push notifications setup, permission requests,
 * token registration, and notification handling.
 *
 * Note: Push notifications are not supported in Expo Go (SDK 53+).
 * They work in development builds and production builds.
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * Check if push notifications are available in the current environment.
 * Returns false in Expo Go or on simulators.
 */
export function isPushNotificationsAvailable(): boolean {
  // Not available on simulators/emulators
  if (!Device.isDevice) {
    return false;
  }

  // Check if running in Expo Go (push notifications not supported in SDK 53+)
  const isExpoGo = Constants.appOwnership === "expo";
  if (isExpoGo) {
    return false;
  }

  return true;
}

// Configure how notifications should be displayed when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type NotificationData = {
  type?: "chat" | "project" | "announcement" | "general";
  channelType?: "team" | "project" | "direct" | "broadcast";
  projectId?: string;
  messageId?: string;
  senderId?: string;
  [key: string]: unknown;
};

export type PushNotificationContent = {
  title: string;
  body: string;
  data?: NotificationData;
};

/**
 * Request permission for push notifications.
 * Returns the permission status.
 * Silently returns false in Expo Go or on simulators.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  // Check if push notifications are available
  if (!isPushNotificationsAvailable()) {
    // Silently skip in Expo Go or on simulators - no warning needed
    return false;
  }

  // Check current permission status
  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;

  // Request permission if not already granted
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("[PushNotifications] Permission not granted");
    return false;
  }

  // Configure Android notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#22C55E", // Green color matching app theme
    });

    // Create additional channels for different notification types
    await Notifications.setNotificationChannelAsync("chat", {
      name: "Chat Berichten",
      description: "Notificaties voor chat berichten",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#22C55E",
    });

    await Notifications.setNotificationChannelAsync("announcements", {
      name: "Aankondigingen",
      description: "Belangrijke aankondigingen van het bedrijf",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#22C55E",
    });
  }

  return true;
}

/**
 * Get the Expo push token for this device.
 * Returns null if unable to get token.
 * Silently returns null in Expo Go or on simulators.
 */
export async function getExpoPushToken(): Promise<string | null> {
  // Check if push notifications are available
  if (!isPushNotificationsAvailable()) {
    // Silently skip in Expo Go or on simulators - no warning needed
    return null;
  }

  try {
    // Get project ID from Expo config
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.error(
        "[PushNotifications] No Expo project ID found. Make sure EAS is configured."
      );
      return null;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    console.log("[PushNotifications] Push token obtained:", tokenResponse.data);
    return tokenResponse.data;
  } catch (error) {
    console.error("[PushNotifications] Failed to get push token:", error);
    return null;
  }
}

/**
 * Get the device platform for registration.
 */
export function getDevicePlatform(): "ios" | "android" | "web" {
  switch (Platform.OS) {
    case "ios":
      return "ios";
    case "android":
      return "android";
    default:
      return "web";
  }
}

/**
 * Add a listener for incoming notifications (when app is in foreground).
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add a listener for notification responses (when user taps notification).
 */
export function addNotificationResponseReceivedListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Get the last notification response (for handling notifications that opened the app).
 */
export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  return await Notifications.getLastNotificationResponseAsync();
}

/**
 * Schedule a local notification (useful for testing).
 */
export async function scheduleLocalNotification(
  content: PushNotificationContent,
  trigger?: Notifications.NotificationTriggerInput
): Promise<string> {
  return await Notifications.scheduleNotificationAsync({
    content: {
      title: content.title,
      body: content.body,
      data: content.data,
    },
    trigger: trigger ?? null, // null = immediately
  });
}

/**
 * Cancel all scheduled notifications.
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get the current badge count.
 */
export async function getBadgeCount(): Promise<number> {
  return await Notifications.getBadgeCountAsync();
}

/**
 * Set the badge count.
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear the badge count.
 */
export async function clearBadgeCount(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}

/**
 * Dismiss all delivered notifications.
 */
export async function dismissAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
}
