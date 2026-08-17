import { v, ConvexError } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth, requireAuthUserId, getOwnedKlant, generateSecureToken } from "./auth";
import { requireNotViewer, requireAdmin, assertKanNaarKlantVersturen } from "./roles";
import {
  sanitizeEmail,
  sanitizePhone,
  validateRequiredPostcode,
  normaliseerImportPostcode,
  normaliseerImportTelefoon,
  vergelijkbareRelatienaam,
  sanitizeOptionalString,
  sanitizeKvkNummer,
  sanitizeBtwNummer,
} from "./validators";
import { hoortInKlantenLijst } from "./leadsKlantenHelpers";
import { logTijdlijnEvent } from "./tijdlijn";
import { effectieveStatussen } from "./facturatieLogica";

// Get all klanten for authenticated user
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const klanten = await ctx.db
      .query("klanten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    // Gearchiveerde klanten (§5.2) en legacy "lead"-stadium (PRD §1.3, zie
    // leadsKlantenHelpers.ts) niet tonen: de lead-funnel leeft op het leads-bord.
    return klanten.filter(hoortInKlantenLijst);
  },
});

// Get recent klanten (last 5)
export const getRecent = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const klanten = await ctx.db
      .query("klanten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
    return klanten.filter((k) => !k.isArchived).slice(0, 5);
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

/**
 * Tolerante variant van `get`, voor het voorselecteren van een klant vanuit de
 * URL (`/offertes/nieuw/…?klantId=…`). Het argument is bewust `v.string()`:
 * met `v.id("klanten")` kaatst Convex een onzin-id of een id uit een andere
 * tabel terug als argumentfout, en die gooit `useQuery` in de errorboundary —
 * precies de witte stap die een half-getypte URL niet mag veroorzaken.
 * `normalizeId` geeft in dat geval gewoon `null`, net als bij een verwijderde
 * klant of een klant van een andere gebruiker.
 *
 * Bewust géén `hoortInKlantenLijst`-filter: een record dat (nog) als lead in de
 * pipeline staat mag je wel degelijk voorselecteren — het is een geldige klant
 * om een offerte voor te maken, hij staat alleen niet in de Klanten-lijst.
 */
export const getVoorSelector = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const klantId = ctx.db.normalizeId("klanten", args.id);
    if (!klantId) return null;

    const klant = await ctx.db.get(klantId);
    if (!klant) return null;

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
      const recent = await ctx.db
        .query("klanten")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(30);
      return recent.filter((k) => !k.isArchived).slice(0, 10);
    }

    // Use search index
    const results = await ctx.db
      .query("klanten")
      .withSearchIndex("search_klanten", (q) =>
        q.search("naam", args.searchTerm).eq("userId", userId)
      )
      .take(30);
    return results.filter((k) => !k.isArchived).slice(0, 10);
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
    // TT-002: zakelijke velden (alleen relevant bij een niet-particuliere klant)
    contactpersoon: v.optional(v.string()),
    kvkNummer: v.optional(v.string()),
    btwNummer: v.optional(v.string()),
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
      // PRD §1.3: geen "lead"-default meer — een rij in klanten ís een klant;
      // het lifecycle-stadium volgt uit echte events (upgradeKlantPipeline).
      klantType: args.klantType ?? "particulier",
      tags: sanitizedTags,
      contactpersoon: sanitizeOptionalString(args.contactpersoon),
      kvkNummer: sanitizeKvkNummer(args.kvkNummer),
      btwNummer: sanitizeBtwNummer(args.btwNummer),
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
    // TT-002: zakelijke velden
    contactpersoon: v.optional(v.string()),
    kvkNummer: v.optional(v.string()),
    btwNummer: v.optional(v.string()),
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

    if (args.contactpersoon !== undefined) {
      filteredUpdates.contactpersoon = sanitizeOptionalString(args.contactpersoon);
    }

    if (args.kvkNummer !== undefined) {
      filteredUpdates.kvkNummer = sanitizeKvkNummer(args.kvkNummer);
    }

    if (args.btwNummer !== undefined) {
      filteredUpdates.btwNummer = sanitizeBtwNummer(args.btwNummer);
    }

    await ctx.db.patch(args.id, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
  },
});

