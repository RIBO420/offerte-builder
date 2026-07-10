/**
 * Vrije offerte-builder (route 2, PRD §2.5b) — server-kant.
 *
 * De vrije offerte is een gewoon offerte-record (zelfde tabel, zelfde
 * totalen-vorm, zelfde PDF-template — "twee routes, één uitgang"). Deze
 * module bevat alleen de mutations/queries die de regel-editor nodig heeft;
 * de doorrekening zelf leeft in convex/vrijeOfferteBerekening.ts (puur,
 * gedeeld met de client).
 */

import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireNotViewer } from "./roles";
import { getOwnedOfferte } from "./auth";
import { verhoogTeller } from "./producten";
import {
  berekenRegelTotaal,
  berekenVrijeTotalen,
  nieuweProductIdsVoorGebruik,
  type VrijeRegel,
} from "./vrijeOfferteBerekening";
import { beoordeelAcceptatie } from "./acceptatieRegels";
import { Id } from "./_generated/dataModel";

const vrijeRegelValidator = v.object({
  id: v.string(),
  scope: v.string(), // hoofdstuk
  omschrijving: v.string(),
  eenheid: v.string(),
  hoeveelheid: v.number(),
  prijsPerEenheid: v.number(), // verkoopprijs per eenheid
  totaal: v.number(),
  type: v.union(
    v.literal("materiaal"),
    v.literal("arbeid"),
    v.literal("machine")
  ),
  margePercentage: v.optional(v.number()),
  inkoopprijsPerEenheid: v.optional(v.number()),
  btwCode: v.optional(v.union(v.literal(9), v.literal(21))),
  kortingPercentage: v.optional(v.number()),
  productId: v.optional(v.id("producten")),
  prijsOpRegel: v.optional(v.boolean()),
  interneNotitie: v.optional(v.string()),
  optioneel: v.optional(v.boolean()),
});

/**
 * Regels + teksten van een vrije offerte opslaan. Herberekent regeltotalen
 * en offertetotalen altijd server-side (client-waarden zijn een voorstel).
 *
 * `registreerGebruik: true` bij definitief opslaan verhoogt de gebruiksteller
 * van artikelen die nieuw op de offerte staan (PRD §2.5b/c: niet per klik).
 */
export const updateVrijeRegels = mutation({
  args: {
    id: v.id("offertes"),
    regels: v.array(vrijeRegelValidator),
    vrijeTeksten: v.optional(
      v.object({
        aanhef: v.optional(v.string()),
        voorwaarden: v.optional(v.string()),
      })
    ),
    kortingOpTotaal: v.optional(v.number()),
    registreerGebruik: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireNotViewer(ctx);
    const offerte = await getOwnedOfferte(ctx, args.id);
    const now = Date.now();

    if (offerte.bron !== "vrij") {
      throw new ConvexError(
        "Deze offerte is met een wizard gemaakt; bewerk haar via de wizard-flow"
      );
    }
    // Historie beschermen: een geaccepteerde (getekende) offerte is
    // vergrendeld. Nieuwe-versie-flow voor vrije offertes is bewust
    // doorgeschoven; eerst terug naar 'verzonden' kan ook niet zomaar
    // omdat er dan al werkitems aan hangen.
    if (offerte.status === "geaccepteerd") {
      throw new ConvexError(
        "Deze offerte is geaccepteerd en vergrendeld; maak een nieuwe offerte voor wijzigingen"
      );
    }

    // Server-side herberekening: regeltotalen én totalen
    const regels = args.regels.map((regel) => ({
      ...regel,
      totaal: berekenRegelTotaal(
        regel.hoeveelheid,
        regel.prijsPerEenheid,
        regel.kortingPercentage
      ),
    }));
    const totalen = berekenVrijeTotalen(
      regels as VrijeRegel[],
      args.kortingOpTotaal ?? 0
    );

    // Gebruiksteller bij definitief opslaan (alleen nieuw gebruikte artikelen)
    if (args.registreerGebruik) {
      const nieuweIds = nieuweProductIdsVoorGebruik(
        offerte.regels,
        regels
      ) as Id<"producten">[];
      for (const productId of nieuweIds) {
        const product = await ctx.db.get(productId);
        if (product && product.userId.toString() === user._id.toString()) {
          await ctx.db.patch(productId, {
            gebruiksteller: verhoogTeller(product.gebruiksteller),
            updatedAt: now,
          });
        }
      }
    }

    await ctx.db.patch(args.id, {
      regels,
      totalen,
      vrijeTeksten: args.vrijeTeksten,
      kortingOpTotaal: args.kortingOpTotaal,
      updatedAt: now,
    });

    // Versiegeschiedenis (zelfde vorm als updateRegels)
    const versions = await ctx.db
      .query("offerte_versions")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.id))
      .order("desc")
      .take(1);
    await ctx.db.insert("offerte_versions", {
      offerteId: args.id,
      userId: offerte.userId,
      versieNummer: (versions[0]?.versieNummer ?? 0) + 1,
      snapshot: {
        status: offerte.status,
        klant: offerte.klant,
        algemeenParams: {
          bereikbaarheid: offerte.algemeenParams.bereikbaarheid,
          achterstalligheid: offerte.algemeenParams.achterstalligheid,
        },
        scopes: offerte.scopes,
        scopeData: offerte.scopeData,
        totalen,
        regels: regels.map((r) => ({
          id: r.id,
          scope: r.scope,
          omschrijving: r.omschrijving,
          eenheid: r.eenheid,
          hoeveelheid: r.hoeveelheid,
          prijsPerEenheid: r.prijsPerEenheid,
          totaal: r.totaal,
          type: r.type,
          margePercentage: r.margePercentage,
        })),
        notities: offerte.notities,
      },
      actie: "regels_gewijzigd",
      omschrijving: `Vrije regels gewijzigd (${regels.length} regels)`,
      createdAt: now,
    });

    return { id: args.id, totalen };
  },
});

/**
 * Acceptatie-informatie voor de UI (PRD §2.5): bepaalt of "geaccepteerd"
 * direct kan (keten-uitgang bestaat of ontstaat automatisch) of dat de
 * koppel-dialoog eerst werkitems moet maken.
 */
export const acceptatieInfo = query({
  args: { id: v.id("offertes") },
  handler: async (ctx, args) => {
    const offerte = await getOwnedOfferte(ctx, args.id);

    const werkitems = await ctx.db
      .query("projecten")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.id))
      .collect();
    const contract = await ctx.db
      .query("onderhoudscontracten")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.id))
      .first();
    const voorcalculatie = await ctx.db
      .query("voorcalculaties")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.id))
      .first();

    const heeftWerkitem = werkitems.some((w) => !w.deletedAt);
    const heeftContract = contract !== null;
    const aantalBouwsteenRegels = offerte.bouwsteenRegels?.length ?? 0;
    const heeftVoorcalculatie = voorcalculatie !== null;

    // Zelfde beslisregels als de status-mutation (convex/acceptatieRegels.ts)
    const besluit = beoordeelAcceptatie({
      type: offerte.type,
      bron: offerte.bron,
      heeftWerkitem,
      heeftContract,
      aantalBouwsteenRegels,
      heeftVoorcalculatie,
    });
    const koppelingNodig = !besluit.toegestaan;

    return {
      type: offerte.type,
      bron: offerte.bron,
      status: offerte.status,
      klantId: offerte.klantId,
      heeftWerkitem,
      heeftContract,
      aantalBouwsteenRegels,
      heeftVoorcalculatie,
      koppelingNodig,
    };
  },
});
