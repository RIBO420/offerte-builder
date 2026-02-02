import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthenticatedUser, requireAuth } from "./auth";
import { Id } from "./_generated/dataModel";
import { MutationCtx } from "./_generated/server";

// ============================================
// ADMIN CONFIGURATION
// ============================================
//
// Admin users are determined by:
// 1. First user created in the system is automatically an admin
// 2. Users with emails matching ADMIN_EMAILS list are automatically admins
// 3. Existing users can be promoted via makeCurrentUserAdmin() (one-time bootstrap)
//
// To add more admin emails, add them to this list:
const ADMIN_EMAILS: string[] = [
  // Add admin email addresses here, e.g.:
  // "admin@toptuinen.nl",
  // "owner@company.com",
];

/**
 * Check if an email should be an admin
 */
function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.some(
    (adminEmail) => adminEmail.toLowerCase() === email.toLowerCase()
  );
}

// Get current authenticated user
export const current = query({
  args: {},
  handler: async (ctx) => {
    return await getAuthenticatedUser(ctx);
  },
});

// Default normuren data
const DEFAULT_NORMUREN = [
  // Grondwerk
  { activiteit: "Ontgraven licht", scope: "grondwerk", normuurPerEenheid: 0.15, eenheid: "m²", omschrijving: "Licht ontgraven tot 20cm diep" },
  { activiteit: "Ontgraven standaard", scope: "grondwerk", normuurPerEenheid: 0.25, eenheid: "m²", omschrijving: "Standaard ontgraven 20-40cm diep" },
  { activiteit: "Ontgraven zwaar", scope: "grondwerk", normuurPerEenheid: 0.4, eenheid: "m²", omschrijving: "Zwaar ontgraven >40cm diep" },
  { activiteit: "Grond afvoeren", scope: "grondwerk", normuurPerEenheid: 0.1, eenheid: "m³", omschrijving: "Laden en afvoeren grond" },
  // Bestrating
  { activiteit: "Tegels leggen", scope: "bestrating", normuurPerEenheid: 0.35, eenheid: "m²", omschrijving: "Leggen standaard tegels" },
  { activiteit: "Klinkers leggen", scope: "bestrating", normuurPerEenheid: 0.45, eenheid: "m²", omschrijving: "Leggen klinkers" },
  { activiteit: "Natuursteen leggen", scope: "bestrating", normuurPerEenheid: 0.55, eenheid: "m²", omschrijving: "Leggen natuursteen" },
  { activiteit: "Zandbed aanbrengen", scope: "bestrating", normuurPerEenheid: 0.1, eenheid: "m²", omschrijving: "Aanbrengen en egaliseren zandbed" },
  { activiteit: "Opsluitbanden plaatsen", scope: "bestrating", normuurPerEenheid: 0.25, eenheid: "m", omschrijving: "Plaatsen opsluitbanden" },
  // Borders
  { activiteit: "Grondbewerking border", scope: "borders", normuurPerEenheid: 0.2, eenheid: "m²", omschrijving: "Spitten en losmaken grond" },
  { activiteit: "Planten laag", scope: "borders", normuurPerEenheid: 0.15, eenheid: "m²", omschrijving: "Aanplanten lage intensiteit" },
  { activiteit: "Planten gemiddeld", scope: "borders", normuurPerEenheid: 0.25, eenheid: "m²", omschrijving: "Aanplanten gemiddelde intensiteit" },
  { activiteit: "Planten hoog", scope: "borders", normuurPerEenheid: 0.4, eenheid: "m²", omschrijving: "Aanplanten hoge intensiteit" },
  { activiteit: "Schors aanbrengen", scope: "borders", normuurPerEenheid: 0.08, eenheid: "m²", omschrijving: "Aanbrengen bodembedekking schors" },
  // Gras
  { activiteit: "Graszoden leggen", scope: "gras", normuurPerEenheid: 0.12, eenheid: "m²", omschrijving: "Leggen graszoden" },
  { activiteit: "Gras zaaien", scope: "gras", normuurPerEenheid: 0.05, eenheid: "m²", omschrijving: "Inzaaien gazon" },
  { activiteit: "Ondergrond bewerken", scope: "gras", normuurPerEenheid: 0.15, eenheid: "m²", omschrijving: "Voorbereiden ondergrond gazon" },
  // Houtwerk
  { activiteit: "Schutting plaatsen", scope: "houtwerk", normuurPerEenheid: 0.8, eenheid: "m", omschrijving: "Plaatsen schutting per strekkende meter" },
  { activiteit: "Vlonder leggen", scope: "houtwerk", normuurPerEenheid: 0.6, eenheid: "m²", omschrijving: "Leggen vlonder" },
  { activiteit: "Pergola bouwen", scope: "houtwerk", normuurPerEenheid: 4.0, eenheid: "stuk", omschrijving: "Bouwen pergola" },
  { activiteit: "Fundering standaard", scope: "houtwerk", normuurPerEenheid: 0.5, eenheid: "stuk", omschrijving: "Plaatsen funderingspaal/voet standaard" },
  { activiteit: "Fundering zwaar", scope: "houtwerk", normuurPerEenheid: 0.8, eenheid: "stuk", omschrijving: "Plaatsen funderingspaal/voet zwaar" },
  // Water/Elektra
  { activiteit: "Sleuf graven", scope: "water_elektra", normuurPerEenheid: 0.3, eenheid: "m", omschrijving: "Graven kabelsleuven" },
  { activiteit: "Kabel leggen", scope: "water_elektra", normuurPerEenheid: 0.1, eenheid: "m", omschrijving: "Leggen bekabeling" },
  { activiteit: "Armatuur plaatsen", scope: "water_elektra", normuurPerEenheid: 0.5, eenheid: "stuk", omschrijving: "Plaatsen verlichtingsarmatuur" },
  { activiteit: "Sleuf herstellen", scope: "water_elektra", normuurPerEenheid: 0.2, eenheid: "m", omschrijving: "Dichten en herstellen sleuf" },
  // Onderhoud - Gras
  { activiteit: "Maaien", scope: "gras_onderhoud", normuurPerEenheid: 0.02, eenheid: "m²", omschrijving: "Gras maaien" },
  { activiteit: "Kanten steken", scope: "gras_onderhoud", normuurPerEenheid: 0.05, eenheid: "m", omschrijving: "Graskanten steken" },
  { activiteit: "Verticuteren", scope: "gras_onderhoud", normuurPerEenheid: 0.03, eenheid: "m²", omschrijving: "Gazon verticuteren" },
  // Onderhoud - Borders
  { activiteit: "Wieden weinig", scope: "borders_onderhoud", normuurPerEenheid: 0.08, eenheid: "m²", omschrijving: "Onkruid verwijderen - weinig intensief" },
  { activiteit: "Wieden gemiddeld", scope: "borders_onderhoud", normuurPerEenheid: 0.15, eenheid: "m²", omschrijving: "Onkruid verwijderen - gemiddeld intensief" },
  { activiteit: "Wieden veel", scope: "borders_onderhoud", normuurPerEenheid: 0.25, eenheid: "m²", omschrijving: "Onkruid verwijderen - intensief" },
  { activiteit: "Snoei licht", scope: "borders_onderhoud", normuurPerEenheid: 0.1, eenheid: "m²", omschrijving: "Lichte snoei in borders" },
  { activiteit: "Snoei zwaar", scope: "borders_onderhoud", normuurPerEenheid: 0.2, eenheid: "m²", omschrijving: "Zware snoei in borders" },
  // Onderhoud - Heggen
  { activiteit: "Heg snoeien", scope: "heggen_onderhoud", normuurPerEenheid: 0.15, eenheid: "m³", omschrijving: "Snoeien heg per m³ volume" },
  { activiteit: "Snoeisel afvoeren", scope: "heggen_onderhoud", normuurPerEenheid: 0.1, eenheid: "m³", omschrijving: "Afvoeren snoeisel" },
  // Onderhoud - Bomen
  { activiteit: "Boom snoeien licht", scope: "bomen_onderhoud", normuurPerEenheid: 0.5, eenheid: "stuk", omschrijving: "Lichte snoei boom" },
  { activiteit: "Boom snoeien zwaar", scope: "bomen_onderhoud", normuurPerEenheid: 1.5, eenheid: "stuk", omschrijving: "Zware snoei boom" },
];

