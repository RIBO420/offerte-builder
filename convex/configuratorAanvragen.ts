import { v, ConvexError } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireOrgContext, requireOrgId, verifyOrgOwnership } from "./auth";
import { requireNotViewer } from "./roles";
import { Doc } from "./_generated/dataModel";
import {
  mapOldStatus,
  isActieveLead,
  isGepromoveerdeLead,
  promoveerLead,
  type LeadPipelineStatus,
} from "./leadsKlantenHelpers";
import { zetTriggerMailKlaar } from "./mailTriggers";
import {
  checkConfiguratorEmailRateLimit,
  checkConfiguratorGlobaalRateLimit,
  checkReferentieLookupRateLimit,
} from "./security";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Audit §3: de configurator is een publiek endpoint zonder ingelogde
 * gebruiker. Bij een overschrijding krijgt de bezoeker een Nederlandse
 * melding met een concrete wachttijd in minuten, plus de mogelijkheid om te
 * bellen — een echte klant die per ongeluk tegen de limiet aanloopt mag geen
 * doodlopende weg krijgen.
 */
function wachttijdInMinuten(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 60000));
}

/**
 * De organisatie waar een PUBLIEKE lead bij hoort.
 *
 * De configurator en het website-contactformulier draaien zonder ingelogde
 * gebruiker: er is geen JWT en dus geen `org_id`-claim, waardoor
 * `requireOrgContext` hier per definitie niet kan werken. Zolang er precies
 * één actieve organisatie is (de huidige single-tenant situatie) is die de
 * enige juiste bestemming, en dat is meteen de veiligste keuze: bij twijfel
 * — nul of meerdere actieve organisaties — laten we `orgId` liever leeg dan
 * dat een lead in de verkeerde tenant belandt. De lead blijft dan bestaan en
 * is via het referentienummer terug te vinden, maar staat niet op een bord.
 *
 * WHITELABEL (later): zodra er meerdere tenants zijn, bepaalt het domein of
 * de slug van de configurator-pagina de organisatie en wordt die als
 * argument meegegeven in plaats van hier afgeleid.
 */
async function orgVoorPubliekeIntake(
  ctx: MutationCtx
): Promise<Id<"organisaties">> {
  const actieve = (await ctx.db.query("organisaties").collect()).filter(
    (o) => o.actief
  );
  if (actieve.length === 1) return actieve[0]._id;

  // Fail-closed: een lead zonder tenant hoort bij niemand en zou op geen enkel
  // leadbord verschijnen. Liever een nette fout naar de bezoeker dan een
  // aanvraag die stilletjes in het niets valt.
  console.warn(
    `[configuratorAanvragen] publieke lead zonder organisatie: ${actieve.length} actieve organisaties gevonden (verwacht: 1)`
  );
  throw new ConvexError(
    "Aanvraag kan op dit moment niet verwerkt worden. Neem telefonisch contact op."
  );
}

/**
 * Belt & braces bovenop de by_org-indexquery: de tenant-scope van het
 * leads-bord mag nooit alleen van de gekozen index afhangen — zelfde principe
 * als `filterEntries` in convex/tijdlijn.ts. Leads zonder organisatie (publieke
 * instroom die geen tenant kon bepalen) horen bij niemand en vallen hier weg.
 */
function vanEigenOrg<T extends { orgId?: Id<"organisaties"> }>(
  docs: T[],
  orgId: Id<"organisaties">
): T[] {
  return docs.filter((d) => d.orgId?.toString() === orgId.toString());
}

/**
 * §2.7 (event lead_ontvangen): ontvangstbevestiging voor een nieuwe
 * website-lead klaarzetten via het trigger-model. Publieke instroom heeft
 * geen ingelogde gebruiker — de bedrijfseigenaar (directie) is de scope,
 * zelfde conventie als de planningsattendering. Default-modus van deze
 * trigger is "automatisch" (onpersoonlijke bevestiging), maar ook dan
 * verstuurt uitsluitend conceptMails.verstuurConceptMail — achter de
 * mail-guard (EMAIL_VERZENDEN_ACTIEF, fail-closed).
 */
async function zetLeadOntvangstbevestigingKlaar(
  ctx: MutationCtx,
  lead: {
    leadId: Id<"configuratorAanvragen">;
    naam: string;
    email: string;
    referentie: string;
    /**
     * Identity-loze instroom moet de tenant expliciet meegeven: zonder sessie
     * kan `zetTriggerMailKlaar` de organisatie niet uit een JWT halen en zet
     * hij (fail-safe) geen mail klaar.
     */
    orgId: Id<"organisaties"> | undefined;
  }
): Promise<void> {
  await zetTriggerMailKlaar(ctx, {
    event: "lead_ontvangen",
    orgId: lead.orgId,
    ontvangerEmail: lead.email,
    ontvangerNaam: lead.naam,
    variabelen: {
      naam: lead.naam,
      referentie: lead.referentie,
    },
    leadId: lead.leadId,
    dedupeSleutel: `lead_ontvangen:${lead.leadId.toString()}`,
  });
}

