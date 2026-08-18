import { v, ConvexError } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { requireOrgId, getOwnedOfferte } from "./auth";
import { requireNotViewer } from "./roles";

/**
 * TENANT-SCOPE IN DIT BESTAND (org-migratie fase 3).
 *
 * Drie soorten schrijvers, en ze zijn NIET gelijk te trekken:
 *
 * 1. Ingelogde paden (`listByUser`, `create`, `updateStatus`,
 *    `getOfferteEmailStats`, `listByOfferte`) → `requireOrgId` / de
 *    org-variant van de ownership-check. Hier is er altijd een JWT met
 *    org-claim.
 * 2. Interne schrijvers (`createInternal`, `createTriggerInternal`) draaien
 *    vanuit crons en acties zónder identity. Zij kunnen `requireOrgId` niet
 *    aanroepen; de org komt daarom uit de offerte waar de mail bij hoort, of
 *    — als er geen offerte is — uit een expliciete `orgId`-arg van de
 *    aanroeper.
 * 3. Het webhookpad (`updateFromWebhook`) is per definitie niet ingelogd:
 *    Resend → onze route → deze mutation, afgeschermd met
 *    CONVEX_WEBHOOK_SECRET. Het MATCHT op een bestaande rij (`by_resendId`)
 *    en maakt er nooit een aan, dus er valt geen tenant te kiezen: de rij
 *    brengt zijn eigen `orgId` mee. Daar hoort dus GEEN org-check — die zou
 *    alleen maar een nieuwe faalmodus toevoegen aan een pad dat al
 *    fail-closed is op het gedeelde geheim.
 */

// List email logs for an offerte (with ownership verification)
export const listByOfferte = query({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
    // Verify user owns this offerte
    await getOwnedOfferte(ctx, args.offerteId);

    return await ctx.db
      .query("email_logs")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.offerteId))
      .order("desc")
      .collect();
  },
});

// List email logs for authenticated user
export const listByUser = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("email_logs")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(limit);
  },
});

// Create email log entry (with ownership verification)
export const create = mutation({
  args: {
    offerteId: v.id("offertes"),
    type: v.union(
      v.literal("offerte_verzonden"),
      v.literal("herinnering"),
      v.literal("bedankt")
    ),
    to: v.string(),
    subject: v.string(),
    status: v.union(
      v.literal("verzonden"),
      v.literal("mislukt"),
      v.literal("geopend"),
      v.literal("delivered"),
      v.literal("bounced"),
      v.literal("complained"),
      v.literal("onderdrukt (sandbox)")
    ),
    resendId: v.optional(v.string()),
    error: v.optional(v.string()),
    customMessage: v.optional(v.string()),
    cc: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    // Verify user owns this offerte
    const offerte = await getOwnedOfferte(ctx, args.offerteId);

    return await ctx.db.insert("email_logs", {
      offerteId: args.offerteId,
      // De offerte is via getOwnedOfferte al org-geverifieerd.
      orgId: offerte.orgId,
      type: args.type,
      to: args.to,
      subject: args.subject,
      status: args.status,
      resendId: args.resendId,
      error: args.error,
      customMessage: args.customMessage,
      cc: args.cc,
      createdAt: Date.now(),
    });
  },
});

