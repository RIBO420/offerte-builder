/**
 * Facturen Functions - Invoice module
 *
 * Provides functions for creating and managing facturen (invoices).
 * Facturen worden gegenereerd vanuit projecten na nacalculatie.
 */

import { v, ConvexError } from "convex/values";
import {
  mutation,
  query,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth, requireOrg, requireOrgId, verifyOrgOwnership } from "./auth";
import { requireNotViewer, assertKanNaarKlantVersturen } from "./roles";
import { Doc, Id } from "./_generated/dataModel";
import {
  bepaalBetaalStatus,
  berekenFactuurTotalen,
  effectieveStatussen,
  isGeldigeDocumentOvergang,
  legacyStatusVan,
  mapLegacyStatus,
  type BetaalStatus,
  type DocumentStatus,
} from "./facturatieLogica";
import { logTijdlijnEvent } from "./tijdlijn";
import { voorcalculatieVanProject } from "./lib/voorcalculatieLookup";
import { archiveerVerzondenDocument } from "./lib/klantBestandenArchief";

/**
 * Validator voor klantgegevens op factuur
 */
const klantValidator = v.object({
  naam: v.string(),
  adres: v.string(),
  postcode: v.string(),
  plaats: v.string(),
  email: v.optional(v.string()),
  telefoon: v.optional(v.string()),
});

/**
 * Validator voor factuurregel
 */
const regelValidator = v.object({
  id: v.string(),
  omschrijving: v.string(),
  eenheid: v.string(),
  hoeveelheid: v.number(),
  prijsPerEenheid: v.number(),
  totaal: v.number(),
  btwCode: v.optional(v.union(v.literal(9), v.literal(21))),
  scope: v.optional(v.string()),
  kortingPercentage: v.optional(v.number()),
});

/** Documentstatussen zoals de wachtrij/lijst erop filtert (§2.8). */
const documentStatusValidator = v.union(
  v.literal("concept"),
  v.literal("definitief"),
  v.literal("verzonden")
);

/**
 * Validator voor correctie
 */
const correctieValidator = v.object({
  omschrijving: v.string(),
  bedrag: v.number(),
});

/**
 * Get a project and verify org-ownership.
 * Sinds de org-migratie (fase 3): eigendom = zelfde organisatie, niet dezelfde
 * user — een collega mag het project van een collega factureren.
 */
async function getOwnedProject(
  ctx: Parameters<typeof requireAuth>[0],
  projectId: Id<"projecten">
) {
  const project = await ctx.db.get(projectId);
  return verifyOrgOwnership(ctx, project, "project");
}

/**
 * Get a factuur and verify org-ownership (zie getOwnedProject).
 */
async function getOwnedFactuur(
  ctx: Parameters<typeof requireAuth>[0],
  factuurId: Id<"facturen">
) {
  const factuur = await ctx.db.get(factuurId);
  return verifyOrgOwnership(ctx, factuur, "factuur");
}

// ── Statussplitsing-kern (§2.8) ──────────────────────────────────────────

/**
 * Dual-write: schrijf documentStatus + betaalStatus én de legacy-spiegel
 * (status) in één patch, zodat oude lezers consistent blijven.
 */
function statusPatch(
  documentStatus: DocumentStatus,
  betaalStatus: BetaalStatus
): {
  documentStatus: DocumentStatus;
  betaalStatus: BetaalStatus;
  status: ReturnType<typeof legacyStatusVan>;
} {
  return {
    documentStatus,
    betaalStatus,
    status: legacyStatusVan(documentStatus, betaalStatus),
  };
}

/**
 * Verstuur-kern (§2.8): concept/definitief → verzonden. Gedeeld door de
 * enkelvoudige verstuur-mutatie, de bulk-verstuur uit de wachtrij én de
 * facturatie-engine (directVersturen-contracten). Doet GEEN rolcheck —
 * de aanroepers zijn daarvoor verantwoordelijk (publiek pad:
 * assertKanNaarKlantVersturen; engine: contract-toggle door kantoor gezet).
 * De klantmail loopt via portaalEmail.sendFactuurNotification en zit
 * daarmee ALTIJD achter de mailGuard (sandbox verstuurt nooit).
 */
export async function verstuurFactuurKern(
  ctx: MutationCtx,
  factuur: Doc<"facturen">,
  opts: { auteurId?: Id<"users">; auteurNaam?: string } = {}
): Promise<void> {
  const { documentStatus, betaalStatus } = effectieveStatussen(factuur);
  if (!isGeldigeDocumentOvergang(documentStatus, "verzonden")) {
    throw new ConvexError(
      `Factuur ${factuur.factuurnummer} kan niet verstuurd worden vanuit status "${documentStatus}"`
    );
  }
  const now = Date.now();
  await ctx.db.patch(factuur._id, {
    ...statusPatch("verzonden", betaalStatus),
    verzondenAt: now,
    updatedAt: now,
  });

  // Referentie-administratie: gekoppelde werkitems → gefactureerd blijft
  // buiten scope (werkitem-status is planbord-domein); factuurId staat er al.

  // Tijdlijn-event factuur_verzonden (§2.3) — voedt ook de debiteurenladder
  if (factuur.klantId) {
    await logTijdlijnEvent(ctx, {
      klantId: factuur.klantId,
      eventType: "factuur_verzonden",
      tekst: `Factuur ${factuur.factuurnummer} verzonden (€ ${factuur.totaalInclBtw.toFixed(2)} incl. btw)`,
      auteurId: opts.auteurId,
      auteurNaam: opts.auteurNaam,
    });

    // Auto-archivering (klantdossier v13): de verzonden factuur verschijnt in
    // de Bestanden-tab. Idempotent en niet-blokkerend; alle verstuurpaden
    // (verstuur, bulkVerstuur, updateStatus, facturatie-engine) lopen hier
    // langs, dus dit is de enige plek waar het hoeft.
    await archiveerVerzondenDocument(ctx, {
      klantId: factuur.klantId,
      orgId: factuur.orgId,
      bron: "factuur",
      nummer: factuur.factuurnummer,
      factuurId: factuur._id,
      geuploadDoorId: opts.auteurId,
    });
  }

  // Project-status bijwerken (bestaand gedrag uit updateStatus)
  if (factuur.projectId) {
    const project = await ctx.db.get(factuur.projectId);
    if (
      project &&
      project.status !== "gefactureerd" &&
      (project.type === undefined || project.type === "project")
    ) {
      await ctx.db.patch(factuur.projectId, {
        status: "gefactureerd",
        updatedAt: now,
      });
    }
  }

  // Klantnotificatie (achter mailGuard in portaalEmail)
  if (factuur.klantId) {
    await ctx.scheduler.runAfter(
      0,
      internal.portaalEmail.sendFactuurNotification,
      { factuurId: factuur._id }
    );
  }
}