// Default products data
const DEFAULT_PRODUCTEN = [
  // Bestrating
  { productnaam: "Betontegel 30x30 grijs", categorie: "Bestrating", inkoopprijs: 1.50, verkoopprijs: 3.50, eenheid: "stuk", leverancier: "Struyk Verwo", verliespercentage: 5 },
  { productnaam: "Betontegel 60x60 grijs", categorie: "Bestrating", inkoopprijs: 8.00, verkoopprijs: 15.00, eenheid: "stuk", leverancier: "Struyk Verwo", verliespercentage: 5 },
  { productnaam: "Klinker waalformaat rood", categorie: "Bestrating", inkoopprijs: 0.35, verkoopprijs: 0.75, eenheid: "stuk", leverancier: "Wienerberger", verliespercentage: 8 },
  { productnaam: "Klinker waalformaat antraciet", categorie: "Bestrating", inkoopprijs: 0.40, verkoopprijs: 0.85, eenheid: "stuk", leverancier: "Wienerberger", verliespercentage: 8 },
  { productnaam: "Natuursteen tegels 60x60", categorie: "Bestrating", inkoopprijs: 35.00, verkoopprijs: 65.00, eenheid: "stuk", leverancier: "Beltrami", verliespercentage: 3 },
  { productnaam: "Opsluitband 100x20x6", categorie: "Bestrating", inkoopprijs: 2.50, verkoopprijs: 5.50, eenheid: "stuk", leverancier: "Struyk Verwo", verliespercentage: 5 },
  // Zand en fundering
  { productnaam: "Straatzand", categorie: "Zand en fundering", inkoopprijs: 18.00, verkoopprijs: 32.00, eenheid: "m³", leverancier: "De Beijer", verliespercentage: 10 },
  { productnaam: "Metselzand", categorie: "Zand en fundering", inkoopprijs: 20.00, verkoopprijs: 35.00, eenheid: "m³", leverancier: "De Beijer", verliespercentage: 10 },
  { productnaam: "Puingranulaat 0-31,5", categorie: "Zand en fundering", inkoopprijs: 12.00, verkoopprijs: 25.00, eenheid: "m³", leverancier: "De Beijer", verliespercentage: 10 },
  { productnaam: "Betonpuin", categorie: "Zand en fundering", inkoopprijs: 8.00, verkoopprijs: 18.00, eenheid: "m³", leverancier: "De Beijer", verliespercentage: 10 },
  // Houtwerk
  { productnaam: "Schuttingplank 180x15cm", categorie: "Houtwerk", inkoopprijs: 3.50, verkoopprijs: 7.50, eenheid: "stuk", leverancier: "Jongeneel", verliespercentage: 5 },
  { productnaam: "Schuttingpaal 7x7x270cm", categorie: "Houtwerk", inkoopprijs: 12.00, verkoopprijs: 25.00, eenheid: "stuk", leverancier: "Jongeneel", verliespercentage: 3 },
  { productnaam: "Vlonderdeel hardhout 21x145mm", categorie: "Houtwerk", inkoopprijs: 8.50, verkoopprijs: 16.00, eenheid: "m", leverancier: "Jongeneel", verliespercentage: 8 },
  { productnaam: "Balk 45x70mm geïmpregneerd", categorie: "Houtwerk", inkoopprijs: 4.50, verkoopprijs: 9.00, eenheid: "m", leverancier: "Jongeneel", verliespercentage: 5 },
  { productnaam: "Betonpoer 30x30x30cm", categorie: "Houtwerk", inkoopprijs: 8.00, verkoopprijs: 16.00, eenheid: "stuk", leverancier: "Struyk Verwo", verliespercentage: 3 },
  // Grond en bodemverbetering
  { productnaam: "Tuinaarde", categorie: "Grond", inkoopprijs: 22.00, verkoopprijs: 40.00, eenheid: "m³", leverancier: "De Beijer", verliespercentage: 10 },
  { productnaam: "Compost", categorie: "Grond", inkoopprijs: 18.00, verkoopprijs: 32.00, eenheid: "m³", leverancier: "De Beijer", verliespercentage: 10 },
  { productnaam: "Boomschors 10-40mm", categorie: "Grond", inkoopprijs: 45.00, verkoopprijs: 75.00, eenheid: "m³", leverancier: "De Beijer", verliespercentage: 5 },
  { productnaam: "Siersplit wit 8-16mm", categorie: "Grond", inkoopprijs: 65.00, verkoopprijs: 110.00, eenheid: "m³", leverancier: "De Beijer", verliespercentage: 5 },
  // Gras
  { productnaam: "Graszoden", categorie: "Gras", inkoopprijs: 3.50, verkoopprijs: 7.50, eenheid: "m²", leverancier: "Graszodenkwekerij", verliespercentage: 5 },
  { productnaam: "Graszaad siergazon", categorie: "Gras", inkoopprijs: 35.00, verkoopprijs: 60.00, eenheid: "kg", leverancier: "Barenbrug", verliespercentage: 10 },
  { productnaam: "Graszaad speelgazon", categorie: "Gras", inkoopprijs: 30.00, verkoopprijs: 50.00, eenheid: "kg", leverancier: "Barenbrug", verliespercentage: 10 },
  // Planten
  { productnaam: "Bodembedekker (pot 9cm)", categorie: "Planten", inkoopprijs: 1.50, verkoopprijs: 4.50, eenheid: "stuk", leverancier: "Kwekerij", verliespercentage: 5 },
  { productnaam: "Heester (3 liter)", categorie: "Planten", inkoopprijs: 8.00, verkoopprijs: 18.00, eenheid: "stuk", leverancier: "Kwekerij", verliespercentage: 5 },
  { productnaam: "Solitaire struik (10 liter)", categorie: "Planten", inkoopprijs: 25.00, verkoopprijs: 55.00, eenheid: "stuk", leverancier: "Kwekerij", verliespercentage: 3 },
  { productnaam: "Haagplant (60-80cm)", categorie: "Planten", inkoopprijs: 6.00, verkoopprijs: 14.00, eenheid: "stuk", leverancier: "Kwekerij", verliespercentage: 5 },
  // Elektra
  { productnaam: "Grondspot LED", categorie: "Elektra", inkoopprijs: 35.00, verkoopprijs: 75.00, eenheid: "stuk", leverancier: "Buitenverlichting.nl", verliespercentage: 2 },
  { productnaam: "Tuinlamp op paal LED", categorie: "Elektra", inkoopprijs: 85.00, verkoopprijs: 165.00, eenheid: "stuk", leverancier: "Buitenverlichting.nl", verliespercentage: 2 },
  { productnaam: "Kabel 3x1,5 grond", categorie: "Elektra", inkoopprijs: 1.50, verkoopprijs: 3.50, eenheid: "m", leverancier: "Elektrotechnisch", verliespercentage: 5 },
  { productnaam: "Lasdoos waterdicht", categorie: "Elektra", inkoopprijs: 4.50, verkoopprijs: 12.00, eenheid: "stuk", leverancier: "Elektrotechnisch", verliespercentage: 5 },
  // Afvoer
  { productnaam: "Afvoer grond (stort)", categorie: "Afvoer", inkoopprijs: 25.00, verkoopprijs: 35.00, eenheid: "m³", leverancier: "Stortplaats", verliespercentage: 0 },
  { productnaam: "Afvoer groenafval", categorie: "Afvoer", inkoopprijs: 15.00, verkoopprijs: 25.00, eenheid: "m³", leverancier: "Stortplaats", verliespercentage: 0 },
  { productnaam: "Afvoer puin", categorie: "Afvoer", inkoopprijs: 18.00, verkoopprijs: 28.00, eenheid: "m³", leverancier: "Stortplaats", verliespercentage: 0 },
];

