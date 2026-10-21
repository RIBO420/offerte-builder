/**
 * Overige documenten (HERO-nabouw fase 6, DOCUMENTEN-MODULE.md §1, SHOULD):
 * orderbevestiging (uit een geaccepteerde offerte), bestelformulier (uit een
 * inkooporder, aan de leverancier) en leveringsbon (uit een project). Alle
 * drie in dezelfde vorm: tekst → regels → tekst, met de vaste teksten van
 * hun soort uit de tekstbibliotheek. De PDF wordt in de browser gemaakt
 * (src/components/pdf/document-pdf.tsx).
 */

import { v, ConvexError } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getOwnedOfferte, requireOrgId } from "./auth";
import { requireNotViewer } from "./roles";
import { haalStandaardTeksten } from "./tekstblokken";
import {
  bouwTekstWaarden,
  vulDocumentTeksten,
  type DocumentSoort,
  type TekstBron,
} from "./lib/documentTekst";
import { klantNaam } from "./lib/offerteKlant";

interface DocumentRegel {
  omschrijving: string;
  hoeveelheid: number;
  eenheid: string;
  prijsPerEenheid?: number;
  totaal?: number;
}

async function gemeenschappelijk(
  ctx: QueryCtx,
  orgId: Id<"organisaties">,
  soort: DocumentSoort,
  bron: Omit<TekstBron, "bedrijf">
) {
  const instellingen = await ctx.db
    .query("instellingen")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .unique();
  const bedrijf = instellingen?.bedrijfsgegevens ?? null;
  const waarden = bouwTekstWaarden({
    ...bron,
    bedrijf: bedrijf
      ? { ...bedrijf, betaaltermijnDagen: instellingen?.standaardBetalingstermijn ?? 14 }
      : undefined,
  });
  const r = vulDocumentTeksten(await haalStandaardTeksten(ctx, orgId, soort), waarden);
  const logoUrl = instellingen?.pdfLogoStorageId
    ? await ctx.storage.getUrl(instellingen.pdfLogoStorageId)
    : null;
  return {
    teksten: r.teksten,
    ontbrekend: [...r.ontbrekend, ...r.onbekend.map((o) => `{{${o}}}`)],
    bedrijf,
    branding: {
      logoUrl,
      primaireKleur: instellingen?.pdfPrimaireKleur ?? null,
      secundaireKleur: instellingen?.pdfSecundaireKleur ?? null,
      stijl: instellingen?.pdfTemplateStijl ?? null,
    },
  };
}

/** Orderbevestiging uit een geaccepteerde offerte, met prijzen en handtekeningvak. */
export const orderbevestiging = query({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
    const gebruiker = await requireNotViewer(ctx);
    const offerte = await getOwnedOfferte(ctx, args.offerteId);
    if (offerte.status !== "geaccepteerd") {
      throw new ConvexError("Een orderbevestiging hoort bij een geaccepteerde offerte.");
    }
    const klantDoc = offerte.klantId ? await ctx.db.get(offerte.klantId) : null;
    const datum = Date.now();
    const basis = await gemeenschappelijk(ctx, offerte.orgId!, "orderbevestiging", {
      klant: { ...offerte.klant, naam: offerte.klant ? klantNaam(offerte.klant) : klantDoc?.naam, voornaam: klantDoc?.voornaam, achternaam: klantDoc?.achternaam },
      document: {
        nummer: offerte.offerteNummer,
        datum,
        bedragInclBtw: offerte.totalen.totaalInclBtw,
        referentie: offerte.offerteNummer,
      },
      medewerker: { naam: gebruiker.name },
    });
    return {
      ...basis,
      titel: "Orderbevestiging",
      nummer: offerte.offerteNummer,
      datum,
      referentie: `Offerte ${offerte.offerteNummer}`,
      ontvanger: offerte.klant ?? null,
      regels: offerte.regels
        .filter((r) => !r.optioneel)
        .map<DocumentRegel>((r) => ({
          omschrijving: r.omschrijving,
          hoeveelheid: r.hoeveelheid,
          eenheid: r.eenheid,
          prijsPerEenheid: r.prijsPerEenheid,
          totaal: r.totaal,
        })),
      totalen: {
        exBtw: offerte.totalen.totaalExBtw,
        btw: offerte.totalen.btw,
        inclBtw: offerte.totalen.totaalInclBtw,
      },
    };
  },
});

