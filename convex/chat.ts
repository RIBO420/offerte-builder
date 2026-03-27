/**
 * Chat Functions for Mobile App
 *
 * Provides team chat and direct messaging functionality for the medewerkers app.
 * Supports team channels, project-specific chat, and one-on-one direct messages.
 */

import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth, requireAuthUserId } from "./auth";
import { requireNotViewer, getCompanyUserId, isAdminRole, normalizeRole, getUserRole } from "./roles";
import {
  validateFile,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
  DANGEROUS_EXTENSIONS,
} from "./security";

// ============ TEAM CHAT ============

/**
 * Send a message to a team channel.
 * Supports team-wide chat, project-specific chat, and broadcast announcements.
 */
export const sendTeamMessage = mutation({
  args: {
    channelType: v.union(
      v.literal("team"),
      v.literal("project"),
      v.literal("broadcast")
    ),
    projectId: v.optional(v.id("projecten")),
    message: v.string(),
    messageType: v.optional(
      v.union(v.literal("text"), v.literal("image"), v.literal("announcement"))
    ),
    attachmentStorageId: v.optional(v.id("_storage")),
    attachmentType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireNotViewer(ctx);

    // Validate attachment type if provided
    if (args.attachmentType) {
      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
      if (!allowedTypes.includes(args.attachmentType.toLowerCase())) {
        throw new ConvexError(
          `Bestandstype "${args.attachmentType}" is niet toegestaan. Alleen afbeeldingen (JPEG, PNG, GIF, WebP) en PDF bestanden zijn toegestaan.`
        );
      }
    }

    // Validate project channel has projectId
    if (args.channelType === "project" && !args.projectId) {
      throw new ConvexError("Project ID is verplicht voor project kanaal");
    }

    // Resolve company owner ID (admin for medewerkers, self for directie)
    const companyId = await getCompanyUserId(ctx);

    // Verify project access if projectId provided
    if (args.projectId) {
      const project = await ctx.db.get(args.projectId);
      if (!project) {
        throw new ConvexError("Project niet gevonden");
      }
      // Project must belong to the same company
      if (project.userId.toString() !== companyId.toString()) {
        throw new ConvexError("Geen toegang tot dit project");
      }
      // For non-directie/projectleider roles, check medewerker assignment
      const role = normalizeRole(user.role);
      if (role !== "directie" && role !== "projectleider") {
        const linkedMedewerkerId = user.linkedMedewerkerId;
        const assigned = project.toegewezenMedewerkerIds ?? [];
        const isAssigned =
          linkedMedewerkerId &&
          assigned.some(
            (id) => id.toString() === linkedMedewerkerId.toString()
          );
        if (!isAssigned) {
          throw new ConvexError(
            "Je bent niet toegewezen aan dit project"
          );
        }
      }
    }

    // Generate channel name
    let channelName: string = args.channelType;
    if (args.channelType === "project" && args.projectId) {
      const project = await ctx.db.get(args.projectId);
      channelName = project?.naam || `project-${args.projectId}`;
    }

    const messageId = await ctx.db.insert("team_messages", {
      senderId: user._id,
      senderName: user.name || "Onbekend",
      senderClerkId: user.clerkId,
      senderRole: normalizeRole(user.role),
      companyId,
      channelType: args.channelType,
      projectId: args.projectId,
      channelName,
      message: args.message,
      messageType: args.messageType || "text",
      attachmentStorageId: args.attachmentStorageId,
      attachmentType: args.attachmentType,
      isRead: false,
      readBy: [user.clerkId], // Sender has read their own message
      createdAt: Date.now(),
    });

    // Trigger push notifications to team members
    // Using scheduler to run async and not block the mutation
    await ctx.scheduler.runAfter(0, internal.notifications.sendChatNotifications, {
      messageId: messageId.toString(),
      senderClerkId: user.clerkId,
      senderName: user.name || "Onbekend",
      companyId: companyId.toString(),
      channelType: args.channelType,
      channelName,
      projectId: args.projectId?.toString(),
      messagePreview: args.message,
    });

    return { messageId };
  },
});

