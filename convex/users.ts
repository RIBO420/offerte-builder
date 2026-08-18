import { v, ConvexError } from "convex/values";
import { mutation, query, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthenticatedUser, requireAuth } from "./auth";
import {
  requireAdmin,
  normalizeRole,
  isAdminRole,
  getCompanyUserId,
} from "./roles";
import { Id } from "./_generated/dataModel";
import { MutationCtx } from "./_generated/server";
import {
  DEFAULT_NORMUREN,
  DEFAULT_PRODUCTEN,
  standaardInstellingen,
} from "./lib/orgDefaults";

// ============================================
// ADMIN CONFIGURATION
// ============================================
//
// Admin users are determined by:
// 1. First user created in the system is automatically an admin
// 2. Users with emails matching ADMIN_EMAILS list are automatically admins
// 3. Existing users can be promoted via makeCurrentUserAdmin() (internal, server-side only)
//
// To add more admin emails, add them to this list:
const ADMIN_EMAILS: string[] = [
  // Add admin email addresses here, e.g.:
  // "admin@toptuinen.nl",
  // "owner@company.com",
  "e2e-test@toptuinen.nl",
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

// Maakt of werkt de user bij op basis van de ingelogde Clerk-identiteit.
// Maakt daarnaast standaardinstellingen, normuren en producten aan voor nieuwe users.
// Kent automatisch de directie-rol toe aan:
// 1. de allereerste user in het systeem
// 2. users met een e-mailadres uit de ADMIN_EMAILS-lijst
//
// SECURITY: clerkId, e-mail en naam komen UITSLUITEND uit het geverifieerde
// Clerk-token (ctx.auth.getUserIdentity()), nooit uit client-args. Kwamen ze uit
// args, dan kon iedereen (1) via de e-mail-fallback het clerkId van een bestaand
// bedrijfsaccount overschrijven en dat account overnemen, en (2) zichzelf met een
// adres uit ADMIN_EMAILS tot directie promoveren. Zie audit §1.
//
// De e-mail-fallback op de by_email-index is helemaal verdwenen: hij kon een
// bestaand account (met rol) herbinden aan een andere Clerk-identiteit, was
// niet-deterministisch bij dubbele adressen (`.first()` zonder uniciteit in het
// schema) en matchte hoofdlettergevoelig terwijl ADMIN_EMAILS dat niet doet.
export const upsert = mutation({
  args: {
    bedrijfsnaam: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Niet ingelogd");
    }

    const clerkId = identity.subject;

    // De e-mail- en naamclaim zijn OPTIONEEL. Welke claims in het Convex-JWT
    // zitten hangt af van het Clerk-JWT-template — dashboardconfiguratie die
    // deze repo niet afdwingt. Alles hieronder moet daarom kloppen mét én
    // zónder claim: een ontbrekende claim mag nooit bestaande gegevens wissen.
    //
    // emailVerified === false betekent expliciet "Clerk heeft dit adres niet
    // geverifieerd"; zo'n adres telt niet mee voor ADMIN_EMAILS en wordt niet
    // opgeslagen. Ontbreekt de claim (undefined), dan is de status onbekend en
    // leunen we op de Clerk-instelling (sign-up staat op "Restricted", adressen
    // worden door de beheerder gezet). Zie het rapport bij audit §1.
    //
    // Het adres wordt genormaliseerd (trim + lowercase) opgeslagen, zodat de
    // by_email-index elders in de codebase deterministisch matcht — dezelfde
    // keuze als in leadsKlantenHelpers.
    const emailClaim = (identity.email ?? "").trim().toLowerCase();
    const emailBruikbaar = emailClaim !== "" && identity.emailVerified !== false;
    const naamClaim = (identity.name ?? identity.givenName ?? "").trim();

    // Ensure system correction factors are initialized (runs once)
    await initializeSystemCorrectieFactoren(ctx);

    // UITSLUITEND op clerkId zoeken. De oude e-mail-fallback herbond een
    // bestaand account — inclusief zijn rol — aan een nieuwe Clerk-identiteit.
    // Wie adres X in zijn token kreeg erfde het account met adres X; realistisch
    // pad: een vertrokken directielid wordt in Clerk verwijderd, het bedrijf
    // hergebruikt het adres voor een nieuwe medewerker, en die logt in als
    // directie. Audit §1 punt 3 vraagt daarom expliciet om geen clerkId-
    // herbinding op basis van e-mail. Gevolg: bij een dev/prod-wissel van
    // Clerk-instantie ontstaat een nieuwe users-rij in plaats van een stille
    // overname; opnieuw koppelen is een bewuste beheerdersactie.
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (existing) {
      // Alleen schrijven wat we ook echt weten: ctx.db.patch VERWIJDERT velden
      // met waarde undefined, dus een onvoorwaardelijk patch-object wist bij
      // elke aanroep het e-mailadres, de bedrijfsnaam of een via updateProfile
      // zelfgekozen naam. Dat zou setUserRole, bootstrapAdminEmails, de
      // e-mailkoppelingen én de e-mailcheck in linkKlantAccount slopen.
      const updates: Record<string, string | undefined> = {};

      if (emailBruikbaar && existing.email !== emailClaim) {
        updates.email = emailClaim;
      }

      // Naam alleen invullen als hij nog ontbreekt of nog op de plaatshouder
      // staat: anders draait elke login de naam terug die de gebruiker zelf via
      // updateProfile heeft gezet.
      if (naamClaim !== "" && (!existing.name || existing.name === "Gebruiker")) {
        updates.name = naamClaim;
      }

      if (args.bedrijfsnaam !== undefined) {
        updates.bedrijfsnaam = args.bedrijfsnaam;
      }

      // Promotie naar directie mag alleen op een adres dat we vertrouwen.
      if (
        emailBruikbaar &&
        isAdminEmail(emailClaim) &&
        !isAdminRole(existing.role)
      ) {
        updates.role = "directie";
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
      }
      return existing._id;
    }

    // Check if this is the first user ever created
    const existingUsers = await ctx.db.query("users").first();
    const isFirstUser = existingUsers === null;

    // Determine role for new user
    // First user is always directie, or if email is in admin list
    // New users get "medewerker" role by default unless they match directie criteria
    const role: "directie" | "medewerker" =
      isFirstUser || (emailBruikbaar && isAdminEmail(emailClaim))
        ? "directie"
        : "medewerker";

    // Create new user with appropriate role
    const userId = await ctx.db.insert("users", {
      clerkId,
      email: emailBruikbaar ? emailClaim : "",
      name: naamClaim !== "" ? naamClaim : "Gebruiker",
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
        ...standaardInstellingen(),
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
    // If no role is set, check if this is the only user (make directie) or set to "medewerker"
    let roleUpdated = false;
    if (!user.role) {
      // Count existing users to determine if this should be admin
      const allUsers = await ctx.db.query("users").collect();
      const isOnlyUser = allUsers.length === 1;
      const shouldBeAdmin = isOnlyUser || isAdminEmail(user.email);

      await ctx.db.patch(userId, {
        role: shouldBeAdmin ? "directie" : "medewerker",
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
        ...standaardInstellingen(),
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
      f.projectId !== undefined && projectIds.includes(f.projectId)
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

// Admin query to list all users (directie only — lekte voorheen alle e-mails/clerkIds zonder login)
export const adminListUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      email: u.email,
      name: u.name,
      clerkId: u.clerkId,
    }));
  },
});

// Admin query to check data ownership (directie only)
export const adminCheckDataOwnership = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
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
    await requireAdmin(ctx);

    let migratedNormuren = 0;
    let migratedProducten = 0;
    let migratedInstellingen = 0;

    // fromUserId/toUserId zijn hier de bedrijfsscope: dit is een directie-only
    // hersteltool om data van een oud naar een nieuw bedrijfsaccount te tillen.
    // De by_user-indexen doen wat de .filter()-scans deden, maar zonder de hele
    // tabel van alle bedrijven te lezen.
    const normuren = await ctx.db
      .query("normuren")
      .withIndex("by_user", (q) => q.eq("userId", args.fromUserId))
      .collect();

    for (const normuur of normuren) {
      await ctx.db.patch(normuur._id, { userId: args.toUserId });
      migratedNormuren++;
    }

    // Migrate producten
    const producten = await ctx.db
      .query("producten")
      .withIndex("by_user", (q) => q.eq("userId", args.fromUserId))
      .collect();

    for (const product of producten) {
      await ctx.db.patch(product._id, { userId: args.toUserId });
      migratedProducten++;
    }

    // Migrate instellingen
    const instellingen = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", args.fromUserId))
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
    await requireAdmin(ctx);

    // Find user by email — bewust over alle accounts heen: dit is een
    // directie-only hersteltool die per e-mailadres een specifiek account
    // opzoekt. Via by_email in plaats van een .filter()-scan.
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
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
        ...standaardInstellingen(),
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
      f.projectId !== undefined && projectIds.includes(f.projectId)
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
      f.projectId !== undefined && projectIds.includes(f.projectId)
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
    await requireAdmin(ctx);

    // Find user by email — bewust over alle accounts heen (directie-only
    // migratietool, zie requireAdmin hierboven). by_email in plaats van scan.
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
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
      f.projectId !== undefined && projectIds.includes(f.projectId)
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
 * Make a user an admin (internal only — not callable from clients).
 *
 * This is a bootstrap utility for first-time setup or server-side admin
 * provisioning. It can only be invoked from other Convex functions
 * (actions, scheduled jobs, the Convex dashboard), never from a client.
 *
 * USAGE:
 * From Convex Dashboard > Functions > users:makeCurrentUserAdmin > "Run"
 * Or from another server-side function:
 * ```typescript
 * import { internal } from "./_generated/api";
 * await ctx.runMutation(internal.users.makeCurrentUserAdmin, { userId });
 * ```
 *
 * Arguments:
 * - userId: The ID of the user to promote to admin
 */
export const makeCurrentUserAdmin = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) {
      return {
        success: false,
        message: "Gebruiker niet gevonden.",
      };
    }

    // Check if user is already directie (admin)
    if (isAdminRole(user.role)) {
      return {
        success: true,
        message: "Gebruiker is al een admin (directie).",
        wasAlreadyAdmin: true,
      };
    }

    // Safety check: Only allow if no admins/directie exist yet
    //
    // Deze query kijkt bewust systeembreed en niet per bedrijf: hij wijst de
    // állereerste directie aan, dus er is op dat moment nog geen bedrijfsscope
    // om op te filteren. Dat is veilig omdat dit een internalMutation is
    // (alleen server-side aanroepbaar, nooit vanaf een client) en de check
    // hieronder afbreekt zodra er ergens al een directie bestaat.
    //
    // Wel via de by_role-index in plaats van een .filter()-scan: zo worden
    // alleen de directie-/admin-rijen gelezen en niet de hele users-tabel.
    const directieUsers = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "directie"))
      .collect();
    const legacyAdminUsers = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .collect();
    const existingAdmins = [...directieUsers, ...legacyAdminUsers];

    if (existingAdmins.length > 0) {
      return {
        success: false,
        message:
          "Er bestaat al een admin (directie). Gebruik setUserRole via een bestaande admin om rechten te geven.",
        existingAdminCount: existingAdmins.length,
      };
    }

    // Make the user directie
    await ctx.db.patch(user._id, {
      role: "directie",
    });

    return {
      success: true,
      message: "Gebruiker is nu directie (admin)!",
      userId: user._id,
      email: user.email,
    };
  },
});

