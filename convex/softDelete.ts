/**
 * Soft Delete Functions
 *
 * Provides scheduled cleanup of soft-deleted items and utility functions
 * for managing the soft delete lifecycle.
 *
 * Items are soft-deleted by setting a deletedAt timestamp.
 * After 30 days, they are permanently deleted by the cleanup function.
 */

import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// 30 days in milliseconds
const SOFT_DELETE_RETENTION_DAYS = 30;
const SOFT_DELETE_RETENTION_MS = SOFT_DELETE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/**
 * Internal query to get all soft-deleted items older than retention period.
 * Used by the cleanup scheduled function.
 */
export const getExpiredSoftDeletedItems = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cutoffTime = Date.now() - SOFT_DELETE_RETENTION_MS;

    // Get expired soft-deleted offertes
    const allOffertes = await ctx.db.query("offertes").collect();
    const expiredOffertes = allOffertes.filter(
      (o) => o.deletedAt && o.deletedAt < cutoffTime
    );

    // Get expired soft-deleted projecten
    const allProjecten = await ctx.db.query("projecten").collect();
    const expiredProjecten = allProjecten.filter(
      (p) => p.deletedAt && p.deletedAt < cutoffTime
    );

    return {
      offertes: expiredOffertes.map((o) => ({
        _id: o._id,
        userId: o.userId,
        deletedAt: o.deletedAt,
      })),
      projecten: expiredProjecten.map((p) => ({
        _id: p._id,
        userId: p.userId,
        deletedAt: p.deletedAt,
      })),
    };
  },
});

/**
 * Internal mutation to permanently delete an offerte.
 * Used by the cleanup scheduled function.
 */
export const permanentlyDeleteOfferte = internalMutation({
  args: { id: v.id("offertes") },
  handler: async (ctx, args) => {
    // Delete related versions
    const versions = await ctx.db
      .query("offerte_versions")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.id))
      .collect();
    for (const version of versions) {
      await ctx.db.delete(version._id);
    }

    // Delete related messages
    const messages = await ctx.db
      .query("offerte_messages")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.id))
      .collect();
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete related email logs
    const emailLogs = await ctx.db
      .query("email_logs")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.id))
      .collect();
    for (const log of emailLogs) {
      await ctx.db.delete(log._id);
    }

    // Delete related voorcalculaties (linked via offerteId)
    const voorcalculaties = await ctx.db
      .query("voorcalculaties")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.id))
      .collect();
    for (const voorcalculatie of voorcalculaties) {
      await ctx.db.delete(voorcalculatie._id);
    }

    // Delete related notifications
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.id))
      .collect();
    for (const notification of notifications) {
      await ctx.db.delete(notification._id);
    }

    // Delete the offerte
    await ctx.db.delete(args.id);
    return args.id;
  },
});

/**
 * Internal mutation to permanently delete a project.
 * Used by the cleanup scheduled function.
 */
