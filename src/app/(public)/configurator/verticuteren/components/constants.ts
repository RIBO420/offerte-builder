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
    kleur: "border-green-500 bg-green-50",
    intensiteit: "text-green-700",
  },
  goed: {
    label: "Goed",
    uitleg: "Normaal gazon met enig mos en wat dunne plekken",
    toeslagPercent: 10,
    kleur: "border-lime-500 bg-lime-50",
    intensiteit: "text-lime-700",
  },
  matig: {
    label: "Matig",
    uitleg: "Veel mos, kale plekken — intensievere behandeling nodig",
    toeslagPercent: 25,
    kleur: "border-yellow-500 bg-yellow-50",
    intensiteit: "text-yellow-700",
  },
  slecht: {
    label: "Slecht",
    uitleg: "Meer dan 50% mos, veel onkruid — uitgebreide aanpak vereist",
    toeslagPercent: 50,
    kleur: "border-orange-500 bg-orange-50",
    intensiteit: "text-orange-700",
  },
  zeer_slecht: {
    label: "Zeer slecht",
    uitleg: "Volledig verwaarloosd gazon — maximale inspanning vereist",
    toeslagPercent: 75,
    kleur: "border-red-500 bg-red-50",
    intensiteit: "text-red-700",
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
