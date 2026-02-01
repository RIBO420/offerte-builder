/**
 * Mobile App Backend Functions
 *
 * Provides API endpoints for the mobile employee app including:
 * - Clock in/out functionality with GPS location
 * - Hours tracking and synchronization
 * - Project assignments
 * - Offline sync support with idempotency
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireAuthUserId } from "./auth";

// ============================================
// CLOCK IN/OUT
// ============================================

/**
 * Clock in to start a work session.
 * Optionally associate with a project and record GPS location.
 * Throws error if user already has an active session.
 */
export const clockIn = mutation({
  args: {
    projectId: v.optional(v.id("projecten")),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const userId = user._id;
    const now = Date.now();

    // Check for existing active session (clock_in or tracking status)
    const activeSession = await ctx.db
      .query("locationSessions")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", userId).eq("status", "clock_in")
      )
      .first();

    if (activeSession) {
      throw new Error("Je bent al ingeklokt");
    }

    // Also check for tracking status
    const trackingSession = await ctx.db
      .query("locationSessions")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", userId).eq("status", "tracking")
      )
      .first();

    if (trackingSession) {
      throw new Error("Je bent al ingeklokt");
    }

    // Get medewerker info from user's Clerk ID if available
    const medewerker = await ctx.db
      .query("medewerkers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", user.clerkId))
      .first();

    const medewerkerNaam = medewerker?.naam || user.name || "Onbekend";

    // Validate project ownership if projectId provided
    if (args.projectId) {
      const project = await ctx.db.get(args.projectId);
      if (!project) {
        throw new Error("Project niet gevonden");
      }
      // Projects are owned by the company user, not the medewerker
      // Check if medewerker belongs to the same organization
      if (medewerker && medewerker.userId.toString() !== project.userId.toString()) {
        throw new Error("Je hebt geen toegang tot dit project");
      }
    }

    // Create new location session
    const sessionId = await ctx.db.insert("locationSessions", {
      userId,
      medewerkerClerkId: user.clerkId,
      medewerkerNaam,
      projectId: args.projectId,
      status: "clock_in",
      clockInAt: now,
      lastLocationAt: now,
      consentGiven: true,
      consentGivenAt: now,
      privacyLevel: "full",
      createdAt: now,
    });

    // If location provided, also store as first location data point
    if (args.latitude !== undefined && args.longitude !== undefined) {
      await ctx.db.insert("locationData", {
        sessionId,
        userId,
        projectId: args.projectId,
        latitude: args.latitude,
        longitude: args.longitude,
        accuracy: 0, // Unknown accuracy from clock-in
        source: "gps",
        batteryLow: false,
        recordedAt: now,
        receivedAt: now,
      });
    }

    return { sessionId, clockedInAt: now };
  },
});

/**
 * Clock out to end the current work session.
 * Records GPS location and creates uren registratie if linked to a project.
 * Throws error if user is not clocked in.
 */
export const clockOut = mutation({
  args: {
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const userId = user._id;
    const now = Date.now();

    // Find active session (clock_in or tracking)
    let activeSession = await ctx.db
      .query("locationSessions")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", userId).eq("status", "clock_in")
      )
      .first();

    if (!activeSession) {
      activeSession = await ctx.db
        .query("locationSessions")
        .withIndex("by_user_active", (q) =>
          q.eq("userId", userId).eq("status", "tracking")
        )
        .first();
    }

    if (!activeSession) {
      throw new Error("Je bent niet ingeklokt");
    }

    // Calculate duration
    const durationMs = now - activeSession.clockInAt;
    const hours = durationMs / (1000 * 60 * 60);

    // Update session status to clock_out
    await ctx.db.patch(activeSession._id, {
      status: "clock_out",
      clockOutAt: now,
      lastLocationAt: now,
    });

    // Store final location if provided
    if (args.latitude !== undefined && args.longitude !== undefined) {
      await ctx.db.insert("locationData", {
        sessionId: activeSession._id,
        userId,
        projectId: activeSession.projectId,
        latitude: args.latitude,
        longitude: args.longitude,
        accuracy: 0,
        source: "gps",
        batteryLow: false,
        recordedAt: now,
        receivedAt: now,
      });
    }

    // Create uren registratie if linked to a project
    if (activeSession.projectId) {
      const idempotencyKey = crypto.randomUUID();

      await ctx.db.insert("urenRegistraties", {
        projectId: activeSession.projectId,
        datum: new Date(now).toISOString().split("T")[0],
        medewerker: activeSession.medewerkerNaam,
        uren: Math.round(hours * 100) / 100, // Round to 2 decimals
        notities: args.notes,
        bron: "handmatig", // Using handmatig as mobile_app is not a valid bron in schema
        idempotencyKey,
        clientTimestamp: now,
        syncStatus: "synced",
        medewerkerClerkId: activeSession.medewerkerClerkId,
      });
    }

    return { clockedOutAt: now, hoursWorked: hours };
  },
});

