"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";

/**
 * Hook that tracks when data has been updated and provides animation triggers.
 * Returns `isUpdating` which flashes true briefly when data changes.
 */
function useUpdateIndicator<T>(
  data: T | undefined,
  options?: {
    /** Duration in ms to show the update indicator (default: 500) */
    indicatorDuration?: number;
    /** Key to use for comparison (default: uses _updatedAt field) */
    compareKey?: keyof T;
    /** Whether to skip the first update (initial load) */
    skipInitial?: boolean;
  }
) {
  const {
    indicatorDuration = 500,
    compareKey = "_updatedAt" as keyof T,
    skipInitial = true,
  } = options || {};

  const [isUpdating, setIsUpdating] = useState(false);
  const prevValueRef = useRef<unknown>(undefined);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (data === undefined || data === null) return;

    const currentValue = (data as Record<string, unknown>)[compareKey as string];
    const prevValue = prevValueRef.current;

    // Check if this is an update (not initial load)
    if (prevValue !== undefined && currentValue !== prevValue) {
      // Skip the initial load if configured
      if (!(skipInitial && isFirstRender.current)) {
        setIsUpdating(true);
        const timer = setTimeout(() => setIsUpdating(false), indicatorDuration);
        return () => clearTimeout(timer);
      }
    }

    prevValueRef.current = currentValue;
    isFirstRender.current = false;
  }, [data, compareKey, indicatorDuration, skipInitial]);

  return isUpdating;
}

/**
 * Hook for real-time dashboard statistics with update indicators.
 * Provides live-updating stats with visual feedback when data changes.
 */
export function useRealtimeDashboardStats() {
  const { user } = useCurrentUser();

  const data = useQuery(api.realtime.getDashboardStats, user?._id ? {} : "skip");

  const isUpdating = useUpdateIndicator(data);

  // Track which specific stats have changed
  const [changedStats, setChangedStats] = useState<Set<string>>(new Set());
  const prevStatsRef = useRef<typeof data>(undefined);

  useEffect(() => {
    if (!data || !prevStatsRef.current) {
      prevStatsRef.current = data;
      return;
    }

    const changes = new Set<string>();

    // Check offerte stats changes
    if (data.offerteStats.totaal !== prevStatsRef.current.offerteStats.totaal) {
      changes.add("offertes");
    }
    if (data.offerteStats.geaccepteerdWaarde !== prevStatsRef.current.offerteStats.geaccepteerdWaarde) {
      changes.add("revenue");
    }

    // Check project stats changes
    if (data.projectStats.in_uitvoering !== prevStatsRef.current.projectStats.in_uitvoering) {
      changes.add("projects");
    }

    if (changes.size > 0) {
      setChangedStats(changes);
      const timer = setTimeout(() => setChangedStats(new Set()), 1000);
      prevStatsRef.current = data;
      return () => clearTimeout(timer);
    }

    prevStatsRef.current = data;
  }, [data]);

  return {
    data,
    isLoading: user && data === undefined,
    isUpdating,
    changedStats,
    // Helper to check if a specific stat just changed
    hasChanged: useCallback((stat: string) => changedStats.has(stat), [changedStats]),
  };
}

/**
 * Hook for real-time notification counts with badge updates.
 */
export function useRealtimeNotificationCounts() {
  const { user } = useCurrentUser();

  const data = useQuery(api.realtime.getNotificationCounts, user?._id ? {} : "skip");

  const isUpdating = useUpdateIndicator(data);

  // Track if count increased (for badge animation)
  const [countIncreased, setCountIncreased] = useState(false);
  const prevTotalRef = useRef<number>(0);

  useEffect(() => {
    if (data === undefined) return;

    if (data.total > prevTotalRef.current && prevTotalRef.current > 0) {
      setCountIncreased(true);
      const timer = setTimeout(() => setCountIncreased(false), 1000);
      prevTotalRef.current = data.total;
      return () => clearTimeout(timer);
    }

    prevTotalRef.current = data.total;
  }, [data]);

  return {
    counts: data,
    isLoading: user && data === undefined,
    isUpdating,
    countIncreased,
    hasNewNotifications: countIncreased,
  };
}

/**
 * Hook for real-time chat unread counts.
 */
export function useRealtimeChatCounts() {
  const { user } = useCurrentUser();

  const data = useQuery(api.realtime.getChatUnreadCounts, user?._id ? {} : "skip");

  const isUpdating = useUpdateIndicator(data);

  // Track if count increased
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const prevTotalRef = useRef<number>(0);

  useEffect(() => {
    if (data === undefined) return;

    if (data.total > prevTotalRef.current && prevTotalRef.current >= 0) {
      setHasNewMessages(true);
      const timer = setTimeout(() => setHasNewMessages(false), 2000);
      prevTotalRef.current = data.total;
      return () => clearTimeout(timer);
    }

    prevTotalRef.current = data.total;
  }, [data]);

  return {
    counts: data,
    isLoading: user && data === undefined,
    isUpdating,
    hasNewMessages,
  };
}

