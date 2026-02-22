import { z } from "zod";

// Grondwerk schema
export const grondwerkSchema = z.object({
  oppervlakte: z
    .number({ error: "Voer een getal in" })
    .min(0.1, "Oppervlakte moet groter dan 0 zijn"),
  diepte: z.enum(["licht", "standaard", "zwaar"], {
    error: "Selecteer een diepte",
  }),
  afvoerGrond: z.boolean(),
});

export type GrondwerkFormData = z.infer<typeof grondwerkSchema>;

// Bestrating schema - with mandatory onderbouw
export const bestratingSchema = z.object({
  oppervlakte: z
    .number({ error: "Voer een getal in" })
    .min(0.1, "Oppervlakte moet groter dan 0 zijn"),
  typeBestrating: z.enum(["tegel", "klinker", "natuursteen"], {
    error: "Selecteer een type bestrating",
  }),
  snijwerk: z.enum(["laag", "gemiddeld", "hoog"], {
    error: "Selecteer snijwerk niveau",
  }),
  onderbouw: z.object({
    type: z.enum(["zandbed", "zand_fundering", "zware_fundering"], {
      error: "Selecteer een onderbouw type",
    }),
    dikteOnderlaag: z
      .number({ error: "Voer een getal in" })
      .min(1, "Dikte moet minimaal 1 cm zijn")
      .max(50, "Dikte mag maximaal 50 cm zijn"),
    opsluitbanden: z.boolean(),
  }),
});

export type BestratingFormData = z.infer<typeof bestratingSchema>;

// Borders schema
export const bordersSchema = z.object({
  oppervlakte: z
    .number({ error: "Voer een getal in" })
    .min(0.1, "Oppervlakte moet groter dan 0 zijn"),
  beplantingsintensiteit: z.enum(["weinig", "gemiddeld", "veel"], {
    error: "Selecteer beplantingsintensiteit",
  }),
  bodemverbetering: z.boolean(),
  afwerking: z.enum(["geen", "schors", "grind"], {
    error: "Selecteer afwerking",
  }),
});

export type BordersFormData = z.infer<typeof bordersSchema>;

// Gras schema
export const grasSchema = z.object({
  oppervlakte: z
    .number({ error: "Voer een getal in" })
    .min(0.1, "Oppervlakte moet groter dan 0 zijn"),
  type: z.enum(["zaaien", "graszoden"], {
    error: "Selecteer gras type",
  }),
  ondergrond: z.enum(["bestaand", "nieuw"], {
    error: "Selecteer ondergrond",
  }),
  afwateringNodig: z.boolean(),
  kunstgras: z.boolean().optional(),
  drainage: z.boolean().optional(),
  drainageMeters: z.number().min(1, "Minimaal 1 meter").optional(),
  opsluitbanden: z.boolean().optional(),
  opsluitbandenMeters: z.number().min(0.5, "Minimaal 0.5 meter").optional(),
  verticuteren: z.boolean().optional(),
});

export type GrasFormData = z.infer<typeof grasSchema>;

// Houtwerk schema - with mandatory fundering
export const houtwerkSchema = z.object({
  typeHoutwerk: z.enum(["schutting", "vlonder", "pergola"], {
    error: "Selecteer type houtwerk",
  }),
  afmeting: z
    .number({ error: "Voer een getal in" })
    .min(0.1, "Afmeting moet groter dan 0 zijn"),
  fundering: z.enum(["standaard", "zwaar"], {
    error: "Selecteer fundering type",
  }),
});

export type HoutwerkFormData = z.infer<typeof houtwerkSchema>;

// Water/Elektra schema - sleuven are mandatory when elektra is used
export const waterElektraSchema = z.object({
  verlichting: z.enum(["geen", "basis", "uitgebreid"], {
    error: "Selecteer verlichting optie",
  }),
  aantalPunten: z
    .number({ error: "Voer een getal in" })
    .min(0, "Aantal mag niet negatief zijn"),
  sleuvenNodig: z.boolean(),
}).refine(
  (data) => {
    // If verlichting is not 'geen' or aantalPunten > 0, sleuvenNodig should be true
    if (data.verlichting !== "geen" || data.aantalPunten > 0) {
      return data.sleuvenNodig === true;
    }
    return true;
  },
  {
    message: "Sleuven zijn verplicht bij elektra werkzaamheden",
    path: ["sleuvenNodig"],
  }
);

export type WaterElektraFormData = z.infer<typeof waterElektraSchema>;

// Specials schema
export const specialItemSchema = z.object({
  type: z.enum(["jacuzzi", "sauna", "prefab"], {
    error: "Selecteer type",
  }),
  omschrijving: z.string().min(1, "Omschrijving is verplicht"),
});

export const specialsSchema = z.object({
  items: z.array(specialItemSchema).min(1, "Voeg minimaal 1 item toe"),
});

export type SpecialsFormData = z.infer<typeof specialsSchema>;
