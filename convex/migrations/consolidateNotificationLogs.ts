/**
 * Migration: Consolidate Notification Logs
 *
 * Migrates data from the two deprecated notification log tables into
 * the unified notificationDeliveryLog table:
 *
 * 1. pushNotificationLogs → notificationDeliveryLog (channel: "push")
 * 2. notification_log → notificationDeliveryLog (channel: "chat")
 *
 * For notification_log records, the recipientClerkId is resolved to a
 * userId via the users table.
 *
 * Uses batch processing (100 records at a time) to avoid timeouts.
 *
 * Run via Convex dashboard or CLI:
 *   npx convex run migrations/consolidateNotificationLogs:migrateNotificationLogs
 */

import { internalMutation } from "../_generated/server";

const BATCH_SIZE = 100;

export const migrateNotificationLogs = internalMutation({
  args: {},
  handler: async (ctx) => {
    let migratedPush = 0;
    let migratedChat = 0;
    let skippedChat = 0;
    const errors: string[] = [];

    // ============================================
    // 1. Migrate pushNotificationLogs → notificationDeliveryLog (push)
    // ============================================

    const allPushLogs = await ctx.db.query("pushNotificationLogs").collect();
    const pushBatches = Math.ceil(allPushLogs.length / BATCH_SIZE);

    for (let i = 0; i < pushBatches; i++) {
      const batch = allPushLogs.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);

      for (const log of batch) {
        try {
          await ctx.db.insert("notificationDeliveryLog", {
            userId: log.userId,
            channel: "push",
            type: log.type,
            status: log.status,
            ticketId: log.ticketId,
            title: log.title,
            body: log.body,
            error: log.error,
            data: log.data,
            createdAt: log.createdAt,
          });
          migratedPush++;
        } catch (e) {
          const errorMsg = `Failed to migrate pushNotificationLog ${log._id}: ${e instanceof Error ? e.message : String(e)}`;
          errors.push(errorMsg);
        }
      }
    }

    // ============================================
    // 2. Migrate notification_log → notificationDeliveryLog (chat)
    // ============================================

    // Build a lookup map from clerkId → userId to avoid repeated queries
    const allUsers = await ctx.db.query("users").collect();
    const clerkIdToUserId = new Map<string, typeof allUsers[0]["_id"]>();
    for (const user of allUsers) {
      clerkIdToUserId.set(user.clerkId, user._id);
    }

    const allChatLogs = await ctx.db.query("notification_log").collect();
    const chatBatches = Math.ceil(allChatLogs.length / BATCH_SIZE);

    for (let i = 0; i < chatBatches; i++) {
      const batch = allChatLogs.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);

      for (const log of batch) {
        try {
          // Resolve recipientClerkId to userId
          const userId = clerkIdToUserId.get(log.recipientClerkId);
          if (!userId) {
            skippedChat++;
            errors.push(
              `Skipped notification_log ${log._id}: no user found for clerkId "${log.recipientClerkId}"`
            );
            continue;
          }

          // Resolve senderClerkId to userId (optional)
          const senderUserId = clerkIdToUserId.get(log.senderClerkId);

          await ctx.db.insert("notificationDeliveryLog", {
            userId,
            channel: "chat",
            type: `chat_${log.channelType}`, // e.g. "chat_team", "chat_project"
            status: log.status,
            messageId: log.messageId,
            channelType: log.channelType,
            reason: log.reason,
            projectId: log.projectId,
            senderUserId,
            createdAt: log.createdAt,
          });
          migratedChat++;
        } catch (e) {
          const errorMsg = `Failed to migrate notification_log ${log._id}: ${e instanceof Error ? e.message : String(e)}`;
          errors.push(errorMsg);
        }
      }
    }

    // ============================================
    // Summary
    // ============================================

    const summary = {
      migratedPush,
      migratedChat,
      skippedChat,
      totalMigrated: migratedPush + migratedChat,
      totalErrors: errors.length,
      errors: errors.slice(0, 50), // Cap error output to avoid huge payloads
      timestamp: Date.now(),
    };

    console.log(
      `[Migration] Consolidated notification logs: ` +
        `${migratedPush} push logs migrated, ` +
        `${migratedChat} chat logs migrated, ` +
        `${skippedChat} chat logs skipped (no user found), ` +
        `${errors.length} errors total`
    );

    return summary;
  },
});
