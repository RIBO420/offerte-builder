import type { GazonConditie, KlantGegevens, VerticuterenSpecs } from "./types";

export const STAP_LABELS = [
  "Klantgegevens",
  "Specificaties",
  "Datum & Overzicht",
  "Bevestiging",
];
export const TOTAAL_STAPPEN = 4;

export const BASISPRIJS_PER_M2 = 4;
export const MACHINE_HUUR = 85;
export const VOORRIJKOSTEN = 75;
export const BIJZAAIEN_TARIEF = 3;
export const TOPDRESSING_TARIEF = 2;
export const BEMESTING_TARIEF = 1.5;

// De conditieschaal loopt van groen naar rood; die statuskleuren hebben geen
// design-token, dus elke kleur krijgt een expliciete dark:-variant (donker vlak
// + lichte tekst) zodat de gekozen kaart in dark mode leesbaar blijft.
export const CONDITIE_CONFIG: Record<
  GazonConditie,
  {
    label: string;
    uitleg: string;
    toeslagPercent: number;
    kleur: string;
    intensiteit: string;
  }
> = {
  uitstekend: {
    label: "Uitstekend",
    uitleg: "Minimaal mos, dicht grasmat — licht onderhoud voldoende",
    toeslagPercent: 0,
    kleur: "border-green-500 bg-green-50 dark:bg-green-950",
    intensiteit: "text-green-700 dark:text-green-400",
  },
  goed: {
    label: "Goed",
    uitleg: "Normaal gazon met enig mos en wat dunne plekken",
    toeslagPercent: 10,
    kleur: "border-lime-500 bg-lime-50 dark:bg-lime-950",
    intensiteit: "text-lime-700 dark:text-lime-400",
  },
  matig: {
    label: "Matig",
    uitleg: "Veel mos, kale plekken — intensievere behandeling nodig",
    toeslagPercent: 25,
    kleur: "border-yellow-500 bg-yellow-50 dark:bg-yellow-950",
    intensiteit: "text-yellow-700 dark:text-yellow-400",
  },
  slecht: {
    label: "Slecht",
    uitleg: "Meer dan 50% mos, veel onkruid — uitgebreide aanpak vereist",
    toeslagPercent: 50,
    kleur: "border-orange-500 bg-orange-50 dark:bg-orange-950",
    intensiteit: "text-orange-700 dark:text-orange-400",
  },
  zeer_slecht: {
    label: "Zeer slecht",
    uitleg: "Volledig verwaarloosd gazon — maximale inspanning vereist",
    toeslagPercent: 75,
    kleur: "border-red-500 bg-red-50 dark:bg-red-950",
    intensiteit: "text-red-700 dark:text-red-400",
  },
};

export const LEEG_KLANT: KlantGegevens = {
  naam: "",
  email: "",
  telefoon: "",
  adres: "",
  postcode: "",
  plaats: "",
  poortbreedte: "",
};

export const LEEG_SPECS: VerticuterenSpecs = {
  oppervlakte: "",
  conditie: "",
  bijzaaien: false,
  topdressing: false,
  bemesting: false,
};
