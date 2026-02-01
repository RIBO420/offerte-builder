/**
 * Push Notifications Backend Functions
 *
 * Provides push notification functionality for the mobile app using Expo Push Notifications.
 * Includes:
 * - Token management (save, remove, get)
 * - Internal function to send notifications via Expo API
 * - Notification triggers for chat messages, offerte status changes, and project assignments
 * - Respects user notification preferences including quiet hours
 */

import { v } from "convex/values";
import { mutation, query, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth, requireAuthUserId } from "./auth";
import { Id, Doc } from "./_generated/dataModel";

// ============================================
// PUSH TOKEN MANAGEMENT
// ============================================

/**
 * Save or update a user's Expo push token.
 * If the token already exists for this user, updates the lastUsedAt.
 * If the token exists for a different user, it will be moved to the current user.
 */
export const savePushToken = mutation({
  args: {
    expoPushToken: v.string(),
    deviceId: v.optional(v.string()),
    platform: v.union(v.literal("ios"), v.literal("android")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const now = Date.now();

    // Validate Expo push token format
    if (!args.expoPushToken.startsWith("ExponentPushToken[")) {
      throw new Error("Ongeldig Expo push token formaat");
    }

    // Check if this token already exists
    const existingToken = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("expoPushToken", args.expoPushToken))
      .unique();

    if (existingToken) {
      // If token belongs to current user, just update lastUsedAt
      if (existingToken.userId.toString() === user._id.toString()) {
        await ctx.db.patch(existingToken._id, {
          isActive: true,
          lastUsedAt: now,
          platform: args.platform,
          deviceId: args.deviceId,
        });
        return existingToken._id;
      } else {
        // Token was registered to different user, transfer it to current user
        await ctx.db.patch(existingToken._id, {
          userId: user._id,
          clerkUserId: user.clerkId,
          isActive: true,
          lastUsedAt: now,
          platform: args.platform,
          deviceId: args.deviceId,
        });
        return existingToken._id;
      }
    }

    // Create new token entry
    const tokenId = await ctx.db.insert("pushTokens", {
      userId: user._id,
      clerkUserId: user.clerkId,
      expoPushToken: args.expoPushToken,
      deviceId: args.deviceId,
      platform: args.platform,
      isActive: true,
      lastUsedAt: now,
      createdAt: now,
    });

    return tokenId;
  },
});

/**
 * Remove a push token (e.g., on logout).
 * Marks the token as inactive rather than deleting for audit purposes.
 */
export const removePushToken = mutation({
  args: {
    expoPushToken: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Find the token
    const token = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("expoPushToken", args.expoPushToken))
      .unique();

    if (!token) {
      // Token doesn't exist, nothing to do
      return { success: true };
    }

    // Verify the token belongs to this user
    if (token.userId.toString() !== user._id.toString()) {
      throw new Error("Je hebt geen toegang tot dit token");
    }

    // Mark as inactive
    await ctx.db.patch(token._id, {
      isActive: false,
    });

    return { success: true };
  },
});

/**
 * Remove all push tokens for the current user (full logout from all devices).
 */
export const removeAllPushTokens = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    // Get all active tokens for this user
    const tokens = await ctx.db
      .query("pushTokens")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Mark all as inactive
    for (const token of tokens) {
      if (token.isActive) {
        await ctx.db.patch(token._id, {
          isActive: false,
        });
      }
    }

    return { removedCount: tokens.filter((t) => t.isActive).length };
  },
});

/**
 * Get all active push tokens for the current user.
 */
export const getUserPushTokens = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const tokens = await ctx.db
      .query("pushTokens")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return tokens.filter((t) => t.isActive);
  },
});

// ============================================
// INTERNAL: NOTIFICATION SENDING
// ============================================

/**
 * Internal mutation to log a notification attempt.
 */
