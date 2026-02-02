/**
 * Convex Validators for Scope Data
 * 
 * These validators provide runtime type checking for scope data in Convex.
 * They mirror the Zod schemas used in the frontend.
 */

import { v } from "convex/values";

// ==================== COMMON TYPES ====================

export const bereikbaarheidValidator = v.union(
  v.literal("goed"),
  v.literal("beperkt"),
  v.literal("slecht")
);

export const achterstalligingValidator = v.union(
  v.literal("laag"),
  v.literal("gemiddeld"),
  v.literal("hoog")
);

export const intensiteitValidator = v.union(
  v.literal("weinig"),
  v.literal("gemiddeld"),
  v.literal("veel")
);

export const snijwerkValidator = v.union(
  v.literal("laag"),
  v.literal("gemiddeld"),
  v.literal("hoog")
);

// ==================== AANLEG SCOPE VALIDATORS ====================

export const grondwerkValidator = v.object({
  oppervlakte: v.number(),
  diepte: v.union(v.literal("licht"), v.literal("standaard"), v.literal("zwaar")),
  afvoerGrond: v.boolean(),
});

export const bestratingValidator = v.object({
  oppervlakte: v.number(),
  typeBestrating: v.union(v.literal("tegel"), v.literal("klinker"), v.literal("natuursteen")),
  snijwerk: snijwerkValidator,
  onderbouw: v.object({
    type: v.union(v.literal("zandbed"), v.literal("zand_fundering"), v.literal("zware_fundering")),
    dikteOnderlaag: v.number(),
    opsluitbanden: v.boolean(),
  }),
});

export const bordersValidator = v.object({
  oppervlakte: v.number(),
  beplantingsintensiteit: intensiteitValidator,
  bodemverbetering: v.boolean(),
  afwerking: v.union(v.literal("geen"), v.literal("schors"), v.literal("grind")),
});

export const grasValidator = v.object({
  oppervlakte: v.number(),
  type: v.union(v.literal("zaaien"), v.literal("graszoden")),
  ondergrond: v.union(v.literal("bestaand"), v.literal("nieuw")),
  afwateringNodig: v.boolean(),
});

export const houtwerkValidator = v.object({
  typeHoutwerk: v.union(v.literal("schutting"), v.literal("vlonder"), v.literal("pergola")),
  afmeting: v.number(),
  fundering: v.union(v.literal("standaard"), v.literal("zwaar")),
});

export const waterElektraValidator = v.object({
  verlichting: v.union(v.literal("geen"), v.literal("basis"), v.literal("uitgebreid")),
  aantalPunten: v.number(),
  sleuvenNodig: v.boolean(),
});

export const specialsItemValidator = v.object({
  type: v.union(v.literal("jacuzzi"), v.literal("sauna"), v.literal("prefab")),
  omschrijving: v.string(),
});

export const specialsValidator = v.object({
  items: v.array(specialsItemValidator),
});

// Combined aanleg scope data validator
export const aanlegScopeDataValidator = v.object({
  grondwerk: v.optional(grondwerkValidator),
  bestrating: v.optional(bestratingValidator),
  borders: v.optional(bordersValidator),
  gras: v.optional(grasValidator),
  houtwerk: v.optional(houtwerkValidator),
  water_elektra: v.optional(waterElektraValidator),
  specials: v.optional(specialsValidator),
});

// ==================== ONDERHOUD SCOPE VALIDATORS ====================

export const grasOnderhoudValidator = v.object({
  grasAanwezig: v.boolean(),
  grasOppervlakte: v.number(),
  maaien: v.boolean(),
  kantenSteken: v.boolean(),
  verticuteren: v.boolean(),
  afvoerGras: v.boolean(),
});

export const bordersOnderhoudValidator = v.object({
  borderOppervlakte: v.number(),
  onderhoudsintensiteit: intensiteitValidator,
  onkruidVerwijderen: v.boolean(),
  snoeiInBorders: v.union(v.literal("geen"), v.literal("licht"), v.literal("zwaar")),
  bodem: v.union(v.literal("open"), v.literal("bedekt")),
  afvoerGroenafval: v.boolean(),
});

export const heggenOnderhoudValidator = v.object({
  lengte: v.number(),
  hoogte: v.number(),
  breedte: v.number(),
  snoei: v.union(v.literal("zijkanten"), v.literal("bovenkant"), v.literal("beide")),
  afvoerSnoeisel: v.boolean(),
});

export const bomenOnderhoudValidator = v.object({
  aantalBomen: v.number(),
  snoei: v.union(v.literal("licht"), v.literal("zwaar")),
  hoogteklasse: v.union(v.literal("laag"), v.literal("middel"), v.literal("hoog")),
  afvoer: v.boolean(),
});

