/**
 * /rapportages — één query voor het hele antwoordverhaal.
 *
 * Het masterplan vervangt 8 tabs door vier vraagsecties. Die vier secties
 * lezen uit dezelfde dataset, dus ze horen ook uit dezelfde subscription te
 * komen: één `getRapportage` in plaats van vier losse queries die elk
 * opnieuw alle offertes ophalen (WS8/sidebarTellingen-patroon).
 *
 * De cijfers komen uit `lib/omzetDefinities.ts` — hetzelfde bestand waar
 * `dashboard.ts` uit leest. Dat is R2: dashboard en rapportage kunnen per
 * constructie geen verschillende omzet tonen.
 *
 * De secties:
 *   1. `hoeLoopt`   — "Hoe loopt deze maand/dit seizoen?"
 *   2. `pipeline`   — "Wat zit er in de pipeline?"
 *   3. `geldLigt`   — "Waar blijft geld liggen?"
 *   4. `besteWerk`  — "Wat is mijn beste werk?"
 *
 * Labels in de payload zijn ruwe sleutels (`water_elektra`, `voorjaar`);
 * mensentaal maakt de UI ervan (R3).
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireOrgId } from "./auth";
import { requireKantoor } from "./roles";
import type { Doc } from "./_generated/dataModel";
import {
  berekenFacturatie,
  berekenGetekendeOmzet,
  isGefactureerd,
  isTelbaar,
  openstaandBedrag,
  peildatumFactuur,
  verschilPercentage,
  type Facturatie,
  type GetekendeOmzet,
  type Venster,
} from "./lib/omzetDefinities";
import {
  bepaalPeriode,
  type Periode,
  type PeriodePreset,
} from "./lib/rapportagePeriode";
import {
  berekenMaandReeks,
  berekenOmzetPerType,
  berekenOpenstaandOverzicht,
  berekenPipelineSectie,
  berekenScopeMarges,
  berekenTopKlanten,
  berekenVoorNaCalculatie,
  type VoorNaPaar,
} from "./lib/rapportageAggregatie";
import {
  voorcalculatieVanOfferte,
  voorcalculatieVanProject,
} from "./lib/voorcalculatieLookup";
import { klantNaam } from "./lib/offerteKlant";

/**
 * Convex-validator die exact de presets uit `rapportagePeriode.ts` toestaat.
 * Handmatig uitgeschreven zodat een nieuwe preset in `PERIODE_PRESETS` hier
 * een typefout geeft in plaats van stilzwijgend te worden afgewezen.
 */
export const periodePresetValidator = v.union(
  v.literal("deze-maand"),
  v.literal("vorige-maand"),
  v.literal("dit-kwartaal"),
  v.literal("vorig-kwartaal"),
  v.literal("dit-jaar"),
  v.literal("vorig-jaar"),
  v.literal("dit-seizoen"),
  v.literal("voorjaar"),
  v.literal("zomer"),
  v.literal("najaar"),
  v.literal("winter"),
  v.literal("alles"),
  v.literal("aangepast")
);

/** Periodes die de UI mag tonen zonder eigen datumrekenwerk. */
function periodeNaarPayload(periode: Periode) {
  return {
    soort: periode.soort,
    label: periode.label,
    start: periode.start,
    eind: periode.eind,
    isLopend: periode.isLopend,
    voortgangFractie: periode.voortgangFractie,
  };
}

function periodeOfNull(periode: Periode | null) {
  return periode ? periodeNaarPayload(periode) : null;
}

/** Statussen waarin een project "klaar" is en dus een nacalculatie hoort te hebben. */
const AFGEROND_STATUSSEN = new Set([
  "afgerond",
  "nacalculatie_compleet",
  "gefactureerd",
  "uitgevoerd",
]);