// System correction factors (shared across all users)
const SYSTEM_CORRECTIEFACTOREN = [
  // Bereikbaarheid
  { type: "bereikbaarheid", waarde: "goed", factor: 1.0 },
  { type: "bereikbaarheid", waarde: "beperkt", factor: 1.2 },
  { type: "bereikbaarheid", waarde: "slecht", factor: 1.5 },
  // Complexiteit
  { type: "complexiteit", waarde: "laag", factor: 1.0 },
  { type: "complexiteit", waarde: "gemiddeld", factor: 1.15 },
  { type: "complexiteit", waarde: "hoog", factor: 1.3 },
  // Intensiteit (beplanting)
  { type: "intensiteit", waarde: "weinig", factor: 0.8 },
  { type: "intensiteit", waarde: "gemiddeld", factor: 1.0 },
  { type: "intensiteit", waarde: "veel", factor: 1.3 },
  // Snijwerk (bestrating)
  { type: "snijwerk", waarde: "laag", factor: 1.0 },
  { type: "snijwerk", waarde: "gemiddeld", factor: 1.2 },
  { type: "snijwerk", waarde: "hoog", factor: 1.4 },
  // Achterstalligheid (onderhoud)
  { type: "achterstalligheid", waarde: "laag", factor: 1.0 },
  { type: "achterstalligheid", waarde: "gemiddeld", factor: 1.3 },
  { type: "achterstalligheid", waarde: "hoog", factor: 1.6 },
  // Hoogteverschil
  { type: "hoogteverschil", waarde: "geen", factor: 1.0 },
  { type: "hoogteverschil", waarde: "licht", factor: 1.1 },
  { type: "hoogteverschil", waarde: "matig", factor: 1.25 },
  { type: "hoogteverschil", waarde: "sterk", factor: 1.5 },
  // Diepte grondwerk
  { type: "diepte", waarde: "licht", factor: 1.0 },
  { type: "diepte", waarde: "standaard", factor: 1.5 },
  { type: "diepte", waarde: "zwaar", factor: 2.0 },
  // Hoogte heggen/bomen
  { type: "hoogte", waarde: "laag", factor: 1.0 },
  { type: "hoogte", waarde: "middel", factor: 1.3 },
  { type: "hoogte", waarde: "hoog", factor: 1.6 },
  // Bodem type (onderhoud)
  { type: "bodem", waarde: "open", factor: 1.2 },
  { type: "bodem", waarde: "bedekt", factor: 0.8 },
  // Snoei type
  { type: "snoei", waarde: "zijkanten", factor: 0.6 },
  { type: "snoei", waarde: "bovenkant", factor: 0.5 },
  { type: "snoei", waarde: "beide", factor: 1.0 },
];

// Helper: Create default normuren for a user
async function createDefaultNormuren(ctx: MutationCtx, userId: Id<"users">) {
  for (const normuur of DEFAULT_NORMUREN) {
    await ctx.db.insert("normuren", {
      userId,
      ...normuur,
    });
  }
}

// Helper: Create default products for a user
async function createDefaultProducten(ctx: MutationCtx, userId: Id<"users">) {
  const now = Date.now();
  for (const product of DEFAULT_PRODUCTEN) {
    await ctx.db.insert("producten", {
      userId,
      ...product,
      isActief: true,
      createdAt: now,
      updatedAt: now,
    });
  }
}

// Helper: Initialize system correction factors (shared across all users)
async function initializeSystemCorrectieFactoren(ctx: MutationCtx) {
  // Check if already initialized
  const existing = await ctx.db
    .query("correctiefactoren")
    .filter((q) => q.eq(q.field("userId"), undefined))
    .first();

  if (existing) return; // Already initialized

  for (const factor of SYSTEM_CORRECTIEFACTOREN) {
    await ctx.db.insert("correctiefactoren", {
      userId: undefined,
      ...factor,
    });
  }
}

// Create or update user (called from Clerk webhook or on first login)
// Also creates default settings, normuren, and products for new users
// Automatically assigns admin role to:
// 1. The first user ever created in the system
// 2. Users with email addresses in the ADMIN_EMAILS list
export const upsert = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    bedrijfsnaam: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Ensure system correction factors are initialized (runs once)
    await initializeSystemCorrectieFactoren(ctx);

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      // Update existing user, but check if they should be upgraded to admin
      const updates: Record<string, string | undefined> = {
        email: args.email,
        name: args.name,
        bedrijfsnaam: args.bedrijfsnaam,
      };

      // Upgrade to admin if email is in admin list and not already admin
      if (isAdminEmail(args.email) && existing.role !== "admin") {
        (updates as Record<string, string>).role = "admin";
      }

      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }

    // Check if this is the first user ever created
    const existingUsers = await ctx.db.query("users").first();
    const isFirstUser = existingUsers === null;

    // Determine role for new user
    // First user is always admin, or if email is in admin list
    // New users get "medewerker" role by default unless they match admin criteria
    const role: "admin" | "medewerker" =
      isFirstUser || isAdminEmail(args.email) ? "admin" : "medewerker";

    // Create new user with appropriate role
    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      bedrijfsnaam: args.bedrijfsnaam,
      role,
      createdAt: Date.now(),
    });

    // Create default settings for new user
    const existingSettings = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!existingSettings) {
      await ctx.db.insert("instellingen", {
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
    }

    // Create default normuren for new user
    await createDefaultNormuren(ctx, userId);

    // Create default products for new user
    await createDefaultProducten(ctx, userId);

    return userId;
  },
});

// Update authenticated user's profile
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    bedrijfsnaam: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const updates: Record<string, string | undefined> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.bedrijfsnaam !== undefined) updates.bedrijfsnaam = args.bedrijfsnaam;

    await ctx.db.patch(user._id, updates);
    return user._id;
  },
});

