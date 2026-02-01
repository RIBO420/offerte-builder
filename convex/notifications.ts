/**
 * Push Notifications Module
 *
 * Handles sending push notifications for chat messages and other events.
 * Uses Expo Push Service for delivering notifications to mobile devices.
 *
 * Features:
 * - Quiet hours respect
 * - Muted channels/users support
 * - Notification batching to prevent spam
 * - Deep link data for navigation
 */

import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Id, Doc } from "./_generated/dataModel";
import { requireAuth } from "./auth";

// ============ TYPES ============

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
  priority?: "default" | "normal" | "high";
  ttl?: number;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

// Batch tracking for notification throttling
const BATCH_WINDOW_MS = 5000; // 5 seconds
const MAX_NOTIFICATIONS_PER_BATCH = 3;

// ============ HELPER FUNCTIONS ============

/**
 * Check if current time is within quiet hours.
 */
function isQuietHours(
  quietHoursStart?: string,
  quietHoursEnd?: string
): boolean {
  if (!quietHoursStart || !quietHoursEnd) return false;

  const now = new Date();
  // Use Netherlands timezone for quiet hours
  const nlTime = new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  const currentTime = nlTime.replace(":", "");
  const start = quietHoursStart.replace(":", "");
  const end = quietHoursEnd.replace(":", "");

  // Handle overnight quiet hours (e.g., 22:00 - 07:00)
  if (start > end) {
    return currentTime >= start || currentTime < end;
  }

  return currentTime >= start && currentTime < end;
}

/**
 * Truncate message for notification preview.
 */
function truncateMessage(message: string, maxLength: number = 100): string {
  if (message.length <= maxLength) return message;
  return message.slice(0, maxLength - 3) + "...";
}

/**
 * Get channel display name for notification.
 */
function getChannelDisplayName(
  channelType: "team" | "project" | "broadcast",
  channelName?: string
): string {
  switch (channelType) {
    case "team":
      return "Team Chat";
    case "broadcast":
      return "Aankondiging";
    case "project":
      return channelName || "Project";
    default:
      return "Chat";
  }
}

// ============ INTERNAL QUERIES ============

/**
 * Get notification preferences for a user by their clerkId.
 */
export const getPreferencesByClerkId = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notification_preferences")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkId))
      .unique();
  },
});

/**
 * Get all team members with push tokens for a company.
 */
export const getTeamMembersWithTokens = internalQuery({
  args: { companyId: v.id("users") },
  handler: async (ctx, args) => {
    // Get all active medewerkers for this company
    const medewerkers = await ctx.db
      .query("medewerkers")
      .withIndex("by_user_actief", (q) =>
        q.eq("userId", args.companyId).eq("isActief", true)
      )
      .collect();

    // Get notification preferences for each medewerker with a clerkUserId
    const membersWithTokens: Array<{
      clerkId: string;
      naam: string;
      preferences: Doc<"notification_preferences"> | null;
    }> = [];

    for (const medewerker of medewerkers) {
      if (medewerker.clerkUserId) {
        const preferences = await ctx.db
          .query("notification_preferences")
          .withIndex("by_clerk_id", (q) =>
            q.eq("clerkUserId", medewerker.clerkUserId!)
          )
          .unique();

        membersWithTokens.push({
          clerkId: medewerker.clerkUserId,
          naam: medewerker.naam,
          preferences,
        });
      }
    }

    // Also include the company owner
    const owner = await ctx.db.get(args.companyId);
    if (owner) {
      const ownerPrefs = await ctx.db
        .query("notification_preferences")
        .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", owner.clerkId))
        .unique();

      membersWithTokens.push({
        clerkId: owner.clerkId,
        naam: owner.name || "Eigenaar",
        preferences: ownerPrefs,
      });
    }

    return membersWithTokens;
  },
});

/**
 * Get recent notification count for batching check.
 */
export const getRecentNotificationCount = internalQuery({
  args: {
    recipientClerkId: v.string(),
    channelType: v.string(),
    projectId: v.optional(v.string()),
    sinceTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    // Query notification_log to count recent notifications
    // This helps prevent notification spam
    const logs = await ctx.db
      .query("notification_log")
      .withIndex("by_recipient_time", (q) =>
        q
          .eq("recipientClerkId", args.recipientClerkId)
          .gte("createdAt", args.sinceTimestamp)
      )
      .filter((q) => q.eq(q.field("channelType"), args.channelType))
      .collect();

    // Further filter by projectId if provided
    if (args.projectId) {
      return logs.filter((log) => log.projectId === args.projectId).length;
    }

    return logs.length;
  },
});

