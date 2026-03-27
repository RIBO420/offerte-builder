import { z } from "zod";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const onkruidTypeSchema = z.enum(["breed", "smal", "klaver"]);

export const gazonanalyseSchema = z.object({
  // 1. Gazonbeoordeling
  conditieScore: z.number().int().min(1).max(5),

  // 2. Problemen checklist
  problemen: z.object({
    mos: z.boolean(),
    mosPercentage: z.number().min(0).max(100),
    kalePlekken: z.boolean(),
    kalePlekkenOppervlakte: z.number().min(0),
    onkruid: z.boolean(),
    onkruidType: onkruidTypeSchema.optional(),
    verdroging: z.boolean(),
    wateroverlast: z.boolean(),
    schaduw: z.boolean(),
    schaduwPercentage: z.number().min(0).max(100),
    verzuring: z.boolean(),
    muizenMollen: z.boolean(),
  }),

  // 3. Gazon specificaties
  specificaties: z.object({
    oppervlakte: z
      .number({ error: "Voer een getal in" })
      .min(0, "Oppervlakte mag niet negatief zijn"),
    grastype: z.enum(["onbekend", "sport", "sier", "schaduw", "mix"]),
    bodemtype: z.enum(["zand", "klei", "veen", "leem"]),
  }),

  // 4. Herstelpad
  herstelActies: z.array(z.string()),

  // 5. Aanvullende aanbevelingen
  aanbevelingen: z.object({
    drainageAanleggen: z.boolean(),
    bekalken: z.boolean(),
    robotmaaierAdvies: z.boolean(),
    beregeningsadvies: z.boolean(),
  }),
});

export type GazonanalyseFormData = z.infer<typeof gazonanalyseSchema>;

// Public data type — exported so parent components can import it if needed
export type GazonanalyseData = GazonanalyseFormData;

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

export const defaultGazonanalyseData: GazonanalyseData = {
  conditieScore: 3,
  problemen: {
    mos: false,
    mosPercentage: 0,
    kalePlekken: false,
    kalePlekkenOppervlakte: 0,
    onkruid: false,
    onkruidType: undefined,
    verdroging: false,
    wateroverlast: false,
    schaduw: false,
    schaduwPercentage: 0,
    verzuring: false,
    muizenMollen: false,
  },
  specificaties: {
    oppervlakte: 0,
    grastype: "onbekend",
    bodemtype: "zand",
  },
  herstelActies: [],
  aanbevelingen: {
    drainageAanleggen: false,
    bekalken: false,
    robotmaaierAdvies: false,
    beregeningsadvies: false,
  },
};

// ---------------------------------------------------------------------------
// Score helpers
// ---------------------------------------------------------------------------

export interface ScoreInfo {
  label: string;
  emoji: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

export const SCORE_INFO: Record<number, ScoreInfo> = {
  1: {
    label: "Zeer slecht — volledig opnieuw aanleggen",
    emoji: "\u{1F480}",
    colorClass: "text-red-600",
    bgClass: "bg-red-50",
    borderClass: "border-red-200",
  },
  2: {
    label: "Slecht — veel kale plekken, mos",
    emoji: "\u{1F61F}",
    colorClass: "text-orange-600",
    bgClass: "bg-orange-50",
    borderClass: "border-orange-200",
  },
  3: {
    label: "Matig — verbetering mogelijk",
    emoji: "\u{1F610}",
    colorClass: "text-yellow-600",
    bgClass: "bg-yellow-50",
    borderClass: "border-yellow-200",
  },
  4: {
    label: "Goed — licht onderhoud nodig",
    emoji: "\u{1F60A}",
    colorClass: "text-lime-600",
    bgClass: "bg-lime-50",
    borderClass: "border-lime-200",
  },
  5: {
    label: "Uitstekend — alleen bijhouden",
    emoji: "\u{1F33F}",
    colorClass: "text-green-600",
    bgClass: "bg-green-50",
    borderClass: "border-green-200",
  },
};

// ---------------------------------------------------------------------------
// Herstelpad data
// ---------------------------------------------------------------------------

export interface HerstelOptie {
  id: string;
  label: string;
  omschrijving: string;
  kostenIndicatie?: string;
}

const HERSTEL_OPTIES_SCORE_1_2: HerstelOptie[] = [
  {
    id: "graszoden",
    label: "Nieuwe grasmat (graszoden)",
    omschrijving: "Bestaand gazon volledig verwijderen en nieuwe graszoden leggen.",
    kostenIndicatie: "€ 8–14 / m²",
  },
  {
    id: "opnieuw_inzaaien_vol",
    label: "Opnieuw inzaaien",
    omschrijving: "Bodem frezen, egaliseren en volledig opnieuw inzaaien.",
    kostenIndicatie: "€ 4–8 / m²",
  },
];

const HERSTEL_OPTIES_SCORE_3: HerstelOptie[] = [
  {
    id: "verticuteren_doorzaaien",
    label: "Verticuteren + doorzaaien",
    omschrijving: "Filtvilt en mos verwijderen, daarna doorzaaien op kale plekken.",
    kostenIndicatie: "€ 3–6 / m²",
  },
  {
    id: "plaggen_inzaaien",
    label: "Plaggen + opnieuw inzaaien",
    omschrijving: "Toplaag verwijderen (plaggen), bodem verbeteren en nieuw zaaien.",
    kostenIndicatie: "€ 5–9 / m²",
  },
];

const HERSTEL_OPTIES_SCORE_4_5: HerstelOptie[] = [
  {
    id: "verticuteren",
    label: "Verticuteren",
    omschrijving: "Filtvilt doorsnijden voor betere doorluchting en wateropname.",
    kostenIndicatie: "€ 1–3 / m²",
  },
  {
    id: "bemesting",
    label: "Bemesting",
    omschrijving: "Seizoensgebonden bemesting voor gezonde grasgroei.",
    kostenIndicatie: "€ 0,50–1,50 / m²",
  },
  {
    id: "bijzaaien",
    label: "Bijzaaien kale plekken",
    omschrijving: "Kleine kale plekken aanpakken met doorzaai.",
    kostenIndicatie: "€ 2–4 / m²",
  },
];

export function getHerstelOpties(score: number): { titel: string; omschrijving: string; opties: HerstelOptie[] } {
  if (score <= 2) {
    return {
      titel: "Aanbevolen: Volledig vernieuwen",
      omschrijving: "Het gazon is te ver heen voor herstel. Vernieuwen geeft het beste resultaat.",
      opties: HERSTEL_OPTIES_SCORE_1_2,
    };
  }
  if (score === 3) {
    return {
      titel: "Aanbevolen: Intensief herstel",
      omschrijving: "Met intensief herstel kan dit gazon sterk verbeteren.",
      opties: HERSTEL_OPTIES_SCORE_3,
    };
  }
  return {
    titel: "Aanbevolen: Regulier onderhoud",
    omschrijving: "Het gazon is in goede staat. Regulier onderhoud houdt het op niveau.",
    opties: HERSTEL_OPTIES_SCORE_4_5,
  };
}
