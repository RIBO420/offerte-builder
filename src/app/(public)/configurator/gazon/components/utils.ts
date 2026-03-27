import type {
  FormData,
  PrijsBerekening,
  KlantGegevens,
  GazonSpecs,
  TypeGras,
  Ondergrond,
} from "./types";
import { TYPE_GRAS_CONFIG, ONDERGROND_CONFIG } from "./types";

// ---------------------------------------------------------------------------
// Formatting Helpers
// ---------------------------------------------------------------------------

export function formatEuro(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function formatDatumVolledig(datum: Date): string {
  return datum.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Price Calculation
// ---------------------------------------------------------------------------

export function berekenPrijs(data: FormData): PrijsBerekening | null {
  const m2 = parseFloat(data.specs.oppervlakte);
  if (!data.specs.typeGras || !data.specs.ondergrond || isNaN(m2) || m2 < 10) {
    return null;
  }

  const gazonTarief = TYPE_GRAS_CONFIG[data.specs.typeGras as TypeGras].tarief;
  const ondergrondTarief = ONDERGROND_CONFIG[data.specs.ondergrond as Ondergrond].tarief;
  const gazonLabel = TYPE_GRAS_CONFIG[data.specs.typeGras as TypeGras].label;
  const ondergrondLabel = ONDERGROND_CONFIG[data.specs.ondergrond as Ondergrond].label;

  const gazonRegel = {
    label: `Gazon (${gazonLabel.toLowerCase()})`,
    m2,
    tarief: gazonTarief,
    totaal: m2 * gazonTarief,
  };

  const ondergrondRegel =
    ondergrondTarief > 0
      ? {
          label: `Ondergrond (${ondergrondLabel.toLowerCase()})`,
          m2,
          tarief: ondergrondTarief,
          totaal: m2 * ondergrondTarief,
        }
      : null;

  const geschatDrainageMeters = data.specs.drainage ? Math.ceil(m2 / 10) : 0;
  const drainageRegel =
    data.specs.drainage && geschatDrainageMeters > 0
      ? {
          label: "Drainage",
          meters: geschatDrainageMeters,
          tarief: 15,
          totaal: geschatDrainageMeters * 15,
        }
      : null;

  const opsluitbandenMeters = data.specs.opsluitbanden
    ? parseFloat(data.specs.opsluitbandenMeters) || 0
    : 0;
  const opsluitbandenRegel =
    data.specs.opsluitbanden && opsluitbandenMeters > 0
      ? {
          label: "Opsluitbanden",
          meters: opsluitbandenMeters,
          tarief: 18,
          totaal: opsluitbandenMeters * 18,
        }
      : null;

  const voorrijkosten = 75;

  const subtotaalExToeslag =
    gazonRegel.totaal +
    (ondergrondRegel?.totaal ?? 0) +
    (drainageRegel?.totaal ?? 0) +
    (opsluitbandenRegel?.totaal ?? 0) +
    voorrijkosten;

  const poort = parseFloat(data.klant.poortbreedte);
  const handmatigToeslag = !isNaN(poort) && poort < 80;
  const handmatigToeslagPercent = 25;
  const toeslagBedrag = handmatigToeslag
    ? Math.round(subtotaalExToeslag * (handmatigToeslagPercent / 100) * 100) / 100
    : 0;

  const subtotaal = subtotaalExToeslag + toeslagBedrag;
  const btw = Math.round(subtotaal * 0.21 * 100) / 100;
  const totaal = subtotaal + btw;

  return {
    gazonRegel,
    ondergrondRegel,
    drainageRegel,
    opsluitbandenRegel,
    voorrijkosten,
    handmatigToeslag,
    handmatigToeslagPercent,
    subtotaalExToeslag,
    toeslagBedrag,
    subtotaal,
    btw,
    totaal,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

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

export function validateStap2(specs: GazonSpecs): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!specs.oppervlakte.trim()) {
    errors.oppervlakte = "Oppervlakte is verplicht";
  } else {
    const opp = parseFloat(specs.oppervlakte);
    if (isNaN(opp) || opp < 10) {
      errors.oppervlakte = "Minimaal 10 m²";
    }
  }

  if (!specs.typeGras) errors.typeGras = "Selecteer een type gras";
  if (!specs.ondergrond) errors.ondergrond = "Selecteer de huidige ondergrond";

  if (specs.opsluitbanden) {
    const meters = parseFloat(specs.opsluitbandenMeters);
    if (!specs.opsluitbandenMeters.trim() || isNaN(meters) || meters <= 0) {
      errors.opsluitbandenMeters = "Voer het aantal meters in";
    }
  }

  return errors;
}
