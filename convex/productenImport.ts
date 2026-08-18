/**
 * Productbestand-import via kolommapping (PRD §2.5c)
 *
 * Import van leverancierslijsten (CSV/Excel; parsing gebeurt client-side,
 * hier komen gemapte rijen binnen) met ontdubbeling en validatie — de
 * HERO-lessen uit bijlage B:
 * - near-duplicate-waarschuwing tegen bestaande producten én binnen het
 *   bestand zelf ("Voorrijkosten" vs "Voorrrijkosten": kleine spelafstand);
 * - €0/lege inkoopprijs → automatisch `prijsOpRegel`-vlag, zodat er nooit
 *   een marge op €0 wordt doorgerekend ("Infinity%");
 * - idempotent: her-import van hetzelfde bestand maakt geen duplicaten
 *   (match op genormaliseerde naam + leverancier → bijwerken i.p.v. invoegen).
 *
 * Kantoor-only (requireKantoor): artikelbeheer is belegd bij een klein
 * aantal mensen (PRD §2.5c).
 */

import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireKantoor } from "./roles";
import { requireOrg, requireOrgId } from "./auth";
import {
  normaliseerProductnaam,
  bepaalPrijsOpRegel,
  GELDIGE_BTW_CODES,
} from "./producten";

// ─── Pure ontdubbelingslogica ────────────────────────────────────────────────

/**
 * Begrensde Levenshtein-afstand (spelafstand) tussen twee strings.
 * Stopt zodra de afstand `max` overschrijdt en geeft dan max + 1 terug —
 * genoeg om te weten dat het géén near-duplicate is, zonder O(n·m) op
 * lange, duidelijk verschillende namen volledig uit te rekenen.
 */
export function spelafstand(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let vorige = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const huidige = [i];
    let rijMinimum = i;
    for (let j = 1; j <= b.length; j++) {
      const kosten = a[i - 1] === b[j - 1] ? 0 : 1;
      huidige[j] = Math.min(
        huidige[j - 1] + 1,
        vorige[j] + 1,
        vorige[j - 1] + kosten
      );
      rijMinimum = Math.min(rijMinimum, huidige[j]);
    }
    if (rijMinimum > max) return max + 1;
    vorige = huidige;
  }
  return vorige[b.length];
}

/**
 * Maximale spelafstand waarbij twee genormaliseerde namen nog als
 * near-duplicate gelden: korte namen mogen nauwelijks verschillen,
 * langere namen krijgen iets meer speling.
 */
export function maxSpelafstandVoor(naamLengte: number): number {
  if (naamLengte < 5) return 0;
  if (naamLengte < 10) return 1;
  return 2;
}

export type DuplicaatSoort = "exact" | "near";

/**
 * Vergelijk twee (rauwe) productnamen na normalisatie.
 * - identiek na normalisatie → "exact"
 * - kleine spelafstand ("Voorrijkosten" vs "Voorrrijkosten") → "near"
 * - anders → null
 */
export function vergelijkNamen(a: string, b: string): DuplicaatSoort | null {
  const na = normaliseerProductnaam(a);
  const nb = normaliseerProductnaam(b);
  if (na.length === 0 || nb.length === 0) return null;
  if (na === nb) return "exact";
  const max = maxSpelafstandVoor(Math.min(na.length, nb.length));
  if (max === 0) return null;
  return spelafstand(na, nb, max) <= max ? "near" : null;
}

// ─── Validatie-preview (stap 2 van de import-wizard) ─────────────────────────

export interface ImportRij {
  naam: string;
  inkoopprijs?: number;
  eenheid?: string;
  btwCode?: number;
  omschrijving?: string;
  categorie?: string;
}

export interface DuplicaatMelding {
  soort: DuplicaatSoort;
  naam: string;
}

export interface ImportRijValidatie {
  index: number;
  naam: string;
  naamGenormaliseerd: string;
  /** Lege naam → rij kan niet geïmporteerd worden */
  geldig: boolean;
  /** €0/lege inkoopprijs → wordt met prijs-op-regel-vlag geïmporteerd */
  prijsOpRegel: boolean;
  /** Match met een bestaand product (exact = wordt bijgewerkt, near = waarschuwing) */
  bestaand?: DuplicaatMelding;
  /** Match met een eerdere rij in hetzelfde bestand (index van die rij) */
  inBestand?: DuplicaatMelding & { index: number };
  waarschuwingen: string[];
}

/** Standaard-categorie voor geïmporteerde rijen zonder categorie-kolom. */
export const IMPORT_STANDAARD_CATEGORIE = "Overig";

/**
 * Valideer gemapte import-rijen tegen bestaande productnamen én tegen
 * elkaar. Puur en synchron — de UI toont dit als preview (stap 2), de
 * gebruiker vinkt rijen aan/uit en bevestigt daarna pas de import.
 */