export const overigeOnderhoudValidator = v.object({
  bladruimen: v.boolean(),
  terrasReinigen: v.boolean(),
  terrasOppervlakte: v.optional(v.number()),
  onkruidBestrating: v.boolean(),
  bestratingOppervlakte: v.optional(v.number()),
  afwateringControleren: v.boolean(),
  aantalAfwateringspunten: v.optional(v.number()),
  overigNotities: v.optional(v.string()),
  overigUren: v.optional(v.number()),
});

// Combined onderhoud scope data validator
export const onderhoudScopeDataValidator = v.object({
  tuinOppervlakte: v.optional(v.number()), // Algemeen tuinoppervlakte voor onderhoud
  gras: v.optional(grasOnderhoudValidator),
  borders: v.optional(bordersOnderhoudValidator),
  heggen: v.optional(heggenOnderhoudValidator),
  bomen: v.optional(bomenOnderhoudValidator),
  overig: v.optional(overigeOnderhoudValidator),
});

// ==================== COMBINED VALIDATOR ====================

// This validator can handle both aanleg and onderhoud scope data
// The discriminant is the offerte type, but for flexibility we allow both
export const scopeDataValidator = v.union(
  aanlegScopeDataValidator,
  onderhoudScopeDataValidator
);

// ==================== USER ROLE VALIDATORS ====================

/**
 * User roles for role-based access control (RBAC)
 *
 * - admin: Full access to all features, can manage users, medewerkers, and all data
 * - medewerker: Limited access, can only see own data, linked to a medewerker profile
 * - viewer: Read-only access to allowed features
 */
export const userRoleValidator = v.union(
  v.literal("admin"),
  v.literal("medewerker"),
  v.literal("viewer")
);

// ==================== COMMON FIELD VALIDATORS ====================
// These validators mirror the frontend Zod schemas to ensure consistency

/**
 * Dutch phone number pattern: +31 or 0, followed by 1-9, then 1-8 more digits
 * Examples: +31612345678, 0612345678, 020-1234567
 */
export const PHONE_PATTERN = /^(\+31|0)[1-9]\d{1,8}$/;

/**
 * Dutch postcode pattern: 4 digits, optional space, 2 letters
 * Examples: 1234 AB, 1234AB
 */
export const POSTCODE_PATTERN = /^\d{4}\s?[A-Za-z]{2}$/;

/**
 * Dutch KvK (Chamber of Commerce) number: exactly 8 digits
 */
export const KVK_PATTERN = /^\d{8}$/;

/**
 * Dutch BTW (VAT) number: NL + 9 digits + B + 2 digits
 * Example: NL123456789B01
 */
export const BTW_PATTERN = /^NL\d{9}B\d{2}$/;

/**
 * IBAN pattern: 2 letters + 2 digits + 4 alphanumeric + 7 digits + up to 16 alphanumeric
 */
export const IBAN_PATTERN = /^[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}$/;

/**
 * Helper to validate string against a pattern.
 * Returns true if value is undefined/null/empty OR matches pattern.
 * This allows optional fields to pass validation when empty.
 */
export function validateOptionalPattern(
  value: string | undefined | null,
  pattern: RegExp
): boolean {
  if (!value || value.trim() === "") return true;
  return pattern.test(value);
}

/**
 * Helper to validate a required string against a pattern.
 * Returns true only if value is non-empty AND matches pattern.
 */
export function validateRequiredPattern(
  value: string | undefined | null,
  pattern: RegExp
): boolean {
  if (!value || value.trim() === "") return false;
  return pattern.test(value);
}

/**
 * Validates email format. Returns true if undefined/empty or valid email.
 */
export function validateOptionalEmail(
  value: string | undefined | null
): boolean {
  if (!value || value.trim() === "") return true;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(value);
}

/**
 * Validates a number is positive (> 0)
 */
export function validatePositiveNumber(value: number | undefined): boolean {
  return value !== undefined && value > 0;
}

/**
 * Validates a number is non-negative (>= 0)
 */
export function validateNonNegativeNumber(value: number | undefined): boolean {
  return value !== undefined && value >= 0;
}

/**
 * Validation error messages in Dutch (for consistent error messaging)
 */
export const VALIDATION_MESSAGES = {
  email: "Ongeldig e-mailadres",
  telefoon:
    "Ongeldig telefoonnummer. Gebruik formaat: 0612345678 of +31612345678",
  postcode: "Ongeldige postcode. Gebruik formaat: 1234 AB",
  kvkNummer: "KvK-nummer moet 8 cijfers bevatten",
  btwNummer: "Ongeldig BTW-nummer. Gebruik formaat: NL123456789B01",
  iban: "Ongeldig IBAN-nummer",
  positiveNumber: "Waarde moet groter zijn dan 0",
  nonNegativeNumber: "Waarde mag niet negatief zijn",
  required: "Dit veld is verplicht",
};