export const permanentlyDeleteProject = internalMutation({
  args: { id: v.id("projecten") },
  handler: async (ctx, args) => {
    // Delete related voorcalculaties
    const voorcalculaties = await ctx.db
      .query("voorcalculaties")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();
    for (const voorcalculatie of voorcalculaties) {
      await ctx.db.delete(voorcalculatie._id);
    }

    // Delete related planningTaken
    const planningTaken = await ctx.db
      .query("planningTaken")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();
    for (const t of planningTaken) {
      await ctx.db.delete(t._id);
    }

    // Delete related urenRegistraties
    const urenRegistraties = await ctx.db
      .query("urenRegistraties")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();
    for (const u of urenRegistraties) {
      await ctx.db.delete(u._id);
    }

    // Delete related machineGebruik
    const machineGebruik = await ctx.db
      .query("machineGebruik")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();
    for (const m of machineGebruik) {
      await ctx.db.delete(m._id);
    }

    // Delete related nacalculaties
    const nacalculaties = await ctx.db
      .query("nacalculaties")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();
    for (const n of nacalculaties) {
      await ctx.db.delete(n._id);
    }

    // Delete related facturen
    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();
    for (const f of facturen) {
      await ctx.db.delete(f._id);
    }

    // Delete related locationSessions and their dependent data
    // (Routes, locationData, and geofenceEvents are all linked via sessions)
    const locationSessions = await ctx.db
      .query("locationSessions")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();
    for (const session of locationSessions) {
      // Delete locationData for this session
      const locationData = await ctx.db
        .query("locationData")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const loc of locationData) {
        await ctx.db.delete(loc._id);
      }

      // Delete geofenceEvents for this session
      const geofenceEvents = await ctx.db
        .query("geofenceEvents")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const event of geofenceEvents) {
        await ctx.db.delete(event._id);
      }

      // Delete routes for this session
      const sessionRoutes = await ctx.db
        .query("routes")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const route of sessionRoutes) {
        await ctx.db.delete(route._id);
      }

      // Delete the session itself
      await ctx.db.delete(session._id);
    }

    // Delete related locationAnalytics
    const locationAnalytics = await ctx.db
      .query("locationAnalytics")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();
    for (const analytics of locationAnalytics) {
      await ctx.db.delete(analytics._id);
    }

    // Delete related jobSiteGeofences
    const geofences = await ctx.db
      .query("jobSiteGeofences")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();
    for (const geofence of geofences) {
      // Also delete any geofenceEvents linked to this geofence
      const events = await ctx.db
        .query("geofenceEvents")
        .withIndex("by_geofence", (q) => q.eq("geofenceId", geofence._id))
        .collect();
      for (const event of events) {
        await ctx.db.delete(event._id);
      }
      await ctx.db.delete(geofence._id);
    }

    // Delete related team_messages for this project
    const teamMessages = await ctx.db
      .query("team_messages")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();
    for (const message of teamMessages) {
      await ctx.db.delete(message._id);
    }

    // Delete related notifications for this project
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();
    for (const notification of notifications) {
      await ctx.db.delete(notification._id);
    }

    // Delete the project
    await ctx.db.delete(args.id);
    return args.id;
  },
});

/**
 * Cleanup function to permanently delete expired soft-deleted items.
 * This should be called by a scheduled cron job (e.g., daily).
 *
 * To set up the cron job, add to convex/crons.ts:
 * ```
 * import { cronJobs } from "convex/server";
 * import { internal } from "./_generated/api";
 *
 * const crons = cronJobs();
 * crons.daily(
 *   "cleanup soft deleted items",
 *   { hourUTC: 3, minuteUTC: 0 }, // Run at 3:00 AM UTC daily
 *   internal.softDelete.cleanupExpiredItems
 * );
 * export default crons;
 * ```
 */
export const cleanupExpiredItems = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.runQuery(internal.softDelete.getExpiredSoftDeletedItems);

    let deletedOffertes = 0;
    let deletedProjecten = 0;

    // Permanently delete expired offertes
    for (const offerte of expired.offertes) {
      await ctx.runMutation(internal.softDelete.permanentlyDeleteOfferte, {
        id: offerte._id,
      });
      deletedOffertes++;
    }

    // Permanently delete expired projecten
    for (const project of expired.projecten) {
      await ctx.runMutation(internal.softDelete.permanentlyDeleteProject, {
        id: project._id,
      });
      deletedProjecten++;
    }

    return {
      deletedOffertes,
      deletedProjecten,
      timestamp: Date.now(),
    };
  },
});

/**
 * Get soft-deleted items for the current user (for a "Trash" view).
 */
export const getDeletedItems = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { offertes: [], projecten: [] };
    }

    // Get user from clerk ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      return { offertes: [], projecten: [] };
    }

    // Get deleted offertes
    const allOffertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const deletedOffertes = allOffertes
      .filter((o) => o.deletedAt)
      .map((o) => ({
        _id: o._id,
        offerteNummer: o.offerteNummer,
        klantNaam: o.klant.naam,
        type: o.type,
        totaalInclBtw: o.totalen.totaalInclBtw,
        deletedAt: o.deletedAt!,
        // Calculate days until permanent deletion
        daysUntilPermanentDelete: Math.ceil(
          (o.deletedAt! + SOFT_DELETE_RETENTION_MS - Date.now()) / (24 * 60 * 60 * 1000)
        ),
      }))
      .sort((a, b) => b.deletedAt - a.deletedAt);

    // Get deleted projecten
    const allProjecten = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const deletedProjecten = await Promise.all(
      allProjecten
        .filter((p) => p.deletedAt)
        .map(async (p) => {
          // Get offerte for klant naam
          const offerte = await ctx.db.get(p.offerteId);
          return {
            _id: p._id,
            naam: p.naam,
            status: p.status,
            klantNaam: offerte?.klant?.naam || "Onbekende klant",
            deletedAt: p.deletedAt!,
            // Calculate days until permanent deletion
            daysUntilPermanentDelete: Math.ceil(
              (p.deletedAt! + SOFT_DELETE_RETENTION_MS - Date.now()) / (24 * 60 * 60 * 1000)
            ),
          };
        })
    );

    return {
      offertes: deletedOffertes,
      projecten: deletedProjecten.sort((a, b) => b.deletedAt - a.deletedAt),
    };
  },
});

