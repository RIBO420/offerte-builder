/**
 * useAuth Hook
 *
 * Wrapper hook voor Clerk authenticatie met extra functionaliteit
 * specifiek voor de Top Tuinen mobile app.
 */

import { useCallback, useMemo } from 'react';
import { useAuth as useClerkAuth, useUser, useClerk } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import {
  disableBiometric,
  setupBiometric,
  isBiometricEnabled,
  isBiometricAvailable,
} from '@/lib/auth/biometric';

export interface AuthState {
  /** Of de authenticatie data is geladen */
  isLoaded: boolean;
  /** Of de gebruiker is ingelogd */
  isSignedIn: boolean;
  /** Clerk user ID */
  userId: string | null;
  /** User object met details */
  user: ReturnType<typeof useUser>['user'];
  /** Session ID */
  sessionId: string | null;
  /** Organization ID (als actief) */
  orgId: string | null;
  /** Organization rol */
  orgRole: string | null;
}

export interface AuthActions {
  /** Log de gebruiker uit */
  signOut: () => Promise<void>;
  /** Haal een verse token op */
  getToken: () => Promise<string | null>;
  /** Setup biometric login */
  enableBiometric: () => Promise<boolean>;
  /** Disable biometric login */
  disableBiometricLogin: () => Promise<void>;
  /** Check of biometric is enabled */
  checkBiometricEnabled: () => Promise<boolean>;
}

export type UseAuthReturn = AuthState & AuthActions;

/**
 * Custom useAuth hook die Clerk auth combineert met extra functionaliteit
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isSignedIn, user, signOut, enableBiometric } = useAuth();
 *
 *   if (!isSignedIn) {
 *     return <LoginScreen />;
 *   }
 *
 *   return (
 *     <View>
 *       <Text>Welkom, {user?.firstName}!</Text>
 *       <Button onPress={signOut} title="Uitloggen" />
 *     </View>
 *   );
 * }
 * ```
 */
export function useAppAuth(): UseAuthReturn {
  const router = useRouter();
  const clerk = useClerk();
  const { user, isLoaded: userLoaded } = useUser();

  const {
    isLoaded,
    isSignedIn,
    userId,
    sessionId,
    orgId,
    orgRole,
    getToken: clerkGetToken,
  } = useClerkAuth();

  /**
   * Log de gebruiker uit en reset biometric
   */
  const signOut = useCallback(async () => {
    try {
      // Disable biometric bij uitloggen
      await disableBiometric();

      // Sign out via Clerk
      await clerk.signOut();

      // Navigeer naar login scherm
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('[useAuth] Fout bij uitloggen:', error);
      throw error;
    }
  }, [clerk, router]);

  /**
   * Haal een verse authentication token op
   */
  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const token = await clerkGetToken();
      return token;
    } catch (error) {
      console.error('[useAuth] Fout bij ophalen token:', error);
      return null;
    }
  }, [clerkGetToken]);

  /**
   * Activeer biometric login voor snelle re-login
   */
  const enableBiometric = useCallback(async (): Promise<boolean> => {
    try {
      // Check of biometrics beschikbaar is
      const available = await isBiometricAvailable();
      if (!available) {
        console.log('[useAuth] Biometric niet beschikbaar op dit device');
        return false;
      }

      // Haal huidige token op
      const token = await getToken();
      if (!token || !userId) {
        console.log('[useAuth] Geen token of userId beschikbaar voor biometric setup');
        return false;
      }

      // Setup biometric met huidige sessie
      const success = await setupBiometric(token, userId);
      return success;
    } catch (error) {
      console.error('[useAuth] Fout bij activeren biometric:', error);
      return false;
    }
  }, [getToken, userId]);

  /**
   * Deactiveer biometric login
   */
  const disableBiometricLogin = useCallback(async (): Promise<void> => {
    await disableBiometric();
  }, []);

  /**
   * Check of biometric login is ingeschakeld
   */
  const checkBiometricEnabled = useCallback(async (): Promise<boolean> => {
    return await isBiometricEnabled();
  }, []);

  // Memoize de return value voor performance
  return useMemo(
    () => ({
      // State
      isLoaded: isLoaded && userLoaded,
      isSignedIn: isSignedIn ?? false,
      userId: userId ?? null,
      user: user ?? null,
      sessionId: sessionId ?? null,
      orgId: orgId ?? null,
      orgRole: orgRole ?? null,

      // Actions
      signOut,
      getToken,
      enableBiometric,
      disableBiometricLogin,
      checkBiometricEnabled,
    }),
    [
      isLoaded,
      userLoaded,
      isSignedIn,
      userId,
      user,
      sessionId,
      orgId,
      orgRole,
      signOut,
      getToken,
      enableBiometric,
      disableBiometricLogin,
      checkBiometricEnabled,
    ]
  );
}

// Default export voor convenience
export default useAppAuth;
