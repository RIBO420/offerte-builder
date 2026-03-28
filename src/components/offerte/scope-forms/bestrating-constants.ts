import type { Bestratingtype } from "@/types/offerte";

// ─── Funderingsspecificaties per bestratingtype ──────────────────────────────

export interface FunderingsSpec {
  gebrokenPuin: number;
  zand: number;
  brekerszand?: number;
  stabiliser?: boolean;
  beschrijving: string;
}

export const FUNDERINGS_SPECS: Record<Bestratingtype, FunderingsSpec> = {
  pad: {
    gebrokenPuin: 10,
    zand: 5,
    beschrijving: "Lichte fundering geschikt voor voetgangers",
  },
  oprit: {
    gebrokenPuin: 20,
    zand: 0,
    brekerszand: 5,
    beschrijving: "Stevige fundering voor autoverkeer",
  },
  terrein: {
    gebrokenPuin: 35,
    zand: 0,
    brekerszand: 5,
    stabiliser: true,
    beschrijving: "Zware fundering voor vrachtwagens en machines",
  },
};

export const BESTRATINGTYPE_OPTIONS: Array<{
  value: Bestratingtype;
  label: string;
  beschrijving: string;
}> = [
  {
    value: "pad",
    label: "Pad",
    beschrijving: "Tuinpad, wandelpad of stoep",
  },
  {
    value: "oprit",
    label: "Oprit",
    beschrijving: "Oprit of parkeerplaats voor auto's",
  },
  {
    value: "terrein",
    label: "Terrein / Loods",
    beschrijving: "Bedrijfsterrein, loods of zwaar belast",
  },
];

export const LAAG_TOOLTIPS: Record<string, string> = {
  gebrokenPuin:
    "Gebroken puin vormt de draagkrachtige basis van de fundering. Hoe zwaarder de belasting, hoe dikker deze laag moet zijn.",
  zand:
    "Straatzand is makkelijker te verwerken en voldoende voor lichte belasting zoals voetgangers.",
  brekerszand:
    "Brekerszand is moeilijker te verwerken maar veel belastbaarder dan straatzand. Noodzakelijk bij autoverkeer.",
  stabiliser:
    "Stabiliser (cement) wordt door het brekerszand gemengd voor maximale draagkracht. Noodzakelijk bij zware belasting.",
};

export const LAAG_KLEUREN: Record<string, { bg: string; border: string; text: string }> = {
  gebrokenPuin: {
    bg: "bg-stone-300 dark:bg-stone-600",
    border: "border-stone-400 dark:border-stone-500",
    text: "text-stone-800 dark:text-stone-100",
  },
  zand: {
    bg: "bg-yellow-200 dark:bg-yellow-700",
    border: "border-yellow-300 dark:border-yellow-600",
    text: "text-yellow-900 dark:text-yellow-100",
  },
  brekerszand: {
    bg: "bg-amber-300 dark:bg-amber-700",
    border: "border-amber-400 dark:border-amber-600",
    text: "text-amber-900 dark:text-amber-100",
  },
  stabiliser: {
    bg: "bg-gray-400 dark:bg-gray-600",
    border: "border-gray-500 dark:border-gray-500",
    text: "text-gray-900 dark:text-gray-100",
  },
};
