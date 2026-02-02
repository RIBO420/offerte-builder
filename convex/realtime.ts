/**
 * Real-time Subscription Queries
 *
 * Optimized queries specifically designed for real-time subscriptions.
 * These queries are lightweight and return only the essential data needed
 * for real-time updates on the dashboard and other UI components.
 *
 * Convex automatically provides real-time updates when using `useQuery` -
 * these queries are structured to maximize real-time performance.
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

/**
 * Real-time dashboard stats - lightweight query for live stat updates.
 * Returns only counts and key metrics, updated in real-time.
 */
export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    // Batch fetch core data in parallel
    const [allOffertes, allProjects, allFacturen] = await Promise.all([
      ctx.db
        .query("offertes")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("projecten")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("facturen")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    // Filter active items
    const offertes = allOffertes.filter((o) => !o.isArchived && !o.deletedAt);
    const projects = allProjects.filter((p) => !p.isArchived && !p.deletedAt);

    // Calculate offerte stats
    const offerteStats = {
      totaal: offertes.length,
      concept: 0,
      voorcalculatie: 0,
      verzonden: 0,
      geaccepteerd: 0,
      afgewezen: 0,
      totaalWaarde: 0,
      geaccepteerdWaarde: 0,
    };

    for (const offerte of offertes) {
      offerteStats[offerte.status as keyof typeof offerteStats]++;
      offerteStats.totaalWaarde += offerte.totalen.totaalInclBtw;
      if (offerte.status === "geaccepteerd") {
        offerteStats.geaccepteerdWaarde += offerte.totalen.totaalInclBtw;
      }
    }

    // Calculate project stats
    const projectStats = {
      totaal: projects.length,
      gepland: 0,
      in_uitvoering: 0,
      afgerond: 0,
      nacalculatie_compleet: 0,
      gefactureerd: 0,
    };

    for (const project of projects) {
      if (project.status in projectStats) {
        projectStats[project.status as keyof typeof projectStats]++;
      }
    }

    // Calculate revenue stats
    let totalAcceptedValue = 0;
    let totalAcceptedCount = 0;
    let totalSentCount = 0;

    for (const offerte of offertes) {
      if (offerte.status === "geaccepteerd") {
        totalAcceptedValue += offerte.totalen.totaalInclBtw;
        totalAcceptedCount++;
      }
      if (["verzonden", "geaccepteerd", "afgewezen"].includes(offerte.status)) {
        totalSentCount++;
      }
    }

    const conversionRate =
      totalSentCount > 0 ? Math.round((totalAcceptedCount / totalSentCount) * 100) : 0;

    // Factuur stats
    let openstaandBedrag = 0;
    let betaaldBedrag = 0;
    let vervallenAantal = 0;

    for (const factuur of allFacturen) {
      if (factuur.status === "verzonden") {
        openstaandBedrag += factuur.totaalInclBtw;
        // Check if overdue
        if (factuur.vervaldatum < now) {
          vervallenAantal++;
        }
      } else if (factuur.status === "betaald") {
        betaaldBedrag += factuur.totaalInclBtw;
      }
    }

    return {
      offerteStats,
      projectStats,
      revenueStats: {
        totalAcceptedValue,
        totalAcceptedCount,
        conversionRate,
      },
      facturenStats: {
        openstaandBedrag,
        betaaldBedrag,
        vervallenAantal,
      },
      // Timestamp for tracking updates
      _updatedAt: now,
    };
  },
});

/**
 * Real-time notification count - very lightweight query for badge updates.
 * Returns only unread counts, optimized for frequent polling.
 */
export const getNotificationCounts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) => q.eq("userId", userId).eq("isRead", false))
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

    return {
      ...counts,
      // Timestamp for tracking updates
      _updatedAt: Date.now(),
    };
  },
});

/**
 * Real-time chat unread counts - for chat badge updates.
 */
export const getChatUnreadCounts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    // Get user details
    const user = await ctx.db.get(userId);
    if (!user) {
      return {
        team: 0,
        project: 0,
        broadcast: 0,
        dm: 0,
        total: 0,
        _updatedAt: Date.now(),
      };
    }

    // Count unread team messages
    const teamMessages = await ctx.db
      .query("team_messages")
      .withIndex("by_company", (q) => q.eq("companyId", userId))
      .filter((q) => q.neq(q.field("senderId"), userId))
      .collect();

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

    // Count unread DMs
    const unreadDMs = await ctx.db
      .query("direct_messages")
      .withIndex("by_recipient_unread", (q) =>
        q.eq("toClerkId", user.clerkId).eq("isRead", false)
      )
      .collect();

    return {
      ...unreadByChannel,
      dm: unreadDMs.length,
      total:
        unreadByChannel.team +
        unreadByChannel.project +
        unreadByChannel.broadcast +
        unreadDMs.length,
      _updatedAt: Date.now(),
    };
  },
});

/**
 * Real-time action items - for dashboard alerts.
 * Returns items that require immediate attention.
 */
