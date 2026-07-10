/**
 * Convex Cron Jobs Configuration
 *
 * This file defines scheduled background tasks that run automatically.
 * Convex cron jobs run in the Convex cloud and are reliable and serverless.
 *
 * Available scheduling options:
 * - crons.interval("name", { hours: N }, fn) - Run every N hours
 * - crons.daily("name", { hourUTC: N, minuteUTC: M }, fn) - Run daily at specific UTC time
 * - crons.weekly("name", { dayOfWeek: "monday", hourUTC: N, minuteUTC: M }, fn) - Run weekly
 * - crons.monthly("name", { day: N, hourUTC: H, minuteUTC: M }, fn) - Run monthly
 * - crons.cron("name", "cron expression", fn) - Run on custom cron schedule
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Daily Cleanup Job
 *
 * Runs at 3:00 AM UTC every day to perform maintenance tasks:
 * - Clean up soft-deleted items older than 30 days (offertes and projects)
 * - Clean up expired share tokens (older than 30 days)
 * - Clean up old read notifications (older than 90 days)
 * - Clean up old notification logs (older than 30 days)
 * - Clean up old push notification logs (older than 30 days)
 *
 * This helps keep the database clean and reduces storage costs.
 */
crons.daily(
  "daily cleanup",
  { hourUTC: 3, minuteUTC: 0 }, // 3:00 AM UTC (4:00 AM CET / 5:00 AM CEST)
  internal.softDelete.runDailyCleanup
);

/**
 * Daily Payment Reminders & Collection Letters (FAC-006, FAC-007)
 *
 * Runs at 8:00 AM UTC every day to:
 * - Check for overdue invoices
 * - Send automatic payment reminders (7, 14, 21 days)
 * - Generate collection letters (30, 45, 60 days)
 * - Only processes invoices where automatischVersturen is enabled
 */
crons.daily(
  "betalingsherinneringen verwerken",
  { hourUTC: 8, minuteUTC: 0 },
  internal.betalingsherinneringen.processAutomatischeHerinneringen
);

/**
 * Beurtenhorizon aanvullen (PRD §2.1, beurtengenerator)
 *
 * Draait elke nacht om 02:30 UTC en vult voor alle ACTIEVE
 * onderhoudscontracten de rollende 12-maands planningshorizon aan met
 * beurten (werkitems type "onderhoudsbeurt"). Idempotent via
 * generatieSleutel — geen dubbele beurten bij herhaald draaien.
 *
 * Deze job is puur database-werk en verstuurt NOOIT e-mail.
 */
crons.daily(
  "beurtenhorizon aanvullen",
  { hourUTC: 2, minuteUTC: 30 }, // 02:30 UTC (03:30 CET / 04:30 CEST)
  internal.beurtgenerator.vulHorizonAan
);

/**
 * Planningsattendering (PRD §2.1-restant, §8.12)
 *
 * Draait elke ochtend om 05:00 UTC en genereert voor ritme-beurten waarvan
 * het seizoensvenster binnen de ingestelde dagen-vooraf opent een
 * kantoor-taak (melding met taaksoort "plantaak") op het meldingen-bord.
 * Idempotent via attenderingSleutel — geen dubbele taken bij herhaald
 * draaien; attenderingNodig=false wordt gerespecteerd.
 *
 * Deze job is puur database-werk en verstuurt NOOIT e-mail (de inplan-mail
 * is §2.7 en bewust nog een placeholder).
 */
crons.daily(
  "planningsattendering genereren",
  { hourUTC: 5, minuteUTC: 0 }, // 05:00 UTC (06:00 CET / 07:00 CEST)
  internal.planningsattendering.genereerAttenderingen
);

/**
 * Concept-mails: vertraagde trigger-mails klaarzetten (PRD §2.7)
 *
 * Draait elke ochtend om 06:00 UTC. Geplande (vertraagde) trigger-mails
 * waarvan de vertraging is verstreken gaan naar de "Concept-mails"-wachtrij.
 *
 * KANTOOR↔KLANT-REGEL (§1.2): in concept-modus VERSTUURT deze cron nooit
 * zelf iets — kantoor keurt goed in de wachtrij. Alleen in automatisch-
 * modus wordt de verzend-actie ingepland, en die staat volledig achter de
 * mail-guard (EMAIL_VERZENDEN_ACTIEF, fail-closed).
 */
crons.daily(
  "concept-mails klaarzetten",
  { hourUTC: 6, minuteUTC: 0 }, // 06:00 UTC (07:00 CET / 08:00 CEST)
  internal.conceptMails.verwerkGeplandeMails
);

/**
 * Offerte-opvolging verwerken (PRD §2.7, event offerte_opvolging)
 *
 * Draait elke ochtend om 06:15 UTC en verwerkt de bestaande
 * offerte_reminders (dag 3/7/14 na verzenden; geannuleerd bij reactie).
 * Per due reminder: interne notificatie + — afhankelijk van de
 * mail-trigger "offerte_opvolging" — een concept-mail in de wachtrij
 * (default) of het bestaande herinnerings-mailpad (achter de mail-guard).
 */
crons.daily(
  "offerte-opvolging verwerken",
  { hourUTC: 6, minuteUTC: 15 }, // 06:15 UTC
  internal.offerteReminders.processDueReminders
);

export default crons;