export const getRapportage = query({
  args: {
    preset: v.optional(periodePresetValidator),
    /** Alleen gebruikt bij preset "aangepast"; half-open venster. */
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    /**
     * Referentiemoment ("nu"). Injecteerbaar zodat het maandrapport en de
     * tests een vast moment kunnen kiezen; standaard de servertijd.
     */
    referentie: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Toegang: kantoor (directie/projectleider), zelfde regel als de
    // `RequireRole` op de pagina — maar dan serverkant, zodat een klantaccount
    // de bedrijfscijfers niet rechtstreeks uit de API kan trekken.
    await requireKantoor(ctx);
    // Tenant-sleutel bewust hetzelfde als dashboard.ts en analytics.ts: één
    // afwijkende scope zou opnieuw twee verschillende cijfers opleveren (R2).
    const orgId = await requireOrgId(ctx);
    const nu = args.referentie ?? Date.now();
    const preset: PeriodePreset = args.preset ?? "dit-jaar";

    const periode = bepaalPeriode(preset, nu, {
      start: args.startDate,
      eind: args.endDate,
    });
    const venster: Venster = { start: periode.start, eind: periode.eind };

    // ── Lezen ────────────────────────────────────────────────────────────
    const [alleOffertes, alleFacturen, alleProjecten, instellingen] =
      await Promise.all([
        ctx.db
          .query("offertes")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect(),
        ctx.db
          .query("facturen")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect(),
        ctx.db
          .query("projecten")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect(),
        ctx.db
          .query("instellingen")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .unique(),
      ]);

    const offertes = alleOffertes.filter(isTelbaar);
    const projecten = alleProjecten.filter(isTelbaar);
    const uurtarief = instellingen?.uurtarief ?? 45;

    // ── Sectie 1: hoe loopt deze periode? ────────────────────────────────
    const huidig = {
      ...berekenGetekendeOmzet(offertes, venster),
      ...berekenFacturatie(alleFacturen, venster, nu),
    };
    const vorigePeriodeCijfers = periode.vorigePeriode
      ? {
          ...berekenGetekendeOmzet(offertes, periode.vorigePeriode),
          ...berekenFacturatie(alleFacturen, periode.vorigePeriode, nu),
        }
      : null;
    const vorigJaarCijfers = periode.zelfdePeriodeVorigJaar
      ? {
          ...berekenGetekendeOmzet(offertes, periode.zelfdePeriodeVorigJaar),
          ...berekenFacturatie(alleFacturen, periode.zelfdePeriodeVorigJaar, nu),
        }
      : null;

    const factuurPunten = alleFacturen.map((f) => ({
      factuurdatum: peildatumFactuur(f),
      totaalInclBtw: f.totaalInclBtw,
      gefactureerd: isGefactureerd(f),
    }));

    const maandReeks = berekenMaandReeks(offertes, factuurPunten, venster, nu);

    // Dezelfde maandreeks een jaar eerder. Nodig voor de grafiekentab, die de
    // maanden naast elkaar zet in plaats van er één periodetotaal van te maken:
    // een hovenier wil weten óf april achterliep, niet alleen of het jaar
    // achterliep. Leeg zodra er geen vergelijkbaar jaar is (preset "alles"),
    // en dan toont de UI dat met zoveel woorden in plaats van een nullijn.
    const maandReeksVorigJaar = periode.zelfdePeriodeVorigJaar
      ? berekenMaandReeks(
          offertes,
          factuurPunten,
          periode.zelfdePeriodeVorigJaar,
          nu
        )
      : [];

    // ── Sectie 2: pipeline ───────────────────────────────────────────────
    const pipeline = berekenPipelineSectie(offertes, venster, nu);

    // ── Sectie 3a: openstaande facturen ──────────────────────────────────
    const openstaand = berekenOpenstaandOverzicht(
      alleFacturen
        .filter(isGefactureerd)
        .map((f) => ({ ...f, openstaand: openstaandBedrag(f) })),
      nu
    );

    // ── Sectie 3b: voor- vs. nacalculatie ────────────────────────────────
    // Peildatum is de nacalculatie zelf: op dát moment werd bekend hoeveel
    // uren het werk écht kostte. Het project kan maanden eerder begonnen zijn.
    const nacalculaties = await Promise.all(
      projecten.map((p) =>
        ctx.db
          .query("nacalculaties")
          .withIndex("by_project", (q) => q.eq("projectId", p._id))
          .order("desc")
          .first()
      )
    );

    const projectenMetNacalculatie: Array<{
      project: Doc<"projecten">;
      nacalculatie: Doc<"nacalculaties">;
    }> = [];
    let projectenZonderNacalculatie = 0;

    projecten.forEach((project, index) => {
      const nacalculatie = nacalculaties[index];
      if (nacalculatie) {
        if (
          nacalculatie.createdAt >= venster.start &&
          nacalculatie.createdAt < venster.eind
        ) {
          projectenMetNacalculatie.push({ project, nacalculatie });
        }
        return;
      }
      if (
        AFGEROND_STATUSSEN.has(project.status) &&
        project.createdAt >= venster.start &&
        project.createdAt < venster.eind
      ) {
        projectenZonderNacalculatie++;
      }
    });

    const offerteById = new Map<string, Doc<"offertes">>(
      alleOffertes.map((o) => [o._id.toString(), o])
    );

    const voorcalculaties = await Promise.all(
      projectenMetNacalculatie.map(async ({ project }) =>
        // Zelfde voorkeursvolgorde als de rest van de app: de offerte is de
        // bron, de projectkopie is de terugval (zie voorcalculatieLookup.ts).
        (await voorcalculatieVanOfferte(ctx, project.offerteId)) ??
        (await voorcalculatieVanProject(ctx, project._id))
      )
    );

    const paren: VoorNaPaar[] = [];
    projectenMetNacalculatie.forEach(({ project, nacalculatie }, index) => {
      const voorcalculatie = voorcalculaties[index];
      if (!voorcalculatie) return;
      const offerte = project.offerteId
        ? offerteById.get(project.offerteId.toString())
        : undefined;
      paren.push({
        projectId: project._id.toString(),
        projectNaam: project.naam,
        klantNaam: klantNaam(offerte?.klant),
        peildatum: nacalculatie.createdAt,
        geplandeUren: voorcalculatie.normUrenTotaal,
        werkelijkeUren: nacalculatie.werkelijkeUren,
        afwijkingenPerScope: nacalculatie.afwijkingenPerScope ?? {},
        normUrenPerScope: voorcalculatie.normUrenPerScope ?? {},
      });
    });

    const voorNacalculatie = berekenVoorNaCalculatie(
      paren,
      uurtarief,
      projectenZonderNacalculatie
    );

    // ── Sectie 4: beste werk ─────────────────────────────────────────────
    const scopeMarges = berekenScopeMarges(offertes, venster);
    const topKlanten = berekenTopKlanten(offertes, venster);
    const omzetPerType = berekenOmzetPerType(offertes, venster);

    // ── Payload ──────────────────────────────────────────────────────────
    return {
      periode: {
        preset,
        ...periodeNaarPayload(periode),
        vorigePeriode: periodeOfNull(periode.vorigePeriode),
        zelfdePeriodeVorigJaar: periodeOfNull(periode.zelfdePeriodeVorigJaar),
      },

      hoeLoopt: {
        huidig,
        vorigePeriode: vorigePeriodeCijfers,
        zelfdePeriodeVorigJaar: vorigJaarCijfers,
        verschil: {
          getekendeOmzetVsVorigePeriode: verschilOf(
            huidig,
            vorigePeriodeCijfers,
            "getekendeOmzetExclBtw"
          ),
          getekendeOmzetVsVorigJaar: verschilOf(
            huidig,
            vorigJaarCijfers,
            "getekendeOmzetExclBtw"
          ),
          gefactureerdVsVorigePeriode: verschilOf(
            huidig,
            vorigePeriodeCijfers,
            "gefactureerdInclBtw"
          ),
          gefactureerdVsVorigJaar: verschilOf(
            huidig,
            vorigJaarCijfers,
            "gefactureerdInclBtw"
          ),
        },
        maandReeks,
        maandReeksVorigJaar,
      },

      pipeline,

      geldLigt: {
        openstaand,
        voorNacalculatie,
      },

      besteWerk: {
        scopeMarges,
        omzetPerType,
        topKlanten: topKlanten.klanten,
        aantalKlanten: topKlanten.aantalKlanten,
        aantalTerugkerend: topKlanten.aantalTerugkerend,
        margePercentage: huidig.getekendeMargePercentage,
        marge: huidig.getekendeMarge,
      },

      meta: {
        gegenereerdOp: nu,
        /** Is er überhaupt iets te tonen? Zo niet: eerlijke lege staat (R1). */
        heeftData:
          huidig.aantalGetekend > 0 ||
          huidig.aantalFacturen > 0 ||
          pipeline.openStatussen.pipelineTotaal > 0,
        aantalOffertesTotaal: offertes.length,
        aantalFacturenTotaal: alleFacturen.length,
        aantalProjectenTotaal: projecten.length,
      },
    };
  },
});

