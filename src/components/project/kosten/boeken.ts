/**
 * Van formulier naar `projectKosten.create`. Pure functies, zodat de regels
 * (wat mag, wat wordt het bedrag) testbaar zijn zonder het formulier.
 *
 * Wat elke soort in de backend doet:
 * - materiaal → een verbruiksmutatie op de voorraad (`productId` × hoeveelheid).
 *   De kosten rekent de backend uit met de INKOOPPRIJS van het product; een
 *   eigen prijs bestaat hier dus niet. Een artikel zonder vaste inkoopprijs
 *   (€ 0) zou als € 0 tellen en wordt geweigerd.
 * - machine → machinegebruik met kosten = aantal × tarief (tarief voorgevuld
 *   uit de machine, aanpasbaar, bv. bij huur met een afwijkende prijs).
 * - arbeid → loopt via "Uren registreren" bij Uitvoering, niet via dit formulier.
 * - overig → heeft geen opslag in de backend en wordt niet aangeboden.
 *
 * Een werkgebied (scope) bewaart de backend alleen bij uren; materiaal en
 * machine-inzet tellen altijd onder "materialen" / "machines". Daarom vraagt
 * dit formulier er niet naar.
 *
 * Een eigen omschrijving bewaart de backend bij materiaal en machine nergens;
 * `create` eist er wel een, dus die staat vast op de product- of machinenaam.
 * Notities bewaart de backend alleen bij materiaal (op de voorraadmutatie).
 */

import type { Id } from "../../../../convex/_generated/dataModel";

export type BoekSoort = "materiaal" | "machine";

export interface BoekProduct {
  _id: Id<"producten">;
  productnaam: string;
  inkoopprijs: number;
  eenheid: string;
}

export interface BoekMachine {
  _id: Id<"machines">;
  naam: string;
  tarief: number;
  tariefType: "uur" | "dag";
}

interface Gemeenschappelijk {
  datum: string; // YYYY-MM-DD
  hoeveelheid: number;
}

export type BoekInvoer =
  | (Gemeenschappelijk & { soort: "materiaal"; product: BoekProduct | null; notities?: string })
  | (Gemeenschappelijk & { soort: "machine"; machine: BoekMachine | null; tarief: number });

export interface CreateArgs {
  projectId: Id<"projecten">;
  type: BoekSoort;
  datum: string;
  omschrijving: string;
  hoeveelheid: number;
  prijsPerEenheid: number;
  productId?: Id<"producten">;
  machineId?: Id<"machines">;
  notities?: string;
}

export type BoekResultaat = { ok: true; args: CreateArgs; totaal: number } | { ok: false; fout: string };

function schoon(tekst?: string): string | undefined {
  const t = tekst?.trim();
  return t ? t : undefined;
}

/** Bedrag dat deze boeking oplevert, of null als de invoer nog niet compleet is. */
export function boekBedrag(invoer: BoekInvoer): number | null {
  if (!(invoer.hoeveelheid > 0)) return null;
  if (invoer.soort === "materiaal") {
    return invoer.product && invoer.product.inkoopprijs > 0
      ? invoer.hoeveelheid * invoer.product.inkoopprijs
      : null;
  }
  return invoer.machine && invoer.tarief > 0 ? invoer.hoeveelheid * invoer.tarief : null;
}

export function naarCreateArgs(projectId: Id<"projecten">, invoer: BoekInvoer): BoekResultaat {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(invoer.datum)) {
    return { ok: false, fout: "Kies een datum." };
  }
  if (!(invoer.hoeveelheid > 0)) {
    return { ok: false, fout: "Vul een aantal groter dan 0 in." };
  }
  const gedeeld = {
    projectId,
    datum: invoer.datum,
    hoeveelheid: invoer.hoeveelheid,
  };

  if (invoer.soort === "materiaal") {
    const product = invoer.product;
    if (!product) return { ok: false, fout: "Kies een artikel uit de productenlijst." };
    if (!(product.inkoopprijs > 0)) {
      return {
        ok: false,
        fout: `${product.productnaam} heeft geen vaste inkoopprijs en zou als € 0 tellen. Vul eerst de inkoopprijs in bij de producten.`,
      };
    }
    return {
      ok: true,
      totaal: invoer.hoeveelheid * product.inkoopprijs,
      args: {
        ...gedeeld,
        type: "materiaal",
        omschrijving: product.productnaam,
        prijsPerEenheid: product.inkoopprijs,
        productId: product._id,
        notities: schoon(invoer.notities),
      },
    };
  }

  const machine = invoer.machine;
  if (!machine) return { ok: false, fout: "Kies een machine." };
  if (!(invoer.tarief > 0)) return { ok: false, fout: "Vul een tarief groter dan 0 in." };
  return {
    ok: true,
    totaal: invoer.hoeveelheid * invoer.tarief,
    args: {
      ...gedeeld,
      type: "machine",
      omschrijving: machine.naam,
      prijsPerEenheid: invoer.tarief,
      machineId: machine._id,
    },
  };
}