export function valideerImportRijen(
  rijen: ImportRij[],
  bestaandeNamen: string[]
): ImportRijValidatie[] {
  const bestaandGenormaliseerd = bestaandeNamen.map((naam) => ({
    naam,
    genormaliseerd: normaliseerProductnaam(naam),
  }));

  const resultaten: ImportRijValidatie[] = [];

  for (let i = 0; i < rijen.length; i++) {
    const rij = rijen[i];
    const genormaliseerd = normaliseerProductnaam(rij.naam ?? "");
    const waarschuwingen: string[] = [];
    const geldig = genormaliseerd.length > 0;
    if (!geldig) {
      waarschuwingen.push("Naam ontbreekt — rij kan niet geïmporteerd worden");
    }

    const prijsOpRegel = bepaalPrijsOpRegel(rij.inkoopprijs);
    if (geldig && prijsOpRegel) {
      waarschuwingen.push(
        "Geen (of €0) inkoopprijs — artikel krijgt de vlag 'prijs op regel'; er wordt geen marge op doorgerekend"
      );
    }

    if (
      rij.btwCode !== undefined &&
      !(GELDIGE_BTW_CODES as readonly number[]).includes(rij.btwCode)
    ) {
      waarschuwingen.push(
        `Ongeldige btw-code "${rij.btwCode}" — wordt genegeerd (toegestaan: 9 of 21)`
      );
    }

    // Tegen bestaande producten: exact (idempotente update) of near (waarschuwing)
    let bestaand: DuplicaatMelding | undefined;
    if (geldig) {
      for (const b of bestaandGenormaliseerd) {
        const soort = b.genormaliseerd === genormaliseerd
          ? "exact"
          : vergelijkNamen(rij.naam, b.naam) === "near"
            ? "near"
            : null;
        if (soort === "exact") {
          bestaand = { soort, naam: b.naam };
          break; // exacte match wint van eventuele near-matches
        }
        if (soort === "near" && !bestaand) {
          bestaand = { soort, naam: b.naam };
        }
      }
      if (bestaand?.soort === "exact") {
        waarschuwingen.push(
          `Bestaat al als "${bestaand.naam}" — wordt bijgewerkt, niet gedupliceerd`
        );
      } else if (bestaand?.soort === "near") {
        waarschuwingen.push(
          `Lijkt sterk op bestaand product "${bestaand.naam}" — mogelijk duplicaat`
        );
      }
    }

    // Binnen het bestand: vergelijk met eerdere rijen
    let inBestand: (DuplicaatMelding & { index: number }) | undefined;
    if (geldig) {
      for (let j = 0; j < i; j++) {
        const eerdere = resultaten[j];
        if (!eerdere.geldig) continue;
        const soort =
          eerdere.naamGenormaliseerd === genormaliseerd
            ? "exact"
            : vergelijkNamen(rij.naam, rijen[j].naam) === "near"
              ? "near"
              : null;
        if (soort === "exact") {
          inBestand = { soort, naam: rijen[j].naam, index: j };
          break;
        }
        if (soort === "near" && !inBestand) {
          inBestand = { soort, naam: rijen[j].naam, index: j };
        }
      }
      if (inBestand?.soort === "exact") {
        waarschuwingen.push(
          `Dubbel in dit bestand (rij ${inBestand.index + 1}: "${inBestand.naam}") — wordt overgeslagen`
        );
      } else if (inBestand?.soort === "near") {
        waarschuwingen.push(
          `Lijkt sterk op rij ${inBestand.index + 1} in dit bestand ("${inBestand.naam}") — mogelijk duplicaat`
        );
      }
    }

    resultaten.push({
      index: i,
      naam: rij.naam ?? "",
      naamGenormaliseerd: genormaliseerd,
      geldig,
      prijsOpRegel,
      bestaand,
      inBestand,
      waarschuwingen,
    });
  }

  return resultaten;
}

// ─── Import-plan (idempotentie) ──────────────────────────────────────────────

export interface BestaandProduct {
  _id: Id<"producten">;
  naamGenormaliseerd?: string;
  productnaam: string;
  leverancierId?: Id<"leveranciers">;
}

export type ImportActie =
  | { actie: "aanmaken"; rij: ImportRij }
  | { actie: "bijwerken"; rij: ImportRij; bestaandId: Id<"producten"> }
  | { actie: "overslaan"; rij: ImportRij; reden: string };

/**
 * Bepaal per rij wat de import doet. Idempotentie-regel: een rij met
 * dezelfde genormaliseerde naam + dezelfde leverancier als een bestaand
 * product wordt BIJGEWERKT, niet opnieuw ingevoegd. Exacte duplicaten
 * binnen het bestand worden na de eerste rij overgeslagen.
 */
