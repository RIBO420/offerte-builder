/**
 * HERO-artikelexport → prijsboek (fase 5, docs/hero-nabouw/BESLUITEN.md).
 *
 * Puur en zonder Convex-context, zodat de regels in Vitest vastliggen.
 * De import neemt álle HERO-artikelen over; alleen de herbruikbare staan
 * actief, de rest staat uit en kan kantoor later per artikel aanzetten.
 */
import { normaliseerProductnaam } from "../producten";

/** Eén rij uit de HERO-artikelexport (Excel, alle kolommen aan). */
export interface HeroArtikelRij {
  artikelnummer: string;
  naam: string;
  beschrijving?: string;
  /** HERO-eenheid: st, m², m³, ton, uur, km, wk */
  eenheid?: string;
  /** "21%" of "9%" */
  btw?: string;
  /** IP: inkoopprijs */
  inkoopprijs: number;
  /** CP Standaardmarge: inkoopprijs × 1,40 */
  standaardmarge: number;
  /** CP VK1: vaste verkoopprijs, bij de meeste artikelen gelijk aan IP */
  vk1: number;
  /** "Gebruikt": in hoeveel HERO-documenten het artikel voorkomt */
  gebruikt: number;
}

export interface HeroArtikelPlan {
  rij: HeroArtikelRij;
  productnaam: string;
  naamGenormaliseerd: string;
  eenheid: string;
  btwCode: 9 | 21 | undefined;
  inkoopprijs: number;
  verkoopprijs: number;
  prijsOpRegel: boolean;
  isActief: boolean;
  /** Waarom het artikel uit staat; leeg bij actief */
  redenUit?: "weinig_gebruikt" | "dubbele_naam";
}

/** Minimaal aantal keer gebruikt in HERO om actief binnen te komen. */
export const HERO_ACTIEF_VANAF_GEBRUIKT = 2;

/** Categorie in het prijsboek: HERO kent geen categorieën. */
export const HERO_CATEGORIE = "HERO";

const EENHEDEN: Record<string, string> = {
  st: "stuk",
  stk: "stuk",
  stuk: "stuk",
  wk: "week",
};

export function eenheidUitHero(eenheid: string | undefined): string {
  const schoon = (eenheid ?? "").trim();
  if (!schoon) return "stuk";
  return EENHEDEN[schoon.toLowerCase()] ?? schoon;
}

export function btwUitHero(btw: string | undefined): 9 | 21 | undefined {
  const getal = Number.parseFloat((btw ?? "").replace("%", "").replace(",", "."));
  if (getal === 9) return 9;
  if (getal === 21) return 21;
  return undefined;
}

function afgerond(bedrag: number): number {
  return Math.round(bedrag * 100) / 100;
}

/**
 * Verkoopprijs volgens de prijslijst "Standaardmarge" (besluit Ricardo,
 * 22-10-2026). Zonder inkoopprijs is VK1 de vaste prijs (bv. een uurtarief).
 */
export function verkoopprijsUitHero(rij: HeroArtikelRij): number {
  if (rij.inkoopprijs > 0) {
    const lijst = rij.standaardmarge > 0 ? rij.standaardmarge : rij.inkoopprijs;
    return afgerond(lijst);
  }
  return afgerond(Math.max(rij.vk1, 0));
}

/**
 * Plan per rij: prijzen, eenheid, btw en of het artikel actief wordt.
 * Bij dubbele namen is het meest gebruikte artikel de hoofdversie (bij
 * gelijk gebruik het hoogste artikelnummer, dus het nieuwste); de andere
 * komen binnen maar staan uit.
 */
export function planHeroArtikelen(rijen: HeroArtikelRij[]): HeroArtikelPlan[] {
  const hoofdPerNaam = new Map<string, HeroArtikelRij>();
  for (const rij of rijen) {
    const sleutel = normaliseerProductnaam(rij.naam);
    if (!sleutel) continue;
    const huidig = hoofdPerNaam.get(sleutel);
    if (
      !huidig ||
      rij.gebruikt > huidig.gebruikt ||
      (rij.gebruikt === huidig.gebruikt &&
        Number(rij.artikelnummer) > Number(huidig.artikelnummer))
    ) {
      hoofdPerNaam.set(sleutel, rij);
    }
  }

  return rijen
    .filter((rij) => normaliseerProductnaam(rij.naam).length > 0)
    .map((rij) => {
      const naamGenormaliseerd = normaliseerProductnaam(rij.naam);
      const isHoofd = hoofdPerNaam.get(naamGenormaliseerd) === rij;
      const genoegGebruikt = rij.gebruikt >= HERO_ACTIEF_VANAF_GEBRUIKT;
      const inkoopprijs = afgerond(Math.max(rij.inkoopprijs, 0));
      const verkoopprijs = verkoopprijsUitHero(rij);
      return {
        rij,
        productnaam: rij.naam.trim(),
        naamGenormaliseerd,
        eenheid: eenheidUitHero(rij.eenheid),
        btwCode: btwUitHero(rij.btw),
        inkoopprijs,
        verkoopprijs,
        // Geen inkoop én geen vaste prijs → prijs komt op de offerteregel
        prijsOpRegel: inkoopprijs <= 0 && verkoopprijs <= 0,
        isActief: isHoofd && genoegGebruikt,
        redenUit: !isHoofd
          ? "dubbele_naam"
          : !genoegGebruikt
            ? "weinig_gebruikt"
            : undefined,
      };
    });
}
