import { z } from "zod";

// Helper to create optional string that treats empty string as undefined
const optionalString = z
  .string()
  .optional()
  .transform((val) => (val?.trim() === "" ? undefined : val?.trim()));

// Voorraad item schema
export const voorraadSchema = z.object({
  artikelNaam: z.string().min(1, "Artikelnaam is verplicht"),
  artikelCode: optionalString,
  categorie: z.string().min(1, "Categorie is verplicht"),
  eenheid: z.string().min(1, "Eenheid is verplicht"),
  hoeveelheid: z
    .number({ error: "Voer een getal in" })
    .min(0, "Hoeveelheid mag niet negatief zijn"),
  minimumVoorraad: z
    .number({ error: "Voer een getal in" })
    .min(0, "Minimum voorraad mag niet negatief zijn")
    .optional(),
  locatie: optionalString,
  leverancierId: optionalString,
  kostprijsPerEenheid: z
    .number({ error: "Voer een getal in" })
    .min(0, "Kostprijs mag niet negatief zijn")
    .optional(),
  notities: optionalString,
});

export type VoorraadFormData = z.infer<typeof voorraadSchema>;

// Voorraad aanpassing schema
export const voorraadAdjustSchema = z.object({
  voorraadId: z.string().min(1, "Voorraad item is verplicht"),
  type: z.enum(["toevoegen", "verwijderen", "correctie"], {
    error: "Selecteer een aanpassing type",
  }),
  hoeveelheid: z
    .number({ error: "Voer een getal in" })
    .min(0.01, "Hoeveelheid moet groter dan 0 zijn"),
  reden: z.string().min(1, "Reden is verplicht"),
  projectId: optionalString,
  inkooporderId: optionalString,
});

export type VoorraadAdjustFormData = z.infer<typeof voorraadAdjustSchema>;

// Voorraad mutatie schema (voor weergave)
export const voorraadMutatieSchema = z.object({
  voorraadId: z.string(),
  type: z.enum(["in", "uit", "correctie"]),
  hoeveelheid: z.number(),
  reden: z.string(),
  datum: z.date(),
  gebruikerId: z.string().optional(),
  projectId: z.string().optional(),
  inkooporderId: z.string().optional(),
});

export type VoorraadMutatieFormData = z.infer<typeof voorraadMutatieSchema>;