// Initialize missing defaults for existing users
// Call this if a user is missing normuren or products
// Also ensures user has a proper role set
export const initializeDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const userId = user._id;

    // Ensure system correction factors exist
    await initializeSystemCorrectieFactoren(ctx);

    // Ensure user has a role set
    // If no role is set, check if this is the only user (make admin) or set to "viewer"
    let roleUpdated = false;
    if (!user.role) {
      // Count existing users to determine if this should be admin
      const allUsers = await ctx.db.query("users").collect();
      const isOnlyUser = allUsers.length === 1;
      const shouldBeAdmin = isOnlyUser || isAdminEmail(user.email);

      await ctx.db.patch(userId, {
        role: shouldBeAdmin ? "admin" : "medewerker",
      });
      roleUpdated = true;
    }

    // Check if user already has normuren
    const existingNormuren = await ctx.db
      .query("normuren")
      .withIndex("by_user_scope", (q) => q.eq("userId", userId))
      .first();

    let normurenCreated = 0;
    if (!existingNormuren) {
      await createDefaultNormuren(ctx, userId);
      normurenCreated = DEFAULT_NORMUREN.length;
    }

    // Check if user already has products
    const existingProducten = await ctx.db
      .query("producten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    let productenCreated = 0;
    if (!existingProducten) {
      await createDefaultProducten(ctx, userId);
      productenCreated = DEFAULT_PRODUCTEN.length;
    }

    // Check if user has settings
    const existingSettings = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    let settingsCreated = false;
    if (!existingSettings) {
      await ctx.db.insert("instellingen", {
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
      settingsCreated = true;
    }

    // Run data migrations for archiving system
    const now = Date.now();
    const migrationResults = {
      afgerondFixed: 0,
      gefactureerdUpdated: 0,
      projectsArchived: 0,
      offertesArchived: 0,
    };

    // Get all user projects
    const userProjects = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Fix afgerond projects that have nacalculatie
    for (const project of userProjects) {
      if (project.status === "afgerond") {
        const nacalculatie = await ctx.db
          .query("nacalculaties")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .unique();

        if (nacalculatie) {
          await ctx.db.patch(project._id, {
            status: "nacalculatie_compleet",
            updatedAt: now,
          });
          migrationResults.afgerondFixed++;
        }
      }
    }

    // Get all facturen for user's projects
    const projectIds = userProjects.map((p) => p._id);
    const allFacturen = await ctx.db.query("facturen").collect();
    const userFacturen = allFacturen.filter((f) =>
      projectIds.includes(f.projectId)
    );

    // Update projects with facturen to gefactureerd and archive paid ones
    for (const factuur of userFacturen) {
      const project = userProjects.find((p) => p._id === factuur.projectId);
      if (!project) continue;

      // Update to gefactureerd if has definitief/verzonden/betaald factuur
      if (
        ["definitief", "verzonden", "betaald"].includes(factuur.status) &&
        project.status !== "gefactureerd"
      ) {
        await ctx.db.patch(project._id, {
          status: "gefactureerd",
          updatedAt: now,
        });
        migrationResults.gefactureerdUpdated++;
      }

      // Archive if factuur is betaald
      if (factuur.status === "betaald") {
        if (!project.isArchived) {
          await ctx.db.patch(project._id, {
            isArchived: true,
            archivedAt: now,
          });
          migrationResults.projectsArchived++;
        }

        // Archive offerte too
        if (project.offerteId) {
          const offerte = await ctx.db.get(project.offerteId);
          if (offerte && !offerte.isArchived) {
            await ctx.db.patch(offerte._id, {
              isArchived: true,
              archivedAt: now,
            });
            migrationResults.offertesArchived++;
          }
        }
      }
    }

    return {
      normurenCreated,
      productenCreated,
      settingsCreated,
      roleUpdated,
      migrationResults,
      message:
        normurenCreated > 0 || productenCreated > 0 || settingsCreated || roleUpdated
          ? "Standaard gegevens aangemaakt"
          : "Alle standaard gegevens waren al aanwezig",
    };
  },
});

// Admin query to list all users
export const adminListUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      email: u.email,
      name: u.name,
      clerkId: u.clerkId,
    }));
  },
});

// Admin query to check data ownership
export const adminCheckDataOwnership = query({
  args: {},
  handler: async (ctx) => {
    const normuren = await ctx.db.query("normuren").take(1);
    const producten = await ctx.db.query("producten").take(1);
    const instellingen = await ctx.db.query("instellingen").take(1);

    return {
      normurenSample: normuren[0] ? { userId: normuren[0].userId, activiteit: normuren[0].activiteit } : null,
      productenSample: producten[0] ? { userId: producten[0].userId, productnaam: producten[0].productnaam } : null,
      instellingenSample: instellingen[0] ? { userId: instellingen[0].userId } : null,
    };
  },
});

// Admin function to migrate data from one user to another
// Use this when a user has data under an old userId
export const adminMigrateUserData = mutation({
  args: {
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    let migratedNormuren = 0;
    let migratedProducten = 0;
    let migratedInstellingen = 0;

    // Migrate normuren
    const normuren = await ctx.db
      .query("normuren")
      .filter((q) => q.eq(q.field("userId"), args.fromUserId))
      .collect();

    for (const normuur of normuren) {
      await ctx.db.patch(normuur._id, { userId: args.toUserId });
      migratedNormuren++;
    }

    // Migrate producten
    const producten = await ctx.db
      .query("producten")
      .filter((q) => q.eq(q.field("userId"), args.fromUserId))
      .collect();

    for (const product of producten) {
      await ctx.db.patch(product._id, { userId: args.toUserId });
      migratedProducten++;
    }

    // Migrate instellingen
    const instellingen = await ctx.db
      .query("instellingen")
      .filter((q) => q.eq(q.field("userId"), args.fromUserId))
      .collect();

    for (const instelling of instellingen) {
      await ctx.db.patch(instelling._id, { userId: args.toUserId });
      migratedInstellingen++;
    }

    return {
      success: true,
      migratedNormuren,
      migratedProducten,
      migratedInstellingen,
    };
  },
});