/**
 * Start a break during an active session.
 */
export const startBreak = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const userId = user._id;
    const now = Date.now();

    // Find active session
    let activeSession = await ctx.db
      .query("locationSessions")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", userId).eq("status", "clock_in")
      )
      .first();

    if (!activeSession) {
      activeSession = await ctx.db
        .query("locationSessions")
        .withIndex("by_user_active", (q) =>
          q.eq("userId", userId).eq("status", "tracking")
        )
        .first();
    }

    if (!activeSession) {
      throw new Error("Je bent niet ingeklokt");
    }

    // Update session to break status
    await ctx.db.patch(activeSession._id, {
      status: "break",
      breakStartAt: now,
      lastLocationAt: now,
    });

    return { breakStartedAt: now };
  },
});

/**
 * End a break and resume work.
 */
export const endBreak = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const userId = user._id;
    const now = Date.now();

    // Find session in break status
    const breakSession = await ctx.db
      .query("locationSessions")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", userId).eq("status", "break")
      )
      .first();

    if (!breakSession) {
      throw new Error("Je bent niet op pauze");
    }

    // Update session back to tracking
    await ctx.db.patch(breakSession._id, {
      status: "tracking",
      breakEndAt: now,
      lastLocationAt: now,
    });

    const breakDuration = breakSession.breakStartAt
      ? now - breakSession.breakStartAt
      : 0;

    return { breakEndedAt: now, breakDurationMs: breakDuration };
  },
});

// ============================================
// QUERIES
// ============================================

/**
 * Get the current active session for the user.
 * Returns null if not clocked in.
 */
export const getActiveSession = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const userId = user._id;

    // Check clock_in status
    let session = await ctx.db
      .query("locationSessions")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", userId).eq("status", "clock_in")
      )
      .first();

    if (session) return session;

    // Check tracking status
    session = await ctx.db
      .query("locationSessions")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", userId).eq("status", "tracking")
      )
      .first();

    if (session) return session;

    // Check break status
    session = await ctx.db
      .query("locationSessions")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", userId).eq("status", "break")
      )
      .first();

    return session;
  },
});

/**
 * Get today's hours summary for the current user.
 */
export const getTodayHours = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const today = new Date().toISOString().split("T")[0];

    // Get medewerker info to find hours by name
    const medewerker = await ctx.db
      .query("medewerkers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", user.clerkId))
      .first();

    const medewerkerNaam = medewerker?.naam || user.name || "";

    // Get all entries for today
    const allTodayEntries = await ctx.db
      .query("urenRegistraties")
      .withIndex("by_datum", (q) => q.eq("datum", today))
      .collect();

    // Filter by medewerker name or clerkId
    const entries = allTodayEntries.filter(
      (e) =>
        e.medewerker === medewerkerNaam ||
        e.medewerkerClerkId === user.clerkId
    );

    const totalHours = entries.reduce((sum, e) => sum + (e.uren || 0), 0);
    const projectIds = new Set(entries.map((e) => e.projectId.toString()));
    const projectCount = projectIds.size;

    // Get project names for the entries
    const projectDetails = await Promise.all(
      Array.from(projectIds).map(async (projectIdStr) => {
        const projectEntry = entries.find(
          (e) => e.projectId.toString() === projectIdStr
        );
        if (!projectEntry) return null;

        const project = await ctx.db.get(projectEntry.projectId);
        const projectHours = entries
          .filter((e) => e.projectId.toString() === projectIdStr)
          .reduce((sum, e) => sum + (e.uren || 0), 0);

        return {
          projectId: projectEntry.projectId,
          naam: project?.naam || "Onbekend project",
          uren: projectHours,
        };
      })
    );

    return {
      totalHours: Math.round(totalHours * 100) / 100,
      projectCount,
      entries: entries.map((e) => ({
        _id: e._id,
        projectId: e.projectId,
        datum: e.datum,
        uren: e.uren,
        notities: e.notities,
      })),
      projects: projectDetails.filter((p) => p !== null),
    };
  },
});

/**
 * Get hours for a specific week.
 */
