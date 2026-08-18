/**
 * Interne case-thread per melding + @tag → veldtaak (PRD §2.4, case-test §8.6).
 *
 * ── Toegangsmodel (PRD §1.2, hard) ────────────────────────────────────────
 * De case-thread is INTERN: de klant-rol krijgt op ELKE functie hier een
 * AuthError (requireInterneRol) — zelfde harde scheiding als de klanttijdlijn.
 * meldingComments is een EIGEN tabel, gescheiden van klant-threads
 * (chat_threads): een query-fout kan dus nooit interne case-communicatie
 * naar de klant lekken. Alleen kantoor kan iets richting klant doen (de
 * bestaande capability assertKanNaarKlantVersturen — hier bewust NIET
 * aanwezig: vanuit de thread bestaat geen verstuurpad).
 *
 * ── @tag → veldtaak (§8.6) ────────────────────────────────────────────────
 * Een @tag van een medewerker in een comment maakt een veldtaak, gekoppeld
 * aan de melding + klant. Die verschijnt automatisch op de dagkaart van die
 * medewerker ZODRA zijn team bij die klant gepland staat (matching in
 * convex/dagkaart.ts: teamBemanning/teams.leden × werkitems met die klantId
 * op de team-dag). Zijn antwoord (comment) landt hier, nooit bij de klant.
 */

import { v, ConvexError } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireOrgId } from "./auth";
import { requireInterneRol } from "./tijdlijn";

// ============================================
// Helpers
// ============================================

/**
 * Melding ophalen + organisatiescope afdwingen (multi-tenant).
 *
 * De thread hangt aan de melding: comments en veldtaken worden altijd via
 * deze parent gescoopt, nooit op hun eigen (bedrijfsoverstijgende)
 * by_melding-index alleen.
 */
async function getMeldingBinnenOrg(
  ctx: QueryCtx | MutationCtx,
  meldingId: Id<"servicemeldingen">
): Promise<{ melding: Doc<"servicemeldingen">; orgId: Id<"organisaties"> }> {
  const orgId = await requireOrgId(ctx);
  const melding = await ctx.db.get(meldingId);
  // `orgId` is optioneel in het schema zolang de migratie loopt; een melding
  // zonder org hoort bij niemand en valt hier dus buiten de scope.
  if (
    !melding ||
    melding.deletedAt ||
    melding.orgId?.toString() !== orgId.toString()
  ) {
    throw new ConvexError("Melding niet gevonden");
  }
  return { melding, orgId };
}

// ============================================
// Queries (intern; klant-rol → AuthError)
// ============================================

/** Comments van één melding, oudste eerst (chronologische thread). */
export const listComments = query({
  args: { meldingId: v.id("servicemeldingen") },
  handler: async (ctx, args) => {
    await requireInterneRol(ctx);
    // Scope zit in de parent-melding; die is hier al org-gecontroleerd.
    await getMeldingBinnenOrg(ctx, args.meldingId);

    const comments = await ctx.db
      .query("meldingComments")
      .withIndex("by_melding", (q) => q.eq("meldingId", args.meldingId))
      .collect();

    // Belt & braces: expliciete scope-filter bovenop de indexquery
    return comments
      .filter((c) => c.meldingId.toString() === args.meldingId.toString())
      .sort((a, b) => a.createdAt - b.createdAt);
  },
});

/** Veldtaken van één melding (voor de thread-weergave: status per tag). */
export const listVeldtakenVoorMelding = query({
  args: { meldingId: v.id("servicemeldingen") },
  handler: async (ctx, args) => {
    await requireInterneRol(ctx);
    // Scope zit in de parent-melding; die is hier al org-gecontroleerd.
    await getMeldingBinnenOrg(ctx, args.meldingId);

    const taken = await ctx.db
      .query("veldtaken")
      .withIndex("by_melding", (q) => q.eq("meldingId", args.meldingId))
      .collect();

    return taken
      .filter((t) => t.meldingId.toString() === args.meldingId.toString())
      .sort((a, b) => a.createdAt - b.createdAt);
  },
});