/**
 * Bootstrap: past de ADMIN_EMAILS-lijst toe op reeds bestaande accounts.
 *
 * users:store promoveert ADMIN_EMAILS-accounts alleen bij login/upsert;
 * accounts die vóór opname in de lijst zijn aangemaakt (zoals het
 * e2e-testaccount op dev) blijven daardoor op hun oude rol staan.
 * Deze internal mutation repareert dat: alle users van wie het e-mailadres
 * in ADMIN_EMAILS staat en die nog geen directie/admin zijn, worden
 * directie. Andere accounts worden niet aangeraakt.
 *
 * Alleen server-side aan te roepen (dashboard of CLI met deploy-rechten):
 * ```
 * npx convex run users:bootstrapAdminEmails
 * ```
 */
export const bootstrapAdminEmails = internalMutation({
  args: {},
  handler: async (ctx) => {
    const promoted: { email: string; oldRole: string }[] = [];

    for (const email of ADMIN_EMAILS) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();

      if (user && !isAdminRole(user.role)) {
        promoted.push({
          email: user.email,
          oldRole: normalizeRole(user.role),
        });
        await ctx.db.patch(user._id, { role: "directie" });
      }
    }

    return {
      success: true,
      message:
        promoted.length > 0
          ? `${promoted.length} account(s) gepromoveerd naar directie`
          : "Geen accounts te promoveren (alles al up-to-date)",
      promoted,
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
 * Valid roles: "directie", "projectleider", "voorman", "medewerker", "klant", "onderaannemer_zzp", "materiaalman"
 * Legacy roles "admin" and "viewer" are accepted and normalized automatically.
 */
export const setUserRole = mutation({
  args: {
    userEmail: v.string(),
    role: v.union(
      v.literal("directie"),
      v.literal("projectleider"),
      v.literal("voorman"),
      v.literal("medewerker"),
      v.literal("klant"),
      v.literal("onderaannemer_zzp"),
      v.literal("materiaalman"),
      // Legacy compat
      v.literal("admin"),
      v.literal("viewer")
    ),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireAuth(ctx);

    // Only directie/admin can change roles
    if (!isAdminRole(currentUser.role)) {
      return {
        success: false,
        message: "Alleen directie kan gebruikersrollen wijzigen.",
      };
    }

    // Find the target user — rolbeheer draait om het users-record zelf, dat
    // (anders dan de bedrijfsdata) geen userId-scope kent; de directie-check
    // hierboven is daarom de enige poort. by_email in plaats van scan.
    const targetUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!targetUser) {
      return {
        success: false,
        message: `Gebruiker met email ${args.userEmail} niet gevonden.`,
      };
    }

    // Normalize the requested role (admin -> directie, viewer -> klant)
    const newRole = normalizeRole(args.role);

    // Prevent removing your own directie rights
    if (
      targetUser._id.toString() === currentUser._id.toString() &&
      newRole !== "directie"
    ) {
      return {
        success: false,
        message: "Je kunt je eigen directie-rechten niet verwijderen.",
      };
    }

    const oldRole = normalizeRole(targetUser.role);

    // Update the role (always save normalized)
    await ctx.db.patch(targetUser._id, {
      role: newRole,
    });

    return {
      success: true,
      message: `Rol van ${args.userEmail} gewijzigd van "${oldRole}" naar "${newRole}".`,
      userId: targetUser._id,
      oldRole,
      newRole,
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
    const role = normalizeRole(user.role);
    return {
      isAuthenticated: true,
      role,
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

    // Check if user is directie (admin)
    if (!isAdminRole(currentUser.role)) {
      return [];
    }

    // LET OP — bewust systeembreed, met een bekende beperking:
    // de users-tabel heeft geen userId/bedrijfskolom (bedrijfsscope loopt via
    // medewerkers.userId), dus er is hier niets om op te scopen. Een pas
    // aangemaakt account is nog nergens aan gekoppeld en moet juist in deze
    // lijst verschijnen om gekoppeld te KUNNEN worden — filteren zou dat
    // onmogelijk maken. De directie-check hierboven is daarom de enige poort.
    // De koppel-acties zelf (linkUserToMedewerker) zijn wél bedrijfsgescoped.
    // Echte scoping vraagt een schemawijziging (bedrijfsveld op users).
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
          role: normalizeRole(user.role),
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
 * When unlinking: sets user role to "klant" and clears medewerker.clerkUserId
 */
export const linkUserToMedewerker = mutation({
  args: {
    userId: v.id("users"),
    medewerkerId: v.optional(v.id("medewerkers")),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireAuth(ctx);

    // Check if current user is directie (admin)
    if (!isAdminRole(currentUser.role)) {
      throw new ConvexError("Alleen directie kan gebruikers koppelen aan medewerkers");
    }

    // Get the target user to access their clerkId
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new ConvexError("Gebruiker niet gevonden");
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
        throw new ConvexError("Medewerker niet gevonden");
      }

      // Tenant-check: medewerkerId komt uit de client, dus zonder deze controle
      // kan directie van bedrijf A een account koppelen aan een medewerker van
      // bedrijf B (en daarmee diens clerkUserId overschrijven). De lijst uit
      // getAvailableMedewerkersForLinking is al bedrijfsgescoped; deze check
      // maakt die scope ook afdwingbaar.
      const companyUserId = await getCompanyUserId(ctx);
      if (medewerker.userId.toString() !== companyUserId.toString()) {
        throw new ConvexError("Medewerker hoort niet bij dit bedrijf");
      }

      // Update medewerker with the user's clerkId
      await ctx.db.patch(args.medewerkerId, { clerkUserId: targetUser.clerkId });

      // Update user: link to medewerker and set role to "medewerker"
      await ctx.db.patch(args.userId, {
        linkedMedewerkerId: args.medewerkerId,
        role: "medewerker",
      });
    } else {
      // Unlinking: set role to "klant" and clear linkedMedewerkerId
      await ctx.db.patch(args.userId, {
        linkedMedewerkerId: undefined,
        role: "klant",
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

    // Check if user is directie (admin)
    if (!isAdminRole(currentUser.role)) {
      return [];
    }

    // Medewerkers zijn tenant-data (medewerkers.userId = het bedrijfsaccount).
    // Zonder deze scope kreeg directie de actieve medewerkers van ÁLLE
    // bedrijven in de koppellijst te zien — inclusief naam, e-mail en functie
    // (audit §2). Alleen medewerkers van het eigen bedrijf zijn hier relevant,
    // want koppelen mag sowieso niet buiten het eigen bedrijf.
    const companyUserId = await getCompanyUserId(ctx);
    const allMedewerkers = await ctx.db
      .query("medewerkers")
      .withIndex("by_user_actief", (q) =>
        q.eq("userId", companyUserId).eq("isActief", true)
      )
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
    role: v.union(
      v.literal("directie"),
      v.literal("projectleider"),
      v.literal("voorman"),
      v.literal("medewerker"),
      v.literal("klant"),
      v.literal("onderaannemer_zzp"),
      v.literal("materiaalman"),
      // Legacy compat
      v.literal("admin"),
      v.literal("viewer")
    ),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireAuth(ctx);

    // Check if current user is directie (admin)
    if (!isAdminRole(currentUser.role)) {
      throw new ConvexError("Alleen directie kan gebruikersrollen wijzigen");
    }

    // Normalize the requested role
    const newRole = normalizeRole(args.role);

    // Prevent removing own directie role
    if (currentUser._id === args.userId && newRole !== "directie") {
      throw new ConvexError("Je kunt je eigen directie rechten niet verwijderen");
    }

    await ctx.db.patch(args.userId, { role: newRole });
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
    // Bootstrap-migratie is afgerond (zie roles.ts) — nu directie-only om
    // privilege-escalatie via dit publieke endpoint uit te sluiten.
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    let updatedCount = 0;

    for (const user of users) {
      if (!user.role) {
        await ctx.db.patch(user._id, { role: "directie" });
        updatedCount++;
      }
    }

    return {
      success: true,
      message: `${updatedCount} users updated to directie role`,
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
    role: v.union(
      v.literal("directie"),
      v.literal("projectleider"),
      v.literal("voorman"),
      v.literal("medewerker"),
      v.literal("klant"),
      v.literal("onderaannemer_zzp"),
      v.literal("materiaalman"),
      // Legacy compat
      v.literal("admin"),
      v.literal("viewer")
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Zelfde als setUserRole: directie-only rolbeheer per e-mailadres,
    // via by_email in plaats van een scan over alle users.
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      return {
        success: false,
        message: `User with email ${args.email} not found`,
      };
    }

    const oldRole = normalizeRole(user.role);
    const newRole = normalizeRole(args.role);
    await ctx.db.patch(user._id, { role: newRole });

    return {
      success: true,
      message: `Role for ${args.email} changed from "${oldRole}" to "${newRole}"`,
      userId: user._id,
      email: args.email,
      oldRole,
      newRole,
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
    const facturen = allFacturen.filter(
      (f) => f.projectId !== undefined && projectIds.includes(f.projectId)
    );

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
    const medewerkers = isAdminRole(user.role)
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
        isAdminRole(user.role)
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
        totalMedewerkers: isAdminRole(user.role) ? medewerkers.length : 0,
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

    // Een verwijderingsverzoek hoort alleen bij de directie van het EIGEN
    // bedrijf terecht te komen. Voorheen kreeg de directie van élk bedrijf in
    // het systeem een notificatie met naam én e-mailadres van de aanvrager —
    // zelf een datalek binnen een AVG-functie (audit §2).
    //
    // Bewust NIET via getCompanyUserId: die helper geeft voor een klant het
    // eigen account terug (klanten zien alleen hun eigen data), terwijl het
    // verzoek juist naar het hovenierbedrijf achter dat klantrecord moet.
    const rol = normalizeRole(user.role);
    let companyUserId: Id<"users"> | null = null;

    if (rol === "directie") {
      // Directie IS het bedrijfsaccount waar alle bedrijfsdata aan hangt.
      companyUserId = user._id;
    } else if (user.linkedMedewerkerId) {
      const eigenMedewerker = await ctx.db.get(user.linkedMedewerkerId);
      companyUserId = eigenMedewerker?.userId ?? null;
    } else if (user.linkedKlantId) {
      const eigenKlant = await ctx.db.get(user.linkedKlantId);
      companyUserId = eigenKlant?.userId ?? null;
    }

    const teNotificeren = new Map<string, Id<"users">>();

    if (companyUserId) {
      const bedrijfsAccount = await ctx.db.get(companyUserId);
      if (bedrijfsAccount) {
        teNotificeren.set(bedrijfsAccount._id.toString(), bedrijfsAccount._id);
      }

      // Overige directie-accounts binnen hetzelfde bedrijf zijn herkenbaar aan
      // hun gekoppelde medewerker (medewerkers.userId = bedrijfsaccount). De
      // by_role-index leest alleen de directie-rijen in plaats van de hele
      // users-tabel te scannen.
      for (const adminRol of ["directie", "admin"] as const) {
        const adminsMetRol = await ctx.db
          .query("users")
          .withIndex("by_role", (q) => q.eq("role", adminRol))
          .collect();

        for (const admin of adminsMetRol) {
          if (teNotificeren.has(admin._id.toString())) continue;
          if (!admin.linkedMedewerkerId) continue;

          const medewerker = await ctx.db.get(admin.linkedMedewerkerId);
          if (
            medewerker &&
            medewerker.userId.toString() === companyUserId.toString()
          ) {
            teNotificeren.set(admin._id.toString(), admin._id);
          }
        }
      }
    }

    // Is het account nog nergens aan gekoppeld, dan is er geen bedrijf te
    // bepalen. Dan liever niemand notificeren (elke andere keuze is een
    // cross-tenant lek) — de auditlog hieronder legt het verzoek wél vast en
    // adminNotified: false vertelt de gebruiker dat er handmatig contact nodig is.
    const adminUserIds = [...teNotificeren.values()];

    // Create a notification for each admin
    const now = Date.now();
    for (const adminUserId of adminUserIds) {
      await ctx.db.insert("notifications", {
        userId: adminUserId,
        type: "system_reminder",
        title: "GDPR Verwijderingsverzoek",
        message: `Gebruiker ${user.name} (${user.email}) heeft een verzoek ingediend om alle persoonlijke gegevens te verwijderen.${args.reason ? ` Reden: ${args.reason}` : ""}`,
        isRead: false,
        isDismissed: false,
        triggeredBy: user.clerkId,
        metadata: {
          gdprType: "deletion_request",
          requestedBy: user._id.toString(),
          requestedByEmail: user.email,
          requestedByName: user.name,
          ...(args.reason ? { reason: args.reason } : {}),
          requestedAt: now.toString(),
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
      adminNotified: adminUserIds.length > 0,
    };
  },
});

// ============================================
// KLANTENPORTAAL: ACCOUNT LINKING
// ============================================

/**
 * Link a newly registered klant user to their klant profile via invitation token.
 * Called after the klant registers through Clerk using the invitation link.
 *
 * Flow:
 * 1. Klant receives invitation link with token
 * 2. Klant registers via Clerk
 * 3. Frontend calls this mutation with the token
 * 4. This mutation links the user to the klant record
 */
export const linkKlantAccount = mutation({
  args: {
    invitationToken: v.string(),
  },
  handler: async (ctx, args) => {
    // Require the just-registered user to be authenticated
    const user = await requireAuth(ctx);

    // Find klant by invitation token
    const klant = await ctx.db
      .query("klanten")
      .withIndex("by_invitation_token", (q) =>
        q.eq("invitationToken", args.invitationToken)
      )
      .unique();

    if (!klant) {
      throw new ConvexError("Ongeldige uitnodigingslink. Neem contact op met het bedrijf.");
    }

    // Validate token not expired
    if (klant.invitationExpiresAt && klant.invitationExpiresAt < Date.now()) {
      throw new ConvexError(
        "De uitnodigingslink is verlopen. Vraag het bedrijf om een nieuwe uitnodiging."
      );
    }

    // Validate klant doesn't already have a linked Clerk user
    if (klant.clerkUserId) {
      throw new ConvexError(
        "Dit klantaccount is al gekoppeld aan een gebruiker."
      );
    }

    // Verify email match (if both have email)
    if (klant.email && user.email) {
      if (klant.email.toLowerCase() !== user.email.toLowerCase()) {
        throw new ConvexError(
          "Het e-mailadres waarmee je bent geregistreerd komt niet overeen met het e-mailadres van de klant. Registreer met het juiste e-mailadres."
        );
      }
    }

    const now = Date.now();

    // Link accounts: update klant record
    await ctx.db.patch(klant._id, {
      clerkUserId: user.clerkId,
      invitationToken: undefined,
      invitationExpiresAt: undefined,
      lastLoginAt: now,
      updatedAt: now,
    });

    // Update user with klant role and linked klant ID
    await ctx.db.patch(user._id, {
      role: "klant",
      linkedKlantId: klant._id,
    });

    // Schedule Clerk metadata update to set role in Clerk's public metadata
    await ctx.scheduler.runAfter(0, internal.users.setClerkMetadata, {
      clerkUserId: user.clerkId,
      metadata: { role: "klant" },
    });

    return {
      success: true,
      klantId: klant._id,
      klantNaam: klant.naam,
    };
  },
});

/**
 * Internal action to update Clerk user public metadata.
 * Uses Clerk REST API directly (Convex cannot use @clerk/nextjs).
 * Scheduled by linkKlantAccount after successful account linking.
 */
/**
 * Delete a user from Convex and Clerk. Admin only.
 * Removes the Convex user record and schedules Clerk user deletion.
 */
export const deleteUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const admin = await requireAuth(ctx);
    const adminRole = normalizeRole(admin.role);
    if (adminRole !== "directie") {
      throw new ConvexError("Alleen directie kan gebruikers verwijderen");
    }

    // Prevent self-deletion
    if (admin._id === args.userId) {
      throw new ConvexError("Je kunt jezelf niet verwijderen");
    }

    const userToDelete = await ctx.db.get(args.userId);
    if (!userToDelete) {
      throw new ConvexError("Gebruiker niet gevonden");
    }

    // If user is linked to a klant, clear the klant's clerkUserId
    if (userToDelete.linkedKlantId) {
      const klant = await ctx.db.get(userToDelete.linkedKlantId);
      if (klant) {
        await ctx.db.patch(klant._id, {
          clerkUserId: undefined,
          portalEnabled: false,
          invitationToken: undefined,
          invitationExpiresAt: undefined,
        });
      }
    }

    // Delete the Convex user record
    await ctx.db.delete(args.userId);

    // Schedule Clerk user deletion
    await ctx.scheduler.runAfter(0, internal.users.deleteClerkUser, {
      clerkUserId: userToDelete.clerkId,
    });

    return { success: true, deletedEmail: userToDelete.email };
  },
});

/**
 * Internal action to delete a user from Clerk via REST API.
 */
export const deleteClerkUser = internalAction({
  args: { clerkUserId: v.string() },
  handler: async (_ctx, args) => {
    const response = await fetch(
      `https://api.clerk.com/v1/users/${args.clerkUserId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        },
      }
    );
    if (!response.ok) {
      console.error(
        `[users/deleteClerkUser] Failed to delete Clerk user ${args.clerkUserId}: ${response.statusText}`
      );
    }
  },
});

export const setClerkMetadata = internalAction({
  args: {
    clerkUserId: v.string(),
    metadata: v.object({ role: v.string() }),
  },
  handler: async (_ctx, args) => {
    const response = await fetch(
      `https://api.clerk.com/v1/users/${args.clerkUserId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          public_metadata: args.metadata,
        }),
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to update Clerk metadata: ${response.statusText}`);
    }
  },
});
