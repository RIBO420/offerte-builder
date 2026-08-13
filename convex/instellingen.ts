import { v, ConvexError } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import { requireAuthUserId } from "./auth";
import { getCompanyUserId, requireKantoor, requireNotViewer } from "./roles";
import { isGeldigeTijd, naarMinuten } from "./dagkaartLogica";
import { isGeldigeSuggestieDrempel } from "./beurtNacalculatieLogica";

const bedrijfsgegevensValidator = v.object({
  naam: v.string(),
  adres: v.string(),
  postcode: v.string(),
  plaats: v.string(),
  kvk: v.optional(v.string()),
  btw: v.optional(v.string()),
  iban: v.optional(v.string()),
  email: v.optional(v.string()),
  telefoon: v.optional(v.string()),
  logo: v.optional(v.string()),
});

const scopeMargesValidator = v.object({
  // Aanleg scopes
  grondwerk: v.optional(v.number()),
  bestrating: v.optional(v.number()),
  parkeerplaats: v.optional(v.number()),
  beregening: v.optional(v.number()),
  borders: v.optional(v.number()),
  gras: v.optional(v.number()),
  houtwerk: v.optional(v.number()),
  water_elektra: v.optional(v.number()),
  specials: v.optional(v.number()),
  // Onderhoud scopes
  gras_onderhoud: v.optional(v.number()),
  borders_onderhoud: v.optional(v.number()),
  heggen: v.optional(v.number()),
  bomen: v.optional(v.number()),
  overig: v.optional(v.number()),
});

// Get settings for authenticated user
export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

// Get settings by userId (internal — no auth required, for use by cron jobs/actions)
export const getByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

// Create default settings for authenticated user (idempotent)
export const createDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);

    // Idempotent: return existing if already created
    const existing = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("instellingen", {
      userId,
      uurtarief: 45.0,
      standaardMargePercentage: 15,
      btwPercentage: 21,
      bedrijfsgegevens: {
        naam: "",
        adres: "",
        postcode: "",
        plaats: "",
      },
      offerteNummerPrefix: "OFF-",
      laatsteOfferteNummer: 0,
    });
  },
});

// Update settings for authenticated user
export const update = mutation({
  args: {
    uurtarief: v.optional(v.number()),
    standaardMargePercentage: v.optional(v.number()),
    scopeMarges: v.optional(scopeMargesValidator),
    btwPercentage: v.optional(v.number()),
    bedrijfsgegevens: v.optional(bedrijfsgegevensValidator),
    offerteNummerPrefix: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);

    const settings = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!settings) {
      throw new ConvexError("Instellingen niet gevonden. Maak eerst standaardinstellingen aan.");
    }

    const updates: Record<string, unknown> = {};
    if (args.uurtarief !== undefined) updates.uurtarief = args.uurtarief;
    if (args.standaardMargePercentage !== undefined)
      updates.standaardMargePercentage = args.standaardMargePercentage;
    if (args.scopeMarges !== undefined)
      updates.scopeMarges = args.scopeMarges;
    if (args.btwPercentage !== undefined)
      updates.btwPercentage = args.btwPercentage;
    if (args.bedrijfsgegevens !== undefined)
      updates.bedrijfsgegevens = args.bedrijfsgegevens;
    if (args.offerteNummerPrefix !== undefined)
      updates.offerteNummerPrefix = args.offerteNummerPrefix;

    await ctx.db.patch(settings._id, updates);
    return settings._id;
  },
});

/**
 * Dagkaart-standaardblokken per bedrijf (PRD §2.2, stap 5b): vertrektijd
 * loods, pauze, loods-afronding en de standaard-reistijd per verplaatsing.
 * Echte tijden levert Mickey later (§7.1); tot dan gelden de defaults uit
 * convex/dagkaartLogica.ts. Alleen kantoor (planning) mag dit wijzigen.
 */
