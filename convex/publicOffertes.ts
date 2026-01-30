import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate a unique share token
function generateToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let token = "";
  for (let i = 0; i < 24; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Create or refresh share link for an offerte
export const createShareLink = mutation({
  args: {
    offerteId: v.id("offertes"),
    expiresInDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const offerte = await ctx.db.get(args.offerteId);
    if (!offerte) {
      throw new Error("Offerte not found");
    }

    const token = generateToken();
    const expiresInDays = args.expiresInDays ?? 30;
    const expiresAt = Date.now() + expiresInDays * 24 * 60 * 60 * 1000;

    await ctx.db.patch(args.offerteId, {
      shareToken: token,
      shareExpiresAt: expiresAt,
      updatedAt: Date.now(),
    });

    return { token, expiresAt };
  },
});

// Revoke share link
export const revokeShareLink = mutation({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.offerteId, {
      shareToken: undefined,
      shareExpiresAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

// Get offerte by share token (public - no auth required)
export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const offerte = await ctx.db
      .query("offertes")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.token))
      .unique();

    if (!offerte) {
      return null;
    }

    // Check if link has expired
    if (offerte.shareExpiresAt && offerte.shareExpiresAt < Date.now()) {
      return { expired: true };
    }

    // Get business info
    const instellingen = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", offerte.userId))
      .unique();

    // Return limited data for public view (no internal pricing details)
    return {
      expired: false,
      offerte: {
        _id: offerte._id,
        offerteNummer: offerte.offerteNummer,
        type: offerte.type,
        status: offerte.status,
        klant: offerte.klant,
        scopes: offerte.scopes,
        regels: offerte.regels.map((r) => ({
          omschrijving: r.omschrijving,
          eenheid: r.eenheid,
          hoeveelheid: r.hoeveelheid,
          totaal: r.totaal,
          scope: r.scope,
        })),
        totalen: {
          totaalExBtw: offerte.totalen.totaalExBtw,
          btw: offerte.totalen.btw,
          totaalInclBtw: offerte.totalen.totaalInclBtw,
        },
        notities: offerte.notities,
        createdAt: offerte.createdAt,
        customerResponse: offerte.customerResponse,
      },
      bedrijfsgegevens: instellingen?.bedrijfsgegevens,
    };
  },
});

// Record that customer viewed the offerte
export const markAsViewed = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const offerte = await ctx.db
      .query("offertes")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.token))
      .unique();

    if (!offerte) {
      throw new Error("Offerte not found");
    }

    // Only update if not already responded
    if (!offerte.customerResponse?.status || offerte.customerResponse.status === "bekeken") {
      await ctx.db.patch(offerte._id, {
        customerResponse: {
          status: "bekeken",
          viewedAt: offerte.customerResponse?.viewedAt ?? Date.now(),
          respondedAt: Date.now(),
        },
        updatedAt: Date.now(),
      });
    }
  },
});

// Customer responds to offerte (accept/reject with optional comment and signature)
export const respond = mutation({
  args: {
    token: v.string(),
    status: v.union(v.literal("geaccepteerd"), v.literal("afgewezen")),
    comment: v.optional(v.string()),
    signature: v.optional(v.string()), // Base64 signature image
  },
  handler: async (ctx, args) => {
    const offerte = await ctx.db
      .query("offertes")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.token))
      .unique();

    if (!offerte) {
      throw new Error("Offerte not found");
    }

    // Check if already responded with accept/reject
    if (
      offerte.customerResponse?.status === "geaccepteerd" ||
      offerte.customerResponse?.status === "afgewezen"
    ) {
      throw new Error("Offerte is al beantwoord");
    }

    // Require signature for acceptance
    if (args.status === "geaccepteerd" && !args.signature) {
      throw new Error("Handtekening is verplicht bij accepteren");
    }

    const now = Date.now();

    // Update customer response
    await ctx.db.patch(offerte._id, {
      customerResponse: {
        status: args.status,
        comment: args.comment,
        viewedAt: offerte.customerResponse?.viewedAt ?? now,
        respondedAt: now,
        signature: args.signature,
        signedAt: args.signature ? now : undefined,
      },
      // Also update the main status
      status: args.status,
      updatedAt: now,
    });

    // Create a version for this status change
    const versions = await ctx.db
      .query("offerte_versions")
      .withIndex("by_offerte", (q) => q.eq("offerteId", offerte._id))
      .order("desc")
      .take(1);

    const versieNummer = (versions[0]?.versieNummer ?? 0) + 1;

    await ctx.db.insert("offerte_versions", {
      offerteId: offerte._id,
      userId: offerte.userId,
      versieNummer,
      snapshot: {
        status: args.status,
        klant: offerte.klant,
        algemeenParams: {
          bereikbaarheid: offerte.algemeenParams.bereikbaarheid,
          achterstalligheid: offerte.algemeenParams.achterstalligheid,
        },
        scopes: offerte.scopes,
        scopeData: offerte.scopeData,
        totalen: offerte.totalen,
        regels: offerte.regels.map((r) => ({
          id: r.id,
          scope: r.scope,
          omschrijving: r.omschrijving,
          eenheid: r.eenheid,
          hoeveelheid: r.hoeveelheid,
          prijsPerEenheid: r.prijsPerEenheid,
          totaal: r.totaal,
          type: r.type,
        })),
        notities: offerte.notities,
      },
      actie: "status_gewijzigd",
      omschrijving: `Klant heeft offerte ${args.status === "geaccepteerd" ? "geaccepteerd" : "afgewezen"}${args.comment ? ` - "${args.comment}"` : ""}`,
      createdAt: now,
    });

    return { success: true };
  },
});

// Submit a question/comment without accepting or rejecting
export const submitQuestion = mutation({
  args: {
    token: v.string(),
    comment: v.string(),
  },
  handler: async (ctx, args) => {
    const offerte = await ctx.db
      .query("offertes")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.token))
      .unique();

    if (!offerte) {
      throw new Error("Offerte not found");
    }

    const now = Date.now();

    // Update with question but keep status as "bekeken"
    await ctx.db.patch(offerte._id, {
      customerResponse: {
        status: "bekeken",
        comment: args.comment,
        viewedAt: offerte.customerResponse?.viewedAt ?? now,
        respondedAt: now,
      },
      updatedAt: now,
    });

    return { success: true };
  },
});
