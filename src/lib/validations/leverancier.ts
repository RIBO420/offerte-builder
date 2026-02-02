import { z } from "zod";

// Shared regex patterns - must match convex/validators.ts
export const PHONE_PATTERN = /^(\+31|0)[1-9]\d{1,8}$/;
export const POSTCODE_PATTERN = /^\d{4}\s?[A-Za-z]{2}$/;
export const KVK_PATTERN = /^\d{8}$/;
export const BTW_PATTERN = /^NL\d{9}B\d{2}$/;
export const IBAN_PATTERN = /^[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}$/;

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
    return val.replace(/[\s\-\(\)]/g, "");
  })
  .refine((val) => !val || PHONE_PATTERN.test(val), {
    message: "Ongeldig telefoonnummer. Gebruik formaat: 0612345678 of +31612345678",
  });

// Helper for optional postcode
const optionalPostcode = z
  .string()
  .optional()
  .transform((val) => {
    if (!val || val.trim() === "") return undefined;
    return val.toUpperCase().replace(/^(\d{4})\s?([A-Z]{2})$/, "$1 $2");
  })
  .refine((val) => !val || POSTCODE_PATTERN.test(val), {
    message: "Ongeldige postcode (bijv. 1234 AB)",
  });

// Helper for optional KvK nummer
const optionalKvk = z
  .string()
  .optional()
  .transform((val) => {
    if (!val || val.trim() === "") return undefined;
    return val.replace(/[\s\.]/g, "");
  })
  .refine((val) => !val || KVK_PATTERN.test(val), {
    message: "KvK-nummer moet 8 cijfers bevatten",
  });

// Helper for optional BTW nummer
const optionalBtw = z
  .string()
  .optional()
  .transform((val) => {
    if (!val || val.trim() === "") return undefined;
    return val.toUpperCase().replace(/[\s\.]/g, "");
  })
  .refine((val) => !val || BTW_PATTERN.test(val), {
    message: "Ongeldig BTW-nummer (formaat: NL123456789B01)",
  });

// Helper for optional IBAN
const optionalIban = z
  .string()
  .optional()
  .transform((val) => {
    if (!val || val.trim() === "") return undefined;
    return val.toUpperCase().replace(/\s/g, "");
  })
  .refine((val) => !val || IBAN_PATTERN.test(val), {
    message: "Ongeldig IBAN-nummer",
  });

// Leverancier schema
export const leverancierSchema = z.object({
  naam: z.string().min(1, "Naam is verplicht"),
  contactpersoon: optionalString,
  email: optionalEmail,
  telefoon: optionalPhone,
  adres: optionalString,
  postcode: optionalPostcode,
  plaats: optionalString,
  kvkNummer: optionalKvk,
  btwNummer: optionalBtw,
  iban: optionalIban,
  betalingstermijn: z
    .number({ error: "Voer een getal in" })
    .min(0, "Betalingstermijn mag niet negatief zijn")
    .optional(),
});

export type LeverancierFormData = z.infer<typeof leverancierSchema>;
