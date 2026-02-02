import { z } from "zod";

// Helper to create optional string that treats empty string as undefined
const optionalString = z
  .string()
  .optional()
  .transform((val) => (val?.trim() === "" ? undefined : val?.trim()));

// Inkooporder regel schema
export const inkooporderRegelSchema = z.object({
  omschrijving: z.string().min(1, "Omschrijving is verplicht"),
  hoeveelheid: z
    .number({ error: "Voer een getal in" })
    .min(0.01, "Hoeveelheid moet groter dan 0 zijn"),
  eenheid: z.string().min(1, "Eenheid is verplicht"),
  prijsPerEenheid: z
    .number({ error: "Voer een getal in" })
    .min(0.01, "Prijs moet groter dan 0 zijn"),
});

export type InkooporderRegelFormData = z.infer<typeof inkooporderRegelSchema>;

// Inkooporder schema
export const inkooporderSchema = z.object({
  leverancierId: z.string().min(1, "Leverancier is verplicht"),
  projectId: optionalString,
  regels: z
    .array(inkooporderRegelSchema)
    .min(1, "Voeg minimaal 1 regel toe"),
  notities: optionalString,
  verwachteLevertijd: z.date({ error: "Ongeldige datum" }).optional(),
});

export type InkooporderFormData = z.infer<typeof inkooporderSchema>;

// Schema voor het aanmaken van een inkooporder (met string date voor forms)
export const inkooporderCreateSchema = z.object({
  leverancierId: z.string().min(1, "Leverancier is verplicht"),
  projectId: optionalString,
  regels: z
    .array(inkooporderRegelSchema)
    .min(1, "Voeg minimaal 1 regel toe"),
  notities: optionalString,
  verwachteLevertijd: optionalString,
});

export type InkooporderCreateFormData = z.infer<typeof inkooporderCreateSchema>;
