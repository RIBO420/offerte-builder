import { v, ConvexError } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import { requireAuth, requireAuthUserId, getOwnedKlant, generateSecureToken } from "./auth";
import { requireNotViewer, requireAdmin } from "./roles";
import {
  sanitizeEmail,
  sanitizePhone,
  validateRequiredPostcode,
  sanitizeOptionalString,
  VALIDATION_MESSAGES,
} from "./validators";
import { shouldUpgradePipeline } from "./pipelineHelpers";

// Get all klanten for authenticated user
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db
      .query("klanten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

// Get recent klanten (last 5)
export const getRecent = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db
      .query("klanten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(5);
  },
});

// Get a single klant by ID (with ownership verification)
export const get = query({
  args: { id: v.id("klanten") },
  handler: async (ctx, args) => {
    const klant = await ctx.db.get(args.id);
    if (!klant) return null;

    // Verify ownership
    const user = await requireAuth(ctx);
    if (klant.userId.toString() !== user._id.toString()) {
      return null;
    }

    return klant;
  },
});

// Get klant with their offertes (with ownership verification)
export const getWithOffertes = query({
  args: { id: v.id("klanten") },
  handler: async (ctx, args) => {
    const klant = await ctx.db.get(args.id);
    if (!klant) return null;

    // Verify ownership
    const user = await requireAuth(ctx);
    if (klant.userId.toString() !== user._id.toString()) {
      return null;
    }

    // Get all offertes for this klant
    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", klant.userId))
      .filter((q) => q.eq(q.field("klantId"), args.id))
      .order("desc")
      .collect();

    return {
      ...klant,
      offertes,
    };
  },
});

// Search klanten by name
export const search = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    if (!args.searchTerm.trim()) {
      // Return recent klanten if no search term
      return await ctx.db
        .query("klanten")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(10);
    }

    // Use search index
    return await ctx.db
      .query("klanten")
      .withSearchIndex("search_klanten", (q) =>
        q.search("naam", args.searchTerm).eq("userId", userId)
      )
      .take(10);
  },
});

// CRM-003: Klant type validator
const klantTypeValidator = v.optional(v.union(
  v.literal("particulier"),
  v.literal("zakelijk"),
  v.literal("vve"),
  v.literal("gemeente"),
  v.literal("overig"),
));

