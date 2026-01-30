import { z } from "zod";

// Gras onderhoud schema
export const grasOnderhoudSchema = z.object({
  grasAanwezig: z.boolean(),
  grasOppervlakte: z
    .number({ error: "Voer een getal in" })
    .min(0, "Oppervlakte mag niet negatief zijn"),
  maaien: z.boolean(),
  kantenSteken: z.boolean(),
  verticuteren: z.boolean(),
  afvoerGras: z.boolean(),
}).refine(
  (data) => {
    // If grasAanwezig is true, oppervlakte must be > 0
    if (data.grasAanwezig) {
      return data.grasOppervlakte > 0;
    }
    return true;
  },
  {
    message: "Grasoppervlakte moet groter dan 0 zijn als gras aanwezig is",
    path: ["grasOppervlakte"],
  }
);

export type GrasOnderhoudFormData = z.infer<typeof grasOnderhoudSchema>;

// Borders onderhoud schema - intensiteit is mandatory
export const bordersOnderhoudSchema = z.object({
  borderOppervlakte: z
    .number({ error: "Voer een getal in" })
    .min(0.1, "Borderoppervlakte moet groter dan 0 zijn"),
  onderhoudsintensiteit: z.enum(["weinig", "gemiddeld", "veel"], {
    error: "Onderhoudsintensiteit is verplicht",
  }),
  onkruidVerwijderen: z.boolean(),
  snoeiInBorders: z.enum(["geen", "licht", "zwaar"], {
    error: "Selecteer snoei niveau",
  }),
  bodem: z.enum(["open", "bedekt"], {
    error: "Selecteer bodem type",
  }),
  afvoerGroenafval: z.boolean(),
});

export type BordersOnderhoudFormData = z.infer<typeof bordersOnderhoudSchema>;

// Heggen onderhoud schema - ALL THREE dimensions are mandatory
export const heggenOnderhoudSchema = z.object({
  lengte: z
    .number({ error: "Voer een getal in" })
    .min(0.1, "Lengte moet groter dan 0 zijn"),
  hoogte: z
    .number({ error: "Voer een getal in" })
    .min(0.1, "Hoogte moet groter dan 0 zijn"),
  breedte: z
    .number({ error: "Voer een getal in" })
    .min(0.1, "Breedte moet groter dan 0 zijn"),
  snoei: z.enum(["zijkanten", "bovenkant", "beide"], {
    error: "Selecteer snoei type",
  }),
  afvoerSnoeisel: z.boolean(),
});

export type HeggenOnderhoudFormData = z.infer<typeof heggenOnderhoudSchema>;

// Bomen onderhoud schema
export const bomenOnderhoudSchema = z.object({
  aantalBomen: z
    .number({ error: "Voer een getal in" })
    .min(1, "Aantal bomen moet minimaal 1 zijn"),
  snoei: z.enum(["licht", "zwaar"], {
    error: "Selecteer snoei type",
  }),
  hoogteklasse: z.enum(["laag", "middel", "hoog"], {
    error: "Selecteer hoogteklasse",
  }),
  afvoer: z.boolean(),
});

export type BomenOnderhoudFormData = z.infer<typeof bomenOnderhoudSchema>;

// Overige onderhoud schema - conditional validation
export const overigeOnderhoudSchema = z.object({
  bladruimen: z.boolean(),
  terrasReinigen: z.boolean(),
  terrasOppervlakte: z
    .number({ error: "Voer een getal in" })
    .optional(),
  onkruidBestrating: z.boolean(),
  bestratingOppervlakte: z
    .number({ error: "Voer een getal in" })
    .optional(),
  afwateringControleren: z.boolean(),
  aantalAfwateringspunten: z
    .number({ error: "Voer een getal in" })
    .optional(),
  overigNotities: z.string().optional(),
  overigUren: z
    .number({ error: "Voer een getal in" })
    .min(0, "Uren mag niet negatief zijn")
    .optional(),
}).refine(
  (data) => {
    // If terrasReinigen is true, terrasOppervlakte must be > 0
    if (data.terrasReinigen) {
      return data.terrasOppervlakte !== undefined && data.terrasOppervlakte > 0;
    }
    return true;
  },
  {
    message: "Terras oppervlakte is verplicht als terras reinigen is geselecteerd",
    path: ["terrasOppervlakte"],
  }
).refine(
  (data) => {
    // If onkruidBestrating is true, bestratingOppervlakte must be > 0
    if (data.onkruidBestrating) {
      return data.bestratingOppervlakte !== undefined && data.bestratingOppervlakte > 0;
    }
    return true;
  },
  {
    message: "Bestrating oppervlakte is verplicht als onkruid bestrating is geselecteerd",
    path: ["bestratingOppervlakte"],
  }
).refine(
  (data) => {
    // If afwateringControleren is true, aantalAfwateringspunten must be > 0
    if (data.afwateringControleren) {
      return data.aantalAfwateringspunten !== undefined && data.aantalAfwateringspunten > 0;
    }
    return true;
  },
  {
    message: "Aantal afwateringspunten is verplicht als afwatering controleren is geselecteerd",
    path: ["aantalAfwateringspunten"],
  }
);

export type OverigeOnderhoudFormData = z.infer<typeof overigeOnderhoudSchema>;
