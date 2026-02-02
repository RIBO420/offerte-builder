import { z } from "zod";

// Helper to create optional string that treats empty string as undefined
const optionalString = z
  .string()
  .optional()
  .transform((val) => (val?.trim() === "" ? undefined : val?.trim()));

// Project kosten type enum
export const projectKostenTypeEnum = z.enum(
  ["materiaal", "arbeid", "transport", "huur", "onderaannemer", "overig"],
  {
    error: "Selecteer een kostentype",
  }
);

export type ProjectKostenType = z.infer<typeof projectKostenTypeEnum>;

// Project kosten schema
export const projectKostenSchema = z.object({
  projectId: z.string().min(1, "Project is verplicht"),
  datum: z
    .date({ error: "Ongeldige datum" })
    .or(z.string().min(1, "Datum is verplicht")),
  type: projectKostenTypeEnum,
  omschrijving: z.string().min(1, "Omschrijving is verplicht"),
  bedrag: z
    .number({ error: "Voer een getal in" })
    .min(0.01, "Bedrag moet groter dan 0 zijn"),
  scopeId: optionalString,
  leverancierId: optionalString,
  inkooporderId: optionalString,
  factuurNummer: optionalString,
  notities: optionalString,
});

export type ProjectKostenFormData = z.infer<typeof projectKostenSchema>;

// Schema voor het aanmaken van project kosten (met string date voor forms)
export const projectKostenCreateSchema = z.object({
  projectId: z.string().min(1, "Project is verplicht"),
  datum: z.string().min(1, "Datum is verplicht"),
  type: projectKostenTypeEnum,
  omschrijving: z.string().min(1, "Omschrijving is verplicht"),
  bedrag: z
    .number({ error: "Voer een getal in" })
    .min(0.01, "Bedrag moet groter dan 0 zijn"),
  scopeId: optionalString,
  leverancierId: optionalString,
  inkooporderId: optionalString,
  factuurNummer: optionalString,
  notities: optionalString,
});

export type ProjectKostenCreateFormData = z.infer<typeof projectKostenCreateSchema>;
