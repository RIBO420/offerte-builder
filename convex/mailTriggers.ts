/**
 * Transactionele mail-triggers (PRD §2.7).
 *
 * Eén tabel `mailTriggers`: event → sjabloon → vertraging → ontvanger.
 * Nieuwe mails toevoegen = record toevoegen, geen code (principe 2).
 *
 * KANTOOR↔KLANT-REGEL (§1.2): mails naar klanten gaan NOOIT volautomatisch.
 * - modus "concept" (default): het event zet een mail klaar in de
 *   goedkeurings-wachtrij (tabel conceptMails); kantoor bewerkt, keurt goed
 *   (assertKanNaarKlantVersturen) en verstuurt, of verwerpt.
 * - modus "automatisch": alleen voor onpersoonlijke bevestigingen (zoals de
 *   lead-ontvangstbevestiging). Ook dit pad loopt ALTIJD door de mail-guard
 *   (EMAIL_VERZENDEN_ACTIEF, fail-closed) in conceptMails.verstuurConceptMail.
 *
 * Beheer (CRUD + seed) is kantoor-only via requireKantoor, patroon van
 * tekstblokken.ts. Sjablonen zijn platte tekst met {{variabelen}}
 * (principe 3: huisstijl zit in de layout, zie lib/mailRender.ts).
 */

import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { normalizeRole, requireKantoor } from "./roles";
import { renderTemplateString } from "./lib/mailRender";

// ─── Domeinconstanten (gedeeld met UI en tests) ──────────────────────────────

const DAG_MS = 24 * 60 * 60 * 1000;

export const MAIL_EVENTS = [
  "lead_ontvangen",
  "offerte_verzonden",
  "inplanning_bevestigd",
  "offerte_opvolging",
  "inplan_attendering",
  // Debiteurenladder (PRD §3.2, fase 2): één event per ladder-trede die
  // mailt. Sjabloon/modus per trede instelbaar via het trigger-record.
  "betalingsherinnering_1",
  "betalingsherinnering_2",
  "betalingsherinnering_3",
  "betalingsherinnering_4",
  // Klantenportaal (PRD §3.1, fase 2): ontvangstbevestiging van een melding
  // die de klant via het portaal indient. Onpersoonlijke bevestiging —
  // default "automatisch", altijd achter de mail-guard (fail-closed).
  "melding_ontvangen",
] as const;

export type MailEvent = (typeof MAIL_EVENTS)[number];

export const MAIL_EVENT_LABELS: Record<MailEvent, string> = {
  lead_ontvangen: "Lead ontvangen (website)",
  offerte_verzonden: "Offerte verzonden",
  inplanning_bevestigd: "Inplanning bevestigd",
  offerte_opvolging: "Offerte-opvolging",
  inplan_attendering: "Inplan-mail (planningsattendering)",
  betalingsherinnering_1: "Betalingsherinnering (ladder trede 1)",
  betalingsherinnering_2: "Tweede betalingsherinnering (ladder trede 2)",
  betalingsherinnering_3: "Aanmaning (ladder trede 3)",
  betalingsherinnering_4: "Laatste aanmaning (ladder trede 4)",
  melding_ontvangen: "Melding ontvangen (portaal)",
};

/** Mail-event dat bij een ladder-trede hoort (debiteurenladder, §3.2). */
export function mailEventVoorTrede(trede: number): MailEvent {
  return `betalingsherinnering_${Math.min(
    Math.max(trede, 1),
    4
  )}` as MailEvent;
}

export interface MailTriggerSeed {
  event: MailEvent;
  naam: string;
  omschrijving: string;
  onderwerp: string;
  inhoud: string;
  variabelen: string[];
  vertragingDagen: number;
  ontvanger: "klant" | "lead" | "custom";
  modus: "concept" | "automatisch";
  actief: boolean;
}

