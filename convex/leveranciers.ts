import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./auth";
import { requireNotViewer } from "./roles";
import {
  sanitizeEmail,
  sanitizePhone,
  sanitizePostcode,
  normaliseerImportPostcode,
  sanitizeKvkNummer,
  sanitizeBtwNummer,
  sanitizeIban,
  sanitizeOptionalString,
  validateNonNegative,
} from "./validators";

// List all active leveranciers for authenticated user
// When called without cursor, returns all active leveranciers (used by dropdowns/forms).
// When called with cursor, returns cursor-based paginated results.
export const list = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // If no cursor is provided, return all active leveranciers (backward compat for dropdowns)
    if (!args.cursor && !args.limit) {
      const leveranciers = await ctx.db
        .query("leveranciers")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("isActief"), true))
        .collect();
      return leveranciers;
    }

    // Cursor-based pagination
    const limit = args.limit || 25;
    const result = await ctx.db
      .query("leveranciers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActief"), true))
      .paginate({ numItems: limit, cursor: args.cursor ?? null });

    return {
      leveranciers: result.page,
      nextCursor: result.continueCursor,
      hasMore: !result.isDone,
    };
  },
});

// List all leveranciers including inactive ones (for admin purposes)
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db
      .query("leveranciers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

// Get a single leverancier by ID (with ownership verification)
export const getById = query({
  args: { id: v.id("leveranciers") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const leverancier = await ctx.db.get(args.id);

    if (!leverancier) return null;
    if (leverancier.userId.toString() !== userId.toString()) {
      return null;
    }

    return leverancier;
  },
});

// Search leveranciers by name
export const search = query({
  args: {
    searchTerm: v.string(),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    if (!args.searchTerm.trim()) {
      // Return recent leveranciers if no search term
      const leveranciers = await ctx.db
        .query("leveranciers")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(10);

      if (args.includeInactive) {
        return leveranciers;
      }
      return leveranciers.filter((l) => l.isActief);
    }

    // Use search index
    const results = await ctx.db
      .query("leveranciers")
      .withSearchIndex("search_leveranciers", (q) =>
        q.search("naam", args.searchTerm).eq("userId", userId)
      )
      .take(20);

    if (args.includeInactive) {
      return results;
    }
    return results.filter((l) => l.isActief);
  },
});

// Create a new leverancier
export const create = mutation({
  args: {
    naam: v.string(),
    contactpersoon: v.optional(v.string()),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    adres: v.optional(v.string()),
    postcode: v.optional(v.string()),
    plaats: v.optional(v.string()),
    kvkNummer: v.optional(v.string()),
    btwNummer: v.optional(v.string()),
    iban: v.optional(v.string()),
    betalingstermijn: v.optional(v.number()),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    // Validate required fields
    if (!args.naam.trim()) {
      throw new ConvexError("Naam is verplicht");
    }

    // Validate and sanitize optional fields
    const email = sanitizeEmail(args.email);
    const telefoon = sanitizePhone(args.telefoon);
    const postcode = sanitizePostcode(args.postcode);
    const kvkNummer = sanitizeKvkNummer(args.kvkNummer);
    const btwNummer = sanitizeBtwNummer(args.btwNummer);
    const iban = sanitizeIban(args.iban);
    const contactpersoon = sanitizeOptionalString(args.contactpersoon);
    const adres = sanitizeOptionalString(args.adres);
    const plaats = sanitizeOptionalString(args.plaats);
    const notities = sanitizeOptionalString(args.notities);

    // Validate betalingstermijn if provided
    let betalingstermijn = args.betalingstermijn;
    if (betalingstermijn !== undefined) {
      betalingstermijn = validateNonNegative(betalingstermijn, "Betalingstermijn");
    }

    return await ctx.db.insert("leveranciers", {
      userId,
      naam: args.naam.trim(),
      contactpersoon,
      email,
      telefoon,
      adres,
      postcode,
      plaats,
      kvkNummer,
      btwNummer,
      iban,
      betalingstermijn,
      notities,
      isActief: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Leveranciers importeren uit een CSV.
 *
 * Zelfde uitgangspunt als importKlanten: alleen de naam is verplicht, de rest
 * mag ontbreken of afwijken (buitenlandse postcodes zijn hier eerder regel dan
 * uitzondering — de helft van de leveranciers zit in Duitsland of België).
 * Duplicaten worden overgeslagen, ook binnen dezelfde batch.
 */
export const importLeveranciers = mutation({
  args: {
    leveranciers: v.array(
      v.object({
        naam: v.string(),
        contactpersoon: v.optional(v.string()),
        email: v.optional(v.string()),
        telefoon: v.optional(v.string()),
        adres: v.optional(v.string()),
        postcode: v.optional(v.string()),
        plaats: v.optional(v.string()),
        /** Tweede nummer uit de export (vast én mobiel); gaat naar notities. */
        extraTelefoon: v.optional(v.string()),
        website: v.optional(v.string()),
        klantnummer: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    // Hele documenten, niet alleen naam+e-mail: een bestaande leverancier moet
    // aangevuld kunnen worden en daarvoor moet je weten wat er al staat.
    const bestaande = await ctx.db
      .query("leveranciers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let imported = 0;
    let aangevuld = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < args.leveranciers.length; i++) {
      const rij = args.leveranciers[i];
      const rowNum = i + 1;

      try {
        const naam = rij.naam.trim();
        if (!naam) {
          errors.push(`Rij ${rowNum}: Naam is verplicht`);
          continue;
        }

        const email = sanitizeEmail(rij.email);
        // Bewust normaliseerImportPostcode i.p.v. sanitizePostcode: die laatste
        // gooit op elke niet-Nederlandse postcode en zou de batch breken.
        const postcode = normaliseerImportPostcode(rij.postcode) || undefined;
        const tweede = sanitizePhone(rij.extraTelefoon);

        /**
         * Zelfde volgorde als bij klanten, en om dezelfde reden niet op e-mail
         * alleen: Amagard en Kranendonk B.V. delen `info@zierkiesundsplitt.de`
         * maar zijn twee leveranciers.
         */
        const naamKlein = naam.toLowerCase();
        const bestaandeRij =
          (rij.klantnummer
            ? bestaande.find(
                (b) => b.klantnummer && b.klantnummer === rij.klantnummer!.trim()
              )
            : undefined) ??
          bestaande.find((b) => b.naam.toLowerCase().trim() === naamKlein);

        if (bestaandeRij) {
          // Aanvullen, nooit overschrijven — zie importKlanten.
          const patch: Record<string, unknown> = {};
          const vulAan = (veld: string, waarde: string | undefined) => {
            const huidig = (bestaandeRij as unknown as Record<string, unknown>)[veld];
            if (waarde && !(typeof huidig === "string" && huidig.trim())) {
              patch[veld] = waarde;
            }
          };

          vulAan("email", email);
          vulAan("telefoon", sanitizePhone(rij.telefoon));
          vulAan("adres", sanitizeOptionalString(rij.adres));
          vulAan("postcode", postcode);
          vulAan("plaats", sanitizeOptionalString(rij.plaats));
          vulAan("contactpersoon", sanitizeOptionalString(rij.contactpersoon));
          vulAan("website", sanitizeOptionalString(rij.website));
          vulAan("klantnummer", sanitizeOptionalString(rij.klantnummer));

          if (tweede && !(bestaandeRij.notities ?? "").includes(tweede)) {
            const regel = `Tweede telefoonnummer: ${tweede}`;
            patch.notities = bestaandeRij.notities
              ? `${bestaandeRij.notities}\n${regel}`
              : regel;
          }

          if (Object.keys(patch).length > 0) {
            await ctx.db.patch(bestaandeRij._id, { ...patch, updatedAt: now });
            Object.assign(bestaandeRij, patch);
            aangevuld++;
          } else {
            skipped++;
          }
          continue;
        }

        const nieuweVelden = {
          userId,
          naam,
          contactpersoon: sanitizeOptionalString(rij.contactpersoon),
          email,
          telefoon: sanitizePhone(rij.telefoon),
          adres: sanitizeOptionalString(rij.adres),
          postcode,
          plaats: sanitizeOptionalString(rij.plaats),
          website: sanitizeOptionalString(rij.website),
          klantnummer: sanitizeOptionalString(rij.klantnummer),
          notities: tweede ? `Tweede telefoonnummer: ${tweede}` : undefined,
          isActief: true,
          createdAt: now,
          updatedAt: now,
        };

        const nieuwId = await ctx.db.insert("leveranciers", nieuweVelden);
        bestaande.push({ _id: nieuwId, _creationTime: now, ...nieuweVelden });
        imported++;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Onbekende fout";
        errors.push(`Rij ${rowNum} (${rij.naam}): ${message}`);
      }
    }

    return { imported, aangevuld, skipped, errors };
  },
});

// Update a leverancier
export const update = mutation({
  args: {
    id: v.id("leveranciers"),
    naam: v.optional(v.string()),
    contactpersoon: v.optional(v.string()),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    adres: v.optional(v.string()),
    postcode: v.optional(v.string()),
    plaats: v.optional(v.string()),
    kvkNummer: v.optional(v.string()),
    btwNummer: v.optional(v.string()),
    iban: v.optional(v.string()),
    betalingstermijn: v.optional(v.number()),
    notities: v.optional(v.string()),
    isActief: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);

    // Verify ownership
    const leverancier = await ctx.db.get(args.id);
    if (!leverancier) {
      throw new ConvexError("Leverancier niet gevonden");
    }
    if (leverancier.userId.toString() !== userId.toString()) {
      throw new ConvexError("Geen toegang tot deze leverancier");
    }

    const filteredUpdates: Record<string, unknown> = { updatedAt: Date.now() };

    // Validate and sanitize each field if provided
    if (args.naam !== undefined) {
      if (!args.naam.trim()) {
        throw new ConvexError("Naam is verplicht");
      }
      filteredUpdates.naam = args.naam.trim();
    }

    if (args.contactpersoon !== undefined) {
      filteredUpdates.contactpersoon = sanitizeOptionalString(args.contactpersoon);
    }

    if (args.email !== undefined) {
      filteredUpdates.email = sanitizeEmail(args.email);
    }

    if (args.telefoon !== undefined) {
      filteredUpdates.telefoon = sanitizePhone(args.telefoon);
    }

    if (args.adres !== undefined) {
      filteredUpdates.adres = sanitizeOptionalString(args.adres);
    }

    if (args.postcode !== undefined) {
      filteredUpdates.postcode = sanitizePostcode(args.postcode);
    }

    if (args.plaats !== undefined) {
      filteredUpdates.plaats = sanitizeOptionalString(args.plaats);
    }

    if (args.kvkNummer !== undefined) {
      filteredUpdates.kvkNummer = sanitizeKvkNummer(args.kvkNummer);
    }

    if (args.btwNummer !== undefined) {
      filteredUpdates.btwNummer = sanitizeBtwNummer(args.btwNummer);
    }

    if (args.iban !== undefined) {
      filteredUpdates.iban = sanitizeIban(args.iban);
    }

    if (args.betalingstermijn !== undefined) {
      filteredUpdates.betalingstermijn = validateNonNegative(
        args.betalingstermijn,
        "Betalingstermijn"
      );
    }

    if (args.notities !== undefined) {
      filteredUpdates.notities = sanitizeOptionalString(args.notities);
    }

    if (args.isActief !== undefined) {
      filteredUpdates.isActief = args.isActief;
    }

    await ctx.db.patch(args.id, filteredUpdates);
    return args.id;
  },
});

// Remove a leverancier (soft delete with isActief=false)
export const remove = mutation({
  args: { id: v.id("leveranciers") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);

    // Verify ownership
    const leverancier = await ctx.db.get(args.id);
    if (!leverancier) {
      throw new ConvexError("Leverancier niet gevonden");
    }
    if (leverancier.userId.toString() !== userId.toString()) {
      throw new ConvexError("Geen toegang tot deze leverancier");
    }

    // Check if there are inkooporders linked to this leverancier
    const linkedOrders = await ctx.db
      .query("inkooporders")
      .withIndex("by_leverancier", (q) => q.eq("leverancierId", args.id))
      .take(1);

    if (linkedOrders.length > 0) {
      // Soft delete instead of throwing error - leverancier can still be deactivated
      await ctx.db.patch(args.id, {
        isActief: false,
        updatedAt: Date.now(),
      });
      return {
        id: args.id,
        softDeleted: true,
        message: "Leverancier gedeactiveerd (heeft gekoppelde inkooporders)"
      };
    }

    await ctx.db.patch(args.id, {
      isActief: false,
      updatedAt: Date.now(),
    });
    return { id: args.id, softDeleted: true };
  },
});

// Hard delete a leverancier (with ownership verification)
export const hardDelete = mutation({
  args: { id: v.id("leveranciers") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);

    // Verify ownership
    const leverancier = await ctx.db.get(args.id);
    if (!leverancier) {
      throw new ConvexError("Leverancier niet gevonden");
    }
    if (leverancier.userId.toString() !== userId.toString()) {
      throw new ConvexError("Geen toegang tot deze leverancier");
    }

    // Check if there are inkooporders linked to this leverancier
    const linkedOrders = await ctx.db
      .query("inkooporders")
      .withIndex("by_leverancier", (q) => q.eq("leverancierId", args.id))
      .take(1);

    if (linkedOrders.length > 0) {
      throw new ConvexError(
        "Deze leverancier heeft gekoppelde inkooporders en kan niet worden verwijderd. Deactiveer de leverancier in plaats daarvan."
      );
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Get statistics for a leverancier (aantal inkooporders, totale waarde)
export const getStats = query({
  args: { id: v.id("leveranciers") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify ownership
    const leverancier = await ctx.db.get(args.id);
    if (!leverancier) {
      throw new ConvexError("Leverancier niet gevonden");
    }
    if (leverancier.userId.toString() !== userId.toString()) {
      throw new ConvexError("Geen toegang tot deze leverancier");
    }

    // Get all inkooporders for this leverancier
    const inkooporders = await ctx.db
      .query("inkooporders")
      .withIndex("by_leverancier", (q) => q.eq("leverancierId", args.id))
      .collect();

    // Calculate statistics
    const totaalOrders = inkooporders.length;
    const totaalWaarde = inkooporders.reduce((sum, order) => sum + order.totaal, 0);

    // Group by status
    const ordersPerStatus: Record<string, number> = {};
    const waardePerStatus: Record<string, number> = {};

    for (const order of inkooporders) {
      ordersPerStatus[order.status] = (ordersPerStatus[order.status] || 0) + 1;
      waardePerStatus[order.status] = (waardePerStatus[order.status] || 0) + order.totaal;
    }

    // Find last order date
    const laatsteOrderDatum = inkooporders.length > 0
      ? Math.max(...inkooporders.map((o) => o.createdAt))
      : null;

    return {
      leverancierId: args.id,
      leverancierNaam: leverancier.naam,
      totaalOrders,
      totaalWaarde,
      ordersPerStatus,
      waardePerStatus,
      laatsteOrderDatum,
      gemiddeldeOrderWaarde: totaalOrders > 0 ? totaalWaarde / totaalOrders : 0,
    };
  },
});

// Get leverancier with their inkooporders (combined query)
export const getWithOrders = query({
  args: { id: v.id("leveranciers") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify ownership
    const leverancier = await ctx.db.get(args.id);
    if (!leverancier) return null;
    if (leverancier.userId.toString() !== userId.toString()) {
      return null;
    }

    // Get all inkooporders for this leverancier
    const inkooporders = await ctx.db
      .query("inkooporders")
      .withIndex("by_leverancier", (q) => q.eq("leverancierId", args.id))
      .order("desc")
      .collect();

    return {
      ...leverancier,
      inkooporders,
    };
  },
});

// Combined query for leveranciers list with stats - reduces multiple round-trips to 1
export const listAllWithStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    const allLeveranciers = await ctx.db
      .query("leveranciers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const totaal = allLeveranciers.length;
    const actief = allLeveranciers.filter((l) => l.isActief).length;
    const inactief = totaal - actief;

    return {
      leveranciers: allLeveranciers,
      stats: {
        totaal,
        actief,
        inactief,
      },
    };
  },
});

// Reactivate a soft-deleted leverancier
export const reactivate = mutation({
  args: { id: v.id("leveranciers") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);

    // Verify ownership
    const leverancier = await ctx.db.get(args.id);
    if (!leverancier) {
      throw new ConvexError("Leverancier niet gevonden");
    }
    if (leverancier.userId.toString() !== userId.toString()) {
      throw new ConvexError("Geen toegang tot deze leverancier");
    }

    if (leverancier.isActief) {
      throw new ConvexError("Leverancier is al actief");
    }

    await ctx.db.patch(args.id, {
      isActief: true,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});
