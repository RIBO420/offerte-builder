/**
 * Acceptatie-keten (PRD §2.5 "Overgang naar de keten") — gedeelde kern.
 *
 * De beslisregels zelf zijn puur en leven in convex/acceptatieRegels.ts;
 * dit bestand bevat de server-kant (queries + keten-uitvoering) zodat ALLE
 * acceptatiepaden exact dezelfde keten doorlopen:
 * - kantoor:       offertes.updateStatus (weigert bij ontbrekende koppeling)
 * - klantportaal:  portaal.respondToOfferte (mag nooit blokkeren → vangnet)
 * - publieke link: publicOffertes.respond (idem)
 */

import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  beoordeelAcceptatie,
  type AcceptatieBesluit,
} from "./acceptatieRegels";
import { maakContractVanGeaccepteerdeOfferte } from "./onderhoudscontracten";
import { upgradeKlantPipeline } from "./pipelineHelpers";

/** Keten-actie die de mutation bij acceptatie moet uitvoeren. */
export type KetenActie = "geen" | "contract_aanmaken" | "project_aanmaken";

/**
 * Verzamel de acceptatie-context uit de database en beoordeel die met de
 * pure beslisregels. Zelfde queries als voorheen inline in
 * offertes.updateStatus stonden.
 */
export async function bepaalAcceptatieBesluit(
  ctx: MutationCtx,
  offerte: Doc<"offertes">
): Promise<AcceptatieBesluit> {
  const werkitems = await ctx.db
    .query("projecten")
    .withIndex("by_offerte", (q) => q.eq("offerteId", offerte._id))
    .collect();
  const heeftWerkitem = werkitems.some((w) => !w.deletedAt);

  const contract = await ctx.db
    .query("onderhoudscontracten")
    .withIndex("by_offerte", (q) => q.eq("offerteId", offerte._id))
    .first();

  const voorcalculatie = await ctx.db
    .query("voorcalculaties")
    .withIndex("by_offerte", (q) => q.eq("offerteId", offerte._id))
    .first();

  return beoordeelAcceptatie({
    type: offerte.type,
    bron: offerte.bron,
    heeftWerkitem,
    heeftContract: contract !== null,
    aantalBouwsteenRegels: offerte.bouwsteenRegels?.length ?? 0,
    heeftVoorcalculatie: voorcalculatie !== null,
  });
}

/**
 * Voer de keten-actie uit. Aanroepen NA de status-patch (de contract-helper
 * eist status "geaccepteerd"), met de vers opgehaalde offerte.
 * - "contract_aanmaken": route 1 — voorgevuld concept-contract; kantoor
 *   activeert daarna (beurtgenerator, §2.1).
 * - "project_aanmaken": aanleg-wizard — eenmalig project + pipeline-upgrade.
 * Verstuurt zelf nooit e-mail.
 */
export async function voerKetenActieUit(
  ctx: MutationCtx,
  offerte: Doc<"offertes">,
  actie: KetenActie,
  now: number
): Promise<void> {
  if (actie === "contract_aanmaken") {
    await maakContractVanGeaccepteerdeOfferte(ctx, offerte);
  } else if (actie === "project_aanmaken") {
    await ctx.db.insert("projecten", {
      userId: offerte.userId,
      type: "project",
      offerteId: offerte._id,
      klantId: offerte.klantId,
      naam: `Project ${offerte.offerteNummer} - ${offerte.klant.naam}`,
      status: "gepland",
      createdAt: now,
      updatedAt: now,
    });
    if (offerte.klantId) {
      await upgradeKlantPipeline(ctx, offerte.klantId, "in_uitvoering");
    }
  }
}

/**
 * Vangnet voor klant-acceptatie (portaal/publieke link) van een vrije
 * offerte zonder herleidbare koppeling. De PRD-regel "geen acceptatie
 * zonder ten minste één werkitem" is hard, maar de klant-flow mag nooit
 * blokkeren: daarom ontstaat hier automatisch één eenmalig
 * project-werkitem met álle offerte-regels. De titel markeert het expliciet
 * als controlepunt; kantoor herverdeelt de regels daarna desgewenst via de
 * bestaande koppel-dialoog (offerteRegelIds maakt de herkomst traceerbaar).
 */
export async function maakVangnetWerkitem(
  ctx: MutationCtx,
  offerte: Doc<"offertes">,
  now: number
): Promise<void> {
  await ctx.db.insert("projecten", {
    userId: offerte.userId,
    type: "project",
    offerteId: offerte._id,
    offerteRegelIds: offerte.regels.map((r) => r.id),
    klantId: offerte.klantId,
    naam: `Uit offerte ${offerte.offerteNummer} — koppeling controleren`,
    status: "gepland",
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Volledige acceptatie-keten voor de klant-paden (portaal + publieke link):
 * hergebruik van de kantoor-kern, met het vangnet i.p.v. een weigering.
 * Aanroepen NA de status-patch met de vers opgehaalde offerte.
 */
export async function voerKlantAcceptatieKetenUit(
  ctx: MutationCtx,
  offerte: Doc<"offertes">,
  now: number
): Promise<void> {
  const besluit = await bepaalAcceptatieBesluit(ctx, offerte);
  if (besluit.toegestaan) {
    await voerKetenActieUit(ctx, offerte, besluit.actie, now);
  } else {
    await maakVangnetWerkitem(ctx, offerte, now);
  }
  if (offerte.klantId) {
    await upgradeKlantPipeline(ctx, offerte.klantId, "getekend");
  }
}
