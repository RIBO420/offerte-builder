import { z } from "zod";

export const klantSchema = z.object({
  naam: z.string().min(1, "Naam is verplicht"),
  adres: z.string().min(1, "Adres is verplicht"),
  postcode: z
    .string()
    .min(1, "Postcode is verplicht")
    .regex(/^\d{4}\s?[A-Za-z]{2}$/, "Ongeldige postcode (bijv. 1234 AB)"),
  plaats: z.string().min(1, "Plaats is verplicht"),
  email: z
    .string()
    .email("Ongeldig e-mailadres")
    .optional()
    .or(z.literal("")),
  telefoon: z.string().optional().or(z.literal("")),
});

export type KlantFormData = z.infer<typeof klantSchema>;