// ============ INTERNAL MUTATIONS ============

/**
 * Log a sent notification for batching tracking.
 */
export const logNotification = internalMutation({
  args: {
    recipientClerkId: v.string(),
    senderClerkId: v.string(),
    channelType: v.string(),
    projectId: v.optional(v.string()),
    messageId: v.string(),
    status: v.union(v.literal("sent"), v.literal("skipped"), v.literal("failed")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notification_log", {
      recipientClerkId: args.recipientClerkId,
      senderClerkId: args.senderClerkId,
      channelType: args.channelType,
      projectId: args.projectId,
      messageId: args.messageId,
      status: args.status,
      reason: args.reason,
      createdAt: Date.now(),
    });
  },
});

// ============ INTERNAL ACTIONS ============

/**
 * Send push notification via Expo Push Service.
 */
export const sendExpoPushNotification = internalAction({
  args: {
    messages: v.array(
      v.object({
        to: v.string(),
        title: v.string(),
        body: v.string(),
        data: v.optional(v.any()),
        sound: v.optional(v.union(v.literal("default"), v.null())),
        badge: v.optional(v.number()),
        channelId: v.optional(v.string()),
        priority: v.optional(
          v.union(v.literal("default"), v.literal("normal"), v.literal("high"))
        ),
        ttl: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    if (args.messages.length === 0) {
      return { success: true, tickets: [] };
    }

    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(args.messages),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Expo push error:", errorText);
        return { success: false, error: errorText, tickets: [] };
      }

      const result = await response.json();
      return { success: true, tickets: result.data || [] };
    } catch (error) {
      console.error("Failed to send push notification:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        tickets: [],
      };
    }
  },
});

/**
 * Send chat notifications to team members.
 * Handles all filtering (preferences, quiet hours, muting, batching).
 */
export const sendChatNotifications = internalAction({
  args: {
    messageId: v.string(),
    senderClerkId: v.string(),
    senderName: v.string(),
    companyId: v.string(),
    channelType: v.union(
      v.literal("team"),
      v.literal("project"),
      v.literal("broadcast")
    ),
    channelName: v.optional(v.string()),
    projectId: v.optional(v.string()),
    messagePreview: v.string(),
  },
  handler: async (ctx, args) => {
    // Get all team members with push tokens
    const teamMembers = await ctx.runQuery(
      internal.notifications.getTeamMembersWithTokens,
      { companyId: args.companyId as Id<"users"> }
    );

    const messages: ExpoPushMessage[] = [];
    const now = Date.now();
    const batchWindowStart = now - BATCH_WINDOW_MS;

    for (const member of teamMembers) {
      // Skip the sender
      if (member.clerkId === args.senderClerkId) {
        continue;
      }

      const prefs = member.preferences;

      // Check if user has push notifications enabled and has a device token
      if (!prefs?.enablePushNotifications || !prefs?.deviceToken) {
        await ctx.runMutation(internal.notifications.logNotification, {
          recipientClerkId: member.clerkId,
          senderClerkId: args.senderClerkId,
          channelType: args.channelType,
          projectId: args.projectId,
          messageId: args.messageId,
          status: "skipped",
          reason: "no_token_or_disabled",
        });
        continue;
      }

      // Check notification type preference
      const shouldNotify =
        (args.channelType === "team" && prefs.notifyOnTeamChat) ||
        (args.channelType === "project" && prefs.notifyOnProjectChat) ||
        (args.channelType === "broadcast" && prefs.notifyOnBroadcast);

      if (!shouldNotify) {
        await ctx.runMutation(internal.notifications.logNotification, {
          recipientClerkId: member.clerkId,
          senderClerkId: args.senderClerkId,
          channelType: args.channelType,
          projectId: args.projectId,
          messageId: args.messageId,
          status: "skipped",
          reason: "channel_type_disabled",
        });
        continue;
      }

      // Check quiet hours
      if (
        prefs.respectQuietHours &&
        isQuietHours(prefs.quietHoursStart, prefs.quietHoursEnd)
      ) {
        await ctx.runMutation(internal.notifications.logNotification, {
          recipientClerkId: member.clerkId,
          senderClerkId: args.senderClerkId,
          channelType: args.channelType,
          projectId: args.projectId,
          messageId: args.messageId,
          status: "skipped",
          reason: "quiet_hours",
        });
        continue;
      }

      // Check muted channels
      const channelKey =
        args.channelType === "project"
          ? `project:${args.projectId}`
          : args.channelType;

      if (prefs.mutedChannels?.includes(channelKey)) {
        await ctx.runMutation(internal.notifications.logNotification, {
          recipientClerkId: member.clerkId,
          senderClerkId: args.senderClerkId,
          channelType: args.channelType,
          projectId: args.projectId,
          messageId: args.messageId,
          status: "skipped",
          reason: "channel_muted",
        });
        continue;
      }

      // Check muted users
      if (prefs.mutedUsers?.includes(args.senderClerkId)) {
        await ctx.runMutation(internal.notifications.logNotification, {
          recipientClerkId: member.clerkId,
          senderClerkId: args.senderClerkId,
          channelType: args.channelType,
          projectId: args.projectId,
          messageId: args.messageId,
          status: "skipped",
          reason: "sender_muted",
        });
        continue;
      }

      // Check batching - don't spam if many messages in short time
      const recentCount = await ctx.runQuery(
        internal.notifications.getRecentNotificationCount,
        {
          recipientClerkId: member.clerkId,
          channelType: args.channelType,
          projectId: args.projectId,
          sinceTimestamp: batchWindowStart,
        }
      );

      if (recentCount >= MAX_NOTIFICATIONS_PER_BATCH) {
        await ctx.runMutation(internal.notifications.logNotification, {
          recipientClerkId: member.clerkId,
          senderClerkId: args.senderClerkId,
          channelType: args.channelType,
          projectId: args.projectId,
          messageId: args.messageId,
          status: "skipped",
          reason: "batch_limit_reached",
        });
        continue;
      }

      // Build notification message
      const channelDisplay = getChannelDisplayName(
        args.channelType,
        args.channelName
      );

      const title =
        args.channelType === "broadcast"
          ? `${channelDisplay}: ${args.senderName}`
          : args.senderName;

      const body =
        args.channelType === "project"
          ? `[${args.channelName}] ${truncateMessage(args.messagePreview)}`
          : truncateMessage(args.messagePreview);

      messages.push({
        to: prefs.deviceToken,
        title,
        body,
        sound: "default",
        priority: args.channelType === "broadcast" ? "high" : "default",
        channelId: args.channelType === "broadcast" ? "broadcast" : "chat",
        data: {
          type: "chat",
          channelType: args.channelType,
          projectId: args.projectId,
          messageId: args.messageId,
          senderClerkId: args.senderClerkId,
        },
      });

      // Log the notification
      await ctx.runMutation(internal.notifications.logNotification, {
        recipientClerkId: member.clerkId,
        senderClerkId: args.senderClerkId,
        channelType: args.channelType,
        projectId: args.projectId,
        messageId: args.messageId,
        status: "sent",
      });
    }

    // Send all notifications in batch
    if (messages.length > 0) {
      await ctx.runAction(internal.notifications.sendExpoPushNotification, {
        messages,
      });
    }

    return { notificationsSent: messages.length };
  },
});

/**
 * Send direct message notification to a specific user.
 */
export const sendDirectMessageNotification = internalAction({
  args: {
    messageId: v.string(),
    senderClerkId: v.string(),
    senderName: v.string(),
    recipientClerkId: v.string(),
    messagePreview: v.string(),
  },
  handler: async (ctx, args) => {
    // Get recipient's notification preferences
    const prefs = await ctx.runQuery(
      internal.notifications.getPreferencesByClerkId,
      { clerkId: args.recipientClerkId }
    );

    // Check if user has push notifications enabled and has a device token
    if (!prefs?.enablePushNotifications || !prefs?.deviceToken) {
      await ctx.runMutation(internal.notifications.logNotification, {
        recipientClerkId: args.recipientClerkId,
        senderClerkId: args.senderClerkId,
        channelType: "direct",
        messageId: args.messageId,
        status: "skipped",
        reason: "no_token_or_disabled",
      });
      return { sent: false, reason: "no_token_or_disabled" };
    }

    // Check DM notification preference
    if (!prefs.notifyOnDirectMessage) {
      await ctx.runMutation(internal.notifications.logNotification, {
        recipientClerkId: args.recipientClerkId,
        senderClerkId: args.senderClerkId,
        channelType: "direct",
        messageId: args.messageId,
        status: "skipped",
        reason: "dm_disabled",
      });
      return { sent: false, reason: "dm_disabled" };
    }

    // Check quiet hours
    if (
      prefs.respectQuietHours &&
      isQuietHours(prefs.quietHoursStart, prefs.quietHoursEnd)
    ) {
      await ctx.runMutation(internal.notifications.logNotification, {
        recipientClerkId: args.recipientClerkId,
        senderClerkId: args.senderClerkId,
        channelType: "direct",
        messageId: args.messageId,
        status: "skipped",
        reason: "quiet_hours",
      });
      return { sent: false, reason: "quiet_hours" };
    }

    // Check if sender is muted
    if (prefs.mutedUsers?.includes(args.senderClerkId)) {
      await ctx.runMutation(internal.notifications.logNotification, {
        recipientClerkId: args.recipientClerkId,
        senderClerkId: args.senderClerkId,
        channelType: "direct",
        messageId: args.messageId,
        status: "skipped",
        reason: "sender_muted",
      });
      return { sent: false, reason: "sender_muted" };
    }

    // Check batching for DMs
    const now = Date.now();
    const batchWindowStart = now - BATCH_WINDOW_MS;

    const recentCount = await ctx.runQuery(
      internal.notifications.getRecentNotificationCount,
      {
        recipientClerkId: args.recipientClerkId,
        channelType: "direct",
        sinceTimestamp: batchWindowStart,
      }
    );

    if (recentCount >= MAX_NOTIFICATIONS_PER_BATCH) {
      await ctx.runMutation(internal.notifications.logNotification, {
        recipientClerkId: args.recipientClerkId,
        senderClerkId: args.senderClerkId,
        channelType: "direct",
        messageId: args.messageId,
        status: "skipped",
        reason: "batch_limit_reached",
      });
      return { sent: false, reason: "batch_limit_reached" };
    }

    // Send notification
    const message: ExpoPushMessage = {
      to: prefs.deviceToken,
      title: args.senderName,
      body: truncateMessage(args.messagePreview),
      sound: "default",
      priority: "high",
      channelId: "chat",
      data: {
        type: "dm",
        senderClerkId: args.senderClerkId,
        messageId: args.messageId,
      },
    };

    await ctx.runAction(internal.notifications.sendExpoPushNotification, {
      messages: [message],
    });

    // Log the notification
    await ctx.runMutation(internal.notifications.logNotification, {
      recipientClerkId: args.recipientClerkId,
      senderClerkId: args.senderClerkId,
      channelType: "direct",
      messageId: args.messageId,
      status: "sent",
    });

    return { sent: true };
  },
});

// ============ PUBLIC MUTATIONS ============

/**
 * Register/update device push token.
 * Called by mobile app when token is obtained or refreshed.
 */
export const registerPushToken = mutation({
  args: {
    token: v.string(),
    platform: v.union(v.literal("ios"), v.literal("android")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const now = Date.now();

    // Find existing preferences
    const existing = await ctx.db
      .query("notification_preferences")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", user.clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        deviceToken: args.token,
        devicePlatform: args.platform,
        enablePushNotifications: true,
        updatedAt: now,
      });
      return existing._id;
    }

    // Create new preferences with defaults
    return await ctx.db.insert("notification_preferences", {
      userId: user._id,
      clerkUserId: user.clerkId,
      deviceToken: args.token,
      devicePlatform: args.platform,
      enablePushNotifications: true,
      notifyOnTeamChat: true,
      notifyOnDirectMessage: true,
      notifyOnProjectChat: true,
      notifyOnBroadcast: true,
      respectQuietHours: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Unregister device push token.
 * Called when user logs out or disables notifications.
 */
export const unregisterPushToken = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const existing = await ctx.db
      .query("notification_preferences")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", user.clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        deviceToken: undefined,
        enablePushNotifications: false,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * Mute/unmute a channel or user.
 */
export const muteChannel = mutation({
  args: {
    channelKey: v.string(), // "team", "broadcast", "project:{projectId}", or "user:{clerkId}"
    mute: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("notification_preferences")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", user.clerkId))
      .unique();

    // Determine if this is a user mute or channel mute
    const isUserMute = args.channelKey.startsWith("user:");
    const key = isUserMute
      ? args.channelKey.replace("user:", "")
      : args.channelKey;

    if (existing) {
      let mutedList = isUserMute
        ? existing.mutedUsers || []
        : existing.mutedChannels || [];

      if (args.mute) {
        if (!mutedList.includes(key)) {
          mutedList = [...mutedList, key];
        }
      } else {
        mutedList = mutedList.filter((k) => k !== key);
      }

      const updateData = isUserMute
        ? { mutedUsers: mutedList, updatedAt: now }
        : { mutedChannels: mutedList, updatedAt: now };

      await ctx.db.patch(existing._id, updateData);
      return existing._id;
    }

    // Create new preferences
    const newPrefs = isUserMute
      ? { mutedUsers: args.mute ? [key] : [] }
      : { mutedChannels: args.mute ? [key] : [] };

    return await ctx.db.insert("notification_preferences", {
      userId: user._id,
      clerkUserId: user.clerkId,
      enablePushNotifications: true,
      notifyOnTeamChat: true,
      notifyOnDirectMessage: true,
      notifyOnProjectChat: true,
      notifyOnBroadcast: true,
      respectQuietHours: false,
      createdAt: now,
      updatedAt: now,
      ...newPrefs,
    });
  },
});

// ============================================
// IN-APP NOTIFICATION CENTER
// ============================================

import { query } from "./_generated/server";

/**
 * Get all notifications for the current user.
 * Returns notifications that are not dismissed, ordered by creation date (newest first).
 */
export const list = query({
  args: {
    limit: v.optional(v.number()),
    includeRead: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const limit = args.limit || 50;
    const includeRead = args.includeRead !== false; // Default to true

    // Get notifications that are not dismissed
    let notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_not_dismissed", (q) =>
        q.eq("userId", user._id).eq("isDismissed", false)
      )
      .order("desc")
      .take(limit * 2); // Fetch more in case we filter

    // Filter out read notifications if not including them
    if (!includeRead) {
      notifications = notifications.filter((n) => !n.isRead);
    }

    return notifications.slice(0, limit);
  },
});

/**
 * Get unread notification count for the current user.
 * Used for displaying badge on tab bar icon.
 */
export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) =>
        q.eq("userId", user._id).eq("isRead", false)
      )
      .collect();

    // Filter out dismissed and count by type
    const unreadNotifications = notifications.filter((n) => !n.isDismissed);

    const counts = {
      offerte: 0,
      chat: 0,
      project: 0,
      system: 0,
      total: 0,
    };

    for (const notification of unreadNotifications) {
      counts.total++;

      if (notification.type.startsWith("offerte_")) {
        counts.offerte++;
      } else if (notification.type.startsWith("chat_")) {
        counts.chat++;
      } else if (notification.type.startsWith("project_")) {
        counts.project++;
      } else if (notification.type.startsWith("system_")) {
        counts.system++;
      }
    }

    return counts;
  },
});

