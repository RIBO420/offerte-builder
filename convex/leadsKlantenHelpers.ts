/**
 * Leads/Klanten-scheiding (PRD §1.3, fase 0)
 *
 * SANERINGSKEUZE dubbele pipeline (audit MODULE-GAP-ANALYSE §1, gap 4):
 * er waren twee concurrerende pipeline-modellen — `configuratorAanvragen.pipelineStatus`
 * (lead-funnel: nieuw → contact_gehad → offerte_verstuurd → gewonnen/verloren) én
 * `klanten.pipelineStatus` met een eigen "lead"-stadium (pipelineHelpers.ts).
 *
 * Canoniek vanaf fase 0:
 * 1. De LEAD-FUNNEL leeft uitsluitend op `configuratorAanvragen` (het leads-bord).
 * 2. Een rij in `klanten` is per definitie een KLANT — de klant begint bij promotie
 *    (markGewonnen) of bij handmatige aanmaak/import door kantoor.
 * 3. Het stadium `klanten.pipelineStatus === "lead"` is DEPRECATED: nieuwe klanten
 *    krijgen géén "lead"-default meer (pipelineStatus blijft leeg tot een echt
 *    lifecycle-event via upgradeKlantPipeline). Bestaande "lead"-klanten worden
 *    gesaneerd door convex/migrations/saneerLeadsKlanten.ts (stadium wordt geleegd).
 * 4. Eén waarheid per fase: klanten met het legacy-stadium "lead" tellen niet mee
 *    in de Klanten-lijst/teller; gepromoveerde leads verdwijnen van het leads-bord
 *    (het lead-record blijft bestaan als historie, bereikbaar vanaf de klant via
 *    `configuratorAanvragen.getLeadVoorKlant`).
 *
 * De functies hier zijn bewust puur (of nemen een ctx-parameter) zodat ze
 * unit-testbaar zijn met de MockConvexStore (patroon: convex/roles.ts +
 * src/__tests__/helpers/convex-mock.ts).
 */

import { GenericMutationCtx } from "convex/server";
import { DataModel, Doc, Id } from "./_generated/dataModel";
import { logTijdlijnEvent } from "./tijdlijn";
import { naamDelenVoorNieuweKlant } from "./lib/klantNaam";
import { aanvraagTekst } from "./lib/leadAanvraagTekst";

// ─── Lead-funnel status (configuratorAanvragen) ──────────────────────────────

export type LeadPipelineStatus =
  | "nieuw"
  | "contact_gehad"
  | "offerte_verstuurd"
  | "gewonnen"
  | "verloren";

/**
 * Map oude aanvraag-status naar pipeline-status (backward compatibility).
 */
export function mapOldStatus(status: string): LeadPipelineStatus {
  switch (status) {
    case "nieuw":
      return "nieuw";
    case "in_behandeling":
      return "contact_gehad";
    case "goedgekeurd":
      return "gewonnen";
    case "afgekeurd":
      return "verloren";
    case "voltooid":
      return "gewonnen";
    default:
      return "nieuw";
  }
}

type LeadVelden = {
  isArchived?: boolean;
  pipelineStatus?: LeadPipelineStatus;
  status: string;
  gekoppeldKlantId?: Id<"klanten">;
};

/** Effectieve funnel-status van een lead (pipelineStatus met status-fallback). */
export function effectieveLeadStatus(lead: LeadVelden): LeadPipelineStatus {
  return lead.pipelineStatus ?? mapOldStatus(lead.status);
}

/**
 * Teller-badge "Leads" (PRD §1.3/§5.1): een lead telt mee zolang hij actief in
 * de funnel zit. Gearchiveerde (§5.2), gewonnen (gepromoveerd naar klant) en
 * verloren leads tellen niet mee.
 */
export function isActieveLead(lead: LeadVelden): boolean {
  if (lead.isArchived) return false;
  const status = effectieveLeadStatus(lead);
  return status === "nieuw" || status === "contact_gehad" || status === "offerte_verstuurd";
}

/**
 * PRD §1.3 "de lead wórdt de klant": na promotie (gewonnen + gekoppeld
 * klantrecord) verdwijnt de lead van het bord. Historie/foto's/activiteiten
 * blijven bereikbaar vanaf de klant (getLeadVoorKlant).
 */