// §2.7 (event inplanning_bevestigd): bevestigingsmail bij inplannen — een
// opt-in PER KLANT (default uit). Staat de vlag aan, dan zet het inplannen
// van een werkitem een CONCEPT-mail klaar in de wachtrij (kantoor keurt
// goed, §1.2 — er wordt nooit automatisch verstuurd).
export const setInplanBevestigingsMail = mutation({
  args: {
    id: v.id("klanten"),
    inplanBevestigingsMail: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    await getOwnedKlant(ctx, args.id);
    await ctx.db.patch(args.id, {
      inplanBevestigingsMail: args.inplanBevestigingsMail,
      updatedAt: Date.now(),
    });
    return args.id;
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

// §5.2: Archiveer een klant (i.p.v. hard delete).
// Hard delete blijft alleen bereikbaar via de GDPR-flow (gdprAnonymize/remove).
export const archive = mutation({
  args: { id: v.id("klanten") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    // Verify ownership
    await getOwnedKlant(ctx, args.id);
    const now = Date.now();

    await ctx.db.patch(args.id, {
      isArchived: true,
      archivedAt: now,
      updatedAt: now,
    });

    return args.id;
  },
});

// §5.2: Herstel een gearchiveerde klant
export const restoreArchived = mutation({
  args: { id: v.id("klanten") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const klant = await getOwnedKlant(ctx, args.id);

    if (!klant.isArchived) {
      throw new ConvexError("Deze klant is niet gearchiveerd");
    }

    await ctx.db.patch(args.id, {
      isArchived: undefined,
      archivedAt: undefined,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

// §5.2: Lijst van gearchiveerde klanten (voor Archief-pagina)
export const listArchived = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const klanten = await ctx.db
      .query("klanten")
      .withIndex("by_user_archived", (q) =>
        q.eq("userId", userId).eq("isArchived", true)
      )
      .collect();

    return klanten
      .map((k) => ({
        _id: k._id,
        naam: k.naam,
        plaats: k.plaats,
        email: k.email,
        archivedAt: k.archivedAt,
      }))
      .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0));
  },
});

// Combined query for klanten list with recent - reduces 2 round-trips to 1
export const listWithRecent = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const alleKlanten = await ctx.db
      .query("klanten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Gearchiveerde klanten (§5.2) en legacy "lead"-stadium (PRD §1.3) niet tonen
    const klanten = alleKlanten.filter(hoortInKlantenLijst);

    return {
      klanten,
      recentKlanten: klanten.slice(0, 5),
    };
  },
});

/**
 * Teller-badge voor het menu-item "Klanten" (PRD §1.3/§5.1): het aantal echte
 * klanten. Gearchiveerde klanten en records met het legacy "lead"-stadium
 * (in sanering, zie leadsKlantenHelpers.ts) tellen niet mee.
 */
export const countKlanten = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const klanten = await ctx.db
      .query("klanten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return klanten.filter(hoortInKlantenLijst).length;
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
      // PRD §1.3: geen "lead"-default meer (zie leadsKlantenHelpers.ts)
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ============================================
// Dossiertellingen (klantdossier-herindeling v7, WS1)
// ============================================

/**
 * Alle tellers van het klantdossier in één query.
 *
 * Het submenu toont een statuspil per onderdeel en de cijferstrip vier tegels.
 * Als elk van die getallen zijn eigen query had, zou één klantpagina acht
 * losse rondjes doen — traag, en bij het openen flikkeren de pillen stuk voor
 * stuk in beeld. Eén verzamelquery komt in één keer aan.
 *
 * Alles loopt via een index; geen enkele tabel wordt in zijn geheel gelezen.
 * De indexen op `projecten`, `facturen` en `offertes` staan niet op `userId`,
 * dus daar controleren we de tenant-scope er expliciet achteraan (audit §2).
 */
export const dossierTellingen = query({
  args: { klantId: v.id("klanten") },
  handler: async (ctx, args) => {
    const klant = await ctx.db.get(args.klantId);
    if (!klant) return null;

    // Zelfde eigenaarscontrole als `get`/`getWithOffertes` hierboven.
    const user = await requireAuth(ctx);
    if (klant.userId.toString() !== user._id.toString()) {
      return null;
    }

    const eigenaar = klant.userId.toString();

    // ── Taken: index by_klant staat op [klantId, status], dus alleen de open
    //    taken komen überhaupt van de schijf.
    const openTaken = await ctx.db
      .query("klantTaken")
      .withIndex("by_klant", (q) =>
        q.eq("klantId", args.klantId).eq("status", "open")
      )
      .collect();

    // ── Tijdlijn: "systeem" is het kanaal van auto-events (offerte verzonden,
    //    portaaluitnodiging). Dat zijn geen contactmomenten met de klant, dus
    //    tellen ze niet mee en bepalen ze ook het laatste contact niet.
    const tijdlijn = await ctx.db
      .query("klantTijdlijn")
      .withIndex("by_klant", (q) => q.eq("klantId", args.klantId))
      .order("desc")
      .collect();
    const contactEntries = tijdlijn.filter((e) => e.kanaal !== "systeem");

    // ── Werk: losse beurten leven in dezelfde `projecten`-tabel als projecten
    //    (type "onderhoudsbeurt", zie convex/losseBeurten.ts). Eén index-lees
    //    levert dus beide tellers.
    const werkitems = (
      await ctx.db
        .query("projecten")
        .withIndex("by_klant", (q) => q.eq("klantId", args.klantId))
        .collect()
    ).filter((p) => p.userId.toString() === eigenaar && !p.deletedAt);
    const projecten = werkitems.filter(
      (p) => p.type !== "onderhoudsbeurt"
    ).length;
    const losseBeurten = werkitems.filter(
      (p) => p.type === "onderhoudsbeurt" && p.contractId === undefined
    ).length;

    const contracten = (
      await ctx.db
        .query("onderhoudscontracten")
        .withIndex("by_klant", (q) => q.eq("klantId", args.klantId))
        .collect()
    ).filter((c) => c.userId.toString() === eigenaar && !c.deletedAt);

    const offertes = (
      await ctx.db
        .query("offertes")
        .withIndex("by_klant", (q) => q.eq("klantId", args.klantId))
        .collect()
    ).filter((o) => o.userId.toString() === eigenaar);

    // ── Facturen: dezelfde definitie van "open" als KlantFacturenSectie —
    //    verstuurd (dus geen concept) en niet betaald. Zo staat er in de pil
    //    nooit een ander getal dan in de factuurlijst eronder.
    const facturen = (
      await ctx.db
        .query("facturen")
        .withIndex("by_klant", (q) => q.eq("klantId", args.klantId))
        .collect()
    ).filter((f) => f.userId.toString() === eigenaar);

    const nu = Date.now();
    const DERTIG_DAGEN = 30 * 24 * 60 * 60 * 1000;
    let openFacturenAantal = 0;
    let openstaandBedrag = 0;
    let teLaat = false;
    for (const factuur of facturen) {
      const { documentStatus, betaalStatus } = effectieveStatussen(factuur);
      if (documentStatus === "concept") continue;
      if (betaalStatus === "betaald" || betaalStatus === "geannuleerd") continue;
      openFacturenAantal += 1;
      openstaandBedrag += factuur.totaalInclBtw;
      // Rood in het submenu: er staat iets langer dan een maand open. Bewust
      // op factuurdatum en niet op vervaldatum — "hoe lang sleept dit al" is
      // de vraag die kantoor hier stelt.
      if (factuur.factuurdatum < nu - DERTIG_DAGEN) teLaat = true;
    }

    return {
      openTaken: openTaken.length,
      contactmomenten: contactEntries.length,
      laatsteContactTimestamp: contactEntries[0]?.timestamp ?? null,
      projecten,
      onderhoud: contracten.length + losseBeurten,
      offertes: offertes.length,
      facturen: facturen.length,
      openFacturen: {
        aantal: openFacturenAantal,
        openstaandBedrag,
        teLaat,
      },
    };
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
        // Adresvelden zijn optioneel bij import: een onvolledig adres is geen
        // reden om een klant buiten de deur te houden (zie normaliseerImportPostcode).
        adres: v.optional(v.string()),
        postcode: v.optional(v.string()),
        plaats: v.optional(v.string()),
        // TT-002: bij een bedrijfsrij is dit de persoon achter de bedrijfsnaam
        contactpersoon: v.optional(v.string()),
        /** Tweede nummer uit de export (vast én mobiel); gaat naar notities. */
        extraTelefoon: v.optional(v.string()),
        website: v.optional(v.string()),
        klantnummer: v.optional(v.string()),
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
    let aangevuld = 0;
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

        // Postcode en plaats zijn bewust NIET verplicht bij import — zie de
        // toelichting op de args hierboven.
        const postcode = normaliseerImportPostcode(klant.postcode);
        const adres = (klant.adres ?? "").trim();
        const plaats = (klant.plaats ?? "").trim();

        // Sanitize fields
        const email = sanitizeEmail(klant.email);
        const telefoon = normaliseerImportTelefoon(klant.telefoon);

        /**
         * Bestaande klant zoeken.
         *
         * Bewust NIET op e-mail alleen. In de relatie-export van Top Tuinen
         * delen verschillende relaties één mailbox: `beheer@hetonvve.nl` staat
         * bij twee verschillende VvE's, `rbecker@fbaivastgoed.com` bij twee
         * verschillende bedrijven. Matchen op e-mail zou die samenvoegen tot
         * één klant, en dat is erger dan een dubbele rij die je later
         * samenvoegt.
         *
         * Het relatienummer is exact en staat op elke rij. Daarna naam +
         * postcode, en als laatste e-mail én naam samen — voor het geval een
         * postcode is aangepast.
         */
        const naamKlein = vergelijkbareRelatienaam(klant.naam);
        const postcodeKaal = postcode.replace(/\s/g, "").toLowerCase();
        const bestaand =
          (klant.klantnummer
            ? existingKlanten.find(
                (e) => e.klantnummer && e.klantnummer === klant.klantnummer!.trim()
              )
            : undefined) ??
          // Naam én postcode moeten allebei kloppen. Alleen naam is te grof:
          // twee huishoudens met dezelfde achternaam in verschillende dorpen
          // zijn geen dubbele klant.
          existingKlanten.find(
            (e) =>
              vergelijkbareRelatienaam(e.naam) === naamKlein &&
              (e.postcode ?? "").replace(/\s/g, "").toLowerCase() === postcodeKaal &&
              postcodeKaal !== ""
          ) ??
          (email
            ? existingKlanten.find(
                (e) =>
                  e.email &&
                  e.email.toLowerCase() === email.toLowerCase() &&
                  vergelijkbareRelatienaam(e.naam) === naamKlein
              )
            : undefined);

        if (bestaand) {
          /**
           * Aanvullen, nooit overschrijven. Wat in de app is bijgewerkt is
           * recenter dan de export, dus alleen lege velden worden gevuld.
           */
          const patch: Record<string, unknown> = {};
          const vulAan = (veld: string, waarde: string | undefined) => {
            const huidig = (bestaand as unknown as Record<string, unknown>)[veld];
            if (waarde && !(typeof huidig === "string" && huidig.trim())) {
              patch[veld] = waarde;
            }
          };

          vulAan("email", email);
          vulAan("telefoon", telefoon);
          vulAan("adres", adres);
          vulAan("postcode", postcode);
          vulAan("plaats", plaats);
          vulAan("contactpersoon", sanitizeOptionalString(klant.contactpersoon));
          vulAan("website", sanitizeOptionalString(klant.website));
          vulAan("klantnummer", sanitizeOptionalString(klant.klantnummer));

          const tweede = normaliseerImportTelefoon(klant.extraTelefoon);
          if (tweede && !(bestaand.notities ?? "").includes(tweede)) {
            const regel = `Tweede telefoonnummer: ${tweede}`;
            patch.notities = bestaand.notities
              ? `${bestaand.notities}\n${regel}`
              : regel;
          }

          if (Object.keys(patch).length > 0) {
            await ctx.db.patch(bestaand._id, { ...patch, updatedAt: now });
            Object.assign(bestaand, patch);
            aangevuld++;
          } else {
            skipped++;
          }
          continue;
        }

        const tweedeNummer = normaliseerImportTelefoon(klant.extraTelefoon);
        const notities = tweedeNummer
          ? `Tweede telefoonnummer: ${tweedeNummer}`
          : undefined;

        // `contactpersoon` stond hier eerder alleen in de cache-regel hieronder
        // en niet in de insert zelf, waardoor hij bij import stilzwijgend
        // verdween — vandaar dat hij nu expliciet in dit object staat.
        const nieuweVelden = {
          userId,
          naam: klant.naam.trim(),
          adres,
          postcode,
          plaats,
          email,
          telefoon,
          contactpersoon: sanitizeOptionalString(klant.contactpersoon),
          website: sanitizeOptionalString(klant.website),
          klantnummer: sanitizeOptionalString(klant.klantnummer),
          notities,
          // PRD §1.3: geen "lead"-default meer (zie leadsKlantenHelpers.ts)
          klantType: klant.klantType ?? "particulier",
          createdAt: now,
          updatedAt: now,
        };

        const newId = await ctx.db.insert("klanten", nieuweVelden);

        // Meteen in de lijst zetten, zodat een tweede rij met dezelfde klant
        // binnen ditzelfde bestand als bestaand wordt herkend.
        existingKlanten.push({
          _id: newId,
          _creationTime: now,
          ...nieuweVelden,
        });

        imported++;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Onbekende fout";
        errors.push(`Rij ${rowNum} (${klant.naam}): ${message}`);
      }
    }

    // `skipped` telt nu alleen rijen die niets nieuws brachten; wat wél iets
    // toevoegde staat apart onder `aangevuld`.
    return { imported, aangevuld, skipped, errors };
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
          // by_klant-index: leest alleen de offertes van deze klant
          // (i.p.v. alle offertes van de gebruiker per klant scannen)
          const offertes = await ctx.db
            .query("offertes")
            .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
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
          .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
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

    // TODO(top-tuinen): Automatische uitnodigingsmail tijdelijk uitgeschakeld.
    // Het portaal wordt nog wél geactiveerd en het invitation-token wordt
    // gegenereerd, maar er gaat (voor nu) géén e-mail automatisch naar de klant.
    // Zet onderstaande regels terug om de mail weer in te schakelen.
    // await ctx.scheduler.runAfter(0, internal.portaalEmail.sendInvitation, {
    //   klantId: args.id,
    //   token,
    // });

    return { token, expiresAt };
  },
});