/**
 * Mark a notification as read.
 */
export const markAsRead = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      throw new Error("Notificatie niet gevonden");
    }

    if (notification.userId.toString() !== user._id.toString()) {
      throw new Error("Geen toegang tot deze notificatie");
    }

    if (!notification.isRead) {
      await ctx.db.patch(args.notificationId, {
        isRead: true,
        readAt: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * Mark all notifications as read for the current user.
 */
export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) =>
        q.eq("userId", user._id).eq("isRead", false)
      )
      .collect();

    const now = Date.now();
    let markedCount = 0;

    for (const notification of unreadNotifications) {
      await ctx.db.patch(notification._id, {
        isRead: true,
        readAt: now,
      });
      markedCount++;
    }

    return { markedCount };
  },
});

/**
 * Dismiss a notification (hide it from the list).
 */
export const dismiss = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      throw new Error("Notificatie niet gevonden");
    }

    if (notification.userId.toString() !== user._id.toString()) {
      throw new Error("Geen toegang tot deze notificatie");
    }

    await ctx.db.patch(args.notificationId, {
      isDismissed: true,
      dismissedAt: Date.now(),
      isRead: true,
      readAt: notification.readAt || Date.now(),
    });

    return { success: true };
  },
});

/**
 * Create an in-app notification.
 * This is called internally when events occur (offerte accepted, chat message, etc.).
 */
