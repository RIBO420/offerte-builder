/**
 * Project Kosten Functions - Real-time project cost tracking
 *
 * Provides comprehensive cost tracking and analysis for projects.
 * Aggregates costs from multiple sources:
 * - Arbeidskosten (from urenRegistraties)
 * - Machinekosten (from machineGebruik)
 * - Materiaalkosten (from voorraadMutaties)
 * - Overige kosten (manual entries in projectKosten table)
 *
 * Compares actual costs with voorcalculatie (planned budget) for deviation analysis.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireAuthUserId, verifyOwnership } from "./auth";
import { Id } from "./_generated/dataModel";
import { validatePositive, sanitizeOptionalString } from "./validators";

// Cost types for categorization
const kostenTypeValidator = v.union(
  v.literal("materiaal"),
  v.literal("arbeid"),
  v.literal("machine"),
  v.literal("overig")
);

/**
 * Helper: Get a project and verify ownership.
 */
async function getOwnedProject(
  ctx: Parameters<typeof requireAuth>[0],
  projectId: Id<"projecten">
) {
  const project = await ctx.db.get(projectId);
  return verifyOwnership(ctx, project, "project");
}

/**
 * Helper: Calculate arbeidskosten from urenRegistraties.
 */
async function calculateArbeidskosten(
  ctx: Parameters<typeof requireAuth>[0],
  projectId: Id<"projecten">,
  userId: Id<"users">,
  startDate?: string,
  endDate?: string
) {
  const urenRegistraties = await ctx.db
    .query("urenRegistraties")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect();

  // Get instellingen for uurtarief
  const instellingen = await ctx.db
    .query("instellingen")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();

  const standaardUurtarief = instellingen?.uurtarief || 45;

  // Get medewerkers for individual tarieven
  const medewerkers = await ctx.db
    .query("medewerkers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  const medewerkerTarieven = new Map(
    medewerkers.map((m) => [m.naam, m.uurtarief || standaardUurtarief])
  );

  // Filter by date if provided
  let filteredUren = urenRegistraties;
  if (startDate) {
    filteredUren = filteredUren.filter((u) => u.datum >= startDate);
  }
  if (endDate) {
    filteredUren = filteredUren.filter((u) => u.datum <= endDate);
  }

  // Calculate costs per entry
  const kostenItems = filteredUren.map((u) => {
    const uurtarief = medewerkerTarieven.get(u.medewerker) || standaardUurtarief;
    return {
      id: u._id.toString(),
      type: "arbeid" as const,
      datum: u.datum,
      omschrijving: `${u.medewerker} - ${u.uren} uur`,
      scope: u.scope || "algemeen",
      hoeveelheid: u.uren,
      eenheid: "uur",
      prijsPerEenheid: uurtarief,
      totaal: u.uren * uurtarief,
      bron: "urenRegistraties" as const,
      bronId: u._id.toString(),
      medewerker: u.medewerker,
      notities: u.notities,
    };
  });

  return kostenItems;
}

/**
 * Helper: Calculate machinekosten from machineGebruik.
 */
async function calculateMachinekosten(
  ctx: Parameters<typeof requireAuth>[0],
  projectId: Id<"projecten">,
  startDate?: string,
  endDate?: string
) {
  const machineGebruik = await ctx.db
    .query("machineGebruik")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect();

  // Filter by date if provided
  let filteredGebruik = machineGebruik;
  if (startDate) {
    filteredGebruik = filteredGebruik.filter((m) => m.datum >= startDate);
  }
  if (endDate) {
    filteredGebruik = filteredGebruik.filter((m) => m.datum <= endDate);
  }

  // Get machine details
  const machineIds = Array.from(
    new Set(filteredGebruik.map((m) => m.machineId.toString()))
  );
  const machines = await Promise.all(
    machineIds.map((id) => ctx.db.get(id as Id<"machines">))
  );
  const machineMap = new Map<
    string,
    { naam: string; tarief: number; tariefType: "uur" | "dag" }
  >(
    machines
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .map((m) => [
        m._id.toString(),
        { naam: m.naam, tarief: m.tarief, tariefType: m.tariefType },
      ])
  );

  const kostenItems = filteredGebruik.map((m) => {
    const machineData = machineMap.get(m.machineId.toString());
    return {
      id: m._id.toString(),
      type: "machine" as const,
      datum: m.datum,
      omschrijving: machineData?.naam || "Onbekende machine",
      scope: "machines",
      hoeveelheid: m.uren,
      eenheid: machineData?.tariefType === "dag" ? "dag" : "uur",
      prijsPerEenheid: machineData?.tarief || 0,
      totaal: m.kosten,
      bron: "machineGebruik" as const,
      bronId: m._id.toString(),
    };
  });

  return kostenItems;
}

