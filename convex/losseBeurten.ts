/**
 * Losse beurten (PRD §2.1B) — onderhoudsbeurten ZONDER contract.
 *
 * Een losse beurt is een werkitem type "onderhoudsbeurt" direct onder de
 * klant, met eigen bouwstenen en prijs, en optioneel een RITME (n× per jaar
 * of "elke n weken", met seizoensvenster). Het is géén contract en mag er
 * ook nooit één worden.
 *
 * Ritme-semantiek: het systeem berekent de volgende voorziene datum
 * (volgendeVoorzieneDatum) maar plant NIETS automatisch in en genereert
 * GEEN toekomstige beurten vooruit. De attendering (taak voor kantoor op
 * het §2.4-bord, acceptatietest §8.12) is een LATERE stap; dit bestand legt
 * het fundament: de ritme-velden + de query `vensterOpentBinnen`.
 */

import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./auth";
import { requireKantoor } from "./roles";
import {
  spreidDatumsInVenster,
  vensterVoorJaar,
  vandaagIso,
} from "./beurtgenerator";

// ─── Types & validators ──────────────────────────────────────────────────────

export interface Ritme {
  frequentiePerJaar?: number;
  intervalWeken?: number;
  vensterVanMaand?: number;
  vensterTotMaand?: number;
}

const ritmeValidator = v.object({
  frequentiePerJaar: v.optional(v.number()),
  intervalWeken: v.optional(v.number()),
  vensterVanMaand: v.optional(v.number()),
  vensterTotMaand: v.optional(v.number()),
});

const bouwsteenRegelsValidator = v.array(
  v.object({
    bouwsteenId: v.optional(v.id("bouwstenen")),
    omschrijving: v.string(),
    prijsPerBeurt: v.optional(v.number()),
  })
);

/** Default attendering: 14 dagen vooraf (PRD §2.1: "venster opent over 14 dagen"). */
export const DEFAULT_ATTENDERING_DAGEN = 14;

// ─── Pure helpers (unit-testbaar zonder ctx) ─────────────────────────────────

/**
 * Valideer een ritme: precies één van frequentiePerJaar/intervalWeken,
 * geldige waarden, venster-maanden 1-12. Gooit ConvexError.
 */
export function valideerRitme(ritme: Ritme): void {
  const heeftFreq = ritme.frequentiePerJaar !== undefined;
  const heeftInterval = ritme.intervalWeken !== undefined;
  if (heeftFreq === heeftInterval) {
    throw new ConvexError(
      "Ritme: kies óf een aantal keer per jaar, óf een interval in weken"
    );
  }
  if (
    heeftFreq &&
    (!Number.isFinite(ritme.frequentiePerJaar!) ||
      ritme.frequentiePerJaar! < 1 ||
      ritme.frequentiePerJaar! > 366)
  ) {
    throw new ConvexError("Ritme: frequentie per jaar moet tussen 1 en 366 zijn");
  }
  if (
    heeftInterval &&
    (!Number.isFinite(ritme.intervalWeken!) ||
      ritme.intervalWeken! < 1 ||
      ritme.intervalWeken! > 52)
  ) {
    throw new ConvexError("Ritme: interval moet tussen 1 en 52 weken zijn");
  }
  for (const maand of [ritme.vensterVanMaand, ritme.vensterTotMaand]) {
    if (maand !== undefined && (maand < 1 || maand > 12 || !Number.isInteger(maand))) {
      throw new ConvexError("Ritme: venstermaanden moeten 1 t/m 12 zijn");
    }
  }
  if (
    (ritme.vensterVanMaand === undefined) !==
    (ritme.vensterTotMaand === undefined)
  ) {
    throw new ConvexError(
      "Ritme: geef het seizoensvenster met een van- én een tot-maand op"
    );
  }
}

/** Valt een ISO-datum binnen het (eventueel jaargrens-overschrijdende) venster? */
function inVenster(datum: string, van?: number, tot?: number): boolean {
  if (van === undefined || tot === undefined) return true;
  const maand = Number(datum.slice(5, 7));
  return tot < van ? maand >= van || maand <= tot : maand >= van && maand <= tot;
}