export const createInAppNotification = internalMutation({
  args: {
    userId: v.id("users"),
    type: v.union(
      v.literal("offerte_geaccepteerd"),
      v.literal("offerte_afgewezen"),
      v.literal("offerte_aangemaakt"),
      v.literal("offerte_verzonden"),
      v.literal("offerte_bekeken"),
      v.literal("chat_message"),
      v.literal("chat_dm"),
      v.literal("chat_broadcast"),
      v.literal("project_assignment"),
      v.literal("project_status_update"),
      v.literal("system_announcement"),
      v.literal("system_reminder")
    ),
    title: v.string(),
    message: v.string(),
    offerteId: v.optional(v.id("offertes")),
    offerteNummer: v.optional(v.string()),
    projectId: v.optional(v.id("projecten")),
    projectNaam: v.optional(v.string()),
    klantNaam: v.optional(v.string()),
    senderName: v.optional(v.string()),
    senderClerkId: v.optional(v.string()),
    triggeredBy: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const notificationId = await ctx.db.insert("notifications", {
      userId: args.userId,
      type: args.type,
      title: args.title,
      message: args.message,
      offerteId: args.offerteId,
      offerteNummer: args.offerteNummer,
      projectId: args.projectId,
      projectNaam: args.projectNaam,
      klantNaam: args.klantNaam,
      senderName: args.senderName,
      senderClerkId: args.senderClerkId,
      triggeredBy: args.triggeredBy,
      metadata: args.metadata,
      isRead: false,
      isDismissed: false,
      createdAt: Date.now(),
    });

    return { notificationId };
  },
});

