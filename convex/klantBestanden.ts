/**
 * Bestanden bij een klant: foto's (voor / tijdens / na / schets) en documenten.
 *
 * Twee bronnen komen hier samen:
 *  - handmatig geüpload vanuit het dossier (op mobiel opent dat de camera);
 *  - AUTOMATISCH: elke verzonden offerte en factuur schrijft hier een rij
 *    (zie `convex/lib/klantBestandenArchief.ts`). Zo is het dossier compleet
 *    zonder dat iemand er iets voor hoeft te doen — dat was de klacht: "de
 *    offerte die we vorig jaar stuurden, waar staat die?".
 *
 * Intern dossier: klantaccounts hebben hier geen enkele functie op, en alles
 * is expliciet op orgId gescoped.
 */

import { v, ConvexError } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { AuthError, requireAuth, requireOrgId } from "./auth";
import { normalizeRole } from "./roles";
import { laadDocsMap } from "./lib/batchLoad";

const MAX_TITEL = 200;

const soortValidator = v.union(v.literal("foto"), v.literal("document"));
const labelValidator = v.union(
  v.literal("voor"),
  v.literal("tijdens"),
  v.literal("na"),
  v.literal("schets")
);

export interface VerrijktBestand {
  _id: Id<"klantBestanden">;
  soort: "foto" | "document";
  label?: "voor" | "tijdens" | "na" | "schets";
  titel: string;
  bron: "upload" | "offerte" | "factuur" | "klant";
  nummer?: string;
  timestamp: number;
  url: string | null;
  geuploadDoorNaam: string | null;
  offerteId?: Id<"offertes">;
  factuurId?: Id<"facturen">;
}

async function requireInterneRol(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  if (normalizeRole(user.role) === "klant") {
    throw new AuthError(
      "Klantbestanden zijn een intern dossier en niet beschikbaar voor klantaccounts"
    );
  }
  return user;
}

async function getKlantBinnenBedrijf(
  ctx: QueryCtx | MutationCtx,
  klantId: Id<"klanten">
): Promise<Id<"organisaties">> {
  const orgId = await requireOrgId(ctx);
  const klant = await ctx.db.get(klantId);
  if (!klant || klant.orgId?.toString() !== orgId.toString()) {
    throw new ConvexError("Klant niet gevonden");
  }
  return orgId;
}

/**
 * Foto's en documenten van één klant, nieuwste eerst, met download-URL.
 * Rijen zonder `storageId` zijn verwijzingen naar een offerte/factuur; die
 * hebben geen URL en linken in de UI door naar het document zelf.
 */
export const list = query({
  args: { klantId: v.id("klanten") },
  handler: async (
    ctx,
    args
  ): Promise<{ fotos: VerrijktBestand[]; documenten: VerrijktBestand[] }> => {
    await requireInterneRol(ctx);
    const orgId = await getKlantBinnenBedrijf(ctx, args.klantId);

    const bestanden = await ctx.db
      .query("klantBestanden")
      .withIndex("by_klant", (q) =>
        q.eq("orgId", orgId).eq("klantId", args.klantId)
      )
      .collect();

    const uploaders = await laadDocsMap(
      ctx,
      bestanden.map((b) => b.geuploadDoorId)
    );

    const verrijkt: VerrijktBestand[] = await Promise.all(
      bestanden
        .sort((a, b) => b.timestamp - a.timestamp)
        .map(async (bestand) => ({
          _id: bestand._id,
          soort: bestand.soort,
          label: bestand.label,
          titel: bestand.titel,
          bron: bestand.bron,
          nummer: bestand.nummer,
          timestamp: bestand.timestamp,
          url: bestand.storageId
            ? await ctx.storage.getUrl(bestand.storageId)
            : null,
          geuploadDoorNaam: bestand.geuploadDoorId
            ? (uploaders.get(bestand.geuploadDoorId.toString())?.name ?? null)
            : null,
          offerteId: bestand.offerteId,
          factuurId: bestand.factuurId,
        }))
    );

    return {
      fotos: verrijkt.filter((b) => b.soort === "foto"),
      documenten: verrijkt.filter((b) => b.soort === "document"),
    };
  },
});

export const genereerUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    await requireInterneRol(ctx);
    // Zonder org-check zou elk ingelogd account een upload-URL kunnen trekken;
    // de registratie hieronder controleert de klant nog een keer.
    await requireOrgId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Een geüpload bestand aan het dossier hangen.
 *
 * RESTRISICO, bewust geaccepteerd: de `storageId` komt van de client en is
 * niet te verifiëren. Convex geeft geen eigenaar-metadata op een storage-object
 * — er is geen manier om te vragen "wie heeft dit geüpload, en voor welke
 * organisatie?". Een intern account kan dus in theorie een storageId van een
 * andere tenant registreren en zo een vreemd bestand in zijn eigen dossier
 * zichtbaar maken. Wat er wél staat: de aanroeper moet een interne rol hebben,
 * de klant moet van zijn eigen organisatie zijn, en een storageId is een
 * ondoorzichtige, niet-radende sleutel.
 *
 * Follow-up als dit echt dicht moet: een uploadregister — `genereerUploadUrl`
 * legt vast welke storageId voor welke organisatie is uitgegeven, en deze
 * mutation controleert die rij.
 */
export const registreer = mutation({
  args: {
    klantId: v.id("klanten"),
    soort: soortValidator,
    label: v.optional(labelValidator),
    titel: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args): Promise<Id<"klantBestanden">> => {
    const user = await requireInterneRol(ctx);
    const orgId = await getKlantBinnenBedrijf(ctx, args.klantId);

    const titel = args.titel.trim();
    if (!titel) throw new ConvexError("Geef het bestand een titel");
    if (titel.length > MAX_TITEL) {
      throw new ConvexError(`Titel mag maximaal ${MAX_TITEL} tekens zijn`);
    }

    return await ctx.db.insert("klantBestanden", {
      orgId,
      klantId: args.klantId,
      soort: args.soort,
      // Een label hoort bij een foto; op een document zegt "Voor" niets.
      label: args.soort === "foto" ? args.label : undefined,
      titel,
      storageId: args.storageId,
      bron: "upload",
      geuploadDoorId: user._id,
      timestamp: Date.now(),
    });
  },
});

export const verwijder = mutation({
  args: { bestandId: v.id("klantBestanden") },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    await requireInterneRol(ctx);
    const orgId = await requireOrgId(ctx);

    const bestand = await ctx.db.get(args.bestandId);
    if (!bestand || bestand.orgId?.toString() !== orgId.toString()) {
      throw new ConvexError("Bestand niet gevonden");
    }

    // ALLEEN een eigen upload heeft een eigen storage-object. Een rij met bron
    // `offerte`/`factuur` is een VERWIJZING naar een document dat elders leeft;
    // `storage.delete` daarop sloopte de PDF onder de offerte vandaan, terwijl
    // de gebruiker alleen een regel uit zijn dossier haalde (review v13,
    // bevinding 7). Zo'n rij verdwijnt hieronder gewoon, zonder storage.
    const eigenUpload = bestand.bron === "upload" || bestand.bron === "klant";
    if (eigenUpload && bestand.storageId) {
      // Een storage-object dat al weg is mag het verwijderen niet laten klappen.
      try {
        await ctx.storage.delete(bestand.storageId);
      } catch (fout) {
        console.warn("klantBestanden.verwijder: storage opruimen mislukt", fout);
      }
    }

    await ctx.db.delete(args.bestandId);
    return { success: true };
  },
});
