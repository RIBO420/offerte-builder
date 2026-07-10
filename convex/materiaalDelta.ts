/**
 * Materiaaldelta-checklist + route-knop — veld-rol (PRD §2.6/§8.5, stap 9a).
 *
 * Vóór vertrek naar een klus toont de route-knop eerst de delta-checklist:
 * (materiaal/machines uit de bouwsteen-koppelingen van de geplande taken —
 * dezelfde receptuurdata als de offerte) MINUS (standaardinventaris van de
 * bus, voertuigUitrusting). §8.5: standaardbus heeft alles behalve grasmaaier
 * → checklist toont alleen "grasmaaier". Afvinken wordt gelogd (wie/wanneer)
 * in materiaalChecks; daarna pas door naar Maps (gewone URL, geen API).
 */

import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireAuth } from "./auth";
import {
  CANONIEKE_ROL_MAPPING,
  getCompanyUserId,
  normalizeRole,
} from "./roles";
import {
  berekenMateriaalDelta,
  magUrenLoggen,
  normaliseerItemNaam,
  type DeltaItem,
} from "./veldLogica";

const DATUM_PATROON = /^\d{4}-\d{2}-\d{2}$/;

async function veldToegang(ctx: Parameters<typeof requireAuth>[0]) {
  const user = await requireAuth(ctx);
  const rol = CANONIEKE_ROL_MAPPING[normalizeRole(user.role)];
  if (!magUrenLoggen(rol)) {
    throw new ConvexError("Deze functie is niet beschikbaar voor deze rol");
  }
  const companyUserId = await getCompanyUserId(ctx);
  return { user, companyUserId };
}

/**
 * Delta-checklist voor één werkitem + bus. Zonder expliciete voertuigId wordt
 * het eerst toegewezen voertuig van het werkitem gebruikt; zonder bus is er
 * geen inventaris en is de delta = alle benodigdheden (fail-closed: liever
 * te veel op de checklist dan te weinig in de bus).
 */
