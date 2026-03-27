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
 *
 * EML-006: Reminders now also send actual emails to the client via Resend,
 * using the email template system (herinnering_1/2/3) with hardcoded fallbacks.
 */

import { v, ConvexError } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { requireAuthUserId, getOwnedOfferte } from "./auth";
import { requireNotViewer } from "./roles";
import { DEFAULT_TEMPLATES } from "./emailTemplates";

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

/** Map reminder type to email template trigger */
const REMINDER_TYPE_TO_TRIGGER: Record<string, string> = {
  niet_bekeken: "herinnering_1",
  niet_gereageerd: "herinnering_2",
  laatste: "herinnering_3",
};

// ============ HELPERS ============

/**
 * Replace {{variables}} in a template string with actual values.
 */
function renderTemplateString(
  text: string,
  variables: Record<string, string>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return variables[key] ?? match;
  });
}

/**
 * Get hardcoded fallback template for a trigger type.
 */
function getFallbackTemplate(trigger: string): {
  onderwerp: string;
  inhoud: string;
} | null {
  const tmpl = DEFAULT_TEMPLATES.find((t) => t.trigger === trigger);
  if (!tmpl) return null;
  return { onderwerp: tmpl.onderwerp, inhoud: tmpl.inhoud };
}

/**
 * Format a number as Dutch currency (e.g., "€ 1.234,56").
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

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
      throw new ConvexError(
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
 * Process a single reminder: check if it's still relevant, then create a notification
 * and send a reminder email to the client.
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

    // Create the internal notification for the admin/owner
    await ctx.runMutation(internal.notifications.createReminderNotification, {
      userId: reminder.userId,
      offerteId: reminder.offerteId,
      offerteNummer: offerte.offerteNummer,
      klantNaam: offerte.klant.naam,
      reminderType: reminder.type,
    });

    // Mark reminder as sent (internal notification)
    await ctx.db.patch(args.reminderId, {
      status: "sent",
      sentAt: now,
    });

    // Schedule sending the actual email to the client (EML-006)
    if (offerte.klant.email) {
      await ctx.scheduler.runAfter(
        0,
        internal.offerteReminders.sendReminderEmail,
        {
          reminderId: args.reminderId,
          offerteId: reminder.offerteId,
          userId: reminder.userId,
          reminderType: reminder.type,
          klantEmail: offerte.klant.email,
          klantNaam: offerte.klant.naam,
          offerteNummer: offerte.offerteNummer,
          offerteBedrag: formatCurrency(offerte.totalen.totaalInclBtw),
          shareToken: offerte.shareToken ?? undefined,
        }
      );
    } else {
      console.warn(
        `[offerteReminders] No email address for klant "${offerte.klant.naam}" — skipping email for reminder ${args.reminderId}`
      );
    }

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

      // Create internal notification
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

      // Schedule sending the actual email to the client (EML-006)
      if (offerte.klant.email) {
        await ctx.scheduler.runAfter(
          0,
          internal.offerteReminders.sendReminderEmail,
          {
            reminderId: reminder._id,
            offerteId: reminder.offerteId,
            userId: reminder.userId,
            reminderType: reminder.type,
            klantEmail: offerte.klant.email,
            klantNaam: offerte.klant.naam,
            offerteNummer: offerte.offerteNummer,
            offerteBedrag: formatCurrency(offerte.totalen.totaalInclBtw),
            shareToken: offerte.shareToken ?? undefined,
          }
        );
      } else {
        console.warn(
          `[offerteReminders] No email address for klant "${offerte.klant.naam}" — skipping email for reminder ${reminder._id}`
        );
      }

      processedCount++;
    }

    return { processedCount, skippedCount };
  },
});

// ============ EMAIL SENDING ACTION (EML-006) ============

/**
 * Send a reminder email to the client via Resend.
 * This is an internalAction so it can make HTTP requests.
 *
 * Flow:
 * 1. Look up email template (herinnering_1/2/3) from DB
 * 2. If no DB template, use hardcoded fallback
 * 3. Render template with variables
 * 4. Look up bedrijfsgegevens from instellingen
 * 5. Send via Resend API
 * 6. Log result in email_logs
 * 7. Update reminder record with emailSentAt or emailError
 */