// ============================================
// OFFERTE STATUS NOTIFICATION TRIGGERS
// ============================================

/**
 * Notification types for offerte status changes.
 */
export type OfferteNotificationType =
  | "offerte_geaccepteerd"
  | "offerte_afgewezen"
  | "offerte_aangemaakt"
  | "offerte_verzonden"
  | "offerte_bekeken";

/**
 * Helper to determine whether to send offerte notifications based on preferences.
 */
function getOfferteNotificationDecision(
  preferences: Doc<"notification_preferences"> | null,
  notificationType: OfferteNotificationType
): { inApp: boolean; push: boolean } {
  // Default: always send in-app notifications for important statuses
  let inApp = true;
  let push = preferences?.enablePushNotifications ?? false;

  if (preferences) {
    switch (notificationType) {
      case "offerte_geaccepteerd":
        // Default to true if not set
        if (preferences.notifyOnOfferteAccepted === false) {
          push = false;
        }
        break;
      case "offerte_afgewezen":
        if (preferences.notifyOnOfferteRejected === false) {
          push = false;
        }
        break;
      case "offerte_bekeken":
        // Default to false for viewed (can be noisy)
        if (!preferences.notifyOnOfferteViewed) {
          push = false;
          inApp = false;
        }
        break;
      case "offerte_aangemaakt":
        // Default to false for created
        if (!preferences.notifyOnOfferteCreated) {
          push = false;
          inApp = false;
        }
        break;
      case "offerte_verzonden":
        // Default to true for sent
        break;
    }

    // Check quiet hours for push only
    if (
      push &&
      preferences.respectQuietHours &&
      isQuietHours(preferences.quietHoursStart, preferences.quietHoursEnd)
    ) {
      push = false;
    }
  }

  return { inApp, push };
}