/**
 * Helper: Calculate materiaalkosten from voorraadMutaties.
 */
async function calculateMateriaalkosten(
  ctx: Parameters<typeof requireAuth>[0],
  projectId: Id<"projecten">,
  userId: Id<"users">,
  startDate?: string,
  endDate?: string
) {
  const mutaties = await ctx.db
    .query("voorraadMutaties")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect();

  // Only include verbruik (consumption) mutaties
  const verbruikMutaties = mutaties.filter((m) => m.type === "verbruik");

  // Filter by date if provided
  let filteredMutaties = verbruikMutaties;
  if (startDate) {
    const startTimestamp = new Date(startDate).getTime();
    filteredMutaties = filteredMutaties.filter(
      (m) => m.createdAt >= startTimestamp
    );
  }
  if (endDate) {
    const endTimestamp = new Date(endDate).getTime() + 86400000; // Include the whole day
    filteredMutaties = filteredMutaties.filter(
      (m) => m.createdAt < endTimestamp
    );
  }

  // Get product details
  const productIds = Array.from(
    new Set(filteredMutaties.map((m) => m.productId.toString()))
  );
  const producten = await Promise.all(
    productIds.map((id) => ctx.db.get(id as Id<"producten">))
  );
  const productMap = new Map<
    string,
    { productnaam: string; inkoopprijs: number; eenheid: string }
  >(
    producten
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .map((p) => [
        p._id.toString(),
        {
          productnaam: p.productnaam,
          inkoopprijs: p.inkoopprijs,
          eenheid: p.eenheid,
        },
      ])
  );

  const kostenItems = filteredMutaties.map((m) => {
    const productData = productMap.get(m.productId.toString());
    const hoeveelheid = Math.abs(m.hoeveelheid); // verbruik is negative
    const prijsPerEenheid = productData?.inkoopprijs || 0;
    return {
      id: m._id.toString(),
      type: "materiaal" as const,
      datum: new Date(m.createdAt).toISOString().split("T")[0],
      omschrijving: productData?.productnaam || "Onbekend product",
      scope: "materialen",
      hoeveelheid,
      eenheid: productData?.eenheid || "stuk",
      prijsPerEenheid,
      totaal: hoeveelheid * prijsPerEenheid,
      bron: "voorraadMutaties" as const,
      bronId: m._id.toString(),
      notities: m.notities,
    };
  });

  return kostenItems;
}

// ============================================
// 1. LIST - Haal alle kosten op voor een project
// ============================================

/**
 * List all costs for a project with optional filters.
 */
export const list = query({
  args: {
    projectId: v.id("projecten"),
    type: v.optional(kostenTypeValidator),
    startDate: v.optional(v.string()), // YYYY-MM-DD
    endDate: v.optional(v.string()), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await getOwnedProject(ctx, args.projectId);

    // Gather costs from all sources
    const [arbeidskosten, machinekosten, materiaalkosten] = await Promise.all([
      calculateArbeidskosten(
        ctx,
        args.projectId,
        user._id,
        args.startDate,
        args.endDate
      ),
      calculateMachinekosten(ctx, args.projectId, args.startDate, args.endDate),
      calculateMateriaalkosten(
        ctx,
        args.projectId,
        user._id,
        args.startDate,
        args.endDate
      ),
    ]);

    // Combine all costs
    let allKosten = [...arbeidskosten, ...machinekosten, ...materiaalkosten];

    // Filter by type if specified
    if (args.type) {
      allKosten = allKosten.filter((k) => k.type === args.type);
    }

    // Sort by date descending
    allKosten.sort((a, b) => b.datum.localeCompare(a.datum));

    return allKosten;
  },
});

// ============================================
// 2. GET BY ID - Haal een specifieke kostenpost op
// ============================================

/**
 * Get a specific cost entry by ID and type.
 * Since costs are aggregated from different sources, we need the type to know where to look.
 */
