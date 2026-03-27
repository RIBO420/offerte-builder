import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireKlant } from "./auth";

// Portal overview — KPIs + recent activity
export const getOverzicht = query({
  handler: async (ctx) => {
    const { klant } = await requireKlant(ctx);

    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    const activeOffertes = offertes.filter(
      (o) => !o.deletedAt && !o.isArchived
    );

    const projecten = await ctx.db
      .query("projecten")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    const visibleFacturen = facturen.filter((f) =>
      ["verzonden", "betaald", "vervallen"].includes(f.status)
    );

    const chatThreads = await ctx.db
      .query("chat_threads")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    const unreadMessages = chatThreads.reduce(
      (sum, t) => sum + (t.unreadByKlant ?? 0),
      0
    );

    // Recent activity (last 10 items)
    const activity = [
      ...activeOffertes
        .filter((o) => o.status === "verzonden")
        .map((o) => ({
          type: "offerte" as const,
          title: `Nieuwe offerte: ${o.offerteNummer}`,
          subtitle: o.offerteNummer,
          date: o.verzondenAt ?? o.createdAt,
          id: o._id,
        })),
      ...visibleFacturen
        .filter((f) => f.status === "verzonden")
        .map((f) => ({
          type: "factuur" as const,
          title: `Factuur: € ${f.totaalInclBtw?.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`,
          subtitle: f.factuurnummer,
          date: f.createdAt,
          id: f._id,
        })),
      ...chatThreads
        .filter((t) => (t.unreadByKlant ?? 0) > 0)
        .map((t) => ({
          type: "bericht" as const,
          title: `Bericht van Top Tuinen`,
          subtitle: t.lastMessagePreview ?? "",
          date: t.lastMessageAt ?? t.createdAt,
          id: t._id,
        })),
    ]
      .sort((a, b) => b.date - a.date)
      .slice(0, 10);

    return {
      kpis: {
        openOffertes: activeOffertes.filter((o) => o.status === "verzonden").length,
        lopendeProjecten: projecten.filter((p) => p.status === "in_uitvoering").length,
        openFacturen: visibleFacturen.filter((f) => f.status === "verzonden").length,
        nieuweBerichten: unreadMessages,
      },
      activity,
      klantNaam: klant.naam,
    };
  },
});