// Admin function to seed data for a specific user by email
// Run this from the Convex dashboard to fix missing defaults
export const adminSeedUserDefaults = mutation({
  args: {
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user by email
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.userEmail))
      .first();

    if (!user) {
      return { error: `User with email ${args.userEmail} not found` };
    }

    const userId = user._id;

    // Initialize system correction factors
    await initializeSystemCorrectieFactoren(ctx);

    // Check and create normuren
    const existingNormuren = await ctx.db
      .query("normuren")
      .withIndex("by_user_scope", (q) => q.eq("userId", userId))
      .first();

    let normurenCreated = 0;
    if (!existingNormuren) {
      await createDefaultNormuren(ctx, userId);
      normurenCreated = DEFAULT_NORMUREN.length;
    }

    // Check and create products
    const existingProducten = await ctx.db
      .query("producten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    let productenCreated = 0;
    if (!existingProducten) {
      await createDefaultProducten(ctx, userId);
      productenCreated = DEFAULT_PRODUCTEN.length;
    }

    // Check and create settings
    const existingSettings = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    let settingsCreated = false;
    if (!existingSettings) {
      await ctx.db.insert("instellingen", {
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
      settingsCreated = true;
    }

    // Run data migrations for archiving system
    const now = Date.now();
    const migrationResults = {
      afgerondFixed: 0,
      gefactureerdUpdated: 0,
      projectsArchived: 0,
      offertesArchived: 0,
    };

    // Get all user projects
    const userProjects = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Fix afgerond projects that have nacalculatie
    for (const project of userProjects) {
      if (project.status === "afgerond") {
        const nacalculatie = await ctx.db
          .query("nacalculaties")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .unique();

        if (nacalculatie) {
          await ctx.db.patch(project._id, {
            status: "nacalculatie_compleet",
            updatedAt: now,
          });
          migrationResults.afgerondFixed++;
        }
      }
    }

    // Get all facturen for user's projects
    const projectIds = userProjects.map((p) => p._id);
    const allFacturen = await ctx.db.query("facturen").collect();
    const userFacturen = allFacturen.filter((f) =>
      projectIds.includes(f.projectId)
    );

    // Update projects with facturen to gefactureerd and archive paid ones
    for (const factuur of userFacturen) {
      const project = userProjects.find((p) => p._id === factuur.projectId);
      if (!project) continue;

      // Update to gefactureerd if has definitief/verzonden/betaald factuur
      if (
        ["definitief", "verzonden", "betaald"].includes(factuur.status) &&
        project.status !== "gefactureerd"
      ) {
        await ctx.db.patch(project._id, {
          status: "gefactureerd",
          updatedAt: now,
        });
        migrationResults.gefactureerdUpdated++;
      }

      // Archive if factuur is betaald
      if (factuur.status === "betaald") {
        if (!project.isArchived) {
          await ctx.db.patch(project._id, {
            isArchived: true,
            archivedAt: now,
          });
          migrationResults.projectsArchived++;
        }

        // Archive offerte too
        if (project.offerteId) {
          const offerte = await ctx.db.get(project.offerteId);
          if (offerte && !offerte.isArchived) {
            await ctx.db.patch(offerte._id, {
              isArchived: true,
              archivedAt: now,
            });
            migrationResults.offertesArchived++;
          }
        }
      }
    }

    return {
      success: true,
      userId: userId,
      userEmail: args.userEmail,
      normurenCreated,
      productenCreated,
      settingsCreated,
      systemFactorsInitialized: true,
      migrationResults,
    };
  },
});

/**
 * Run data migrations for the authenticated user.
 * This applies the archiving logic to existing data:
 * - Fixes project statuses (afgerond -> nacalculatie_compleet if nacalculatie exists)
 * - Updates projects with facturen to "gefactureerd" status
 * - Archives projects and offertes for paid facturen
 */
export const runDataMigrations = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const userId = user._id;
    const now = Date.now();

    const results = {
      afgerondFixedCount: 0,
      statusMigratedCount: 0,
      projectsArchivedCount: 0,
      offertesArchivedCount: 0,
    };

    // 1. Fix afgerond projects that have nacalculatie
    const userProjects = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const afgerondProjects = userProjects.filter((p) => p.status === "afgerond");

    for (const project of afgerondProjects) {
      const nacalculatie = await ctx.db
        .query("nacalculaties")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .unique();

      if (nacalculatie) {
        await ctx.db.patch(project._id, {
          status: "nacalculatie_compleet",
          updatedAt: now,
        });
        results.afgerondFixedCount++;
      }
    }

    // 2. Get all facturen for user's projects
    const projectIds = userProjects.map((p) => p._id);
    const allFacturen = await ctx.db.query("facturen").collect();
    const userFacturen = allFacturen.filter((f) =>
      projectIds.includes(f.projectId)
    );

    // 3. Update projects with facturen to gefactureerd and archive paid ones
    for (const factuur of userFacturen) {
      const project = userProjects.find((p) => p._id === factuur.projectId);
      if (!project) continue;

      // Update to gefactureerd if has definitief/verzonden/betaald factuur
      if (
        ["definitief", "verzonden", "betaald"].includes(factuur.status) &&
        project.status !== "gefactureerd"
      ) {
        await ctx.db.patch(project._id, {
          status: "gefactureerd",
          updatedAt: now,
        });
        results.statusMigratedCount++;
      }

      // Archive if factuur is betaald
      if (factuur.status === "betaald") {
        if (!project.isArchived) {
          await ctx.db.patch(project._id, {
            isArchived: true,
            archivedAt: now,
          });
          results.projectsArchivedCount++;
        }

        // Archive offerte too
        if (project.offerteId) {
          const offerte = await ctx.db.get(project.offerteId);
          if (offerte && !offerte.isArchived) {
            await ctx.db.patch(offerte._id, {
              isArchived: true,
              archivedAt: now,
            });
            results.offertesArchivedCount++;
          }
        }
      }
    }

    return {
      success: true,
      ...results,
      message: `Migratie voltooid: ${results.afgerondFixedCount} projecten status bijgewerkt, ${results.statusMigratedCount} naar gefactureerd, ${results.projectsArchivedCount} projecten gearchiveerd, ${results.offertesArchivedCount} offertes gearchiveerd`,
    };
  },
});

/**
 * Admin function to run data migrations for a specific user by email.
 * No authentication required - intended for CLI use only.
 *
 * Usage: npx convex run users:adminRunMigrations '{"userEmail": "user@example.com"}'
 */
export const adminRunMigrations = mutation({
  args: {
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user by email
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.userEmail))
      .first();

    if (!user) {
      return { error: `User with email ${args.userEmail} not found` };
    }

    const userId = user._id;
    const now = Date.now();

    const results = {
      afgerondFixedCount: 0,
      statusMigratedCount: 0,
      projectsArchivedCount: 0,
      offertesArchivedCount: 0,
    };

    // Get all user projects
    const userProjects = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Fix afgerond projects that have nacalculatie
    for (const project of userProjects) {
      if (project.status === "afgerond") {
        const nacalculatie = await ctx.db
          .query("nacalculaties")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .unique();

        if (nacalculatie) {
          await ctx.db.patch(project._id, {
            status: "nacalculatie_compleet",
            updatedAt: now,
          });
          results.afgerondFixedCount++;
        }
      }
    }

    // Get all facturen for user's projects
    const projectIds = userProjects.map((p) => p._id);
    const allFacturen = await ctx.db.query("facturen").collect();
    const userFacturen = allFacturen.filter((f) =>
      projectIds.includes(f.projectId)
    );

    // Update projects with facturen to gefactureerd and archive paid ones
    for (const factuur of userFacturen) {
      const project = userProjects.find((p) => p._id === factuur.projectId);
      if (!project) continue;

      // Update to gefactureerd if has definitief/verzonden/betaald factuur
      if (
        ["definitief", "verzonden", "betaald"].includes(factuur.status) &&
        project.status !== "gefactureerd"
      ) {
        await ctx.db.patch(project._id, {
          status: "gefactureerd",
          updatedAt: now,
        });
        results.statusMigratedCount++;
      }

      // Archive if factuur is betaald
      if (factuur.status === "betaald") {
        if (!project.isArchived) {
          await ctx.db.patch(project._id, {
            isArchived: true,
            archivedAt: now,
          });
          results.projectsArchivedCount++;
        }

        // Archive offerte too
        if (project.offerteId) {
          const offerte = await ctx.db.get(project.offerteId);
          if (offerte && !offerte.isArchived) {
            await ctx.db.patch(offerte._id, {
              isArchived: true,
              archivedAt: now,
            });
            results.offertesArchivedCount++;
          }
        }
      }
    }

    return {
      success: true,
      userEmail: args.userEmail,
      ...results,
      message: `Migratie voltooid: ${results.afgerondFixedCount} projecten status bijgewerkt, ${results.statusMigratedCount} naar gefactureerd, ${results.projectsArchivedCount} projecten gearchiveerd, ${results.offertesArchivedCount} offertes gearchiveerd`,
    };
  },
});

