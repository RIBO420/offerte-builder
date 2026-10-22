/**
 * Herstel: projecten die bij "lead gewonnen" ontstonden, krijgen de titel
 * "Klantnaam – werkzaamheden" (klantbesluit okt 2026).
 *
 * Tot okt 2026 maakte promoveerLead bij elke gewonnen lead een project met de
 * hele aanvraagtekst als naam ("[Tuinaanleg] Hallo, wij willen graag…").
 * Sindsdien ontstaat een project pas bij akkoord op de offerte. De bestaande
 * lead-projecten (prod: 13, allemaal zonder offerte, status gepland, mét
 * klant) houden hun plek; alleen hun naam verandert.
 *
 * Kandidaat: project zónder offerteId waarvan de naam met "[" begint of
 * langer is dan 80 tekens. Nieuwe naam:
 *   projectTitel({ klantNaam: klant.naam, werkzaamheden: onderwerp })
 * met onderwerp = het label tussen [ ] aan het begin van de oude naam, anders
 * `specificaties.onderwerp` van de bijbehorende lead (gekoppeldKlantId op de
 * klant, of de promotie-activiteit die naar dit project wijst). Zonder
 * onderwerp blijft de klantnaam over.
 *
 * Raakt ALLEEN `naam` (+ `updatedAt`). De aanvraagtekst staat al in het
 * klantdossier (lead_aanvraag-event, sinds sep 2026 bij elke promotie en via
 * migrations/leadAanvraagNaarDossier); het rapport telt projecten waarvan de
 * lead nog géén dossier-event heeft (`aanvraagNietInDossier`) — die eerst
 * met leadAanvraagNaarDossier rechtzetten, deze migratie verwijdert niets.
 *
 * Uitvoeren (eerst droog — leest alles in één keer, schrijft niets):
 *   npx convex run migrations/hernoemLeadProjecten:run '{"dryRun":true}'
 *   npx convex run migrations/hernoemLeadProjecten:run '{"dryRun":false}'
 *     → 100 projecten per aanroep; herhalen met de teruggegeven
 *       `continueCursor` ('{"dryRun":false,"cursor":"…"}') tot `isDone`.
 * Optioneel `orgId` om tot één organisatie te beperken. Idempotent: een
 * hernoemd project begint niet meer met "[" en is ≤ 80 tekens.
 */

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { leesAlleOfBatch } from "./_batch";
import { effectieveLeadStatus } from "../leadsKlantenHelpers";
import {
  PROJECT_TITEL_MAX,
  onderwerpUitLeadNaam,
  projectTitel,
} from "../lib/projectTitel";

/** Labels uit het websitecontactformulier (configuratorAanvragen.createFromContact). */
const ONDERWERP_LABELS: Record<string, string> = {
  tuinonderhoud: "Tuinonderhoud",
  tuinaanleg: "Tuinaanleg",
  reiniging: "Reiniging",
  zakelijk: "Zakelijk",
  anders: "Anders",
};

/** Geen werkzaamheid: dan liever alleen de klantnaam. */
const NIETSZEGGEND = new Set(["anders", "overig", "contact"]);

/** Is dit project een oud lead-project met de aanvraagtekst als naam? */
export function isLeadProjectNaam(project: { offerteId?: unknown; naam: string }): boolean {
  if (project.offerteId) return false;
  const naam = project.naam.trim();
  return naam.startsWith("[") || naam.length > PROJECT_TITEL_MAX;
}

/** Leesbaar onderwerp; null als het niets zegt. */
export function leesbaarOnderwerp(ruw: string | null | undefined): string | null {
  const schoon = ruw?.trim();
  if (!schoon) return null;
  const label = ONDERWERP_LABELS[schoon.toLowerCase()] ?? schoon;
  return NIETSZEGGEND.has(label.toLowerCase()) ? null : label;
}

/** De nieuwe naam voor een lead-project. */
export function nieuweLeadProjectNaam(input: {
  oudeNaam: string;
  klantNaam: string;
  leadOnderwerp?: string | null;
}): { naam: string; onderwerp: string | null } {
  const onderwerp =
    leesbaarOnderwerp(onderwerpUitLeadNaam(input.oudeNaam)) ??
    leesbaarOnderwerp(input.leadOnderwerp);
  return {
    naam: projectTitel({ klantNaam: input.klantNaam, werkzaamheden: onderwerp }),
    onderwerp,
  };
}

function onderwerpVanLead(lead: Doc<"configuratorAanvragen"> | null): string | null {
  const specs = lead?.specificaties as { onderwerp?: unknown } | undefined;
  return typeof specs?.onderwerp === "string" ? specs.onderwerp : null;
}

/**
 * De lead achter een lead-project: eerst via de promotie-activiteit die naar
 * dit project wijst (metadata.werkitemId), dan via de klantkoppeling — bij
 * meerdere leads die waarvan de omschrijving de oude projectnaam is.
 */