export const logNotification = internalMutation({
  args: {
    userId: v.id("users"),
    type: v.union(
      v.literal("chat_team"),
      v.literal("chat_dm"),
      v.literal("chat_project"),
      v.literal("chat_broadcast"),
      v.literal("offerte_status"),
      v.literal("project_assignment")
    ),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
    status: v.union(
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("failed"),
      v.literal("skipped")
    ),
    error: v.optional(v.string()),
    ticketId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("pushNotificationLogs", {
      userId: args.userId,
      type: args.type,
      title: args.title,
      body: args.body,
      data: args.data,
      status: args.status,
      error: args.error,
      ticketId: args.ticketId,
      createdAt: Date.now(),
    });
  },
});

/**
 * Internal action to send push notification via Expo API.
 * This is an action because it makes external HTTP requests.
 */
export const sendPushNotification = internalAction({
  args: {
    userId: v.id("users"),
    type: v.union(
      v.literal("chat_team"),
      v.literal("chat_dm"),
      v.literal("chat_project"),
      v.literal("chat_broadcast"),
      v.literal("offerte_status"),
      v.literal("project_assignment")
    ),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Get user's active push tokens
    const tokens = await ctx.runQuery(internal.pushNotifications.getActiveTokensForUser, {
      userId: args.userId,
    });

    if (tokens.length === 0) {
      // No tokens, skip notification
      await ctx.runMutation(internal.pushNotifications.logNotification, {
        userId: args.userId,
        type: args.type,
        title: args.title,
        body: args.body,
        data: args.data,
        status: "skipped",
        error: "Geen actieve push tokens",
      });
      return;
    }

    // Check user's notification preferences
    const preferences = await ctx.runQuery(
      internal.pushNotifications.getUserNotificationPreferences,
      { userId: args.userId }
    );

    // Check if notifications are enabled for this type
    if (!preferences.enablePushNotifications) {
      await ctx.runMutation(internal.pushNotifications.logNotification, {
        userId: args.userId,
        type: args.type,
        title: args.title,
        body: args.body,
        data: args.data,
        status: "skipped",
        error: "Push notificaties uitgeschakeld",
      });
      return;
    }

    // Check type-specific preferences
    const prefs = preferences as NotificationPreferences;
    const typeAllowed = checkNotificationTypeAllowed(args.type, prefs);
    if (!typeAllowed) {
      await ctx.runMutation(internal.pushNotifications.logNotification, {
        userId: args.userId,
        type: args.type,
        title: args.title,
        body: args.body,
        data: args.data,
        status: "skipped",
        error: `Notificaties voor type ${args.type} uitgeschakeld`,
      });
      return;
    }

    // Check quiet hours
    if (prefs.respectQuietHours && isInQuietHours(prefs)) {
      await ctx.runMutation(internal.pushNotifications.logNotification, {
        userId: args.userId,
        type: args.type,
        title: args.title,
        body: args.body,
        data: args.data,
        status: "skipped",
        error: "Binnen stille uren",
      });
      return;
    }

    // Prepare Expo push messages
    const messages = tokens.map((token) => ({
      to: token.expoPushToken,
      sound: "default" as const,
      title: args.title,
      body: args.body,
      data: args.data || {},
      priority: "high" as const,
      channelId: getChannelIdForType(args.type),
    }));

    try {
      // Send to Expo Push API
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Expo API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      // Log success
      await ctx.runMutation(internal.pushNotifications.logNotification, {
        userId: args.userId,
        type: args.type,
        title: args.title,
        body: args.body,
        data: args.data,
        status: "sent",
        ticketId: result.data?.[0]?.id,
      });

      // Check for any errors in the response
      if (result.data) {
        for (let i = 0; i < result.data.length; i++) {
          const ticket = result.data[i];
          if (ticket.status === "error") {
            // Mark token as inactive if it's invalid
            if (
              ticket.details?.error === "DeviceNotRegistered" ||
              ticket.details?.error === "InvalidCredentials"
            ) {
              await ctx.runMutation(internal.pushNotifications.deactivateToken, {
                expoPushToken: tokens[i].expoPushToken,
              });
            }
          }
        }
      }
    } catch (error) {
      // Log failure
      await ctx.runMutation(internal.pushNotifications.logNotification, {
        userId: args.userId,
        type: args.type,
        title: args.title,
        body: args.body,
        data: args.data,
        status: "failed",
        error: error instanceof Error ? error.message : "Onbekende fout",
      });
    }
  },
});