/**
 * Betaal-kern (§2.8, deelbetalingen): verwerk een nieuw cumulatief betaald
 * bedrag op de factuur. Zet betaalStatus (open → gedeeltelijk_betaald →
 * betaald), spiegelt legacy status, logt factuur_betaald op de tijdlijn bij
 * volledige betaling en zet de contractFacturen-termijn door (§2.8 punt 6).
 */
export async function verwerkBetaaldBedragKern(
  ctx: MutationCtx,
  factuur: Doc<"facturen">,
  nieuwBetaaldBedrag: number,
  opts: { auteurId?: Id<"users">; auteurNaam?: string; betaaldAt?: number } = {}
): Promise<BetaalStatus> {
  const now = Date.now();
  const { documentStatus, betaalStatus } = effectieveStatussen(factuur);
  const nieuweBetaalStatus = bepaalBetaalStatus(
    factuur.totaalInclBtw,
    nieuwBetaaldBedrag,
    betaalStatus
  );
  const volledigBetaald = nieuweBetaalStatus === "betaald";

  await ctx.db.patch(factuur._id, {
    ...statusPatch(documentStatus, nieuweBetaalStatus),
    betaaldBedrag: nieuwBetaaldBedrag,
    betaaldAt: volledigBetaald
      ? (opts.betaaldAt ?? now)
      : factuur.betaaldAt,
    updatedAt: now,
  });

  if (volledigBetaald) {
    // Tijdlijn-event factuur_betaald (§2.3)
    if (factuur.klantId) {
      await logTijdlijnEvent(ctx, {
        klantId: factuur.klantId,
        eventType: "factuur_betaald",
        tekst: `Factuur ${factuur.factuurnummer} betaald (€ ${factuur.totaalInclBtw.toFixed(2)})`,
        auteurId: opts.auteurId,
        auteurNaam: opts.auteurNaam,
      });
    }
    // ContractFacturen-termijn doorzetten (vast_maandbedrag-spoor)
    const termijn = await ctx.db
      .query("contractFacturen")
      .withIndex("by_factuur", (q) => q.eq("factuurId", factuur._id))
      .first();
    if (termijn && termijn.status === "gefactureerd") {
      await ctx.db.patch(termijn._id, { status: "betaald" });
    }
  }

  return nieuweBetaalStatus;
}

/**
 * Genereer een factuur vanuit projectgegevens.
 * Haalt project, offerte, nacalculatie en instellingen op.
 * Genereert automatisch een factuurnummer en kopieert relevante gegevens.
 */
export const generate = mutation({
  args: {
    projectId: v.id("projecten"),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const org = await requireOrg(ctx);
    const now = Date.now();

    // Haal project op en verifieer eigenaarschap
    const project = await getOwnedProject(ctx, args.projectId);

    // Controleer of project al een factuur heeft
    const bestaandeFactuur = await ctx.db
      .query("facturen")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();

    if (bestaandeFactuur) {
      throw new ConvexError("Er bestaat al een factuur voor dit project");
    }

    // Haal offerte op (offerteId is optioneel geworden; bestaande throw blijft gelden)
    const offerte = project.offerteId
      ? await ctx.db.get(project.offerteId)
      : null;
    if (!offerte) {
      throw new ConvexError("Offerte niet gevonden voor dit project");
    }
    // Een factuur kan niet zonder tenaamstelling. In de praktijk kan dit niet
    // gebeuren (een offerte zonder klant komt nooit verder dan concept), maar
    // sinds klant optioneel is bij concept moet het pad expliciet dichtliggen.
    const offerteKlant = offerte.klant;
    if (!offerteKlant) {
      throw new ConvexError(
        "Deze offerte heeft geen klantgegevens — koppel eerst een klant voordat je factureert."
      );
    }

    // Haal nacalculatie op (optioneel, voor correcties)
    const nacalculatie = await ctx.db
      .query("nacalculaties")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();

    // Haal instellingen op
    const instellingen = await ctx.db
      .query("instellingen")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .unique();

    if (!instellingen) {
      throw new ConvexError("Instellingen niet gevonden. Configureer eerst je bedrijfsgegevens.");
    }

    // Genereer factuurnummer
    const laatsteNummer = instellingen.laatsteFactuurNummer ?? 0;
    const volgendNummer = laatsteNummer + 1;
    const jaar = new Date().getFullYear();
    const prefix = instellingen.factuurNummerPrefix ?? "FAC-";
    const factuurnummer = `${prefix}${jaar}-${String(volgendNummer).padStart(3, "0")}`;

    // Kopieer regels van offerte (zonder scope en type, conform schema)
    const regels = offerte.regels.map((regel) => ({
      id: regel.id,
      omschrijving: regel.omschrijving,
      eenheid: regel.eenheid,
      hoeveelheid: regel.hoeveelheid,
      prijsPerEenheid: regel.prijsPerEenheid,
      totaal: regel.totaal,
    }));

    // Voeg correcties toe op basis van nacalculatie afwijkingen (indien significant)
    const correcties: Array<{ omschrijving: string; bedrag: number }> = [];
    if (nacalculatie && Math.abs(nacalculatie.afwijkingPercentage) >= 5) {
      // Alleen correcties toevoegen bij significante afwijking (>= 5%)
      const uurtarief = instellingen.uurtarief || 45;
      const correctieBedrag = nacalculatie.afwijkingUren * uurtarief;

      if (correctieBedrag !== 0) {
        correcties.push({
          omschrijving: nacalculatie.afwijkingUren > 0
            ? `Meerwerk: ${nacalculatie.afwijkingUren} uur extra (${nacalculatie.afwijkingPercentage}% afwijking)`
            : `Minderwerk: ${Math.abs(nacalculatie.afwijkingUren)} uur minder (${nacalculatie.afwijkingPercentage}% afwijking)`,
          bedrag: correctieBedrag,
        });
      }
    }

    // Bereken totalen
    const regelsTotaal = regels.reduce((sum, r) => sum + r.totaal, 0);
    const correctiesTotaal = correcties.reduce((sum, c) => sum + c.bedrag, 0);
    const subtotaal = regelsTotaal + correctiesTotaal;
    const btwPercentage = instellingen.btwPercentage;
    const btwBedrag = subtotaal * (btwPercentage / 100);
    const totaalInclBtw = subtotaal + btwBedrag;

    // Bepaal betalingstermijn en vervaldatum
    const betalingstermijnDagen = instellingen.standaardBetalingstermijn ?? 14;
    const vervaldatum = now + betalingstermijnDagen * 24 * 60 * 60 * 1000;

    // Maak de factuur aan
    const factuurId = await ctx.db.insert("facturen", {
      orgId: org._id,
      projectId: args.projectId,
      factuurnummer,
      status: "concept",
      documentStatus: "concept",
      betaalStatus: "open",
      bron: "project",
      offerteId: project.offerteId,
      klantId: project.klantId,
      klant: {
        naam: offerteKlant.naam,
        adres: offerteKlant.adres,
        postcode: offerteKlant.postcode,
        plaats: offerteKlant.plaats,
        email: offerteKlant.email,
        telefoon: offerteKlant.telefoon,
      },
      bedrijf: {
        naam: instellingen.bedrijfsgegevens.naam,
        adres: instellingen.bedrijfsgegevens.adres,
        postcode: instellingen.bedrijfsgegevens.postcode,
        plaats: instellingen.bedrijfsgegevens.plaats,
        kvk: instellingen.bedrijfsgegevens.kvk,
        btw: instellingen.bedrijfsgegevens.btw,
        iban: instellingen.bedrijfsgegevens.iban,
        email: instellingen.bedrijfsgegevens.email,
        telefoon: instellingen.bedrijfsgegevens.telefoon,
      },
      regels,
      correcties: correcties.length > 0 ? correcties : undefined,
      subtotaal,
      btwPercentage,
      btwBedrag,
      totaalInclBtw,
      factuurdatum: now,
      vervaldatum,
      betalingstermijnDagen,
      notities: args.notities,
      createdAt: now,
      updatedAt: now,
    });

    // Update laatsteFactuurNummer in instellingen
    await ctx.db.patch(instellingen._id, {
      laatsteFactuurNummer: volgendNummer,
    });

    return factuurId;
  },
});