export const getById = query({
  args: {
    id: v.string(),
    type: kostenTypeValidator,
    projectId: v.id("projecten"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await getOwnedProject(ctx, args.projectId);

    if (args.type === "arbeid") {
      const uren = await ctx.db.get(args.id as Id<"urenRegistraties">);
      if (!uren || uren.projectId !== args.projectId) return null;

      // Get instellingen for uurtarief
      const instellingen = await ctx.db
        .query("instellingen")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .unique();
      const uurtarief = instellingen?.uurtarief || 45;

      return {
        id: uren._id.toString(),
        type: "arbeid" as const,
        datum: uren.datum,
        omschrijving: `${uren.medewerker} - ${uren.uren} uur`,
        scope: uren.scope || "algemeen",
        hoeveelheid: uren.uren,
        eenheid: "uur",
        prijsPerEenheid: uurtarief,
        totaal: uren.uren * uurtarief,
        medewerker: uren.medewerker,
        notities: uren.notities,
        bron: "urenRegistraties" as const,
        bronId: uren._id.toString(),
      };
    }

    if (args.type === "machine") {
      const gebruik = await ctx.db.get(args.id as Id<"machineGebruik">);
      if (!gebruik || gebruik.projectId !== args.projectId) return null;
      const machine = await ctx.db.get(gebruik.machineId);
      return {
        id: gebruik._id.toString(),
        type: "machine" as const,
        datum: gebruik.datum,
        omschrijving: machine?.naam || "Onbekende machine",
        scope: "machines",
        hoeveelheid: gebruik.uren,
        eenheid: machine?.tariefType === "dag" ? "dag" : "uur",
        prijsPerEenheid: machine?.tarief || 0,
        totaal: gebruik.kosten,
        bron: "machineGebruik" as const,
        bronId: gebruik._id.toString(),
      };
    }

    if (args.type === "materiaal") {
      const mutatie = await ctx.db.get(args.id as Id<"voorraadMutaties">);
      if (!mutatie || mutatie.projectId !== args.projectId) return null;
      const product = await ctx.db.get(mutatie.productId);
      const hoeveelheid = Math.abs(mutatie.hoeveelheid);
      const prijsPerEenheid = product?.inkoopprijs || 0;
      return {
        id: mutatie._id.toString(),
        type: "materiaal" as const,
        datum: new Date(mutatie.createdAt).toISOString().split("T")[0],
        omschrijving: product?.productnaam || "Onbekend product",
        scope: "materialen",
        hoeveelheid,
        eenheid: product?.eenheid || "stuk",
        prijsPerEenheid,
        totaal: hoeveelheid * prijsPerEenheid,
        notities: mutatie.notities,
        bron: "voorraadMutaties" as const,
        bronId: mutatie._id.toString(),
      };
    }

    return null;
  },
});

// ============================================
// 3. CREATE - Voeg een kostenpost toe
// ============================================

/**
 * Create a new cost entry.
 * Depending on type, creates entry in appropriate table.
 */
export const create = mutation({
  args: {
    projectId: v.id("projecten"),
    type: kostenTypeValidator,
    datum: v.string(), // YYYY-MM-DD
    omschrijving: v.string(),
    scope: v.optional(v.string()),
    hoeveelheid: v.number(),
    prijsPerEenheid: v.number(),
    // Type-specific fields
    medewerker: v.optional(v.string()), // for arbeid
    machineId: v.optional(v.id("machines")), // for machine
    productId: v.optional(v.id("producten")), // for materiaal
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    await getOwnedProject(ctx, args.projectId);

    // Validate required fields
    if (!args.omschrijving.trim()) {
      throw new Error("Omschrijving is verplicht");
    }
    if (!args.datum.trim()) {
      throw new Error("Datum is verplicht");
    }

    // Validate numeric fields
    const hoeveelheid = validatePositive(args.hoeveelheid, "Hoeveelheid");
    const prijsPerEenheid = validatePositive(args.prijsPerEenheid, "Prijs per eenheid");

    // Sanitize optional strings
    const notities = sanitizeOptionalString(args.notities);

    const totaal = hoeveelheid * prijsPerEenheid;

    if (args.type === "arbeid") {
      if (!args.medewerker) {
        throw new Error("Medewerker is verplicht voor arbeidskosten");
      }
      const id = await ctx.db.insert("urenRegistraties", {
        projectId: args.projectId,
        datum: args.datum,
        medewerker: args.medewerker,
        uren: args.hoeveelheid,
        scope: args.scope,
        notities: args.notities,
        bron: "handmatig",
      });
      return { id: id.toString(), type: "arbeid", totaal };
    }

    if (args.type === "machine") {
      if (!args.machineId) {
        throw new Error("Machine is verplicht voor machinekosten");
      }
      const id = await ctx.db.insert("machineGebruik", {
        projectId: args.projectId,
        machineId: args.machineId,
        datum: args.datum,
        uren: args.hoeveelheid,
        kosten: totaal,
      });
      return { id: id.toString(), type: "machine", totaal };
    }

    if (args.type === "materiaal") {
      if (!args.productId) {
        throw new Error("Product is verplicht voor materiaalkosten");
      }
      // Get or create voorraad entry
      let voorraad = await ctx.db
        .query("voorraad")
        .withIndex("by_user_product", (q) =>
          q.eq("userId", userId).eq("productId", args.productId!)
        )
        .unique();

      if (!voorraad) {
        const voorraadId = await ctx.db.insert("voorraad", {
          userId,
          productId: args.productId,
          hoeveelheid: 0,
          laatsteBijwerking: Date.now(),
        });
        voorraad = await ctx.db.get(voorraadId);
      }

      // Create verbruik mutatie
      const id = await ctx.db.insert("voorraadMutaties", {
        userId,
        voorraadId: voorraad!._id,
        productId: args.productId,
        type: "verbruik",
        hoeveelheid: -args.hoeveelheid, // negative for consumption
        projectId: args.projectId,
        notities: args.notities,
        createdAt: new Date(args.datum).getTime(),
      });

      // Update voorraad
      await ctx.db.patch(voorraad!._id, {
        hoeveelheid: voorraad!.hoeveelheid - args.hoeveelheid,
        laatsteBijwerking: Date.now(),
      });

      return { id: id.toString(), type: "materiaal", totaal };
    }

    throw new Error("Ongeldig kostentype");
  },
});

// ============================================
// 4. UPDATE - Update een kostenpost
// ============================================

/**
 * Update a cost entry.
 */
export const update = mutation({
  args: {
    id: v.string(),
    type: kostenTypeValidator,
    projectId: v.id("projecten"),
    datum: v.optional(v.string()),
    hoeveelheid: v.optional(v.number()),
    scope: v.optional(v.string()),
    notities: v.optional(v.string()),
    medewerker: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    await getOwnedProject(ctx, args.projectId);

    if (args.type === "arbeid") {
      const uren = await ctx.db.get(args.id as Id<"urenRegistraties">);
      if (!uren || uren.projectId !== args.projectId) {
        throw new Error("Urenregistratie niet gevonden");
      }

      const updates: Record<string, unknown> = {};
      if (args.datum !== undefined) updates.datum = args.datum;
      if (args.hoeveelheid !== undefined) updates.uren = args.hoeveelheid;
      if (args.scope !== undefined) updates.scope = args.scope;
      if (args.notities !== undefined) updates.notities = args.notities;
      if (args.medewerker !== undefined) updates.medewerker = args.medewerker;

      await ctx.db.patch(args.id as Id<"urenRegistraties">, updates);
      return { id: args.id, type: "arbeid" };
    }

    if (args.type === "machine") {
      const gebruik = await ctx.db.get(args.id as Id<"machineGebruik">);
      if (!gebruik || gebruik.projectId !== args.projectId) {
        throw new Error("Machinegebruik niet gevonden");
      }

      const machine = await ctx.db.get(gebruik.machineId);
      const newUren = args.hoeveelheid ?? gebruik.uren;
      const newKosten = newUren * (machine?.tarief || 0);

      const updates: Record<string, unknown> = {};
      if (args.datum !== undefined) updates.datum = args.datum;
      if (args.hoeveelheid !== undefined) {
        updates.uren = args.hoeveelheid;
        updates.kosten = newKosten;
      }

      await ctx.db.patch(args.id as Id<"machineGebruik">, updates);
      return { id: args.id, type: "machine" };
    }

    if (args.type === "materiaal") {
      const mutatie = await ctx.db.get(args.id as Id<"voorraadMutaties">);
      if (!mutatie || mutatie.projectId !== args.projectId) {
        throw new Error("Materiaalverbruik niet gevonden");
      }

      const updates: Record<string, unknown> = {};
      if (args.notities !== undefined) updates.notities = args.notities;

      // If hoeveelheid changes, we need to adjust voorraad
      if (args.hoeveelheid !== undefined) {
        const oldHoeveelheid = Math.abs(mutatie.hoeveelheid);
        const newHoeveelheid = args.hoeveelheid;
        const difference = newHoeveelheid - oldHoeveelheid;

        updates.hoeveelheid = -newHoeveelheid;

        // Update voorraad
        const voorraad = await ctx.db.get(mutatie.voorraadId);
        if (voorraad) {
          await ctx.db.patch(mutatie.voorraadId, {
            hoeveelheid: voorraad.hoeveelheid - difference,
            laatsteBijwerking: Date.now(),
          });
        }
      }

      await ctx.db.patch(args.id as Id<"voorraadMutaties">, updates);
      return { id: args.id, type: "materiaal" };
    }

    throw new Error("Ongeldig kostentype");
  },
});

// ============================================
// 5. REMOVE - Verwijder een kostenpost
// ============================================

/**
 * Remove a cost entry.
 */
export const remove = mutation({
  args: {
    id: v.string(),
    type: kostenTypeValidator,
    projectId: v.id("projecten"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    await getOwnedProject(ctx, args.projectId);

    if (args.type === "arbeid") {
      const uren = await ctx.db.get(args.id as Id<"urenRegistraties">);
      if (!uren || uren.projectId !== args.projectId) {
        throw new Error("Urenregistratie niet gevonden");
      }
      await ctx.db.delete(args.id as Id<"urenRegistraties">);
      return { id: args.id, type: "arbeid" };
    }

    if (args.type === "machine") {
      const gebruik = await ctx.db.get(args.id as Id<"machineGebruik">);
      if (!gebruik || gebruik.projectId !== args.projectId) {
        throw new Error("Machinegebruik niet gevonden");
      }
      await ctx.db.delete(args.id as Id<"machineGebruik">);
      return { id: args.id, type: "machine" };
    }

    if (args.type === "materiaal") {
      const mutatie = await ctx.db.get(args.id as Id<"voorraadMutaties">);
      if (!mutatie || mutatie.projectId !== args.projectId) {
        throw new Error("Materiaalverbruik niet gevonden");
      }

      // Restore voorraad
      const voorraad = await ctx.db.get(mutatie.voorraadId);
      if (voorraad) {
        await ctx.db.patch(mutatie.voorraadId, {
          hoeveelheid: voorraad.hoeveelheid + Math.abs(mutatie.hoeveelheid),
          laatsteBijwerking: Date.now(),
        });
      }

      await ctx.db.delete(args.id as Id<"voorraadMutaties">);
      return { id: args.id, type: "materiaal" };
    }

    throw new Error("Ongeldig kostentype");
  },
});

// ============================================
// 6. GET TOTALEN - Totalen per type
// ============================================

/**
 * Get totals per cost type for a project.
 */
export const getTotalen = query({
  args: {
    projectId: v.id("projecten"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await getOwnedProject(ctx, args.projectId);

    const [arbeidskosten, machinekosten, materiaalkosten] = await Promise.all([
      calculateArbeidskosten(
        ctx,
        args.projectId,
        user._id,
        args.startDate,
        args.endDate
      ),
      calculateMachinekosten(ctx, args.projectId, args.startDate, args.endDate),
      calculateMateriaalkosten(
        ctx,
        args.projectId,
        user._id,
        args.startDate,
        args.endDate
      ),
    ]);

    const totaalArbeid = arbeidskosten.reduce((sum, k) => sum + k.totaal, 0);
    const totaalMachine = machinekosten.reduce((sum, k) => sum + k.totaal, 0);
    const totaalMateriaal = materiaalkosten.reduce((sum, k) => sum + k.totaal, 0);
    const totaalUren = arbeidskosten.reduce((sum, k) => sum + k.hoeveelheid, 0);

    return {
      arbeid: {
        totaal: Math.round(totaalArbeid * 100) / 100,
        uren: Math.round(totaalUren * 100) / 100,
        aantalRegistraties: arbeidskosten.length,
      },
      machine: {
        totaal: Math.round(totaalMachine * 100) / 100,
        aantalRegistraties: machinekosten.length,
      },
      materiaal: {
        totaal: Math.round(totaalMateriaal * 100) / 100,
        aantalRegistraties: materiaalkosten.length,
      },
      overig: {
        totaal: 0,
        aantalRegistraties: 0,
      },
      totaal: Math.round((totaalArbeid + totaalMachine + totaalMateriaal) * 100) / 100,
    };
  },
});

// ============================================
// 7. GET BY SCOPE - Kosten per scope
// ============================================

/**
 * Get costs grouped by scope.
 */
export const getByScope = query({
  args: {
    projectId: v.id("projecten"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await getOwnedProject(ctx, args.projectId);

    const [arbeidskosten, machinekosten, materiaalkosten] = await Promise.all([
      calculateArbeidskosten(
        ctx,
        args.projectId,
        user._id,
        args.startDate,
        args.endDate
      ),
      calculateMachinekosten(ctx, args.projectId, args.startDate, args.endDate),
      calculateMateriaalkosten(
        ctx,
        args.projectId,
        user._id,
        args.startDate,
        args.endDate
      ),
    ]);

    const allKosten = [...arbeidskosten, ...machinekosten, ...materiaalkosten];

    // Group by scope
    const perScope: Record<
      string,
      {
        arbeid: number;
        machine: number;
        materiaal: number;
        totaal: number;
        uren: number;
      }
    > = {};

    for (const kost of allKosten) {
      const scope = kost.scope;
      if (!perScope[scope]) {
        perScope[scope] = {
          arbeid: 0,
          machine: 0,
          materiaal: 0,
          totaal: 0,
          uren: 0,
        };
      }

      perScope[scope][kost.type] += kost.totaal;
      perScope[scope].totaal += kost.totaal;

      if (kost.type === "arbeid") {
        perScope[scope].uren += kost.hoeveelheid;
      }
    }

    // Round values
    for (const scope of Object.keys(perScope)) {
      perScope[scope].arbeid = Math.round(perScope[scope].arbeid * 100) / 100;
      perScope[scope].machine = Math.round(perScope[scope].machine * 100) / 100;
      perScope[scope].materiaal =
        Math.round(perScope[scope].materiaal * 100) / 100;
      perScope[scope].totaal = Math.round(perScope[scope].totaal * 100) / 100;
      perScope[scope].uren = Math.round(perScope[scope].uren * 100) / 100;
    }

    return perScope;
  },
});

// ============================================
// 8. GET BUDGET VERGELIJKING - Vergelijk met voorcalculatie
// ============================================

/**
 * Compare actual costs with voorcalculatie (planned budget).
 * Returns deviation analysis with percentage calculations.
 */
export const getBudgetVergelijking = query({
  args: {
    projectId: v.id("projecten"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const project = await getOwnedProject(ctx, args.projectId);

    // Get voorcalculatie - first try by offerte, then by project
    let voorcalculatie = await ctx.db
      .query("voorcalculaties")
      .withIndex("by_offerte", (q) => q.eq("offerteId", project.offerteId))
      .unique();

    if (!voorcalculatie) {
      voorcalculatie = await ctx.db
        .query("voorcalculaties")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .unique();
    }

    // Get offerte for planned costs
    const offerte = await ctx.db.get(project.offerteId);

    if (!voorcalculatie || !offerte) {
      return {
        error: "Geen voorcalculatie of offerte gevonden voor dit project",
        data: null,
      };
    }

    // Calculate actual costs
    const [arbeidskosten, machinekosten, materiaalkosten] = await Promise.all([
      calculateArbeidskosten(ctx, args.projectId, user._id),
      calculateMachinekosten(ctx, args.projectId),
      calculateMateriaalkosten(ctx, args.projectId, user._id),
    ]);

    const werkelijkeArbeidskosten = arbeidskosten.reduce(
      (sum, k) => sum + k.totaal,
      0
    );
    const werkelijkeMachinekosten = machinekosten.reduce(
      (sum, k) => sum + k.totaal,
      0
    );
    const werkelijkeMateriaalkosten = materiaalkosten.reduce(
      (sum, k) => sum + k.totaal,
      0
    );
    const werkelijkeUren = arbeidskosten.reduce(
      (sum, k) => sum + k.hoeveelheid,
      0
    );

    // Get planned values from offerte
    const geplandeArbeidskosten = offerte.totalen.arbeidskosten;
    const geplandeMachinekosten = offerte.regels
      .filter((r) => r.type === "machine")
      .reduce((sum, r) => sum + r.totaal, 0);
    const geplandeMateriaalkosten = offerte.totalen.materiaalkosten;
    const geplandeUren = voorcalculatie.normUrenTotaal;

    // Calculate deviations
    const calculateAfwijking = (werkelijk: number, gepland: number) => {
      const absoluut = werkelijk - gepland;
      const percentage =
        gepland > 0
          ? Math.round(((werkelijk - gepland) / gepland) * 100 * 10) / 10
          : 0;
      return { absoluut: Math.round(absoluut * 100) / 100, percentage };
    };

    const afwijkingArbeid = calculateAfwijking(
      werkelijkeArbeidskosten,
      geplandeArbeidskosten
    );
    const afwijkingMachine = calculateAfwijking(
      werkelijkeMachinekosten,
      geplandeMachinekosten
    );
    const afwijkingMateriaal = calculateAfwijking(
      werkelijkeMateriaalkosten,
      geplandeMateriaalkosten
    );
    const afwijkingUren = calculateAfwijking(werkelijkeUren, geplandeUren);

    const werkelijkTotaal =
      werkelijkeArbeidskosten +
      werkelijkeMachinekosten +
      werkelijkeMateriaalkosten;
    const geplandTotaal =
      geplandeArbeidskosten + geplandeMachinekosten + geplandeMateriaalkosten;
    const afwijkingTotaal = calculateAfwijking(werkelijkTotaal, geplandTotaal);

    // Calculate per-scope deviations (hours only for now)
    const werkelijkeUrenPerScope: Record<string, number> = {};
    for (const kost of arbeidskosten) {
      werkelijkeUrenPerScope[kost.scope] =
        (werkelijkeUrenPerScope[kost.scope] || 0) + kost.hoeveelheid;
    }

    const normUrenPerScope = voorcalculatie.normUrenPerScope || {};
    const afwijkingenPerScope: Record<
      string,
      { absoluut: number; percentage: number }
    > = {};

    const allScopes = Array.from(
      new Set([
        ...Object.keys(normUrenPerScope),
        ...Object.keys(werkelijkeUrenPerScope),
      ])
    );

    for (const scope of allScopes) {
      const gepland = normUrenPerScope[scope] || 0;
      const werkelijk = werkelijkeUrenPerScope[scope] || 0;
      afwijkingenPerScope[scope] = calculateAfwijking(werkelijk, gepland);
    }

    return {
      error: null,
      data: {
        gepland: {
          arbeid: Math.round(geplandeArbeidskosten * 100) / 100,
          machine: Math.round(geplandeMachinekosten * 100) / 100,
          materiaal: Math.round(geplandeMateriaalkosten * 100) / 100,
          uren: Math.round(geplandeUren * 100) / 100,
          totaal: Math.round(geplandTotaal * 100) / 100,
          urenPerScope: normUrenPerScope,
        },
        werkelijk: {
          arbeid: Math.round(werkelijkeArbeidskosten * 100) / 100,
          machine: Math.round(werkelijkeMachinekosten * 100) / 100,
          materiaal: Math.round(werkelijkeMateriaalkosten * 100) / 100,
          uren: Math.round(werkelijkeUren * 100) / 100,
          totaal: Math.round(werkelijkTotaal * 100) / 100,
          urenPerScope: werkelijkeUrenPerScope,
        },
        afwijking: {
          arbeid: afwijkingArbeid,
          machine: afwijkingMachine,
          materiaal: afwijkingMateriaal,
          uren: afwijkingUren,
          totaal: afwijkingTotaal,
          perScope: afwijkingenPerScope,
        },
        // Summary metrics
        budgetStatus:
          afwijkingTotaal.percentage <= 0
            ? "onder_budget"
            : afwijkingTotaal.percentage <= 10
              ? "binnen_marge"
              : "over_budget",
        urenStatus:
          afwijkingUren.percentage <= 0
            ? "onder_planning"
            : afwijkingUren.percentage <= 10
              ? "binnen_marge"
              : "over_planning",
      },
    };
  },
});

// ============================================
// 9. GET DAGELIJKS OVERZICHT - Kosten per dag
// ============================================

/**
 * Get daily cost overview for a project.
 */
export const getDagelijksOverzicht = query({
  args: {
    projectId: v.id("projecten"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await getOwnedProject(ctx, args.projectId);

    const [arbeidskosten, machinekosten, materiaalkosten] = await Promise.all([
      calculateArbeidskosten(
        ctx,
        args.projectId,
        user._id,
        args.startDate,
        args.endDate
      ),
      calculateMachinekosten(ctx, args.projectId, args.startDate, args.endDate),
      calculateMateriaalkosten(
        ctx,
        args.projectId,
        user._id,
        args.startDate,
        args.endDate
      ),
    ]);

    const allKosten = [...arbeidskosten, ...machinekosten, ...materiaalkosten];

    // Group by date
    const perDag: Record<
      string,
      {
        arbeid: number;
        machine: number;
        materiaal: number;
        totaal: number;
        uren: number;
      }
    > = {};

    for (const kost of allKosten) {
      const datum = kost.datum;
      if (!perDag[datum]) {
        perDag[datum] = {
          arbeid: 0,
          machine: 0,
          materiaal: 0,
          totaal: 0,
          uren: 0,
        };
      }

      perDag[datum][kost.type] += kost.totaal;
      perDag[datum].totaal += kost.totaal;

      if (kost.type === "arbeid") {
        perDag[datum].uren += kost.hoeveelheid;
      }
    }

    // Round values and convert to sorted array
    const dagen = Object.entries(perDag)
      .map(([datum, data]) => ({
        datum,
        arbeid: Math.round(data.arbeid * 100) / 100,
        machine: Math.round(data.machine * 100) / 100,
        materiaal: Math.round(data.materiaal * 100) / 100,
        totaal: Math.round(data.totaal * 100) / 100,
        uren: Math.round(data.uren * 100) / 100,
      }))
      .sort((a, b) => a.datum.localeCompare(b.datum));

    return dagen;
  },
});

// ============================================
// 10. GET PROJECT OVERZICHT - Complete kostenanalyse
// ============================================

/**
 * Get complete cost analysis for a project.
 * Combines all cost data into a comprehensive overview.
 */
export const getProjectOverzicht = query({
  args: {
    projectId: v.id("projecten"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const project = await getOwnedProject(ctx, args.projectId);

    // Get offerte and voorcalculatie
    const offerte = await ctx.db.get(project.offerteId);

    let voorcalculatie = await ctx.db
      .query("voorcalculaties")
      .withIndex("by_offerte", (q) => q.eq("offerteId", project.offerteId))
      .unique();

    if (!voorcalculatie) {
      voorcalculatie = await ctx.db
        .query("voorcalculaties")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .unique();
    }

    // Get all costs
    const [arbeidskosten, machinekosten, materiaalkosten] = await Promise.all([
      calculateArbeidskosten(ctx, args.projectId, user._id),
      calculateMachinekosten(ctx, args.projectId),
      calculateMateriaalkosten(ctx, args.projectId, user._id),
    ]);

    const allKosten = [...arbeidskosten, ...machinekosten, ...materiaalkosten];

    // Calculate totals
    const totaalArbeid = arbeidskosten.reduce((sum, k) => sum + k.totaal, 0);
    const totaalMachine = machinekosten.reduce((sum, k) => sum + k.totaal, 0);
    const totaalMateriaal = materiaalkosten.reduce((sum, k) => sum + k.totaal, 0);
    const totaalUren = arbeidskosten.reduce((sum, k) => sum + k.hoeveelheid, 0);
    const totaalKosten = totaalArbeid + totaalMachine + totaalMateriaal;

    // Get unique dates for werkelijke dagen
    const uniqueDates = new Set(allKosten.map((k) => k.datum));
    const werkelijkeDagen = uniqueDates.size;

    // Get unique medewerkers
    const medewerkers = new Set(
      arbeidskosten.map((k) => k.medewerker).filter(Boolean)
    );

    // Budget comparison if voorcalculatie exists
    let budgetVergelijking = null;
    if (voorcalculatie && offerte) {
      const geplandeArbeidskosten = offerte.totalen.arbeidskosten;
      const geplandeMachinekosten = offerte.regels
        .filter((r) => r.type === "machine")
        .reduce((sum, r) => sum + r.totaal, 0);
      const geplandeMateriaalkosten = offerte.totalen.materiaalkosten;
      const geplandeUren = voorcalculatie.normUrenTotaal;
      const geplandTotaal =
        geplandeArbeidskosten + geplandeMachinekosten + geplandeMateriaalkosten;

      const afwijkingKosten = totaalKosten - geplandTotaal;
      const afwijkingPercentage =
        geplandTotaal > 0
          ? Math.round(
              ((totaalKosten - geplandTotaal) / geplandTotaal) * 100 * 10
            ) / 10
          : 0;

      const afwijkingUren = totaalUren - geplandeUren;
      const afwijkingUrenPercentage =
        geplandeUren > 0
          ? Math.round(((totaalUren - geplandeUren) / geplandeUren) * 100 * 10) /
            10
          : 0;

      budgetVergelijking = {
        geplandTotaal: Math.round(geplandTotaal * 100) / 100,
        werkelijkTotaal: Math.round(totaalKosten * 100) / 100,
        afwijkingKosten: Math.round(afwijkingKosten * 100) / 100,
        afwijkingPercentage,
        geplandeUren: Math.round(geplandeUren * 100) / 100,
        werkelijkeUren: Math.round(totaalUren * 100) / 100,
        afwijkingUren: Math.round(afwijkingUren * 100) / 100,
        afwijkingUrenPercentage,
        geschatteDagen: voorcalculatie.geschatteDagen,
        werkelijkeDagen,
      };
    }

    // Group costs by scope
    const kostenPerScope: Record<string, number> = {};
    for (const kost of allKosten) {
      kostenPerScope[kost.scope] = (kostenPerScope[kost.scope] || 0) + kost.totaal;
    }

    // Round scope values
    for (const scope of Object.keys(kostenPerScope)) {
      kostenPerScope[scope] = Math.round(kostenPerScope[scope] * 100) / 100;
    }

    // Calculate per-medewerker stats
    const urenPerMedewerker: Record<string, number> = {};
    for (const kost of arbeidskosten) {
      if (kost.medewerker) {
        urenPerMedewerker[kost.medewerker] =
          (urenPerMedewerker[kost.medewerker] || 0) + kost.hoeveelheid;
      }
    }

    return {
      project: {
        id: project._id,
        naam: project.naam,
        status: project.status,
      },
      totalen: {
        arbeid: Math.round(totaalArbeid * 100) / 100,
        machine: Math.round(totaalMachine * 100) / 100,
        materiaal: Math.round(totaalMateriaal * 100) / 100,
        totaal: Math.round(totaalKosten * 100) / 100,
        uren: Math.round(totaalUren * 100) / 100,
      },
      statistieken: {
        werkelijkeDagen,
        aantalMedewerkers: medewerkers.size,
        aantalKostenposten: allKosten.length,
        gemiddeldeKostenPerDag:
          werkelijkeDagen > 0
            ? Math.round((totaalKosten / werkelijkeDagen) * 100) / 100
            : 0,
        gemiddeldeUrenPerDag:
          werkelijkeDagen > 0
            ? Math.round((totaalUren / werkelijkeDagen) * 100) / 100
            : 0,
      },
      kostenPerScope,
      urenPerMedewerker,
      budgetVergelijking,
      laatsteActiviteit:
        allKosten.length > 0
          ? allKosten.sort((a, b) => b.datum.localeCompare(a.datum))[0].datum
          : null,
    };
  },
});