/**
 * Hook for real-time action items (dashboard alerts).
 */
export function useRealtimeActionItems() {
  const { user } = useCurrentUser();

  const data = useQuery(api.realtime.getActionItems, user?._id ? {} : "skip");

  const isUpdating = useUpdateIndicator(data);

  // Track changes in action items
  const [hasNewActions, setHasNewActions] = useState(false);
  const prevTotalRef = useRef<number>(0);

  useEffect(() => {
    if (data === undefined) return;

    if (data.total > prevTotalRef.current && prevTotalRef.current >= 0) {
      setHasNewActions(true);
      const timer = setTimeout(() => setHasNewActions(false), 2000);
      prevTotalRef.current = data.total;
      return () => clearTimeout(timer);
    }

    prevTotalRef.current = data.total;
  }, [data]);

  return {
    data,
    isLoading: user && data === undefined,
    isUpdating,
    hasNewActions,
    // Convenience accessors
    acceptedWithoutProject: data?.acceptedWithoutProject ?? 0,
    lowStockCount: data?.lowStockCount ?? 0,
    openInkooporders: data?.openInkooporders ?? 0,
    openQCChecks: data?.openQCChecks ?? 0,
  };
}

/**
 * Hook for real-time active projects.
 */
export function useRealtimeActiveProjects(limit?: number) {
  const { user } = useCurrentUser();

  const data = useQuery(
    api.realtime.getActiveProjectsLive,
    user?._id ? { limit } : "skip"
  );

  const isUpdating = useUpdateIndicator(data);

  return {
    projects: data?.projects ?? [],
    isLoading: user && data === undefined,
    isUpdating,
  };
}

/**
 * Hook for real-time latest chat messages.
 */
export function useRealtimeLatestMessages(limit?: number) {
  const { user } = useCurrentUser();

  const data = useQuery(
    api.realtime.getLatestMessages,
    user?._id ? { limit } : "skip"
  );

  const isUpdating = useUpdateIndicator(data);

  // Track new messages
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const prevMessagesRef = useRef<string[]>([]);

  useEffect(() => {
    if (!data?.messages) return;

    const currentIds = data.messages.map((m) => m._id.toString());
    const prevIdsSet = new Set(prevMessagesRef.current);

    // Check if there are new messages not in the previous list
    const hasNew = currentIds.some((id) => !prevIdsSet.has(id));

    if (hasNew && prevMessagesRef.current.length > 0) {
      setHasNewMessages(true);
      const timer = setTimeout(() => setHasNewMessages(false), 2000);
      prevMessagesRef.current = currentIds;
      return () => clearTimeout(timer);
    }

    prevMessagesRef.current = currentIds;
  }, [data?.messages]);

  return {
    messages: data?.messages ?? [],
    isLoading: user && data === undefined,
    isUpdating,
    hasNewMessages,
  };
}

/**
 * Hook for real-time recent activity.
 */
export function useRealtimeActivity(limit?: number) {
  const { user } = useCurrentUser();

  const data = useQuery(
    api.realtime.getRecentActivity,
    user?._id ? { limit } : "skip"
  );

  const isUpdating = useUpdateIndicator(data);

  return {
    activities: data?.activities ?? [],
    isLoading: user && data === undefined,
    isUpdating,
  };
}

/**
 * Combined hook for all real-time dashboard data.
 * Use this for the main dashboard to get all live updates in one place.
 */
export function useRealtimeDashboard() {
  const stats = useRealtimeDashboardStats();
  const notifications = useRealtimeNotificationCounts();
  const chat = useRealtimeChatCounts();
  const actions = useRealtimeActionItems();
  const projects = useRealtimeActiveProjects(5);

  // Combined loading state
  const isLoading =
    stats.isLoading ||
    notifications.isLoading ||
    chat.isLoading ||
    actions.isLoading ||
    projects.isLoading;

  // Any update happening
  const isUpdating =
    stats.isUpdating ||
    notifications.isUpdating ||
    chat.isUpdating ||
    actions.isUpdating ||
    projects.isUpdating;

  return {
    // Stats
    offerteStats: stats.data?.offerteStats ?? null,
    projectStats: stats.data?.projectStats ?? null,
    revenueStats: stats.data?.revenueStats ?? null,
    facturenStats: stats.data?.facturenStats ?? null,
    statsChanged: stats.changedStats,
    hasStatsChanged: stats.hasChanged,

    // Notifications
    notificationCounts: notifications.counts,
    hasNewNotifications: notifications.hasNewNotifications,

    // Chat
    chatCounts: chat.counts,
    hasNewMessages: chat.hasNewMessages,

    // Actions
    actionItems: actions.data,
    hasNewActions: actions.hasNewActions,

    // Projects
    activeProjects: projects.projects,

    // Loading states
    isLoading,
    isUpdating,
  };
}
