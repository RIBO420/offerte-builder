/**
 * Security Utilities for Convex
 *
 * Provides rate limiting, input validation, and file validation utilities.
 * All error messages are in Dutch.
 */

import { MutationCtx, QueryCtx } from "./_generated/server";

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
  { count: number; windowStart: number }
>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now - value.windowStart > 60000) {
      // Remove entries older than 1 minute
      rateLimitMap.delete(key);
    }
  }
}, 300000);

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
  const { maxRequests, windowMs, identifier } = config;
  const now = Date.now();
  const key = identifier;

  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    // New window or expired window
    rateLimitMap.set(key, { count: 1, windowStart: now });
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
 * Rate limit check for public offerte operations (by share token).
 * Prevents brute-force token guessing.
 */
export function checkPublicOfferteRateLimit(
  token: string,
  maxRequests: number = 30,
  windowMs: number = 60000
): RateLimitResult {
  // Use a hash of the token as identifier (don't store actual tokens)
  const identifier = `public_offerte:${hashString(token.substring(0, 8))}`;
  return checkRateLimit({ maxRequests, windowMs, identifier });
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