/**
 * Volgende voorziene datum volgens een ritme, strikt ná `vanaf`.
 *
 * - frequentiePerJaar: dezelfde midpoint-spreiding als de contractgenerator;
 *   de eerstvolgende spreidingspositie na `vanaf` (dit of volgend seizoensjaar).
 * - intervalWeken: `vanaf` + n weken; valt dat buiten het venster, dan de
 *   eerste dag van het eerstvolgende venster.
 */
export function berekenVolgendeVoorzieneDatum(
  ritme: Ritme,
  vanaf: string
): string {
  const jaar = Number(vanaf.slice(0, 4));

  if (ritme.intervalWeken !== undefined) {
    const d = new Date(`${vanaf}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + ritme.intervalWeken * 7);
    const kandidaat = d.toISOString().slice(0, 10);
    if (inVenster(kandidaat, ritme.vensterVanMaand, ritme.vensterTotMaand)) {
      return kandidaat;
    }
    // Buiten het venster → eerste dag van het eerstvolgende venster
    for (const j of [jaar, jaar + 1, jaar + 2]) {
      const venster = vensterVoorJaar(
        j,
        ritme.vensterVanMaand,
        ritme.vensterTotMaand
      );
      if (venster.start > kandidaat) return venster.start;
    }
    return kandidaat; // onbereikbaar bij geldige invoer
  }

  const aantal = Math.floor(ritme.frequentiePerJaar ?? 1);
  // Venster kan over de jaargrens wrappen: kijk ook naar het vorige seizoensjaar
  for (const j of [jaar - 1, jaar, jaar + 1]) {
    const venster = vensterVoorJaar(
      j,
      ritme.vensterVanMaand,
      ritme.vensterTotMaand
    );
    for (const datum of spreidDatumsInVenster(
      aantal,
      venster.start,
      venster.eind
    )) {
      if (datum > vanaf) return datum;
    }
  }
  throw new ConvexError("Kon geen volgende voorziene datum bepalen");
}

/**
 * Openingsdatum van het venster waarin een voorziene datum valt (voor de
 * attendering "venster opent over 14 dagen"). Zonder venster: de voorziene
 * datum zelf.
 */
export function vensterOpeningVoorDatum(
  ritme: Pick<Ritme, "vensterVanMaand" | "vensterTotMaand">,
  voorzieneDatum: string
): string {
  if (ritme.vensterVanMaand === undefined) return voorzieneDatum;
  const jaar = Number(voorzieneDatum.slice(0, 4));
  for (const j of [jaar - 1, jaar]) {
    const venster = vensterVoorJaar(
      j,
      ritme.vensterVanMaand,
      ritme.vensterTotMaand
    );
    if (voorzieneDatum >= venster.start && voorzieneDatum <= venster.eind) {
      return venster.start;
    }
  }
  return voorzieneDatum;
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/**
 * Losse beurt aanmaken (kantoor-only). Ongepland: landt in de wachtrij.
 * Met ritme wordt de volgende voorziene datum berekend — er wordt niets
 * automatisch ingepland en er worden geen toekomstige beurten gegenereerd.
 */
export const createLosseBeurt = mutation({
  args: {
    klantId: v.id("klanten"),
    naam: v.string(),
    bouwsteenRegels: bouwsteenRegelsValidator,
    geschatteUren: v.optional(v.number()),
    adres: v.optional(v.string()),
    ritme: v.optional(ritmeValidator),
    attenderingDagenVooraf: v.optional(v.number()),
    attenderingNodig: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireKantoor(ctx);

    const klant = await ctx.db.get(args.klantId);
    if (!klant || klant.userId.toString() !== user._id.toString()) {
      throw new ConvexError("Klant niet gevonden");
    }
    if (!args.naam.trim()) {
      throw new ConvexError("Geef de beurt een naam");
    }
    if (args.bouwsteenRegels.length === 0) {
      throw new ConvexError("Kies ten minste één bouwsteen of werkzaamheid");
    }
    for (const regel of args.bouwsteenRegels) {
      if (regel.bouwsteenId) {
        const bouwsteen = await ctx.db.get(regel.bouwsteenId);
        if (!bouwsteen) throw new ConvexError("Bouwsteen niet gevonden");
      }
      if (
        regel.prijsPerBeurt !== undefined &&
        (regel.prijsPerBeurt < 0 || !Number.isFinite(regel.prijsPerBeurt))
      ) {
        throw new ConvexError("Prijs per beurt kan niet negatief zijn");
      }
    }
    if (args.ritme) valideerRitme(args.ritme);
    if (
      args.attenderingDagenVooraf !== undefined &&
      (args.attenderingDagenVooraf < 0 ||
        !Number.isInteger(args.attenderingDagenVooraf))
    ) {
      throw new ConvexError("Attendering: dagen vooraf moet 0 of hoger zijn");
    }

    const volgendeVoorzieneDatum = args.ritme
      ? berekenVolgendeVoorzieneDatum(args.ritme, vandaagIso())
      : undefined;

    const now = Date.now();
    return await ctx.db.insert("projecten", {
      userId: user._id,
      type: "onderhoudsbeurt",
      klantId: args.klantId,
      naam: args.naam.trim(),
      status: "gepland",
      // Bewust GEEN contractId: dit is en blijft een losse beurt
      bouwsteenRegels: args.bouwsteenRegels,
      geschatteUren: args.geschatteUren,
      adres: args.adres,
      ritme: args.ritme,
      volgendeVoorzieneDatum,
      voorzieneDatum: volgendeVoorzieneDatum,
      attenderingDagenVooraf: args.ritme
        ? (args.attenderingDagenVooraf ?? DEFAULT_ATTENDERING_DAGEN)
        : args.attenderingDagenVooraf,
      attenderingNodig: args.attenderingNodig,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Losse beurten van een klant (voor de klantkaart: contracten en losse
 * beurten staan als APARTE regels naast elkaar — nooit samengevoegd).
 */
export const listByKlant = query({
  args: { klantId: v.id("klanten") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const items = await ctx.db
      .query("projecten")
      .withIndex("by_klant", (q) => q.eq("klantId", args.klantId))
      .collect();
    return items
      .filter(
        (item) =>
          item.userId.toString() === userId.toString() &&
          item.type === "onderhoudsbeurt" &&
          item.contractId === undefined &&
          !item.deletedAt
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Fundament voor de attendering (§2.4-taak, LATERE stap): losse beurten met
 * ritme waarvan het seizoensvenster (of, zonder venster, de voorziene datum)
 * binnen `dagen` dagen opent — inclusief al geopende vensters met een nog
 * niet verstreken voorziene datum.
 */
export const vensterOpentBinnen = query({
  args: { dagen: v.number() },
  handler: async (ctx, args) => {
    const user = await requireKantoor(ctx);
    const vandaag = vandaagIso();
    const bovengrensMs =
      Date.parse(`${vandaag}T00:00:00Z`) + args.dagen * 24 * 60 * 60 * 1000;
    const bovengrens = new Date(bovengrensMs).toISOString().slice(0, 10);

    // Alle beurten met een volgendeVoorzieneDatum vanaf vandaag (index),
    // daarna venster-opening in geheugen bepalen.
    const kandidaten = await ctx.db
      .query("projecten")
      .withIndex("by_user_volgendeVoorzieneDatum", (q) =>
        q.eq("userId", user._id).gte("volgendeVoorzieneDatum", vandaag)
      )
      .collect();

    const resultaten = [];
    for (const beurt of kandidaten) {
      if (beurt.deletedAt || beurt.type !== "onderhoudsbeurt") continue;
      if (!beurt.ritme || !beurt.volgendeVoorzieneDatum) continue;
      if (beurt.attenderingNodig === false) continue;
      const opening = vensterOpeningVoorDatum(
        beurt.ritme,
        beurt.volgendeVoorzieneDatum
      );
      if (opening > bovengrens) continue;
      const klant = beurt.klantId ? await ctx.db.get(beurt.klantId) : null;
      resultaten.push({
        _id: beurt._id,
        naam: beurt.naam,
        klantId: beurt.klantId,
        klantNaam: klant?.naam ?? "Onbekende klant",
        volgendeVoorzieneDatum: beurt.volgendeVoorzieneDatum,
        vensterOpening: opening,
        attenderingDagenVooraf:
          beurt.attenderingDagenVooraf ?? DEFAULT_ATTENDERING_DAGEN,
      });
    }
    return resultaten.sort((a, b) =>
      a.vensterOpening.localeCompare(b.vensterOpening)
    );
  },
});
