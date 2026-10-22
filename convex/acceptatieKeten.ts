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
import type { Doc, Id } from "./_generated/dataModel";
import {
  beoordeelAcceptatie,
  type AcceptatieBesluit,
} from "./acceptatieRegels";
import { maakContractVanGeaccepteerdeOfferte } from "./onderhoudscontracten";
import { upgradeKlantPipeline } from "./pipelineHelpers";
import { begroteUrenVanOfferte } from "./lib/begroteUren";
import {
  nietOptioneleRegels,
  projectTitel,
  werkzaamhedenUitOfferte,
} from "./lib/projectTitel";
import { arbeidsUrenVanRegels } from "./lib/planningTakenUitRegels";
import { maakPlanningTakenUitOfferte } from "./lib/planningTakenVoorProject";

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
 * Titel van een project uit een offerte: "Klantnaam – werkzaamheden"
 * (klantbesluit okt 2026; voorheen "Project 2026-042 - Jansen"). Klantnaam
 * uit de offerte, anders uit het klantrecord.
 */
export async function projectTitelVoorOfferte(
  ctx: MutationCtx,
  offerte: Doc<"offertes">
): Promise<string> {
  let naam = offerte.klant?.naam?.trim();
  if (!naam && offerte.klantId) {
    const klant = await ctx.db.get(offerte.klantId);
    if (klant && klant.orgId?.toString() === offerte.orgId?.toString()) {
      naam = klant.naam?.trim();
    }
  }
  return projectTitel({ klantNaam: naam, werkzaamheden: werkzaamhedenUitOfferte(offerte) });
}

/**
 * Begrote uren van een vrije offerte: handmatige begroteUren, anders de som
 * van de arbeidsuren van de niet-optionele regels (zoals totaalUren in
 * convex/vrijeOfferteBerekening.ts, maar alleen arbeid in uren).
 */
function begroteUrenVrij(offerte: Doc<"offertes">): number | undefined {
  if (offerte.begroteUren !== undefined && offerte.begroteUren > 0) return offerte.begroteUren;
  const uren = arbeidsUrenVanRegels(nietOptioneleRegels(offerte.regels));
  return uren > 0 ? uren : begroteUrenVanOfferte(offerte);
}

/**
 * Eenmalig project uit een geaccepteerde offerte, met titel en één
 * planningstaak per regel.
 * - Aanleg-wizard: zonder offerteRegelIds (het hele werk, bestaand gedrag).
 * - Vrije offerte: met alle niet-optionele regels als offerteRegelIds.
 */
async function maakProjectUitOfferte(
  ctx: MutationCtx,
  offerte: Doc<"offertes">,
  now: number
): Promise<Id<"projecten">> {
  const isVrij = offerte.bron === "vrij";
  const projectId = await ctx.db.insert("projecten", {
    orgId: offerte.orgId,
    type: "project",
    offerteId: offerte._id,
    offerteRegelIds: isVrij ? nietOptioneleRegels(offerte.regels).map((r) => r.id) : undefined,
    klantId: offerte.klantId,
    naam: await projectTitelVoorOfferte(ctx, offerte),
    status: "gepland",
    geschatteUren: isVrij ? begroteUrenVrij(offerte) : begroteUrenVanOfferte(offerte),
    createdAt: now,
    updatedAt: now,
  });
  await maakPlanningTakenUitOfferte(ctx, projectId);
  return projectId;
}

/**
 * Voer de keten-actie uit. Aanroepen NA de status-patch (de contract-helper
 * eist status "geaccepteerd"), met de vers opgehaalde offerte.
 * - "contract_aanmaken": route 1 — voorgevuld concept-contract; kantoor
 *   activeert daarna (beurtgenerator, §2.1).
 * - "project_aanmaken": aanleg-wizard of vrije offerte — eenmalig project
 *   ("Klantnaam – werkzaamheden", taken per regel) + pipeline-upgrade.
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
    await maakProjectUitOfferte(ctx, offerte, now);
    if (offerte.klantId) {
      await upgradeKlantPipeline(ctx, offerte.klantId, "in_uitvoering");
    }
  }
}

/**
 * Vangnet voor klant-acceptatie (portaal/publieke link) van een offerte
 * zonder herleidbare keten (sinds okt 2026 alleen nog een wizard-offerte
 * zonder voorcalculatie of bouwstenen; vrije offertes maken zelf een
 * project). De PRD-regel "geen acceptatie zonder ten minste één werkitem" is
 * hard, maar de klant-flow mag nooit blokkeren: daarom ontstaat hier
 * automatisch één eenmalig project-werkitem met alle niet-optionele regels,
 * titel "Klantnaam – werkzaamheden" en een taak per regel. Kantoor
 * herverdeelt de regels desgewenst via de koppel-dialoog (offerteRegelIds
 * maakt de herkomst traceerbaar).
 */
export async function maakVangnetWerkitem(
  ctx: MutationCtx,
  offerte: Doc<"offertes">,
  now: number
): Promise<void> {
  const projectId = await ctx.db.insert("projecten", {
    orgId: offerte.orgId,
    type: "project",
    offerteId: offerte._id,
    offerteRegelIds: nietOptioneleRegels(offerte.regels).map((r) => r.id),
    klantId: offerte.klantId,
    naam: await projectTitelVoorOfferte(ctx, offerte),
    status: "gepland",
    geschatteUren: begroteUrenVanOfferte(offerte),
    createdAt: now,
    updatedAt: now,
  });
  await maakPlanningTakenUitOfferte(ctx, projectId);
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
