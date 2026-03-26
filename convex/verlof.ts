import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./auth";
import {
  requireAdmin,
  requireNotViewer,
  getUserRole,
  getLinkedMedewerker,
} from "./roles";

// ============================================
// VERLOFAANVRAGEN — Leave Request Management
// ============================================

const verlofTypeValidator = v.union(
  v.literal("vakantie"),
  v.literal("bijzonder"),
  v.literal("onbetaald"),
  v.literal("compensatie")
);

const verlofStatusValidator = v.union(
  v.literal("aangevraagd"),
  v.literal("goedgekeurd"),
  v.literal("afgekeurd")
);

// ============================================
// QUERIES
// ============================================

/**
 * List all verlofaanvragen for the company (admin) or own (medewerker).
 */
export const list = query({
  args: {
    status: v.optional(verlofStatusValidator),
    medewerkerId: v.optional(v.id("medewerkers")),
    jaar: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const role = await getUserRole(ctx);

    let aanvragen;

    if (role === "admin") {
      // Admin sees all for the company
      if (args.status) {
        aanvragen = await ctx.db
          .query("verlofaanvragen")
          .withIndex("by_user_status", (q) =>
            q.eq("userId", user._id).eq("status", args.status!)
          )
          .collect();
      } else {
        aanvragen = await ctx.db
          .query("verlofaanvragen")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();
      }

      // Filter by medewerker if specified
      if (args.medewerkerId) {
        aanvragen = aanvragen.filter(
          (a) => a.medewerkerId.toString() === args.medewerkerId!.toString()
        );
      }
    } else if (role === "medewerker") {
      // Medewerker sees only their own
      const linked = await getLinkedMedewerker(ctx);
      if (!linked) return [];

      if (args.status) {
        aanvragen = await ctx.db
          .query("verlofaanvragen")
          .withIndex("by_medewerker_status", (q) =>
            q.eq("medewerkerId", linked._id).eq("status", args.status!)
          )
          .collect();
      } else {
        aanvragen = await ctx.db
          .query("verlofaanvragen")
          .withIndex("by_medewerker", (q) => q.eq("medewerkerId", linked._id))
          .collect();
      }
    } else {
      return [];
    }

    // Filter by year if specified
    if (args.jaar) {
      const jaarStr = String(args.jaar);
      aanvragen = aanvragen.filter((a) => a.startDatum.startsWith(jaarStr));
    }

    // Sort by startDatum descending (newest first)
    aanvragen.sort((a, b) => b.startDatum.localeCompare(a.startDatum));

    // Enrich with medewerker naam
    const enriched = await Promise.all(
      aanvragen.map(async (aanvraag) => {
        const medewerker = await ctx.db.get(aanvraag.medewerkerId);
        return {
          ...aanvraag,
          medewerkerNaam: medewerker?.naam ?? "Onbekend",
        };
      })
    );

    return enriched;
  },
});

/**
 * Get a single verlofaanvraag by ID.
 */
export const get = query({
  args: { id: v.id("verlofaanvragen") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const aanvraag = await ctx.db.get(args.id);
    if (!aanvraag) return null;

    const medewerker = await ctx.db.get(aanvraag.medewerkerId);
    return {
      ...aanvraag,
      medewerkerNaam: medewerker?.naam ?? "Onbekend",
    };
  },
});

/**
 * Count pending verlofaanvragen (for badges/notifications).
 */
export const countPending = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const role = await getUserRole(ctx);

    if (role !== "admin") return 0;

    const pending = await ctx.db
      .query("verlofaanvragen")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "aangevraagd")
      )
      .collect();

    return pending.length;
  },
});

/**
 * Calculate verlofsaldo (leave balance) for a medewerker in a given year.
 * Standard: 25 vakantiedagen per jaar (fulltime). Part-time pro rata.
 */