// List all offertes for this klant
export const getOffertes = query({
  handler: async (ctx) => {
    const { klant } = await requireKlant(ctx);

    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    return offertes
      .filter((o) => !o.deletedAt && !o.isArchived)
      .map((o) => ({
        _id: o._id,
        offerteNummer: o.offerteNummer,
        type: o.type,
        status: o.status,
        totaalInclBtw: o.totalen?.totaalInclBtw,
        createdAt: o.createdAt,
        verzondenAt: o.verzondenAt,
        customerResponse: o.customerResponse,
        // Strip internal fields
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get single offerte detail for portal
export const getOfferte = query({
  args: { id: v.id("offertes") },
  handler: async (ctx, args) => {
    const { klant } = await requireKlant(ctx);
    const offerte = await ctx.db.get(args.id);
    if (!offerte || offerte.klantId?.toString() !== klant._id.toString()) {
      return null;
    }

    // Return customer-visible fields only (same filtering as publicOffertes.getByToken)
    return {
      _id: offerte._id,
      offerteNummer: offerte.offerteNummer,
      type: offerte.type,
      status: offerte.status,
      klant: offerte.klant,
      scopes: offerte.scopes,
      regels: offerte.regels?.filter(
        (r) => r.type !== "arbeid"
      ),
      totalen: offerte.totalen
        ? {
            totaalExBtw: offerte.totalen.totaalExBtw,
            btw: offerte.totalen.btw,
            totaalInclBtw: offerte.totalen.totaalInclBtw,
          }
        : undefined,
      notities: offerte.notities,
      createdAt: offerte.createdAt,
      verzondenAt: offerte.verzondenAt,
      customerResponse: offerte.customerResponse,
    };
  },
});

// List projecten for this klant
export const getProjecten = query({
  handler: async (ctx) => {
    const { klant } = await requireKlant(ctx);

    const projecten = await ctx.db
      .query("projecten")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    // NOTE: projecten has no startDatum/verwachteOplevering fields
    // Dates can be derived from planningTaken in a follow-up
    return projecten
      .map((p) => ({
        _id: p._id,
        naam: p.naam,
        status: p.status,
        createdAt: p.createdAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get single project detail
export const getProject = query({
  args: { id: v.id("projecten") },
  handler: async (ctx, args) => {
    const { klant } = await requireKlant(ctx);
    const project = await ctx.db.get(args.id);
    if (!project || project.klantId?.toString() !== klant._id.toString()) {
      return null;
    }

    // Get linked offerte for scope info
    let scopes: string[] = [];
    if (project.offerteId) {
      const offerte = await ctx.db.get(project.offerteId);
      scopes = offerte?.scopes ?? [];
    }

    // NOTE: no startDatum/verwachteOplevering on projecten table
    return {
      _id: project._id,
      naam: project.naam,
      status: project.status,
      scopes,
      createdAt: project.createdAt,
    };
  },
});

// List facturen for this klant (only customer-visible statuses)
export const getFacturen = query({
  handler: async (ctx) => {
    const { klant } = await requireKlant(ctx);

    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    // NOTE: field is factuurnummer (lowercase), betaaldAt (not betaaldOp)
    // No molliePaymentUrl on facturen — payment links via betalingen table
    const visibleFacturen = facturen
      .filter((f) => ["verzonden", "betaald", "vervallen"].includes(f.status));

    // Look up payment links from betalingen table for unpaid facturen
    // The betalingen table uses `referentie` (string) to link to factuurnummer,
    // and payment checkout URLs may be stored in `metadata`
    const result = await Promise.all(
      visibleFacturen.map(async (f) => {
        let paymentUrl: string | undefined;
        if (f.status === "verzonden") {
          const betaling = await ctx.db
            .query("betalingen")
            .withIndex("by_referentie", (q) => q.eq("referentie", f.factuurnummer))
            .first();
          // Check metadata for checkout URL if betaling exists
          if (betaling?.metadata) {
            const url = betaling.metadata["checkoutUrl"];
            if (typeof url === "string") {
              paymentUrl = url;
            }
          }
        }
        return {
          _id: f._id,
          factuurnummer: f.factuurnummer,
          status: f.status,
          totaalInclBtw: f.totaalInclBtw,
          vervaldatum: f.vervaldatum,
          betaaldAt: f.betaaldAt,
          createdAt: f.createdAt,
          paymentUrl,
        };
      })
    );

    return result.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Respond to offerte (accept/reject with signature)
export const respondToOfferte = mutation({
  args: {
    offerteId: v.id("offertes"),
    status: v.union(v.literal("geaccepteerd"), v.literal("afgewezen")),
    comment: v.optional(v.string()),
    signature: v.optional(v.string()),
    selectedOptionalRegelIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { klant } = await requireKlant(ctx);
    const offerte = await ctx.db.get(args.offerteId);
    if (!offerte || offerte.klantId?.toString() !== klant._id.toString()) {
      throw new Error("Offerte niet gevonden");
    }
    if (offerte.status !== "verzonden") {
      throw new Error("Deze offerte kan niet meer worden beantwoord");
    }
    if (args.status === "geaccepteerd" && !args.signature) {
      throw new Error("Een handtekening is verplicht bij acceptatie");
    }

    // Update offerte status and customerResponse
    await ctx.db.patch(args.offerteId, {
      status: args.status === "geaccepteerd" ? "geaccepteerd" : "afgewezen",
      customerResponse: {
        status: args.status,
        comment: args.comment,
        respondedAt: Date.now(),
        viewedAt: offerte.customerResponse?.viewedAt ?? Date.now(),
        signature: args.signature,
        signedAt: args.signature ? Date.now() : undefined,
        selectedOptionalRegelIds: args.selectedOptionalRegelIds,
      },
    });

    return { success: true };
  },
});

// Get all downloadable documents grouped by offerte/project
export const getDocumenten = query({
  handler: async (ctx) => {
    const { klant } = await requireKlant(ctx);

    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
      .collect();

    const visibleOffertes = offertes.filter(
      (o) => !o.deletedAt && !o.isArchived && o.status !== "concept"
    );
    const visibleFacturen = facturen.filter((f) =>
      ["verzonden", "betaald", "vervallen"].includes(f.status)
    );

    return {
      offertes: visibleOffertes.map((o) => ({
        _id: o._id,
        offerteNummer: o.offerteNummer,
        type: o.type,
        createdAt: o.createdAt,
      })),
      facturen: visibleFacturen.map((f) => ({
        _id: f._id,
        factuurnummer: f.factuurnummer,
        createdAt: f.createdAt,
      })),
    };
  },
});

// Update klant profile
export const updateProfile = mutation({
  args: {
    naam: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    adres: v.optional(v.string()),
    postcode: v.optional(v.string()),
    plaats: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { klant } = await requireKlant(ctx);

    const updates: Record<string, string> = {};
    if (args.naam !== undefined) updates.naam = args.naam;
    if (args.telefoon !== undefined) updates.telefoon = args.telefoon;
    if (args.adres !== undefined) updates.adres = args.adres;
    if (args.postcode !== undefined) updates.postcode = args.postcode;
    if (args.plaats !== undefined) updates.plaats = args.plaats;

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(klant._id, { ...updates, updatedAt: Date.now() });
    }
  },
});

// Track klant last login time
export const updateLastLogin = mutation({
  handler: async (ctx) => {
    const { klant } = await requireKlant(ctx);
    await ctx.db.patch(klant._id, { lastLoginAt: Date.now() });
  },
});