/**
 * Get the admin user(s) who should receive notifications for an offerte.
 * Returns the offerte owner. Can be extended to include other admins/team members.
 */
async function getOfferteNotificationRecipients(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  offerteId: Id<"offertes">
): Promise<Id<"users">[]> {
  const offerte = await ctx.db.get(offerteId);
  if (!offerte) {
    return [];
  }

  // Currently only the offerte owner receives notifications
  // This can be extended to include team members, organization admins, etc.
  return [offerte.userId];
}

/**
 * Check if a user should receive a specific type of offerte notification.
 */
async function shouldSendOfferteNotification(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  userId: Id<"users">,
  notificationType: OfferteNotificationType
): Promise<{ inApp: boolean; push: boolean }> {
  const user = await ctx.db.get(userId);
  if (!user) {
    return { inApp: false, push: false };
  }

  const preferences = await ctx.db
    .query("notification_preferences")
    .withIndex("by_clerk_id", (q: { eq: (field: string, value: string) => unknown }) => q.eq("clerkUserId", user.clerkId))
    .unique();

  return getOfferteNotificationDecision(preferences, notificationType);
}

/**
 * Internal mutation to notify admin when offerte status changes.
 * Called from offertes.ts and publicOffertes.ts when status changes.
 */
export const notifyOfferteStatusChange = internalMutation({
  args: {
    offerteId: v.id("offertes"),
    newStatus: v.string(),
    triggeredBy: v.string(), // "klant" or clerk user ID
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const offerte = await ctx.db.get(args.offerteId);
    if (!offerte) {
      return { success: false, reason: "offerte_not_found" };
    }

    // Get notification recipients
    const recipients = await getOfferteNotificationRecipients(ctx, args.offerteId);

    // Determine notification type and content based on status
    let notificationType: OfferteNotificationType;
    let title: string;
    let message: string;

    switch (args.newStatus) {
      case "geaccepteerd":
        notificationType = "offerte_geaccepteerd";
        title = "Offerte geaccepteerd!";
        message = `${offerte.klant.naam} heeft offerte ${offerte.offerteNummer} geaccepteerd.`;
        break;
      case "afgewezen":
        notificationType = "offerte_afgewezen";
        title = "Offerte afgewezen";
        message = `${offerte.klant.naam} heeft offerte ${offerte.offerteNummer} afgewezen.`;
        if (args.comment) {
          message += ` Reden: "${truncateMessage(args.comment, 50)}"`;
        }
        break;
      case "verzonden":
        notificationType = "offerte_verzonden";
        title = "Offerte verzonden";
        message = `Offerte ${offerte.offerteNummer} is verzonden naar ${offerte.klant.naam}.`;
        break;
      default:
        // Don't send notifications for other status changes
        return { success: true, reason: "no_notification_needed" };
    }

    let notificationsSent = 0;

    // Create notification for each recipient
    for (const recipientId of recipients) {
      const shouldSend = await shouldSendOfferteNotification(
        ctx,
        recipientId,
        notificationType
      );

      if (shouldSend.inApp) {
        await ctx.db.insert("notifications", {
          userId: recipientId,
          type: notificationType,
          title,
          message,
          offerteId: args.offerteId,
          offerteNummer: offerte.offerteNummer,
          klantNaam: offerte.klant.naam,
          isRead: false,
          isDismissed: false,
          triggeredBy: args.triggeredBy,
          metadata: {
            totaalInclBtw: offerte.totalen.totaalInclBtw,
            comment: args.comment,
          },
          createdAt: Date.now(),
        });
        notificationsSent++;
      }

      // TODO: Add push notification support when needed
      // if (shouldSend.push) { ... }
    }

    return { success: true, notificationsSent };
  },
});

