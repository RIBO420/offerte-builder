// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TypeGras = "graszoden" | "inzaaien" | "kunstgras";
export type Ondergrond = "bestaand_gras" | "kale_grond" | "bestrating_verwijderen";

export interface KlantGegevens {
  naam: string;
  email: string;
  telefoon: string;
  adres: string;
  postcode: string;
  plaats: string;
  poortbreedte: string;
}

export interface GazonSpecs {
  oppervlakte: string;
  typeGras: TypeGras | "";
  ondergrond: Ondergrond | "";
  drainage: boolean;
  opsluitbanden: boolean;
  opsluitbandenMeters: string;
  gewensteStartdatum: Date | undefined;
}

export interface FormData {
  klant: KlantGegevens;
  specs: GazonSpecs;
}

export interface PrijsBerekening {
  gazonRegel: { label: string; m2: number; tarief: number; totaal: number };
  ondergrondRegel: { label: string; m2: number; tarief: number; totaal: number } | null;
  drainageRegel: { label: string; meters: number; tarief: number; totaal: number } | null;
  opsluitbandenRegel: { label: string; meters: number; tarief: number; totaal: number } | null;
  voorrijkosten: number;
  handmatigToeslag: boolean;
  handmatigToeslagPercent: number;
  subtotaalExToeslag: number;
  toeslagBedrag: number;
  subtotaal: number;
  btw: number;
  totaal: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const STAP_LABELS = ["Klantgegevens", "Gazon specificaties", "Foto's", "Prijsoverzicht"];
export const TOTAAL_STAPPEN = 4;
export const AANBETALING_BEDRAG = 75;

export const TYPE_GRAS_CONFIG: Record<
  TypeGras,
  { label: string; uitleg: string; prijsIndicatie: string; tarief: number; kleur: string }
> = {
  graszoden: {
    label: "Graszoden",
    uitleg: "Direct mooi resultaat. Hoge kwaliteit graszoden worden vakkundig gelegd voor een instant gazon.",
    prijsIndicatie: "€12–15 / m²",
    tarief: 14,
    kleur: "border-green-500 bg-green-50",
  },
  inzaaien: {
    label: "Inzaaien",
    uitleg: "Voordeliger optie met een groeitijd van 4–8 weken. Ideaal voor grote oppervlakken.",
    prijsIndicatie: "€5–8 / m²",
    tarief: 6,
    kleur: "border-lime-500 bg-lime-50",
  },
  kunstgras: {
    label: "Kunstgras",
    uitleg: "Onderhoudsvrij en altijd groen. Ideaal voor gezinnen met kinderen of huisdieren.",
    prijsIndicatie: "€35–60 / m²",
    tarief: 45,
    kleur: "border-emerald-500 bg-emerald-50",
  },
};

export const ONDERGROND_CONFIG: Record<
  Ondergrond,
  { label: string; uitleg: string; tarief: number; toeslag: boolean }
> = {
  bestaand_gras: {
    label: "Bestaand gras verwijderen",
    uitleg: "Huidig gras wordt gefreesd of afgeplagd en afgevoerd.",
    tarief: 2,
    toeslag: false,
  },
  kale_grond: {
    label: "Kale grond (klaar voor gebruik)",
    uitleg: "De grond is al vrijgemaakt. Enkel nivelleren en voorbereiden.",
    tarief: 0,
    toeslag: false,
  },
  bestrating_verwijderen: {
    label: "Bestrating verwijderen",
    uitleg: "Tegels, klinkers of ander verhardingsmateriaal wordt verwijderd en afgevoerd.",
    tarief: 8,
    toeslag: true,
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

export const LEEG_SPECS: GazonSpecs = {
  oppervlakte: "",
  typeGras: "",
  ondergrond: "",
  drainage: false,
  opsluitbanden: false,
  opsluitbandenMeters: "",
  gewensteStartdatum: undefined,
};
