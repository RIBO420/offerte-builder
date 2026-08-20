/**
 * Reacties bij een taak — overleg hoort bij het werk, niet in WhatsApp.
 *
 * Twee soorten regels in dezelfde lijst:
 *  - `reactie`: iemand typt iets ("heb de leverancier gebeld, wacht op maten");
 *  - `herinnering`: de app schrijft zelf een regel als iemand op het werkbord
 *    op "Herinneren" drukt. Die staat er gedimd tussen, zodat je ziet dát er
 *    gepord is zonder dat het als een mens-tot-mens-bericht leest.
 *
 * Wie de herinnering krijgt bepaalt de SERVER, niet de client: bij status
 * "check" is dat de checker (die houdt de taak op), anders de maker. Zo staat
 * er nooit een reminder aan de verkeerde naam omdat een bord verouderd was.
 *
 * Intern dossier, net als de taken zelf: klantaccounts krijgen op elke functie
 * een AuthError en alles is expliciet op orgId gescoped.
 */

import { v, ConvexError } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { AuthError, requireAuth, requireOrgId } from "./auth";
import { normalizeRole } from "./roles";
import { laadDocsMap } from "./lib/batchLoad";
import { initialenVan, normaliseerStatus, voornaamVan } from "./lib/taakModel";

const MAX_TEKST = 2000;

export interface VerrijkteReactie {
  _id: Id<"taakReacties">;
  taakId: Id<"klantTaken">;
  auteurId: Id<"users">;
  auteurNaam: string;
  auteurInitialen: string;
  tekst: string;
  timestamp: number;
  soort: "reactie" | "herinnering";
}

async function requireInterneRol(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  if (normalizeRole(user.role) === "klant") {
    throw new AuthError(
      "Taakreacties zijn intern en niet beschikbaar voor klantaccounts"
    );
  }
  return user;
}

/** Taak binnen de eigen organisatie; de reactie erft die scope. */
async function getTaakBinnenBedrijf(
  ctx: QueryCtx | MutationCtx,
  taakId: Id<"klantTaken">
): Promise<{ taak: Doc<"klantTaken">; orgId: Id<"organisaties"> }> {
  const orgId = await requireOrgId(ctx);
  const taak = await ctx.db.get(taakId);
  if (!taak || taak.orgId?.toString() !== orgId.toString()) {
    throw new ConvexError("Taak niet gevonden");
  }
  return { taak, orgId };
}

export const list = query({
  args: { taakId: v.id("klantTaken") },
  handler: async (ctx, args): Promise<VerrijkteReactie[]> => {
    await requireInterneRol(ctx);
    const { orgId } = await getTaakBinnenBedrijf(ctx, args.taakId);

    const reacties = (
      await ctx.db
        .query("taakReacties")
        .withIndex("by_taak", (q) => q.eq("taakId", args.taakId))
        .collect()
    ).filter((r) => r.orgId?.toString() === orgId.toString());

    const auteurs = await laadDocsMap(
      ctx,
      reacties.map((r) => r.auteurId)
    );

    return reacties
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((reactie) => {
        const auteur = auteurs.get(reactie.auteurId.toString());
        const naam = auteur?.name?.trim() || "Onbekend";
        return {
          _id: reactie._id,
          taakId: reactie.taakId,
          auteurId: reactie.auteurId,
          auteurNaam: naam,
          auteurInitialen: initialenVan(naam),
          tekst: reactie.tekst,
          timestamp: reactie.timestamp,
          soort: reactie.soort,
        };
      });
  },
});

export const plaats = mutation({
  args: { taakId: v.id("klantTaken"), tekst: v.string() },
  handler: async (ctx, args): Promise<Id<"taakReacties">> => {
    const user = await requireInterneRol(ctx);
    const { orgId } = await getTaakBinnenBedrijf(ctx, args.taakId);

    const tekst = args.tekst.trim();
    if (!tekst) throw new ConvexError("Een reactie kan niet leeg zijn");
    if (tekst.length > MAX_TEKST) {
      throw new ConvexError(`Een reactie mag maximaal ${MAX_TEKST} tekens zijn`);
    }

    return await ctx.db.insert("taakReacties", {
      orgId,
      taakId: args.taakId,
      auteurId: user._id,
      tekst,
      timestamp: Date.now(),
      soort: "reactie",
    });
  },
});

/**
 * "Herinneren" van het blijft-liggen-paneel. De server kiest de geadresseerde:
 * bij status "check" de checker, anders de maker.
 */
export const plaatsHerinnering = mutation({
  args: { taakId: v.id("klantTaken") },
  handler: async (
    ctx,
    args
  ): Promise<{ reactieId: Id<"taakReacties">; gerichtAan: string | null }> => {
    const user = await requireInterneRol(ctx);
    const { taak, orgId } = await getTaakBinnenBedrijf(ctx, args.taakId);

    const doelId =
      normaliseerStatus(taak.status) === "check"
        ? (taak.checkerId ?? taak.makerId)
        : (taak.makerId ?? taak.checkerId);
    const doel = doelId ? await ctx.db.get(doelId) : null;
    const voornaam = doel?.name ? voornaamVan(doel.name) : null;

    const tekst = voornaam
      ? `Even een reminder: dit staat nog open bij ${voornaam}.`
      : "Even een reminder: deze taak staat nog open en heeft niemand.";

    const reactieId = await ctx.db.insert("taakReacties", {
      orgId,
      taakId: args.taakId,
      auteurId: user._id,
      tekst,
      timestamp: Date.now(),
      soort: "herinnering",
    });

    // Een reminder is nadrukkelijk GEEN beweging op de taak: de stilstandmeter
    // moet blijven lopen, anders pord je hem simpelweg uit het blijft-liggen-
    // paneel zonder dat er iets gebeurd is.
    return { reactieId, gerichtAan: voornaam };
  },
});
