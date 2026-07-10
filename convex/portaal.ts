/**
 * Klantenportaal (PRD §3.1) — ALLE functies hier zijn klant-facing.
 *
 * ── PORTAAL-REGELS (hard, security) ───────────────────────────────────────
 * 1. Elke query/mutation begint met requireKlant(ctx) en scopt STRIKT op
 *    klant._id van de ingelogde klant. Nooit een id uit args vertrouwen
 *    zonder ownership-check tegen klant._id.
 * 2. Elke return gebruikt een EXPLICIETE FIELD-ALLOWLIST: velden één voor
 *    één benoemen, NOOIT `...doc` spreaden. Interne velden (marges, uren,
 *    interne notities, teams, eigenaren, kosten, vlaggen) blijven zo per
 *    constructie onzichtbaar — ook als het schema later velden bijkrijgt.
 * 3. Facturen: alleen documentStatus "verzonden" (nooit concept/definitief).
 * 4. De klanttijdlijn en de interne case-thread (meldingComments) zijn
 *    intern kantoordossier — het portaal leest ze NOOIT.
 */
import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireKlant } from "./auth";
import { voerKlantAcceptatieKetenUit } from "./acceptatieKeten";
import { logTijdlijnEvent } from "./tijdlijn";
import { effectieveStatussen } from "./facturatieLogica";
import {
  routingDefaultsVoorType,
  voegSysteemCommentToe,
  bordKolomVoorStatus,
  type MeldingType,
} from "./servicemeldingen";
import { zetTriggerMailKlaar, vindBedrijfseigenaarId } from "./mailTriggers";

/**
 * Klant-zichtbaarheid van een factuur (portaal-regel 3): uitsluitend
 * documentStatus "verzonden" — concepten en definitieve-maar-nog-niet-
 * verzonden facturen bestaan voor de klant niet. Werkt via
 * effectieveStatussen zodat legacy-rijen (alleen `status`) correct meedoen.
 */
function isKlantZichtbareFactuur(f: {
  status: "concept" | "definitief" | "verzonden" | "betaald" | "vervallen";
  documentStatus?: "concept" | "definitief" | "verzonden";
  betaalStatus?:
    | "open"
    | "gedeeltelijk_betaald"
    | "betaald"
    | "vervallen"
    | "geannuleerd";
}): boolean {
  return effectieveStatussen(f).documentStatus === "verzonden";
}

// Portal overview — KPIs + recent activity
export const getOverzicht = query({
  handler: async (ctx) => {
    const { klant } = await requireKlant(ctx);

    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    const activeOffertes = offertes.filter(
      (o) => !o.deletedAt && !o.isArchived
    );

    const projecten = await ctx.db
      .query("projecten")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    const visibleFacturen = facturen.filter(isKlantZichtbareFactuur);

    const chatThreads = await ctx.db
      .query("chat_threads")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    const unreadMessages = chatThreads.reduce(
      (sum, t) => sum + (t.unreadByKlant ?? 0),
      0
    );

    // Recent activity (last 10 items)
    const activity = [
      ...activeOffertes
        .filter((o) => o.status === "verzonden")
        .map((o) => ({
          type: "offerte" as const,
          title: `Nieuwe offerte: ${o.offerteNummer}`,
          subtitle: o.offerteNummer,
          date: o.verzondenAt ?? o.createdAt,
          id: o._id,
        })),
      ...visibleFacturen
        .filter((f) => effectieveStatussen(f).betaalStatus !== "betaald")
        .map((f) => ({
          type: "factuur" as const,
          title: `Factuur: € ${f.totaalInclBtw?.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`,
          subtitle: f.factuurnummer,
          date: f.createdAt,
          id: f._id,
        })),
      ...chatThreads
        .filter((t) => (t.unreadByKlant ?? 0) > 0)
        .map((t) => ({
          type: "bericht" as const,
          title: `Bericht van Top Tuinen`,
          subtitle: t.lastMessagePreview ?? "",
          date: t.lastMessageAt ?? t.createdAt,
          id: t._id,
        })),
    ]
      .sort((a, b) => b.date - a.date)
      .slice(0, 10);

    return {
      kpis: {
        openOffertes: activeOffertes.filter((o) => o.status === "verzonden").length,
        lopendeProjecten: projecten.filter((p) => p.status === "in_uitvoering").length,
        openFacturen: visibleFacturen.filter((f) =>
          ["open", "gedeeltelijk_betaald"].includes(
            effectieveStatussen(f).betaalStatus
          )
        ).length,
        nieuweBerichten: unreadMessages,
      },
      activity,
      klantNaam: klant.naam,
    };
  },
});