/**
 * Get team messages for a specific channel.
 * Returns messages in ascending order (oldest first).
 */
export const getTeamMessages = query({
  args: {
    channelType: v.union(
      v.literal("team"),
      v.literal("project"),
      v.literal("broadcast")
    ),
    projectId: v.optional(v.id("projecten")),
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()), // Timestamp for pagination
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const companyId = await getCompanyUserId(ctx);
    const limit = args.limit || 50;

    // Build query using company owner ID so all team members see the same messages
    let messagesQuery = ctx.db
      .query("team_messages")
      .withIndex("by_channel", (q) =>
        q.eq("companyId", companyId).eq("channelType", args.channelType)
      );

    // Filter by projectId if provided
    if (args.projectId) {
      messagesQuery = messagesQuery.filter((q) =>
        q.eq(q.field("projectId"), args.projectId)
      );
    }

    // Apply cursor for pagination (messages before this timestamp)
    if (args.cursor) {
      messagesQuery = messagesQuery.filter((q) =>
        q.lt(q.field("createdAt"), args.cursor!)
      );
    }

    // Get messages in descending order, then reverse for ascending display
    const messages = await messagesQuery.order("desc").take(limit);

    // Enrich messages with sender role (for old messages without senderRole)
    const enriched = await Promise.all(
      messages.map(async (msg) => {
        if (msg.senderRole) return msg;
        const sender = await ctx.db.get(msg.senderId);
        return { ...msg, senderRole: normalizeRole(sender?.role) };
      })
    );

    // Return in ascending order (oldest first)
    return enriched.reverse();
  },
});

/**
 * Mark team messages as read for the current user.
 * Updates the readBy array for all unread messages in the channel.
 */
export const markTeamMessagesAsRead = mutation({
  args: {
    channelType: v.union(
      v.literal("team"),
      v.literal("project"),
      v.literal("broadcast")
    ),
    projectId: v.optional(v.id("projecten")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const companyId = await getCompanyUserId(ctx);

    // Get all messages in this channel that the user hasn't read
    let messagesQuery = ctx.db
      .query("team_messages")
      .withIndex("by_channel", (q) =>
        q.eq("companyId", companyId).eq("channelType", args.channelType)
      )
      .filter((q) => q.neq(q.field("senderId"), user._id)); // Don't include own messages

    if (args.projectId) {
      messagesQuery = messagesQuery.filter((q) =>
        q.eq(q.field("projectId"), args.projectId)
      );
    }

    const messages = await messagesQuery.collect();
    let markedCount = 0;

    for (const message of messages) {
      const readBy = message.readBy || [];
      if (!readBy.includes(user.clerkId)) {
        await ctx.db.patch(message._id, {
          readBy: [...readBy, user.clerkId],
          isRead: true, // Mark as read if at least one person has read it
        });
        markedCount++;
      }
    }

    return { markedCount };
  },
});

/**
 * Get available chat channels for the current user.
 * Returns team, broadcast, and project-specific channels.
 */
export const getChannels = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const companyId = await getCompanyUserId(ctx);
    const role = await getUserRole(ctx);

    // Get all non-archived projects for this company
    const allProjects = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", companyId))
      .filter((q) =>
        q.or(
          q.eq(q.field("isArchived"), false),
          q.eq(q.field("isArchived"), undefined)
        )
      )
      .collect();

    // Determine which projects to show based on role
    let visibleProjects = allProjects;

    if (role !== "directie" && role !== "projectleider") {
      // For medewerkers/voorman/etc: only show projects they are assigned to
      const linkedMedewerkerId = user.linkedMedewerkerId;
      if (linkedMedewerkerId) {
        visibleProjects = allProjects.filter((project) => {
          const assigned = project.toegewezenMedewerkerIds ?? [];
          return assigned.some(
            (id) => id.toString() === linkedMedewerkerId.toString()
          );
        });
      } else {
        // No linked medewerker — no project channels
        visibleProjects = [];
      }
    }

    // Default channels (team and broadcast are visible to everyone)
    const channels: Array<{
      type: "team" | "project" | "broadcast";
      name: string;
      projectId: typeof allProjects[0]["_id"] | undefined;
    }> = [
      { type: "team", name: "Team Chat", projectId: undefined },
      {
        type: "broadcast",
        name: "Mededelingen",
        projectId: undefined,
      },
    ];

    // Add project channels for visible projects
    for (const project of visibleProjects) {
      channels.push({
        type: "project",
        name: project.naam,
        projectId: project._id,
      });
    }

    return channels;
  },
});