/**
 * Search facturen by factuurNummer, klant naam, or project naam.
 */
export const search = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    const searchTerm = args.searchTerm.toLowerCase().trim();

    // Get all facturen for the organisatie
    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .collect();

    // If no search term, return recent facturen
    if (!searchTerm) {
      return facturen.slice(0, 10);
    }

    // Get all projects to search by project naam (losse facturen §2.8
    // hebben geen projectId)
    const projectIds = [
      ...new Set(
        facturen
          .map((f) => f.projectId)
          .filter((id): id is Id<"projecten"> => id !== undefined)
      ),
    ];
    const projects = await Promise.all(
      projectIds.map((id) => ctx.db.get(id))
    );
    const projectMap = new Map(
      projects.filter((p) => p !== null).map((p) => [p!._id.toString(), p!])
    );

    // Filter facturen by search term
    const matchingFacturen = facturen.filter((factuur) => {
      // Search by factuurNummer
      if (factuur.factuurnummer.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search by klant naam
      if (factuur.klant.naam.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search by project naam
      const project = factuur.projectId
        ? projectMap.get(factuur.projectId.toString())
        : undefined;
      if (project && project.naam.toLowerCase().includes(searchTerm)) {
        return true;
      }

      return false;
    });

    return matchingFacturen.slice(0, 20);
  },
});

/**
 * Haal een factuur op met eigenaarschapsverificatie.
 */
export const get = query({
  args: { id: v.id("facturen") },
  handler: async (ctx, args) => {
    const factuur = await ctx.db.get(args.id);
    if (!factuur) return null;

    // Verifieer eigenaarschap (organisatie, niet de individuele gebruiker)
    const orgId = await requireOrgId(ctx);
    if (!factuur.orgId || factuur.orgId.toString() !== orgId.toString()) {
      return null; // Verberg bestaan voor onbevoegde gebruikers
    }

    return factuur;
  },
});

/**
 * Haal factuur op voor een specifiek project.
 */
export const getByProject = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => {
    // Verifieer eigenaarschap van project
    await getOwnedProject(ctx, args.projectId);

    // Meerdere facturen per project zijn legitiem (deelfacturen FAC-001,
    // meerwerk FAC-003, creditnota's FAC-008); .unique() gooide dan een
    // serverfout. Deze query levert de hoofdfactuur voor de projectpagina:
    // de oudste reguliere factuur, met de rest als terugvaloptie.
    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    if (facturen.length === 0) {
      return null;
    }

    const regulier = facturen.filter((f) => !f.isCreditnota && !f.meerwerkId);
    const kandidaten = regulier.length > 0 ? regulier : facturen;
    kandidaten.sort((a, b) => a._creationTime - b._creationTime);
    return kandidaten[0];
  },
});

/**
 * Lijst alle facturen voor de ingelogde gebruiker.
 * Optionele statusfilter en hideArchived parameter.
 * Note: Paid invoices should always be visible, so hideArchived only affects non-paid invoices.
 */
export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("concept"),
        v.literal("definitief"),
        v.literal("verzonden"),
        v.literal("betaald"),
        v.literal("vervallen")
      )
    ),
    // §2.8: filter op de gesplitste documentketen ("Te versturen" = concept)
    documentStatus: v.optional(documentStatusValidator),
    hideArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);

    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .collect();

    let result = facturen;

    // Filter op legacy-status indien opgegeven (via effectieve statussen,
    // zodat gemigreerde én ongemigreerde rijen consistent filteren)
    if (args.status) {
      result = result.filter((f) => {
        const eff = effectieveStatussen(f);
        return legacyStatusVan(eff.documentStatus, eff.betaalStatus) === args.status;
      });
    }

    if (args.documentStatus) {
      result = result.filter(
        (f) => effectieveStatussen(f).documentStatus === args.documentStatus
      );
    }

    // Filter archived facturen if hideArchived is true (but always show paid invoices)
    if (args.hideArchived) {
      result = result.filter(
        (f) => !f.isArchived || effectieveStatussen(f).betaalStatus === "betaald"
      );
    }

    return result;
  },
});

/**
 * Facturen van één klant, voor het klantdossier.
 *
 * Gaat via de `by_klant`-index en niet via `list` + filteren: dat laatste haalt
 * élke factuur van het bedrijf op om er twee te tonen.
 *
 * Let op: `klantId` is optioneel in het schema. Facturen worden aangemaakt met
 * de `klantId` van het project, dus in de praktijk is hij gevuld; mocht een
 * hele oude rij hem missen, dan valt die hier buiten. Dat is bewust — een
 * factuur zonder klantkoppeling hoort niet stilzwijgend bij een klant te
 * belanden op basis van een gok.
 */
