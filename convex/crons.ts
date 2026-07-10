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
 * Debiteurenladder verwerken (PRD §3.2, fase 2)
 *
 * Draait elke ochtend om 08:00 UTC en vervangt het oude
 * processAutomatischeHerinneringen-pad (FAC-006/007). Per openstaande,
 * verzonden factuur wordt hooguit één vervallen trede uitgevoerd:
 * - mail-trede (default dag 14/21): herinneringsmail als CONCEPT in de
 *   goedkeurings-wachtrij (§2.7) — kantoor keurt goed; een trede kan via
 *   het trigger-record op "automatisch" (blijft achter de mail-guard);
 * - taak-trede (default dag 28): interne kantoor-taak "bellen/aanmaning"
 *   op het cases-bord (taaksoort "debiteurentaak").
 * Idempotent per factuur+trede; gepauzeerde facturen worden overgeslagen;
 * elke trede logt op de klanttijdlijn.
 */
crons.daily(
  "debiteurenladder verwerken",
  { hourUTC: 8, minuteUTC: 0 },
  internal.debiteuren.verwerkLadder
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

/**
 * Contracttermijnen factureren (PRD §2.8, facturatiemodus vast_maandbedrag)
 *
 * Draait elke nacht om 04:00 UTC en zet geplande contractFacturen-termijnen
 * waarvan de periode begonnen is om in concept-facturen in de "Te
 * versturen"-wachtrij. Schrijft factuurId terug op de termijn en zet de
 * status gepland → gefactureerd (dicht het oude dead-end, §2.8 punt 6).
 * Idempotent: termijnen met factuurId of status ≠ gepland worden
 * overgeslagen. Alleen actieve contracten met modus vast_maandbedrag;
 * het beurten-spoor doet voor die contracten niets (wederzijds exclusief).
 *
 * Deze job mailt NOOIT zelf: eventueel direct versturen (contract-toggle)
 * loopt via verstuurFactuurKern en daarmee achter de mail-guard.
 */
crons.daily(
  "contracttermijnen factureren",
  { hourUTC: 4, minuteUTC: 0 }, // 04:00 UTC (05:00 CET / 06:00 CEST)
  internal.facturatieEngine.factureerContractTermijnen
);

/**
 * Maandverzamelfacturen sluiten (PRD §2.8, maandelijks_verzameld)
 *
 * Draait op de 1e van de maand om 04:30 UTC: verzamelconcepten van voorbije
 * maanden krijgen verzamelGesloten=true en een verse factuur-/vervaldatum,
 * zodat nieuwe beurten een nieuwe verzamelfactuur openen. De concepten
 * blijven in de "Te versturen"-wachtrij (human-in-the-loop); alleen
 * contracten met directVersturen=true worden direct verstuurd, en ook dan
 * blijft de mail achter de mail-guard (concept-modus mailt nooit).
 */
crons.monthly(
  "maandverzamelfacturen sluiten",
  { day: 1, hourUTC: 4, minuteUTC: 30 },
  internal.facturatieEngine.sluitMaandverzamelfacturen
);

export default crons;
