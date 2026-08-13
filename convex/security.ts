/**
 * Security Utilities for Convex
 * @version 2.0 - Fixed: removed setInterval, using lazy cleanup
 *
 * Provides rate limiting, input validation, and file validation utilities.
 * All error messages are in Dutch.
 */


// ============================================
// RATE LIMITING
// ============================================

/**
 * In-memory rate limit storage for Convex functions.
 * Note: In a distributed environment, each instance has its own map.
 * For production, consider using a database-backed solution.
 */
const rateLimitMap = new Map<
  string,
  { count: number; windowStart: number; windowMs: number }
>();

// Clean up expired entries on access (lazy cleanup instead of setInterval).
// De opruiming kijkt naar het vénster van de entry zélf en niet naar een vaste
// minuut: sinds de configurator-limieten een uurvenster gebruiken zou een vaste
// minuut die tellers elke minuut wissen en de limiet feitelijk uitschakelen.
// Voor de bestaande limieten met een venster van 60s is het gedrag identiek.
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now - value.windowStart > value.windowMs) {
      rateLimitMap.delete(key);
    }
  }
}

export interface RateLimitConfig {
  maxRequests: number; // Maximum requests allowed
  windowMs: number; // Time window in milliseconds
  identifier: string; // Unique identifier (e.g., userId, IP, token)
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Timestamp when the window resets
  message?: string;
}

/**
 * Check rate limit for a given identifier.
 * Returns whether the request is allowed and remaining quota.
 */
export function checkRateLimit(config: RateLimitConfig): RateLimitResult {
  // Lazy cleanup of expired entries
  cleanupExpiredEntries();

  const { maxRequests, windowMs, identifier } = config;
  const now = Date.now();
  const key = identifier;

  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    // New window or expired window
    rateLimitMap.set(key, { count: 1, windowStart: now, windowMs });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
    };
  }

  // Within existing window
  if (entry.count >= maxRequests) {
    const resetAt = entry.windowStart + windowMs;
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      message: `Te veel verzoeken. Probeer het over ${Math.ceil((resetAt - now) / 1000)} seconden opnieuw.`,
    };
  }

  // Increment count
  entry.count++;
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.windowStart + windowMs,
  };
}

/**
 * Generieke rate limit voor publieke (niet-geauthenticeerde) endpoints.
 *
 * De sleutel wordt gehasht opgeslagen zodat er geen tokens of e-mailadressen
 * in het geheugen blijven staan. Het namespace-voorvoegsel houdt de emmers van
 * verschillende endpoints gescheiden, zodat drukte op het ene endpoint het
 * andere niet dichtzet.
 */
export function checkPubliekeRateLimit(
  namespace: string,
  sleutel: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  return checkRateLimit({
    maxRequests,
    windowMs,
    identifier: `${namespace}:${hashString(sleutel)}`,
  });
}

/**
 * Rate limit check for public offerte operations (by share token).
 * Prevents brute-force token guessing.
 */
export function checkPublicOfferteRateLimit(
  token: string,
  maxRequests: number = 30,
  windowMs: number = 60000
): RateLimitResult {
  // Use a hash of the token as identifier (don't store actual tokens)
  return checkPubliekeRateLimit(
    "public_offerte",
    token.substring(0, 8),
    maxRequests,
    windowMs
  );
}

// ============================================
// RATE LIMITS PUBLIEKE CONFIGURATOR (audit §3)
// ============================================
//
// De configurator is de klantgerichte instroom van leads: een te strakke
// limiet kost direct omzet. Convex geeft in een mutation/query geen IP-adres,
// dus we begrenzen op twee assen:
//
//  1. per e-mailadres — remt de meest voorkomende spam (één bot die hetzelfde
//     formulier herhaalt) zonder een echte klant te raken;
//  2. globaal — een noodrem tegen een flood met steeds wisselende adressen.
//
// LET OP: de teller staat in het geheugen van één Convex-instantie. Bij
// meerdere instanties is de effectieve limiet dus hoger; het blijft een rem
// tegen ongelimiteerde spam, geen harde garantie.

/**
 * Vijf aanvragen per e-mailadres per uur. Een echte klant vraagt in het
 * ergste geval één offerte per configurator-type (gazon, boomschors,
 * verticuteren) plus een correctie na een typefout — dat is vier. Vijf laat
 * daar nog ruimte boven en snijdt tegelijk elke herhaalbot af.
 */
export const CONFIGURATOR_MAX_PER_EMAIL = 5;
export const CONFIGURATOR_EMAIL_VENSTER_MS = 60 * 60 * 1000; // 1 uur

/**
 * Honderd aanvragen per uur over álle bezoekers samen. Top Tuinen krijgt in de
 * praktijk een handvol leads per dag; honderd per uur is ruim twee ordes van
 * grootte daarboven en wordt door normaal verkeer nooit geraakt. Het plafond
 * bestaat puur om een flood met wisselende e-mailadressen af te toppen.
 */