// ============================================
// ADMIN BOOTSTRAP MUTATIONS
// ============================================

/**
 * Make the currently logged-in user an admin.
 *
 * USAGE:
 * This is a one-time bootstrap mutation intended to be called when setting up the system.
 * It allows the first/current user to claim admin privileges.
 *
 * Security considerations:
 * - This mutation can only be called by an authenticated user
 * - It is designed for initial setup when no admins exist yet
 * - In production, you may want to disable this after initial setup
 *   by checking if any admins already exist
 *
 * To call from Convex Dashboard:
 * 1. Login to your app first (so you have a session)
 * 2. Go to Convex Dashboard > Functions
 * 3. Find users:makeCurrentUserAdmin
 * 4. Click "Run" (no arguments needed)
 *
 * To call programmatically (from authenticated client):
 * ```typescript
 * import { useMutation } from "convex/react";
 * import { api } from "../convex/_generated/api";
 *
 * const makeAdmin = useMutation(api.users.makeCurrentUserAdmin);
 * await makeAdmin({ force: false });
 * ```
 *
 * Arguments:
 * - force: If true, bypasses the "no existing admin" check (use with caution)
 */
export const makeCurrentUserAdmin = mutation({
  args: {
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Check if user is already an admin
    if (user.role === "admin") {
      return {
        success: true,
        message: "Je bent al een admin.",
        wasAlreadyAdmin: true,
      };
    }

    // Safety check: Only allow if no admins exist yet (unless force is true)
    if (!args.force) {
      const existingAdmins = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("role"), "admin"))
        .collect();

      if (existingAdmins.length > 0) {
        return {
          success: false,
          message:
            "Er bestaat al een admin. Gebruik { force: true } om dit te omzeilen, of vraag een bestaande admin om je rechten te geven.",
          existingAdminCount: existingAdmins.length,
        };
      }
    }

    // Make the current user an admin
    await ctx.db.patch(user._id, {
      role: "admin",
    });

    return {
      success: true,
      message: "Je bent nu een admin!",
      userId: user._id,
      email: user.email,
    };
  },
});

/**
 * Admin mutation to set another user's role.
 *
 * USAGE:
 * Only admins can call this mutation to change other users' roles.
 *
 * To call from Convex Dashboard or CLI:
 * ```
 * npx convex run users:setUserRole '{"userEmail": "user@example.com", "role": "admin"}'
 * ```
 *
 * Valid roles: "admin", "viewer", "medewerker"
 */
export const setUserRole = mutation({
  args: {
    userEmail: v.string(),
    role: v.union(v.literal("admin"), v.literal("viewer"), v.literal("medewerker")),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireAuth(ctx);

    // Only admins can change roles
    if (currentUser.role !== "admin") {
      return {
        success: false,
        message: "Alleen admins kunnen gebruikersrollen wijzigen.",
      };
    }

    // Find the target user
    const targetUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.userEmail))
      .first();

    if (!targetUser) {
      return {
        success: false,
        message: `Gebruiker met email ${args.userEmail} niet gevonden.`,
      };
    }

    // Prevent removing your own admin rights
    if (
      targetUser._id.toString() === currentUser._id.toString() &&
      args.role !== "admin"
    ) {
      return {
        success: false,
        message: "Je kunt je eigen admin-rechten niet verwijderen.",
      };
    }

    const oldRole = targetUser.role || "viewer";

    // Update the role
    await ctx.db.patch(targetUser._id, {
      role: args.role,
    });

    return {
      success: true,
      message: `Rol van ${args.userEmail} gewijzigd van "${oldRole}" naar "${args.role}".`,
      userId: targetUser._id,
      oldRole,
      newRole: args.role,
    };
  },
});

/**
 * Get current user's role (for quick role check in UI)
 */
export const getCurrentUserRole = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return { isAuthenticated: false, role: null };
    }
    return {
      isAuthenticated: true,
      role: user.role || "medewerker", // Default to "medewerker" for security
      userId: user._id,
      email: user.email,
      name: user.name,
    };
  },
});

/**
 * List all users with their roles and linked medewerker info - Admin only
 * Used for the user management page
 */
export const listUsersWithDetails = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getAuthenticatedUser(ctx);
    if (!currentUser) {
      return [];
    }

    // Check if user is admin (default to medewerker for security)
    const role = currentUser.role ?? "medewerker";
    if (role !== "admin") {
      return [];
    }

    // Get all users
    const users = await ctx.db.query("users").collect();

    // Get linked medewerkers
    const usersWithDetails = await Promise.all(
      users.map(async (user) => {
        let linkedMedewerker = null;
        if (user.linkedMedewerkerId) {
          linkedMedewerker = await ctx.db.get(user.linkedMedewerkerId);
        }
        return {
          _id: user._id,
          clerkId: user.clerkId,
          email: user.email,
          name: user.name,
          role: user.role ?? "medewerker", // Default to medewerker for security
          linkedMedewerkerId: user.linkedMedewerkerId,
          linkedMedewerkerNaam: linkedMedewerker?.naam ?? null,
          createdAt: user.createdAt,
        };
      })
    );

    return usersWithDetails;
  },
});

/**
 * Link or unlink a user to a medewerker profile - Admin only
 * When linking: sets user role to "medewerker" and updates medewerker.clerkUserId
 * When unlinking: sets user role to "viewer" and clears medewerker.clerkUserId
 */
export const linkUserToMedewerker = mutation({
  args: {
    userId: v.id("users"),
    medewerkerId: v.optional(v.id("medewerkers")),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireAuth(ctx);

    // Check if current user is admin (default to medewerker for security)
    const role = currentUser.role ?? "medewerker";
    if (role !== "admin") {
      throw new Error("Alleen admins kunnen gebruikers koppelen aan medewerkers");
    }

    // Get the target user to access their clerkId
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("Gebruiker niet gevonden");
    }

    // If unlinking, first clear the old medewerker's clerkUserId
    if (targetUser.linkedMedewerkerId && targetUser.linkedMedewerkerId !== args.medewerkerId) {
      const oldMedewerker = await ctx.db.get(targetUser.linkedMedewerkerId);
      if (oldMedewerker) {
        await ctx.db.patch(oldMedewerker._id, { clerkUserId: undefined });
      }
    }

    if (args.medewerkerId) {
      // Linking: verify medewerker exists and set clerkUserId
      const medewerker = await ctx.db.get(args.medewerkerId);
      if (!medewerker) {
        throw new Error("Medewerker niet gevonden");
      }

      // Update medewerker with the user's clerkId
      await ctx.db.patch(args.medewerkerId, { clerkUserId: targetUser.clerkId });

      // Update user: link to medewerker and set role to "medewerker"
      await ctx.db.patch(args.userId, {
        linkedMedewerkerId: args.medewerkerId,
        role: "medewerker",
      });
    } else {
      // Unlinking: set role to "viewer" and clear linkedMedewerkerId
      await ctx.db.patch(args.userId, {
        linkedMedewerkerId: undefined,
        role: "viewer",
      });
    }

    return { success: true };
  },
});

/**
 * Get available medewerkers for linking - Admin only
 * Returns all active medewerkers that don't have a linked user yet (no clerkUserId set)
 */
