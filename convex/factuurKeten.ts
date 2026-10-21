/**
 * Factuurketen van een geaccepteerde offerte (HERO-nabouw fase 3,
 * docs/hero-nabouw/documenten/DOCUMENTEN-MODULE.md §3).
 *
 * - "Factureer termijn N" maakt een conceptfactuur met één regel per
 *   btw-tarief en verwijst naar de offerte.
 * - De laatste termijn is de eindfactuur: de hele offerte min de eerdere
 *   termijnen, btw volgens de restmethode.
 * - Zonder termijnschema is er één factuur: de eindfactuur zonder aftrek.
 * - Een gecrediteerde factuur telt niet meer mee.
 *
 * Rekenregels: convex/lib/termijnFacturatie.ts.
 */

import { v, ConvexError } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getOwnedOfferte, requireOrg } from "./auth";
import { requireNotViewer } from "./roles";
import {
  aftrekVanFactuur,
  berekenTotalenVoorFactuur,
  eindfactuurRegels,
  offerteGrondslagPerTarief,
  termijnRegels,
  type FactuurRegelUit,
  type TermijnAftrek,
} from "./lib/termijnFacturatie";
import { effectieveStatussen, legacyStatusVan } from "./facturatieLogica";
import { factuurTekstVelden } from "./lib/factuurTekst";
import { CONCEPT_FACTUURNUMMER } from "./lib/factuurNummer";
import { klantFactuurAdres } from "./lib/adres";

const DAG_MS = 24 * 60 * 60 * 1000;

/** Facturen van de offerte die meetellen (zonder creditnota's en gecrediteerde). */
async function ketenFacturen(
  ctx: QueryCtx | MutationCtx,
  offerteId: Id<"offertes">
): Promise<Doc<"facturen">[]> {
  const alle = await ctx.db
    .query("facturen")
    .withIndex("by_offerte", (q) => q.eq("offerteId", offerteId))
    .collect();
  const gecrediteerd = new Set(
    alle
      .filter((f) => f.isCreditnota && f.referentieFactuurId)
      .map((f) => f.referentieFactuurId!.toString())
  );
  return alle
    .filter((f) => !f.isCreditnota && !f.isArchived && !gecrediteerd.has(f._id.toString()))
    .sort((a, b) => a._creationTime - b._creationTime);
}

/** Het project waar de facturen bij horen (factuurpagina, status). */
async function projectVanOfferte(
  ctx: QueryCtx | MutationCtx,
  offerteId: Id<"offertes">
): Promise<Doc<"projecten"> | null> {
  const projecten = await ctx.db
    .query("projecten")
    .withIndex("by_offerte", (q) => q.eq("offerteId", offerteId))
    .collect();
  return projecten.find((p) => p.type === undefined || p.type === "project") ?? projecten[0] ?? null;
}

function factuurSamenvatting(f: Doc<"facturen">) {
  const { documentStatus, betaalStatus } = effectieveStatussen(f);
  return {
    _id: f._id,
    factuurnummer: f.factuurnummer,
    documentStatus,
    betaalStatus,
    totaalInclBtw: f.totaalInclBtw,
    betaaldBedrag: f.betaaldBedrag ?? (betaalStatus === "betaald" ? f.totaalInclBtw : 0),
    projectId: f.projectId,
  };
}

/**
 * Overzicht per offerte: het schema, per termijn de factuur (als die er is),
 * en gefactureerd / betaald / openstaand.
 */