export const listVoorKlant = query({
  args: { klantId: v.id("klanten") },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);

    const klant = await ctx.db.get(args.klantId);
    if (!klant || !klant.orgId || klant.orgId.toString() !== orgId.toString()) {
      return [];
    }

    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_klant", (q) => q.eq("klantId", args.klantId))
      .collect();

    const nu = Date.now();

    return facturen
      // Tenant-scope (audit §2): de index staat niet op orgId, dus hier nog
      // een keer expliciet controleren.
      .filter((f) => f.orgId && f.orgId.toString() === orgId.toString())
      .sort((a, b) => b.factuurdatum - a.factuurdatum)
      .map((factuur) => {
        const { documentStatus, betaalStatus } = effectieveStatussen(factuur);
        return {
          _id: factuur._id,
          // Een factuur wordt geopend via /projecten/<id>/factuur; zonder
          // project is er geen detailpagina om naartoe te linken.
          projectId: factuur.projectId ?? null,
          factuurnummer: factuur.factuurnummer,
          factuurdatum: factuur.factuurdatum,
          vervaldatum: factuur.vervaldatum,
          totaalInclBtw: factuur.totaalInclBtw,
          documentStatus,
          betaalStatus,
          isArchived: factuur.isArchived === true,
          // Te laat = verstuurd, nog niet betaald én vervaldatum voorbij.
          isTeLaat:
            betaalStatus !== "betaald" &&
            documentStatus !== "concept" &&
            factuur.vervaldatum < nu,
        };
      });
  },
});

/**
 * Update een factuur (alleen mogelijk in concept status).
 */
