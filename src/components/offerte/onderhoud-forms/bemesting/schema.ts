import { z } from "zod";

// ─── Lokaal Zod schema ────────────────────────────────────────────────────────

const bemestingstypeSchema = z.object({
  gazon: z.boolean(),
  borders: z.boolean(),
  bomen: z.boolean(),
  universeel: z.boolean(),
});

const typeDetailSchema = z.object({
  oppervlakte: z
    .number({ error: "Voer een getal in" })
    .min(0, "Oppervlakte mag niet negatief zijn"),
  seizoen: z.enum(["voorjaar", "zomer", "najaar", "heel_jaar"], {
    error: "Selecteer een seizoen",
  }),
});

const bomenDetailSchema = z.object({
  aantalBomen: z
    .number({ error: "Voer een getal in" })
    .min(0, "Aantal mag niet negatief zijn"),
  seizoen: z.enum(["voorjaar", "zomer", "najaar", "heel_jaar"], {
    error: "Selecteer een seizoen",
  }),
});

export const bemestingSchema = z
  .object({
    types: bemestingstypeSchema,
    gazonDetail: typeDetailSchema,
    bordersDetail: typeDetailSchema,
    bomenDetail: bomenDetailSchema,
    universeelDetail: typeDetailSchema,
    product: z.enum(["basis", "premium", "bio"], {
      error: "Selecteer een product",
    }),
    frequentie: z.enum(["1x", "2x", "3x", "4x"], {
      error: "Selecteer een frequentie",
    }),
    kalkbehandeling: z.boolean(),
    grondanalyse: z.boolean(),
    onkruidvrijeBemesting: z.boolean(),
  })
  .refine(
    (data) => {
      const { gazon, borders, bomen, universeel } = data.types;
      return gazon || borders || bomen || universeel;
    },
    {
      message: "Selecteer minimaal één bemestingstype",
      path: ["types"],
    }
  )
  .refine(
    (data) => {
      if (data.types.gazon) {
        return data.gazonDetail.oppervlakte > 0;
      }
      return true;
    },
    {
      message: "Gazonoppervlakte moet groter dan 0 zijn",
      path: ["gazonDetail", "oppervlakte"],
    }
  )
  .refine(
    (data) => {
      if (data.types.borders) {
        return data.bordersDetail.oppervlakte > 0;
      }
      return true;
    },
    {
      message: "Borderoppervlakte moet groter dan 0 zijn",
      path: ["bordersDetail", "oppervlakte"],
    }
  )
  .refine(
    (data) => {
      if (data.types.bomen) {
        return data.bomenDetail.aantalBomen > 0;
      }
      return true;
    },
    {
      message: "Aantal bomen moet minimaal 1 zijn",
      path: ["bomenDetail", "aantalBomen"],
    }
  )
  .refine(
    (data) => {
      if (data.types.universeel) {
        return data.universeelDetail.oppervlakte > 0;
      }
      return true;
    },
    {
      message: "Tuinoppervlakte moet groter dan 0 zijn",
      path: ["universeelDetail", "oppervlakte"],
    }
  );

export type BemestingFormData = z.infer<typeof bemestingSchema>;

// ─── Standaardwaarden ─────────────────────────────────────────────────────────

export const bemestingDefaultValues: BemestingFormData = {
  types: {
    gazon: false,
    borders: false,
    bomen: false,
    universeel: false,
  },
  gazonDetail: { oppervlakte: 0, seizoen: "voorjaar" },
  bordersDetail: { oppervlakte: 0, seizoen: "voorjaar" },
  bomenDetail: { aantalBomen: 0, seizoen: "voorjaar" },
  universeelDetail: { oppervlakte: 0, seizoen: "voorjaar" },
  product: "basis",
  frequentie: "1x",
  kalkbehandeling: false,
  grondanalyse: false,
  onkruidvrijeBemesting: false,
};

// ─── Hulpfuncties ─────────────────────────────────────────────────────────────

export const SEIZOEN_LABELS: Record<string, string> = {
  voorjaar: "Voorjaar",
  zomer: "Zomer",
  najaar: "Najaar",
  heel_jaar: "Heel jaar (4x)",
};

export const FREQUENTIE_LABELS: Record<string, string> = {
  "1x": "1× per jaar",
  "2x": "2× per jaar",
  "3x": "3× per jaar",
  "4x": "4× per jaar",
};