export function isGepromoveerdeLead(lead: LeadVelden): boolean {
  return effectieveLeadStatus(lead) === "gewonnen" && lead.gekoppeldKlantId !== undefined;
}

// ─── Klanten-lijst en -teller ────────────────────────────────────────────────

type KlantVelden = {
  isArchived?: boolean;
  pipelineStatus?: string;
};

/**
 * Eén waarheid per fase (PRD §1.3): een klant hoort in de Klanten-lijst/teller
 * zodra hij géén funnel-record meer is. Gearchiveerde klanten (§5.2) en klanten
 * met het legacy-stadium "lead" (gesaneerd door saneerLeadsKlanten) tellen niet mee.
 */
export function hoortInKlantenLijst(klant: KlantVelden): boolean {
  return !klant.isArchived && klant.pipelineStatus !== "lead";
}

// ─── E-mail-matching (case-insensitief) ──────────────────────────────────────

/** Normaliseer een e-mailadres voor opslag/vergelijking (trim + lowercase). */
export function normaliseerEmail(email: string | undefined | null): string | undefined {
  const trimmed = email?.trim().toLowerCase();
  return trimmed ? trimmed : undefined;
}

/**
 * Kies uit kandidaat-klanten de eerste niet-gearchiveerde klant waarvan het
 * e-mailadres case-insensitief overeenkomt. De expliciete vergelijking is
 * bewust redundant bovenop de by_email-indexquery: legacy-rijen kunnen nog een
 * niet-genormaliseerd e-mailadres hebben (tot saneerLeadsKlanten gedraaid is).
 */
export function vindKlantMatch<K extends { isArchived?: boolean; email?: string }>(
  kandidaten: K[],
  emailGenormaliseerd: string
): K | undefined {
  return kandidaten.find(
    (k) => !k.isArchived && normaliseerEmail(k.email) === emailGenormaliseerd
  );
}

// ─── Klantrecord bij een lead (gedeeld door promotie en handmatig koppelen) ──

/**
 * De velden van een lead die nodig zijn om er een klant bij te zoeken of van
 * te maken. Bewust smaller dan `Doc<"configuratorAanvragen">` zodat de helpers
 * ook met een fixture of een deelselectie te gebruiken zijn.
 */
export type LeadKlantGegevens = {
  klantNaam: string;
  klantEmail?: string;
  klantTelefoon?: string;
  klantAdres?: string;
  klantPostcode?: string;
  klantPlaats?: string;
};

/**
 * Zoek binnen de eigen organisatie een bestaande klant bij een lead, op
 * genormaliseerd e-mailadres (case-insensitief, via de by_email-index).
 *
 * Geeft `undefined` als de lead geen e-mailadres heeft of er geen match is.
 * Kijkt bewust NIET naar `gekoppeldKlantId`: dat is een beslissing van de
 * aanroeper (promoveerLead respecteert een bestaande koppeling, de handmatige
 * flow gebruikt deze helper juist om er een te leggen).
 */
export async function vindKlantVoorLead(
  ctx: GenericMutationCtx<DataModel>,
  lead: LeadKlantGegevens,
  orgId: Id<"organisaties">
): Promise<Id<"klanten"> | undefined> {
  const emailGenormaliseerd = normaliseerEmail(lead.klantEmail);
  if (!emailGenormaliseerd) return undefined;

  // by_email is een bedrijfsoverstijgende index: de org-filter hieronder
  // voorkomt dat een lead aan de klant van een andere tenant wordt gekoppeld.
  const kandidaten = (
    await ctx.db
      .query("klanten")
      .withIndex("by_email", (q) => q.eq("email", emailGenormaliseerd))
      .collect()
  ).filter((k) => k.orgId?.toString() === orgId.toString());
  const match = vindKlantMatch(kandidaten, emailGenormaliseerd)?._id;
  if (match) return match;

  // Legacy-vangnet: rijen die vóór de e-mailnormalisatie zijn aangemaakt
  // kunnen het adres nog met hoofdletters opgeslagen hebben; die staan op
  // een andere index-sleutel. Eén extra indexquery op het ruwe adres dekt
  // dit af tot migrations/saneerLeadsKlanten gedraaid is.
  const ruweEmail = lead.klantEmail?.trim();
  if (!ruweEmail || ruweEmail === emailGenormaliseerd) return undefined;

  const legacyKandidaten = (
    await ctx.db
      .query("klanten")
      .withIndex("by_email", (q) => q.eq("email", ruweEmail))
      .collect()
  ).filter((k) => k.orgId?.toString() === orgId.toString());
  return vindKlantMatch(legacyKandidaten, emailGenormaliseerd)?._id;
}

