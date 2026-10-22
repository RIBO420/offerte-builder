import type { GazonConditie, KlantGegevens, VerticuterenSpecs } from "./types";

/* WS9 (keuzepunt 5): eerst prijs & datum laten zien, pas daarna NAW vragen. */
export const STAP_LABELS = [
  "Specificaties",
  "Prijs & datum",
  "Uw gegevens",
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
// design-token, dus elke kleur krijgt een expliciete (donker vlak
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
    kleur: "border-status-geaccepteerd-dot bg-status-geaccepteerd",
    intensiteit: "text-status-geaccepteerd-text",
  },
  goed: {
    label: "Goed",
    uitleg: "Normaal gazon met enig mos en wat dunne plekken",
    toeslagPercent: 10,
    kleur: "border-primary bg-surface-primair",
    intensiteit: "text-primary",
  },
  matig: {
    label: "Matig",
    uitleg: "Veel mos, kale plekken — intensievere behandeling nodig",
    toeslagPercent: 25,
    kleur: "border-status-herinnering-dot bg-status-herinnering",
    intensiteit: "text-status-herinnering-text",
  },
  slecht: {
    label: "Slecht",
    uitleg: "Meer dan 50% mos, veel onkruid — uitgebreide aanpak vereist",
    toeslagPercent: 50,
    kleur: "border-status-in-uitvoering-dot bg-status-in-uitvoering",
    intensiteit: "text-status-in-uitvoering-text",
  },
  zeer_slecht: {
    label: "Zeer slecht",
    uitleg: "Volledig verwaarloosd gazon — maximale inspanning vereist",
    toeslagPercent: 75,
    kleur: "border-status-afgewezen-dot bg-status-afgewezen",
    intensiteit: "text-status-afgewezen-text",
  },
};

export const LEEG_KLANT: KlantGegevens = {
  naam: "",
  email: "",
  telefoon: "",
  adres: "",
  postcode: "",
  plaats: "",
};

export const LEEG_SPECS: VerticuterenSpecs = {
  oppervlakte: "",
  conditie: "",
  bijzaaien: false,
  topdressing: false,
  bemesting: false,
  poortbreedte: "",
};