// ============ DIRECT MESSAGES ============

/**
 * Send a direct message to another user.
 */
export const sendDirectMessage = mutation({
  args: {
    toUserId: v.id("users"),
    message: v.string(),
    messageType: v.optional(v.union(v.literal("text"), v.literal("image"))),
    attachmentStorageId: v.optional(v.id("_storage")),
    attachmentType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireNotViewer(ctx);

    // Validate attachment type if provided
    if (args.attachmentType) {
      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
      if (!allowedTypes.includes(args.attachmentType.toLowerCase())) {
        throw new ConvexError(
          `Bestandstype "${args.attachmentType}" is niet toegestaan. Alleen afbeeldingen (JPEG, PNG, GIF, WebP) en PDF bestanden zijn toegestaan.`
        );
      }
    }

    // Get recipient user
    const toUser = await ctx.db.get(args.toUserId);
    if (!toUser) {
      throw new ConvexError("Ontvanger niet gevonden");
    }

    const companyId = await getCompanyUserId(ctx);

    // Medewerkers mogen alleen directe berichten sturen naar directie
    if (!isAdminRole(normalizeRole(user.role))) {
      if (args.toUserId.toString() !== companyId.toString()) {
        throw new ConvexError(
          "Als medewerker kun je alleen berichten sturen naar de directie."
        );
      }
    }

    const messageId = await ctx.db.insert("direct_messages", {
      fromUserId: user._id,
      fromClerkId: user.clerkId,
      toUserId: args.toUserId,
      toClerkId: toUser.clerkId,
      companyId,
      message: args.message,
      messageType: args.messageType || "text",
      attachmentStorageId: args.attachmentStorageId,
      attachmentType: args.attachmentType,
      isRead: false,
      createdAt: Date.now(),
    });

    // Trigger push notification to recipient
    // Using scheduler to run async and not block the mutation
    await ctx.scheduler.runAfter(
      0,
      internal.notifications.sendDirectMessageNotification,
      {
        messageId: messageId.toString(),
        senderClerkId: user.clerkId,
        senderName: user.name || "Onbekend",
        recipientClerkId: toUser.clerkId,
        messagePreview: args.message,
      }
    );

    return { messageId };
  },
});

/**
 * Get direct messages between the current user and another user.
 * Returns messages in ascending order (oldest first).
 */
export const getDirectMessages = query({
  args: {
    withUserId: v.id("users"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()), // Timestamp for pagination
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const limit = args.limit || 50;

    // Get the other user's clerkId for the index query
    const otherUser = await ctx.db.get(args.withUserId);
    if (!otherUser) {
      return [];
    }

    // Query messages in both directions using filter
    // (index doesn't support OR queries, so we need to filter)
    let messagesQuery = ctx.db.query("direct_messages").filter((q) =>
      q.or(
        q.and(
          q.eq(q.field("fromClerkId"), user.clerkId),
          q.eq(q.field("toClerkId"), otherUser.clerkId)
        ),
        q.and(
          q.eq(q.field("fromClerkId"), otherUser.clerkId),
          q.eq(q.field("toClerkId"), user.clerkId)
        )
      )
    );

    // Apply cursor for pagination
    if (args.cursor) {
      messagesQuery = messagesQuery.filter((q) =>
        q.lt(q.field("createdAt"), args.cursor!)
      );
    }

    const messages = await messagesQuery.order("desc").take(limit);

    // Return in ascending order (oldest first)
    return messages.reverse();
  },
});

