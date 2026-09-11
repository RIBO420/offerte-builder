import { z } from "zod";

// Shared regex patterns - must match convex/validators.ts
export const PHONE_PATTERN = /^(\+31|0)[1-9]\d{1,8}$/;
export const POSTCODE_PATTERN = /^\d{4}\s?[A-Za-z]{2}$/;

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

// Postcodeveld — hergebruikt door het hoofdadres en het uitvoeradres.
const verplichtePostcode = z
  .string()
  .min(1, "Postcode is verplicht")
  .transform((val) => val.toUpperCase().replace(/^(\d{4})\s?([A-Z]{2})$/, "$1 $2"))
  .refine((val) => POSTCODE_PATTERN.test(val), {
    message: "Ongeldige postcode (bijv. 1234 AB)",
  });

// Optioneel vrij tekstveld met een maximum; leeg telt als niet ingevuld.
const optioneleTekst = (max: number, label: string) =>
  z
    .string()
    .optional()
    .transform((val) => (val?.trim() === "" ? undefined : val?.trim()))
    .refine((val) => !val || val.length <= max, {
      message: `${label} mag maximaal ${max} tekens zijn`,
    });

/**
 * Afwijkend uitvoeradres. Optioneel als geheel, maar gaat het mee, dan moeten
 * alle drie de velden kloppen — een half uitvoeradres stuurt de ploeg de
 * verkeerde kant op. Het hoofdadres hierboven blijft het factuuradres.
 */
export const uitvoerAdresSchema = z.object({
  adres: z.string().min(1, "Adres is verplicht"),
  postcode: verplichtePostcode,
  plaats: z.string().min(1, "Plaats is verplicht"),
});

export const klantSchema = z.object({
  // `naam` blijft verplicht en is de weergavenaam; formulieren berekenen hem
  // met `samengesteldeNaam` uit voor- en achternaam vóór submit.
  naam: z.string().min(1, "Naam is verplicht"),
  voornaam: optioneleTekst(100, "Voornaam"),
  achternaam: optioneleTekst(100, "Achternaam"),
  adres: z.string().min(1, "Adres is verplicht"),
  postcode: verplichtePostcode,
  plaats: z.string().min(1, "Plaats is verplicht"),
  // Wissen kan dit schema niet uitdrukken: `undefined` laat het veld bij
  // `klanten.update` ongemoeid. Het wissignaal van de backend is
  // `{ adres: "", postcode: "", plaats: "" }`; formulieren bouwen die payload
  // ná validatie, wanneer de gebruiker het uitvoeradres heeft leeggemaakt.
  uitvoerAdres: uitvoerAdresSchema.optional(),
  email: optionalEmail,
  telefoon: optionalPhone,
  telefoon2: optionalPhone,
  bijzonderheden: optioneleTekst(2000, "Bijzonderheden"),
});

export type KlantFormData = z.infer<typeof klantSchema>;
