import { v, ConvexError } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireAuthUserId } from "./auth";
import { requireNotViewer } from "./roles";

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
