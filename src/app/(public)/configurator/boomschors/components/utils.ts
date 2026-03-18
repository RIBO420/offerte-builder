import { addDays, isWeekend } from "date-fns";

import { PRIJZEN, DIKTE_FACTOR } from "./constants";
import type {
  LaagDikte,
  BoomschorsSpecificaties,
  BezorgInfo,
  PrijsBerekening,
  KlantGegevens,
  Samenvatting,
  FormErrors,
} from "./types";

// ---------------------------------------------------------------------------
// Calculation helpers
// ---------------------------------------------------------------------------

/** Round up to nearest 0.5 m³ */
export function roundUpHalf(value: number): number {
  return Math.ceil(value * 2) / 2;
}

export function berekenM3(oppervlakte: number, dikte: LaagDikte): number {
  if (oppervlakte <= 0) return 0;
  const raw = oppervlakte * DIKTE_FACTOR[dikte];
  return roundUpHalf(raw);
}

export function formatEuro(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Get +N werkdagen (skip weekends) from a given date */
export function addWerkdagen(startDate: Date, days: number): Date {
  let date = new Date(startDate);
  let added = 0;
  while (added < days) {
    date = addDays(date, 1);
    if (!isWeekend(date)) {
      added++;
    }
  }
  return date;
}

export const MIN_LEVERDATUM = addWerkdagen(new Date(), 3);

// ---------------------------------------------------------------------------
// Bezorgkosten
// ---------------------------------------------------------------------------

export function getBezorgInfo(postcode: string): BezorgInfo | null {
  const cleaned = postcode.replace(/\s/g, "").toUpperCase();
  if (cleaned.length < 4) return null;

  const numericPart = parseInt(cleaned.slice(0, 4), 10);
  if (isNaN(numericPart)) return null;

  const diff = Math.abs(numericPart - 2000);

  if (diff < 300) {
    return { type: "prijs", prijs: 45, label: "< 15 km" };
  } else if (diff < 800) {
    return { type: "prijs", prijs: 75, label: "15-30 km" };
  } else if (diff < 1500) {
    return { type: "prijs", prijs: 125, label: "30-50 km" };
  } else {
    return { type: "contact", label: "> 50 km" };
  }
}

// ---------------------------------------------------------------------------
// Price calculation
// ---------------------------------------------------------------------------

export function berekenPrijs(
  specificaties: BoomschorsSpecificaties
): PrijsBerekening {
  const oppervlakte = parseFloat(specificaties.oppervlakte) || 0;
  const m3Nodig = berekenM3(oppervlakte, specificaties.laagDikte);
  const prijs_per_m3 = PRIJZEN[specificaties.soort];
  const schors_totaal = m3Nodig * prijs_per_m3;

  let bezorgkosten = 0;
  let bezorgLabel = "Ophalen (gratis)";
  let heeftBezorgMaatwerk = false;

  if (specificaties.bezorging === "bezorgen") {
    const info = getBezorgInfo(specificaties.bezorgPostcode);
    if (info) {
      if (info.type === "prijs") {
        bezorgkosten = info.prijs;
        bezorgLabel = `Bezorging (${info.label})`;
      } else {
        bezorgLabel = `Bezorging (${info.label}) — maatwerk`;
        heeftBezorgMaatwerk = true;
      }
    } else {
      bezorgLabel = "Bezorging — postcode invullen";
    }
  }

  const subtotaal = schors_totaal + bezorgkosten;
  const btw = subtotaal * 0.21;
  const totaal = subtotaal + btw;

  return {
    soort: specificaties.soort,
    laagDikte: specificaties.laagDikte,
    oppervlakte,
    m3Nodig,
    prijs_per_m3,
    schors_totaal,
    bezorgkosten,
    subtotaal,
    btw,
    totaal,
    bezorgLabel,
    heeftBezorgMaatwerk,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateStap1(gegevens: KlantGegevens): FormErrors {
  const errors: FormErrors = {};
  if (!gegevens.naam.trim()) errors.naam = "Naam is verplicht.";
  if (!gegevens.email.trim()) {
    errors.email = "E-mailadres is verplicht.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gegevens.email)) {
    errors.email = "Voer een geldig e-mailadres in.";
  }
  if (!gegevens.telefoon.trim())
    errors.telefoon = "Telefoonnummer is verplicht.";
  if (!gegevens.adres.trim())
    errors.adres = "Straat en huisnummer zijn verplicht.";
  if (!gegevens.postcode.trim()) errors.postcode = "Postcode is verplicht.";
  if (!gegevens.plaats.trim()) errors.plaats = "Plaats is verplicht.";
  return errors;
}

export function validateStap2(
  specificaties: BoomschorsSpecificaties
): FormErrors {
  const errors: FormErrors = {};
  const oppervlakte = parseFloat(specificaties.oppervlakte);
  if (!specificaties.oppervlakte || isNaN(oppervlakte) || oppervlakte <= 0) {
    errors.oppervlakte = "Voer een geldige oppervlakte in.";
  } else {
    const m3 = berekenM3(oppervlakte, specificaties.laagDikte);
    if (m3 < 1) {
      errors.oppervlakte = `De minimale bestelling is 1 m³. Verhoog de oppervlakte of kies een dikkere laag.`;
    }
  }
  if (
    specificaties.bezorging === "bezorgen" &&
    !specificaties.bezorgPostcode.trim()
  ) {
    errors.bezorgPostcode = "Vul een postcode in voor bezorging.";
  }
  return errors;
}

export function validateStap3(samenvatting: Samenvatting): FormErrors {
  const errors: FormErrors = {};
  if (!samenvatting.leveringsDatum) {
    errors.leveringsDatum = "Selecteer een gewenste leveringsdatum.";
  }
  if (!samenvatting.akkoordVoorwaarden) {
    errors.akkoordVoorwaarden =
      "U dient akkoord te gaan met de algemene voorwaarden om verder te gaan.";
  }
  return errors;
}