/**
 * Sanitizes optional string fields: converts empty strings to undefined.
 * This ensures consistent handling between frontend and backend.
 */
export function sanitizeOptionalString(
  value: string | undefined | null
): string | undefined {
  if (!value || value.trim() === "") return undefined;
  return value.trim();
}

/**
 * Sanitizes and validates a phone number.
 * Returns undefined if empty, the cleaned value if valid, or throws if invalid.
 */
export function sanitizePhone(value: string | undefined | null): string | undefined {
  const sanitized = sanitizeOptionalString(value);
  if (!sanitized) return undefined;

  // Remove common formatting characters
  const cleaned = sanitized.replace(/[\s\-\(\)]/g, "");

  if (!PHONE_PATTERN.test(cleaned)) {
    throw new Error(VALIDATION_MESSAGES.telefoon);
  }
  return cleaned;
}

/**
 * Sanitizes and validates an email.
 * Returns undefined if empty, the value if valid, or throws if invalid.
 */
export function sanitizeEmail(value: string | undefined | null): string | undefined {
  const sanitized = sanitizeOptionalString(value);
  if (!sanitized) return undefined;

  if (!validateOptionalEmail(sanitized)) {
    throw new Error(VALIDATION_MESSAGES.email);
  }
  return sanitized.toLowerCase();
}

/**
 * Sanitizes and validates a Dutch postcode.
 * Returns undefined if empty, the normalized value if valid, or throws if invalid.
 */
export function sanitizePostcode(value: string | undefined | null): string | undefined {
  const sanitized = sanitizeOptionalString(value);
  if (!sanitized) return undefined;

  // Normalize: uppercase and ensure space between digits and letters
  const normalized = sanitized.toUpperCase().replace(/^(\d{4})\s?([A-Z]{2})$/, "$1 $2");

  if (!POSTCODE_PATTERN.test(normalized)) {
    throw new Error(VALIDATION_MESSAGES.postcode);
  }
  return normalized;
}

/**
 * Validates a required postcode field.
 * Throws if empty or invalid.
 */
export function validateRequiredPostcode(value: string | undefined | null): string {
  if (!value || value.trim() === "") {
    throw new Error(VALIDATION_MESSAGES.required);
  }

  const normalized = value.toUpperCase().replace(/^(\d{4})\s?([A-Z]{2})$/, "$1 $2");

  if (!POSTCODE_PATTERN.test(normalized)) {
    throw new Error(VALIDATION_MESSAGES.postcode);
  }
  return normalized;
}

/**
 * Sanitizes and validates a KvK number.
 * Returns undefined if empty, the value if valid, or throws if invalid.
 */
export function sanitizeKvkNummer(value: string | undefined | null): string | undefined {
  const sanitized = sanitizeOptionalString(value);
  if (!sanitized) return undefined;

  // Remove any spaces or dots
  const cleaned = sanitized.replace(/[\s\.]/g, "");

  if (!KVK_PATTERN.test(cleaned)) {
    throw new Error(VALIDATION_MESSAGES.kvkNummer);
  }
  return cleaned;
}

/**
 * Sanitizes and validates a BTW number.
 * Returns undefined if empty, the value if valid, or throws if invalid.
 */
export function sanitizeBtwNummer(value: string | undefined | null): string | undefined {
  const sanitized = sanitizeOptionalString(value);
  if (!sanitized) return undefined;

  const normalized = sanitized.toUpperCase().replace(/[\s\.]/g, "");

  if (!BTW_PATTERN.test(normalized)) {
    throw new Error(VALIDATION_MESSAGES.btwNummer);
  }
  return normalized;
}

/**
 * Sanitizes and validates an IBAN.
 * Returns undefined if empty, the normalized value if valid, or throws if invalid.
 */
export function sanitizeIban(value: string | undefined | null): string | undefined {
  const sanitized = sanitizeOptionalString(value);
  if (!sanitized) return undefined;

  const normalized = sanitized.toUpperCase().replace(/\s/g, "");

  if (!IBAN_PATTERN.test(normalized)) {
    throw new Error(VALIDATION_MESSAGES.iban);
  }
  return normalized;
}

/**
 * Validates that a number is positive (> 0).
 * Throws if not positive.
 */
export function validatePositive(value: number, fieldName: string = "Waarde"): number {
  if (value <= 0) {
    throw new Error(`${fieldName} moet groter zijn dan 0`);
  }
  return value;
}

/**
 * Validates that a number is non-negative (>= 0).
 * Throws if negative.
 */
export function validateNonNegative(value: number, fieldName: string = "Waarde"): number {
  if (value < 0) {
    throw new Error(`${fieldName} mag niet negatief zijn`);
  }
  return value;
}