/** Bestelformulier aan de leverancier uit een inkooporder. */
export const bestelformulier = query({
  args: { inkooporderId: v.id("inkooporders") },
  handler: async (ctx, args) => {
    const gebruiker = await requireNotViewer(ctx);
    const orgId = await requireOrgId(ctx);
    const order = await ctx.db.get(args.inkooporderId);
    if (!order || order.orgId?.toString() !== orgId.toString()) {
      throw new ConvexError("Inkooporder niet gevonden");
    }
    const [leverancier, project] = await Promise.all([
      ctx.db.get(order.leverancierId),
      order.projectId ? ctx.db.get(order.projectId) : null,
    ]);
    const datum = order.besteldAt ?? Date.now();
    const basis = await gemeenschappelijk(ctx, orgId, "bestelformulier", {
      document: { nummer: order.orderNummer, datum, referentie: project?.naam },
      leverancier: { naam: leverancier?.naam },
      medewerker: { naam: gebruiker.name },
    });
    return {
      ...basis,
      titel: "Bestelformulier",
      nummer: order.orderNummer,
      datum,
      referentie: project ? `Project ${project.naam}` : null,
      ontvanger: leverancier
        ? {
            naam: leverancier.contactpersoon
              ? `${leverancier.naam}, t.a.v. ${leverancier.contactpersoon}`
              : leverancier.naam,
            adres: leverancier.adres ?? "",
            postcode: leverancier.postcode ?? "",
            plaats: leverancier.plaats ?? "",
          }
        : null,
      regels: order.regels.map<DocumentRegel>((r) => ({
        omschrijving: r.omschrijving,
        hoeveelheid: r.hoeveelheid,
        eenheid: r.eenheid,
        prijsPerEenheid: r.prijsPerEenheid,
        totaal: r.totaal,
      })),
      totalen: null,
    };
  },
});

/**
 * Leveringsbon uit een project: de materiaalregels van de gekoppelde offerte
 * (alleen de regels van dit werkitem als die gekoppeld zijn), zonder prijzen.
 */
export const leveringsbon = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => {
    const gebruiker = await requireNotViewer(ctx);
    const orgId = await requireOrgId(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.orgId?.toString() !== orgId.toString()) {
      throw new ConvexError("Project niet gevonden");
    }
    const [offerte, klant] = await Promise.all([
      project.offerteId ? ctx.db.get(project.offerteId) : null,
      project.klantId ? ctx.db.get(project.klantId) : null,
    ]);
    const regels = (offerte?.regels ?? []).filter(
      (r) =>
        r.type === "materiaal" &&
        !r.optioneel &&
        (!project.offerteRegelIds?.length || project.offerteRegelIds.includes(r.id))
    );
    const datum = Date.now();
    const ontvanger = offerte?.klant ?? (klant
      ? { naam: klant.naam, adres: klant.adres, postcode: klant.postcode, plaats: klant.plaats }
      : null);
    const basis = await gemeenschappelijk(ctx, orgId, "leveringsbon", {
      klant: { naam: ontvanger?.naam, voornaam: klant?.voornaam, achternaam: klant?.achternaam },
      document: { nummer: project.naam, datum, referentie: offerte?.offerteNummer },
      medewerker: { naam: gebruiker.name },
    });
    return {
      ...basis,
      titel: "Leveringsbon",
      nummer: offerte?.offerteNummer ?? project.naam,
      datum,
      referentie: `Project ${project.naam}`,
      ontvanger,
      regels: regels.map<DocumentRegel>((r) => ({
        omschrijving: r.omschrijving,
        hoeveelheid: r.hoeveelheid,
        eenheid: r.eenheid,
      })),
      totalen: null,
    };
  },
});