export const sendReminderEmail = internalAction({
  args: {
    reminderId: v.id("offerte_reminders"),
    offerteId: v.id("offertes"),
    userId: v.id("users"),
    reminderType: v.union(
      v.literal("niet_bekeken"),
      v.literal("niet_gereageerd"),
      v.literal("laatste")
    ),
    klantEmail: v.string(),
    klantNaam: v.string(),
    offerteNummer: v.string(),
    offerteBedrag: v.string(),
    shareToken: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; resendId?: string; error?: string }> => {
    const trigger = REMINDER_TYPE_TO_TRIGGER[args.reminderType];
    if (!trigger) {
      console.error(
        `[offerteReminders/sendEmail] Unknown reminder type: ${args.reminderType}`
      );
      return { success: false, error: "unknown_reminder_type" };
    }

    // 1. Look up bedrijfsgegevens from instellingen
    const instellingen: Record<string, unknown> | null = await ctx.runQuery(
      internal.instellingen.getByUserId,
      { userId: args.userId }
    );

    const bedrijfsgegevens = (instellingen?.bedrijfsgegevens ?? {}) as Record<string, string>;
    const bedrijfsNaam = bedrijfsgegevens.naam || "Top Tuinen";
    const bedrijfsEmail = bedrijfsgegevens.email || "";
    const bedrijfsTelefoon = bedrijfsgegevens.telefoon || "";

    // 2. Look up email template from DB
    const dbTemplate: { onderwerp: string; inhoud: string; actief: boolean } | null =
      await ctx.runQuery(
        internal.emailTemplates.getByTriggerInternal,
        { userId: args.userId, trigger }
      );

    // 3. Use DB template or fallback
    let onderwerp: string;
    let inhoud: string;

    if (dbTemplate) {
      onderwerp = dbTemplate.onderwerp;
      inhoud = dbTemplate.inhoud;
    } else {
      const fallback = getFallbackTemplate(trigger);
      if (!fallback) {
        console.error(
          `[offerteReminders/sendEmail] No template found for trigger: ${trigger}`
        );
        // Log the failure
        await ctx.runMutation(internal.emailLogs.createInternal, {
          offerteId: args.offerteId,
          userId: args.userId,
          type: "herinnering",
          to: args.klantEmail,
          subject: `Herinnering: Offerte ${args.offerteNummer}`,
          status: "mislukt",
          error: `Geen email template gevonden voor trigger: ${trigger}`,
        });
        return { success: false, error: "no_template_found" };
      }
      onderwerp = fallback.onderwerp;
      inhoud = fallback.inhoud;
    }

    // 4. Build offerte link
    const siteUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.SITE_URL ||
      "https://app.toptuinen.nl";
    const offerteLink = args.shareToken
      ? `${siteUrl}/offerte/${args.shareToken}`
      : `${siteUrl}/offertes`;

    // 5. Render template variables
    const variables: Record<string, string> = {
      klantNaam: args.klantNaam,
      bedrijfsNaam: bedrijfsNaam,
      bedrijfsEmail: bedrijfsEmail,
      bedrijfsTelefoon: bedrijfsTelefoon,
      offerteNummer: args.offerteNummer,
      offerteBedrag: args.offerteBedrag,
      offerteLink: offerteLink,
    };

    const renderedOnderwerp = renderTemplateString(onderwerp, variables);
    const renderedInhoud = renderTemplateString(inhoud, variables);

    // 6. Wrap content in a basic HTML email layout
    const htmlBody = `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    a { color: #16a34a; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  ${renderedInhoud}
  ${args.shareToken ? `<p style="margin-top: 20px;"><a href="${offerteLink}" style="display: inline-block; background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Bekijk offerte</a></p>` : ""}
  <div class="footer">
    <p>${bedrijfsNaam}${bedrijfsEmail ? ` | ${bedrijfsEmail}` : ""}${bedrijfsTelefoon ? ` | ${bedrijfsTelefoon}` : ""}</p>
  </div>
</body>
</html>`;

    // 7. Send via Resend API
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error(
        "[offerteReminders/sendEmail] RESEND_API_KEY not configured"
      );
      await ctx.runMutation(internal.emailLogs.createInternal, {
        offerteId: args.offerteId,
        userId: args.userId,
        type: "herinnering",
        to: args.klantEmail,
        subject: renderedOnderwerp,
        status: "mislukt",
        error: "RESEND_API_KEY niet geconfigureerd",
      });
      await ctx.runMutation(
        internal.offerteReminders.updateReminderEmailStatus,
        {
          reminderId: args.reminderId,
          emailError: "RESEND_API_KEY niet geconfigureerd",
        }
      );
      return { success: false, error: "resend_not_configured" };
    }

    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "noreply@toptuinen.nl";

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${bedrijfsNaam} <${fromEmail}>`,
          to: [args.klantEmail],
          subject: renderedOnderwerp,
          html: htmlBody,
          reply_to: bedrijfsEmail || undefined,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[offerteReminders/sendEmail] Resend API error (${response.status}):`,
          errorText
        );

        // Log failure
        await ctx.runMutation(internal.emailLogs.createInternal, {
          offerteId: args.offerteId,
          userId: args.userId,
          type: "herinnering",
          to: args.klantEmail,
          subject: renderedOnderwerp,
          status: "mislukt",
          error: `Resend API fout (${response.status}): ${errorText.substring(0, 200)}`,
        });
        await ctx.runMutation(
          internal.offerteReminders.updateReminderEmailStatus,
          {
            reminderId: args.reminderId,
            emailError: `Resend API fout (${response.status})`,
          }
        );

        return { success: false, error: errorText };
      }

      const result = await response.json();
      const resendId = result.id as string | undefined;

      console.info(
        `[offerteReminders/sendEmail] Herinnering email verzonden:`,
        {
          to: args.klantEmail,
          klantNaam: args.klantNaam,
          offerteNummer: args.offerteNummer,
          reminderType: args.reminderType,
          trigger,
          resendId,
        }
      );

      // Log success
      await ctx.runMutation(internal.emailLogs.createInternal, {
        offerteId: args.offerteId,
        userId: args.userId,
        type: "herinnering",
        to: args.klantEmail,
        subject: renderedOnderwerp,
        status: "verzonden",
        resendId: resendId,
      });

      // Update reminder record
      await ctx.runMutation(
        internal.offerteReminders.updateReminderEmailStatus,
        {
          reminderId: args.reminderId,
          emailSentAt: Date.now(),
        }
      );

      return { success: true, resendId };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Onbekende fout";
      console.error(
        "[offerteReminders/sendEmail] Failed to send email:",
        error
      );

      // Log failure
      await ctx.runMutation(internal.emailLogs.createInternal, {
        offerteId: args.offerteId,
        userId: args.userId,
        type: "herinnering",
        to: args.klantEmail,
        subject: renderedOnderwerp,
        status: "mislukt",
        error: errorMessage,
      });
      await ctx.runMutation(
        internal.offerteReminders.updateReminderEmailStatus,
        {
          reminderId: args.reminderId,
          emailError: errorMessage,
        }
      );

      return { success: false, error: errorMessage };
    }
  },
});

/**
 * Update reminder record with email sending status.
 * Called by sendReminderEmail action to persist email delivery result.
 */
export const updateReminderEmailStatus = internalMutation({
  args: {
    reminderId: v.id("offerte_reminders"),
    emailSentAt: v.optional(v.number()),
    emailError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const reminder = await ctx.db.get(args.reminderId);
    if (!reminder) return;

    const updates: Record<string, unknown> = {};
    if (args.emailSentAt !== undefined) updates.emailSentAt = args.emailSentAt;
    if (args.emailError !== undefined) updates.emailError = args.emailError;

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.reminderId, updates);
    }
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