// ============================================
// SHARE TOKEN CLEANUP
// ============================================

/**
 * Clean up expired share tokens from offertes.
 * Share tokens older than 30 days are cleared.
 * This helps with data hygiene and security.
 */
export const cleanupExpiredShareTokens = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffTime = Date.now() - SOFT_DELETE_RETENTION_MS; // 30 days

    // Find offertes with expired share tokens
    const allOffertes = await ctx.db.query("offertes").collect();
    const offertesWithExpiredTokens = allOffertes.filter(
      (o) =>
        o.shareToken &&
        o.shareExpiresAt &&
        o.shareExpiresAt < cutoffTime
    );

    let cleanedTokens = 0;

    for (const offerte of offertesWithExpiredTokens) {
      await ctx.db.patch(offerte._id, {
        shareToken: undefined,
        shareExpiresAt: undefined,
      });
      cleanedTokens++;
    }

    return {
      cleanedTokens,
      timestamp: Date.now(),
    };
  },
});

// ============================================
// NOTIFICATION CLEANUP
// ============================================

// 90 days in milliseconds for notification retention
const NOTIFICATION_RETENTION_DAYS = 90;
const NOTIFICATION_RETENTION_MS = NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/**
 * Clean up old read notifications.
 * Deletes read notifications older than 90 days.
 * Keeps unread notifications regardless of age.
 */
export const cleanupOldNotifications = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffTime = Date.now() - NOTIFICATION_RETENTION_MS; // 90 days

    // Get all notifications and filter for old read ones
    const allNotifications = await ctx.db.query("notifications").collect();
    const oldReadNotifications = allNotifications.filter(
      (n) => n.isRead && n.createdAt < cutoffTime
    );

    let deletedNotifications = 0;

    for (const notification of oldReadNotifications) {
      await ctx.db.delete(notification._id);
      deletedNotifications++;
    }

    return {
      deletedNotifications,
      timestamp: Date.now(),
    };
  },
});

/**
 * Clean up old notification logs (push notification tracking).
 * Deletes logs older than 30 days.
 */
export const cleanupOldNotificationLogs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffTime = Date.now() - SOFT_DELETE_RETENTION_MS; // 30 days

    // Get all notification logs and filter for old ones
    const allLogs = await ctx.db.query("notification_log").collect();
    const oldLogs = allLogs.filter((l) => l.createdAt < cutoffTime);

    let deletedLogs = 0;

    for (const log of oldLogs) {
      await ctx.db.delete(log._id);
      deletedLogs++;
    }

    return {
      deletedLogs,
      timestamp: Date.now(),
    };
  },
});

/**
 * Clean up old push notification logs.
 * Deletes logs older than 30 days.
 */
export const cleanupOldPushNotificationLogs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffTime = Date.now() - SOFT_DELETE_RETENTION_MS; // 30 days

    // Get all push notification logs and filter for old ones
    const allLogs = await ctx.db.query("pushNotificationLogs").collect();
    const oldLogs = allLogs.filter((l) => l.createdAt < cutoffTime);

    let deletedLogs = 0;

    for (const log of oldLogs) {
      await ctx.db.delete(log._id);
      deletedLogs++;
    }

    return {
      deletedLogs,
      timestamp: Date.now(),
    };
  },
});

// ============================================
// SCHEDULED DAILY CLEANUP
// ============================================

