/**
 * HERO-artikelexport → prijsboek (fase 5, docs/hero-nabouw/BESLUITEN.md).
 *
 * Puur en zonder Convex-context, zodat de regels in Vitest vastliggen.
 * De import neemt álle HERO-artikelen over, allemaal actief (besluit
 * Ricardo 22-10-2026), ingedeeld in categorieën uit naam en beschrijving.
 */
import { normaliseerProductnaam } from "../producten";
import { categorieUitHero, schoonHeroTekst, type HeroCategorie } from "./heroCategorie";

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
  /** Beschrijving zonder HTML-entiteiten; leeg = geen */
  omschrijving?: string;
  categorie: HeroCategorie;
  naamGenormaliseerd: string;
  eenheid: string;
  btwCode: 9 | 21 | undefined;
  inkoopprijs: number;
  verkoopprijs: number;
  prijsOpRegel: boolean;
  isActief: boolean;
  /** Dubbele naam: niet het meest gebruikte artikel met deze naam */
  dubbeleNaam: boolean;
}

/**
 * Categorie van de eerste import (22-10-2026). Wordt bij een volgende import
 * vervangen door de afgeleide categorie; een door kantoor gekozen categorie
 * blijft staan.
 */
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
 * Plan per rij: naam, categorie, prijzen, eenheid en btw. Alles wordt actief.
 * Bij dubbele namen is het meest gebruikte artikel de hoofdversie (bij gelijk
 * gebruik het hoogste artikelnummer, dus het nieuwste); de andere krijgen
 * `dubbeleNaam` zodat de telling laat zien hoeveel dubbelen er zijn.
 */
export function planHeroArtikelen(rijen: HeroArtikelRij[]): HeroArtikelPlan[] {
  const hoofdPerNaam = new Map<string, HeroArtikelRij>();
  for (const rij of rijen) {
    const sleutel = normaliseerProductnaam(schoonHeroTekst(rij.naam));
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
    .filter((rij) => normaliseerProductnaam(schoonHeroTekst(rij.naam)).length > 0)
    .map((rij) => {
      const productnaam = schoonHeroTekst(rij.naam);
      const omschrijving = rij.beschrijving ? schoonHeroTekst(rij.beschrijving) : "";
      const naamGenormaliseerd = normaliseerProductnaam(productnaam);
      const isHoofd = hoofdPerNaam.get(naamGenormaliseerd) === rij;
      const inkoopprijs = afgerond(Math.max(rij.inkoopprijs, 0));
      const verkoopprijs = verkoopprijsUitHero(rij);
      return {
        rij,
        productnaam,
        ...(omschrijving ? { omschrijving } : {}),
        categorie: categorieUitHero(productnaam, omschrijving || undefined),
        naamGenormaliseerd,
        eenheid: eenheidUitHero(rij.eenheid),
        btwCode: btwUitHero(rij.btw),
        inkoopprijs,
        verkoopprijs,
        // Geen inkoop én geen vaste prijs → prijs komt op de offerteregel
        prijsOpRegel: inkoopprijs <= 0 && verkoopprijs <= 0,
        isActief: true,
        dubbeleNaam: !isHoofd,
      };
    });
}