// Create email log entry voor §2.7 trigger-mails (internal — geen auth,
// aangeroepen vanuit conceptMails-acties). Verschil met createInternal:
// offerteId is optioneel (lead-/inplan-mails hangen niet aan een offerte)
// en de §2.7 event-typen zijn toegestaan.
//
// Org-scope (punt 2 in de kop): zonder offerte is er niets om de tenant uit
// af te leiden — dan MOET de aanroeper `orgId` meegeven.
export const createTriggerInternal = internalMutation({
  args: {
    offerteId: v.optional(v.id("offertes")),
    orgId: v.optional(v.id("organisaties")),
    type: v.union(
      v.literal("offerte_verzonden"),
      v.literal("herinnering"),
      v.literal("lead_ontvangen"),
      v.literal("inplanning_bevestigd"),
      v.literal("inplan_attendering"),
      v.literal("trigger_mail")
    ),
    to: v.string(),
    subject: v.string(),
    status: v.union(
      v.literal("verzonden"),
      v.literal("mislukt"),
      v.literal("onderdrukt (sandbox)")
    ),
    resendId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const offerte = args.offerteId ? await ctx.db.get(args.offerteId) : null;
    const orgId = offerte?.orgId ?? args.orgId;
    if (!orgId) {
      // Zonder tenant is een logregel dakloos; niet-blokkerend overslaan.
      console.error("[emailLogs] createTriggerInternal zonder org-scope");
      return null;
    }

    return await ctx.db.insert("email_logs", {
      offerteId: args.offerteId,
      orgId,
      type: args.type,
      to: args.to,
      subject: args.subject,
      status: args.status,
      resendId: args.resendId,
      error: args.error,
      createdAt: Date.now(),
    });
  },
});

// Create email log entry (internal — no auth required, for cron jobs/actions).
// De org komt uit de offerte: dit pad heeft er altijd één (zie kop, punt 2).
export const createInternal = internalMutation({
  args: {
    offerteId: v.id("offertes"),
    type: v.union(
      v.literal("offerte_verzonden"),
      v.literal("herinnering"),
      v.literal("bedankt"),
      v.literal("factuur_verzonden"),
      v.literal("factuur_herinnering")
    ),
    to: v.string(),
    subject: v.string(),
    status: v.union(
      v.literal("verzonden"),
      v.literal("mislukt"),
      v.literal("geopend"),
      v.literal("delivered"),
      v.literal("bounced"),
      v.literal("complained"),
      v.literal("onderdrukt (sandbox)")
    ),
    resendId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const offerte = await ctx.db.get(args.offerteId);
    if (!offerte) {
      console.error("[emailLogs] createInternal: offerte bestaat niet meer");
      return null;
    }

    return await ctx.db.insert("email_logs", {
      offerteId: args.offerteId,
      orgId: offerte.orgId,
      type: args.type,
      to: args.to,
      subject: args.subject,
      status: args.status,
      resendId: args.resendId,
      error: args.error,
      createdAt: Date.now(),
    });
  },
});