export const CONFIGURATOR_MAX_GLOBAAL = 100;
export const CONFIGURATOR_GLOBAAL_VENSTER_MS = 60 * 60 * 1000; // 1 uur

/**
 * Honderdtwintig referentie-opzoekingen per minuut over alle bezoekers samen.
 * De statuspagina doet één lookup per bezoek, dus dit raakt geen klant, maar
 * het maakt het brute-forcen van `CFG-YYYYMMDD-XXXX` (10.000 varianten per
 * dag) onbegonnen werk in plaats van een kwestie van seconden.
 */
export const REFERENTIE_LOOKUP_MAX_GLOBAAL = 120;
export const REFERENTIE_LOOKUP_VENSTER_MS = 60000; // 1 minuut

/**
 * Rate limit per e-mailadres voor het publieke configuratorformulier.
 */
export function checkConfiguratorEmailRateLimit(
  klantEmail: string
): RateLimitResult {
  return checkPubliekeRateLimit(
    "configurator_email",
    klantEmail.trim().toLowerCase(),
    CONFIGURATOR_MAX_PER_EMAIL,
    CONFIGURATOR_EMAIL_VENSTER_MS
  );
}

/**
 * Globale noodrem voor het publieke configuratorformulier.
 */
export function checkConfiguratorGlobaalRateLimit(): RateLimitResult {
  return checkPubliekeRateLimit(
    "configurator_globaal",
    "alle",
    CONFIGURATOR_MAX_GLOBAAL,
    CONFIGURATOR_GLOBAAL_VENSTER_MS
  );
}

/**
 * Globale rem op het opzoeken van aanvragen via referentienummer, tegen
 * enumeratie van referenties.
 */
export function checkReferentieLookupRateLimit(): RateLimitResult {
  return checkPubliekeRateLimit(
    "configurator_referentie",
    "alle",
    REFERENTIE_LOOKUP_MAX_GLOBAAL,
    REFERENTIE_LOOKUP_VENSTER_MS
  );
}

// ============================================
// RATE LIMIT REISTIJDBEREKENING (Google Maps)
// ============================================
//
// `GOOGLE_MAPS_API_KEY` is één deployment-brede sleutel: de rekening is van de
// app-eigenaar, niet van de tenant die de calls uitlokt. De reistijdcache dempt
// herhaling, maar wie adressen blijft wijzigen mint steeds nieuwe cachesleutels
// en dus steeds nieuwe betaalde calls. Deze rem begrenst dat per ingelogde
// gebruiker.

/**
 * Tien reistijdberekeningen per gebruiker per minuut. Een planner opent in de
 * praktijk een handvol dagkaarten achter elkaar; tien laat dat ruim toe en
 * knipt het herhaald triggeren in een script af.
 */
export const REISTIJD_MAX_PER_GEBRUIKER = 10;
export const REISTIJD_VENSTER_MS = 60000; // 1 minuut

/**
 * Rate limit op het (bij)berekenen van reistijden, per Clerk-identiteit.
 */
export function checkReistijdRateLimit(clerkSubject: string): RateLimitResult {
  return checkPubliekeRateLimit(
    "reistijd_berekening",
    clerkSubject,
    REISTIJD_MAX_PER_GEBRUIKER,
    REISTIJD_VENSTER_MS
  );
}

// ============================================
// RATE LIMIT BEDRIJFSZOEKEN (Google Places)
// ============================================
//
// Zelfde overweging als bij reistijd: Places wordt per aanroep afgerekend op
// dezelfde deployment-brede sleutel. Zoeken gebeurt terwijl je typt, dus dit is
// veel gevoeliger voor een lus dan de dagkaart. De client dempt al met een
// debounce; deze rem is de harde bovengrens per ingelogde gebruiker.

/**
 * Dertig zoekopdrachten per gebruiker per minuut. Eén klant opzoeken kost in
 * de praktijk twee tot vier calls (typen + details ophalen); dertig laat een
 * paar klanten achter elkaar ruim toe en knipt een doorgeslagen lus af.
 */
export const PLACES_MAX_PER_GEBRUIKER = 30;
export const PLACES_VENSTER_MS = 60000; // 1 minuut

/**
 * Rate limit op het zoeken van bedrijfsgegevens, per Clerk-identiteit.
 */
export function checkPlacesRateLimit(clerkSubject: string): RateLimitResult {
  return checkPubliekeRateLimit(
    "places_zoeken",
    clerkSubject,
    PLACES_MAX_PER_GEBRUIKER,
    PLACES_VENSTER_MS
  );
}

/**
 * Simple string hash for creating identifiers.
 * Not cryptographically secure, but sufficient for rate limiting keys.
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// ============================================
// FILE VALIDATION
// ============================================

/**
 * Allowed MIME types for file uploads.
 * Only images and PDFs are allowed.
 */