// ============================================
// Queries
// ============================================

/**
 * Haal alle aanvragen op (authenticated, voor admin).
 * Gesorteerd op aanmaakdatum aflopend.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await requireOrgId(ctx);
    const aanvragen = await ctx.db
      .query("configuratorAanvragen")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .collect();
    // Gearchiveerde leads niet tonen (§5.2)
    return vanEigenOrg(aanvragen, orgId).filter((a) => !a.isArchived);
  },
});

/**
 * Haal aanvragen op gefilterd op status (authenticated, voor admin).
 */
export const listByStatus = query({
  args: {
    status: v.union(
      v.literal("nieuw"),
      v.literal("in_behandeling"),
      v.literal("goedgekeurd"),
      v.literal("afgekeurd"),
      v.literal("voltooid")
    ),
  },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    const aanvragen = await ctx.db
      .query("configuratorAanvragen")
      .withIndex("by_org_status", (q) =>
        q.eq("orgId", orgId).eq("status", args.status)
      )
      .order("desc")
      .collect();
    // Gearchiveerde leads niet tonen (§5.2)
    return vanEigenOrg(aanvragen, orgId).filter((a) => !a.isArchived);
  },
});

/**
 * Haal een enkele aanvraag op via ID (authenticated).
 */
export const getById = query({
  args: { id: v.id("configuratorAanvragen") },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    const lead = await ctx.db.get(args.id);
    // Een lead van een andere organisatie is niet te onderscheiden van een
    // lead die niet bestaat.
    if (!lead || lead.orgId?.toString() !== orgId.toString()) return null;
    return lead;
  },
});

/**
 * Zoek een aanvraag op referentienummer (public, voor klant).
 * Klanten kunnen hun eigen aanvraag opzoeken zonder in te loggen.
 *
 * Audit §3: zonder rem kan iemand hier ongelimiteerd naar referenties raden
 * (`CFG-YYYYMMDD-XXXX` heeft maar 10.000 varianten per dag). De globale
 * limiet maakt dat onbegonnen werk zonder de statuspagina te hinderen.
 *
 * Dat de query-cache van Convex herhaalde opvragingen van dezelfde referentie
 * kan afvangen werkt hier in ons voordeel: de klant die zijn eigen status
 * bekijkt verbruikt nauwelijks quotum, terwijl een enumerator per poging een
 * nieuwe referentie gebruikt en dus altijd door deze teller heen moet.
 *
 * LET OP twee eigenschappen van deze constructie: de teller staat in het
 * geheugen van één isolate (bij meerdere isolates ligt de effectieve limiet
 * hoger) en het bijwerken ervan is een side effect in een gecachete query, dus
 * het verbruik is niet exact. Het is een rem tegen enumeratie, geen quotum.
 */
export const getByReferentie = query({
  args: { referentie: v.string() },
  handler: async (ctx, args) => {
    const rateLimit = checkReferentieLookupRateLimit();
    if (!rateLimit.allowed) {
      // Bewust `null` en geen throw. Dit is een live subscription op een
      // publieke pagina: een ConvexError bubbelt langs de statuspagina naar de
      // error-boundary en blijft gooien tot de bezoeker herlaadt. `null` valt
      // in het bestaande "aanvraag niet gevonden"-pad, dus de pagina blijft
      // heel — en een enumerator krijgt precies dezelfde uitkomst als bij een
      // niet-bestaande referentie, wat het orakel juist verder dichtzet.
      return null;
    }

    return await ctx.db
      .query("configuratorAanvragen")
      .withIndex("by_referentie", (q) => q.eq("referentie", args.referentie))
      .unique();
  },
});

/**
 * Haal het aantal aanvragen per status op (authenticated, voor badges in navigatie).
 */
export const countByStatus = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await requireOrgId(ctx);
    // Use by_org_status index to fetch only this org's "nieuw" records instead
    // of a full table scan. Also check pipelineStatus for records where status
    // differs from pipeline status.
    const nieuwByStatus = await ctx.db
      .query("configuratorAanvragen")
      .withIndex("by_org_status", (q) =>
        q.eq("orgId", orgId).eq("status", "nieuw")
      )
      .collect();
    // Count records where the effective status (pipelineStatus ?? status) is "nieuw"
    return vanEigenOrg(nieuwByStatus, orgId).filter((a) => {
      if (a.isArchived) return false;
      const effectiveStatus = a.pipelineStatus ?? a.status;
      return effectiveStatus === "nieuw";
    }).length;
  },
});

/**
 * Teller-badge voor het menu-item "Leads" (PRD §1.3/§5.1): het aantal leads
 * dat actief in de funnel zit (nieuw/contact_gehad/offerte_verstuurd).
 * Gearchiveerde, gewonnen (gepromoveerde) en verloren leads tellen niet mee —
 * dit lost het verwarrende "45" op dat eerder op "Klanten" stond.
 */