/**
 * Manually send a Clerk password-setup invitation to a klant.
 *
 * Ensures portal access is enabled and a fresh invitation token exists, then
 * triggers a Clerk invitation email so the klant can set a password and create
 * their portal account. Triggered on demand (button), not automatically.
 */
export const sendPortalInvitation = mutation({
  args: { id: v.id("klanten") },
  handler: async (ctx, args) => {
    // Capability "versturen naar klant" (PRD §1.2): alleen kantoor
    const user = await assertKanNaarKlantVersturen(ctx);

    const klant = await ctx.db.get(args.id);
    if (!klant) {
      throw new ConvexError("Klant niet gevonden");
    }
    if (klant.userId.toString() !== user._id.toString()) {
      throw new ConvexError("Je hebt geen toegang tot deze klant");
    }
    if (!klant.email) {
      throw new ConvexError(
        "Klant heeft geen e-mailadres. Voeg eerst een e-mailadres toe voordat je een uitnodiging verstuurt."
      );
    }
    if (klant.clerkUserId) {
      throw new ConvexError(
        "Deze klant heeft al een gekoppeld account en kan inloggen op de hoofdpagina."
      );
    }

    // Ensure portal access + a fresh invitation token (valid 7 days)
    const token = klant.invitationToken ?? generateSecureToken(48);
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    await ctx.db.patch(args.id, {
      portalEnabled: true,
      invitationToken: token,
      invitationExpiresAt: now + SEVEN_DAYS_MS,
      updatedAt: now,
    });

    // Send the Clerk "set your password" invitation email
    await ctx.scheduler.runAfter(0, internal.portaalEmail.sendClerkInvitation, {
      email: klant.email,
      token,
    });

    // — Klanttijdlijn (PRD §2.3): portaal-uitnodiging verstuurd.
    // Additief, niet-blokkerend; bewust zonder e-mailadres in de tekst.
    await logTijdlijnEvent(ctx, {
      userId: klant.userId,
      klantId: args.id,
      eventType: "portaal_uitnodiging",
      auteurId: user._id,
      auteurNaam: user.name,
      tekst: "Portaal-uitnodiging verstuurd naar de klant",
    });

    return { success: true };
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