// List all offertes for this klant
export const getOffertes = query({
  handler: async (ctx) => {
    const { klant } = await requireKlant(ctx);

    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    return offertes
      .filter((o) => !o.deletedAt && !o.isArchived)
      .map((o) => ({
        _id: o._id,
        offerteNummer: o.offerteNummer,
        type: o.type,
        status: o.status,
        totaalInclBtw: o.totalen?.totaalInclBtw,
        createdAt: o.createdAt,
        verzondenAt: o.verzondenAt,
        customerResponse: o.customerResponse,
        // Strip internal fields
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get single offerte detail for portal
export const getOfferte = query({
  args: { id: v.id("offertes") },
  handler: async (ctx, args) => {
    const { klant } = await requireKlant(ctx);
    const offerte = await ctx.db.get(args.id);
    if (!offerte || offerte.klantId?.toString() !== klant._id.toString()) {
      return null;
    }

    // Return customer-visible fields only (same filtering as publicOffertes.getByToken)
    return {
      _id: offerte._id,
      offerteNummer: offerte.offerteNummer,
      type: offerte.type,
      status: offerte.status,
      klant: offerte.klant,
      scopes: offerte.scopes,
      regels: offerte.regels?.filter(
        (r) => r.type !== "arbeid"
      ),
      totalen: offerte.totalen
        ? {
            totaalExBtw: offerte.totalen.totaalExBtw,
            btw: offerte.totalen.btw,
            totaalInclBtw: offerte.totalen.totaalInclBtw,
          }
        : undefined,
      notities: offerte.notities,
      createdAt: offerte.createdAt,
      verzondenAt: offerte.verzondenAt,
      customerResponse: offerte.customerResponse,
    };
  },
});

/**
 * Eigen werkitems (PRD §3.1): projecten ÉN onderhoudsbeurten van de
 * ingelogde klant. Bewust conservatieve allowlist (portaal-regel 2):
 * titel, type, status, geplande datum en adres — GEEN teams/teamnamen,
 * uren, marges, kosten of interne notities.
 */
export const getWerkitems = query({
  handler: async (ctx) => {
    const { klant } = await requireKlant(ctx);

    const werkitems = await ctx.db
      .query("projecten")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    return werkitems
      .filter((w) => !w.deletedAt && !w.isArchived)
      .map((w) => ({
        _id: w._id,
        naam: w.naam,
        type: w.type ?? ("project" as const),
        status: w.status,
        geplandeStart: w.geplandeStart ?? null,
        adres: w.adres ?? null,
        createdAt: w.createdAt,
      }))
      .sort((a, b) => {
        // Geplande items eerst (oplopend op datum), daarna nieuwste eerst
        if (a.geplandeStart && b.geplandeStart)
          return a.geplandeStart.localeCompare(b.geplandeStart);
        if (a.geplandeStart) return -1;
        if (b.geplandeStart) return 1;
        return b.createdAt - a.createdAt;
      });
  },
});

// List projecten for this klant (legacy — de portaal-UI gebruikt getWerkitems)
export const getProjecten = query({
  handler: async (ctx) => {
    const { klant } = await requireKlant(ctx);

    const projecten = await ctx.db
      .query("projecten")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    return projecten
      .map((p) => ({
        _id: p._id,
        naam: p.naam,
        status: p.status,
        createdAt: p.createdAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get single project detail
export const getProject = query({
  args: { id: v.id("projecten") },
  handler: async (ctx, args) => {
    const { klant } = await requireKlant(ctx);
    const project = await ctx.db.get(args.id);
    if (!project || project.klantId?.toString() !== klant._id.toString()) {
      return null;
    }

    // Get linked offerte for scope info
    let scopes: string[] = [];
    if (project.offerteId) {
      const offerte = await ctx.db.get(project.offerteId);
      scopes = offerte?.scopes ?? [];
    }

    // Expliciete allowlist (portaal-regel 2) — geen interne velden
    return {
      _id: project._id,
      naam: project.naam,
      type: project.type ?? ("project" as const),
      status: project.status,
      geplandeStart: project.geplandeStart ?? null,
      adres: project.adres ?? null,
      scopes,
      createdAt: project.createdAt,
    };
  },
});

// List facturen for this klant (only customer-visible statuses)
export const getFacturen = query({
  handler: async (ctx) => {
    const { klant } = await requireKlant(ctx);

    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    // Portaal-regel 3: alleen verzonden documenten (nooit concepten).
    const visibleFacturen = facturen.filter(isKlantZichtbareFactuur);

    // Look up payment links from betalingen table for unpaid facturen
    // The betalingen table uses `referentie` (string) to link to factuurnummer,
    // and payment checkout URLs may be stored in `metadata`
    const result = await Promise.all(
      visibleFacturen.map(async (f) => {
        const { betaalStatus } = effectieveStatussen(f);
        let paymentUrl: string | undefined;
        if (betaalStatus === "open" || betaalStatus === "gedeeltelijk_betaald" || betaalStatus === "vervallen") {
          const betaling = await ctx.db
            .query("betalingen")
            .withIndex("by_referentie", (q) => q.eq("referentie", f.factuurnummer))
            .first();
          // Check metadata for checkout URL if betaling exists
          if (betaling?.metadata) {
            const url = betaling.metadata["checkoutUrl"];
            if (typeof url === "string") {
              paymentUrl = url;
            }
          }
        }
        // Expliciete allowlist (portaal-regel 2) — geen interne velden.
        return {
          _id: f._id,
          factuurnummer: f.factuurnummer,
          betaalStatus,
          totaalInclBtw: f.totaalInclBtw,
          betaaldBedrag: f.betaaldBedrag,
          factuurdatum: f.factuurdatum,
          datumVanDienst: f.datumVanDienst,
          vervaldatum: f.vervaldatum,
          betaaldAt: f.betaaldAt,
          isCreditnota: f.isCreditnota ?? false,
          createdAt: f.createdAt,
          paymentUrl,
        };
      })
    );

    return result.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Factuurgegevens voor de PDF-download in het portaal — hetzelfde render-pad
 * als kantoor (FactuurPDF + @react-pdf/renderer), maar met een expliciete
 * allowlist: uitsluitend de velden die op het factuurdocument zelf staan.
 * Alleen verzonden facturen (nooit concepten), alleen de eigen klant.
 */
export const getFactuurVoorPdf = query({
  args: { id: v.id("facturen") },
  handler: async (ctx, args) => {
    const { klant } = await requireKlant(ctx);
    const factuur = await ctx.db.get(args.id);
    if (
      !factuur ||
      factuur.klantId?.toString() !== klant._id.toString() ||
      !isKlantZichtbareFactuur(factuur)
    ) {
      return null;
    }

    // Bedrijfsgegevens voor de briefpapier-header (zelf al klant-facing)
    const instellingen = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", factuur.userId))
      .first();

    // Allowlist = precies wat op de factuur-PDF staat (portaal-regel 2)
    return {
      factuur: {
        factuurnummer: factuur.factuurnummer,
        factuurdatum: factuur.factuurdatum,
        vervaldatum: factuur.vervaldatum,
        datumVanDienst: factuur.datumVanDienst,
        klant: factuur.klant,
        regels: factuur.regels.map((r) => ({
          id: r.id,
          omschrijving: r.omschrijving,
          hoeveelheid: r.hoeveelheid,
          eenheid: r.eenheid,
          prijsPerEenheid: r.prijsPerEenheid,
          totaal: r.totaal,
        })),
        correcties: factuur.correcties?.map((c) => ({
          omschrijving: c.omschrijving,
          bedrag: c.bedrag,
        })),
        subtotaal: factuur.subtotaal,
        btwPercentage: factuur.btwPercentage,
        btwBedrag: factuur.btwBedrag,
        btwUitsplitsing: factuur.btwUitsplitsing,
        totaalInclBtw: factuur.totaalInclBtw,
        notities: factuur.notities,
      },
      bedrijfsgegevens: instellingen?.bedrijfsgegevens,
    };
  },
});

// Respond to offerte (accept/reject with signature)
export const respondToOfferte = mutation({
  args: {
    offerteId: v.id("offertes"),
    status: v.union(v.literal("geaccepteerd"), v.literal("afgewezen")),
    comment: v.optional(v.string()),
    signature: v.optional(v.string()),
    selectedOptionalRegelIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { klant } = await requireKlant(ctx);
    const offerte = await ctx.db.get(args.offerteId);
    if (!offerte || offerte.klantId?.toString() !== klant._id.toString()) {
      throw new Error("Offerte niet gevonden");
    }
    if (offerte.status !== "verzonden") {
      throw new Error("Deze offerte kan niet meer worden beantwoord");
    }
    if (args.status === "geaccepteerd" && !args.signature) {
      throw new Error("Een handtekening is verplicht bij acceptatie");
    }

    const now = Date.now();

    // Update offerte status and customerResponse
    await ctx.db.patch(args.offerteId, {
      status: args.status === "geaccepteerd" ? "geaccepteerd" : "afgewezen",
      customerResponse: {
        status: args.status,
        comment: args.comment,
        respondedAt: now,
        viewedAt: offerte.customerResponse?.viewedAt ?? now,
        signature: args.signature,
        signedAt: args.signature ? now : undefined,
        selectedOptionalRegelIds: args.selectedOptionalRegelIds,
      },
    });

    // ── Acceptatie-keten voor het klant-pad (PRD §2.5, beleid) ──
    // De PRD-regel "geen acceptatie zonder ten minste één werkitem" is hard
    // en geldt óók als de klant zelf accepteert. De klant-flow mag echter
    // nooit blokkeren; daarom hergebruikt dit pad de acceptatie-kern
    // (convex/acceptatieKeten.ts):
    // (a) offerte met bouwsteenRegels → automatisch concept-contract (route 1);
    // (b) aanleg-wizard-offerte → automatisch eenmalig project;
    // (c) vrije offerte zonder herleidbare koppeling → vangnet: één eenmalig
    //     project-werkitem met alle regels, titel "Uit offerte [nummer] —
    //     koppeling controleren"; kantoor herverdeelt later via de
    //     koppel-dialoog. Deze stap verstuurt bewust geen e-mail.
    if (args.status === "geaccepteerd") {
      const geaccepteerdeOfferte = await ctx.db.get(args.offerteId);
      if (geaccepteerdeOfferte) {
        await voerKlantAcceptatieKetenUit(ctx, geaccepteerdeOfferte, now);
      }

      // — Klanttijdlijn (PRD §2.3): portaal-acceptatie als systeem-event —
      // De klant SCHRIJFT hier niet op de tijdlijn (die blijft intern);
      // het systeem logt het feit van de acceptatie in het kantoordossier.
      await logTijdlijnEvent(ctx, {
        userId: offerte.userId,
        klantId: klant._id,
        eventType: "offerte_geaccepteerd",
        tekst: `Offerte ${offerte.offerteNummer} geaccepteerd door de klant via het portaal`,
      });
    }

    return { success: true };
  },
});

// Get all downloadable documents grouped by offerte/project
export const getDocumenten = query({
  handler: async (ctx) => {
    const { klant } = await requireKlant(ctx);

    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    const visibleOffertes = offertes.filter(
      (o) => !o.deletedAt && !o.isArchived && o.status !== "concept"
    );
    const visibleFacturen = facturen.filter(isKlantZichtbareFactuur);

    return {
      offertes: visibleOffertes.map((o) => ({
        _id: o._id,
        offerteNummer: o.offerteNummer,
        type: o.type,
        createdAt: o.createdAt,
      })),
      facturen: visibleFacturen.map((f) => ({
        _id: f._id,
        factuurnummer: f.factuurnummer,
        createdAt: f.createdAt,
      })),
    };
  },
});

// Update klant profile
export const updateProfile = mutation({
  args: {
    naam: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    adres: v.optional(v.string()),
    postcode: v.optional(v.string()),
    plaats: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { klant } = await requireKlant(ctx);

    const updates: Record<string, string> = {};
    if (args.naam !== undefined) updates.naam = args.naam;
    if (args.telefoon !== undefined) updates.telefoon = args.telefoon;
    if (args.adres !== undefined) updates.adres = args.adres;
    if (args.postcode !== undefined) updates.postcode = args.postcode;
    if (args.plaats !== undefined) updates.plaats = args.plaats;

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(klant._id, { ...updates, updatedAt: Date.now() });
    }
  },
});

// Track klant last login time
export const updateLastLogin = mutation({
  handler: async (ctx) => {
    const { klant } = await requireKlant(ctx);
    await ctx.db.patch(klant._id, { lastLoginAt: Date.now() });
  },
});

// ============================================================
// Meldingen via het portaal (PRD §3.1 → zelfde bord als §2.4)
// ============================================================

const MAX_OMSCHRIJVING_LENGTE = 2000;
const MAX_FOTOS = 10;

/** Weergavelabel voor de klant (en de ontvangstbevestiging). */
const PORTAAL_TYPE_LABEL: Record<"serviceverzoek" | "klacht", string> = {
  serviceverzoek: "serviceverzoek",
  klacht: "klacht",
};

/**
 * Eigen meldingen van de klant + status. Alleen echte meldingen (taaksoort
 * "melding") — interne plantaken/debiteurentaken leven op hetzelfde bord
 * maar zijn voor de klant per constructie onzichtbaar.
 *
 * Allowlist (portaal-regel 2): omschrijving, type, statuskolom, foto's,
 * datum. NOOIT: eigenaar, interne comments, kosten, verzekeringsvlag,
 * prioriteit of andere kantoor-classificaties. Het type "schade" is een
 * kantoor-classificatie en wordt naar de klant niet als zodanig getoond.
 */
export const getMeldingen = query({
  handler: async (ctx) => {
    const { klant } = await requireKlant(ctx);

    const meldingen = await ctx.db
      .query("servicemeldingen")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    return meldingen
      .filter(
        (m) =>
          !m.deletedAt &&
          (m.taaksoort ?? "melding") === "melding" &&
          m.klantId.toString() === klant._id.toString()
      )
      .map((m) => ({
        _id: m._id,
        // "schade" is kantoor-classificatie → klant ziet neutraal "melding"
        type:
          m.type === "serviceverzoek" || m.type === "klacht" ? m.type : null,
        beschrijving: m.beschrijving,
        status: bordKolomVoorStatus(m.status),
        fotos: m.fotos ?? [],
        createdAt: m.createdAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Klant dient een melding in (serviceverzoek of klacht — GEEN schade: dat is
 * een kantoor-classificatie). Landt als kanaal "portaal" op het interne
 * cases-bord (§2.4) met de vaste routing-defaults, logt op de klanttijdlijn
 * (intern) en zet de automatische ontvangstbevestiging klaar via het
 * mailTriggers-event "melding_ontvangen" (altijd achter de mail-guard).
 */
export const dienMeldingIn = mutation({
  args: {
    type: v.union(v.literal("serviceverzoek"), v.literal("klacht")),
    beschrijving: v.string(),
    fotos: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { user, klant } = await requireKlant(ctx);
    const companyUserId = klant.userId;
    const now = Date.now();

    const beschrijving = args.beschrijving.trim();
    if (!beschrijving) {
      throw new ConvexError("Omschrijving is verplicht");
    }
    if (beschrijving.length > MAX_OMSCHRIJVING_LENGTE) {
      throw new ConvexError(
        `Omschrijving mag maximaal ${MAX_OMSCHRIJVING_LENGTE} tekens zijn`
      );
    }
    if (args.fotos && args.fotos.length > MAX_FOTOS) {
      throw new ConvexError(`Maximaal ${MAX_FOTOS} foto's per melding`);
    }

    // Routing-defaults (§2.4): serviceverzoek → beoordelen-voor-planning;
    // klacht → kantoor-eigenaar. Eigenaar = de bedrijfseigenaar (directie);
    // kantoor herverdeelt op het bord. De klant-flow blokkeert nooit.
    const type: MeldingType = args.type;
    const routing = routingDefaultsVoorType(type);
    const eigenaarId = (await vindBedrijfseigenaarId(ctx)) ?? undefined;

    const meldingId = await ctx.db.insert("servicemeldingen", {
      userId: companyUserId,
      klantId: klant._id,
      beschrijving,
      isGarantie: false,
      status: "nieuw",
      prioriteit: "normaal",
      kosten: 0,
      fotos: args.fotos,
      type,
      kanaal: "portaal",
      eigenaarId,
      aangemaaktDoorId: user._id,
      beoordelenVoorPlanning: routing.beoordelenVoorPlanning || undefined,
      verzekeringsvlag: undefined,
      taaksoort: "melding",
      createdAt: now,
      updatedAt: now,
    });

    // Interne logging: klanttijdlijn (kantoordossier) + case-thread
    await logTijdlijnEvent(ctx, {
      userId: companyUserId,
      klantId: klant._id,
      eventType: "melding_aangemaakt",
      tekst: `${type === "klacht" ? "Klacht" : "Serviceverzoek"} ingediend door de klant via het portaal: ${beschrijving.slice(0, 120)}`,
      meldingId,
    });
    await voegSysteemCommentToe(ctx, {
      userId: companyUserId,
      meldingId,
      tekst: `Melding ingediend door ${klant.naam} via het klantenportaal (${PORTAAL_TYPE_LABEL[type]})`,
    });

    // Ontvangstbevestiging via het trigger-model (§2.7): onpersoonlijk,
    // default automatisch, ALTIJD achter de mail-guard (fail-closed).
    // Idempotent via dedupeSleutel — nooit twee bevestigingen per melding.
    if (klant.email) {
      await zetTriggerMailKlaar(ctx, {
        event: "melding_ontvangen",
        userId: companyUserId,
        ontvangerEmail: klant.email,
        ontvangerNaam: klant.naam,
        variabelen: {
          klantnaam: klant.naam,
          meldingType: PORTAAL_TYPE_LABEL[type],
          omschrijvingKort: beschrijving.slice(0, 160),
        },
        klantId: klant._id,
        meldingId,
        dedupeSleutel: `melding_ontvangen:${meldingId}`,
      });
    }

    return meldingId;
  },
});

/**
 * Upload-URL voor foto's bij een portaal-melding. requireKlant — het
 * algemene fotoStorage.generateUploadUrl weigert de klant-rol (read-only).
 */
export const generatePortaalUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireKlant(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// ============================================================
// Klantthreads per werkitem/melding (PRD §3.1)
// Lezen/schrijven van berichten loopt via chatThreads.* (die queries
// dwingen klantHeeftToegangTotThread af); hier alleen get-or-create,
// strikt gescopet op het eigen werkitem / de eigen melding.
// ============================================================

/**
 * Thread bij een eigen werkitem openen (get-or-create). Klant→kantoor-
 * communicatie mag altijd; versturen kantoor→klant blijft kantoor-only
 * (afgedwongen in chatThreads.sendMessage).
 */
export const openThreadVoorWerkitem = mutation({
  args: { werkitemId: v.id("projecten") },
  handler: async (ctx, args) => {
    const { user, klant } = await requireKlant(ctx);
    const werkitem = await ctx.db.get(args.werkitemId);
    if (
      !werkitem ||
      werkitem.deletedAt ||
      werkitem.klantId?.toString() !== klant._id.toString()
    ) {
      throw new ConvexError("Werkitem niet gevonden");
    }

    const bestaande = await ctx.db
      .query("chat_threads")
      .withIndex("by_project", (q) => q.eq("projectId", args.werkitemId))
      .collect();
    const thread = bestaande.find(
      (t) => t.type === "klant" && t.klantId?.toString() === klant._id.toString()
    );
    if (thread) return thread._id;

    return await ctx.db.insert("chat_threads", {
      type: "klant",
      klantId: klant._id,
      projectId: args.werkitemId,
      channelName: werkitem.naam,
      participants: [user.clerkId],
      companyUserId: klant.userId,
      createdAt: Date.now(),
    });
  },
});

/**
 * Thread bij een eigen melding openen (get-or-create). De klant-thread is
 * strikt gescheiden van de interne case-thread (meldingComments) — die
 * blijft onzichtbaar voor de klant.
 */
export const openThreadVoorMelding = mutation({
  args: { meldingId: v.id("servicemeldingen") },
  handler: async (ctx, args) => {
    const { user, klant } = await requireKlant(ctx);
    const melding = await ctx.db.get(args.meldingId);
    if (
      !melding ||
      melding.deletedAt ||
      (melding.taaksoort ?? "melding") !== "melding" ||
      melding.klantId.toString() !== klant._id.toString()
    ) {
      throw new ConvexError("Melding niet gevonden");
    }

    const bestaande = await ctx.db
      .query("chat_threads")
      .withIndex("by_melding", (q) => q.eq("meldingId", args.meldingId))
      .collect();
    const thread = bestaande.find(
      (t) => t.type === "klant" && t.klantId?.toString() === klant._id.toString()
    );
    if (thread) return thread._id;

    return await ctx.db.insert("chat_threads", {
      type: "klant",
      klantId: klant._id,
      meldingId: args.meldingId,
      channelName: `Melding: ${melding.beschrijving.slice(0, 60)}`,
      participants: [user.clerkId],
      companyUserId: klant.userId,
      createdAt: Date.now(),
    });
  },
});