export const getActionItems = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    // Batch fetch data
    const [allOffertes, allProjects, voorraadItems, inkooporders, qcControles] =
      await Promise.all([
        ctx.db
          .query("offertes")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect(),
        ctx.db
          .query("projecten")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect(),
        ctx.db
          .query("voorraad")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect(),
        ctx.db
          .query("inkooporders")
          .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "besteld"))
          .collect(),
        ctx.db
          .query("kwaliteitsControles")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect(),
      ]);

    // Filter active items
    const offertes = allOffertes.filter((o) => !o.isArchived && !o.deletedAt);
    const projects = allProjects.filter((p) => !p.isArchived && !p.deletedAt);

    // Accepted offertes without project
    const offertesWithProject = new Set(projects.map((p) => p.offerteId.toString()));
    const acceptedWithoutProject = offertes
      .filter((o) => o.status === "geaccepteerd" && !offertesWithProject.has(o._id.toString()))
      .length;

    // Low stock items
    const lowStockCount = voorraadItems.filter(
      (item) =>
        item.minVoorraad !== undefined &&
        item.minVoorraad !== null &&
        item.hoeveelheid < item.minVoorraad
    ).length;

    // Open inkooporders
    const openInkooporders = inkooporders.length;

    // Open QC checks
    const openQCChecks = qcControles.filter(
      (c) => c.status === "open" || c.status === "in_uitvoering"
    ).length;

    return {
      acceptedWithoutProject,
      lowStockCount,
      openInkooporders,
      openQCChecks,
      total: acceptedWithoutProject + lowStockCount + openInkooporders + openQCChecks,
      _updatedAt: now,
    };
  },
});

/**
 * Real-time latest messages - for live chat updates.
 * Returns the most recent messages across all channels.
 */
export const getLatestMessages = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const limit = args.limit || 10;

    // Get latest team messages
    const teamMessages = await ctx.db
      .query("team_messages")
      .withIndex("by_company", (q) => q.eq("companyId", userId))
      .order("desc")
      .take(limit);

    return {
      messages: teamMessages.map((msg) => ({
        _id: msg._id,
        senderName: msg.senderName,
        channelType: msg.channelType,
        channelName: msg.channelName,
        message: msg.message.substring(0, 100),
        createdAt: msg.createdAt,
      })),
      _updatedAt: Date.now(),
    };
  },
});

/**
 * Real-time active projects with progress - for project cards.
 */
export const getActiveProjectsLive = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const limit = args.limit || 5;

    // Get active projects
    const activeProjects = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "in_uitvoering"),
          q.or(
            q.eq(q.field("isArchived"), false),
            q.eq(q.field("isArchived"), undefined)
          ),
          q.or(
            q.eq(q.field("deletedAt"), undefined),
            q.eq(q.field("deletedAt"), null)
          )
        )
      )
      .order("desc")
      .take(limit);

    // Fetch additional data for each project
    const projectsWithProgress = await Promise.all(
      activeProjects.map(async (project) => {
        // Get offerte for klant naam
        const offerte = await ctx.db.get(project.offerteId);
        const klantNaam = offerte?.klant?.naam || "Onbekende klant";

        // Get voorcalculatie for begrote uren
        let voorcalculatie = await ctx.db
          .query("voorcalculaties")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .unique();

        if (!voorcalculatie) {
          voorcalculatie = await ctx.db
            .query("voorcalculaties")
            .withIndex("by_offerte", (q) => q.eq("offerteId", project.offerteId))
            .unique();
        }
        const begroteUren = voorcalculatie?.normUrenTotaal || 0;

        // Get uren registraties
        const urenRegistraties = await ctx.db
          .query("urenRegistraties")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();
        const totaalUren = urenRegistraties.reduce((sum, u) => sum + u.uren, 0);

        // Calculate progress
        let voortgang = 0;
        if (begroteUren > 0) {
          voortgang = Math.min(100, Math.round((totaalUren / begroteUren) * 100));
        }

        return {
          _id: project._id,
          naam: project.naam,
          status: project.status,
          voortgang,
          totaalUren: Math.round(totaalUren * 10) / 10,
          begroteUren: Math.round(begroteUren * 10) / 10,
          klantNaam,
        };
      })
    );

    return {
      projects: projectsWithProgress,
      _updatedAt: Date.now(),
    };
  },
});

/**
 * Real-time recent activity - for activity feed.
 * Combines recent offertes, projects, and notifications.
 */
export const getRecentActivity = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const limit = args.limit || 10;

    // Get recent notifications
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return {
      activities: notifications.map((n) => ({
        _id: n._id,
        type: n.type,
        title: n.title,
        message: n.message.substring(0, 100),
        isRead: n.isRead,
        createdAt: n.createdAt,
        offerteNummer: n.offerteNummer,
        projectNaam: n.projectNaam,
        klantNaam: n.klantNaam,
      })),
      _updatedAt: Date.now(),
    };
  },
});
