/**
 * Push Notifications Hook
 *
 * Manages push notification lifecycle:
 * - Requests permission on mount
 * - Registers token with Convex backend
 * - Sets up notification listeners
 * - Handles notification taps for navigation
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { useMutation } from "convex/react";
import * as Notifications from "expo-notifications";
import { api } from "../convex/_generated/api";
import {
  requestNotificationPermission,
  getExpoPushToken,
  getDevicePlatform,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  getLastNotificationResponse,
  isPushNotificationsAvailable,
  NotificationData,
} from "../lib/notifications/push";
import { useCurrentUser } from "./use-current-user";

export type PushNotificationState = {
  /** Whether push notifications are enabled and registered */
  isEnabled: boolean;
  /** Whether we're currently setting up notifications */
  isLoading: boolean;
  /** The Expo push token (if available) */
  pushToken: string | null;
  /** Any error that occurred during setup */
  error: string | null;
  /** Manually request permission and register token */
  requestPermission: () => Promise<boolean>;
};

export function usePushNotifications(): PushNotificationState {
  const router = useRouter();
  const { isAuthenticated, isLoading: isUserLoading } = useCurrentUser();
  const updateNotificationPreferences = useMutation(
    api.chat.updateNotificationPreferences
  );

  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track if we've already initialized
  const hasInitialized = useRef(false);

  // Subscriptions ref to clean up on unmount
  const notificationReceivedSubscription =
    useRef<Notifications.Subscription | null>(null);
  const notificationResponseSubscription =
    useRef<Notifications.Subscription | null>(null);

  /**
   * Handle notification tap - navigate to appropriate screen
   */
  const handleNotificationTap = useCallback(
    (data: NotificationData) => {
      console.log("[usePushNotifications] Notification tapped:", data);

      // Navigate based on notification type/data
      if (data.type === "chat" || data.channelType) {
        switch (data.channelType) {
          case "direct":
            // Navigate to direct message conversation
            if (data.senderId) {
              router.push(`/(tabs)/chat?dm=${data.senderId}`);
            } else {
              router.push("/(tabs)/chat");
            }
            break;
          case "project":
            // Navigate to project chat
            if (data.projectId) {
              router.push(`/(tabs)/chat?project=${data.projectId}`);
            } else {
              router.push("/(tabs)/chat");
            }
            break;
          case "team":
          case "broadcast":
          default:
            // Navigate to team chat
            router.push("/(tabs)/chat");
            break;
        }
      } else if (data.type === "project" && data.projectId) {
        // Navigate to project details
        router.push(`/(tabs)/projecten/${data.projectId}`);
      } else {
        // Default: navigate to home/dashboard
        router.push("/(tabs)");
      }
    },
    [router]
  );

  /**
   * Request permission and register push token with backend
   */
  const requestPermissionAndRegister = useCallback(async (): Promise<boolean> => {
    // Check if push notifications are available in this environment
    if (!isPushNotificationsAvailable()) {
      // Silently skip in Expo Go or on simulators - this is expected behavior
      setIsLoading(false);
      setIsEnabled(false);
      // Don't set an error - this is normal in development
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Request permission
      const permissionGranted = await requestNotificationPermission();
      if (!permissionGranted) {
        setIsEnabled(false);
        setError("Notificatie permissie geweigerd");
        return false;
      }

      // Get push token
      const token = await getExpoPushToken();
      if (!token) {
        setIsEnabled(false);
        setError("Kon geen push token verkrijgen");
        return false;
      }

      setPushToken(token);

      // Register token with backend
      const platform = getDevicePlatform();
      await updateNotificationPreferences({
        enablePushNotifications: true,
        deviceToken: token,
        devicePlatform: platform,
      });

      console.log(
        "[usePushNotifications] Token registered with backend:",
        token.substring(0, 20) + "..."
      );

      setIsEnabled(true);
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Onbekende fout bij registratie";
      console.error("[usePushNotifications] Registration failed:", err);
      setError(errorMessage);
      setIsEnabled(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [updateNotificationPreferences]);

  /**
   * Initialize push notifications on mount
   */
  useEffect(() => {
    // Wait for user authentication to complete
    if (isUserLoading) {
      return;
    }

    // Only initialize once and only if authenticated
    if (!isAuthenticated || hasInitialized.current) {
      setIsLoading(false);
      return;
    }

    hasInitialized.current = true;

    // Setup push notifications
    requestPermissionAndRegister();

    // Check if app was opened from a notification
    getLastNotificationResponse().then((response) => {
      if (response) {
        console.log(
          "[usePushNotifications] App opened from notification:",
          response
        );
        const data = response.notification.request.content
          .data as NotificationData;
        if (data) {
          // Small delay to ensure navigation is ready
          setTimeout(() => handleNotificationTap(data), 500);
        }
      }
    });
  }, [isAuthenticated, isUserLoading, requestPermissionAndRegister, handleNotificationTap]);

  /**
   * Setup notification listeners
   */
  useEffect(() => {
    // Listen for incoming notifications (foreground)
    notificationReceivedSubscription.current = addNotificationReceivedListener(
      (notification) => {
        console.log(
          "[usePushNotifications] Notification received in foreground:",
          notification.request.content
        );
        // Could update UI here (e.g., show badge, update unread count)
      }
    );

    // Listen for notification taps
    notificationResponseSubscription.current =
      addNotificationResponseReceivedListener((response) => {
        console.log(
          "[usePushNotifications] Notification response:",
          response.actionIdentifier
        );
        const data = response.notification.request.content
          .data as NotificationData;
        if (data) {
          handleNotificationTap(data);
        }
      });

    // Cleanup subscriptions on unmount
    return () => {
      if (notificationReceivedSubscription.current) {
        notificationReceivedSubscription.current.remove();
      }
      if (notificationResponseSubscription.current) {
        notificationResponseSubscription.current.remove();
      }
    };
  }, [handleNotificationTap]);

  return {
    isEnabled,
    isLoading,
    pushToken,
    error,
    requestPermission: requestPermissionAndRegister,
  };
}