export const ALLOWED_MIME_TYPES = [
  // Images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  // PDFs
  "application/pdf",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/**
 * Dangerous file extensions that should always be rejected.
 */
export const DANGEROUS_EXTENSIONS = [
  ".exe",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".scr",
  ".pif",
  ".js",
  ".jse",
  ".vbs",
  ".vbe",
  ".wsf",
  ".wsh",
  ".ps1",
  ".psm1",
  ".psd1",
  ".html",
  ".htm",
  ".xhtml",
  ".svg",
  ".svgz",
  ".php",
  ".asp",
  ".aspx",
  ".jsp",
  ".sh",
  ".bash",
  ".zsh",
  ".py",
  ".rb",
  ".pl",
  ".dll",
  ".so",
  ".dylib",
] as const;

/**
 * Maximum file size in bytes (10MB).
 */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Maximum signature size in bytes (500KB).
 */
export const MAX_SIGNATURE_SIZE_BYTES = 500 * 1024; // 500KB

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a file for upload.
 * Checks file size, MIME type, and extension.
 */
export function validateFile(
  fileName: string,
  mimeType: string,
  fileSize: number
): FileValidationResult {
  // Check file size
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    const maxMb = MAX_FILE_SIZE_BYTES / (1024 * 1024);
    return {
      valid: false,
      error: `Bestand is te groot. Maximale grootte is ${maxMb}MB.`,
    };
  }

  // Check for dangerous extensions
  const lowerFileName = fileName.toLowerCase();
  for (const ext of DANGEROUS_EXTENSIONS) {
    if (lowerFileName.endsWith(ext)) {
      return {
        valid: false,
        error: `Bestandstype ${ext} is niet toegestaan om veiligheidsredenen.`,
      };
    }
  }

  // Check MIME type
  const lowerMimeType = mimeType.toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(lowerMimeType as AllowedMimeType)) {
    return {
      valid: false,
      error: `Bestandstype "${mimeType}" is niet toegestaan. Alleen afbeeldingen (JPEG, PNG, GIF, WebP) en PDF bestanden zijn toegestaan.`,
    };
  }

  // Additional check for SVG disguised as image
  if (
    lowerMimeType.includes("svg") ||
    lowerFileName.endsWith(".svg") ||
    lowerFileName.endsWith(".svgz")
  ) {
    return {
      valid: false,
      error: "SVG bestanden zijn niet toegestaan om veiligheidsredenen.",
    };
  }

  return { valid: true };
}

/**
 * Get the file extension from a filename.
 */
export function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1) return "";
  return fileName.substring(lastDot).toLowerCase();
}

// ============================================
// SIGNATURE VALIDATION
// ============================================

/**
 * Validate a base64 signature.
 * Checks size and format.
 */
export function validateSignature(signature: string): FileValidationResult {
  // Check if it's a valid base64 data URL
  if (!signature.startsWith("data:image/")) {
    return {
      valid: false,
      error: "Handtekening moet een geldig afbeeldingsformaat zijn.",
    };
  }

  // Check for allowed image types in data URL
  const allowedImageTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
  const mimeMatch = signature.match(/^data:([^;]+);/);
  if (!mimeMatch || !allowedImageTypes.includes(mimeMatch[1])) {
    return {
      valid: false,
      error: "Handtekening moet een PNG, JPEG of WebP afbeelding zijn.",
    };
  }

  // Estimate base64 decoded size
  // Remove data URL prefix and calculate
  const base64Part = signature.split(",")[1];
  if (!base64Part) {
    return {
      valid: false,
      error: "Ongeldige handtekening formaat.",
    };
  }

  // Base64 encoded data is approximately 4/3 the size of the original
  const estimatedSize = (base64Part.length * 3) / 4;

  if (estimatedSize > MAX_SIGNATURE_SIZE_BYTES) {
    const maxKb = MAX_SIGNATURE_SIZE_BYTES / 1024;
    return {
      valid: false,
      error: `Handtekening is te groot. Maximale grootte is ${maxKb}KB.`,
    };
  }

  // Basic check that it looks like valid base64
  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  if (!base64Regex.test(base64Part)) {
    return {
      valid: false,
      error: "Ongeldige handtekening data.",
    };
  }

  return { valid: true };
}

// ============================================
// INPUT SANITIZATION
// ============================================

/**
 * Sanitize a string input by trimming whitespace and limiting length.
 */
export function sanitizeString(
  input: string | undefined | null,
  maxLength: number = 10000
): string {
  if (!input) return "";
  return input.trim().substring(0, maxLength);
}

/**
 * Validate that a required string field is present and non-empty.
 */
export function validateRequiredString(
  value: string | undefined | null,
  fieldName: string
): FileValidationResult {
  if (!value || value.trim().length === 0) {
    return {
      valid: false,
      error: `${fieldName} is verplicht.`,
    };
  }
  return { valid: true };
}