async function vindLead(
  ctx: MutationCtx,
  project: Doc<"projecten">,
  orgId: Id<"organisaties">
): Promise<Doc<"configuratorAanvragen"> | null> {
  if (!project.klantId) return null;
  const leads = (
    await ctx.db
      .query("configuratorAanvragen")
      .withIndex("by_gekoppeld_klant", (q) => q.eq("gekoppeldKlantId", project.klantId))
      .collect()
  ).filter((l) => l.orgId?.toString() === orgId.toString());
  if (leads.length === 0) return null;

  for (const lead of leads) {
    const activiteiten = await ctx.db
      .query("leadActiviteiten")
      .withIndex("by_lead", (q) => q.eq("leadId", lead._id))
      .collect();
    const wijstNaarProject = activiteiten.some(
      (a) =>
        (a.metadata as { werkitemId?: unknown } | undefined)?.werkitemId?.toString() ===
        project._id.toString()
    );
    if (wijstNaarProject) return lead;
  }

  const naam = project.naam.trim();
  return leads.find((l) => l.omschrijving?.trim() === naam) ?? (leads.length === 1 ? leads[0] : null);
}

type Voorstel = { projectId: Id<"projecten">; oudeNaamKort: string; nieuweNaam: string };
type Overgeslagen = { projectId: Id<"projecten">; reden: "geen_klant" | "klant_andere_org" | "geen_org" };

export const run = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
    orgId: v.optional(v.id("organisaties")),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const lezing = await leesAlleOfBatch(ctx, "projecten", { dryRun, cursor: args.cursor });

    const voorstellen: Voorstel[] = [];
    const overgeslagen: Overgeslagen[] = [];
    let kandidaten = 0;
    let zonderOnderwerp = 0;
    let aanvraagNietInDossier = 0;
    let hernoemd = 0;

    for (const project of lezing.documenten) {
      if (args.orgId && project.orgId?.toString() !== args.orgId.toString()) continue;
      if (project.deletedAt || !isLeadProjectNaam(project)) continue;
      kandidaten++;

      const orgId = project.orgId;
      if (!orgId) {
        overgeslagen.push({ projectId: project._id, reden: "geen_org" });
        continue;
      }
      const klant = project.klantId ? await ctx.db.get(project.klantId) : null;
      if (!klant) {
        overgeslagen.push({ projectId: project._id, reden: "geen_klant" });
        continue;
      }
      if (klant.orgId?.toString() !== orgId.toString()) {
        overgeslagen.push({ projectId: project._id, reden: "klant_andere_org" });
        continue;
      }

      const lead = await vindLead(ctx, project, orgId);
      if (lead) {
        const event = await ctx.db
          .query("klantTijdlijn")
          .withIndex("by_bron_lead", (q) => q.eq("bronLeadId", lead._id))
          .first();
        if (!event) aanvraagNietInDossier++;
      } else {
        // Zonder lead kunnen we niet bevestigen dat de tekst in het dossier staat.
        aanvraagNietInDossier++;
      }

      const { naam, onderwerp } = nieuweLeadProjectNaam({
        oudeNaam: project.naam,
        klantNaam: klant.naam,
        leadOnderwerp: onderwerpVanLead(lead),
      });
      if (!onderwerp) zonderOnderwerp++;

      voorstellen.push({
        projectId: project._id,
        oudeNaamKort: project.naam.slice(0, 50),
        nieuweNaam: naam,
      });

      if (!dryRun && naam !== project.naam) {
        await ctx.db.patch(project._id, { naam, updatedAt: Date.now() });
        hernoemd++;
      }
    }

    // Controle punt 1: gewonnen leads met klant staan weer op het bord.
    let gewonnenLeadsOpBord: number | null = null;
    if (dryRun) {
      const leads = await ctx.db.query("configuratorAanvragen").collect();
      gewonnenLeadsOpBord = leads.filter(
        (l) =>
          (!args.orgId || l.orgId?.toString() === args.orgId.toString()) &&
          !l.isArchived &&
          effectieveLeadStatus(l) === "gewonnen" &&
          l.gekoppeldKlantId !== undefined
      ).length;
    }

    console.log(
      `[hernoemLeadProjecten] ${dryRun ? "DRY RUN" : "UITGEVOERD"}: ` +
        `${lezing.documenten.length} projecten bekeken, ${kandidaten} kandidaten, ` +
        `${voorstellen.length} voorstellen, ${overgeslagen.length} overgeslagen, ` +
        `${zonderOnderwerp} zonder onderwerp, ${aanvraagNietInDossier} aanvraag niet in dossier` +
        (dryRun ? "" : `, ${hernoemd} hernoemd`)
    );

    return {
      dryRun,
      bekeken: lezing.documenten.length,
      kandidaten,
      hernoemd,
      zonderOnderwerp,
      aanvraagNietInDossier,
      gewonnenLeadsOpBord,
      overgeslagen,
      voorstellen,
      isDone: lezing.isDone,
      continueCursor: lezing.continueCursor,
    };
  },
});