/**
 * Mark direct messages from a specific user as read.
 */
export const markDMAsRead = mutation({
  args: {
    fromUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Get the sender's clerkId
    const fromUser = await ctx.db.get(args.fromUserId);
    if (!fromUser) {
      return { markedCount: 0 };
    }

    // Find unread messages from this user to the current user
    const unreadMessages = await ctx.db
      .query("direct_messages")
      .withIndex("by_recipient_unread", (q) =>
        q.eq("toClerkId", user.clerkId).eq("isRead", false)
      )
      .filter((q) => q.eq(q.field("fromClerkId"), fromUser.clerkId))
      .collect();

    const now = Date.now();
    for (const message of unreadMessages) {
      await ctx.db.patch(message._id, {
        isRead: true,
        readAt: now,
      });
    }

    return { markedCount: unreadMessages.length };
  },
});

/**
 * Get list of DM conversations with last message preview.
 */
export const getDMConversations = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    // Get all DMs involving this user
    const allDMs = await ctx.db
      .query("direct_messages")
      .filter((q) =>
        q.or(
          q.eq(q.field("fromClerkId"), user.clerkId),
          q.eq(q.field("toClerkId"), user.clerkId)
        )
      )
      .order("desc")
      .collect();

    // Group by conversation partner
    const conversationsMap = new Map<
      string,
      {
        partnerId: string;
        partnerClerkId: string;
        lastMessage: (typeof allDMs)[0];
        unreadCount: number;
      }
    >();

    for (const dm of allDMs) {
      // Determine the conversation partner
      const isFromMe = dm.fromClerkId === user.clerkId;
      const partnerClerkId = isFromMe ? dm.toClerkId : dm.fromClerkId;
      const partnerId = isFromMe
        ? dm.toUserId.toString()
        : dm.fromUserId.toString();

      if (!conversationsMap.has(partnerClerkId)) {
        conversationsMap.set(partnerClerkId, {
          partnerId,
          partnerClerkId,
          lastMessage: dm,
          unreadCount: 0,
        });
      }

      // Count unread messages from partner
      if (!isFromMe && !dm.isRead) {
        const conv = conversationsMap.get(partnerClerkId)!;
        conv.unreadCount++;
      }
    }

    // Get user details for each conversation partner
    const conversations = [];
    const conversationEntries = Array.from(conversationsMap.values());
    for (const conv of conversationEntries) {
      const partnerUser = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", conv.partnerClerkId))
        .unique();

      if (partnerUser) {
        conversations.push({
          partnerId: partnerUser._id,
          partnerName: partnerUser.name || "Onbekend",
          partnerEmail: partnerUser.email,
          lastMessage: conv.lastMessage.message,
          lastMessageAt: conv.lastMessage.createdAt,
          unreadCount: conv.unreadCount,
        });
      }
    }

    // Sort by last message time (most recent first)
    return conversations.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  },
});

// ============ UNREAD COUNTS ============

/**
 * Get unread message counts for the current user.
 * Returns counts for team channels and direct messages.
 */
export const getUnreadCounts = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const companyId = await getCompanyUserId(ctx);

    // Count unread team messages (messages not in readBy array)
    const teamMessages = await ctx.db
      .query("team_messages")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .filter((q) => q.neq(q.field("senderId"), user._id)) // Exclude own messages
      .collect();

    const unreadTeam = teamMessages.filter((m) => {
      const readBy = m.readBy || [];
      return !readBy.includes(user.clerkId);
    }).length;

    // Count unread DMs to this user
    const unreadDMs = await ctx.db
      .query("direct_messages")
      .withIndex("by_recipient_unread", (q) =>
        q.eq("toClerkId", user.clerkId).eq("isRead", false)
      )
      .collect();

    // Count by channel type for more granular unread counts
    const unreadByChannel = {
      team: 0,
      project: 0,
      broadcast: 0,
    };

    for (const msg of teamMessages) {
      const readBy = msg.readBy || [];
      if (!readBy.includes(user.clerkId)) {
        unreadByChannel[msg.channelType]++;
      }
    }

    return {
      team: unreadByChannel.team,
      project: unreadByChannel.project,
      broadcast: unreadByChannel.broadcast,
      dm: unreadDMs.length,
      total:
        unreadByChannel.team +
        unreadByChannel.project +
        unreadByChannel.broadcast +
        unreadDMs.length,
    };
  },
});