export const overzicht = query({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const offerte = await getOwnedOfferte(ctx, args.offerteId);
    const facturen = await ketenFacturen(ctx, offerte._id);
    const project = await projectVanOfferte(ctx, offerte._id);
    const schema = offerte.termijnschema ?? [];
    const totaal = offerte.totalen.totaalInclBtw;

    const termijnFacturen = facturen.filter((f) => f.isDeelfactuur);
    const eind = facturen.find((f) => f.isEindfactuur);
    const los = facturen.filter((f) => !f.isDeelfactuur && !f.isEindfactuur);

    const termijnen = schema.map((stap, i) => {
      const nummer = i + 1;
      const isLaatste = nummer === schema.length;
      const factuur = isLaatste
        ? eind
        : termijnFacturen.find((f) => f.deelfactuurNummer === nummer);
      return {
        nummer,
        percentage: stap.percentage,
        label: stap.label,
        isEindfactuur: isLaatste,
        prognose: Math.round(totaal * stap.percentage) / 100,
        factuur: factuur ? factuurSamenvatting(factuur) : null,
      };
    });

    const volgende = termijnen.find((t) => !t.factuur);
    const r2 = (n: number) => Math.round(n * 100) / 100;
    // Gefactureerd = definitief of verstuurd; concepten tellen nog niet mee
    const gefactureerd = r2(
      facturen
        .filter((f) => effectieveStatussen(f).documentStatus !== "concept")
        .reduce((t, f) => t + f.totaalInclBtw, 0)
    );
    const betaald = r2(
      facturen.reduce((t, f) => t + factuurSamenvatting(f).betaaldBedrag, 0)
    );

    return {
      offerteNummer: offerte.offerteNummer,
      geaccepteerd: offerte.status === "geaccepteerd",
      totaal,
      termijnen,
      // Zonder schema: één factuur (de eindfactuur zonder aftrek)
      zonderSchema: schema.length === 0,
      eindfactuur: schema.length === 0 && eind ? factuurSamenvatting(eind) : null,
      losseFacturen: los.map(factuurSamenvatting),
      volgendeNummer: volgende?.nummer ?? null,
      gefactureerd,
      betaald,
      openstaand: r2(gefactureerd - betaald),
      nogTeFactureren: r2(totaal - gefactureerd),
      projectId: project?._id ?? null,
    };
  },
});

async function maakKetenFactuur(
  ctx: MutationCtx,
  offerte: Doc<"offertes">,
  orgId: Id<"organisaties">,
  velden: {
    regels: FactuurRegelUit[];
    documentSoort: "termijnfactuur" | "eindfactuur" | "factuur" | "factuur_onderhoud";
    /** Sluit de keten af (laatste termijn of de enige factuur) */
    isEindfactuur?: boolean;
    termijnAftrek?: TermijnAftrek[];
    deelfactuur?: { nummer: number; percentage: number; label: string };
  }
): Promise<Id<"facturen">> {
  if (!offerte.klant) {
    throw new ConvexError("Deze offerte heeft geen klantgegevens. Koppel eerst een klant.");
  }
  const instellingen = await ctx.db
    .query("instellingen")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .unique();
  if (!instellingen) {
    throw new ConvexError("Instellingen niet gevonden. Configureer eerst je bedrijfsgegevens.");
  }
  const klantDoc = offerte.klantId ? await ctx.db.get(offerte.klantId) : null;
  // De facturen staan op de factuurpagina van het project
  const project = await projectVanOfferte(ctx, offerte._id);
  if (!project) {
    throw new ConvexError(
      "Start eerst het project bij deze offerte; daar komen de facturen te staan."
    );
  }
  const btwPercentage = instellingen.btwPercentage ?? 21;
  const totalen = berekenTotalenVoorFactuur({
    regels: velden.regels,
    btwPercentage,
    termijnAftrek: velden.termijnAftrek,
  });
  const now = Date.now();
  const betalingstermijnDagen = instellingen.standaardBetalingstermijn ?? 14;
  // Nummer pas bij definitief maken
  const factuurnummer = CONCEPT_FACTUURNUMMER;
  const bedrijf = instellingen.bedrijfsgegevens;

  return await ctx.db.insert("facturen", {
    orgId,
    projectId: project._id,
    offerteId: offerte._id,
    klantId: offerte.klantId,
    factuurnummer,
    ...(await factuurTekstVelden(ctx, orgId, velden.documentSoort)),
    status: legacyStatusVan("concept", "open"),
    documentStatus: "concept",
    betaalStatus: "open",
    bron: "project",
    factuurType: "regulier",
    isDeelfactuur: velden.deelfactuur ? true : undefined,
    deelfactuurNummer: velden.deelfactuur?.nummer,
    deelfactuurPercentage: velden.deelfactuur?.percentage,
    deelfactuurLabel: velden.deelfactuur?.label,
    isEindfactuur: velden.isEindfactuur ? true : undefined,
    termijnAftrek: velden.termijnAftrek?.length ? velden.termijnAftrek : undefined,
    klantBtwNummer: klantDoc?.btwNummer,
    klant: {
      naam: offerte.klant.naam,
      ...klantFactuurAdres(offerte.klant),
      email: offerte.klant.email,
      telefoon: offerte.klant.telefoon,
    },
    bedrijf: {
      naam: bedrijf.naam,
      adres: bedrijf.adres,
      postcode: bedrijf.postcode,
      plaats: bedrijf.plaats,
      kvk: bedrijf.kvk,
      btw: bedrijf.btw,
      iban: bedrijf.iban,
      email: bedrijf.email,
      telefoon: bedrijf.telefoon,
    },
    regels: velden.regels,
    subtotaal: totalen.subtotaal,
    btwPercentage,
    btwBedrag: totalen.btwBedrag,
    totaalInclBtw: totalen.totaalInclBtw,
    btwUitsplitsing: totalen.btwUitsplitsing,
    factuurdatum: now,
    vervaldatum: now + betalingstermijnDagen * DAG_MS,
    betalingstermijnDagen,
    createdAt: now,
    updatedAt: now,
  });
}