/**
 * Internal mutation to notify admin when offerte is viewed by customer.
 * Called from publicOffertes.ts when customer views offerte.
 */
export const notifyOfferteViewed = internalMutation({
  args: {
    offerteId: v.id("offertes"),
  },
  handler: async (ctx, args) => {
    const offerte = await ctx.db.get(args.offerteId);
    if (!offerte) {
      return { success: false, reason: "offerte_not_found" };
    }

    const recipients = await getOfferteNotificationRecipients(ctx, args.offerteId);
    let notificationsSent = 0;

    for (const recipientId of recipients) {
      const shouldSend = await shouldSendOfferteNotification(
        ctx,
        recipientId,
        "offerte_bekeken"
      );

      if (shouldSend.inApp) {
        await ctx.db.insert("notifications", {
          userId: recipientId,
          type: "offerte_bekeken",
          title: "Offerte bekeken",
          message: `${offerte.klant.naam} heeft offerte ${offerte.offerteNummer} bekeken.`,
          offerteId: args.offerteId,
          offerteNummer: offerte.offerteNummer,
          klantNaam: offerte.klant.naam,
          isRead: false,
          isDismissed: false,
          triggeredBy: "klant",
          createdAt: Date.now(),
        });
        notificationsSent++;
      }
    }

    return { success: true, notificationsSent };
  },
});

/**
 * Internal mutation to notify when new offerte is created.
 * Optional - only sends if user has enabled this preference.
 */