export const getAvailableMedewerkersForLinking = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getAuthenticatedUser(ctx);
    if (!currentUser) {
      return [];
    }

    // Check if user is admin (default to medewerker for security)
    const role = currentUser.role ?? "medewerker";
    if (role !== "admin") {
      return [];
    }

    // Get ALL active medewerkers that don't have a linked user yet
    const allMedewerkers = await ctx.db
      .query("medewerkers")
      .filter((q) => q.eq(q.field("isActief"), true))
      .collect();

    // Filter out medewerkers that already have a clerkUserId set (already linked to a user)
    const availableMedewerkers = allMedewerkers.filter(
      (m) => !m.clerkUserId
    );

    return availableMedewerkers.map((m) => ({
      _id: m._id,
      naam: m.naam,
      email: m.email ?? null,
      functie: m.functie ?? null,
    }));
  },
});

/**
 * Update user role by ID - Admin only (used by UI)
 */
export const updateUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("medewerker"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireAuth(ctx);

    // Check if current user is admin (default to medewerker for security)
    const currentRole = currentUser.role ?? "medewerker";
    if (currentRole !== "admin") {
      throw new Error("Alleen admins kunnen gebruikersrollen wijzigen");
    }

    // Prevent removing own admin role
    if (currentUser._id === args.userId && args.role !== "admin") {
      throw new Error("Je kunt je eigen admin rechten niet verwijderen");
    }

    await ctx.db.patch(args.userId, { role: args.role });
    return { success: true };
  },
});

/**
 * Admin migration to set all existing users without a role to "admin" role.
 *
 * USAGE:
 * This is a one-time migration mutation to upgrade existing users who don't have
 * a role field set (from before the role system was implemented).
 *
 * To run from CLI:
 * ```
 * npx convex run users:adminMigrateExistingUsersToAdmin
 * ```
 *
 * To run from Convex Dashboard:
 * 1. Go to Convex Dashboard > Functions
 * 2. Find users:adminMigrateExistingUsersToAdmin
 * 3. Click "Run" (no arguments needed)
 */
export const adminMigrateExistingUsersToAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let updatedCount = 0;

    for (const user of users) {
      if (!user.role) {
        await ctx.db.patch(user._id, { role: "admin" });
        updatedCount++;
      }
    }

    return {
      success: true,
      message: `${updatedCount} users updated to admin role`,
      updatedCount,
    };
  },
});

/**
 * CLI-only function to set a user's role by email.
 * No authentication required - for initial setup/bootstrap only.
 *
 * Usage:
 * npx convex run users:cliSetUserRole '{"email": "user@example.com", "role": "admin"}'
 */
