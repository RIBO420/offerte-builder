import { z } from "zod";

// Helper to create optional string that treats empty string as undefined
const optionalString = z
  .string()
  .optional()
  .transform((val) => (val?.trim() === "" ? undefined : val?.trim()));

// Kwaliteits controle status enum
export const kwaliteitsStatusEnum = z.enum(
  ["gepland", "in_uitvoering", "afgerond", "afgekeurd"],
  {
    error: "Selecteer een status",
  }
);

export type KwaliteitsStatus = z.infer<typeof kwaliteitsStatusEnum>;

// Kwaliteits controle resultaat enum
export const kwaliteitsResultaatEnum = z.enum(
  ["goedgekeurd", "afgekeurd", "voorwaardelijk"],
  {
    error: "Selecteer een resultaat",
  }
);

export type KwaliteitsResultaat = z.infer<typeof kwaliteitsResultaatEnum>;

// Controle punt schema
export const controlePuntSchema = z.object({
  naam: z.string().min(1, "Naam is verplicht"),
  omschrijving: optionalString,
  resultaat: kwaliteitsResultaatEnum.optional(),
  opmerkingen: optionalString,
  fotoUrls: z.array(z.string()).optional(),
});

export type ControlePuntFormData = z.infer<typeof controlePuntSchema>;

// Kwaliteits controle schema
export const kwaliteitsControleSchema = z.object({
  projectId: z.string().min(1, "Project is verplicht"),
  scopeId: optionalString,
  controleurId: z.string().min(1, "Controleur is verplicht"),
  datum: z
    .date({ error: "Ongeldige datum" })
    .or(z.string().min(1, "Datum is verplicht")),
  type: z.enum(["tussentijds", "oplevering", "garantie"], {
    error: "Selecteer een controle type",
  }),
  status: kwaliteitsStatusEnum,
  controlePunten: z
    .array(controlePuntSchema)
    .min(1, "Voeg minimaal 1 controlepunt toe"),
  algemeenResultaat: kwaliteitsResultaatEnum.optional(),
  opmerkingen: optionalString,
  vervolgacties: optionalString,
});

export type KwaliteitsControleFormData = z.infer<typeof kwaliteitsControleSchema>;

// Schema voor het aanmaken van kwaliteits controle (met string date voor forms)
export const kwaliteitsControleCreateSchema = z.object({
  projectId: z.string().min(1, "Project is verplicht"),
  scopeId: optionalString,
  controleurId: z.string().min(1, "Controleur is verplicht"),
  datum: z.string().min(1, "Datum is verplicht"),
  type: z.enum(["tussentijds", "oplevering", "garantie"], {
    error: "Selecteer een controle type",
  }),
  status: kwaliteitsStatusEnum,
  controlePunten: z
    .array(controlePuntSchema)
    .min(1, "Voeg minimaal 1 controlepunt toe"),
  algemeenResultaat: kwaliteitsResultaatEnum.optional(),
  opmerkingen: optionalString,
  vervolgacties: optionalString,
});

export type KwaliteitsControleCreateFormData = z.infer<typeof kwaliteitsControleCreateSchema>;

// Afkeur item schema (voor afgekeurde punten)
export const afkeurItemSchema = z.object({
  controlePuntNaam: z.string(),
  reden: z.string().min(1, "Reden van afkeuring is verplicht"),
  herstelActie: optionalString,
  deadline: optionalString,
  verantwoordelijke: optionalString,
});

export type AfkeurItemFormData = z.infer<typeof afkeurItemSchema>;
