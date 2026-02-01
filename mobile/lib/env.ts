/**
 * Environment Variables Configuration
 *
 * Dit bestand centraliseert alle environment variables voor de mobile app.
 * Expo vereist dat environment variables beginnen met EXPO_PUBLIC_.
 */

// Convex URL - verplicht voor database connectie
export const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL as string;

// Clerk Publishable Key - voor authenticatie
// Dit is dezelfde key als de web app (Clerk ondersteunt meerdere platforms per app)
export const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY as string;

// Validatie functie voor development
export function validateEnv() {
  const missingVars: string[] = [];
  const warnings: string[] = [];

  if (!CONVEX_URL) {
    missingVars.push('EXPO_PUBLIC_CONVEX_URL');
  }

  if (!CLERK_PUBLISHABLE_KEY) {
    warnings.push('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY');
  }

  if (missingVars.length > 0) {
    console.error(
      `[ENV] Ontbrekende verplichte environment variables: ${missingVars.join(', ')}\n` +
      'Maak een .env.local bestand aan met de juiste waarden.'
    );
  }

  if (warnings.length > 0) {
    console.warn(
      `[ENV] Ontbrekende optionele environment variables: ${warnings.join(', ')}\n` +
      'Sommige features werken mogelijk niet.'
    );
  }

  return missingVars.length === 0;
}

/**
 * Check of authenticatie is geconfigureerd
 */
export function isAuthConfigured(): boolean {
  return !!CLERK_PUBLISHABLE_KEY;
}

/**
 * Check of de database is geconfigureerd
 */
export function isDatabaseConfigured(): boolean {
  return !!CONVEX_URL;
}
