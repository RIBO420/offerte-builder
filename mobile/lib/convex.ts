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

// Convex client instantie
// Wordt geinitialiseerd als CONVEX_URL beschikbaar is
let convexClient: ConvexReactClient | null = null;

export function getConvexClient(): ConvexReactClient {
  if (!convexClient) {
    if (!CONVEX_URL) {
      throw new Error(
        'EXPO_PUBLIC_CONVEX_URL is niet geconfigureerd. ' +
        'Voeg deze toe aan je .env.local bestand.'
      );
    }
    convexClient = new ConvexReactClient(CONVEX_URL);
  }
  return convexClient;
}

// Type-safe API reference
// Dit importeert de gegenereerde API types van de Convex backend
export { api } from '../convex/_generated/api';

// Export de ConvexReactClient type voor TypeScript
export type { ConvexReactClient };