// Create a new klant
export const create = mutation({
  args: {
    naam: v.string(),
    adres: v.string(),
    postcode: v.string(),
    plaats: v.string(),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    notities: v.optional(v.string()),
    klantType: klantTypeValidator,
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    // Validate required fields
    if (!args.naam.trim()) {
      throw new ConvexError("Naam is verplicht");
    }
    if (!args.adres.trim()) {
      throw new ConvexError("Adres is verplicht");
    }
    if (!args.plaats.trim()) {
      throw new ConvexError("Plaats is verplicht");
    }

    // Validate and sanitize fields
    const postcode = validateRequiredPostcode(args.postcode);
    const email = sanitizeEmail(args.email);
    const telefoon = sanitizePhone(args.telefoon);
    const notities = sanitizeOptionalString(args.notities);

    // Sanitize tags: trim, lowercase, remove empties, deduplicate
    const sanitizedTags = args.tags
      ? [...new Set(args.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))]
      : undefined;

    return await ctx.db.insert("klanten", {
      userId,
      naam: args.naam.trim(),
      adres: args.adres.trim(),
      postcode,
      plaats: args.plaats.trim(),
      email,
      telefoon,
      notities,
      pipelineStatus: "lead",
      klantType: args.klantType ?? "particulier",
      tags: sanitizedTags,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update a klant
export const update = mutation({
  args: {
    id: v.id("klanten"),
    naam: v.optional(v.string()),
    adres: v.optional(v.string()),
    postcode: v.optional(v.string()),
    plaats: v.optional(v.string()),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    notities: v.optional(v.string()),
    klantType: klantTypeValidator,
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    // Verify ownership
    await getOwnedKlant(ctx, args.id);

    const filteredUpdates: Record<string, unknown> = {};

    // Validate and sanitize each field if provided
    if (args.naam !== undefined) {
      if (!args.naam.trim()) {
        throw new ConvexError("Naam is verplicht");
      }
      filteredUpdates.naam = args.naam.trim();
    }

    if (args.adres !== undefined) {
      if (!args.adres.trim()) {
        throw new ConvexError("Adres is verplicht");
      }
      filteredUpdates.adres = args.adres.trim();
    }

    if (args.postcode !== undefined) {
      filteredUpdates.postcode = validateRequiredPostcode(args.postcode);
    }

    if (args.plaats !== undefined) {
      if (!args.plaats.trim()) {
        throw new ConvexError("Plaats is verplicht");
      }
      filteredUpdates.plaats = args.plaats.trim();
    }

    if (args.email !== undefined) {
      filteredUpdates.email = sanitizeEmail(args.email);
    }

    if (args.telefoon !== undefined) {
      filteredUpdates.telefoon = sanitizePhone(args.telefoon);
    }

    if (args.notities !== undefined) {
      filteredUpdates.notities = sanitizeOptionalString(args.notities);
    }

    if (args.klantType !== undefined) {
      filteredUpdates.klantType = args.klantType;
    }

    if (args.tags !== undefined) {
      // Sanitize tags: trim, lowercase, remove empties, deduplicate
      filteredUpdates.tags = [...new Set(args.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
    }

    await ctx.db.patch(args.id, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
  },
});

// Delete a klant
export const remove = mutation({
  args: { id: v.id("klanten") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    // Verify ownership
    const klant = await getOwnedKlant(ctx, args.id);

    // Check if there are offertes linked to this klant
    const linkedOffertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", klant.userId))
      .filter((q) => q.eq(q.field("klantId"), args.id))
      .take(1);

    if (linkedOffertes.length > 0) {
      throw new ConvexError(
        "Deze klant heeft gekoppelde offertes en kan niet worden verwijderd. Verwijder eerst de offertes."
      );
    }

    await ctx.db.delete(args.id);
  },
});

// Combined query for klanten list with recent - reduces 2 round-trips to 1
export const listWithRecent = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const klanten = await ctx.db
      .query("klanten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return {
      klanten,
      recentKlanten: klanten.slice(0, 5),
    };
  },
});

// CRM-003: Get all unique tags used across klanten (for autocomplete)
export const getAllTags = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const klanten = await ctx.db
      .query("klanten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const tagSet = new Set<string>();
    for (const klant of klanten) {
      if (klant.tags) {
        for (const tag of klant.tags) {
          tagSet.add(tag);
        }
      }
    }
    return [...tagSet].sort();
  },
});

// CRM-007: Check for duplicate klanten based on email, telefoon, or naam+postcode
export const checkDuplicates = query({
  args: {
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    naam: v.optional(v.string()),
    postcode: v.optional(v.string()),
    excludeId: v.optional(v.id("klanten")),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const klanten = await ctx.db
      .query("klanten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const duplicates: Array<{
      _id: string;
      naam: string;
      matchType: "email" | "telefoon" | "naam_postcode";
    }> = [];
    const seen = new Set<string>();

    for (const klant of klanten) {
      if (args.excludeId && klant._id === args.excludeId) continue;

      // Check email match
      if (
        args.email &&
        klant.email &&
        args.email.trim().toLowerCase() === klant.email.toLowerCase()
      ) {
        if (!seen.has(klant._id)) {
          duplicates.push({ _id: klant._id, naam: klant.naam, matchType: "email" });
          seen.add(klant._id);
        }
      }

      // Check telefoon match
      if (
        args.telefoon &&
        klant.telefoon &&
        args.telefoon.replace(/[\s\-]/g, "") === klant.telefoon.replace(/[\s\-]/g, "")
      ) {
        if (!seen.has(klant._id)) {
          duplicates.push({ _id: klant._id, naam: klant.naam, matchType: "telefoon" });
          seen.add(klant._id);
        }
      }

      // Check naam + postcode combo
      if (
        args.naam &&
        args.postcode &&
        args.naam.trim().toLowerCase() === klant.naam.toLowerCase() &&
        args.postcode.replace(/\s/g, "").toLowerCase() === klant.postcode.replace(/\s/g, "").toLowerCase()
      ) {
        if (!seen.has(klant._id)) {
          duplicates.push({ _id: klant._id, naam: klant.naam, matchType: "naam_postcode" });
          seen.add(klant._id);
        }
      }
    }

    return duplicates;
  },
});

// Create klant from offerte data (for auto-creating klanten from wizard)
export const createFromOfferte = mutation({
  args: {
    naam: v.string(),
    adres: v.string(),
    postcode: v.string(),
    plaats: v.string(),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);

    // Check if a klant with the same name and address already exists
    const existingKlanten = await ctx.db
      .query("klanten")
      .withSearchIndex("search_klanten", (q) =>
        q.search("naam", args.naam).eq("userId", userId)
      )
      .collect();

    // Find exact match
    const exactMatch = existingKlanten.find(
      (k) =>
        k.naam.toLowerCase() === args.naam.toLowerCase() &&
        k.adres.toLowerCase() === args.adres.toLowerCase()
    );

    if (exactMatch) {
      return exactMatch._id;
    }

    // Validate and sanitize fields
    const postcode = validateRequiredPostcode(args.postcode);
    const email = sanitizeEmail(args.email);
    const telefoon = sanitizePhone(args.telefoon);

    // Create new klant
    const now = Date.now();
    return await ctx.db.insert("klanten", {
      userId,
      naam: args.naam.trim(),
      adres: args.adres.trim(),
      postcode,
      plaats: args.plaats.trim(),
      email,
      telefoon,
      pipelineStatus: "lead",
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ============================================
// CRM-008: GDPR Anonimisering
// ============================================

// Check for blockers before GDPR anonymization (open invoices or active projects)
export const checkGdprBlockers = query({
  args: { id: v.id("klanten") },
  handler: async (ctx, args) => {
    const klant = await ctx.db.get(args.id);
    if (!klant) return null;

    // Verify ownership
    const user = await requireAuth(ctx);
    if (klant.userId.toString() !== user._id.toString()) {
      return null;
    }

    const blockers: Array<{ type: "factuur" | "project"; label: string }> = [];

    // Find all offertes for this klant to check linked projects and invoices
    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", klant.userId))
      .filter((q) => q.eq(q.field("klantId"), args.id))
      .collect();

    for (const offerte of offertes) {
      // Check for active projects (not afgerond/gefactureerd/nacalculatie_compleet)
      const projecten = await ctx.db
        .query("projecten")
        .withIndex("by_offerte", (q) => q.eq("offerteId", offerte._id))
        .collect();

      for (const project of projecten) {
        if (
          project.status !== "afgerond" &&
          project.status !== "gefactureerd" &&
          project.status !== "nacalculatie_compleet"
        ) {
          blockers.push({
            type: "project",
            label: `Project "${project.naam}" (status: ${project.status})`,
          });
        }

        // Check for open invoices (not betaald/vervallen)
        const facturen = await ctx.db
          .query("facturen")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();

        for (const factuur of facturen) {
          if (factuur.status !== "betaald" && factuur.status !== "vervallen") {
            blockers.push({
              type: "factuur",
              label: `Factuur ${factuur.factuurnummer} (status: ${factuur.status})`,
            });
          }
        }
      }
    }

    return {
      hasBlockers: blockers.length > 0,
      blockers,
      isAnonymized: klant.gdprAnonymized === true,
      anonymizedAt: klant.gdprAnonymizedAt,
    };
  },
});

// GDPR anonymize a klant (admin only)
export const gdprAnonymize = mutation({
  args: { id: v.id("klanten") },
  handler: async (ctx, args) => {
    // Only admins can perform GDPR anonymization
    const adminUser = await requireAdmin(ctx);

    const klant = await ctx.db.get(args.id);
    if (!klant) {
      throw new ConvexError("Klant niet gevonden");
    }

    // Verify ownership (admin must belong to same company)
    if (klant.userId.toString() !== adminUser._id.toString()) {
      throw new ConvexError("Je hebt geen toegang tot deze klant");
    }

    // Check if already anonymized
    if (klant.gdprAnonymized) {
      throw new ConvexError("Deze klant is al geanonimiseerd");
    }

    // Check for blockers: active projects and open invoices
    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", klant.userId))
      .filter((q) => q.eq(q.field("klantId"), args.id))
      .collect();

    for (const offerte of offertes) {
      const projecten = await ctx.db
        .query("projecten")
        .withIndex("by_offerte", (q) => q.eq("offerteId", offerte._id))
        .collect();

      for (const project of projecten) {
        if (
          project.status !== "afgerond" &&
          project.status !== "gefactureerd" &&
          project.status !== "nacalculatie_compleet"
        ) {
          throw new ConvexError(
            `Kan niet anonimiseren: project "${project.naam}" is nog actief (status: ${project.status}). Rond eerst alle projecten af.`
          );
        }

        const facturen = await ctx.db
          .query("facturen")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();

        for (const factuur of facturen) {
          if (factuur.status !== "betaald" && factuur.status !== "vervallen") {
            throw new ConvexError(
              `Kan niet anonimiseren: factuur ${factuur.factuurnummer} is nog openstaand (status: ${factuur.status}). Zorg dat alle facturen betaald of vervallen zijn.`
            );
          }
        }
      }
    }

    // Anonymize the klant record — clear all PII, keep record for financial integrity
    // Audit trail: gdprAnonymizedBy + gdprAnonymizedAt track who and when
    const now = Date.now();
    await ctx.db.patch(args.id, {
      naam: "Geanonimiseerd",
      email: undefined,
      telefoon: undefined,
      adres: "Geanonimiseerd",
      postcode: "0000AA",
      plaats: "Geanonimiseerd",
      notities: undefined,
      tags: undefined,
      gdprAnonymized: true,
      gdprAnonymizedAt: now,
      gdprAnonymizedBy: adminUser._id,
      updatedAt: now,
    });

    // Also anonymize klant data embedded in linked offertes (snapshots)
    for (const offerte of offertes) {
      await ctx.db.patch(offerte._id, {
        klant: {
          naam: "Geanonimiseerd",
          adres: "Geanonimiseerd",
          postcode: "0000AA",
          plaats: "Geanonimiseerd",
          email: undefined,
          telefoon: undefined,
        },
        updatedAt: now,
      });
    }

    return { success: true, anonymizedAt: now };
  },
});

// ============ KLANT CSV IMPORT ============

/**
 * Import multiple klanten from CSV data.
 * Checks for duplicates based on email or naam+postcode combo.
 */
export const importKlanten = mutation({
  args: {
    klanten: v.array(
      v.object({
        naam: v.string(),
        email: v.optional(v.string()),
        telefoon: v.optional(v.string()),
        adres: v.string(),
        postcode: v.string(),
        plaats: v.string(),
        klantType: v.optional(
          v.union(
            v.literal("particulier"),
            v.literal("zakelijk"),
            v.literal("vve"),
            v.literal("gemeente"),
            v.literal("overig")
          )
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    // Fetch all existing klanten for duplicate checking
    const existingKlanten = await ctx.db
      .query("klanten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < args.klanten.length; i++) {
      const klant = args.klanten[i];
      const rowNum = i + 1;

      try {
        // Validate required fields
        if (!klant.naam.trim()) {
          errors.push(`Rij ${rowNum}: Naam is verplicht`);
          continue;
        }

        if (!klant.postcode.trim()) {
          errors.push(`Rij ${rowNum}: Postcode is verplicht`);
          continue;
        }

        if (!klant.plaats.trim()) {
          errors.push(`Rij ${rowNum}: Plaats is verplicht`);
          continue;
        }

        // Check for duplicates
        const isDuplicate = existingKlanten.some((existing) => {
          // Check email match
          if (
            klant.email &&
            existing.email &&
            klant.email.trim().toLowerCase() === existing.email.toLowerCase()
          ) {
            return true;
          }

          // Check naam + postcode combo
          if (
            klant.naam.trim().toLowerCase() === existing.naam.toLowerCase() &&
            klant.postcode.replace(/\s/g, "").toLowerCase() ===
              existing.postcode.replace(/\s/g, "").toLowerCase()
          ) {
            return true;
          }

          return false;
        });

        if (isDuplicate) {
          skipped++;
          continue;
        }

        // Sanitize fields
        const postcode = validateRequiredPostcode(klant.postcode);
        const email = sanitizeEmail(klant.email);
        const telefoon = sanitizePhone(klant.telefoon);

        const newId = await ctx.db.insert("klanten", {
          userId,
          naam: klant.naam.trim(),
          adres: klant.adres.trim(),
          postcode,
          plaats: klant.plaats.trim(),
          email,
          telefoon,
          pipelineStatus: "lead",
          klantType: klant.klantType ?? "particulier",
          createdAt: now,
          updatedAt: now,
        });

        // Add to existing list for further duplicate checking within same batch
        existingKlanten.push({
          _id: newId,
          _creationTime: now,
          userId,
          naam: klant.naam.trim(),
          adres: klant.adres.trim(),
          postcode,
          plaats: klant.plaats.trim(),
          email,
          telefoon,
          pipelineStatus: "lead" as const,
          klantType: klant.klantType ?? "particulier",
          createdAt: now,
          updatedAt: now,
        });

        imported++;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Onbekende fout";
        errors.push(`Rij ${rowNum} (${klant.naam}): ${message}`);
      }
    }

    return { imported, skipped, errors };
  },
});

// ============ CRM-005: Opvolgherinneringen op klant-niveau ============

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * CRM-005: Get reminder info for a single klant.
 * Returns reminder type and days overdue, or null if no reminder needed.
 *
 * Reminder triggers:
 * - Klant has pipelineStatus "lead" and was created >14 days ago with no linked offerte
 * - Klant has pipelineStatus "offerte_verzonden" and offerte was sent >7 days ago without response
 *
 * Excludes klanten where reminderSnoozed === true.
 */
export const getKlantReminder = query({
  args: { id: v.id("klanten") },
  handler: async (ctx, args) => {
    const klant = await ctx.db.get(args.id);
    if (!klant) return null;

    // Verify ownership
    const user = await requireAuth(ctx);
    if (klant.userId.toString() !== user._id.toString()) return null;

    // If snoozed, return snoozed state
    if (klant.reminderSnoozed) {
      return { type: "snoozed" as const, dagenOpen: 0 };
    }

    const now = Date.now();
    const pipelineStatus = klant.pipelineStatus ?? "lead";

    // Check: Lead without offerte for >14 days
    if (pipelineStatus === "lead") {
      const dagenSindsAanmaak = Math.floor((now - klant.createdAt) / DAY_MS);
      if (dagenSindsAanmaak >= 14) {
        // Check if there are any linked offertes
        const offertes = await ctx.db
          .query("offertes")
          .withIndex("by_user", (q) => q.eq("userId", klant.userId))
          .filter((q) => q.eq(q.field("klantId"), args.id))
          .take(1);

        if (offertes.length === 0) {
          return {
            type: "lead_zonder_offerte" as const,
            dagenOpen: dagenSindsAanmaak,
          };
        }
      }
    }

    // Check: Offerte verzonden without response for >7 days
    if (pipelineStatus === "offerte_verzonden") {
      const offertes = await ctx.db
        .query("offertes")
        .withIndex("by_user", (q) => q.eq("userId", klant.userId))
        .filter((q) => q.eq(q.field("klantId"), args.id))
        .order("desc")
        .collect();

      // Find the most recent "verzonden" offerte
      const verzondenOfferte = offertes.find((o) => o.status === "verzonden");
      if (verzondenOfferte) {
        // Use the offerte's updatedAt as proxy for when it was sent
        const sentAt = verzondenOfferte.updatedAt ?? verzondenOfferte.createdAt;
        const dagenSindsVerzonden = Math.floor((now - sentAt) / DAY_MS);
        if (dagenSindsVerzonden >= 7) {
          return {
            type: "offerte_zonder_reactie" as const,
            dagenOpen: dagenSindsVerzonden,
          };
        }
      }
    }

    return null;
  },
});

/**
 * CRM-005: Get all klant IDs that need follow-up reminders.
 * Used by the klanten overview page to show bell badges.
 */
export const getKlantenMetHerinneringen = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    // Get all klanten for this user
    const klanten = await ctx.db
      .query("klanten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const klantIdsMetHerinnering: string[] = [];

    for (const klant of klanten) {
      // Skip snoozed klanten
      if (klant.reminderSnoozed) continue;

      const pipelineStatus = klant.pipelineStatus ?? "lead";

      // Check: Lead without offerte for >14 days
      if (pipelineStatus === "lead") {
        const dagenSindsAanmaak = Math.floor((now - klant.createdAt) / DAY_MS);
        if (dagenSindsAanmaak >= 14) {
          const offertes = await ctx.db
            .query("offertes")
            .withIndex("by_user", (q) => q.eq("userId", klant.userId))
            .filter((q) => q.eq(q.field("klantId"), klant._id))
            .take(1);

          if (offertes.length === 0) {
            klantIdsMetHerinnering.push(klant._id);
            continue;
          }
        }
      }

      // Check: Offerte verzonden without response for >7 days
      if (pipelineStatus === "offerte_verzonden") {
        const offertes = await ctx.db
          .query("offertes")
          .withIndex("by_user", (q) => q.eq("userId", klant.userId))
          .filter((q) => q.eq(q.field("klantId"), klant._id))
          .order("desc")
          .collect();

        const verzondenOfferte = offertes.find((o) => o.status === "verzonden");
        if (verzondenOfferte) {
          const sentAt = verzondenOfferte.updatedAt ?? verzondenOfferte.createdAt;
          const dagenSindsVerzonden = Math.floor((now - sentAt) / DAY_MS);
          if (dagenSindsVerzonden >= 7) {
            klantIdsMetHerinnering.push(klant._id);
          }
        }
      }
    }

    return klantIdsMetHerinnering;
  },
});

/**
 * CRM-005: Snooze reminders for a klant ("Niet meer herinneren")
 */
export const snoozeReminder = mutation({
  args: { id: v.id("klanten") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    await getOwnedKlant(ctx, args.id);

    await ctx.db.patch(args.id, {
      reminderSnoozed: true,
      lastReminderAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * CRM-005: Unsnooze reminders for a klant ("Heractiveren")
 */
export const unsnoozeReminder = mutation({
  args: { id: v.id("klanten") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    await getOwnedKlant(ctx, args.id);

    await ctx.db.patch(args.id, {
      reminderSnoozed: false,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ============ KLANTENPORTAAL ACTIVATION ============

/**
 * Activate the klantenportaal for a klant.
 * Generates an invitation token that can be sent to the klant.
 * The token is valid for 7 days.
 */
export const activatePortal = mutation({
  args: { id: v.id("klanten") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const user = await requireAuth(ctx);

    // Get klant and verify ownership
    const klant = await ctx.db.get(args.id);
    if (!klant) {
      throw new ConvexError("Klant niet gevonden");
    }
    if (klant.userId.toString() !== user._id.toString()) {
      throw new ConvexError("Je hebt geen toegang tot deze klant");
    }

    // Validate klant has email
    if (!klant.email) {
      throw new ConvexError(
        "Klant heeft geen e-mailadres. Voeg eerst een e-mailadres toe voordat je portaal-toegang activeert."
      );
    }

    // Validate klant doesn't already have portal access
    if (klant.portalEnabled) {
      throw new ConvexError("Klant heeft al portaal-toegang");
    }

    // Generate secure invitation token
    const token = generateSecureToken(48);
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const expiresAt = now + SEVEN_DAYS_MS;

    await ctx.db.patch(args.id, {
      portalEnabled: true,
      invitationToken: token,
      invitationExpiresAt: expiresAt,
      updatedAt: now,
    });

    return { token, expiresAt };
  },
});

/**
 * Deactivate the klantenportaal for a klant.
 * Clears portal access and invitation token.
 */
export const deactivatePortal = mutation({
  args: { id: v.id("klanten") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const user = await requireAuth(ctx);

    // Get klant and verify ownership
    const klant = await ctx.db.get(args.id);
    if (!klant) {
      throw new ConvexError("Klant niet gevonden");
    }
    if (klant.userId.toString() !== user._id.toString()) {
      throw new ConvexError("Je hebt geen toegang tot deze klant");
    }

    await ctx.db.patch(args.id, {
      portalEnabled: false,
      invitationToken: undefined,
      invitationExpiresAt: undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ── Internal queries (for use by other Convex functions) ────────────────

/** Get a klant by ID without auth checks. For internal use only. */
export const getByIdInternal = internalQuery({
  args: { klantId: v.id("klanten") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.klantId);
  },
});
