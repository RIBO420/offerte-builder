import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { generateSecureToken, getOwnedOfferte, isShareTokenValid } from "./auth";
import { internal } from "./_generated/api";
import { checkPublicOfferteRateLimit, validateSignature } from "./security";

// Create or refresh share link for an offerte (with ownership verification)
export const createShareLink = mutation({
  args: {
    offerteId: v.id("offertes"),
    expiresInDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify ownership
    await getOwnedOfferte(ctx, args.offerteId);

    // Generate cryptographically secure token (32 chars)
    const token = generateSecureToken(32);
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

// Revoke share link (with ownership verification)
export const revokeShareLink = mutation({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
    // Verify ownership
    await getOwnedOfferte(ctx, args.offerteId);

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
    // Rate limiting: max 30 requests per minute to prevent brute-force token guessing
    const rateLimitResult = checkPublicOfferteRateLimit(args.token);
    if (!rateLimitResult.allowed) {
      throw new Error(rateLimitResult.message || "Te veel verzoeken. Probeer het later opnieuw.");
    }

    const offerte = await ctx.db
      .query("offertes")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.token))
      .unique();

    if (!offerte) {
      return null;
    }

    // Validate token and check expiry using consistent helper
    if (!isShareTokenValid(offerte, args.token)) {
      return { expired: true };
    }

    // Get business info
    const instellingen = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", offerte.userId))
      .unique();

    // Get voorcalculatie if available
    const voorcalculatie = await ctx.db
      .query("voorcalculaties")
      .withIndex("by_offerte", (q) => q.eq("offerteId", offerte._id))
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
      // Include voorcalculatie data for planning info (customer-friendly)
      voorcalculatie: voorcalculatie
        ? {
            geschatteDagen: voorcalculatie.geschatteDagen,
            normUrenTotaal: voorcalculatie.normUrenTotaal,
            normUrenPerScope: voorcalculatie.normUrenPerScope,
            teamGrootte: voorcalculatie.teamGrootte,
          }
        : undefined,
    };
  },
});

// Record that customer viewed the offerte
export const markAsViewed = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    // Rate limiting: prevent abuse
    const rateLimitResult = checkPublicOfferteRateLimit(args.token);
    if (!rateLimitResult.allowed) {
      throw new Error(rateLimitResult.message || "Te veel verzoeken. Probeer het later opnieuw.");
    }

    const offerte = await ctx.db
      .query("offertes")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.token))
      .unique();

    // Validate token and check expiry
    if (!isShareTokenValid(offerte, args.token)) {
      throw new Error("Ongeldige of verlopen link");
    }

    // Only update and notify if first view (not already viewed or responded)
    const isFirstView = !offerte!.customerResponse?.viewedAt;

    if (!offerte!.customerResponse?.status || offerte!.customerResponse.status === "bekeken") {
      await ctx.db.patch(offerte!._id, {
        customerResponse: {
          status: "bekeken",
          viewedAt: offerte!.customerResponse?.viewedAt ?? Date.now(),
          respondedAt: Date.now(),
        },
        updatedAt: Date.now(),
      });

      // Notify admin that offerte was viewed (only on first view)
      if (isFirstView) {
        await ctx.scheduler.runAfter(0, internal.notifications.notifyOfferteViewed, {
          offerteId: offerte!._id,
        });
      }
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
    // Rate limiting: prevent brute-force attempts
    const rateLimitResult = checkPublicOfferteRateLimit(args.token);
    if (!rateLimitResult.allowed) {
      throw new Error(rateLimitResult.message || "Te veel verzoeken. Probeer het later opnieuw.");
    }

    const offerte = await ctx.db
      .query("offertes")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.token))
      .unique();

    // Validate token and check expiry
    if (!isShareTokenValid(offerte, args.token)) {
      throw new Error("Ongeldige of verlopen link");
    }

    // Check if already responded with accept/reject
    if (
      offerte!.customerResponse?.status === "geaccepteerd" ||
      offerte!.customerResponse?.status === "afgewezen"
    ) {
      throw new Error("Offerte is al beantwoord");
    }

    // Require signature for acceptance
    if (args.status === "geaccepteerd" && !args.signature) {
      throw new Error("Handtekening is verplicht bij accepteren");
    }

    // Validate signature if provided
    if (args.signature) {
      const signatureValidation = validateSignature(args.signature);
      if (!signatureValidation.valid) {
        throw new Error(signatureValidation.error || "Ongeldige handtekening");
      }
    }

    const now = Date.now();

    // Update customer response
    await ctx.db.patch(offerte!._id, {
      customerResponse: {
        status: args.status,
        comment: args.comment,
        viewedAt: offerte!.customerResponse?.viewedAt ?? now,
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
      .withIndex("by_offerte", (q) => q.eq("offerteId", offerte!._id))
      .order("desc")
      .take(1);

    const versieNummer = (versions[0]?.versieNummer ?? 0) + 1;

    await ctx.db.insert("offerte_versions", {
      offerteId: offerte!._id,
      userId: offerte!.userId,
      versieNummer,
      snapshot: {
        status: args.status,
        klant: offerte!.klant,
        algemeenParams: {
          bereikbaarheid: offerte!.algemeenParams.bereikbaarheid,
          achterstalligheid: offerte!.algemeenParams.achterstalligheid,
        },
        scopes: offerte!.scopes,
        scopeData: offerte!.scopeData,
        totalen: offerte!.totalen,
        regels: offerte!.regels.map((r) => ({
          id: r.id,
          scope: r.scope,
          omschrijving: r.omschrijving,
          eenheid: r.eenheid,
          hoeveelheid: r.hoeveelheid,
          prijsPerEenheid: r.prijsPerEenheid,
          totaal: r.totaal,
          type: r.type,
        })),
        notities: offerte!.notities,
      },
      actie: "status_gewijzigd",
      omschrijving: `Klant heeft offerte ${args.status === "geaccepteerd" ? "geaccepteerd" : "afgewezen"}${args.comment ? ` - "${args.comment}"` : ""}`,
      createdAt: now,
    });

    // Notify admin about the customer's response
    await ctx.scheduler.runAfter(0, internal.notifications.notifyOfferteStatusChange, {
      offerteId: offerte!._id,
      newStatus: args.status,
      triggeredBy: "klant",
      comment: args.comment,
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
    // Rate limiting: prevent abuse
    const rateLimitResult = checkPublicOfferteRateLimit(args.token);
    if (!rateLimitResult.allowed) {
      throw new Error(rateLimitResult.message || "Te veel verzoeken. Probeer het later opnieuw.");
    }

    const offerte = await ctx.db
      .query("offertes")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.token))
      .unique();

    // Validate token and check expiry
    if (!isShareTokenValid(offerte, args.token)) {
      throw new Error("Ongeldige of verlopen link");
    }

    const now = Date.now();

    // Update with question but keep status as "bekeken"
    await ctx.db.patch(offerte!._id, {
      customerResponse: {
        status: "bekeken",
        comment: args.comment,
        viewedAt: offerte!.customerResponse?.viewedAt ?? now,
        respondedAt: now,
      },
      updatedAt: now,
    });

    return { success: true };
  },
});