export const update = mutation({
  args: {
    id: v.id("facturen"),
    klant: v.optional(klantValidator),
    regels: v.optional(v.array(regelValidator)),
    correcties: v.optional(v.array(correctieValidator)),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    // Verifieer eigenaarschap
    const factuur = await getOwnedFactuur(ctx, args.id);
    const now = Date.now();

    // Alleen bewerken in concept-documentstatus (§2.8: statussplitsing)
    if (effectieveStatussen(factuur).documentStatus !== "concept") {
      throw new ConvexError("Factuur kan alleen bewerkt worden in concept status");
    }

    const updates: Record<string, unknown> = { updatedAt: now };

    if (args.klant !== undefined) {
      updates.klant = args.klant;
    }

    if (args.notities !== undefined) {
      updates.notities = args.notities;
    }

    // Als regels of correcties worden aangepast, herbereken totalen
    const nieuweRegels = args.regels ?? factuur.regels;
    const nieuweCorrecties = args.correcties ?? factuur.correcties ?? [];

    if (args.regels !== undefined || args.correcties !== undefined) {
      updates.regels = nieuweRegels;
      updates.correcties = nieuweCorrecties.length > 0 ? nieuweCorrecties : undefined;

      // Herbereken totalen incl. btw-uitsplitsing per tarief (§2.8 punt 4);
      // correcties dragen geen btwCode en vallen op het default-percentage.
      const totalen = berekenFactuurTotalen(
        [
          ...nieuweRegels,
          ...nieuweCorrecties.map((c) => ({ totaal: c.bedrag })),
        ],
        factuur.btwPercentage
      );

      updates.subtotaal = totalen.subtotaal;
      updates.btwBedrag = totalen.btwBedrag;
      updates.totaalInclBtw = totalen.totaalInclBtw;
      updates.btwUitsplitsing = totalen.btwUitsplitsing;
    }

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

/**
 * Update de status van een factuur met validatie.
 * Toegestane overgangen:
 * - concept → definitief (vergrendelt bewerking)
 * - definitief → verzonden (zet verzondenAt)
 * - verzonden → betaald (zet betaaldAt)
 * - verzonden → vervallen
 */
export const updateStatus = mutation({
  args: {
    id: v.id("facturen"),
    status: v.union(
      v.literal("concept"),
      v.literal("definitief"),
      v.literal("verzonden"),
      v.literal("betaald"),
      v.literal("vervallen")
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireNotViewer(ctx);
    // Capability "versturen naar klant" (PRD §1.2): de overgang naar
    // "verzonden" triggert de factuurnotificatie — alleen kantoor
    if (args.status === "verzonden") {
      await assertKanNaarKlantVersturen(ctx);
    }
    // Verifieer eigenaarschap
    const factuur = await getOwnedFactuur(ctx, args.id);
    const now = Date.now();
    // §2.8: valideer op de LEGACY-keten (bestaande UI-aanroepen), maar
    // schrijf via de statussplitsing (dual-write) weg.
    const oudeStatus = legacyStatusVan(
      effectieveStatussen(factuur).documentStatus,
      effectieveStatussen(factuur).betaalStatus
    );

    // Valideer statusovergang
    const geldigeOvergangen: Record<string, string[]> = {
      concept: ["definitief", "verzonden"], // wachtrij §2.8: direct versturen mag
      definitief: ["concept", "verzonden"],
      verzonden: ["betaald", "vervallen"],
      betaald: [], // Eindstatus
      vervallen: ["verzonden"], // Kan opnieuw verzonden worden
    };

    if (!geldigeOvergangen[oudeStatus]?.includes(args.status)) {
      throw new ConvexError(
        `Ongeldige statuswijziging: ${oudeStatus} → ${args.status}`
      );
    }

    if (args.status === "verzonden") {
      if (oudeStatus === "vervallen") {
        // Opnieuw versturen van een vervallen factuur: alleen betaalketen
        // terug naar open; document was al verzonden.
        await ctx.db.patch(args.id, {
          ...statusPatch("verzonden", "open"),
          verzondenAt: now,
          updatedAt: now,
        });
        if (factuur.klantId) {
          await ctx.scheduler.runAfter(
            0,
            internal.portaalEmail.sendFactuurNotification,
            { factuurId: args.id }
          );
        }
      } else {
        await verstuurFactuurKern(ctx, factuur, {
          auteurId: user._id,
          auteurNaam: user.name,
        });
      }
      return args.id;
    }

    if (args.status === "betaald") {
      await verwerkBetaaldBedragKern(ctx, factuur, factuur.totaalInclBtw, {
        auteurId: user._id,
        auteurNaam: user.name,
      });
      return args.id;
    }

    if (args.status === "vervallen") {
      await ctx.db.patch(args.id, {
        ...statusPatch("verzonden", "vervallen"),
        updatedAt: now,
      });
      return args.id;
    }

    // concept ↔ definitief: pure documentketen
    const mapped = mapLegacyStatus(args.status);
    await ctx.db.patch(args.id, {
      ...statusPatch(
        mapped.documentStatus,
        effectieveStatussen(factuur).betaalStatus
      ),
      updatedAt: now,
    });

    // Update project status naar gefactureerd indien van toepassing
    // (bestaand gedrag bij "definitief"; alleen echte projecten)
    if (args.status === "definitief" && factuur.projectId) {
      const project = await ctx.db.get(factuur.projectId);
      if (
        project &&
        project.status !== "gefactureerd" &&
        (project.type === undefined || project.type === "project")
      ) {
        await ctx.db.patch(factuur.projectId, {
          status: "gefactureerd",
          updatedAt: now,
        });
      }
    }

    return args.id;
  },
});

/**
 * Verstuur één factuur uit de "Te versturen"-wachtrij (§2.8).
 * Kantoor-pad: capability-check + mailGuard + tijdlijn-event.
 */
export const verstuur = mutation({
  args: { id: v.id("facturen") },
  handler: async (ctx, args) => {
    const user = await assertKanNaarKlantVersturen(ctx);
    const factuur = await getOwnedFactuur(ctx, args.id);
    await verstuurFactuurKern(ctx, factuur, {
      auteurId: user._id,
      auteurNaam: user.name,
    });
    return args.id;
  },
});

/**
 * Bulk-verstuur vanuit de "Te versturen"-wachtrij (§2.8): kantoor doet de
 * laatste check en verstuurt meerdere concepten in één handeling. Facturen
 * die intussen al verzonden zijn worden overgeslagen (idempotent), zodat
 * één misser niet de hele bulk laat klappen.
 */
export const bulkVerstuur = mutation({
  args: { ids: v.array(v.id("facturen")) },
  handler: async (ctx, args) => {
    const user = await assertKanNaarKlantVersturen(ctx);
    let verstuurd = 0;
    const overgeslagen: Array<{ id: Id<"facturen">; reden: string }> = [];

    for (const id of args.ids) {
      const factuur = await getOwnedFactuur(ctx, id);
      const { documentStatus } = effectieveStatussen(factuur);
      if (documentStatus === "verzonden") {
        overgeslagen.push({ id, reden: "al verzonden" });
        continue;
      }
      await verstuurFactuurKern(ctx, factuur, {
        auteurId: user._id,
        auteurNaam: user.name,
      });
      verstuurd++;
    }

    return { verstuurd, overgeslagen };
  },
});

/**
 * Losse factuur via de herbruikbare vrije regel-editor (§2.8 punt 5).
 * Regels komen 1-op-1 uit de editor (artikel-picker, hoofdstukken, korting,
 * btw per regel); het concept landt in dezelfde "Te versturen"-wachtrij.
 */
export const createVrij = mutation({
  args: {
    klantId: v.id("klanten"),
    regels: v.array(regelValidator),
    datumVanDienst: v.optional(v.string()), // YYYY-MM-DD
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const org = await requireOrg(ctx);
    const now = Date.now();

    if (args.regels.length === 0) {
      throw new ConvexError("Een factuur heeft minimaal één regel nodig");
    }

    const klant = await ctx.db.get(args.klantId);
    if (!klant || !klant.orgId || klant.orgId.toString() !== org._id.toString()) {
      throw new ConvexError("Klant niet gevonden");
    }

    const instellingen = await ctx.db
      .query("instellingen")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .unique();
    if (!instellingen) {
      throw new ConvexError(
        "Instellingen niet gevonden. Configureer eerst je bedrijfsgegevens."
      );
    }

    const laatsteNummer = instellingen.laatsteFactuurNummer ?? 0;
    const volgendNummer = laatsteNummer + 1;
    const jaar = new Date().getFullYear();
    const prefix = instellingen.factuurNummerPrefix ?? "FAC-";
    const factuurnummer = `${prefix}${jaar}-${String(volgendNummer).padStart(3, "0")}`;

    const totalen = berekenFactuurTotalen(args.regels, 21);
    const betalingstermijnDagen = instellingen.standaardBetalingstermijn ?? 14;

    const factuurId = await ctx.db.insert("facturen", {
      orgId: org._id,
      klantId: args.klantId,
      factuurnummer,
      status: "concept",
      documentStatus: "concept",
      betaalStatus: "open",
      bron: "handmatig",
      klant: {
        naam: klant.naam,
        adres: klant.adres,
        postcode: klant.postcode,
        plaats: klant.plaats,
        email: klant.email,
        telefoon: klant.telefoon,
      },
      bedrijf: {
        naam: instellingen.bedrijfsgegevens.naam,
        adres: instellingen.bedrijfsgegevens.adres,
        postcode: instellingen.bedrijfsgegevens.postcode,
        plaats: instellingen.bedrijfsgegevens.plaats,
        kvk: instellingen.bedrijfsgegevens.kvk,
        btw: instellingen.bedrijfsgegevens.btw,
        iban: instellingen.bedrijfsgegevens.iban,
        email: instellingen.bedrijfsgegevens.email,
        telefoon: instellingen.bedrijfsgegevens.telefoon,
      },
      regels: args.regels,
      subtotaal: totalen.subtotaal,
      btwPercentage: totalen.btwPercentage,
      btwBedrag: totalen.btwBedrag,
      totaalInclBtw: totalen.totaalInclBtw,
      btwUitsplitsing: totalen.btwUitsplitsing,
      factuurdatum: now,
      vervaldatum: now + betalingstermijnDagen * 24 * 60 * 60 * 1000,
      betalingstermijnDagen,
      datumVanDienst: args.datumVanDienst,
      notities: args.notities,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(instellingen._id, {
      laatsteFactuurNummer: volgendNummer,
    });

    return factuurId;
  },
});

/**
 * Markeer factuur als betaald met optionele betaaldatum.
 */
export const markAsPaid = mutation({
  args: {
    id: v.id("facturen"),
    betaaldAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireNotViewer(ctx);
    // Verifieer eigenaarschap
    const factuur = await getOwnedFactuur(ctx, args.id);

    // Alleen verzonden facturen kunnen als betaald worden gemarkeerd
    const { documentStatus, betaalStatus } = effectieveStatussen(factuur);
    if (documentStatus !== "verzonden" || betaalStatus === "betaald") {
      throw new ConvexError("Alleen verzonden facturen kunnen als betaald worden gemarkeerd");
    }

    await verwerkBetaaldBedragKern(ctx, factuur, factuur.totaalInclBtw, {
      auteurId: user._id,
      auteurNaam: user.name,
      betaaldAt: args.betaaldAt,
    });

    return args.id;
  },
});

/**
 * Registreer een (deel)betaling op een factuur (§2.8, deelbetalingen).
 * Schrijft een rij in de betalingen-tabel (factuurId-koppeling) en zet de
 * betaalStatus automatisch: open → gedeeltelijk_betaald → betaald.
 */
export const registreerBetaling = mutation({
  args: {
    factuurId: v.id("facturen"),
    bedrag: v.number(),
    omschrijving: v.optional(v.string()),
    betaaldAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireNotViewer(ctx);
    const factuur = await getOwnedFactuur(ctx, args.factuurId);
    const now = Date.now();

    if (!Number.isFinite(args.bedrag) || args.bedrag <= 0) {
      throw new ConvexError("Betalingsbedrag moet groter dan nul zijn");
    }
    const { documentStatus, betaalStatus } = effectieveStatussen(factuur);
    if (documentStatus !== "verzonden") {
      throw new ConvexError(
        "Betalingen kunnen alleen op verzonden facturen geregistreerd worden"
      );
    }
    if (betaalStatus === "betaald") {
      throw new ConvexError("Deze factuur is al volledig betaald");
    }

    const reedsBetaald = factuur.betaaldBedrag ?? 0;
    const restbedrag =
      Math.round((factuur.totaalInclBtw - reedsBetaald) * 100) / 100;
    if (args.bedrag > restbedrag + 0.01) {
      throw new ConvexError(
        `Betaling (€ ${args.bedrag.toFixed(2)}) is hoger dan het openstaande bedrag (€ ${restbedrag.toFixed(2)})`
      );
    }

    // Betaling vastleggen in de betalingen-tabel (handmatige registratie,
    // geen Mollie-payment — herkenbaar aan het prefix). De factuur is via
    // getOwnedFactuur al org-geverifieerd, dus die orgId is de juiste tenant.
    await ctx.db.insert("betalingen", {
      orgId: factuur.orgId,
      molliePaymentId: `handmatig_${args.factuurId}_${now}`,
      bedrag: args.bedrag,
      status: "paid",
      beschrijving:
        args.omschrijving ??
        `Betaling op factuur ${factuur.factuurnummer}`,
      referentie: factuur.factuurnummer,
      klantNaam: factuur.klant.naam,
      klantEmail: factuur.klant.email ?? "",
      type: "factuur",
      factuurId: args.factuurId,
      createdAt: now,
      updatedAt: now,
    });

    const nieuwBetaald =
      Math.round((reedsBetaald + args.bedrag) * 100) / 100;
    const nieuweBetaalStatus = await verwerkBetaaldBedragKern(
      ctx,
      factuur,
      nieuwBetaald,
      {
        auteurId: user._id,
        auteurNaam: user.name,
        betaaldAt: args.betaaldAt,
      }
    );

    return {
      factuurId: args.factuurId,
      betaaldBedrag: nieuwBetaald,
      betaalStatus: nieuweBetaalStatus,
    };
  },
});

/**
 * Archive a factuur.
 * Sets isArchived to true and archivedAt to the current timestamp.
 */
export const archive = mutation({
  args: {
    id: v.id("facturen"),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    // Verifieer eigenaarschap
    await getOwnedFactuur(ctx, args.id);
    const now = Date.now();

    await ctx.db.patch(args.id, {
      isArchived: true,
      archivedAt: now,
      updatedAt: now,
    });

    return args.id;
  },
});

/**
 * Markeer factuur als betaald en archiveer het project en de offerte.
 * This is a convenience mutation that performs multiple operations:
 * 1. Updates the factuur status to "betaald"
 * 2. Updates the project status to "gefactureerd" and archives it
 * 3. Archives the linked offerte
 */
export const markAsPaidAndArchiveProject = mutation({
  args: {
    id: v.id("facturen"),
  },
  handler: async (ctx, args) => {
    const user = await requireNotViewer(ctx);
    // Verifieer eigenaarschap van factuur
    const factuur = await getOwnedFactuur(ctx, args.id);
    const now = Date.now();

    // Alleen verzonden facturen kunnen als betaald worden gemarkeerd
    const eff = effectieveStatussen(factuur);
    if (eff.documentStatus !== "verzonden" || eff.betaalStatus === "betaald") {
      throw new ConvexError("Alleen verzonden facturen kunnen als betaald worden gemarkeerd");
    }

    // Update factuur naar betaald (statussplitsing + tijdlijn + termijn-sync)
    await verwerkBetaaldBedragKern(ctx, factuur, factuur.totaalInclBtw, {
      auteurId: user._id,
      auteurNaam: user.name,
    });

    // Get the linked project (losse facturen §2.8 hebben geen project)
    if (!factuur.projectId) {
      throw new ConvexError("Project niet gevonden");
    }
    const project = await ctx.db.get(factuur.projectId);
    if (!project) {
      throw new ConvexError("Project niet gevonden");
    }

    // Verify org-ownership of project (factuur is al org-geverifieerd)
    if (
      !project.orgId ||
      !factuur.orgId ||
      project.orgId.toString() !== factuur.orgId.toString()
    ) {
      throw new ConvexError("Geen toegang tot dit project");
    }

    // Update project status to "gefactureerd" and archive it
    await ctx.db.patch(factuur.projectId, {
      status: "gefactureerd",
      isArchived: true,
      archivedAt: now,
      updatedAt: now,
    });

    // Get the linked offerte via project.offerteId
    // offerteId is optioneel geworden; ontbreekt hij, dan geldt dezelfde bestaande fout
    if (!project.offerteId) {
      throw new ConvexError("Offerte niet gevonden");
    }
    const offerte = await ctx.db.get(project.offerteId);
    if (!offerte) {
      throw new ConvexError("Offerte niet gevonden");
    }

    // Verify org-ownership of offerte
    if (
      !offerte.orgId ||
      !factuur.orgId ||
      offerte.orgId.toString() !== factuur.orgId.toString()
    ) {
      throw new ConvexError("Geen toegang tot deze offerte");
    }

    // Archive the offerte
    await ctx.db.patch(project.offerteId, {
      isArchived: true,
      archivedAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      factuurId: args.id,
      projectId: factuur.projectId,
      offerteId: project.offerteId,
    };
  },
});

/**
 * Get facturen statistics for the dashboard.
 * Returns totals, amounts, and counts per status.
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await requireOrgId(ctx);

    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    // KPI's op de gesplitste statussen (§2.8): documentketen voor de
    // wachtrij-telling, betaalketen voor openstaand/betaald. Deelbetalingen
    // tellen het RESTbedrag als openstaand.
    let conceptCount = 0;
    let definitiefCount = 0;
    let verzondenCount = 0;
    let betaaldCount = 0;
    let vervallenCount = 0;
    let teVersturenCount = 0;
    let totaalBedrag = 0;
    let openstaandBedrag = 0;
    let betaaldBedrag = 0;

    for (const factuur of facturen) {
      const { documentStatus, betaalStatus } = effectieveStatussen(factuur);

      if (documentStatus === "concept") {
        conceptCount++;
        teVersturenCount++;
      } else if (documentStatus === "definitief") {
        definitiefCount++;
      } else {
        // verzonden: betaalketen bepaalt de KPI
        switch (betaalStatus) {
          case "betaald":
            betaaldCount++;
            betaaldBedrag += factuur.totaalInclBtw;
            break;
          case "vervallen":
          case "geannuleerd":
            vervallenCount++;
            break;
          default: {
            verzondenCount++;
            const reedsBetaald = factuur.betaaldBedrag ?? 0;
            openstaandBedrag += factuur.totaalInclBtw - reedsBetaald;
            betaaldBedrag += reedsBetaald;
            break;
          }
        }
      }
      totaalBedrag += factuur.totaalInclBtw;
    }

    return {
      totaal: facturen.length,
      totaalBedrag,
      openstaandBedrag,
      betaaldBedrag,
      concept: conceptCount,
      definitief: definitiefCount,
      verzonden: verzondenCount,
      betaald: betaaldCount,
      vervallen: vervallenCount,
      teVersturen: teVersturenCount,
    };
  },
});

/**
 * Compacte tellers voor de facturenpagina (KPI-kaarten + tab-badges).
 *
 * Zelfde telsemantiek als de eerdere client-side berekening over `list`:
 * het raw legacy `status`-veld voor de tab-tellingen, creditnota-regels voor
 * omzet en openstaand, en `vervaldatum` voor het aantal verlopen facturen.
 * Alleen deze negen getallen gaan over de lijn — niet de volledige tabel.
 */
export const getLijstStats = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await requireOrgId(ctx);

    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    const now = Date.now();
    const counts = {
      totaal: facturen.length,
      concept: 0,
      definitief: 0,
      verzonden: 0,
      betaald: 0,
      vervallen: 0,
      totaalOmzet: 0,
      openstaand: 0,
      verlopen: 0,
    };

    for (const factuur of facturen) {
      // Legacy status-veld (dual-write §2.8) kent geen gedeeltelijk_betaald;
      // die facturen tellen als "verzonden" in de tab-tellingen.
      const status = factuur.status;
      if (status in counts) {
        counts[status as "concept" | "definitief" | "verzonden" | "betaald" | "vervallen"]++;
      }

      // Omzet uit betaalde facturen (creditnota's zijn negatief en drukken de omzet)
      if (status === "betaald") {
        counts.totaalOmzet += factuur.totaalInclBtw;
      }

      // Definitieve creditnota's drukken de omzet ook (negatief bedrag)
      if (factuur.isCreditnota && status === "definitief") {
        counts.totaalOmzet += factuur.totaalInclBtw;
      }

      // Openstaand bedrag (verzonden + vervallen), creditnota's uitgezonderd
      if ((status === "verzonden" || status === "vervallen") && !factuur.isCreditnota) {
        counts.openstaand += factuur.totaalInclBtw;
      }

      // Verlopen facturen (verzonden/vervallen voorbij de vervaldatum)
      if (
        (status === "verzonden" || status === "vervallen") &&
        now > factuur.vervaldatum &&
        !factuur.isCreditnota
      ) {
        counts.verlopen++;
      }
    }

    return counts;
  },
});

/**
 * List facturen with cursor-based pagination.
 * Uses Convex native .paginate() to avoid loading all records into memory.
 */
export const listPaginated = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("concept"),
        v.literal("definitief"),
        v.literal("verzonden"),
        v.literal("betaald"),
        v.literal("vervallen")
      )
    ),
    // §2.8: "Te versturen"-wachtrij filtert op documentStatus "concept"
    documentStatus: v.optional(documentStatusValidator),
  },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    const limit = args.limit || 25;

    const result = await ctx.db
      .query("facturen")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .paginate({ numItems: limit, cursor: args.cursor ?? null });

    // Post-filter via effectieve (gesplitste) statussen
    let items = result.page;
    if (args.status) {
      items = items.filter((f) => {
        const eff = effectieveStatussen(f);
        return legacyStatusVan(eff.documentStatus, eff.betaalStatus) === args.status;
      });
    }
    if (args.documentStatus) {
      items = items.filter(
        (f) => effectieveStatussen(f).documentStatus === args.documentStatus
      );
    }

    return {
      items,
      nextCursor: result.continueCursor,
      hasMore: !result.isDone,
    };
  },
});