export const cliSetUserRole = mutation({
  args: {
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("medewerker"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();

    if (!user) {
      return {
        success: false,
        message: `User with email ${args.email} not found`,
      };
    }

    const oldRole = user.role || "none";
    await ctx.db.patch(user._id, { role: args.role });

    return {
      success: true,
      message: `Role for ${args.email} changed from "${oldRole}" to "${args.role}"`,
      userId: user._id,
      email: args.email,
      oldRole,
      newRole: args.role,
    };
  },
});

// ============================================
// GDPR COMPLIANCE (Article 15 & 17)
// ============================================

/**
 * Export all personal data for the authenticated user (GDPR Article 15 - Right of access)
 *
 * This query collects ALL user data across the system:
 * - User profile (name, email, role)
 * - All offertes created by user
 * - All klanten
 * - All projecten
 * - All facturen
 * - All urenregistraties
 * - All medewerkers (if admin)
 * - Activity logs if any
 */
export const exportPersonalData = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const userId = user._id;

    // 1. User profile data
    const userProfile = {
      id: user._id,
      clerkId: user.clerkId,
      email: user.email,
      name: user.name,
      bedrijfsnaam: user.bedrijfsnaam,
      role: user.role,
      linkedMedewerkerId: user.linkedMedewerkerId,
      createdAt: user.createdAt,
    };

    // 2. Instellingen (settings)
    const instellingen = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    // 3. Klanten (customers)
    const klanten = await ctx.db
      .query("klanten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // 4. Offertes (quotes)
    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // 5. Projecten (projects)
    const projecten = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // 6. Facturen (invoices) - linked to projects
    const projectIds = projecten.map((p) => p._id);
    const allFacturen = await ctx.db.query("facturen").collect();
    const facturen = allFacturen.filter((f) => projectIds.includes(f.projectId));

    // 7. UrenRegistraties (time registrations) - linked to projects
    const allUrenRegistraties = await ctx.db.query("urenRegistraties").collect();
    const urenRegistraties = allUrenRegistraties.filter((u) =>
      projectIds.includes(u.projectId)
    );

    // 8. Voorcalculaties
    const allVoorcalculaties = await ctx.db.query("voorcalculaties").collect();
    const voorcalculaties = allVoorcalculaties.filter(
      (v) =>
        (v.projectId && projectIds.includes(v.projectId)) ||
        (v.offerteId && offertes.some((o) => o._id === v.offerteId))
    );

    // 9. Nacalculaties
    const allNacalculaties = await ctx.db.query("nacalculaties").collect();
    const nacalculaties = allNacalculaties.filter((n) =>
      projectIds.includes(n.projectId)
    );

    // 10. Producten (products/price book)
    const producten = await ctx.db
      .query("producten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // 11. Normuren (standard hours)
    const normuren = await ctx.db
      .query("normuren")
      .withIndex("by_user_scope", (q) => q.eq("userId", userId))
      .collect();

    // 12. Machines
    const machines = await ctx.db
      .query("machines")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // 13. Medewerkers (employees) - only for admin users
    const medewerkers = user.role === "admin"
      ? await ctx.db
          .query("medewerkers")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect()
      : [];

    // 14. Voertuigen (vehicles)
    const voertuigen = await ctx.db
      .query("voertuigen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // 15. Email logs
    const emailLogs = await ctx.db
      .query("email_logs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // 16. Offerte versions (audit trail)
    const offerteIds = offertes.map((o) => o._id);
    const allOfferteVersions = await ctx.db.query("offerte_versions").collect();
    const offerteVersions = allOfferteVersions.filter((v) =>
      offerteIds.includes(v.offerteId)
    );

    // 17. Leerfeedback historie (learning feedback history)
    const leerfeedbackHistorie = await ctx.db
      .query("leerfeedback_historie")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // 18. Teams
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // 19. Location data (if applicable)
    const locationSessions = await ctx.db
      .query("locationSessions")
      .withIndex("by_user_active", (q) => q.eq("userId", userId))
      .collect();

    const locationAuditLog = await ctx.db
      .query("locationAuditLog")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // 20. Notifications
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // 21. Notification preferences
    const notificationPreferences = await ctx.db
      .query("notification_preferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    // 22. Push tokens
    const pushTokens = await ctx.db
      .query("pushTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return {
      exportedAt: Date.now(),
      exportVersion: "1.0",
      gdprArticle: "Article 15 - Right of access",
      user: userProfile,
      instellingen: instellingen
        ? {
            uurtarief: instellingen.uurtarief,
            standaardMargePercentage: instellingen.standaardMargePercentage,
            btwPercentage: instellingen.btwPercentage,
            bedrijfsgegevens: instellingen.bedrijfsgegevens,
            offerteNummerPrefix: instellingen.offerteNummerPrefix,
            laatsteOfferteNummer: instellingen.laatsteOfferteNummer,
          }
        : null,
      klanten: klanten.map((k) => ({
        id: k._id,
        naam: k.naam,
        adres: k.adres,
        postcode: k.postcode,
        plaats: k.plaats,
        email: k.email,
        telefoon: k.telefoon,
        notities: k.notities,
        createdAt: k.createdAt,
        updatedAt: k.updatedAt,
      })),
      offertes: offertes.map((o) => ({
        id: o._id,
        offerteNummer: o.offerteNummer,
        type: o.type,
        status: o.status,
        klant: o.klant,
        totalen: o.totalen,
        regels: o.regels,
        notities: o.notities,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        verzondenAt: o.verzondenAt,
        customerResponse: o.customerResponse,
        isArchived: o.isArchived,
      })),
      projecten: projecten.map((p) => ({
        id: p._id,
        naam: p.naam,
        status: p.status,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        isArchived: p.isArchived,
      })),
      facturen: facturen.map((f) => ({
        id: f._id,
        factuurnummer: f.factuurnummer,
        status: f.status,
        klant: f.klant,
        bedrijf: f.bedrijf,
        regels: f.regels,
        subtotaal: f.subtotaal,
        btwBedrag: f.btwBedrag,
        totaalInclBtw: f.totaalInclBtw,
        factuurdatum: f.factuurdatum,
        vervaldatum: f.vervaldatum,
        createdAt: f.createdAt,
      })),
      urenRegistraties: urenRegistraties.map((u) => ({
        id: u._id,
        datum: u.datum,
        medewerker: u.medewerker,
        uren: u.uren,
        scope: u.scope,
        notities: u.notities,
        bron: u.bron,
      })),
      voorcalculaties: voorcalculaties.map((v) => ({
        id: v._id,
        teamGrootte: v.teamGrootte,
        effectieveUrenPerDag: v.effectieveUrenPerDag,
        normUrenTotaal: v.normUrenTotaal,
        geschatteDagen: v.geschatteDagen,
        createdAt: v.createdAt,
      })),
      nacalculaties: nacalculaties.map((n) => ({
        id: n._id,
        werkelijkeUren: n.werkelijkeUren,
        werkelijkeDagen: n.werkelijkeDagen,
        afwijkingPercentage: n.afwijkingPercentage,
        conclusies: n.conclusies,
        createdAt: n.createdAt,
      })),
      producten: producten.map((p) => ({
        id: p._id,
        productnaam: p.productnaam,
        categorie: p.categorie,
        inkoopprijs: p.inkoopprijs,
        verkoopprijs: p.verkoopprijs,
        eenheid: p.eenheid,
        leverancier: p.leverancier,
        isActief: p.isActief,
      })),
      normuren: normuren.map((n) => ({
        id: n._id,
        activiteit: n.activiteit,
        scope: n.scope,
        normuurPerEenheid: n.normuurPerEenheid,
        eenheid: n.eenheid,
      })),
      machines: machines.map((m) => ({
        id: m._id,
        naam: m.naam,
        type: m.type,
        tarief: m.tarief,
        tariefType: m.tariefType,
        isActief: m.isActief,
      })),
      medewerkers:
        user.role === "admin"
          ? medewerkers.map((m) => ({
              id: m._id,
              naam: m.naam,
              email: m.email,
              telefoon: m.telefoon,
              functie: m.functie,
              isActief: m.isActief,
              createdAt: m.createdAt,
            }))
          : [],
      voertuigen: voertuigen.map((v) => ({
        id: v._id,
        kenteken: v.kenteken,
        merk: v.merk,
        model: v.model,
        type: v.type,
        status: v.status,
      })),
      emailLogs: emailLogs.map((e) => ({
        id: e._id,
        type: e.type,
        to: e.to,
        subject: e.subject,
        status: e.status,
        createdAt: e.createdAt,
      })),
      offerteVersions: offerteVersions.map((v) => ({
        id: v._id,
        versieNummer: v.versieNummer,
        actie: v.actie,
        omschrijving: v.omschrijving,
        createdAt: v.createdAt,
      })),
      leerfeedbackHistorie: leerfeedbackHistorie.map((l) => ({
        id: l._id,
        scope: l.scope,
        activiteit: l.activiteit,
        oudeWaarde: l.oudeWaarde,
        nieuweWaarde: l.nieuweWaarde,
        reden: l.reden,
        createdAt: l.createdAt,
      })),
      teams: teams.map((t) => ({
        id: t._id,
        naam: t.naam,
        beschrijving: t.beschrijving,
        isActief: t.isActief,
        createdAt: t.createdAt,
      })),
      locationSessions: locationSessions.map((l) => ({
        id: l._id,
        status: l.status,
        clockInAt: l.clockInAt,
        clockOutAt: l.clockOutAt,
        privacyLevel: l.privacyLevel,
      })),
      locationAuditLog: locationAuditLog.map((l) => ({
        id: l._id,
        action: l.action,
        details: l.details,
        createdAt: l.createdAt,
      })),
      notifications: notifications.map((n) => ({
        id: n._id,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
      notificationPreferences: notificationPreferences
        ? {
            enablePushNotifications: notificationPreferences.enablePushNotifications,
            notifyOnTeamChat: notificationPreferences.notifyOnTeamChat,
            notifyOnDirectMessage: notificationPreferences.notifyOnDirectMessage,
            respectQuietHours: notificationPreferences.respectQuietHours,
          }
        : null,
      pushTokens: pushTokens.map((p) => ({
        id: p._id,
        platform: p.platform,
        isActive: p.isActive,
        createdAt: p.createdAt,
      })),
      _meta: {
        totalKlanten: klanten.length,
        totalOffertes: offertes.length,
        totalProjecten: projecten.length,
        totalFacturen: facturen.length,
        totalUrenRegistraties: urenRegistraties.length,
        totalProducten: producten.length,
        totalMedewerkers: user.role === "admin" ? medewerkers.length : 0,
      },
    };
  },
});

/**
 * Request data deletion (GDPR Article 17 - Right to erasure)
 *
 * This creates a deletion request record and notifies the admin.
 * Actual data deletion should be handled manually by an admin to ensure
 * compliance with data retention requirements and proper data cleanup.
 */
export const requestDataDeletion = mutation({
  args: {
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Get all admin users to notify
    const adminUsers = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .collect();

    // Create a notification for each admin
    const now = Date.now();
    for (const admin of adminUsers) {
      await ctx.db.insert("notifications", {
        userId: admin._id,
        type: "system_reminder",
        title: "GDPR Verwijderingsverzoek",
        message: `Gebruiker ${user.name} (${user.email}) heeft een verzoek ingediend om alle persoonlijke gegevens te verwijderen.${args.reason ? ` Reden: ${args.reason}` : ""}`,
        isRead: false,
        isDismissed: false,
        triggeredBy: user.clerkId,
        metadata: {
          gdprType: "deletion_request",
          requestedBy: user._id,
          requestedByEmail: user.email,
          requestedByName: user.name,
          reason: args.reason,
          requestedAt: now,
        },
        createdAt: now,
      });
    }

    // Log this action in the location audit log for GDPR compliance
    await ctx.db.insert("locationAuditLog", {
      userId: user._id,
      action: "data_deleted",
      details: `Data deletion requested. Reason: ${args.reason || "Not specified"}`,
      createdAt: now,
    });

    return {
      success: true,
      message:
        "Je verzoek tot verwijdering is ontvangen. De beheerder wordt op de hoogte gesteld en zal contact met je opnemen.",
      requestedAt: now,
      adminNotified: adminUsers.length > 0,
    };
  },
});