/**
 * Seed-standaardtriggers voor de vijf fase 1-events. Neutrale NL-teksten;
 * de HERO-standaardteksten komen later als startvulling (§2.7).
 *
 * Alle events staan op modus "concept" BEHALVE lead_ontvangen: dat is een
 * onpersoonlijke, directe ontvangstbevestiging ("aanvraag ontvangen, binnen
 * X uur reactie") zonder inhoudelijke toezegging — daarom als redelijke
 * default "automatisch". Ook dat pad blijft achter de mail-guard én kantoor
 * kan het hier op "concept" of inactief zetten (record, geen code).
 */
export const MAIL_TRIGGER_DEFAULTS: MailTriggerSeed[] = [
  {
    event: "lead_ontvangen",
    naam: "Ontvangstbevestiging aanvraag",
    omschrijving:
      "Automatische ontvangstbevestiging bij een nieuwe aanvraag via de website (configurator of contactformulier). Onpersoonlijke bevestiging — daarom default 'automatisch'; verzending blijft achter de mail-guard.",
    onderwerp: "Wij hebben uw aanvraag ontvangen — {{referentie}}",
    inhoud:
      "Beste {{naam}},\n\nBedankt voor uw aanvraag bij {{bedrijfsnaam}}. Wij hebben uw aanvraag in goede orde ontvangen en nemen binnen 24 uur contact met u op.\n\nUw referentienummer is {{referentie}}. Houd dit nummer bij de hand als u contact met ons opneemt.",
    variabelen: ["naam", "referentie", "bedrijfsnaam"],
    vertragingDagen: 0,
    ontvanger: "lead",
    modus: "automatisch",
    actief: true,
  },
  {
    event: "offerte_verzonden",
    naam: "Begeleidende mail bij offerte",
    omschrijving:
      "Wordt klaargezet zodra een offerte op 'verzonden' gaat. Voor klanten mét portaaltoegang verstuurt het bestaande portaal-pad al een notificatie — dan wordt er GEEN concept klaargezet (geen dubbele mail).",
    onderwerp: "Uw offerte {{offerteNummer}} van {{bedrijfsnaam}}",
    inhoud:
      "Beste {{klantnaam}},\n\nHartelijk dank voor uw interesse. Uw offerte {{offerteNummer}} ({{offerteBedrag}}) staat voor u klaar via onderstaande link:\n\n{{offerteLink}}\n\nHeeft u vragen over de offerte? Neem gerust contact met ons op — we lichten hem graag toe.",
    variabelen: [
      "klantnaam",
      "offerteNummer",
      "offerteBedrag",
      "offerteLink",
      "bedrijfsnaam",
    ],
    vertragingDagen: 0,
    ontvanger: "klant",
    modus: "concept",
    actief: true,
  },
  {
    event: "inplanning_bevestigd",
    naam: "Bevestiging inplanning",
    omschrijving:
      "Optioneel PER KLANT (veld 'inplanningsmail' op de klant, default uit): bij het inplannen van een werkitem wordt een concept-bevestiging klaargezet.",
    onderwerp: "Bevestiging: {{werkitemNaam}} ingepland op {{geplandeDatum}}",
    inhoud:
      "Beste {{klantnaam}},\n\nHierbij bevestigen wij dat {{werkitemNaam}} is ingepland op {{geplandeDatum}}{{teamTekst}}.\n\nMocht deze datum onverhoopt niet uitkomen, laat het ons dan tijdig weten, dan zoeken we samen naar een passend alternatief.",
    variabelen: [
      "klantnaam",
      "werkitemNaam",
      "geplandeDatum",
      "teamTekst",
      "bedrijfsnaam",
    ],
    vertragingDagen: 0,
    ontvanger: "klant",
    modus: "concept",
    actief: true,
  },
  {
    event: "offerte_opvolging",
    naam: "Opvolging verzonden offerte",
    omschrijving:
      "Opvolgmail als een offerte na Y dagen nog geen reactie heeft. Het RITME (dag 3/7/14, annulering bij reactie) leeft in de bestaande offerte-opvolging (offerte_reminders) — het veld 'vertraging' wordt voor dit event daarom niet gebruikt. Deze trigger bepaalt wél de modus: 'concept' zet de opvolgmail in de wachtrij; 'automatisch' verstuurt via het bestaande herinnerings-pad (achter de mail-guard); inactief = alleen interne notificatie, geen klant-mail.",
    onderwerp: "Heeft u onze offerte {{offerteNummer}} nog kunnen bekijken?",
    inhoud:
      "Beste {{klantnaam}},\n\nEen tijdje geleden stuurden wij u offerte {{offerteNummer}} ({{offerteBedrag}}). Wij zijn benieuwd of u deze heeft kunnen bekijken en of er nog vragen zijn.\n\nU vindt de offerte via onderstaande link:\n\n{{offerteLink}}\n\nWe horen graag van u.",
    variabelen: [
      "klantnaam",
      "offerteNummer",
      "offerteBedrag",
      "offerteLink",
      "bedrijfsnaam",
    ],
    vertragingDagen: 0,
    ontvanger: "klant",
    modus: "concept",
    actief: true,
  },
  {
    event: "inplan_attendering",
    naam: "Inplan-mail onderhoudsbeurt",
    omschrijving:
      "Vanuit een plantaak op het meldingen-bord zet kantoor met één klik deze mail als concept klaar: bevestiging vragen + voorstel voor een periode (PRD §2.1/§2.7).",
    onderwerp: "Het is weer tijd voor uw {{beurtnaam}}",
    inhoud:
      "Beste {{klantnaam}},\n\nHet seizoen komt eraan: het is weer tijd voor uw {{beurtnaam}}. Wij willen deze graag inplannen in de periode {{venster}}.\n\nSchikt deze periode u? Laat het ons weten, dan plannen wij de beurt voor u in. Komt de periode niet uit, dan zoeken we samen naar een beter moment.",
    variabelen: ["klantnaam", "beurtnaam", "venster", "bedrijfsnaam"],
    vertragingDagen: 0,
    ontvanger: "klant",
    modus: "concept",
    actief: true,
  },
  // ── Debiteurenladder (PRD §3.2, fase 2) ────────────────────────────────
  // De dagelijkse ladder-cron (convex/debiteuren.ts) zet deze mails als
  // CONCEPT in de wachtrij (kantoor keurt goed). Kantoor kan een trede op
  // "automatisch" zetten — ook dan blijft de mail-guard fail-closed.
  // Het RITME (dag 14/21/28) leeft in de ladder-instellingen, niet in het
  // veld 'vertraging'; dat wordt voor deze events niet gebruikt.
  {
    event: "betalingsherinnering_1",
    naam: "Betalingsherinnering",
    omschrijving:
      "Ladder trede 1 (default dag 14 na verzending): vriendelijke herinnering aan een openstaande factuur. Wordt door de dagelijkse debiteuren-cron als concept klaargezet.",
    onderwerp: "Herinnering: factuur {{factuurnummer}} staat nog open",
    inhoud:
      "Beste {{klantnaam}},\n\nVolgens onze administratie staat factuur {{factuurnummer}} van {{factuurbedrag}} (vervaldatum {{vervaldatum}}) nog open.\n\nWellicht is de betaling aan uw aandacht ontsnapt. Wij verzoeken u vriendelijk het openstaande bedrag van {{openstaandBedrag}} alsnog over te maken.\n\nHeeft u de factuur inmiddels betaald, dan kunt u deze herinnering als niet verzonden beschouwen.",
    variabelen: [
      "klantnaam",
      "factuurnummer",
      "factuurbedrag",
      "openstaandBedrag",
      "vervaldatum",
      "bedrijfsnaam",
    ],
    vertragingDagen: 0,
    ontvanger: "klant",
    modus: "concept",
    actief: true,
  },
  {
    event: "betalingsherinnering_2",
    naam: "Tweede betalingsherinnering",
    omschrijving:
      "Ladder trede 2 (default dag 21 na verzending): tweede herinnering met een duidelijker verzoek. Wordt door de dagelijkse debiteuren-cron als concept klaargezet.",
    onderwerp:
      "Tweede herinnering: factuur {{factuurnummer}} staat nog open",
    inhoud:
      "Beste {{klantnaam}},\n\nOndanks onze eerdere herinnering staat factuur {{factuurnummer}} van {{factuurbedrag}} (vervaldatum {{vervaldatum}}) nog open.\n\nWij verzoeken u het openstaande bedrag van {{openstaandBedrag}} binnen 7 dagen over te maken.\n\nIs er een reden waarom de betaling uitblijft? Neem dan contact met ons op, dan zoeken we samen naar een oplossing.",
    variabelen: [
      "klantnaam",
      "factuurnummer",
      "factuurbedrag",
      "openstaandBedrag",
      "vervaldatum",
      "bedrijfsnaam",
    ],
    vertragingDagen: 0,
    ontvanger: "klant",
    modus: "concept",
    actief: true,
  },
  {
    event: "betalingsherinnering_3",
    naam: "Aanmaning",
    omschrijving:
      "Ladder trede 3 als kantoor die op 'mail' zet (default is een interne bel-taak): formele aanmaning. Wordt door de dagelijkse debiteuren-cron als concept klaargezet.",
    onderwerp: "Aanmaning: factuur {{factuurnummer}}",
    inhoud:
      "Beste {{klantnaam}},\n\nHelaas hebben wij nog geen betaling ontvangen voor factuur {{factuurnummer}} van {{factuurbedrag}} (vervaldatum {{vervaldatum}}), ondanks eerdere herinneringen.\n\nWij verzoeken u dringend het openstaande bedrag van {{openstaandBedrag}} per omgaande over te maken.\n\nNeem bij vragen of een betalingsregeling direct contact met ons op.",
    variabelen: [
      "klantnaam",
      "factuurnummer",
      "factuurbedrag",
      "openstaandBedrag",
      "vervaldatum",
      "bedrijfsnaam",
    ],
    vertragingDagen: 0,
    ontvanger: "klant",
    modus: "concept",
    actief: true,
  },
  {
    event: "betalingsherinnering_4",
    naam: "Laatste aanmaning",
    omschrijving:
      "Ladder trede 4 (optioneel): laatste aanmaning vóór verdere stappen. Wordt door de dagelijkse debiteuren-cron als concept klaargezet.",
    onderwerp: "Laatste aanmaning: factuur {{factuurnummer}}",
    inhoud:
      "Beste {{klantnaam}},\n\nDit is onze laatste aanmaning voor factuur {{factuurnummer}} van {{factuurbedrag}} (vervaldatum {{vervaldatum}}).\n\nWij verzoeken u het openstaande bedrag van {{openstaandBedrag}} binnen 5 dagen over te maken. Blijft betaling uit, dan zien wij ons genoodzaakt verdere stappen te ondernemen.\n\nNeem bij vragen of een betalingsregeling direct contact met ons op.",
    variabelen: [
      "klantnaam",
      "factuurnummer",
      "factuurbedrag",
      "openstaandBedrag",
      "vervaldatum",
      "bedrijfsnaam",
    ],
    vertragingDagen: 0,
    ontvanger: "klant",
    modus: "concept",
    actief: true,
  },
  // ── Klantenportaal (PRD §3.1, fase 2) ──────────────────────────────────
  {
    event: "melding_ontvangen",
    naam: "Ontvangstbevestiging melding (portaal)",
    omschrijving:
      "Automatische ontvangstbevestiging wanneer een klant via het portaal een melding indient (serviceverzoek of klacht). Onpersoonlijke bevestiging zonder inhoudelijke toezegging — daarom default 'automatisch'; verzending blijft altijd achter de mail-guard.",
    onderwerp: "Wij hebben uw {{meldingType}} ontvangen",
    inhoud:
      "Beste {{klantnaam}},\n\nBedankt voor uw bericht. Wij hebben uw {{meldingType}} in goede orde ontvangen:\n\n“{{omschrijvingKort}}”\n\nWij bekijken uw melding zo snel mogelijk en nemen contact met u op. De status van uw melding kunt u volgen in het klantenportaal.",
    variabelen: ["klantnaam", "meldingType", "omschrijvingKort", "bedrijfsnaam"],
    vertragingDagen: 0,
    ontvanger: "klant",
    modus: "automatisch",
    actief: true,
  },
];