export const getWeekHours = query({
  args: { weekStart: v.string() }, // YYYY-MM-DD format
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Calculate week end (7 days from start)
    const startDate = new Date(args.weekStart);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    const weekEnd = endDate.toISOString().split("T")[0];

    // Get medewerker info
    const medewerker = await ctx.db
      .query("medewerkers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", user.clerkId))
      .first();

    const medewerkerNaam = medewerker?.naam || user.name || "";

    // Get all uren registraties (no date range index, so we filter)
    const allEntries = await ctx.db.query("urenRegistraties").collect();

    // Filter by date range and medewerker
    const entries = allEntries.filter(
      (e) =>
        e.datum >= args.weekStart &&
        e.datum <= weekEnd &&
        (e.medewerker === medewerkerNaam || e.medewerkerClerkId === user.clerkId)
    );

    // Group by day
    const perDay: Record<string, number> = {};
    const dayNames = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      perDay[dateStr] = 0;
    }

    for (const entry of entries) {
      perDay[entry.datum] = (perDay[entry.datum] || 0) + entry.uren;
    }

    // Convert to array with day names
    const dailyHours = Object.entries(perDay).map(([datum, uren]) => {
      const date = new Date(datum);
      const dayIndex = date.getDay();
      return {
        datum,
        dag: dayNames[dayIndex],
        uren: Math.round(uren * 100) / 100,
      };
    });

    const totalHours = entries.reduce((sum, e) => sum + (e.uren || 0), 0);
    const projectIds = new Set(entries.map((e) => e.projectId.toString()));

    return {
      weekStart: args.weekStart,
      weekEnd,
      totalHours: Math.round(totalHours * 100) / 100,
      projectCount: projectIds.size,
      dailyHours,
    };
  },
});

/**
 * Get projects assigned to the current user (via medewerker).
 * Returns projects that are in_uitvoering (active).
 */
export const getAssignedProjects = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    // Get medewerker record to find the company userId
    const medewerker = await ctx.db
      .query("medewerkers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", user.clerkId))
      .first();

    if (!medewerker) {
      // If no medewerker linked, return empty array
      return [];
    }

    // Get active projects for the company
    const projects = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", medewerker.userId))
      .collect();

    // Filter to only active (in_uitvoering) projects that are not archived
    const activeProjects = projects.filter(
      (p) => p.status === "in_uitvoering" && p.isArchived !== true
    );

    // Get offerte info for each project to include customer name
    const projectsWithDetails = await Promise.all(
      activeProjects.map(async (project) => {
        const offerte = await ctx.db.get(project.offerteId);
        return {
          _id: project._id,
          naam: project.naam,
          status: project.status,
          klantNaam: offerte?.klant?.naam || "Onbekende klant",
          klantAdres: offerte?.klant?.adres || "",
          klantPlaats: offerte?.klant?.plaats || "",
        };
      })
    );

    return projectsWithDetails;
  },
});

/**
 * Get recent sessions (last 7 days) for the current user.
 */
export const getRecentSessions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const userId = user._id;
    const limit = args.limit || 10;

    // Get recent sessions
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const sessions = await ctx.db
      .query("locationSessions")
      .withIndex("by_date", (q) => q.gte("clockInAt", sevenDaysAgo))
      .order("desc")
      .collect();

    // Filter by user and completed sessions
    const userSessions = sessions
      .filter((s) => s.userId.toString() === userId.toString())
      .filter((s) => s.status === "clock_out")
      .slice(0, limit);

    // Get project details for each session
    const sessionsWithDetails = await Promise.all(
      userSessions.map(async (session) => {
        let projectNaam = null;
        if (session.projectId) {
          const project = await ctx.db.get(session.projectId);
          projectNaam = project?.naam || null;
        }

        const durationMs = session.clockOutAt
          ? session.clockOutAt - session.clockInAt
          : 0;
        const hours = durationMs / (1000 * 60 * 60);

        return {
          _id: session._id,
          datum: new Date(session.clockInAt).toISOString().split("T")[0],
          clockInAt: session.clockInAt,
          clockOutAt: session.clockOutAt,
          projectId: session.projectId,
          projectNaam,
          uren: Math.round(hours * 100) / 100,
        };
      })
    );

    return sessionsWithDetails;
  },
});

// ============================================
// SYNC
// ============================================

/**
 * Sync offline uren registraties.
 * Uses idempotency keys to prevent duplicate entries.
 */