/**
 * Get recent facturen for the dashboard.
 * Returns max 5 facturen sorted by most recently created.
 */
export const getRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    const limit = args.limit ?? 5;

    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(limit);

    return facturen.map((factuur) => {
      const eff = effectieveStatussen(factuur);
      return {
        _id: factuur._id,
        factuurnummer: factuur.factuurnummer,
        klantNaam: factuur.klant.naam,
        totaalInclBtw: factuur.totaalInclBtw,
        status: factuur.status,
        documentStatus: eff.documentStatus,
        betaalStatus: eff.betaalStatus,
        factuurdatum: factuur.factuurdatum,
        vervaldatum: factuur.vervaldatum,
      };
    });
  },
});

/**
 * Bulk archive multiple facturen.
 * Sets isArchived to true and archivedAt to the current timestamp.
 */
export const bulkArchive = mutation({
  args: {
    ids: v.array(v.id("facturen")),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const now = Date.now();

    for (const id of args.ids) {
      // Verify ownership for each factuur
      await getOwnedFactuur(ctx, id);

      await ctx.db.patch(id, {
        isArchived: true,
        archivedAt: now,
        updatedAt: now,
      });
    }

    return args.ids.length;
  },
});

/**
 * Bulk restore archived facturen.
 * Clears isArchived and archivedAt fields.
 */