// ─── Pure validatie (unit-testbaar zonder ctx) ───────────────────────────────

export interface MailTriggerInvoer {
  onderwerp?: string;
  inhoud?: string;
  vertragingDagen?: number;
  modus?: string;
  customEmail?: string;
  ontvanger?: string;
}

export function valideerMailTrigger(invoer: MailTriggerInvoer): void {
  if (invoer.onderwerp !== undefined && invoer.onderwerp.trim().length === 0) {
    throw new ConvexError("Onderwerp is verplicht");
  }
  if (invoer.inhoud !== undefined && invoer.inhoud.trim().length === 0) {
    throw new ConvexError("Inhoud is verplicht");
  }
  if (
    invoer.vertragingDagen !== undefined &&
    (invoer.vertragingDagen < 0 || !Number.isInteger(invoer.vertragingDagen))
  ) {
    throw new ConvexError("Vertraging moet een geheel aantal dagen (≥ 0) zijn");
  }
  if (
    invoer.modus !== undefined &&
    invoer.modus !== "concept" &&
    invoer.modus !== "automatisch"
  ) {
    throw new ConvexError("Onbekende modus");
  }
  if (
    invoer.ontvanger === "custom" &&
    (!invoer.customEmail || !invoer.customEmail.includes("@"))
  ) {
    throw new ConvexError(
      "Bij ontvanger 'custom' is een geldig e-mailadres verplicht"
    );
  }
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Beheerlijst: alle triggers (ook inactieve), kantoor-only. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireKantoor(ctx);
    const triggers = await ctx.db.query("mailTriggers").collect();
    return triggers.sort((a, b) => a.event.localeCompare(b.event));
  },
});