/**
 * Main daily cleanup function that orchestrates all cleanup tasks.
 * This should be called by a scheduled cron job (e.g., daily at 3:00 AM UTC).
 *
 * Tasks performed:
 * 1. Clean up expired soft-deleted items (offertes and projects older than 30 days)
 * 2. Clean up expired share tokens (older than 30 days)
 * 3. Clean up old read notifications (older than 90 days)
 * 4. Clean up old notification logs (older than 30 days)
 * 5. Clean up old push notification logs (older than 30 days)
 *
 * See convex/crons.ts for the cron job configuration.
 */
export const runDailyCleanup = internalMutation({
  args: {},
  handler: async (ctx): Promise<{
    softDelete: { deletedOffertes: number; deletedProjecten: number };
    shareTokens: { cleanedTokens: number };
    notifications: { deletedNotifications: number };
    notificationLogs: { deletedLogs: number };
    pushNotificationLogs: { deletedLogs: number };
    timestamp: number;
  }> => {
    const softDeleteCutoff = Date.now() - SOFT_DELETE_RETENTION_MS;
    const notificationCutoff = Date.now() - NOTIFICATION_RETENTION_MS;

    // ============================================
    // 1. Clean up expired soft-deleted items
    // ============================================

    // Get expired soft-deleted offertes
    const allOffertes = await ctx.db.query("offertes").collect();
    const expiredOffertes = allOffertes.filter(
      (o) => o.deletedAt && o.deletedAt < softDeleteCutoff
    );

    // Get expired soft-deleted projecten
    const allProjecten = await ctx.db.query("projecten").collect();
    const expiredProjecten = allProjecten.filter(
      (p) => p.deletedAt && p.deletedAt < softDeleteCutoff
    );

    let deletedOffertes = 0;
    let deletedProjecten = 0;

    // Permanently delete expired offertes
    for (const offerte of expiredOffertes) {
      await ctx.runMutation(internal.softDelete.permanentlyDeleteOfferte, {
        id: offerte._id,
      });
      deletedOffertes++;
    }

    // Permanently delete expired projecten
    for (const project of expiredProjecten) {
      await ctx.runMutation(internal.softDelete.permanentlyDeleteProject, {
        id: project._id,
      });
      deletedProjecten++;
    }

    // ============================================
    // 2. Clean up expired share tokens
    // ============================================

    const offertesWithExpiredTokens = allOffertes.filter(
      (o) =>
        o.shareToken &&
        o.shareExpiresAt &&
        o.shareExpiresAt < softDeleteCutoff
    );

    let cleanedTokens = 0;

    for (const offerte of offertesWithExpiredTokens) {
      await ctx.db.patch(offerte._id, {
        shareToken: undefined,
        shareExpiresAt: undefined,
      });
      cleanedTokens++;
    }

    // ============================================
    // 3. Clean up old read notifications
    // ============================================

    const allNotifications = await ctx.db.query("notifications").collect();
    const oldReadNotifications = allNotifications.filter(
      (n) => n.isRead && n.createdAt < notificationCutoff
    );

    let deletedNotifications = 0;

    for (const notification of oldReadNotifications) {
      await ctx.db.delete(notification._id);
      deletedNotifications++;
    }

    // ============================================
    // 4. Clean up old notification logs
    // ============================================

    const allNotificationLogs = await ctx.db.query("notification_log").collect();
    const oldNotificationLogs = allNotificationLogs.filter(
      (l) => l.createdAt < softDeleteCutoff
    );

    let deletedNotificationLogs = 0;

    for (const log of oldNotificationLogs) {
      await ctx.db.delete(log._id);
      deletedNotificationLogs++;
    }

    // ============================================
    // 5. Clean up old push notification logs
    // ============================================

    const allPushLogs = await ctx.db.query("pushNotificationLogs").collect();
    const oldPushLogs = allPushLogs.filter(
      (l) => l.createdAt < softDeleteCutoff
    );

    let deletedPushLogs = 0;

    for (const log of oldPushLogs) {
      await ctx.db.delete(log._id);
      deletedPushLogs++;
    }

    return {
      softDelete: {
        deletedOffertes,
        deletedProjecten,
      },
      shareTokens: {
        cleanedTokens,
      },
      notifications: {
        deletedNotifications,
      },
      notificationLogs: {
        deletedLogs: deletedNotificationLogs,
      },
      pushNotificationLogs: {
        deletedLogs: deletedPushLogs,
      },
      timestamp: Date.now(),
    };
  },
});