function assertGeaccepteerd(offerte: Doc<"offertes">): void {
  if (offerte.status !== "geaccepteerd") {
    throw new ConvexError("Factureren kan pas als de offerte geaccepteerd is.");
  }
}

/** Termijnfactuur N (niet de laatste: dat is de eindfactuur). */
export const factureerTermijn = mutation({
  args: { offerteId: v.id("offertes"), nummer: v.number() },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const org = await requireOrg(ctx);
    const offerte = await getOwnedOfferte(ctx, args.offerteId);
    assertGeaccepteerd(offerte);

    const schema = offerte.termijnschema ?? [];
    const stap = schema[args.nummer - 1];
    if (!stap) throw new ConvexError(`Termijn ${args.nummer} bestaat niet in het schema`);
    if (args.nummer === schema.length) {
      throw new ConvexError("De laatste termijn is de eindfactuur.");
    }

    const facturen = await ketenFacturen(ctx, offerte._id);
    if (facturen.some((f) => !f.isDeelfactuur)) {
      throw new ConvexError(
        "Voor deze offerte bestaat al een volledige factuur of eindfactuur."
      );
    }
    for (let n = 1; n < args.nummer; n++) {
      if (!facturen.some((f) => f.deelfactuurNummer === n)) {
        throw new ConvexError(`Factureer eerst termijn ${n}.`);
      }
    }
    if (facturen.some((f) => f.deelfactuurNummer === args.nummer)) {
      throw new ConvexError(`Termijn ${args.nummer} is al gefactureerd.`);
    }

    const regels = termijnRegels(
      offerteGrondslagPerTarief(offerte),
      stap,
      args.nummer,
      offerte.offerteNummer
    );
    return await maakKetenFactuur(ctx, offerte, org._id, {
      regels,
      documentSoort: "termijnfactuur",
      deelfactuur: { nummer: args.nummer, percentage: stap.percentage, label: stap.label },
    });
  },
});

/**
 * Eindfactuur: de hele offerte min alle eerdere termijnen (restmethode).
 * Zonder schema is dit de enige factuur.
 */
export const maakEindfactuur = mutation({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const org = await requireOrg(ctx);
    const offerte = await getOwnedOfferte(ctx, args.offerteId);
    assertGeaccepteerd(offerte);

    const schema = offerte.termijnschema ?? [];
    const facturen = await ketenFacturen(ctx, offerte._id);
    if (facturen.some((f) => !f.isDeelfactuur)) {
      throw new ConvexError("Voor deze offerte bestaat al een eindfactuur of volledige factuur.");
    }
    const termijnen = facturen.filter((f) => f.isDeelfactuur);
    const nogConcept = termijnen.find(
      (f) => effectieveStatussen(f).documentStatus === "concept"
    );
    if (nogConcept) {
      throw new ConvexError(
        `Maak termijn ${nogConcept.deelfactuurNummer} eerst definitief; de eindfactuur trekt de definitieve bedragen af.`
      );
    }
    for (let n = 1; n < schema.length; n++) {
      if (!termijnen.some((f) => f.deelfactuurNummer === n)) {
        throw new ConvexError(`Factureer eerst termijn ${n}.`);
      }
    }

    return await maakKetenFactuur(ctx, offerte, org._id, {
      regels: eindfactuurRegels(offerteGrondslagPerTarief(offerte), offerte.offerteNummer),
      // Zonder schema is dit gewoon de factuur, met de gewone factuurtekst
      documentSoort:
        schema.length > 0
          ? "eindfactuur"
          : offerte.type === "onderhoud"
            ? "factuur_onderhoud"
            : "factuur",
      isEindfactuur: true,
      termijnAftrek: termijnen.flatMap(aftrekVanFactuur),
      deelfactuur:
        schema.length > 0
          ? {
              nummer: schema.length,
              percentage: schema[schema.length - 1].percentage,
              label: schema[schema.length - 1].label,
            }
          : undefined,
    });
  },
});