export const bulkRestore = mutation({
  args: {
    ids: v.array(v.id("facturen")),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const now = Date.now();

    for (const id of args.ids) {
      // Verify ownership for each factuur
      await getOwnedFactuur(ctx, id);

      await ctx.db.patch(id, {
        isArchived: undefined,
        archivedAt: undefined,
        updatedAt: now,
      });
    }

    return args.ids.length;
  },
});

/**
 * Maak een creditnota aan voor een bestaande factuur (FAC-008).
 * Een creditnota is een negatieve factuur die verwijst naar de originele factuur.
 * De originele factuur wordt NOOIT verwijderd (fiscale eis).
 * Creditnota krijgt automatisch een CN-prefix factuurnummer.
 */
export const createCreditnota = mutation({
  args: {
    factuurId: v.id("facturen"),
    reden: v.string(),
    // Optional: select specific regels to credit (by regel id). If omitted, all regels are credited.
    regelIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const org = await requireOrg(ctx);
    const now = Date.now();

    // Haal originele factuur op en verifieer eigenaarschap
    const factuur = await getOwnedFactuur(ctx, args.factuurId);

    // Alleen verzonden facturen kunnen gecrediteerd worden (documentketen;
    // betaalketen mag open/betaald/vervallen zijn — zelfde regel als eerst)
    if (effectieveStatussen(factuur).documentStatus !== "verzonden") {
      throw new ConvexError(
        "Alleen verzonden, betaalde of vervallen facturen kunnen gecrediteerd worden"
      );
    }

    // Controleer of er al een creditnota bestaat voor deze factuur
    const bestaandeCreditnota = await ctx.db
      .query("facturen")
      .withIndex("by_referentieFactuur", (q) =>
        q.eq("referentieFactuurId", args.factuurId)
      )
      .first();

    if (bestaandeCreditnota) {
      throw new ConvexError(
        "Er bestaat al een creditnota voor deze factuur"
      );
    }

    // Haal instellingen op voor factuurnummer generatie
    const instellingen = await ctx.db
      .query("instellingen")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .unique();

    if (!instellingen) {
      throw new ConvexError(
        "Instellingen niet gevonden. Configureer eerst je bedrijfsgegevens."
      );
    }

    // Genereer creditnota nummer met CN-prefix
    const laatsteNummer = instellingen.laatsteFactuurNummer ?? 0;
    const volgendNummer = laatsteNummer + 1;
    const jaar = new Date().getFullYear();
    const creditnotaNummer = `CN-${jaar}-${String(volgendNummer).padStart(3, "0")}`;

    // Bepaal welke regels gecrediteerd worden
    let creditRegels = factuur.regels;
    if (args.regelIds && args.regelIds.length > 0) {
      creditRegels = factuur.regels.filter((r) =>
        args.regelIds!.includes(r.id)
      );
      if (creditRegels.length === 0) {
        throw new ConvexError("Geen geldige regels geselecteerd voor creditnota");
      }
    }

    // Maak negatieve regels (bedragen worden negatief); btwCode blijft mee
    // zodat de creditnota dezelfde btw-uitsplitsing spiegelt (§2.8 punt 4)
    const negatieveRegels = creditRegels.map((r) => ({
      id: r.id,
      omschrijving: r.omschrijving,
      eenheid: r.eenheid,
      hoeveelheid: r.hoeveelheid,
      prijsPerEenheid: -Math.abs(r.prijsPerEenheid),
      totaal: -Math.abs(r.totaal),
      btwCode: r.btwCode,
      scope: r.scope,
    }));

    // Bereken negatieve totalen (uitsplitsing per tarief)
    const totalen = berekenFactuurTotalen(
      negatieveRegels,
      factuur.btwPercentage
    );

    // Maak de creditnota aan (als factuur met isCreditnota = true)
    const creditnotaId = await ctx.db.insert("facturen", {
      orgId: org._id,
      projectId: factuur.projectId,
      klantId: factuur.klantId,
      factuurnummer: creditnotaNummer,
      status: "definitief", // Creditnota's zijn meteen definitief
      documentStatus: "definitief",
      betaalStatus: "open",
      isCreditnota: true,
      referentieFactuurId: args.factuurId,
      creditnotaReden: args.reden,
      klant: factuur.klant,
      bedrijf: factuur.bedrijf,
      regels: negatieveRegels,
      correcties: undefined,
      subtotaal: totalen.subtotaal,
      btwPercentage: factuur.btwPercentage,
      btwBedrag: totalen.btwBedrag,
      totaalInclBtw: totalen.totaalInclBtw,
      btwUitsplitsing: totalen.btwUitsplitsing,
      datumVanDienst: factuur.datumVanDienst,
      contractId: factuur.contractId,
      offerteId: factuur.offerteId,
      factuurdatum: now,
      vervaldatum: now, // Creditnota's hebben geen betalingstermijn
      betalingstermijnDagen: 0,
      notities: `Creditnota voor ${factuur.factuurnummer}: ${args.reden}`,
      createdAt: now,
      updatedAt: now,
    });

    // Update laatsteFactuurNummer in instellingen
    await ctx.db.patch(instellingen._id, {
      laatsteFactuurNummer: volgendNummer,
    });

    return creditnotaId;
  },
});