function verschilOf(
  huidig: GetekendeOmzet & Facturatie,
  vergelijking: (GetekendeOmzet & Facturatie) | null,
  veld: keyof (GetekendeOmzet & Facturatie)
): number | null {
  if (!vergelijking) return null;
  return verschilPercentage(huidig[veld] as number, vergelijking[veld] as number);
}

/**
 * Detailquery voor de uitklap onder "Waar blijft geld liggen?" — alle
 * projecten met een voor/nacalculatie-paar, zonder afkapping op 12 regels.
 * Bewust apart: de rapportagepagina laadt dit pas als iemand doorklikt, zodat
 * de eerste render niet op de N+1 voorcalculatie-lookups hoeft te wachten.
 */
export const getVoorNacalculatieDetail = query({
  args: {
    preset: v.optional(periodePresetValidator),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    referentie: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Toegang: kantoor (directie/projectleider), zelfde regel als de
    // `RequireRole` op de pagina — maar dan serverkant, zodat een klantaccount
    // de bedrijfscijfers niet rechtstreeks uit de API kan trekken.
    await requireKantoor(ctx);
    // Tenant-sleutel bewust hetzelfde als dashboard.ts en analytics.ts: één
    // afwijkende scope zou opnieuw twee verschillende cijfers opleveren (R2).
    const orgId = await requireOrgId(ctx);
    const nu = args.referentie ?? Date.now();
    const periode = bepaalPeriode(args.preset ?? "dit-jaar", nu, {
      start: args.startDate,
      eind: args.endDate,
    });

    const [projecten, instellingen] = await Promise.all([
      ctx.db
        .query("projecten")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect(),
      ctx.db
        .query("instellingen")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique(),
    ]);

    const telbaar = projecten.filter(isTelbaar);
    const nacalculaties = await Promise.all(
      telbaar.map((p) =>
        ctx.db
          .query("nacalculaties")
          .withIndex("by_project", (q) => q.eq("projectId", p._id))
          .order("desc")
          .first()
      )
    );

    const paren: VoorNaPaar[] = [];
    for (let index = 0; index < telbaar.length; index++) {
      const nacalculatie = nacalculaties[index];
      if (!nacalculatie) continue;
      if (
        nacalculatie.createdAt < periode.start ||
        nacalculatie.createdAt >= periode.eind
      ) {
        continue;
      }
      const project = telbaar[index];
      const voorcalculatie =
        (await voorcalculatieVanOfferte(ctx, project.offerteId)) ??
        (await voorcalculatieVanProject(ctx, project._id));
      if (!voorcalculatie) continue;
      const offerte: Doc<"offertes"> | null = project.offerteId
        ? await ctx.db.get(project.offerteId)
        : null;
      paren.push({
        projectId: project._id.toString(),
        projectNaam: project.naam,
        klantNaam: klantNaam(offerte?.klant),
        peildatum: nacalculatie.createdAt,
        geplandeUren: voorcalculatie.normUrenTotaal,
        werkelijkeUren: nacalculatie.werkelijkeUren,
        afwijkingenPerScope: nacalculatie.afwijkingenPerScope ?? {},
        normUrenPerScope: voorcalculatie.normUrenPerScope ?? {},
      });
    }

    return {
      periode: periodeNaarPayload(periode),
      ...berekenVoorNaCalculatie(
        paren,
        instellingen?.uurtarief ?? 45,
        0,
        Number.MAX_SAFE_INTEGER
      ),
    };
  },
});