// ─── Mutations (kantoor-only) ────────────────────────────────────────────────

/**
 * Seed de vijf fase 1-triggers. Idempotent: bestaande events worden
 * overgeslagen (sleutel = event), er wordt niets overschreven.
 */
export const seedDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    await requireKantoor(ctx);
    const now = Date.now();
    let aangemaakt = 0;

    for (const seed of MAIL_TRIGGER_DEFAULTS) {
      const bestaande = await ctx.db
        .query("mailTriggers")
        .withIndex("by_event", (q) => q.eq("event", seed.event))
        .first();
      if (bestaande) continue;

      await ctx.db.insert("mailTriggers", {
        event: seed.event,
        naam: seed.naam,
        omschrijving: seed.omschrijving,
        onderwerp: seed.onderwerp,
        inhoud: seed.inhoud,
        variabelen: seed.variabelen,
        vertragingDagen: seed.vertragingDagen,
        ontvanger: seed.ontvanger,
        modus: seed.modus,
        actief: seed.actief,
        createdAt: now,
        updatedAt: now,
      });
      aangemaakt++;
    }

    return { aangemaakt, totaal: MAIL_TRIGGER_DEFAULTS.length };
  },
});

/**
 * Trigger bijwerken: aan/uit, modus, vertraging, ontvanger en sjabloon
 * (onderwerp/inhoud/tekstblokken). Het event zelf is de sleutel en wijzigt
 * niet.
 */