export const updateDagkaartInstellingen = mutation({
  args: {
    vertrekTijd: v.optional(v.string()),
    pauzeStart: v.optional(v.string()),
    pauzeEind: v.optional(v.string()),
    loodsAfrondingMinuten: v.optional(v.number()),
    standaardReistijdMinuten: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const userId = await requireAuthUserId(ctx);

    for (const tijd of [args.vertrekTijd, args.pauzeStart, args.pauzeEind]) {
      if (tijd !== undefined && !isGeldigeTijd(tijd)) {
        throw new ConvexError("Ongeldige tijd (verwacht HH:MM)");
      }
    }
    for (const minuten of [
      args.loodsAfrondingMinuten,
      args.standaardReistijdMinuten,
    ]) {
      if (
        minuten !== undefined &&
        (!Number.isFinite(minuten) || minuten < 0 || minuten > 24 * 60)
      ) {
        throw new ConvexError("Ongeldig aantal minuten (0 t/m 1440)");
      }
    }

    const settings = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!settings) {
      throw new ConvexError(
        "Instellingen niet gevonden. Maak eerst standaardinstellingen aan."
      );
    }

    const huidige = settings.dagkaartInstellingen ?? {};
    const nieuw = {
      vertrekTijd: args.vertrekTijd ?? huidige.vertrekTijd,
      pauzeStart: args.pauzeStart ?? huidige.pauzeStart,
      pauzeEind: args.pauzeEind ?? huidige.pauzeEind,
      loodsAfrondingMinuten:
        args.loodsAfrondingMinuten ?? huidige.loodsAfrondingMinuten,
      standaardReistijdMinuten:
        args.standaardReistijdMinuten ?? huidige.standaardReistijdMinuten,
    };
    if (
      nieuw.pauzeStart &&
      nieuw.pauzeEind &&
      naarMinuten(nieuw.pauzeEind) < naarMinuten(nieuw.pauzeStart)
    ) {
      throw new ConvexError("Pauze-einde ligt vóór de pauzestart");
    }

    await ctx.db.patch(settings._id, { dagkaartInstellingen: nieuw });
    return settings._id;
  },
});

/**
 * Veld-instellingen (PRD §2.6, stap 9a): drempels voor de "Wie is achter"-
 * widget (PRD-aanname >15 min of >20%, bevestiging Mickey §7.1) en het
 * noodprotocol-tekstblok voor de vaste snelkoppeling in de veld-app
 * (SOP-bibliotheek volgt in fase 3). Alleen kantoor wijzigt.
 */
export const updateVeldInstellingen = mutation({
  args: {
    afwijkingDrempelMinuten: v.optional(v.number()),
    afwijkingDrempelProcent: v.optional(v.number()),
    noodprotocolTekst: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const userId = await requireAuthUserId(ctx);

    if (
      args.afwijkingDrempelMinuten !== undefined &&
      (!Number.isFinite(args.afwijkingDrempelMinuten) ||
        args.afwijkingDrempelMinuten < 0 ||
        args.afwijkingDrempelMinuten > 24 * 60)
    ) {
      throw new ConvexError("Ongeldige drempel in minuten (0 t/m 1440)");
    }
    if (
      args.afwijkingDrempelProcent !== undefined &&
      (!Number.isFinite(args.afwijkingDrempelProcent) ||
        args.afwijkingDrempelProcent < 0 ||
        args.afwijkingDrempelProcent > 100)
    ) {
      throw new ConvexError("Ongeldige drempel in procenten (0 t/m 100)");
    }

    const settings = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!settings) {
      throw new ConvexError(
        "Instellingen niet gevonden. Maak eerst standaardinstellingen aan."
      );
    }

    const huidige = settings.veldInstellingen ?? {};
    await ctx.db.patch(settings._id, {
      veldInstellingen: {
        afwijkingDrempelMinuten:
          args.afwijkingDrempelMinuten ?? huidige.afwijkingDrempelMinuten,
        afwijkingDrempelProcent:
          args.afwijkingDrempelProcent ?? huidige.afwijkingDrempelProcent,
        noodprotocolTekst:
          args.noodprotocolTekst ?? huidige.noodprotocolTekst,
      },
    });
    return settings._id;
  },
});

/**
 * Veld-instellingen lezen voor de veld-weergave (voorman/medewerker):
 * noodprotocol-tekst + de geldende drempels. Bedrijfsscope via
 * getCompanyUserId zodat veld-accounts de instellingen van hun bedrijf zien.
 */
