import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireAuth, requireAuthUserId } from "./auth";
import { Doc } from "./_generated/dataModel";

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
    await requireAuthUserId(ctx);
    return await ctx.db
      .query("configuratorAanvragen")
      .order("desc")
      .collect();
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
    await requireAuthUserId(ctx);
    return await ctx.db
      .query("configuratorAanvragen")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .order("desc")
      .collect();
  },
});

/**
 * Haal een enkele aanvraag op via ID (authenticated).
 */
export const getById = query({
  args: { id: v.id("configuratorAanvragen") },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx);
    return await ctx.db.get(args.id);
  },
});

/**
 * Zoek een aanvraag op referentienummer (public, voor klant).
 * Klanten kunnen hun eigen aanvraag opzoeken zonder in te loggen.
 */
export const getByReferentie = query({
  args: { referentie: v.string() },
  handler: async (ctx, args) => {
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
    await requireAuthUserId(ctx);
    const all = await ctx.db.query("configuratorAanvragen").collect();
    return all.filter((a) => {
      const status = a.pipelineStatus ?? a.status;
      return status === "nieuw";
    }).length;
  },
});

// ============================================
// Pipeline / CRM Helpers
// ============================================

type PipelineStatus = "nieuw" | "contact_gehad" | "offerte_verstuurd" | "gewonnen" | "verloren";

/**
 * Map oude aanvraag status naar pipeline status voor backward compatibility.
 */
