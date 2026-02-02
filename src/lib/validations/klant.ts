import { z } from "zod";

// Shared regex patterns - must match convex/validators.ts
export const PHONE_PATTERN = /^(\+31|0)[1-9]\d{1,8}$/;
export const POSTCODE_PATTERN = /^\d{4}\s?[A-Za-z]{2}$/;

// Helper to create optional string that treats empty string as undefined
const optionalString = z
  .string()
  .optional()
  .transform((val) => (val?.trim() === "" ? undefined : val?.trim()));

// Helper to create optional email validation
const optionalEmail = z
  .string()
  .optional()
  .transform((val) => (val?.trim() === "" ? undefined : val?.trim()?.toLowerCase()))
  .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
    message: "Ongeldig e-mailadres",
  });

// Helper to create optional phone validation
const optionalPhone = z
  .string()
  .optional()
  .transform((val) => {
    if (!val || val.trim() === "") return undefined;
    // Remove common formatting characters
    return val.replace(/[\s\-\(\)]/g, "");
  })
  .refine((val) => !val || PHONE_PATTERN.test(val), {
    message: "Ongeldig telefoonnummer. Gebruik formaat: 0612345678 of +31612345678",
  });

export const klantSchema = z.object({
  naam: z.string().min(1, "Naam is verplicht"),
  adres: z.string().min(1, "Adres is verplicht"),
  postcode: z
    .string()
    .min(1, "Postcode is verplicht")
    .transform((val) => val.toUpperCase().replace(/^(\d{4})\s?([A-Z]{2})$/, "$1 $2"))
    .refine((val) => POSTCODE_PATTERN.test(val), {
      message: "Ongeldige postcode (bijv. 1234 AB)",
    }),
  plaats: z.string().min(1, "Plaats is verplicht"),
  email: optionalEmail,
  telefoon: optionalPhone,
});

export type KlantFormData = z.infer<typeof klantSchema>;