export const getVeldInstellingen = query({
  args: {},
  handler: async (ctx) => {
    const companyUserId = await getCompanyUserId(ctx);
    const settings = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", companyUserId))
      .unique();
    const veld = settings?.veldInstellingen;
    return {
      afwijkingDrempelMinuten: veld?.afwijkingDrempelMinuten ?? 15,
      afwijkingDrempelProcent: veld?.afwijkingDrempelProcent ?? 20,
      noodprotocolTekst: veld?.noodprotocolTekst ?? null,
    };
  },
});

/**
 * Nacalculatie-instellingen (PRD §3.4): drempel voor normuur-suggesties —
 * pas vanaf dit aantal volledig uitgevoerde beurten met een bouwsteen
 * verschijnt een suggestie (default 5, zie beurtNacalculatieLogica.ts).
 * Alleen kantoor wijzigt.
 */
export const updateNacalculatieInstellingen = mutation({
  args: {
    suggestieDrempelBeurten: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const userId = await requireAuthUserId(ctx);

    if (
      args.suggestieDrempelBeurten !== undefined &&
      !isGeldigeSuggestieDrempel(args.suggestieDrempelBeurten)
    ) {
      throw new ConvexError(
        "Ongeldige suggestie-drempel (geheel getal, 1 t/m 1000)"
      );
    }

    const settings = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!settings) {
      throw new ConvexError(
        "Instellingen niet gevonden. Maak eerst standaardinstellingen aan."
      );
    }

    const huidige = settings.nacalculatieInstellingen ?? {};
    await ctx.db.patch(settings._id, {
      nacalculatieInstellingen: {
        suggestieDrempelBeurten:
          args.suggestieDrempelBeurten ?? huidige.suggestieDrempelBeurten,
      },
    });
    return settings._id;
  },
});

// Get next offerte number and increment counter
export const getNextOfferteNummer = mutation({
  args: {},
  handler: async (ctx) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);

    const settings = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!settings) {
      throw new ConvexError("Instellingen niet gevonden");
    }

    const nextNumber = settings.laatsteOfferteNummer + 1;
    const year = new Date().getFullYear();
    const offerteNummer = `${settings.offerteNummerPrefix}${year}-${String(nextNumber).padStart(3, "0")}`;

    await ctx.db.patch(settings._id, {
      laatsteOfferteNummer: nextNumber,
    });

    return offerteNummer;
  },
});

// ── Algemene Voorwaarden PDF (EML-003) ────────────────────────────────

/** Generate upload URL for voorwaarden PDF */
export const generateVoorwaardenUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireNotViewer(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Save uploaded voorwaarden PDF to settings */
export const updateVoorwaardenPdf = mutation({
  args: {
    storageId: v.id("_storage"),
    bestandsnaam: v.string(),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);

    const settings = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!settings) {
      throw new ConvexError("Instellingen niet gevonden");
    }

    // Delete old PDF from storage if exists
    if (settings.voorwaardenPdfId) {
      await ctx.storage.delete(settings.voorwaardenPdfId);
    }

    await ctx.db.patch(settings._id, {
      voorwaardenPdfId: args.storageId,
      voorwaardenPdfNaam: args.bestandsnaam,
    });

    return settings._id;
  },
});

/** Remove voorwaarden PDF from settings */
export const removeVoorwaardenPdf = mutation({
  args: {},
  handler: async (ctx) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);

    const settings = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!settings) throw new ConvexError("Instellingen niet gevonden");
    if (!settings.voorwaardenPdfId) return;

    await ctx.storage.delete(settings.voorwaardenPdfId);
    await ctx.db.patch(settings._id, {
      voorwaardenPdfId: undefined,
      voorwaardenPdfNaam: undefined,
    });
  },
});

/** Get voorwaarden PDF URL (for use in email sending) */
export const getVoorwaardenPdfUrl = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const settings = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!settings?.voorwaardenPdfId) return null;

    const url = await ctx.storage.getUrl(settings.voorwaardenPdfId);
    return {
      url,
      naam: settings.voorwaardenPdfNaam ?? "Algemene Voorwaarden.pdf",
    };
  },
});

// ── Betalingsherinneringen Instellingen (FAC-006) ──────────────────────