/**
 * Maak een klantrecord uit de lead-gegevens (géén deprecated "lead"-stadium,
 * zie de saneringskeuze bovenaan dit bestand). Tenancy = de organisatie van de
 * ingelogde kantoor-gebruiker, zoals klanten.create.
 *
 * Legt zelf GEEN koppeling en logt niets: dat doet de aanroeper, die ook weet
 * of het om een promotie of om een handmatige koppeling gaat.
 */
export async function maakKlantUitLead(
  ctx: GenericMutationCtx<DataModel>,
  lead: LeadKlantGegevens,
  orgId: Id<"organisaties">
): Promise<Id<"klanten">> {
  const now = Date.now();
  const naam = lead.klantNaam.trim();
  return await ctx.db.insert("klanten", {
    orgId,
    naam,
    // Een klant uit een lead hoort dezelfde naamvelden te krijgen als een
    // klant die kantoor zelf invoert: anders staat hij in de lijst onder zijn
    // voornaam en blijft het dossier leeg. Zelfde regel als de migratie.
    ...naamDelenVoorNieuweKlant(naam),
    adres: lead.klantAdres?.trim() ?? "",
    postcode: lead.klantPostcode?.trim() ?? "",
    plaats: lead.klantPlaats?.trim() ?? "",
    email: normaliseerEmail(lead.klantEmail),
    telefoon: lead.klantTelefoon?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  });
}

// ─── Promotie Lead → Klant (kern van markGewonnen) ───────────────────────────

export type PromotieResultaat = {
  klantId: Id<"klanten">;
  werkitemId: Id<"projecten"> | null;
  nieuweKlant: boolean;
  alGepromoveerd: boolean;
};

/**
 * Promoveer een lead naar klant (PRD §1.3): de lead wórdt de klant.
 *
 * - Idempotent: een al gepromoveerde lead (gewonnen + gekoppeldKlantId) is een
 *   no-op die het bestaande klantrecord teruggeeft — geen dubbel werkitem.
 * - Case-insensitieve klant-match via de by_email-index op genormaliseerd
 *   e-mailadres (geen ongeïndexeerde full-table scan meer).
 * - Geen dubbele records: bestaat de klant al, dan wordt gekoppeld; anders
 *   wordt het klantrecord uit de lead-gegevens aangemaakt (zónder het
 *   deprecated "lead"-stadium; tenancy = de organisatie van de promoverende
 *   kantoor-gebruiker, zoals klanten.create).
 * - Direct een eerste werkitem (type "project", status "gepland") — de
 *   werkitems-laag uit B1 (convex/werkitems.ts); offerte volgt later vanuit
 *   de wizard met deze klant.
 * - Het lead-record krijgt gekoppeldKlantId + pipelineStatus "gewonnen" en
 *   verdwijnt daarmee van het bord (isGepromoveerdeLead); historie blijft.
 * - `gekozenKlantId`: een door kantoor aangewezen klant (koppelKlant op een
 *   legacy-gewonnen lead zonder koppeling) gaat vóór de e-mail-match; de
 *   aanroeper heeft die klant al op tenancy gecontroleerd.
 */