/**
 * Internal query to get active push tokens for a user.
 */
export const getActiveTokensForUser = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const tokens = await ctx.db
      .query("pushTokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return tokens.filter((t) => t.isActive);
  },
});

/**
 * Internal query to get user's notification preferences.
 */
export const getUserNotificationPreferences = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return getDefaultPreferences();
    }

    const preferences = await ctx.db
      .query("notification_preferences")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", user.clerkId))
      .unique();

    if (!preferences) {
      return getDefaultPreferences();
    }

    return preferences;
  },
});

/**
 * Internal mutation to deactivate an invalid token.
 */
export const deactivateToken = internalMutation({
  args: {
    expoPushToken: v.string(),
  },
  handler: async (ctx, args) => {
    const token = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("expoPushToken", args.expoPushToken))
      .unique();

    if (token) {
      await ctx.db.patch(token._id, {
        isActive: false,
      });
    }
  },
});

// ============================================
// NOTIFICATION TRIGGERS
// ============================================

/**
 * Send notification for a new chat message.
 * Called from chat.ts when a new message is sent.
 */
export const notifyNewChatMessage = internalAction({
  args: {
    recipientUserId: v.id("users"),
    senderName: v.string(),
    channelType: v.union(
      v.literal("team"),
      v.literal("project"),
      v.literal("broadcast"),
      v.literal("dm")
    ),
    channelName: v.optional(v.string()),
    messagePreview: v.string(),
    messageId: v.optional(v.string()),
    projectId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const notificationType = args.channelType === "dm"
      ? "chat_dm"
      : args.channelType === "team"
      ? "chat_team"
      : args.channelType === "project"
      ? "chat_project"
      : "chat_broadcast";

    // Build title based on channel type
    let title: string;
    if (args.channelType === "dm") {
      title = `Nieuw bericht van ${args.senderName}`;
    } else if (args.channelType === "broadcast") {
      title = `Mededeling van ${args.senderName}`;
    } else if (args.channelType === "project" && args.channelName) {
      title = `${args.senderName} in ${args.channelName}`;
    } else {
      title = `${args.senderName} in Team Chat`;
    }

    // Truncate message preview
    const body = args.messagePreview.length > 100
      ? args.messagePreview.substring(0, 97) + "..."
      : args.messagePreview;

    await ctx.runAction(internal.pushNotifications.sendPushNotification, {
      userId: args.recipientUserId,
      type: notificationType,
      title,
      body,
      data: {
        type: "chat",
        channelType: args.channelType,
        channelName: args.channelName,
        messageId: args.messageId,
        projectId: args.projectId,
      },
    });
  },
});

/**
 * Send notification for offerte status change (for admin users).
 * Called from offertes.ts when status changes.
 */
export const notifyOfferteStatusChange = internalAction({
  args: {
    userId: v.id("users"),
    offerteId: v.string(),
    offerteNummer: v.string(),
    klantNaam: v.string(),
    oldStatus: v.string(),
    newStatus: v.string(),
  },
  handler: async (ctx, args) => {
    // Only notify for significant status changes
    const significantStatuses = ["geaccepteerd", "afgewezen"];
    if (!significantStatuses.includes(args.newStatus)) {
      return;
    }

    const statusLabels: Record<string, string> = {
      concept: "Concept",
      voorcalculatie: "Voorcalculatie",
      verzonden: "Verzonden",
      geaccepteerd: "Geaccepteerd",
      afgewezen: "Afgewezen",
    };

    const title = args.newStatus === "geaccepteerd"
      ? "Offerte geaccepteerd!"
      : "Offerte afgewezen";

    const body = `${args.klantNaam} heeft offerte ${args.offerteNummer} ${statusLabels[args.newStatus]?.toLowerCase() || args.newStatus}`;

    await ctx.runAction(internal.pushNotifications.sendPushNotification, {
      userId: args.userId,
      type: "offerte_status",
      title,
      body,
      data: {
        type: "offerte_status",
        offerteId: args.offerteId,
        offerteNummer: args.offerteNummer,
        status: args.newStatus,
      },
    });
  },
});