export const getDeltaChecklist = query({
  args: {
    werkitemId: v.id("projecten"),
    datum: v.string(), // YYYY-MM-DD (voor de afvink-log van die dag)
    voertuigId: v.optional(v.id("voertuigen")),
  },
  handler: async (ctx, args) => {
    if (!DATUM_PATROON.test(args.datum)) {
      throw new ConvexError("Ongeldige datum (verwacht YYYY-MM-DD)");
    }
    const { companyUserId } = await veldToegang(ctx);

    const werkitem = await ctx.db.get(args.werkitemId);
    if (
      !werkitem ||
      werkitem.deletedAt ||
      werkitem.userId.toString() !== companyUserId.toString()
    ) {
      throw new ConvexError("Werkitem niet gevonden");
    }

    // Benodigd: producten + machines uit de bouwsteen-koppelingen van de taken
    let regels = werkitem.bouwsteenRegels ?? [];
    if (regels.length === 0 && werkitem.contractWerkzaamheidId) {
      const werkzaamheid = await ctx.db.get(werkitem.contractWerkzaamheidId);
      if (werkzaamheid) {
        regels = [
          {
            bouwsteenId: werkzaamheid.bouwsteenId,
            omschrijving: werkzaamheid.omschrijving,
          },
        ];
      }
    }
    const benodigd: DeltaItem[] = [];
    const bouwsteenCache = new Map<string, Doc<"bouwstenen"> | null>();
    for (const regel of regels) {
      if (!regel.bouwsteenId) continue;
      if (!bouwsteenCache.has(regel.bouwsteenId)) {
        bouwsteenCache.set(regel.bouwsteenId, await ctx.db.get(regel.bouwsteenId));
      }
      const bouwsteen = bouwsteenCache.get(regel.bouwsteenId) ?? null;
      if (!bouwsteen) continue;
      for (const machineId of bouwsteen.machineIds ?? []) {
        const machine = await ctx.db.get(machineId);
        if (machine) benodigd.push({ naam: machine.naam, soort: "machine" });
      }
      for (const productId of bouwsteen.productIds ?? []) {
        const product = await ctx.db.get(productId);
        if (product)
          benodigd.push({ naam: product.productnaam, soort: "materiaal" });
      }
    }

    // Standaardinventaris van de bus (voertuigUitrusting, status "aanwezig")
    const voertuigId =
      args.voertuigId ?? werkitem.toegewezenVoertuigen?.[0] ?? null;
    let voertuig: Doc<"voertuigen"> | null = null;
    let inventarisNamen: string[] = [];
    if (voertuigId) {
      voertuig = await ctx.db.get(voertuigId);
      if (
        !voertuig ||
        voertuig.userId.toString() !== companyUserId.toString()
      ) {
        throw new ConvexError("Voertuig niet gevonden");
      }
      const uitrusting = await ctx.db
        .query("voertuigUitrusting")
        .withIndex("by_voertuig", (q) =>
          q.eq("voertuigId", voertuigId as Id<"voertuigen">)
        )
        .collect();
      inventarisNamen = uitrusting
        .filter((u) => u.status === "aanwezig")
        .map((u) => u.naam);
    }

    const delta = berekenMateriaalDelta(benodigd, inventarisNamen);

    // Afvink-status van vandaag (wie/wanneer, §8.5)
    const checks = await ctx.db
      .query("materiaalChecks")
      .withIndex("by_werkitem_datum", (q) =>
        q.eq("werkitemId", args.werkitemId).eq("datum", args.datum)
      )
      .collect();
    const checksPerItem = new Map(
      checks
        .filter((c) => c.userId.toString() === companyUserId.toString())
        .map((c) => [c.item, c])
    );

    // Maps-URL (gewone URL, geen API): adres van het werkitem of de klant
    let adres = werkitem.adres ?? null;
    if (!adres && werkitem.klantId) {
      const klant = await ctx.db.get(werkitem.klantId);
      if (klant) adres = `${klant.adres}, ${klant.plaats}`;
    }
    const mapsUrl = adres
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adres)}`
      : null;

    const deltaMetStatus = delta.map((item) => {
      const check = checksPerItem.get(normaliseerItemNaam(item.naam)) ?? null;
      return {
        ...item,
        afgevinkt: check !== null,
        afgevinktDoor: check?.doorNaam ?? null,
        afgevinktOp: check?.createdAt ?? null,
      };
    });

    return {
      werkitemId: werkitem._id,
      voertuig: voertuig
        ? { _id: voertuig._id, kenteken: voertuig.kenteken, merk: voertuig.merk }
        : null,
      benodigd,
      delta: deltaMetStatus,
      allesAfgevinkt: deltaMetStatus.every((d) => d.afgevinkt),
      adres,
      mapsUrl,
    };
  },
});

/**
 * Delta-item afvinken (of het vinkje weghalen). Afvinken wordt gelogd met
 * wie/wanneer (§8.5) — idempotent per werkitem+datum+item.
 */
export const vinkAf = mutation({
  args: {
    werkitemId: v.id("projecten"),
    datum: v.string(), // YYYY-MM-DD
    item: v.string(),
    ongedaan: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!DATUM_PATROON.test(args.datum)) {
      throw new ConvexError("Ongeldige datum (verwacht YYYY-MM-DD)");
    }
    const { user, companyUserId } = await veldToegang(ctx);

    const werkitem = await ctx.db.get(args.werkitemId);
    if (
      !werkitem ||
      werkitem.deletedAt ||
      werkitem.userId.toString() !== companyUserId.toString()
    ) {
      throw new ConvexError("Werkitem niet gevonden");
    }
    const item = normaliseerItemNaam(args.item);
    if (!item) {
      throw new ConvexError("Ongeldig checklist-item");
    }

    const bestaande = await ctx.db
      .query("materiaalChecks")
      .withIndex("by_werkitem_datum", (q) =>
        q.eq("werkitemId", args.werkitemId).eq("datum", args.datum)
      )
      .collect();
    const bestaand = bestaande.find(
      (c) =>
        c.item === item && c.userId.toString() === companyUserId.toString()
    );

    if (args.ongedaan) {
      if (bestaand) await ctx.db.delete(bestaand._id);
      return null;
    }
    if (bestaand) return bestaand._id; // idempotent

    return await ctx.db.insert("materiaalChecks", {
      userId: companyUserId,
      werkitemId: args.werkitemId,
      datum: args.datum,
      item,
      door: user._id,
      doorNaam: user.name,
      createdAt: Date.now(),
    });
  },
});