export const notifyOfferteCreated = internalMutation({
  args: {
    offerteId: v.id("offertes"),
    createdByUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const offerte = await ctx.db.get(args.offerteId);
    if (!offerte) {
      return { success: false, reason: "offerte_not_found" };
    }

    // For created notifications, we might want to notify other team members
    // For now, we skip self-notifications
    const recipients = await getOfferteNotificationRecipients(ctx, args.offerteId);
    let notificationsSent = 0;

    for (const recipientId of recipients) {
      // Skip self-notification for creation
      if (recipientId === args.createdByUserId) {
        continue;
      }

      const shouldSend = await shouldSendOfferteNotification(
        ctx,
        recipientId,
        "offerte_aangemaakt"
      );

      if (shouldSend.inApp) {
        const createdByUser = await ctx.db.get(args.createdByUserId);

        await ctx.db.insert("notifications", {
          userId: recipientId,
          type: "offerte_aangemaakt",
          title: "Nieuwe offerte aangemaakt",
          message: `${createdByUser?.name || "Iemand"} heeft een nieuwe offerte aangemaakt: ${offerte.offerteNummer} voor ${offerte.klant.naam}.`,
          offerteId: args.offerteId,
          offerteNummer: offerte.offerteNummer,
          klantNaam: offerte.klant.naam,
          isRead: false,
          isDismissed: false,
          triggeredBy: args.createdByUserId.toString(),
          createdAt: Date.now(),
        });
        notificationsSent++;
      }
    }

    return { success: true, notificationsSent };
  },
});

// ============================================
// OFFERTE NOTIFICATION PREFERENCES
// ============================================

import { requireAuthUserId } from "./auth";

/**
 * Get offerte notification preferences for the current user.
 */
export const getOfferteNotificationPreferences = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const preferences = await ctx.db
      .query("notification_preferences")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", user.clerkId))
      .unique();

    // Return defaults if no preferences exist
    return {
      notifyOnOfferteAccepted: preferences?.notifyOnOfferteAccepted ?? true,
      notifyOnOfferteRejected: preferences?.notifyOnOfferteRejected ?? true,
      notifyOnOfferteViewed: preferences?.notifyOnOfferteViewed ?? false,
      notifyOnOfferteCreated: preferences?.notifyOnOfferteCreated ?? false,
    };
  },
});

/**
 * Update offerte notification preferences.
 */
export const updateOfferteNotificationPreferences = mutation({
  args: {
    notifyOnOfferteAccepted: v.optional(v.boolean()),
    notifyOnOfferteRejected: v.optional(v.boolean()),
    notifyOnOfferteViewed: v.optional(v.boolean()),
    notifyOnOfferteCreated: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const now = Date.now();

    // Find existing preferences
    const existing = await ctx.db
      .query("notification_preferences")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", user.clerkId))
      .unique();

    if (existing) {
      // Update existing preferences
      const updateData: Record<string, unknown> = { updatedAt: now };

      if (args.notifyOnOfferteAccepted !== undefined) {
        updateData.notifyOnOfferteAccepted = args.notifyOnOfferteAccepted;
      }
      if (args.notifyOnOfferteRejected !== undefined) {
        updateData.notifyOnOfferteRejected = args.notifyOnOfferteRejected;
      }
      if (args.notifyOnOfferteViewed !== undefined) {
        updateData.notifyOnOfferteViewed = args.notifyOnOfferteViewed;
      }
      if (args.notifyOnOfferteCreated !== undefined) {
        updateData.notifyOnOfferteCreated = args.notifyOnOfferteCreated;
      }

      await ctx.db.patch(existing._id, updateData);
      return existing._id;
    } else {
      // Create new preferences with defaults
      const preferencesId = await ctx.db.insert("notification_preferences", {
        userId: user._id,
        clerkUserId: user.clerkId,
        enablePushNotifications: true,
        notifyOnTeamChat: true,
        notifyOnDirectMessage: true,
        notifyOnProjectChat: true,
        notifyOnBroadcast: true,
        notifyOnOfferteAccepted: args.notifyOnOfferteAccepted ?? true,
        notifyOnOfferteRejected: args.notifyOnOfferteRejected ?? true,
        notifyOnOfferteViewed: args.notifyOnOfferteViewed ?? false,
        notifyOnOfferteCreated: args.notifyOnOfferteCreated ?? false,
        respectQuietHours: false,
        createdAt: now,
        updatedAt: now,
      });
      return preferencesId;
    }
  },
});

/**
 * Get notifications by offerte ID.
 * Useful for showing notification history on offerte detail page.
 */
export const getByOfferte = query({
  args: {
    offerteId: v.id("offertes"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.offerteId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .order("desc")
      .collect();

    return notifications;
  },
});