export async function promoveerLead(
  ctx: GenericMutationCtx<DataModel>,
  lead: Doc<"configuratorAanvragen">,
  currentUser: Doc<"users">,
  orgId: Id<"organisaties">,
  gekozenKlantId?: Id<"klanten">
): Promise<PromotieResultaat> {
  // Idempotentie: promotie is al gebeurd — geen tweede klant/werkitem.
  if (isGepromoveerdeLead(lead) && lead.gekoppeldKlantId) {
    return {
      klantId: lead.gekoppeldKlantId,
      werkitemId: null,
      nieuweKlant: false,
      alGepromoveerd: true,
    };
  }

  const now = Date.now();

  // 1. Bestaande klant zoeken: eerst de al gelegde koppeling, dan de door
  //    kantoor gekozen klant, anders case-insensitief op e-mail via de
  //    by_email-index.
  let klantId =
    lead.gekoppeldKlantId ??
    gekozenKlantId ??
    (await vindKlantVoorLead(ctx, lead, orgId));
  let nieuweKlant = false;

  // 2. Geen match → de lead wórdt de klant (géén "lead"-stadium, zie sanering).
  if (!klantId) {
    klantId = await maakKlantUitLead(ctx, lead, orgId);
    nieuweKlant = true;
  }

  // 3. Direct het eerste werkitem aanmaken (PRD §1.3; conventie werkitems.ts:
  //    createWerkitem — type "project", status "gepland", adres = klantadres).
  const werkitemId = await ctx.db.insert("projecten", {
    orgId,
    type: "project",
    klantId,
    naam: lead.omschrijving?.trim() || `Aanvraag ${lead.referentie}`,
    status: "gepland",
    adres: lead.klantAdres?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  });

  // 4. Lead afronden: gewonnen + koppeling → verdwijnt van het bord, historie blijft.
  await ctx.db.patch(lead._id, {
    pipelineStatus: "gewonnen",
    gekoppeldKlantId: klantId,
    updatedAt: now,
  });

  // 4b. De oorspronkelijke aanvraag (tekst + foto's) naar het dossier —
  //     idempotent, dus een eerder gekoppelde lead krijgt geen dubbele regel.
  await neemAanvraagOverInDossier(ctx, lead, klantId, {
    id: currentUser._id,
    naam: currentUser.name,
  });

  // 5. Activiteitenlog (historie blijft vanaf de klant bereikbaar).
  await ctx.db.insert("leadActiviteiten", {
    leadId: lead._id,
    type: "status_wijziging",
    beschrijving: nieuweKlant
      ? "Lead gewonnen: gepromoveerd naar nieuw klantrecord met eerste werkitem"
      : "Lead gewonnen: gekoppeld aan bestaande klant met eerste werkitem",
    gebruikerId: currentUser._id,
    metadata: {
      gekoppeldKlantId: klantId,
      werkitemId,
      nieuweKlant,
    },
    createdAt: now,
  });

  // 6. Klanttijdlijn (PRD §2.3): promotie zichtbaar in het klantdossier.
  //    Additief, niet-blokkerend (logTijdlijnEvent vangt fouten zelf af).
  await logTijdlijnEvent(ctx, {
    orgId,
    klantId,
    eventType: "lead_gewonnen",
    werkitemId,
    auteurId: currentUser._id,
    auteurNaam: currentUser.name,
    tekst: `Lead ${lead.referentie} gewonnen — gepromoveerd naar ${
      nieuweKlant ? "nieuw klantrecord" : "bestaande klant"
    } met eerste werkitem`,
  });

  return { klantId, werkitemId, nieuweKlant, alGepromoveerd: false };
}

// ─── Aanvraag overnemen in het klantdossier ─────────────────────────────────
//
// Een lead draagt de oorspronkelijke aanvraag (specificaties, bericht, bron)
// en de meegestuurde foto's (`fotoIds`). Zodra de lead een klant wordt of aan
// een klant gekoppeld wordt, hoort dat in het dossier te staan:
//   1. één klantTijdlijn-event "lead_aanvraag", gedateerd op de aanvraagdatum,
//      met de samenvatting als tekst en de foto's als bijlagen;
//   2. per foto een klantBestanden-rij met bron "lead" (verwijzing naar
//      hetzelfde storage-object — geen kopie, geen storage.delete vanuit het
//      dossier).
// De lead zelf wordt hier nooit gemuteerd. Beide stappen zijn idempotent
// (sleutels: klantTijdlijn.bronLeadId, klantBestanden.storageId per klant),
// zodat de backfill-migratie en de conversiepaden elkaar niet bijten.

export type AanvraagOvernamePlan = {
  eventNodig: boolean;
  ontbrekendeFotoIds: Id<"_storage">[];
};

export type AanvraagOvernameResultaat = {
  eventToegevoegd: boolean;
  fotosToegevoegd: number;
  /** Waarom er niets gebeurde (klant weg / andere organisatie). */
  overgeslagen?: "klant_weg" | "andere_org";
};

export type AanvraagAuteur = { id: Id<"users">; naam: string };

type LeesCtx = { db: GenericMutationCtx<DataModel>["db"] };