export const update = mutation({
  args: {
    id: v.id("mailTriggers"),
    naam: v.optional(v.string()),
    omschrijving: v.optional(v.string()),
    onderwerp: v.optional(v.string()),
    inhoud: v.optional(v.string()),
    tekstblokIds: v.optional(v.array(v.id("tekstblokken"))),
    vertragingDagen: v.optional(v.number()),
    ontvanger: v.optional(
      v.union(v.literal("klant"), v.literal("lead"), v.literal("custom"))
    ),
    customEmail: v.optional(v.string()),
    modus: v.optional(v.union(v.literal("concept"), v.literal("automatisch"))),
    actief: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const trigger = await ctx.db.get(args.id);
    if (!trigger) {
      throw new ConvexError("Mail-trigger niet gevonden");
    }

    valideerMailTrigger({
      onderwerp: args.onderwerp,
      inhoud: args.inhoud,
      vertragingDagen: args.vertragingDagen,
      modus: args.modus,
      ontvanger: args.ontvanger ?? trigger.ontvanger,
      customEmail: args.customEmail ?? trigger.customEmail,
    });

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [sleutel, waarde] of Object.entries(args)) {
      if (sleutel === "id" || waarde === undefined) continue;
      patch[sleutel] = waarde;
    }
    await ctx.db.patch(args.id, patch);
    return args.id;
  },
});