/**
 * Send notification for project assignment.
 * Called when a medewerker is assigned to a project.
 */
export const notifyProjectAssignment = internalAction({
  args: {
    medewerkerUserId: v.id("users"),
    projectId: v.string(),
    projectNaam: v.string(),
    klantNaam: v.string(),
    assignedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const title = "Nieuw project toegewezen";
    const body = `Je bent toegewezen aan: ${args.projectNaam} (${args.klantNaam})`;

    await ctx.runAction(internal.pushNotifications.sendPushNotification, {
      userId: args.medewerkerUserId,
      type: "project_assignment",
      title,
      body,
      data: {
        type: "project_assignment",
        projectId: args.projectId,
        projectNaam: args.projectNaam,
      },
    });
  },
});

// ============================================
// IN-APP NOTIFICATIONS
// ============================================

/**
 * Get notifications for the current user.
 * Returns unread/not dismissed notifications by default.
 */
export const getNotifications = query({
  args: {
    includeRead: v.optional(v.boolean()),
    includeDismissed: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const limit = args.limit || 50;

    let notifications;

    if (args.includeDismissed) {
      // Get all notifications
      notifications = await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(limit);
    } else if (args.includeRead) {
      // Get non-dismissed notifications
      notifications = await ctx.db
        .query("notifications")
        .withIndex("by_user_not_dismissed", (q) =>
          q.eq("userId", user._id).eq("isDismissed", false)
        )
        .order("desc")
        .take(limit);
    } else {
      // Get only unread notifications
      notifications = await ctx.db
        .query("notifications")
        .withIndex("by_user_unread", (q) =>
          q.eq("userId", user._id).eq("isRead", false)
        )
        .order("desc")
        .take(limit);
    }

    return notifications;
  },
});

/**
 * Get unread notification count for the current user.
 */
export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) =>
        q.eq("userId", user._id).eq("isRead", false)
      )
      .collect();

    return unreadNotifications.length;
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

    await ctx.db.patch(args.notificationId, {
      isRead: true,
      readAt: Date.now(),
    });

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
    const now = Date.now();

    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) =>
        q.eq("userId", user._id).eq("isRead", false)
      )
      .collect();

    for (const notification of unreadNotifications) {
      await ctx.db.patch(notification._id, {
        isRead: true,
        readAt: now,
      });
    }

    return { markedCount: unreadNotifications.length };
  },
});

/**
 * Dismiss a notification (hide from notification list).
 */
export const dismissNotification = mutation({
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
      isRead: true, // Also mark as read when dismissing
      readAt: notification.readAt || Date.now(),
    });

    return { success: true };
  },
});

/**
 * Internal mutation to create an in-app notification.
 */
export const createNotification = internalMutation({
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
      isRead: false,
      isDismissed: false,
      triggeredBy: args.triggeredBy,
      metadata: args.metadata,
      createdAt: Date.now(),
    });

    return notificationId;
  },
});

/**
 * Combined function to send both push notification and create in-app notification.
 * This is the main entry point for triggering notifications.
 */