function mapOldStatus(status: string): PipelineStatus {
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

// ============================================
// Pipeline Queries
// ============================================

/**
 * Haal alle leads op gegroepeerd per pipeline status (authenticated).
 */
export const listByPipeline = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    const allLeads = await ctx.db
      .query("configuratorAanvragen")
      .order("desc")
      .collect();

    const grouped: Record<PipelineStatus, Doc<"configuratorAanvragen">[]> = {
      nieuw: [],
      contact_gehad: [],
      offerte_verstuurd: [],
      gewonnen: [],
      verloren: [],
    };

    for (const lead of allLeads) {
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
    await requireAuth(ctx);
    const allLeads = await ctx.db
      .query("configuratorAanvragen")
      .collect();

    let totaalLeads = allLeads.length;
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
    specificaties: v.any(),
    indicatiePrijs: v.number(),
  },
  handler: async (ctx, args) => {
    // Valideer verplichte velden
    if (!args.klantNaam.trim()) {
      throw new Error("Naam is verplicht");
    }
    if (!args.klantEmail.trim()) {
      throw new Error("E-mailadres is verplicht");
    }
    if (!args.klantTelefoon.trim()) {
      throw new Error("Telefoonnummer is verplicht");
    }
    if (!args.klantAdres.trim()) {
      throw new Error("Adres is verplicht");
    }
    if (!args.klantPostcode.trim()) {
      throw new Error("Postcode is verplicht");
    }
    if (!args.klantPlaats.trim()) {
      throw new Error("Plaats is verplicht");
    }
    if (args.indicatiePrijs < 0) {
      throw new Error("Indicatieprijs mag niet negatief zijn");
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

    const id = await ctx.db.insert("configuratorAanvragen", {
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
    await requireAuthUserId(ctx);

    const aanvraag = await ctx.db.get(args.id);
    if (!aanvraag) {
      throw new Error("Aanvraag niet gevonden");
    }

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
    const currentUser = await requireAuth(ctx);

    const aanvraag = await ctx.db.get(args.id);
    if (!aanvraag) {
      throw new Error("Aanvraag niet gevonden");
    }

    // Controleer of de gebruiker bestaat
    const medewerker = await ctx.db.get(args.toegewezenAan);
    if (!medewerker) {
      throw new Error("Medewerker niet gevonden");
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
    const currentUser = await requireAuth(ctx);

    const aanvraag = await ctx.db.get(args.id);
    if (!aanvraag) {
      throw new Error("Aanvraag niet gevonden");
    }

    if (!args.notitie.trim()) {
      throw new Error("Notitie mag niet leeg zijn");
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
    await requireAuthUserId(ctx);

    const aanvraag = await ctx.db.get(args.id);
    if (!aanvraag) {
      throw new Error("Aanvraag niet gevonden");
    }

    if (args.definitievePrijs < 0) {
      throw new Error("Definitieve prijs mag niet negatief zijn");
    }

    await ctx.db.patch(args.id, {
      definitievePrijs: args.definitievePrijs,
      updatedAt: Date.now(),
    });
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
    const currentUser = await requireAuth(ctx);

    const lead = await ctx.db.get(args.id);
    if (!lead) {
      throw new Error("Lead niet gevonden");
    }

    const currentStatus = lead.pipelineStatus ?? mapOldStatus(lead.status);

    // Transitieregels
    if (currentStatus === "gewonnen" && args.pipelineStatus !== "gewonnen") {
      throw new Error("Een gewonnen lead kan niet terug naar een eerdere status");
    }

    if (args.pipelineStatus === "verloren" && !args.verliesReden?.trim()) {
      throw new Error("Een verliesreden is verplicht bij status 'verloren'");
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
        verliesReden: args.verliesReden,
      },
      createdAt: Date.now(),
    });
  },
});

/**
 * Markeer een lead als gewonnen en koppel/maak een klant (authenticated).
 */
export const markGewonnen = mutation({
  args: {
    id: v.id("configuratorAanvragen"),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireAuth(ctx);

    const lead = await ctx.db.get(args.id);
    if (!lead) {
      throw new Error("Lead niet gevonden");
    }

    if (!lead.klantNaam?.trim()) {
      throw new Error("Klantnaam is verplicht om een lead als gewonnen te markeren");
    }

    // Zoek bestaande klant op basis van e-mailadres
    let klantId = lead.gekoppeldKlantId;

    if (!klantId && lead.klantEmail) {
      const bestaandeKlanten = await ctx.db
        .query("klanten")
        .filter((q) => q.eq(q.field("email"), lead.klantEmail.toLowerCase()))
        .collect();

      if (bestaandeKlanten.length > 0) {
        klantId = bestaandeKlanten[0]._id;
      }
    }

    // Maak nieuwe klant aan als die niet bestaat
    if (!klantId) {
      const now = Date.now();
      klantId = await ctx.db.insert("klanten", {
        userId: currentUser._id,
        naam: lead.klantNaam.trim(),
        adres: lead.klantAdres?.trim() ?? "",
        postcode: lead.klantPostcode?.trim() ?? "",
        plaats: lead.klantPlaats?.trim() ?? "",
        email: lead.klantEmail?.trim().toLowerCase(),
        telefoon: lead.klantTelefoon?.trim(),
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(args.id, {
      pipelineStatus: "gewonnen",
      gekoppeldKlantId: klantId,
      updatedAt: Date.now(),
    });

    // Log activiteit
    await ctx.db.insert("leadActiviteiten", {
      leadId: args.id,
      type: "status_wijziging",
      beschrijving: "Lead gemarkeerd als gewonnen en klant gekoppeld",
      gebruikerId: currentUser._id,
      metadata: { gekoppeldKlantId: klantId },
      createdAt: Date.now(),
    });

    return { klantId };
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
    const currentUser = await requireAuth(ctx);

    if (!args.klantNaam.trim()) {
      throw new Error("Klantnaam is verplicht");
    }

    // Genereer uniek referentienummer: TOP-MAN-YYYY-NNNNN
    const now = Date.now();
    const jaar = new Date(now).getFullYear();
    const willekeurig = Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, "0");
    const referentie = `TOP-MAN-${jaar}-${willekeurig}`;

    const id = await ctx.db.insert("configuratorAanvragen", {
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
  },
  handler: async (ctx, args) => {
    if (!args.klantNaam.trim()) {
      throw new Error("Naam is verplicht");
    }
    if (!args.klantEmail.trim()) {
      throw new Error("E-mailadres is verplicht");
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
      zakelijk: "Zakelijk",
      anders: "Anders",
    };
    const onderwerpLabel = onderwerpLabels[args.onderwerp] ?? args.onderwerp;
    const omschrijving = `[${onderwerpLabel}] ${args.bericht}`;

    const id = await ctx.db.insert("configuratorAanvragen", {
      type: "contact",
      status: "nieuw",
      pipelineStatus: "nieuw",
      bron: "website_contact",
      referentie,
      klantNaam: args.klantNaam.trim(),
      klantEmail: args.klantEmail.trim().toLowerCase(),
      klantTelefoon: args.klantTelefoon?.trim() ?? "",
      klantAdres: "",
      klantPostcode: "",
      klantPlaats: "",
      specificaties: {
        onderwerp: args.onderwerp,
        bericht: args.bericht,
        aantalFotos: args.aantalFotos ?? 0,
      },
      indicatiePrijs: 0,
      omschrijving,
      createdAt: now,
      updatedAt: now,
    });

    // Log activiteit
    await ctx.db.insert("leadActiviteiten", {
      leadId: id,
      type: "aangemaakt",
      beschrijving: `Lead aangemaakt via website contactformulier (${onderwerpLabel})`,
      createdAt: now,
    });

    return { id, referentie };
  },
});