// ============ NOTIFICATION PREFERENCES ============

/**
 * Get notification preferences for the current user.
 */
export const getNotificationPreferences = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const preferences = await ctx.db
      .query("notification_preferences")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", user.clerkId))
      .unique();

    // Return defaults if no preferences exist
    if (!preferences) {
      return {
        enablePushNotifications: true,
        notifyOnTeamChat: true,
        notifyOnDirectMessage: true,
        notifyOnProjectChat: true,
        notifyOnBroadcast: true,
        respectQuietHours: false,
        mutedChannels: [],
        mutedUsers: [],
      };
    }

    return preferences;
  },
});

/**
 * Update notification preferences for the current user.
 */
export const updateNotificationPreferences = mutation({
  args: {
    enablePushNotifications: v.optional(v.boolean()),
    deviceToken: v.optional(v.string()),
    devicePlatform: v.optional(
      v.union(v.literal("ios"), v.literal("android"), v.literal("web"))
    ),
    notifyOnTeamChat: v.optional(v.boolean()),
    notifyOnDirectMessage: v.optional(v.boolean()),
    notifyOnProjectChat: v.optional(v.boolean()),
    notifyOnBroadcast: v.optional(v.boolean()),
    quietHoursStart: v.optional(v.string()),
    quietHoursEnd: v.optional(v.string()),
    respectQuietHours: v.optional(v.boolean()),
    mutedChannels: v.optional(v.array(v.string())),
    mutedUsers: v.optional(v.array(v.string())),
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

      if (args.enablePushNotifications !== undefined)
        updateData.enablePushNotifications = args.enablePushNotifications;
      if (args.deviceToken !== undefined)
        updateData.deviceToken = args.deviceToken;
      if (args.devicePlatform !== undefined)
        updateData.devicePlatform = args.devicePlatform;
      if (args.notifyOnTeamChat !== undefined)
        updateData.notifyOnTeamChat = args.notifyOnTeamChat;
      if (args.notifyOnDirectMessage !== undefined)
        updateData.notifyOnDirectMessage = args.notifyOnDirectMessage;
      if (args.notifyOnProjectChat !== undefined)
        updateData.notifyOnProjectChat = args.notifyOnProjectChat;
      if (args.notifyOnBroadcast !== undefined)
        updateData.notifyOnBroadcast = args.notifyOnBroadcast;
      if (args.quietHoursStart !== undefined)
        updateData.quietHoursStart = args.quietHoursStart;
      if (args.quietHoursEnd !== undefined)
        updateData.quietHoursEnd = args.quietHoursEnd;
      if (args.respectQuietHours !== undefined)
        updateData.respectQuietHours = args.respectQuietHours;
      if (args.mutedChannels !== undefined)
        updateData.mutedChannels = args.mutedChannels;
      if (args.mutedUsers !== undefined)
        updateData.mutedUsers = args.mutedUsers;

      await ctx.db.patch(existing._id, updateData);
      return existing._id;
    } else {
      // Create new preferences with defaults
      const preferencesId = await ctx.db.insert("notification_preferences", {
        userId: user._id,
        clerkUserId: user.clerkId,
        enablePushNotifications: args.enablePushNotifications ?? true,
        deviceToken: args.deviceToken,
        devicePlatform: args.devicePlatform,
        notifyOnTeamChat: args.notifyOnTeamChat ?? true,
        notifyOnDirectMessage: args.notifyOnDirectMessage ?? true,
        notifyOnProjectChat: args.notifyOnProjectChat ?? true,
        notifyOnBroadcast: args.notifyOnBroadcast ?? true,
        quietHoursStart: args.quietHoursStart,
        quietHoursEnd: args.quietHoursEnd,
        respectQuietHours: args.respectQuietHours ?? false,
        mutedChannels: args.mutedChannels,
        mutedUsers: args.mutedUsers,
        createdAt: now,
        updatedAt: now,
      });
      return preferencesId;
    }
  },
});

