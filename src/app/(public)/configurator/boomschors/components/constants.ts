import type { BoomschorsType } from "./types";

// ---------------------------------------------------------------------------
// Pricing & product configuration
// ---------------------------------------------------------------------------

export const PRIJZEN = {
  grove_schors: 32,
  fijne_schors: 38,
  cacaodoppen: 45,
  houtsnippers: 25,
} as const;

export const DIKTE_FACTOR = {
  "5cm": 0.05,
  "7cm": 0.07,
  "10cm": 0.1,
} as const;

export const PRODUCT_INFO: Record<
  BoomschorsType,
  { label: string; subtitel: string; beschrijving: string; badge?: string }
> = {
  grove_schors: {
    label: "Grove boomschors",
    subtitel: "20-40mm",
    beschrijving: "Ideaal voor borders, onderhoudsvriendelijk",
    badge: "Populair",
  },
  fijne_schors: {
    label: "Fijne boomschors",
    subtitel: "10-20mm",
    beschrijving: "Decoratief, nette uitstraling",
  },
  cacaodoppen: {
    label: "Cacaodoppen",
    subtitel: "Premium",
    beschrijving: "Premium, chocoladegeur",
    badge: "Premium",
  },
  houtsnippers: {
    label: "Houtsnippers",
    subtitel: "Natuurlijk",
    beschrijving: "Natuurlijk, budget-vriendelijk",
    badge: "Voordelig",
  },
};

export const STAP_LABELS = ["Uw gegevens", "Specificaties", "Bevestiging"];