export const getVerlofsaldo = query({
  args: {
    medewerkerId: v.id("medewerkers"),
    jaar: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const jaar = args.jaar ?? new Date().getFullYear();
    const medewerker = await ctx.db.get(args.medewerkerId);
    if (!medewerker) throw new Error("Medewerker niet gevonden");

    // Calculate annual entitlement based on contract type
    const urenPerWeek = medewerker.beschikbaarheid?.urenPerWeek ?? 40;
    const fulltimeUren = 40;
    const basisDagen = 25; // Wettelijk minimum + bovenwettelijk
    const jaarlijkseAanspraak = Math.round(
      (urenPerWeek / fulltimeUren) * basisDagen * 10
    ) / 10;

    // Get all approved leave for this year
    const jaarStr = String(jaar);
    const goedgekeurd = await ctx.db
      .query("verlofaanvragen")
      .withIndex("by_medewerker_status", (q) =>
        q.eq("medewerkerId", args.medewerkerId).eq("status", "goedgekeurd")
      )
      .collect();

    const opgenomenDagen = goedgekeurd
      .filter(
        (a) =>
          a.startDatum.startsWith(jaarStr) && a.type === "vakantie"
      )
      .reduce((sum, a) => sum + a.aantalDagen, 0);

    // Pending requests
    const aangevraagd = await ctx.db
      .query("verlofaanvragen")
      .withIndex("by_medewerker_status", (q) =>
        q.eq("medewerkerId", args.medewerkerId).eq("status", "aangevraagd")
      )
      .collect();

    const gereserveerdDagen = aangevraagd
      .filter(
        (a) =>
          a.startDatum.startsWith(jaarStr) && a.type === "vakantie"
      )
      .reduce((sum, a) => sum + a.aantalDagen, 0);

    return {
      jaar,
      jaarlijkseAanspraak,
      opgenomenDagen,
      gereserveerdDagen,
      restant: jaarlijkseAanspraak - opgenomenDagen,
      beschikbaar: jaarlijkseAanspraak - opgenomenDagen - gereserveerdDagen,
    };
  },
});

/**
 * Get medewerkers die op een bepaalde datum verlof hebben (voor planning integratie).
 */
