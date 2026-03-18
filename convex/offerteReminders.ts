/**
 * Offerte Follow-up Reminders Module
 *
 * Automatically schedules and manages follow-up reminders when an offerte
 * is sent (status → verzonden). Creates a series of escalating reminders:
 *
 * - Day 3: "niet_bekeken" — if the offerte has not been viewed
 * - Day 7: "niet_gereageerd" — if viewed but no response
 * - Day 14: "laatste" — final reminder if still no response
 *
 * Reminders are cancelled automatically when the offerte receives a
 * response (accepted/declined).
 */

import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { requireAuthUserId, getOwnedOfferte } from "./auth";
import { requireNotViewer } from "./roles";

// ============ CONSTANTS ============

const DAY_MS = 24 * 60 * 60 * 1000;

/** Reminder schedule: type → days after offerte sent */
const REMINDER_SCHEDULE: Array<{
  type: "niet_bekeken" | "niet_gereageerd" | "laatste";
  daysAfterSent: number;
}> = [
  { type: "niet_bekeken", daysAfterSent: 3 },
  { type: "niet_gereageerd", daysAfterSent: 7 },
  { type: "laatste", daysAfterSent: 14 },
];

// ============ MUTATIONS ============

/**
 * Schedule follow-up reminders for an offerte that has been sent.
 * Called when offerte status changes to "verzonden".
 * Creates three reminder records at day 3, 7, and 14.
 */
export const scheduleReminders = mutation({
  args: {
    offerteId: v.id("offertes"),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const offerte = await getOwnedOfferte(ctx, args.offerteId);

    // Only schedule reminders for offertes with status "verzonden"
    if (offerte.status !== "verzonden") {
      throw new Error(
        "Herinneringen kunnen alleen worden ingepland voor verzonden offertes"
      );
    }

    // Check if reminders already exist for this offerte
    const existingReminders = await ctx.db
      .query("offerte_reminders")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.offerteId))
      .collect();

    // If there are already pending reminders, don't create duplicates
    const hasPendingReminders = existingReminders.some(
      (r) => r.status === "pending"
    );
    if (hasPendingReminders) {
      return {
        success: true,
        reason: "reminders_already_scheduled",
        reminderIds: existingReminders
          .filter((r) => r.status === "pending")
          .map((r) => r._id),
      };
    }

    const now = Date.now();
    const reminderIds: Id<"offerte_reminders">[] = [];

    // Create a reminder record for each scheduled point
    for (const schedule of REMINDER_SCHEDULE) {
      const scheduledAt = now + schedule.daysAfterSent * DAY_MS;

      const reminderId = await ctx.db.insert("offerte_reminders", {
        offerteId: args.offerteId,
        userId: offerte.userId,
        type: schedule.type,
        scheduledAt,
        status: "pending",
      });

      reminderIds.push(reminderId);
    }

    return { success: true, reminderIds };
  },
});

/**
 * Process a single reminder: check if it's still relevant, then create a notification.
 * Called by a cron job or scheduled function that scans for due reminders.
 *
 * A reminder is still relevant if:
 * - The offerte still has status "verzonden" (not accepted/declined)
 * - The reminder is still in "pending" status
 */
export const processReminder = internalMutation({
  args: {
    reminderId: v.id("offerte_reminders"),
  },
  handler: async (ctx, args) => {
    const reminder = await ctx.db.get(args.reminderId);
    if (!reminder) {
      return { success: false, reason: "reminder_not_found" };
    }

    // Skip if already sent or cancelled
    if (reminder.status !== "pending") {
      return { success: false, reason: `reminder_${reminder.status}` };
    }

    // Check if reminder is due
    const now = Date.now();
    if (reminder.scheduledAt > now) {
      return { success: false, reason: "not_yet_due" };
    }

    // Get the offerte to check current status
    const offerte = await ctx.db.get(reminder.offerteId);
    if (!offerte) {
      // Offerte was deleted — cancel reminder
      await ctx.db.patch(args.reminderId, {
        status: "cancelled",
      });
      return { success: false, reason: "offerte_not_found" };
    }

    // If offerte is no longer "verzonden", cancel this reminder
    if (offerte.status !== "verzonden") {
      await ctx.db.patch(args.reminderId, {
        status: "cancelled",
      });
      return {
        success: false,
        reason: "offerte_no_longer_verzonden",
        offerteStatus: offerte.status,
      };
    }

    // Create the notification for the admin/owner
    await ctx.runMutation(internal.notifications.createReminderNotification, {
      userId: reminder.userId,
      offerteId: reminder.offerteId,
      offerteNummer: offerte.offerteNummer,
      klantNaam: offerte.klant.naam,
      reminderType: reminder.type,
    });

    // Mark reminder as sent
    await ctx.db.patch(args.reminderId, {
      status: "sent",
      sentAt: now,
    });

    return { success: true, reminderType: reminder.type };
  },
});

/**
 * Process all due reminders.
 * Scans for pending reminders whose scheduledAt has passed,
 * and processes each one. Intended to be called by a cron job.
 */
export const processDueReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Get all pending reminders that are due
    const dueReminders = await ctx.db
      .query("offerte_reminders")
      .withIndex("by_status_scheduled", (q) =>
        q.eq("status", "pending").lte("scheduledAt", now)
      )
      .collect();

    let processedCount = 0;
    let skippedCount = 0;

    for (const reminder of dueReminders) {
      // Get the offerte to check current status
      const offerte = await ctx.db.get(reminder.offerteId);

      if (!offerte || offerte.status !== "verzonden") {
        // Cancel irrelevant reminders
        await ctx.db.patch(reminder._id, {
          status: "cancelled",
        });
        skippedCount++;
        continue;
      }

      // Create notification
      await ctx.runMutation(internal.notifications.createReminderNotification, {
        userId: reminder.userId,
        offerteId: reminder.offerteId,
        offerteNummer: offerte.offerteNummer,
        klantNaam: offerte.klant.naam,
        reminderType: reminder.type,
      });

      // Mark as sent
      await ctx.db.patch(reminder._id, {
        status: "sent",
        sentAt: now,
      });

      processedCount++;
    }

    return { processedCount, skippedCount };
  },
});

/**
 * Cancel all pending reminders for an offerte.
 * Called when the offerte gets a response (accepted/declined).
 */
export const cancelReminders = mutation({
  args: {
    offerteId: v.id("offertes"),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    // Verify user owns this offerte
    await getOwnedOfferte(ctx, args.offerteId);

    const reminders = await ctx.db
      .query("offerte_reminders")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.offerteId))
      .collect();

    let cancelledCount = 0;

    for (const reminder of reminders) {
      if (reminder.status === "pending") {
        await ctx.db.patch(reminder._id, {
          status: "cancelled",
        });
        cancelledCount++;
      }
    }

    return { success: true, cancelledCount };
  },
});

// ============ QUERIES ============

/**
 * Get all reminders for an offerte.
 * Returns reminders ordered by scheduled date.
 */
export const getByOfferte = query({
  args: {
    offerteId: v.id("offertes"),
  },
  handler: async (ctx, args) => {
    // Verify user owns this offerte
    await getOwnedOfferte(ctx, args.offerteId);

    const reminders = await ctx.db
      .query("offerte_reminders")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.offerteId))
      .order("asc")
      .collect();

    return reminders;
  },
});
