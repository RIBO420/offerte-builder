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

    // Verify medewerker exists if provided
    if (args.medewerkerId) {
      const medewerker = await ctx.db.get(args.medewerkerId);
      if (!medewerker) {
        throw new Error("Medewerker niet gevonden");
      }
    }

    await ctx.db.patch(args.userId, { linkedMedewerkerId: args.medewerkerId });
    return { success: true };
  },
});

/**
 * Get available medewerkers for linking - Admin only
 * Returns all medewerkers (active ones) that can be linked to users
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

    // Get all active medewerkers for this user's company
    const medewerkers = await ctx.db
      .query("medewerkers")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .filter((q) => q.eq(q.field("isActief"), true))
      .collect();

    return medewerkers.map((m) => ({
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
