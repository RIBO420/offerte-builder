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
  // Uitbreidingsvelden
  haagsoort: z.enum(["liguster", "beuk", "taxus", "conifeer", "buxus", "overig"]).optional(),
  haagsoortOverig: z.string().optional(),
  diepte: z.number({ error: "Voer een getal in" }).min(0, "Diepte mag niet negatief zijn").optional(),
  hoogwerkerNodig: z.boolean().optional(),
  ondergrond: z.enum(["bestrating", "border", "grind", "gras", "anders"]).optional(),
  snoeiFrequentie: z.enum(["1x", "2x", "3x"]).optional(),
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
  // Uitbreidingsvelden
  groottecategorie: z.enum(["0-4m", "4-10m", "10-20m"]).optional(),
  nabijGebouw: z.boolean().optional(),
  nabijStraat: z.boolean().optional(),
  nabijKabels: z.boolean().optional(),
  afstandTotStraat: z.number({ error: "Voer een getal in" }).min(0, "Afstand mag niet negatief zijn").optional(),
  inspectieType: z.enum(["geen", "visueel", "gecertificeerd"]).optional(),
  boomsoort: z.string().optional(),
  kroondiameter: z.number({ error: "Voer een getal in" }).min(0, "Kroondiameter mag niet negatief zijn").optional(),
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

// Reiniging onderhoud schema
export const reinigingOnderhoudSchema = z.object({
  terrasReiniging: z.boolean().optional(),
  terrasType: z.enum(["keramisch", "beton", "klinkers", "natuursteen", "hout"]).optional(),
  terrasOppervlakte: z.number({ error: "Voer een getal in" }).min(0, "Oppervlakte mag niet negatief zijn").optional(),
  bladruimen: z.boolean().optional(),
  bladruimenOppervlakte: z.number({ error: "Voer een getal in" }).min(0, "Oppervlakte mag niet negatief zijn").optional(),
  bladruimenFrequentie: z.enum(["eenmalig", "seizoen"]).optional(),
  bladruimenAfvoer: z.boolean().optional(),
  onkruidBestrating: z.boolean().optional(),
  onkruidBestratingOppervlakte: z.number({ error: "Voer een getal in" }).min(0, "Oppervlakte mag niet negatief zijn").optional(),
  onkruidMethode: z.enum(["handmatig", "branden", "heet_water", "chemisch"]).optional(),
  hogedrukspuitAkkoord: z.boolean().optional(),
  algeReiniging: z.boolean().optional(),
  algeOppervlakte: z.number({ error: "Voer een getal in" }).min(0, "Oppervlakte mag niet negatief zijn").optional(),
  algeType: z.enum(["dak", "bestrating", "hekwerk", "muur"]).optional(),
});

export type ReinigingOnderhoudFormData = z.infer<typeof reinigingOnderhoudSchema>;

// Bemesting onderhoud schema
export const bemestingOnderhoudSchema = z.object({
  bemestingsTypes: z.array(z.enum(["gazon", "borders", "bomen", "universeel"])).optional(),
  oppervlakte: z.number({ error: "Voer een getal in" }).min(0, "Oppervlakte mag niet negatief zijn").optional(),
  aantalBomen: z.number({ error: "Voer een getal in" }).min(0, "Aantal bomen mag niet negatief zijn").optional(),
  seizoen: z.enum(["voorjaar", "zomer", "najaar", "heel_jaar"]).optional(),
  productType: z.enum(["basis", "premium", "bio"]).optional(),
  frequentie: z.enum(["1x", "2x", "3x", "4x"]).optional(),
  kalkbehandeling: z.boolean().optional(),
  grondanalyse: z.boolean().optional(),
  onkruidvrijeBemesting: z.boolean().optional(),
});

export type BemestingOnderhoudFormData = z.infer<typeof bemestingOnderhoudSchema>;

// Gazonanalyse onderhoud schema
export const gazonanalyseProblemenSchema = z.object({
  mos: z.boolean().optional(),
  mosPercentage: z.number({ error: "Voer een getal in" }).min(0).max(100, "Percentage moet tussen 0 en 100 zijn").optional(),
  kalePlekken: z.boolean().optional(),
  kalePlekkenM2: z.number({ error: "Voer een getal in" }).min(0, "Oppervlakte mag niet negatief zijn").optional(),
  onkruid: z.boolean().optional(),
  onkruidType: z.enum(["breed", "smal", "klaver"]).optional(),
  verdroging: z.boolean().optional(),
  wateroverlast: z.boolean().optional(),
  schaduw: z.boolean().optional(),
  schaduwPercentage: z.number({ error: "Voer een getal in" }).min(0).max(100, "Percentage moet tussen 0 en 100 zijn").optional(),
  verzuring: z.boolean().optional(),
  muizenMollen: z.boolean().optional(),
});

export const gazonanalyseOnderhoudSchema = z.object({
  conditieScore: z.number({ error: "Voer een getal in" }).min(0).max(10, "Score moet tussen 0 en 10 zijn").optional(),
  problemen: gazonanalyseProblemenSchema.optional(),
  oppervlakte: z.number({ error: "Voer een getal in" }).min(0, "Oppervlakte mag niet negatief zijn").optional(),
  huidigGrastype: z.enum(["onbekend", "sport", "sier", "schaduw", "mix"]).optional(),
  bodemtype: z.enum(["zand", "klei", "veen", "leem"]).optional(),
  herstelacties: z.array(z.enum(["verticuteren", "doorzaaien", "nieuwe_grasmat", "plaggen", "bijzaaien"])).optional(),
  drainage: z.boolean().optional(),
  bekalken: z.boolean().optional(),
  robotmaaierAdvies: z.boolean().optional(),
  beregeningsadvies: z.boolean().optional(),
});

export type GazonanalyseOnderhoudFormData = z.infer<typeof gazonanalyseOnderhoudSchema>;

// Mollenbestrijding onderhoud schema
export const mollenbestrijdingOnderhoudSchema = z.object({
  aantalMolshopen: z.number({ error: "Voer een getal in" }).min(0, "Aantal molshopen mag niet negatief zijn").optional(),
  oppervlakte: z.number({ error: "Voer een getal in" }).min(0, "Oppervlakte mag niet negatief zijn").optional(),
  tuinType: z.enum(["gazon", "border", "moestuin", "gemengd"]).optional(),
  ernst: z.number({ error: "Voer een getal in" }).min(1).max(5, "Ernst moet tussen 1 en 5 zijn").optional(),
  pakket: z.enum(["basis", "premium", "premium_plus"]).optional(),
  gazonherstel: z.boolean().optional(),
  gazonherstelM2: z.number({ error: "Voer een getal in" }).min(0, "Oppervlakte mag niet negatief zijn").optional(),
  preventiefGaas: z.boolean().optional(),
  preventiefGaasM2: z.number({ error: "Voer een getal in" }).min(0, "Oppervlakte mag niet negatief zijn").optional(),
  terugkeerCheck: z.boolean().optional(),
});

export type MollenbestrijdingOnderhoudFormData = z.infer<typeof mollenbestrijdingOnderhoudSchema>;
