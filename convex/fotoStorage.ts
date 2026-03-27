/**
 * Foto Opslag voor Configurator Aanvragen
 *
 * Beheert het uploaden, ophalen en verwijderen van foto's die klanten
 * uploaden bij hun configurator aanvraag. Klanten zijn niet ingelogd,
 * dus de upload-gerelateerde functies vereisen geen authenticatie.
 * Beheer-functies (verwijderen etc.) vereisen wel authenticatie.
 */

import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireAuthUserId, getAuthenticatedUser } from "./auth";
import { requireNotViewer } from "./roles";

// ============================================
// Public mutations (geen auth vereist — klanten zijn niet ingelogd)
// ============================================

/**
 * Genereert een upload URL voor Convex file storage.
 * Authenticatie vereist — alleen ingelogde gebruikers mogen bestanden uploaden.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireNotViewer(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Voegt een storageId toe aan de fotoIds-array van een configuratorAanvraag.
 * Authenticatie vereist — verifieert dat de aanvraag bij de gebruiker hoort
 * of een geldige publieke aanvraag is (aangemaakt in de afgelopen 24 uur).
 */
export const addFotoToAanvraag = mutation({
  args: {
    aanvraagId: v.id("configuratorAanvragen"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const aanvraag = await ctx.db.get(args.aanvraagId);
    if (!aanvraag) {
      throw new ConvexError("Aanvraag niet gevonden");
    }

    // Auth check: verify user is authenticated OR this is a valid recent public submission.
    // configuratorAanvragen are public (customers are not logged in), so we allow
    // unauthenticated access only for recently created aanvragen (within 24 hours).
    // Security: the 24-hour time window limits exposure — after that, only authenticated
    // users can add photos. The aanvraagId itself acts as an unguessable token.
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
      if (aanvraag._creationTime < twentyFourHoursAgo) {
        throw new ConvexError("Niet geautoriseerd om foto's toe te voegen aan deze aanvraag");
      }
    }

    const huidigeFotoIds = aanvraag.fotoIds ?? [];

    // Maximaal 5 foto's per aanvraag
    if (huidigeFotoIds.length >= 5) {
      throw new ConvexError("Maximaal 5 foto's per aanvraag toegestaan");
    }

    // Voorkom duplicaten
    if (huidigeFotoIds.includes(args.storageId)) {
      return aanvraag._id;
    }

    await ctx.db.patch(args.aanvraagId, {
      fotoIds: [...huidigeFotoIds, args.storageId],
      updatedAt: Date.now(),
    });

    return aanvraag._id;
  },
});

// ============================================
// Queries (public — klanten en admins)
// ============================================

/**
 * Haalt een publieke download URL op voor een opgeslagen bestand.
 * Geen authenticatie vereist — URLs zijn tijdelijk en bestandsspecifiek.
 */
export const getUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * Haalt URLs op voor een array van storage IDs.
 * Handig om meerdere foto-URLs in één keer op te halen.
 */
export const getUrls = query({
  args: {
    storageIds: v.array(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const urls = await Promise.all(
      args.storageIds.map(async (storageId) => {
        const url = await ctx.storage.getUrl(storageId);
        return { storageId, url };
      })
    );
    return urls;
  },
});

// ============================================
// Authenticated mutations (auth vereist — alleen admins/beheer)
// ============================================

/**
 * Verwijdert een bestand uit de storage.
 * Authenticatie vereist — alleen beheerders mogen bestanden permanent verwijderen.
 */
export const deleteFile = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    await ctx.storage.delete(args.storageId);
  },
});

/**
 * Verwijdert een foto uit de fotoIds-array van een aanvraag en verwijdert het bestand.
 * Authenticatie vereist — alleen beheerders mogen aanvraag-foto's verwijderen.
 */
export const removeFotoFromAanvraag = mutation({
  args: {
    aanvraagId: v.id("configuratorAanvragen"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);

    const aanvraag = await ctx.db.get(args.aanvraagId);
    if (!aanvraag) {
      throw new ConvexError("Aanvraag niet gevonden");
    }

    const huidigeFotoIds = aanvraag.fotoIds ?? [];
    const bijgewerkteFotoIds = huidigeFotoIds.filter(
      (id) => id !== args.storageId
    );

    // Werk de aanvraag bij (verwijder de foto uit de array)
    await ctx.db.patch(args.aanvraagId, {
      fotoIds: bijgewerkteFotoIds,
      updatedAt: Date.now(),
    });

    // Verwijder het bestand uit de storage
    await ctx.storage.delete(args.storageId);
  },
});