export function bepaalImportActies(
  rijen: ImportRij[],
  bestaande: BestaandProduct[],
  leverancierId: Id<"leveranciers"> | undefined
): ImportActie[] {
  const acties: ImportActie[] = [];
  const gezienInBestand = new Set<string>();

  for (const rij of rijen) {
    const genormaliseerd = normaliseerProductnaam(rij.naam ?? "");
    if (genormaliseerd.length === 0) {
      acties.push({ actie: "overslaan", rij, reden: "naam ontbreekt" });
      continue;
    }
    if (gezienInBestand.has(genormaliseerd)) {
      acties.push({
        actie: "overslaan",
        rij,
        reden: "dubbel in bestand",
      });
      continue;
    }
    gezienInBestand.add(genormaliseerd);

    const bestaand = bestaande.find(
      (p) =>
        (p.naamGenormaliseerd ?? normaliseerProductnaam(p.productnaam)) ===
          genormaliseerd && p.leverancierId === leverancierId
    );
    if (bestaand) {
      acties.push({ actie: "bijwerken", rij, bestaandId: bestaand._id });
    } else {
      acties.push({ actie: "aanmaken", rij });
    }
  }

  return acties;
}

// ─── Convex-functies (kantoor-only) ──────────────────────────────────────────

const importRijValidator = v.object({
  naam: v.string(),
  inkoopprijs: v.optional(v.number()),
  eenheid: v.optional(v.string()),
  btwCode: v.optional(v.number()),
  omschrijving: v.optional(v.string()),
  categorie: v.optional(v.string()),
});

/**
 * Stap 2 van de import-wizard: validatie-preview. Vergelijkt de gemapte
 * rijen met de bestaande producten van de gebruiker en met elkaar.
 */
export const previewImport = query({
  args: {
    rijen: v.array(importRijValidator),
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);

    const bestaande = await ctx.db
      .query("producten")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    return valideerImportRijen(
      args.rijen,
      bestaande.map((p) => p.productnaam)
    );
  },
});

/**
 * Stap 3: voer de import uit (alleen de door de gebruiker aangevinkte
 * rijen worden meegestuurd). Idempotent: her-import van hetzelfde bestand
 * werkt bestaande producten bij in plaats van duplicaten aan te maken.
 */
export const importeer = mutation({
  args: {
    rijen: v.array(importRijValidator),
    leverancierId: v.optional(v.id("leveranciers")),
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const org = await requireOrg(ctx);

    if (args.rijen.length === 0) {
      throw new ConvexError("Geen rijen om te importeren");
    }

    if (args.leverancierId) {
      const leverancier = await ctx.db.get(args.leverancierId);
      if (!leverancier || leverancier.orgId?.toString() !== org._id.toString()) {
        throw new ConvexError("Leverancier niet gevonden");
      }
    }

    const bestaande = await ctx.db
      .query("producten")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .collect();

    const acties = bepaalImportActies(args.rijen, bestaande, args.leverancierId);

    const nu = Date.now();
    let aangemaakt = 0;
    let bijgewerkt = 0;
    let overgeslagen = 0;

    for (const item of acties) {
      const { rij } = item;
      const btwCode =
        rij.btwCode !== undefined &&
        (GELDIGE_BTW_CODES as readonly number[]).includes(rij.btwCode)
          ? rij.btwCode
          : undefined;
      const inkoopprijs = rij.inkoopprijs ?? 0;
      const prijsOpRegel = bepaalPrijsOpRegel(rij.inkoopprijs);

      if (item.actie === "overslaan") {
        overgeslagen++;
        continue;
      }

      if (item.actie === "bijwerken") {
        await ctx.db.patch(item.bestaandId, {
          inkoopprijs,
          prijsOpRegel,
          ...(rij.eenheid !== undefined ? { eenheid: rij.eenheid } : {}),
          ...(btwCode !== undefined ? { btwCode } : {}),
          ...(rij.omschrijving !== undefined
            ? { omschrijving: rij.omschrijving }
            : {}),
          ...(args.leverancierId !== undefined
            ? { leverancierId: args.leverancierId }
            : {}),
          naamGenormaliseerd: normaliseerProductnaam(rij.naam),
          updatedAt: nu,
        });
        bijgewerkt++;
        continue;
      }

      await ctx.db.insert("producten", {
        orgId: org._id,
        productnaam: rij.naam.trim(),
        categorie: rij.categorie?.trim() || IMPORT_STANDAARD_CATEGORIE,
        inkoopprijs,
        // Verkoopprijs wordt niet geïmporteerd: zonder marge-afspraak is
        // inkoop = verkoop de veilige start; kantoor stelt marges later in.
        // Op prijs-op-regel-artikelen blijft dit 0 (prijs komt op de regel).
        verkoopprijs: inkoopprijs,
        eenheid: rij.eenheid?.trim() || "stuk",
        verliespercentage: 0,
        leverancierId: args.leverancierId,
        btwCode,
        omschrijving: rij.omschrijving,
        prijsOpRegel,
        naamGenormaliseerd: normaliseerProductnaam(rij.naam),
        gebruiksteller: 0,
        isActief: true,
        createdAt: nu,
        updatedAt: nu,
      });
      aangemaakt++;
    }

    return {
      totaal: args.rijen.length,
      aangemaakt,
      bijgewerkt,
      overgeslagen,
    };
  },
});
