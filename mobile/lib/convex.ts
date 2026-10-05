/**
 * Convex Client Configuration
 *
 * Dit bestand configureert de Convex client voor de mobile app.
 * Het gebruikt dezelfde backend als de web app.
 */

import { ConvexReactClient } from 'convex/react';
import { CONVEX_URL } from './env';

// Re-export hooks van convex/react voor gemak
export { useQuery, useMutation, useAction, useConvex } from 'convex/react';

// Geen singleton: de provider maakt een client per Clerk-sessie en organisatie.
export function maakConvexClient(): ConvexReactClient {
  if (!CONVEX_URL) throw new Error('EXPO_PUBLIC_CONVEX_URL is niet geconfigureerd.');
  return new ConvexReactClient(CONVEX_URL);
}

// Type-safe API reference
// Dit importeert de gegenereerde API types van de Convex backend
export { api } from '../convex/_generated/api';

// Export de ConvexReactClient type voor TypeScript
export type { ConvexReactClient };