/** Update herinnering settings for the authenticated user */
export const updateHerinneringInstellingen = mutation({
  args: {
    herinneringDagen: v.optional(v.array(v.number())),
    aanmaningDagen: v.optional(v.array(v.number())),
    automatischVersturen: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);

    const settings = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!settings) {
      throw new ConvexError("Instellingen niet gevonden. Maak eerst standaardinstellingen aan.");
    }

    const current = settings.herinneringInstellingen ?? {};

    await ctx.db.patch(settings._id, {
      herinneringInstellingen: {
        herinneringDagen: args.herinneringDagen ?? current.herinneringDagen ?? [7, 14, 21],
        aanmaningDagen: args.aanmaningDagen ?? current.aanmaningDagen ?? [30, 45, 60],
        automatischVersturen: args.automatischVersturen ?? current.automatischVersturen ?? false,
      },
    });

    return settings._id;
  },
});

// ── Deelfactuur Templates ──────────────────────────────────────────

export const getDeelfactuurTemplates = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const settings = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    return settings?.deelfactuurTemplates ?? [];
  },
});

export const upsertDeelfactuurTemplate = mutation({
  args: {
    template: v.object({
      id: v.string(),
      naam: v.string(),
      stappen: v.array(v.object({
        percentage: v.number(),
        label: v.string(),
      })),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    await requireNotViewer(ctx);

    const settings = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!settings) {
      throw new ConvexError("Instellingen niet gevonden. Maak eerst standaardinstellingen aan.");
    }

    const templates = settings.deelfactuurTemplates ?? [];
    const existingIndex = templates.findIndex((t) => t.id === args.template.id);

    if (existingIndex >= 0) {
      templates[existingIndex] = args.template;
    } else {
      templates.push(args.template);
    }

    await ctx.db.patch(settings._id, { deelfactuurTemplates: templates });
    return settings._id;
  },
});

export const deleteDeelfactuurTemplate = mutation({
  args: { templateId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    await requireNotViewer(ctx);

    const settings = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!settings) {
      throw new ConvexError("Instellingen niet gevonden. Maak eerst standaardinstellingen aan.");
    }

    const templates = (settings.deelfactuurTemplates ?? []).filter(
      (t) => t.id !== args.templateId
    );

    await ctx.db.patch(settings._id, { deelfactuurTemplates: templates });
    return settings._id;
  },
});

// ── PDF Branding & Template Settings ─────────────────────────────────

/** Update PDF branding settings (logo, colors, template style, voorwaarden) */
export const updatePdfBranding = mutation({
  args: {
    pdfLogoStorageId: v.optional(v.union(v.id("_storage"), v.null())),
    pdfPrimaireKleur: v.optional(v.string()),
    pdfSecundaireKleur: v.optional(v.string()),
    pdfTemplateStijl: v.optional(v.union(
      v.literal("klassiek"),
      v.literal("minimalistisch"),
      v.literal("bold")
    )),
    pdfVoorwaarden: v.optional(v.object({
      offerte: v.optional(v.string()),
      factuur: v.optional(v.string()),
      contract: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);

    const settings = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!settings) {
      throw new ConvexError("Instellingen niet gevonden. Maak eerst standaardinstellingen aan.");
    }

    const updates: Record<string, unknown> = {};
    if (args.pdfLogoStorageId !== undefined)
      updates.pdfLogoStorageId = args.pdfLogoStorageId === null ? undefined : args.pdfLogoStorageId;
    if (args.pdfPrimaireKleur !== undefined)
      updates.pdfPrimaireKleur = args.pdfPrimaireKleur;
    if (args.pdfSecundaireKleur !== undefined)
      updates.pdfSecundaireKleur = args.pdfSecundaireKleur;
    if (args.pdfTemplateStijl !== undefined)
      updates.pdfTemplateStijl = args.pdfTemplateStijl;
    if (args.pdfVoorwaarden !== undefined)
      updates.pdfVoorwaarden = args.pdfVoorwaarden;

    await ctx.db.patch(settings._id, updates);
    return settings._id;
  },
});

/** Internal: get voorwaarden URL for a specific user (for automated emails) */
export const getVoorwaardenForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!settings?.voorwaardenPdfId) return null;

    const url = await ctx.storage.getUrl(settings.voorwaardenPdfId);
    return {
      url,
      naam: settings.voorwaardenPdfNaam ?? "Algemene Voorwaarden.pdf",
    };
  },
});