// ─── Trigger-motor (aangeroepen vanuit event-hooks) ──────────────────────────

/**
 * Bedrijfseigenaar (multi-tenant scope) voor events zonder ingelogde
 * gebruiker (website-leads). Zelfde conventie als planningsattendering:
 * de directie-gebruiker is de bedrijfseigenaar.
 */
export async function vindBedrijfseigenaarId(
  ctx: MutationCtx
): Promise<Id<"users"> | null> {
  const users = await ctx.db.query("users").collect();
  const eigenaar = users.find((u) => normalizeRole(u.role) === "directie");
  return eigenaar?._id ?? null;
}

export interface TriggerMailArgs {
  event: string;
  /** Bedrijfseigenaar (multi-tenant scope) */
  userId: Id<"users">;
  ontvangerEmail: string;
  ontvangerNaam: string;
  variabelen: Record<string, string>;
  klantId?: Id<"klanten">;
  leadId?: Id<"configuratorAanvragen">;
  offerteId?: Id<"offertes">;
  werkitemId?: Id<"projecten">;
  meldingId?: Id<"servicemeldingen">;
  /** Idempotentie: zelfde sleutel = geen tweede mail */
  dedupeSleutel?: string;
  /**
   * §1.2-slot: forceer de concept-wachtrij ongeacht de trigger-modus
   * (gebruikt voor persoonlijke mails zoals de inplan-mail).
   */
  forceerConcept?: boolean;
}

export type TriggerMailResultaat =
  | { aangemaakt: true; conceptMailId: Id<"conceptMails"> }
  | {
      aangemaakt: false;
      reden: "geen_trigger" | "trigger_inactief" | "duplicaat" | "geen_email";
    };

/**
 * DE enige ingang van het trigger-model: zet voor een event een mail klaar.
 *
 * - Geen actieve trigger voor het event → niets (record uit = mail uit).
 * - dedupeSleutel al gebruikt → niets (idempotent, geen dubbele mails).
 * - vertragingDagen > 0 → status "gepland"; de dagelijkse cron
 *   (conceptMails.verwerkGeplandeMails) zet hem t.z.t. in de wachtrij.
 * - modus "concept" → status "wachtrij": kantoor keurt goed en verstuurt.
 * - modus "automatisch" (en geen vertraging) → verzend-actie wordt direct
 *   ingepland; die actie loopt ALTIJD door de mail-guard (fail-closed).
 *
 * VERSTUURT ZELF NOOIT — verzenden gebeurt uitsluitend in
 * conceptMails.verstuurConceptMail (achter isEmailVerzendenActief).
 */
