"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";
import { Id } from "../../convex/_generated/dataModel";

/**
 * Hook for notification center functionality.
 * Provides notification list, unread counts, and actions.
 */
export function useNotifications(options?: { limit?: number; includeRead?: boolean }) {
  const { user } = useCurrentUser();
  const limit = options?.limit ?? 50;
  const includeRead = options?.includeRead ?? true;

  // Queries
  const notifications = useQuery(
    api.notifications.list,
    user?._id ? { limit, includeRead } : "skip"
  );

  const unreadCounts = useQuery(
    api.notifications.getUnreadCount,
    user?._id ? {} : "skip"
  );

  // Mutations
  const markAsReadMutation = useMutation(api.notifications.markAsRead);
  const markAllAsReadMutation = useMutation(api.notifications.markAllAsRead);
  const dismissMutation = useMutation(api.notifications.dismiss);

  const isLoading = user && notifications === undefined;

  // Actions
  const markAsRead = async (notificationId: Id<"notifications">) => {
    return await markAsReadMutation({ notificationId });
  };

  const markAllAsRead = async () => {
    return await markAllAsReadMutation({});
  };

  const dismiss = async (notificationId: Id<"notifications">) => {
    return await dismissMutation({ notificationId });
  };

  return {
    notifications: notifications ?? [],
    unreadCounts: unreadCounts ?? { offerte: 0, chat: 0, project: 0, system: 0, total: 0 },
    isLoading,
    hasUnread: (unreadCounts?.total ?? 0) > 0,
    markAsRead,
    markAllAsRead,
    dismiss,
  };
}

/**
 * Hook for just the unread count (lightweight, for badge display).
 */
export function useUnreadNotificationCount() {
  const { user } = useCurrentUser();

  const unreadCounts = useQuery(
    api.notifications.getUnreadCount,
    user?._id ? {} : "skip"
  );

  return {
    total: unreadCounts?.total ?? 0,
    offerte: unreadCounts?.offerte ?? 0,
    chat: unreadCounts?.chat ?? 0,
    project: unreadCounts?.project ?? 0,
    system: unreadCounts?.system ?? 0,
    isLoading: user && unreadCounts === undefined,
  };
}