/** Alleen lezen: wat ontbreekt er nog in het dossier voor deze lead? */
export async function bepaalAanvraagOvername(
  ctx: LeesCtx,
  lead: Doc<"configuratorAanvragen">,
  klantId: Id<"klanten">
): Promise<AanvraagOvernamePlan> {
  const bestaandEvent = await ctx.db
    .query("klantTijdlijn")
    .withIndex("by_bron_lead", (q) => q.eq("bronLeadId", lead._id))
    .first();

  const fotoIds = lead.fotoIds ?? [];
  let ontbrekendeFotoIds: Id<"_storage">[] = [];
  if (fotoIds.length > 0) {
    const bestanden = await ctx.db
      .query("klantBestanden")
      .withIndex("by_klant", (q) => q.eq("orgId", lead.orgId).eq("klantId", klantId))
      .collect();
    const aanwezig = new Set(
      bestanden.map((b) => b.storageId?.toString()).filter(Boolean)
    );
    ontbrekendeFotoIds = fotoIds.filter((id) => !aanwezig.has(id.toString()));
  }

  return { eventNodig: !bestaandEvent, ontbrekendeFotoIds };
}

/** Schrijven volgens het plan. Auteur ontbreekt bij de migratie ("Systeem"). */
export async function voerAanvraagOvernameUit(
  ctx: GenericMutationCtx<DataModel>,
  lead: Doc<"configuratorAanvragen">,
  klantId: Id<"klanten">,
  plan: AanvraagOvernamePlan,
  auteur?: AanvraagAuteur
): Promise<AanvraagOvernameResultaat> {
  let eventToegevoegd = false;
  if (plan.eventNodig) {
    const eventId = await logTijdlijnEvent(ctx, {
      orgId: lead.orgId,
      klantId,
      eventType: "lead_aanvraag",
      kanaal: "systeem",
      timestamp: lead.createdAt,
      auteurId: auteur?.id,
      auteurNaam: auteur?.naam,
      tekst: aanvraagTekst(lead),
      bijlagen: lead.fotoIds && lead.fotoIds.length > 0 ? lead.fotoIds : undefined,
      bronLeadId: lead._id,
    });
    eventToegevoegd = eventId !== null;
  }

  for (const storageId of plan.ontbrekendeFotoIds) {
    await ctx.db.insert("klantBestanden", {
      orgId: lead.orgId,
      klantId,
      soort: "foto",
      titel: `Foto bij aanvraag ${lead.referentie}`,
      storageId,
      bron: "lead",
      leadId: lead._id,
      geuploadDoorId: auteur?.id,
      timestamp: lead.createdAt,
    });
  }

  return { eventToegevoegd, fotosToegevoegd: plan.ontbrekendeFotoIds.length };
}

/**
 * Bepalen + uitvoeren in één stap, voor de conversiepaden. Weigert stil (met
 * console.warn) als de klant niet bestaat of bij een andere organisatie hoort:
 * de koppeling zelf is dan al door de aanroeper afgevangen, en een dossier van
 * een andere org mag nooit aanvraagdata van deze lead krijgen.
 */
export async function neemAanvraagOverInDossier(
  ctx: GenericMutationCtx<DataModel>,
  lead: Doc<"configuratorAanvragen">,
  klantId: Id<"klanten">,
  auteur?: AanvraagAuteur
): Promise<AanvraagOvernameResultaat> {
  const klant = await ctx.db.get(klantId);
  if (!klant) {
    console.warn("[leads] aanvraag-overname overgeslagen: klant bestaat niet");
    return { eventToegevoegd: false, fotosToegevoegd: 0, overgeslagen: "klant_weg" };
  }
  if (klant.orgId?.toString() !== lead.orgId.toString()) {
    console.warn("[leads] aanvraag-overname overgeslagen: klant van andere organisatie");
    return { eventToegevoegd: false, fotosToegevoegd: 0, overgeslagen: "andere_org" };
  }
  const plan = await bepaalAanvraagOvername(ctx, lead, klantId);
  if (!plan.eventNodig && plan.ontbrekendeFotoIds.length === 0) {
    return { eventToegevoegd: false, fotosToegevoegd: 0 };
  }
  return voerAanvraagOvernameUit(ctx, lead, klantId, plan, auteur);
}