export async function zetTriggerMailKlaar(
  ctx: MutationCtx,
  args: TriggerMailArgs
): Promise<TriggerMailResultaat> {
  const trigger = (await ctx.db
    .query("mailTriggers")
    .withIndex("by_event", (q) => q.eq("event", args.event))
    .first()) as Doc<"mailTriggers"> | null;

  if (!trigger) return { aangemaakt: false, reden: "geen_trigger" };
  if (!trigger.actief) return { aangemaakt: false, reden: "trigger_inactief" };

  // Ontvanger "custom": vast adres uit de trigger-configuratie
  const ontvangerEmail =
    trigger.ontvanger === "custom" && trigger.customEmail
      ? trigger.customEmail
      : args.ontvangerEmail;
  if (!ontvangerEmail || !ontvangerEmail.includes("@")) {
    return { aangemaakt: false, reden: "geen_email" };
  }

  // Idempotentie: geen tweede mail voor hetzelfde bronrecord
  if (args.dedupeSleutel) {
    const bestaande = await ctx.db
      .query("conceptMails")
      .withIndex("by_dedupe", (q) => q.eq("dedupeSleutel", args.dedupeSleutel))
      .first();
    if (bestaande) return { aangemaakt: false, reden: "duplicaat" };
  }

  // {{bedrijfsnaam}} automatisch aanvullen vanuit de instellingen
  const variabelen = { ...args.variabelen };
  if (!variabelen.bedrijfsnaam) {
    const instellingen = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    const bedrijfsgegevens = (instellingen?.bedrijfsgegevens ?? {}) as Record<
      string,
      string
    >;
    variabelen.bedrijfsnaam = bedrijfsgegevens.naam || "Top Tuinen";
  }

  // Sjabloon renderen (platte tekst; huisstijl komt pas bij verzending)
  let inhoud = renderTemplateString(trigger.inhoud, variabelen);
  if (trigger.tekstblokIds && trigger.tekstblokIds.length > 0) {
    for (const blokId of trigger.tekstblokIds) {
      const blok = await ctx.db.get(blokId);
      if (blok && blok.actief) {
        inhoud += `\n\n${renderTemplateString(blok.inhoud, variabelen)}`;
      }
    }
  }
  const onderwerp = renderTemplateString(trigger.onderwerp, variabelen);

  const now = Date.now();
  const geplandOp = now + trigger.vertragingDagen * DAG_MS;
  const modus = args.forceerConcept ? "concept" : trigger.modus;
  const status = trigger.vertragingDagen > 0 ? "gepland" : "wachtrij";

  const conceptMailId = await ctx.db.insert("conceptMails", {
    userId: args.userId,
    event: args.event,
    triggerId: trigger._id,
    klantId: args.klantId,
    leadId: args.leadId,
    offerteId: args.offerteId,
    werkitemId: args.werkitemId,
    meldingId: args.meldingId,
    ontvangerEmail,
    ontvangerNaam: args.ontvangerNaam,
    onderwerp,
    inhoud,
    geplandOp,
    status,
    modus,
    dedupeSleutel: args.dedupeSleutel,
    createdAt: now,
    updatedAt: now,
  });

  // Automatisch-modus zonder vertraging: verzend-actie direct inplannen.
  // De actie zelf zit achter de mail-guard (fail-closed) — zonder
  // EMAIL_VERZENDEN_ACTIEF="true" wordt er alleen gelogd, niets verstuurd.
  if (modus === "automatisch" && status === "wachtrij") {
    await ctx.scheduler.runAfter(
      0,
      internal.conceptMails.verstuurConceptMail,
      { conceptMailId }
    );
  }

  return { aangemaakt: true, conceptMailId };
}