// ============ USER LIST FOR DM ============

/**
 * Get list of users available for direct messaging.
 * Returns medewerkers linked to the current user's company.
 */
export const getUsersForDM = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const companyId = await getCompanyUserId(ctx);

    // Get all active medewerkers for this company
    const medewerkers = await ctx.db
      .query("medewerkers")
      .withIndex("by_user_actief", (q) =>
        q.eq("userId", companyId).eq("isActief", true)
      )
      .collect();

    // Build list of DM-able users (exclude current user)
    const usersWithAccounts = [];

    // Include the company owner (directie) if current user is not the owner
    if (companyId.toString() !== user._id.toString()) {
      const companyOwner = await ctx.db.get(companyId);
      if (companyOwner) {
        usersWithAccounts.push({
          userId: companyOwner._id,
          medewerkerId: undefined,
          naam: companyOwner.name || "Directie",
          email: companyOwner.email,
          functie: "Directie",
        });
      }
    }

    // Only directie can DM other medewerkers; medewerkers can only DM directie
    if (isAdminRole(normalizeRole(user.role))) {
      // Directie: include all medewerkers with Clerk accounts
      for (const medewerker of medewerkers) {
        if (medewerker.clerkUserId) {
          const medewerkerUser = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) =>
              q.eq("clerkId", medewerker.clerkUserId!)
            )
            .unique();

          // Skip current user
          if (medewerkerUser && medewerkerUser._id.toString() !== user._id.toString()) {
            usersWithAccounts.push({
              userId: medewerkerUser._id,
              medewerkerId: medewerker._id,
              naam: medewerker.naam,
              email: medewerker.email,
              functie: medewerker.functie,
            });
          }
        }
      }
    }
    // Medewerkers: only the company owner (directie) is shown, already added above

    return usersWithAccounts;
  },
});

// ============ SEARCH ============

/**
 * Search messages across all channels.
 */
export const searchMessages = query({
  args: {
    searchQuery: v.string(),
    channelType: v.optional(
      v.union(v.literal("team"), v.literal("project"), v.literal("broadcast"))
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const companyId = await getCompanyUserId(ctx);
    const limit = args.limit || 20;

    // Use the search index for team messages
    const results = await ctx.db
      .query("team_messages")
      .withSearchIndex("search_messages", (q) => {
        let search = q.search("message", args.searchQuery);
        search = search.eq("companyId", companyId);
        if (args.channelType) {
          search = search.eq("channelType", args.channelType);
        }
        return search;
      })
      .take(limit);

    return results;
  },
});

// ============ DELETE MESSAGE ============

/**
 * Delete a team message (only by sender or admin).
 */
export const deleteTeamMessage = mutation({
  args: {
    messageId: v.id("team_messages"),
  },
  handler: async (ctx, args) => {
    const user = await requireNotViewer(ctx);
    const companyId = await getCompanyUserId(ctx);

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new ConvexError("Bericht niet gevonden");
    }

    // Only sender or company owner (directie) can delete
    if (
      message.senderId.toString() !== user._id.toString() &&
      message.companyId.toString() !== companyId.toString()
    ) {
      throw new ConvexError("Geen toegang om dit bericht te verwijderen");
    }

    await ctx.db.delete(args.messageId);
    return { success: true };
  },
});

/**
 * Delete a direct message (only by sender).
 */