export const countActieveLeads = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await requireOrgId(ctx);
    const aanvragen = await ctx.db
      .query("configuratorAanvragen")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return vanEigenOrg(aanvragen, orgId).filter(isActieveLead).length;
  },
});

/**
 * Haal leads op die geschikt zijn voor selectie in de offerte wizard.
 * Toont leads met pipelineStatus "nieuw" of "contact_gehad" (die nog geen offerte hebben).
 */
export const listForOfferteSelector = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await requireOrgId(ctx);
    const allLeads = await ctx.db
      .query("configuratorAanvragen")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .collect();

    return vanEigenOrg(allLeads, orgId)
      .filter((lead) => {
        if (lead.isArchived) return false;
        const pipelineStatus = lead.pipelineStatus ?? lead.status;
        return pipelineStatus === "nieuw" || pipelineStatus === "contact_gehad";
      })
      .map((lead) => ({
        _id: lead._id,
        klantNaam: lead.klantNaam,
        klantEmail: lead.klantEmail,
        klantTelefoon: lead.klantTelefoon,
        klantAdres: lead.klantAdres,
        klantPostcode: lead.klantPostcode,
        klantHuisnummer: lead.klantHuisnummer,
        klantPlaats: lead.klantPlaats,
        referentie: lead.referentie,
        type: lead.type,
        pipelineStatus: lead.pipelineStatus ?? lead.status,
        gekoppeldKlantId: lead.gekoppeldKlantId,
        createdAt: lead.createdAt,
      }));
  },
});

// ============================================
// Pipeline / CRM Helpers
// ============================================
// mapOldStatus en de funnel-logica leven in convex/leadsKlantenHelpers.ts
// (PRD §1.3: sanering dubbele pipeline — zie het commentaarblok daar).

type PipelineStatus = LeadPipelineStatus;

// ============================================
// Pipeline Queries
// ============================================

/**
 * Haal alle leads op gegroepeerd per pipeline status (authenticated).
 */
export const listByPipeline = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await requireOrgId(ctx);
    const allLeads = await ctx.db
      .query("configuratorAanvragen")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .collect();

    const grouped: Record<PipelineStatus, Doc<"configuratorAanvragen">[]> = {
      nieuw: [],
      contact_gehad: [],
      offerte_verstuurd: [],
      gewonnen: [],
      verloren: [],
    };

    for (const lead of vanEigenOrg(allLeads, orgId)) {
      // Gearchiveerde leads niet tonen op het bord (§5.2)
      if (lead.isArchived) continue;
      // PRD §1.3: een gepromoveerde lead (gewonnen + gekoppeld klantrecord)
      // wórdt de klant en verdwijnt van het bord; de historie blijft
      // bereikbaar vanaf de klant (getLeadVoorKlant).
      if (isGepromoveerdeLead(lead)) continue;
      const pipelineStatus = lead.pipelineStatus ?? mapOldStatus(lead.status);
      grouped[pipelineStatus].push(lead);
    }

    return grouped;
  },
});

/**
 * Pipeline statistieken (authenticated).
 */
export const pipelineStats = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await requireOrgId(ctx);
    const alleRecords = await ctx.db
      .query("configuratorAanvragen")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    // Gearchiveerde leads tellen niet mee in de statistieken (§5.2)
    const allLeads = vanEigenOrg(alleRecords, orgId).filter((a) => !a.isArchived);

    const totaalLeads = allLeads.length;
    let pipelineWaarde = 0;
    let gewonnenWaarde = 0;
    let gewonnenCount = 0;

    for (const lead of allLeads) {
      const pipelineStatus = lead.pipelineStatus ?? mapOldStatus(lead.status);
      const waarde = lead.geschatteWaarde ?? lead.indicatiePrijs ?? 0;

      if (pipelineStatus !== "verloren") {
        pipelineWaarde += waarde;
      }
      if (pipelineStatus === "gewonnen") {
        gewonnenWaarde += waarde;
        gewonnenCount++;
      }
    }

    const conversieRatio = totaalLeads > 0 ? gewonnenCount / totaalLeads : 0;

    return {
      totaalLeads,
      pipelineWaarde,
      gewonnenWaarde,
      conversieRatio,
    };
  },
});

// ============================================
// Mutations
// ============================================

/**
 * Maak een nieuwe aanvraag aan (public, geen authenticatie vereist).
 * Genereert automatisch een uniek referentienummer.
 *
 * Audit §3: publiek endpoint, dus achter een rate limit (zie de motivatie
 * bij de drempels in convex/security.ts). Convex kent hier geen IP-adres;
 * we begrenzen daarom globaal én per e-mailadres.
 */
