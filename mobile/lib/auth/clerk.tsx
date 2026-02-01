/**
 * Clerk Authentication Setup voor Top Tuinen Mobile App
 *
 * Dit bestand bevat de ClerkProvider setup met tokenCache voor
 * veilige opslag van authenticatie tokens via expo-secure-store.
 */

import React from 'react';
import * as SecureStore from 'expo-secure-store';
import { ClerkProvider as BaseClerkProvider, ClerkLoaded } from '@clerk/clerk-expo';
import { tokenCache as clerkTokenCache } from '@clerk/clerk-expo/token-cache';
import { CLERK_PUBLISHABLE_KEY } from '../env';

/**
 * Custom token cache implementatie met expo-secure-store
 * Dit zorgt voor veilige opslag van tokens op het device
 *
 * Note: We gebruiken de ingebouwde tokenCache van @clerk/clerk-expo
 * in de provider, maar deze custom implementatie kan gebruikt worden
 * voor extra functionaliteit indien nodig.
 */
export const tokenCache = {
  async getToken(key: string): Promise<string | null> {
    try {
      const item = await SecureStore.getItemAsync(key);
      if (item) {
        console.log(`[TokenCache] Token opgehaald voor key: ${key.substring(0, 10)}...`);
      }
      return item;
    } catch (error) {
      console.error('[TokenCache] Fout bij ophalen token:', error);
      // Bij fout, verwijder de corrupte token
      await SecureStore.deleteItemAsync(key);
      return null;
    }
  },

  async saveToken(key: string, token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, token, {
        // iOS only: token is alleen toegankelijk als device unlocked is
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
      });
      console.log(`[TokenCache] Token opgeslagen voor key: ${key.substring(0, 10)}...`);
    } catch (error) {
      console.error('[TokenCache] Fout bij opslaan token:', error);
    }
  },

  async clearToken(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
      console.log(`[TokenCache] Token verwijderd voor key: ${key.substring(0, 10)}...`);
    } catch (error) {
      console.error('[TokenCache] Fout bij verwijderen token:', error);
    }
  },
};

interface ClerkProviderProps {
  children: React.ReactNode;
}

/**
 * ClerkProvider wrapper component
 *
 * Wrap je app met deze provider om Clerk authenticatie te activeren.
 * Gebruikt de ingebouwde tokenCache van @clerk/clerk-expo voor optimale werking.
 *
 * @example
 * ```tsx
 * <ClerkProviderWrapper>
 *   <App />
 * </ClerkProviderWrapper>
 * ```
 */
export function ClerkProviderWrapper({ children }: ClerkProviderProps) {
  // Als er geen publishable key is, render gewoon de children
  if (!CLERK_PUBLISHABLE_KEY) {
    console.warn('[Clerk] Geen publishable key gevonden, authenticatie is uitgeschakeld');
    return <>{children}</>;
  }

  return (
    <BaseClerkProvider
      tokenCache={clerkTokenCache}
      publishableKey={CLERK_PUBLISHABLE_KEY}
    >
      <ClerkLoaded>
        {children}
      </ClerkLoaded>
    </BaseClerkProvider>
  );
}

// Re-export Clerk hooks en componenten voor gemak
export { useAuth, useUser, useSignIn, useSignUp, useClerk } from '@clerk/clerk-expo';
export { ClerkLoaded, ClerkLoading } from '@clerk/clerk-expo';