export const sendNotificationWithInApp = internalAction({
  args: {
    userId: v.id("users"),
    type: v.union(
      v.literal("chat_team"),
      v.literal("chat_dm"),
      v.literal("chat_project"),
      v.literal("chat_broadcast"),
      v.literal("offerte_status"),
      v.literal("project_assignment")
    ),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
    // In-app notification specific fields
    inAppType: v.optional(v.union(
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
    )),
    offerteId: v.optional(v.id("offertes")),
    offerteNummer: v.optional(v.string()),
    projectId: v.optional(v.id("projecten")),
    projectNaam: v.optional(v.string()),
    klantNaam: v.optional(v.string()),
    senderName: v.optional(v.string()),
    senderClerkId: v.optional(v.string()),
    triggeredBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Create in-app notification
    const notificationType = args.inAppType || mapPushTypeToInAppType(args.type);

    await ctx.runMutation(internal.pushNotifications.createNotification, {
      userId: args.userId,
      type: notificationType,
      title: args.title,
      message: args.body,
      offerteId: args.offerteId,
      offerteNummer: args.offerteNummer,
      projectId: args.projectId,
      projectNaam: args.projectNaam,
      klantNaam: args.klantNaam,
      senderName: args.senderName,
      senderClerkId: args.senderClerkId,
      triggeredBy: args.triggeredBy,
      metadata: args.data,
    });

    // Send push notification
    await ctx.runAction(internal.pushNotifications.sendPushNotification, {
      userId: args.userId,
      type: args.type,
      title: args.title,
      body: args.body,
      data: args.data,
    });
  },
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function mapPushTypeToInAppType(
  pushType: string
): "chat_message" | "chat_dm" | "chat_broadcast" | "project_assignment" | "offerte_geaccepteerd" {
  switch (pushType) {
    case "chat_team":
    case "chat_project":
      return "chat_message";
    case "chat_dm":
      return "chat_dm";
    case "chat_broadcast":
      return "chat_broadcast";
    case "project_assignment":
      return "project_assignment";
    case "offerte_status":
      return "offerte_geaccepteerd"; // Default, should be overridden by inAppType
    default:
      return "chat_message";
  }
}

// Type for notification preferences (matches schema but with some optional fields)
interface NotificationPreferences {
  enablePushNotifications: boolean;
  notifyOnTeamChat: boolean;
  notifyOnDirectMessage: boolean;
  notifyOnProjectChat: boolean;
  notifyOnBroadcast: boolean;
  respectQuietHours: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  mutedChannels?: string[];
  mutedUsers?: string[];
}

function getDefaultPreferences(): NotificationPreferences {
  return {
    enablePushNotifications: true,
    notifyOnTeamChat: true,
    notifyOnDirectMessage: true,
    notifyOnProjectChat: true,
    notifyOnBroadcast: true,
    respectQuietHours: false,
    quietHoursStart: undefined,
    quietHoursEnd: undefined,
    mutedChannels: [],
    mutedUsers: [],
  };
}

function checkNotificationTypeAllowed(
  type: string,
  preferences: NotificationPreferences
): boolean {
  switch (type) {
    case "chat_team":
      return preferences.notifyOnTeamChat;
    case "chat_dm":
      return preferences.notifyOnDirectMessage;
    case "chat_project":
      return preferences.notifyOnProjectChat;
    case "chat_broadcast":
      return preferences.notifyOnBroadcast;
    case "offerte_status":
    case "project_assignment":
      // These are always allowed if push notifications are enabled
      return true;
    default:
      return true;
  }
}

function isInQuietHours(
  preferences: NotificationPreferences
): boolean {
  if (!preferences.quietHoursStart || !preferences.quietHoursEnd) {
    return false;
  }

  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  const startParts = preferences.quietHoursStart.split(":");
  const endParts = preferences.quietHoursEnd.split(":");

  const startHours = parseInt(startParts[0], 10);
  const startMinutes = parseInt(startParts[1], 10);
  const endHours = parseInt(endParts[0], 10);
  const endMinutes = parseInt(endParts[1], 10);

  const startTime = startHours * 60 + startMinutes;
  const endTime = endHours * 60 + endMinutes;

  // Handle overnight quiet hours (e.g., 22:00 - 07:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime < endTime;
  }

  return currentTime >= startTime && currentTime < endTime;
}

function getChannelIdForType(type: string): string {
  switch (type) {
    case "chat_team":
    case "chat_dm":
    case "chat_project":
    case "chat_broadcast":
      return "chat";
    case "offerte_status":
      return "offertes";
    case "project_assignment":
      return "projects";
    default:
      return "default";
  }
}