export const create = mutation({
  args: {
    type: v.union(
      v.literal("gazon"),
      v.literal("boomschors"),
      v.literal("verticuteren")
    ),
    klantNaam: v.string(),
    klantEmail: v.string(),
    klantTelefoon: v.string(),
    klantAdres: v.string(),
    klantPostcode: v.string(),
    klantPlaats: v.string(),
    specificaties: v.union(
      v.object({
        oppervlakte: v.number(),
        typeGras: v.string(),
        ondergrond: v.string(),
        drainage: v.boolean(),
        opsluitbanden: v.boolean(),
        opsluitbandenMeters: v.number(),
        poortbreedte: v.number(),
        handmatigToeslag: v.optional(v.boolean()),
        gewensteStartdatum: v.optional(v.union(v.string(), v.null())),
        prijsDetails: v.optional(v.object({
          subtotaalExBtw: v.number(),
          btw: v.number(),
          totaalInclBtw: v.number(),
        })),
      }),
      v.object({
        boomschorsType: v.string(),
        oppervlakte: v.number(),
        laagDikte: v.string(),
        m3Nodig: v.number(),
        bezorging: v.boolean(),
        bezorgPostcode: v.optional(v.string()),
        leveringsDatum: v.optional(v.union(v.string(), v.null())),
        opmerkingen: v.optional(v.union(v.string(), v.null())),
      }),
      v.object({
        oppervlakte: v.number(),
        conditie: v.string(),
        bijzaaien: v.boolean(),
        topdressing: v.boolean(),
        bemesting: v.boolean(),
        poortBreedte: v.number(),
        gewensteDatum: v.optional(v.union(v.string(), v.null())),
        opmerkingen: v.optional(v.union(v.string(), v.null())),
      }),
      v.object({
        onderwerp: v.string(),
        bericht: v.string(),
        aantalFotos: v.optional(v.number()),
      }),
      v.object({})
    ),
    indicatiePrijs: v.number(),
  },
  handler: async (ctx, args) => {
    // Globale noodrem vóór al het werk: dit kost geen db-calls en vangt een
    // flood met steeds wisselende e-mailadressen af.
    const globaleLimiet = checkConfiguratorGlobaalRateLimit();
    if (!globaleLimiet.allowed) {
      throw new ConvexError(
        "Er komen op dit moment ongewoon veel aanvragen binnen. Probeer het over " +
          `${wachttijdInMinuten(globaleLimiet.resetAt)} minuten opnieuw of bel ons even.`
      );
    }

    // Valideer verplichte velden
    if (!args.klantNaam.trim()) {
      throw new ConvexError("Naam is verplicht");
    }
    if (!args.klantEmail.trim()) {
      throw new ConvexError("E-mailadres is verplicht");
    }

    // Per e-mailadres: remt de herhaalbot, niet de klant die zich vergist.
    const emailLimiet = checkConfiguratorEmailRateLimit(args.klantEmail);
    if (!emailLimiet.allowed) {
      throw new ConvexError(
        "We hebben al meerdere aanvragen van dit e-mailadres ontvangen. Probeer het over " +
          `${wachttijdInMinuten(emailLimiet.resetAt)} minuten opnieuw of bel ons even.`
      );
    }

    if (!args.klantTelefoon.trim()) {
      throw new ConvexError("Telefoonnummer is verplicht");
    }
    if (!args.klantAdres.trim()) {
      throw new ConvexError("Adres is verplicht");
    }
    if (!args.klantPostcode.trim()) {
      throw new ConvexError("Postcode is verplicht");
    }
    if (!args.klantPlaats.trim()) {
      throw new ConvexError("Plaats is verplicht");
    }
    if (args.indicatiePrijs < 0) {
      throw new ConvexError("Indicatieprijs mag niet negatief zijn");
    }

    // Genereer uniek referentienummer: CFG-YYYYMMDD-XXXX
    const now = Date.now();
    const datum = new Date(now);
    const jaar = datum.getFullYear();
    const maand = String(datum.getMonth() + 1).padStart(2, "0");
    const dag = String(datum.getDate()).padStart(2, "0");
    const willekeurig = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    const referentie = `CFG-${jaar}${maand}${dag}-${willekeurig}`;

    // Bepaal bron op basis van type
    const bronMap: Record<string, "configurator_gazon" | "configurator_boomschors" | "configurator_verticuteren"> = {
      gazon: "configurator_gazon",
      boomschors: "configurator_boomschors",
      verticuteren: "configurator_verticuteren",
    };

    // Publieke instroom: de organisatie wordt afgeleid, niet uit een JWT
    // gelezen — zie orgVoorPubliekeIntake. Eén keer bepalen, twee keer nodig
    // (het lead-record én de ontvangstbevestiging).
    const orgId = await orgVoorPubliekeIntake(ctx);

    const id = await ctx.db.insert("configuratorAanvragen", {
      orgId,
      type: args.type,
      status: "nieuw",
      pipelineStatus: "nieuw",
      bron: bronMap[args.type],
      referentie,
      klantNaam: args.klantNaam.trim(),
      klantEmail: args.klantEmail.trim().toLowerCase(),
      klantTelefoon: args.klantTelefoon.trim(),
      klantAdres: args.klantAdres.trim(),
      klantPostcode: args.klantPostcode.trim().toUpperCase(),
      klantPlaats: args.klantPlaats.trim(),
      specificaties: args.specificaties,
      indicatiePrijs: args.indicatiePrijs,
      createdAt: now,
      updatedAt: now,
    });

    // Log activiteit
    await ctx.db.insert("leadActiviteiten", {
      leadId: id,
      type: "aangemaakt",
      beschrijving: `Lead aangemaakt via configurator (${args.type})`,
      createdAt: now,
    });

    // §2.7 (event lead_ontvangen): ontvangstbevestiging klaarzetten.
    // Additief en optioneel: zonder actieve trigger gebeurt er niets;
    // daadwerkelijke verzending loopt altijd via de mail-guard.
    await zetLeadOntvangstbevestigingKlaar(ctx, {
      leadId: id,
      naam: args.klantNaam.trim(),
      email: args.klantEmail.trim().toLowerCase(),
      referentie,
      orgId,
    });

    return { id, referentie };
  },
});