export const deleteDirectMessage = mutation({
  args: {
    messageId: v.id("direct_messages"),
  },
  handler: async (ctx, args) => {
    const user = await requireNotViewer(ctx);

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new ConvexError("Bericht niet gevonden");
    }

    // Only sender can delete
    if (message.fromUserId.toString() !== user._id.toString()) {
      throw new ConvexError("Alleen de afzender kan dit bericht verwijderen");
    }

    await ctx.db.delete(args.messageId);
    return { success: true };
  },
});

// ============ EDIT MESSAGE ============

/**
 * Edit a team message (only by sender, within time limit).
 */
export const editTeamMessage = mutation({
  args: {
    messageId: v.id("team_messages"),
    newMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireNotViewer(ctx);

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new ConvexError("Bericht niet gevonden");
    }

    // Only sender can edit
    if (message.senderId.toString() !== user._id.toString()) {
      throw new ConvexError("Alleen de afzender kan dit bericht bewerken");
    }

    // Check time limit (e.g., 15 minutes)
    const EDIT_TIME_LIMIT = 15 * 60 * 1000; // 15 minutes in milliseconds
    if (Date.now() - message.createdAt > EDIT_TIME_LIMIT) {
      throw new ConvexError(
        "Bericht kan niet meer worden bewerkt (tijdslimiet verstreken)"
      );
    }

    await ctx.db.patch(args.messageId, {
      message: args.newMessage,
      editedAt: Date.now(),
    });

    return { success: true };
  },
});

// ============ FILE UPLOAD ============

/**
 * Validate a file before upload.
 * Checks file size, MIME type, and dangerous extensions.
 * Returns validation result without generating upload URL.
 */
export const validateFileUpload = mutation({
  args: {
    fileName: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    // Require authentication (viewers cannot upload)
    await requireNotViewer(ctx);

    // Validate the file
    const validation = validateFile(args.fileName, args.mimeType, args.fileSize);

    if (!validation.valid) {
      throw new ConvexError(validation.error || "Bestand validatie mislukt");
    }

    return {
      valid: true,
      maxFileSize: MAX_FILE_SIZE_BYTES,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    };
  },
});

/**
 * Generate an upload URL for a validated file.
 * The file must be validated first using validateFileUpload.
 */
export const generateUploadUrl = mutation({
  args: {
    fileName: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    // Require authentication (viewers cannot upload)
    const user = await requireNotViewer(ctx);

    // Validate the file before generating URL
    const validation = validateFile(args.fileName, args.mimeType, args.fileSize);

    if (!validation.valid) {
      throw new ConvexError(validation.error || "Bestand validatie mislukt");
    }

    // Generate the upload URL
    const uploadUrl = await ctx.storage.generateUploadUrl();

    return { uploadUrl };
  },
});

/**
 * Register an uploaded file as a chat attachment.
 * Call this after successful upload to link the storage ID to a message.
 */
export const registerChatAttachment = mutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    messageId: v.optional(v.id("team_messages")),
    directMessageId: v.optional(v.id("direct_messages")),
  },
  handler: async (ctx, args) => {
    const user = await requireNotViewer(ctx);

    // Re-validate file info (in case of tampering)
    const validation = validateFile(args.fileName, args.fileType, args.fileSize);
    if (!validation.valid) {
      // Delete the uploaded file if validation fails
      await ctx.storage.delete(args.storageId);
      throw new ConvexError(validation.error || "Bestand validatie mislukt");
    }

    // Register the attachment
    const companyId = await getCompanyUserId(ctx);
    const attachmentId = await ctx.db.insert("chat_attachments", {
      storageId: args.storageId,
      messageId: args.messageId,
      directMessageId: args.directMessageId,
      userId: user._id,
      companyId,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
      createdAt: Date.now(),
    });

    return { attachmentId };
  },
});

/**
 * Get file URL from storage.
 * Validates that user has access to the file.
 */
export const getFileUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const url = await ctx.storage.getUrl(args.storageId);
    return url;
  },
});