// Update email log status (with ownership verification)
export const updateStatus = mutation({
  args: {
    id: v.id("email_logs"),
    status: v.union(
      v.literal("verzonden"),
      v.literal("mislukt"),
      v.literal("geopend"),
      v.literal("delivered"),
      v.literal("bounced"),
      v.literal("complained")
    ),
    openedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const orgId = await requireOrgId(ctx);

    // Get the log and verify org-ownership
    const log = await ctx.db.get(args.id);
    if (!log) {
      throw new ConvexError("Email log niet gevonden");
    }
    if (log.orgId?.toString() !== orgId.toString()) {
      throw new ConvexError("Geen toegang tot deze email log");
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

// Get email stats for an offerte (with ownership verification)
export const getOfferteEmailStats = query({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
    // Verify user owns this offerte
    await getOwnedOfferte(ctx, args.offerteId);

    const logs = await ctx.db
      .query("email_logs")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.offerteId))
      .collect();

    return {
      total: logs.length,
      verzonden: logs.filter((l) => l.status === "verzonden").length,
      delivered: logs.filter((l) => l.status === "delivered").length,
      geopend: logs.filter((l) => l.status === "geopend").length,
      mislukt: logs.filter((l) => l.status === "mislukt").length,
      bounced: logs.filter((l) => l.status === "bounced").length,
      laatsteEmail: logs[0] ?? null,
    };
  },
});

// ── Webhook mutations ────────────────────────────────────────────────────

/**
 * Vergelijkt twee geheimen in (nagenoeg) constante tijd.
 *
 * Een gewone `===` breekt af bij het eerste afwijkende teken. Dat tijdverschil
 * is over veel requests meetbaar en laat een aanvaller het geheim teken voor
 * teken raden. De XOR-lus kost altijd evenveel tijd, ongeacht wáár het verschil
 * zit. Het lengteverschil lekt alleen de lengte van het geheim en niet de
 * inhoud — dezelfde afweging die Node's `timingSafeEqual` maakt.
 *
 * Handgeschreven omdat de Convex-runtime geen `node:crypto` heeft.
 */
function gelijkInConstanteTijd(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let verschil = 0;
  for (let i = 0; i < a.length; i++) {
    verschil |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return verschil === 0;
}

/**
 * Controleert het gedeelde geheim dat de webhookroute meestuurt.
 *
 * Gooit altijd — nooit stilzwijgend doorlaten. Een ontbrekend geheim in de
 * Convex-omgeving is een configuratiefout, geen reden om de deur open te
 * zetten; fail closed is hier de veilige kant.
 */
function vereisWebhookGeheim(meegestuurd: string): void {
  const verwacht = process.env.CONVEX_WEBHOOK_SECRET;

  if (!verwacht) {
    throw new ConvexError(
      "CONVEX_WEBHOOK_SECRET is niet geconfigureerd in de Convex-omgeving — " +
        "webhook-updates worden geweigerd"
    );
  }

  if (!gelijkInConstanteTijd(meegestuurd, verwacht)) {
    throw new ConvexError("Ongeldig webhook-geheim");
  }
}

/**
 * Werkt een email_log bij op basis van een Resend-webhookevent.
 *
 * Aangeroepen door /api/webhooks/resend, ná verificatie van de Svix-
 * handtekening. Dit blijft een publieke `mutation` omdat een `internalMutation`
 * niet aanroepbaar is via `ConvexHttpClient` vanuit een Next.js-routehandler.
 * De toegangscontrole loopt daarom via het gedeelde geheim in `args.secret`:
 * zonder dat geheim kan niemand die de deployment-URL kent nog delivery-,
 * open-, bounce- of complaint-events vervalsen.
 *
 * Twee lagen, geen vervanging van elkaar: Svix bewijst dat het event van
 * Resend komt, het gedeelde geheim bewijst dat de aanroep van ónze route komt.
 */
export const updateFromWebhook = mutation({
  args: {
    secret: v.string(),
    resendId: v.string(),
    eventType: v.union(
      v.literal("email.delivered"),
      v.literal("email.opened"),
      v.literal("email.bounced"),
      v.literal("email.clicked"),
      v.literal("email.complained")
    ),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    vereisWebhookGeheim(args.secret);

    // Find the email log by resendId
    const log = await ctx.db
      .query("email_logs")
      .withIndex("by_resendId", (q) => q.eq("resendId", args.resendId))
      .first();

    if (!log) {
      // No matching log found — this can happen if the email was sent
      // before we started tracking resendIds, or for non-offerte emails.
      console.warn(
        `[emailLogs/webhook] No email log found for resendId: ${args.resendId}`
      );
      return null;
    }

    switch (args.eventType) {
      case "email.delivered": {
        // Only update if not already in a more advanced state
        if (log.status === "verzonden") {
          await ctx.db.patch(log._id, {
            status: "delivered",
            deliveredAt: args.timestamp,
          });
        }
        break;
      }

      case "email.opened": {
        // Set openedAt only on first open, update status
        await ctx.db.patch(log._id, {
          status: "geopend",
          // Only set openedAt if not already set (first open)
          ...(log.openedAt ? {} : { openedAt: args.timestamp }),
        });
        break;
      }

      case "email.bounced": {
        await ctx.db.patch(log._id, {
          status: "bounced",
          bouncedAt: args.timestamp,
        });
        break;
      }

      case "email.clicked": {
        // Set clickedAt only on first click
        await ctx.db.patch(log._id, {
          ...(log.clickedAt ? {} : { clickedAt: args.timestamp }),
        });
        break;
      }

      case "email.complained": {
        await ctx.db.patch(log._id, {
          status: "complained",
        });
        break;
      }
    }

    return log._id;
  },
});