/**
 * Wijzig de status van een aanvraag (authenticated).
 */
export const updateStatus = mutation({
  args: {
    id: v.id("configuratorAanvragen"),
    status: v.union(
      v.literal("nieuw"),
      v.literal("in_behandeling"),
      v.literal("goedgekeurd"),
      v.literal("afgekeurd"),
      v.literal("voltooid")
    ),
    verificatieNotities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);

    const aanvraag = await verifyOrgOwnership(
      ctx,
      await ctx.db.get(args.id),
      "aanvraag"
    );

    await ctx.db.patch(args.id, {
      status: args.status,
      verificatieNotities:
        args.verificatieNotities !== undefined
          ? args.verificatieNotities
          : aanvraag.verificatieNotities,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Wijs een aanvraag toe aan een medewerker (authenticated).
 */
export const toewijzen = mutation({
  args: {
    id: v.id("configuratorAanvragen"),
    toegewezenAan: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireNotViewer(ctx);

    const aanvraag = await verifyOrgOwnership(
      ctx,
      await ctx.db.get(args.id),
      "aanvraag"
    );

    // Controleer of de gebruiker bestaat
    const medewerker = await ctx.db.get(args.toegewezenAan);
    if (!medewerker) {
      throw new ConvexError("Medewerker niet gevonden");
    }

    await ctx.db.patch(args.id, {
      toegewezenAan: args.toegewezenAan,
      // Zet automatisch op "in_behandeling" als de aanvraag nog "nieuw" is
      status: aanvraag.status === "nieuw" ? "in_behandeling" : aanvraag.status,
      updatedAt: Date.now(),
    });

    // Log toewijzing activiteit
    await ctx.db.insert("leadActiviteiten", {
      leadId: args.id,
      type: "toewijzing",
      beschrijving: `Lead toegewezen aan ${medewerker.name ?? medewerker.email}`,
      gebruikerId: currentUser._id,
      metadata: { toegewezenAan: args.toegewezenAan },
      createdAt: Date.now(),
    });
  },
});

/**
 * Voeg een verificatienotitie toe aan een aanvraag (authenticated).
 */
export const addNotitie = mutation({
  args: {
    id: v.id("configuratorAanvragen"),
    notitie: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireNotViewer(ctx);

    await verifyOrgOwnership(ctx, await ctx.db.get(args.id), "aanvraag");

    if (!args.notitie.trim()) {
      throw new ConvexError("Notitie mag niet leeg zijn");
    }

    await ctx.db.patch(args.id, {
      verificatieNotities: args.notitie.trim(),
      updatedAt: Date.now(),
    });

    // Log notitie activiteit
    await ctx.db.insert("leadActiviteiten", {
      leadId: args.id,
      type: "notitie",
      beschrijving: args.notitie.trim(),
      gebruikerId: currentUser._id,
      createdAt: Date.now(),
    });
  },
});

/**
 * Stel de definitieve prijs in voor een aanvraag (authenticated).
 */
export const setPrijs = mutation({
  args: {
    id: v.id("configuratorAanvragen"),
    definitievePrijs: v.number(),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);

    await verifyOrgOwnership(ctx, await ctx.db.get(args.id), "aanvraag");

    if (args.definitievePrijs < 0) {
      throw new ConvexError("Definitieve prijs mag niet negatief zijn");
    }

    await ctx.db.patch(args.id, {
      definitievePrijs: args.definitievePrijs,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Werk de geschatte waarde en/of definitieve prijs bij voor een lead (authenticated).
 */
export const updatePrijzen = mutation({
  args: {
    id: v.id("configuratorAanvragen"),
    geschatteWaarde: v.optional(v.number()),
    definitievePrijs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);

    await verifyOrgOwnership(ctx, await ctx.db.get(args.id), "lead");

    if (args.geschatteWaarde !== undefined && args.geschatteWaarde < 0) {
      throw new ConvexError("Geschatte waarde mag niet negatief zijn");
    }
    if (args.definitievePrijs !== undefined && args.definitievePrijs < 0) {
      throw new ConvexError("Definitieve prijs mag niet negatief zijn");
    }

    const patchData: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.geschatteWaarde !== undefined) {
      patchData.geschatteWaarde = args.geschatteWaarde;
    }
    if (args.definitievePrijs !== undefined) {
      patchData.definitievePrijs = args.definitievePrijs;
    }

    await ctx.db.patch(args.id, patchData);
  },
});

// ============================================
// Pipeline Mutations
// ============================================

const pipelineStatusValidator = v.union(
  v.literal("nieuw"),
  v.literal("contact_gehad"),
  v.literal("offerte_verstuurd"),
  v.literal("gewonnen"),
  v.literal("verloren")
);

const pipelineStatusLabels: Record<PipelineStatus, string> = {
  nieuw: "Nieuw",
  contact_gehad: "Contact gehad",
  offerte_verstuurd: "Offerte verstuurd",
  gewonnen: "Gewonnen",
  verloren: "Verloren",
};

/**
 * Wijzig de pipeline status van een lead (authenticated).
 * Valideert transitieregels.
 */
export const updatePipelineStatus = mutation({
  args: {
    id: v.id("configuratorAanvragen"),
    pipelineStatus: pipelineStatusValidator,
    verliesReden: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireNotViewer(ctx);

    const lead = await verifyOrgOwnership(
      ctx,
      await ctx.db.get(args.id),
      "lead"
    );

    const currentStatus = lead.pipelineStatus ?? mapOldStatus(lead.status);

    // Transitieregels
    if (currentStatus === "gewonnen" && args.pipelineStatus !== "gewonnen") {
      throw new ConvexError("Een gewonnen lead kan niet terug naar een eerdere status");
    }

    if (args.pipelineStatus === "verloren" && !args.verliesReden?.trim()) {
      throw new ConvexError("Een verliesreden is verplicht bij status 'verloren'");
    }

    const patchData: Record<string, unknown> = {
      pipelineStatus: args.pipelineStatus,
      updatedAt: Date.now(),
    };

    if (args.pipelineStatus === "verloren" && args.verliesReden) {
      patchData.verliesReden = args.verliesReden.trim();
    }

    await ctx.db.patch(args.id, patchData);

    // Log status wijziging
    await ctx.db.insert("leadActiviteiten", {
      leadId: args.id,
      type: "status_wijziging",
      beschrijving: `Status gewijzigd van "${pipelineStatusLabels[currentStatus]}" naar "${pipelineStatusLabels[args.pipelineStatus]}"`,
      gebruikerId: currentUser._id,
      metadata: {
        vanStatus: currentStatus,
        naarStatus: args.pipelineStatus,
        ...(args.verliesReden ? { verliesReden: args.verliesReden } : {}),
      },
      createdAt: Date.now(),
    });
  },
});

/**
 * Markeer een lead als gewonnen = promotie naar klant (PRD §1.3, authenticated).
 *
 * De kern (promoveerLead, convex/leadsKlantenHelpers.ts) is idempotent en:
 * - matcht bestaande klanten case-insensitief via de by_email-index
 *   (geen ongeïndexeerde full-table scan meer);
 * - maakt géén dubbel record: de lead wórdt de klant en verdwijnt van het
 *   bord (listByPipeline filtert gepromoveerde leads), historie blijft
 *   bereikbaar vanaf de klant (getLeadVoorKlant);
 * - maakt direct het eerste werkitem aan (type "project", status "gepland").
 */
export const markGewonnen = mutation({
  args: {
    id: v.id("configuratorAanvragen"),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireNotViewer(ctx);
    const orgId = await requireOrgId(ctx);

    const lead = await verifyOrgOwnership(
      ctx,
      await ctx.db.get(args.id),
      "lead"
    );

    if (!lead.klantNaam?.trim()) {
      throw new ConvexError("Klantnaam is verplicht om een lead als gewonnen te markeren");
    }

    const resultaat = await promoveerLead(ctx, lead, currentUser, orgId);
    return resultaat;
  },
});

/**
 * Lead-historie vanaf de klant (PRD §1.3): het gepromoveerde lead-record met
 * activiteiten en foto-verwijzingen, opgezocht via de by_gekoppeld_klant-index.
 */
export const getLeadVoorKlant = query({
  args: { klantId: v.id("klanten") },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);

    const lead = await ctx.db
      .query("configuratorAanvragen")
      .withIndex("by_gekoppeld_klant", (q) => q.eq("gekoppeldKlantId", args.klantId))
      .first();
    // by_gekoppeld_klant is bedrijfsoverstijgend: expliciet op de eigen
    // organisatie controleren.
    if (!lead || lead.orgId?.toString() !== orgId.toString()) return null;

    const activiteiten = await ctx.db
      .query("leadActiviteiten")
      .withIndex("by_lead", (q) => q.eq("leadId", lead._id))
      .order("desc")
      .collect();

    return {
      _id: lead._id,
      referentie: lead.referentie,
      bron: lead.bron,
      type: lead.type,
      omschrijving: lead.omschrijving,
      aantalFotos: lead.fotoIds?.length ?? 0,
      createdAt: lead.createdAt,
      activiteiten: activiteiten.map((a) => ({
        _id: a._id,
        type: a.type,
        beschrijving: a.beschrijving,
        createdAt: a.createdAt,
      })),
    };
  },
});

/**
 * §5.2: Archiveer een lead (i.p.v. hard delete). Foto's en activiteiten blijven bewaard.
 * Hard delete blijft alleen bereikbaar via de GDPR-flow (verwijder).
 */
export const archiveer = mutation({
  args: {
    id: v.id("configuratorAanvragen"),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);

    await verifyOrgOwnership(ctx, await ctx.db.get(args.id), "lead");

    await ctx.db.patch(args.id, {
      isArchived: true,
      archivedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

/**
 * §5.2: Herstel een gearchiveerde lead.
 */
export const herstelGearchiveerd = mutation({
  args: {
    id: v.id("configuratorAanvragen"),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);

    const lead = await verifyOrgOwnership(
      ctx,
      await ctx.db.get(args.id),
      "lead"
    );
    if (!lead.isArchived) {
      throw new ConvexError("Deze lead is niet gearchiveerd");
    }

    await ctx.db.patch(args.id, {
      isArchived: undefined,
      archivedAt: undefined,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

/**
 * §5.2: Lijst van gearchiveerde leads (voor Archief-pagina).
 */
export const listArchived = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await requireOrgId(ctx);
    const aanvragen = await ctx.db
      .query("configuratorAanvragen")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .collect();

    return vanEigenOrg(aanvragen, orgId)
      .filter((a) => a.isArchived)
      .map((a) => ({
        _id: a._id,
        klantNaam: a.klantNaam,
        referentie: a.referentie,
        type: a.type,
        archivedAt: a.archivedAt,
      }))
      .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0));
  },
});

/**
 * Verwijder een lead en bijbehorende activiteiten en foto's (authenticated, admin).
 * LET OP (§5.2): alleen gebruiken vanuit de GDPR-flow; de lijst-UI archiveert.
 */
export const verwijder = mutation({
  args: {
    id: v.id("configuratorAanvragen"),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);

    const lead = await verifyOrgOwnership(
      ctx,
      await ctx.db.get(args.id),
      "lead"
    );

    // Verwijder foto's uit storage
    if (lead.fotoIds && lead.fotoIds.length > 0) {
      for (const storageId of lead.fotoIds) {
        try {
          await ctx.storage.delete(storageId);
        } catch {
          // Negeer als bestand al verwijderd is
        }
      }
    }

    // Verwijder alle activiteiten van deze lead
    const activiteiten = await ctx.db
      .query("leadActiviteiten")
      .withIndex("by_lead", (q) => q.eq("leadId", args.id))
      .collect();
    for (const activiteit of activiteiten) {
      await ctx.db.delete(activiteit._id);
    }

    // Verwijder de lead zelf
    await ctx.db.delete(args.id);
  },
});

/**
 * Maak een handmatige lead aan (authenticated).
 */
export const createHandmatig = mutation({
  args: {
    klantNaam: v.string(),
    klantEmail: v.optional(v.string()),
    klantTelefoon: v.optional(v.string()),
    klantAdres: v.optional(v.string()),
    klantPostcode: v.optional(v.string()),
    klantPlaats: v.optional(v.string()),
    omschrijving: v.optional(v.string()),
    geschatteWaarde: v.optional(v.number()),
    bron: v.optional(v.union(
      v.literal("handmatig"),
      v.literal("telefoon"),
      v.literal("email"),
      v.literal("doorverwijzing")
    )),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireNotViewer(ctx);
    const { org } = await requireOrgContext(ctx);

    if (!args.klantNaam.trim()) {
      throw new ConvexError("Klantnaam is verplicht");
    }

    // Genereer uniek referentienummer: TOP-MAN-YYYY-NNNNN
    const now = Date.now();
    const jaar = new Date(now).getFullYear();
    const willekeurig = Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, "0");
    const referentie = `TOP-MAN-${jaar}-${willekeurig}`;

    const id = await ctx.db.insert("configuratorAanvragen", {
      orgId: org._id,
      type: "gazon", // Default type voor handmatige leads
      status: "nieuw",
      pipelineStatus: "nieuw",
      bron: args.bron ?? "handmatig",
      referentie,
      klantNaam: args.klantNaam.trim(),
      klantEmail: args.klantEmail?.trim().toLowerCase() ?? "",
      klantTelefoon: args.klantTelefoon?.trim() ?? "",
      klantAdres: args.klantAdres?.trim() ?? "",
      klantPostcode: args.klantPostcode?.trim().toUpperCase() ?? "",
      klantPlaats: args.klantPlaats?.trim() ?? "",
      specificaties: {},
      indicatiePrijs: args.geschatteWaarde ?? 0,
      geschatteWaarde: args.geschatteWaarde,
      omschrijving: args.omschrijving?.trim(),
      createdAt: now,
      updatedAt: now,
    });

    // Log activiteit
    await ctx.db.insert("leadActiviteiten", {
      leadId: id,
      type: "aangemaakt",
      beschrijving: `Lead handmatig aangemaakt door ${currentUser.name ?? currentUser.email}`,
      gebruikerId: currentUser._id,
      metadata: { bron: args.bron ?? "handmatig" },
      createdAt: now,
    });

    return { id, referentie };
  },
});

/**
 * Maak een lead aan vanuit het website contactformulier (internal, aangeroepen via HTTP action).
 * Geen authenticatie vereist — beveiligd via shared secret in de HTTP action.
 */
export const createFromWebsite = internalMutation({
  args: {
    klantNaam: v.string(),
    klantEmail: v.string(),
    klantTelefoon: v.optional(v.string()),
    onderwerp: v.string(),
    bericht: v.string(),
    aantalFotos: v.optional(v.number()),
    // Nieuwe contactformulier velden
    postcode: v.optional(v.string()),
    huisnummer: v.optional(v.string()),
    straat: v.optional(v.string()),
    plaats: v.optional(v.string()),
    tuinoppervlak: v.optional(v.string()),
    heeftOntwerp: v.optional(v.string()),
    onderhoudFrequentie: v.optional(v.string()),
    reinigingOpties: v.optional(v.array(v.string())),
    hoeGevonden: v.optional(v.string()),
    fotoIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args) => {
    if (!args.klantNaam.trim()) {
      throw new ConvexError("Naam is verplicht");
    }
    if (!args.klantEmail.trim()) {
      throw new ConvexError("E-mailadres is verplicht");
    }

    const now = Date.now();
    const datum = new Date(now);
    const jaar = datum.getFullYear();
    const maand = String(datum.getMonth() + 1).padStart(2, "0");
    const dag = String(datum.getDate()).padStart(2, "0");
    const willekeurig = Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, "0");
    const referentie = `TOP-WEB-${jaar}${maand}${dag}-${willekeurig}`;

    // Bouw omschrijving op basis van onderwerp en bericht
    const onderwerpLabels: Record<string, string> = {
      tuinonderhoud: "Tuinonderhoud",
      tuinaanleg: "Tuinaanleg",
      reiniging: "Reiniging",
      zakelijk: "Zakelijk",
      anders: "Anders",
    };
    const onderwerpLabel = onderwerpLabels[args.onderwerp] ?? args.onderwerp;
    const omschrijving = `[${onderwerpLabel}] ${args.bericht}`;

    // Publieke instroom via de HTTP-action; zie orgVoorPubliekeIntake.
    const orgId = await orgVoorPubliekeIntake(ctx);

    const id = await ctx.db.insert("configuratorAanvragen", {
      orgId,
      type: "contact",
      status: "nieuw",
      pipelineStatus: "nieuw",
      bron: "website_contact",
      referentie,
      klantNaam: args.klantNaam.trim(),
      klantEmail: args.klantEmail.trim().toLowerCase(),
      klantTelefoon: args.klantTelefoon?.trim() ?? "",
      klantAdres: args.straat
        ? `${args.straat.trim()} ${args.huisnummer?.trim() ?? ""}`.trim()
        : "",
      klantPostcode: args.postcode?.trim() ?? "",
      klantHuisnummer: args.huisnummer?.trim(),
      klantPlaats: args.plaats?.trim() ?? "",
      specificaties: {
        onderwerp: args.onderwerp,
        bericht: args.bericht,
        aantalFotos: args.aantalFotos ?? 0,
        tuinoppervlak: args.tuinoppervlak,
        heeftOntwerp: args.heeftOntwerp,
        onderhoudFrequentie: args.onderhoudFrequentie,
        reinigingOpties: args.reinigingOpties,
        hoeGevonden: args.hoeGevonden,
      },
      fotoIds: args.fotoIds,
      indicatiePrijs: 0,
      omschrijving,
      createdAt: now,
      updatedAt: now,
    });

    const aantalFotos = args.fotoIds?.length ?? args.aantalFotos ?? 0;

    // Log activiteit
    await ctx.db.insert("leadActiviteiten", {
      leadId: id,
      type: "aangemaakt",
      beschrijving: `Lead aangemaakt via website contactformulier (${onderwerpLabel})${aantalFotos > 0 ? ` met ${aantalFotos} foto('s)` : ""}`,
      createdAt: now,
    });

    // §2.7 (event lead_ontvangen): ontvangstbevestiging klaarzetten —
    // zelfde trigger-pad als de configurator-instroom, achter de mail-guard.
    await zetLeadOntvangstbevestigingKlaar(ctx, {
      leadId: id,
      naam: args.klantNaam.trim(),
      email: args.klantEmail.trim().toLowerCase(),
      referentie,
      orgId,
    });

    return { id, referentie };
  },
});