export const syncUrenRegistraties = mutation({
  args: {
    entries: v.array(
      v.object({
        idempotencyKey: v.string(),
        projectId: v.id("projecten"),
        datum: v.string(),
        uren: v.number(),
        notities: v.optional(v.string()),
        clientTimestamp: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Get medewerker info
    const medewerker = await ctx.db
      .query("medewerkers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", user.clerkId))
      .first();

    const medewerkerNaam = medewerker?.naam || user.name || "Onbekend";

    const results: { idempotencyKey: string; status: string; error?: string }[] = [];

    for (const entry of args.entries) {
      try {
        // Check for existing entry with same idempotency key
        const existing = await ctx.db
          .query("urenRegistraties")
          .withIndex("by_idempotency", (q) =>
            q.eq("idempotencyKey", entry.idempotencyKey)
          )
          .first();

        if (existing) {
          results.push({
            idempotencyKey: entry.idempotencyKey,
            status: "duplicate",
          });
          continue;
        }

        // Validate project exists and medewerker has access
        const project = await ctx.db.get(entry.projectId);
        if (!project) {
          results.push({
            idempotencyKey: entry.idempotencyKey,
            status: "error",
            error: "Project niet gevonden",
          });
          continue;
        }

        // Check if medewerker belongs to the project's company
        if (
          medewerker &&
          medewerker.userId.toString() !== project.userId.toString()
        ) {
          results.push({
            idempotencyKey: entry.idempotencyKey,
            status: "error",
            error: "Geen toegang tot dit project",
          });
          continue;
        }

        // Insert new entry
        await ctx.db.insert("urenRegistraties", {
          projectId: entry.projectId,
          datum: entry.datum,
          medewerker: medewerkerNaam,
          uren: entry.uren,
          notities: entry.notities,
          bron: "handmatig", // Using handmatig as closest match
          idempotencyKey: entry.idempotencyKey,
          clientTimestamp: entry.clientTimestamp,
          syncStatus: "synced",
          medewerkerClerkId: user.clerkId,
        });

        results.push({
          idempotencyKey: entry.idempotencyKey,
          status: "synced",
        });
      } catch (error) {
        results.push({
          idempotencyKey: entry.idempotencyKey,
          status: "error",
          error: error instanceof Error ? error.message : "Onbekende fout",
        });
      }
    }

    return results;
  },
});

/**
 * Update location during an active session.
 * Used for GPS tracking.
 */
export const updateLocation = mutation({
  args: {
    latitude: v.number(),
    longitude: v.number(),
    accuracy: v.number(),
    altitude: v.optional(v.number()),
    speed: v.optional(v.number()),
    heading: v.optional(v.number()),
    source: v.optional(
      v.union(v.literal("gps"), v.literal("network"), v.literal("fused"))
    ),
    batteryLevel: v.optional(v.number()),
    batteryLow: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const userId = user._id;
    const now = Date.now();

    // Find active session
    let activeSession = await ctx.db
      .query("locationSessions")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", userId).eq("status", "clock_in")
      )
      .first();

    if (!activeSession) {
      activeSession = await ctx.db
        .query("locationSessions")
        .withIndex("by_user_active", (q) =>
          q.eq("userId", userId).eq("status", "tracking")
        )
        .first();
    }

    if (!activeSession) {
      throw new Error("Geen actieve sessie gevonden");
    }

    // Insert location data
    await ctx.db.insert("locationData", {
      sessionId: activeSession._id,
      userId,
      projectId: activeSession.projectId,
      latitude: args.latitude,
      longitude: args.longitude,
      accuracy: args.accuracy,
      altitude: args.altitude,
      speed: args.speed,
      heading: args.heading,
      source: args.source || "gps",
      batteryLevel: args.batteryLevel,
      batteryLow: args.batteryLow || false,
      recordedAt: now,
      receivedAt: now,
    });

    // Update session last location timestamp and switch to tracking if needed
    await ctx.db.patch(activeSession._id, {
      status: "tracking",
      lastLocationAt: now,
    });

    return { recorded: true, timestamp: now };
  },
});

// ============================================
// USER PROFILE
// ============================================

/**
 * Get the current user's profile for the mobile app.
 */
export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    // Get medewerker record
    const medewerker = await ctx.db
      .query("medewerkers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", user.clerkId))
      .first();

    if (!medewerker) {
      return {
        userId: user._id,
        naam: user.name,
        email: user.email,
        isMedewerker: false,
        medewerker: null,
      };
    }

    // Get company info
    const companyUser = await ctx.db.get(medewerker.userId);
    const instellingen = companyUser
      ? await ctx.db
          .query("instellingen")
          .withIndex("by_user", (q) => q.eq("userId", companyUser._id))
          .first()
      : null;

    return {
      userId: user._id,
      naam: medewerker.naam,
      email: medewerker.email || user.email,
      telefoon: medewerker.telefoon,
      functie: medewerker.functie,
      isMedewerker: true,
      medewerker: {
        _id: medewerker._id,
        naam: medewerker.naam,
        functie: medewerker.functie,
        specialisaties: medewerker.specialisaties,
        biometricEnabled: medewerker.biometricEnabled,
      },
      bedrijf: instellingen?.bedrijfsgegevens
        ? {
            naam: instellingen.bedrijfsgegevens.naam,
            logo: instellingen.bedrijfsgegevens.logo,
          }
        : null,
    };
  },
});

/**
 * Update biometric authentication setting.
 */
export const updateBiometricSetting = mutation({
  args: {
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Get medewerker record
    const medewerker = await ctx.db
      .query("medewerkers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", user.clerkId))
      .first();

    if (!medewerker) {
      throw new Error("Medewerker profiel niet gevonden");
    }

    await ctx.db.patch(medewerker._id, {
      biometricEnabled: args.enabled,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