/**
 * Haal creditnota op voor een specifieke factuur (FAC-008).
 * Geeft de creditnota terug die gekoppeld is aan de opgegeven factuur.
 */
export const getCreditnota = query({
  args: { factuurId: v.id("facturen") },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);

    const creditnota = await ctx.db
      .query("facturen")
      .withIndex("by_referentieFactuur", (q) =>
        q.eq("referentieFactuurId", args.factuurId)
      )
      .first();

    // by_referentieFactuur is niet org-gescoped: expliciet controleren.
    if (
      !creditnota ||
      !creditnota.orgId ||
      creditnota.orgId.toString() !== orgId.toString()
    ) {
      return null;
    }

    return creditnota;
  },
});

/**
 * Haal alle creditnota's op voor de ingelogde gebruiker (FAC-008).
 */
export const listCreditnotas = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await requireOrgId(ctx);

    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .collect();

    return facturen.filter((f) => f.isCreditnota === true);
  },
});

/**
 * Haal factuur op met volledige project, offerte en nacalculatie details.
 */
export const getWithDetails = query({
  args: { id: v.id("facturen") },
  handler: async (ctx, args) => {
    // Verifieer eigenaarschap
    const factuur = await ctx.db.get(args.id);
    if (!factuur) return null;

    const orgId = await requireOrgId(ctx);
    if (!factuur.orgId || factuur.orgId.toString() !== orgId.toString()) {
      return null;
    }

    // Haal gerelateerde data op (losse facturen §2.8 hebben geen project)
    const projectId = factuur.projectId;
    const project = projectId ? await ctx.db.get(projectId) : null;

    // Haal offerte op via project (offerteId kan ontbreken)
    let offerte = null;
    if (project && project.offerteId) {
      offerte = await ctx.db.get(project.offerteId);
    }

    // Haal nacalculatie op indien beschikbaar
    const nacalculatie = projectId
      ? await ctx.db
          .query("nacalculaties")
          .withIndex("by_project", (q) => q.eq("projectId", projectId))
          .unique()
      : null;

    // Haal voorcalculatie op indien beschikbaar
    const voorcalculatie = projectId
      ? await voorcalculatieVanProject(ctx, projectId)
      : null;

    return {
      factuur,
      project,
      offerte,
      nacalculatie,
      voorcalculatie,
    };
  },
});

// ── Internal queries (for use by other Convex functions) ────────────────

/** Get a factuur by ID without auth checks. For internal use only. */
export const getByIdInternal = internalQuery({
  args: { factuurId: v.id("facturen") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.factuurId);
  },
});