// ============================================
// Mutations (intern — óók de getagde medewerker mag antwoorden)
// ============================================

/**
 * Comment toevoegen aan de case-thread. Alle interne rollen (kantoor,
 * voorman, medewerker) — het antwoord van een getagde medewerker landt
 * hier, nooit bij de klant. Elke @tag (taggedMedewerkerIds) maakt een
 * VELDTAAK voor die medewerker, gekoppeld aan melding + klant (§8.6).
 */
export const addComment = mutation({
  args: {
    meldingId: v.id("servicemeldingen"),
    tekst: v.string(),
    taggedMedewerkerIds: v.optional(v.array(v.id("medewerkers"))),
  },
  handler: async (ctx, args) => {
    const user = await requireInterneRol(ctx);
    const { melding, orgId } = await getMeldingBinnenOrg(ctx, args.meldingId);

    const tekst = args.tekst.trim();
    if (!tekst) {
      throw new ConvexError("Tekst is verplicht voor een comment");
    }

    const now = Date.now();
    const tags = args.taggedMedewerkerIds ?? [];

    // Getagde medewerkers valideren (bestaan + eigen bedrijf), ontdubbeld
    const gezien = new Set<string>();
    const medewerkers: Doc<"medewerkers">[] = [];
    for (const medewerkerId of tags) {
      if (gezien.has(medewerkerId.toString())) continue;
      gezien.add(medewerkerId.toString());
      const medewerker = await ctx.db.get(medewerkerId);
      if (!medewerker || medewerker.orgId?.toString() !== orgId.toString()) {
        throw new ConvexError("Getagde medewerker niet gevonden");
      }
      medewerkers.push(medewerker);
    }

    const commentId = await ctx.db.insert("meldingComments", {
      orgId,
      meldingId: args.meldingId,
      auteurId: user._id,
      auteurNaam: user.name,
      tekst,
      taggedMedewerkerIds: tags.length > 0 ? tags : undefined,
      createdAt: now,
    });

    // @tag → veldtaak (§8.6): verschijnt op de dagkaart van de medewerker
    // zodra zijn team bij deze klant gepland staat (convex/dagkaart.ts).
    // Onderhoudstaken (§3.3) hebben geen klant → geen veldtaak (de dagkaart
    // matcht op klant; zonder klant is er niets om op te matchen).
    const veldtaakIds: Id<"veldtaken">[] = [];
    const meldingKlantId = melding.klantId;
    for (const medewerker of meldingKlantId ? medewerkers : []) {
      veldtaakIds.push(
        await ctx.db.insert("veldtaken", {
          orgId,
          meldingId: args.meldingId,
          klantId: meldingKlantId!,
          medewerkerId: medewerker._id,
          medewerkerNaam: medewerker.naam,
          tekst,
          commentId,
          status: "open",
          createdAt: now,
          updatedAt: now,
        })
      );
    }

    // Actie op de case: escalatieklok van een plantaak resetten
    await ctx.db.patch(args.meldingId, { updatedAt: now });

    return { commentId, veldtaakIds };
  },
});

/**
 * Veldtaak afronden — door de medewerker zelf (na zijn antwoord in de
 * thread) of door kantoor. Idempotent: nogmaals afronden is een no-op.
 */
export const rondVeldtaakAf = mutation({
  args: { veldtaakId: v.id("veldtaken") },
  handler: async (ctx, args) => {
    const user = await requireInterneRol(ctx);
    const orgId = await requireOrgId(ctx);

    const taak = await ctx.db.get(args.veldtaakId);
    if (!taak || taak.orgId?.toString() !== orgId.toString()) {
      throw new ConvexError("Veldtaak niet gevonden");
    }
    if (taak.status === "afgerond") return args.veldtaakId;

    const now = Date.now();
    await ctx.db.patch(args.veldtaakId, {
      status: "afgerond",
      afgerondOp: now,
      afgerondDoorId: user._id,
      updatedAt: now,
    });
    return args.veldtaakId;
  },
});