export const getMedewerkersMetVerlof = query({
  args: {
    datum: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const goedgekeurd = await ctx.db
      .query("verlofaanvragen")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "goedgekeurd")
      )
      .collect();

    // Filter: datum valt binnen start-eind range
    const opDatum = goedgekeurd.filter(
      (a) => a.startDatum <= args.datum && a.eindDatum >= args.datum
    );

    return opDatum.map((a) => a.medewerkerId);
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Create a new verlofaanvraag.
 * Admin can create for any medewerker, medewerker can create for self.
 */
export const create = mutation({
  args: {
    medewerkerId: v.id("medewerkers"),
    startDatum: v.string(),
    eindDatum: v.string(),
    aantalDagen: v.number(),
    type: verlofTypeValidator,
    opmerking: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireNotViewer(ctx);
    const role = await getUserRole(ctx);

    // Validate medewerker access
    const medewerker = await ctx.db.get(args.medewerkerId);
    if (!medewerker) throw new Error("Medewerker niet gevonden");

    if (role === "medewerker") {
      // Medewerker can only create for themselves
      const linked = await getLinkedMedewerker(ctx);
      if (
        !linked ||
        linked._id.toString() !== args.medewerkerId.toString()
      ) {
        throw new Error(
          "Je kunt alleen verlof aanvragen voor jezelf"
        );
      }
    }

    // Validate dates
    if (args.startDatum > args.eindDatum) {
      throw new Error("Startdatum moet voor einddatum liggen");
    }
    if (args.aantalDagen <= 0) {
      throw new Error("Aantal dagen moet groter zijn dan 0");
    }

    // Check for overlapping leave
    const bestaand = await ctx.db
      .query("verlofaanvragen")
      .withIndex("by_medewerker", (q) =>
        q.eq("medewerkerId", args.medewerkerId)
      )
      .collect();

    const overlap = bestaand.find(
      (a) =>
        a.status !== "afgekeurd" &&
        a.startDatum <= args.eindDatum &&
        a.eindDatum >= args.startDatum
    );

    if (overlap) {
      throw new Error(
        "Er is al een verlofaanvraag voor deze periode"
      );
    }

    const now = Date.now();

    return await ctx.db.insert("verlofaanvragen", {
      userId: medewerker.userId,
      medewerkerId: args.medewerkerId,
      startDatum: args.startDatum,
      eindDatum: args.eindDatum,
      aantalDagen: args.aantalDagen,
      type: args.type,
      opmerking: args.opmerking,
      status: "aangevraagd",
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update a verlofaanvraag (only when status is 'aangevraagd').
 */
export const update = mutation({
  args: {
    id: v.id("verlofaanvragen"),
    startDatum: v.optional(v.string()),
    eindDatum: v.optional(v.string()),
    aantalDagen: v.optional(v.number()),
    type: v.optional(verlofTypeValidator),
    opmerking: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);

    const aanvraag = await ctx.db.get(args.id);
    if (!aanvraag) throw new Error("Verlofaanvraag niet gevonden");

    if (aanvraag.status !== "aangevraagd") {
      throw new Error(
        "Alleen aanvragen met status 'aangevraagd' kunnen worden gewijzigd"
      );
    }

    const updateData: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.startDatum !== undefined) updateData.startDatum = args.startDatum;
    if (args.eindDatum !== undefined) updateData.eindDatum = args.eindDatum;
    if (args.aantalDagen !== undefined)
      updateData.aantalDagen = args.aantalDagen;
    if (args.type !== undefined) updateData.type = args.type;
    if (args.opmerking !== undefined) updateData.opmerking = args.opmerking;

    // Validate dates if either changed
    const start =
      (updateData.startDatum as string) ?? aanvraag.startDatum;
    const eind =
      (updateData.eindDatum as string) ?? aanvraag.eindDatum;
    if (start > eind) {
      throw new Error("Startdatum moet voor einddatum liggen");
    }

    await ctx.db.patch(args.id, updateData);
    return args.id;
  },
});

/**
 * Approve a verlofaanvraag (admin only).
 */
export const goedkeuren = mutation({
  args: {
    id: v.id("verlofaanvragen"),
  },
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);

    const aanvraag = await ctx.db.get(args.id);
    if (!aanvraag) throw new Error("Verlofaanvraag niet gevonden");

    if (aanvraag.status !== "aangevraagd") {
      throw new Error("Alleen aanvragen met status 'aangevraagd' kunnen worden goedgekeurd");
    }

    await ctx.db.patch(args.id, {
      status: "goedgekeurd",
      behandeldDoor: user._id,
      behandeldOp: Date.now(),
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

/**
 * Reject a verlofaanvraag (admin only).
 */
export const afkeuren = mutation({
  args: {
    id: v.id("verlofaanvragen"),
    afwijzingReden: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);

    const aanvraag = await ctx.db.get(args.id);
    if (!aanvraag) throw new Error("Verlofaanvraag niet gevonden");

    if (aanvraag.status !== "aangevraagd") {
      throw new Error("Alleen aanvragen met status 'aangevraagd' kunnen worden afgekeurd");
    }

    await ctx.db.patch(args.id, {
      status: "afgekeurd",
      behandeldDoor: user._id,
      behandeldOp: Date.now(),
      afwijzingReden: args.afwijzingReden,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

/**
 * Delete a verlofaanvraag (only when status is 'aangevraagd').
 */
export const remove = mutation({
  args: { id: v.id("verlofaanvragen") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);

    const aanvraag = await ctx.db.get(args.id);
    if (!aanvraag) throw new Error("Verlofaanvraag niet gevonden");

    if (aanvraag.status !== "aangevraagd") {
      throw new Error(
        "Alleen aanvragen met status 'aangevraagd' kunnen worden verwijderd"
      );
    }

    await ctx.db.delete(args.id);
  },
});
