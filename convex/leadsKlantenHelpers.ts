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
 *   deprecated "lead"-stadium; tenancy conform bestaande conventie:
 *   userId = de kantoor-gebruiker die promoveert, zoals klanten.create).
 * - Direct een eerste werkitem (type "project", status "gepland") — de
 *   werkitems-laag uit B1 (convex/werkitems.ts); offerte volgt later vanuit
 *   de wizard met deze klant.
 * - Het lead-record krijgt gekoppeldKlantId + pipelineStatus "gewonnen" en
 *   verdwijnt daarmee van het bord (isGepromoveerdeLead); historie blijft.
 */
export async function promoveerLead(
  ctx: GenericMutationCtx<DataModel>,
  lead: Doc<"configuratorAanvragen">,
  currentUser: Doc<"users">
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
  const emailGenormaliseerd = normaliseerEmail(lead.klantEmail);

  // 1. Bestaande klant zoeken: eerst de al gelegde koppeling, anders
  //    case-insensitief op e-mail via de by_email-index.
  let klantId = lead.gekoppeldKlantId;
  let nieuweKlant = false;

  if (!klantId && emailGenormaliseerd) {
    const kandidaten = await ctx.db
      .query("klanten")
      .withIndex("by_email", (q) => q.eq("email", emailGenormaliseerd))
      .collect();
    klantId = vindKlantMatch(kandidaten, emailGenormaliseerd)?._id;

    // Legacy-vangnet: rijen die vóór de e-mailnormalisatie zijn aangemaakt
    // kunnen het adres nog met hoofdletters opgeslagen hebben; die staan op
    // een andere index-sleutel. Eén extra indexquery op het ruwe adres dekt
    // dit af tot migrations/saneerLeadsKlanten gedraaid is.
    const ruweEmail = lead.klantEmail?.trim();
    if (!klantId && ruweEmail && ruweEmail !== emailGenormaliseerd) {
      const legacyKandidaten = await ctx.db
        .query("klanten")
        .withIndex("by_email", (q) => q.eq("email", ruweEmail))
        .collect();
      klantId = vindKlantMatch(legacyKandidaten, emailGenormaliseerd)?._id;
    }
  }

  // 2. Geen match → de lead wórdt de klant (géén "lead"-stadium, zie sanering).
  if (!klantId) {
    klantId = await ctx.db.insert("klanten", {
      userId: currentUser._id,
      naam: lead.klantNaam.trim(),
      adres: lead.klantAdres?.trim() ?? "",
      postcode: lead.klantPostcode?.trim() ?? "",
      plaats: lead.klantPlaats?.trim() ?? "",
      email: emailGenormaliseerd,
      telefoon: lead.klantTelefoon?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });
    nieuweKlant = true;
  }

  // 3. Direct het eerste werkitem aanmaken (PRD §1.3; conventie werkitems.ts:
  //    createWerkitem — type "project", status "gepland", adres = klantadres).
  const werkitemId = await ctx.db.insert("projecten", {
    userId: currentUser._id,
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
    userId: currentUser._id,
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
