import type { KlantGegevens, PrijsBerekening, VerticuterenSpecs } from "./types";
import {
  BASISPRIJS_PER_M2,
  MACHINE_HUUR,
  VOORRIJKOSTEN,
  BIJZAAIEN_TARIEF,
  TOPDRESSING_TARIEF,
  BEMESTING_TARIEF,
  CONDITIE_CONFIG,
} from "./constants";

export function formatEuro(bedrag: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(bedrag);
}

export function berekenMinDatum(): Date {
  const datum = new Date();
  datum.setHours(0, 0, 0, 0);
  let werkdagen = 0;
  while (werkdagen < 5) {
    datum.setDate(datum.getDate() + 1);
    const dag = datum.getDay();
    if (dag !== 0 && dag !== 6) werkdagen++;
  }
  return datum;
}

export function berekenPrijs(
  specs: VerticuterenSpecs,
  poortbreedte: string
): PrijsBerekening | null {
  if (!specs.conditie || !specs.oppervlakte) return null;
  const m2 = parseFloat(specs.oppervlakte);
  if (isNaN(m2) || m2 < 20) return null;

  const basisprijs = m2 * BASISPRIJS_PER_M2;
  const conditieConfig = CONDITIE_CONFIG[specs.conditie];
  const conditioneelToeslagPercent = conditieConfig.toeslagPercent;
  const conditioneelToeslag =
    Math.round(basisprijs * (conditioneelToeslagPercent / 100) * 100) / 100;

  const poort = parseFloat(poortbreedte);
  const handmatigToeslag = !isNaN(poort) && poort < 80;
  const basePlusConditie = basisprijs + conditioneelToeslag;
  const handmatigToeslagBedrag = handmatigToeslag
    ? Math.round(basePlusConditie * 0.25 * 100) / 100
    : 0;

  const bijzaaienRegel = specs.bijzaaien
    ? Math.round(m2 * BIJZAAIEN_TARIEF * 100) / 100
    : null;
  const topdressingRegel = specs.topdressing
    ? Math.round(m2 * TOPDRESSING_TARIEF * 100) / 100
    : null;
  const bemestingRegel = specs.bemesting
    ? Math.round(m2 * BEMESTING_TARIEF * 100) / 100
    : null;

  const subtotaal =
    basePlusConditie +
    handmatigToeslagBedrag +
    (bijzaaienRegel ?? 0) +
    (topdressingRegel ?? 0) +
    (bemestingRegel ?? 0) +
    MACHINE_HUUR +
    VOORRIJKOSTEN;

  const btw = Math.round(subtotaal * 0.21 * 100) / 100;
  const totaal = Math.round((subtotaal + btw) * 100) / 100;

  return {
    basisprijs,
    conditioneelToeslag,
    conditioneelToeslagPercent,
    handmatigToeslag,
    handmatigToeslagBedrag,
    bijzaaienRegel,
    topdressingRegel,
    bemestingRegel,
    machineHuur: MACHINE_HUUR,
    voorrijkosten: VOORRIJKOSTEN,
    subtotaal,
    btw,
    totaal,
  };
}

export function validateStap1(klant: KlantGegevens): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!klant.naam.trim()) errors.naam = "Naam is verplicht";
  if (!klant.email.trim()) {
    errors.email = "E-mailadres is verplicht";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(klant.email)) {
    errors.email = "Voer een geldig e-mailadres in";
  }
  if (!klant.telefoon.trim()) errors.telefoon = "Telefoonnummer is verplicht";
  if (!klant.adres.trim()) errors.adres = "Adres is verplicht";
  if (!klant.postcode.trim()) errors.postcode = "Postcode is verplicht";
  if (!klant.plaats.trim()) errors.plaats = "Plaats is verplicht";
  if (!klant.poortbreedte.trim()) {
    errors.poortbreedte = "Poortbreedte is verplicht";
  } else {
    const breedte = parseFloat(klant.poortbreedte);
    if (isNaN(breedte) || breedte <= 0) {
      errors.poortbreedte = "Voer een geldige breedte in";
    }
  }
  return errors;
}

export function validateStap2(specs: VerticuterenSpecs): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!specs.oppervlakte.trim()) {
    errors.oppervlakte = "Oppervlakte is verplicht";
  } else {
    const opp = parseFloat(specs.oppervlakte);
    if (isNaN(opp) || opp < 20) {
      errors.oppervlakte = "Minimaal 20 m\u00B2";
    }
  }
  if (!specs.conditie) errors.conditie = "Selecteer de huidige conditie";
  return errors;
}

export function validateStap3(gewensteDatum: Date | undefined): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!gewensteDatum) errors.gewensteDatum = "Selecteer een gewenste datum";
  return errors;
}
