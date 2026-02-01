/**
 * Authentication Hooks voor Top Tuinen Mobile App
 *
 * Dit bestand bevat React hooks voor authenticatie en session management.
 * Integreert met Clerk voor authenticatie en expo-secure-store voor veilige opslag.
 */

import { useEffect, useCallback, useState } from 'react';
import { useAuth, useUser, useClerk } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import {
  isBiometricAvailable,
  getBiometricType,
  authenticateWithBiometric,
} from './biometric';
import type {
  AuthSessionState,
  BiometricAuthState,
  RequireAuthState,
} from './types';
import { AUTH_STORAGE_KEYS, SESSION_CONFIG } from './types';

/**
 * Hook voor session management
 *
 * Controleert of de huidige sessie geldig is en automatisch uitloggen
 * na MAX_SESSION_DAYS dagen inactiviteit.
 *
 * @returns Session state met validatie status, loading state en user
 *
 * @example
 * ```tsx
 * function ProtectedScreen() {
 *   const { isSessionValid, isLoaded, user } = useAuthSession();
 *
 *   if (!isLoaded) return <LoadingScreen />;
 *   if (!isSessionValid) return null; // Redirect happens automatically
 *
 *   return <WelcomeMessage user={user} />;
 * }
 * ```
 */
export function useAuthSession(): AuthSessionState {
  const { isSignedIn, isLoaded, signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [isSessionValid, setIsSessionValid] = useState(false);

  useEffect(() => {
    async function checkSession() {
      if (!isLoaded) return;

      if (!isSignedIn) {
        setIsSessionValid(false);
        return;
      }

      try {
        // Check last login timestamp
        const lastLogin = await SecureStore.getItemAsync(AUTH_STORAGE_KEYS.LAST_LOGIN);
        if (lastLogin) {
          const daysSinceLogin =
            (Date.now() - parseInt(lastLogin, 10)) / (1000 * 60 * 60 * 24);
          if (daysSinceLogin > SESSION_CONFIG.MAX_SESSION_DAYS) {
            console.log('[AuthSession] Sessie verlopen, uitloggen...');
            await signOut();
            setIsSessionValid(false);
            router.replace('/(auth)/login');
            return;
          }
        }

        // Update last login timestamp
        await SecureStore.setItemAsync(
          AUTH_STORAGE_KEYS.LAST_LOGIN,
          Date.now().toString()
        );
        setIsSessionValid(true);
      } catch (error) {
        console.error('[AuthSession] Fout bij controleren sessie:', error);
        setIsSessionValid(false);
      }
    }

    checkSession();
  }, [isSignedIn, isLoaded, signOut, router]);

  return { isSessionValid, isLoaded, user };
}

/**
 * Hook voor biometric authenticatie
 *
 * Biedt toegang tot biometric authenticatie (Face ID / Touch ID) functies.
 * Controleert automatisch of biometrics beschikbaar is bij mount.
 *
 * @returns Biometric state met beschikbaarheid, type en authenticate functie
 *
 * @example
 * ```tsx
 * function BiometricLogin() {
 *   const { biometricAvailable, biometricType, authenticate } = useBiometricAuth();
 *
 *   const handleBiometricLogin = async () => {
 *     const result = await authenticate();
 *     if (result.success) {
 *       // Handle successful biometric login
 *     }
 *   };
 *
 *   if (!biometricAvailable) return null;
 *
 *   return (
 *     <Button onPress={handleBiometricLogin}>
 *       Log in met {biometricType === 'face' ? 'Face ID' : 'Touch ID'}
 *     </Button>
 *   );
 * }
 * ```
 */
export function useBiometricAuth(): BiometricAuthState {
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<'face' | 'fingerprint' | null>(null);

  useEffect(() => {
    async function checkBiometricAvailability() {
      try {
        const available = await isBiometricAvailable();
        setBiometricAvailable(available);

        if (available) {
          const type = await getBiometricType();
          setBiometricType(type);
        }
      } catch (error) {
        console.error('[BiometricAuth] Fout bij controleren beschikbaarheid:', error);
        setBiometricAvailable(false);
        setBiometricType(null);
      }
    }

    checkBiometricAvailability();
  }, []);

  const authenticate = useCallback(async () => {
    return authenticateWithBiometric();
  }, []);

  return { biometricAvailable, biometricType, authenticate };
}

/**
 * Hook voor automatische token refresh
 *
 * Vernieuwt de Clerk token elke 50 seconden om sessie actief te houden.
 * Start automatisch bij mount en stopt bij unmount.
 *
 * @example
 * ```tsx
 * function App() {
 *   // Token wordt automatisch vernieuwd in de achtergrond
 *   useTokenRefresh();
 *
 *   return <MainApp />;
 * }
 * ```
 */
export function useTokenRefresh(): void {
  const { getToken } = useAuth();

  useEffect(() => {
    // Refresh token elke 50 seconden
    const interval = setInterval(async () => {
      try {
        await getToken({ skipCache: true });
        console.log('[TokenRefresh] Token succesvol vernieuwd');
      } catch (error) {
        console.error('[TokenRefresh] Token refresh mislukt:', error);
      }
    }, SESSION_CONFIG.TOKEN_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [getToken]);
}

/**
 * Hook voor authenticatie vereiste
 *
 * Redirect automatisch naar login als gebruiker niet is ingelogd.
 * Gebruik in screens die authenticatie vereisen.
 *
 * @returns Auth state met isSignedIn en isLoaded
 *
 * @example
 * ```tsx
 * function ProtectedScreen() {
 *   const { isSignedIn, isLoaded } = useRequireAuth();
 *
 *   if (!isLoaded) return <LoadingScreen />;
 *   if (!isSignedIn) return null; // Redirect happens automatically
 *
 *   return <ProtectedContent />;
 * }
 * ```
 */
export function useRequireAuth(): RequireAuthState {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      console.log('[RequireAuth] Niet ingelogd, redirect naar login...');
      router.replace('/(auth)/login');
    }
  }, [isSignedIn, isLoaded, router]);

  return { isSignedIn, isLoaded };
}

/**
 * Hook voor het ophalen van de huidige auth token
 *
 * Handig voor API calls die een Bearer token nodig hebben.
 *
 * @returns Object met getAuthToken functie
 *
 * @example
 * ```tsx
 * function ApiExample() {
 *   const { getAuthToken } = useAuthToken();
 *
 *   const fetchData = async () => {
 *     const token = await getAuthToken();
 *     const response = await fetch('/api/data', {
 *       headers: { Authorization: `Bearer ${token}` }
 *     });
 *   };
 * }
 * ```
 */
export function useAuthToken() {
  const { getToken } = useAuth();

  const getAuthToken = useCallback(async (): Promise<string | null> => {
    try {
      return await getToken();
    } catch (error) {
      console.error('[AuthToken] Fout bij ophalen token:', error);
      return null;
    }
  }, [getToken]);

  return { getAuthToken };
}

/**
 * Hook voor sign out functionaliteit
 *
 * Biedt een signOut functie die ook de lokale session data opruimt.
 *
 * @returns Object met signOut functie en loading state
 *
 * @example
 * ```tsx
 * function LogoutButton() {
 *   const { signOut, isSigningOut } = useSignOut();
 *
 *   return (
 *     <Button onPress={signOut} disabled={isSigningOut}>
 *       {isSigningOut ? 'Uitloggen...' : 'Uitloggen'}
 *     </Button>
 *   );
 * }
 * ```
 */
export function useSignOut() {
  const { signOut: clerkSignOut } = useAuth();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signOut = useCallback(async () => {
    setIsSigningOut(true);
    try {
      // Clear local session data
      await SecureStore.deleteItemAsync(AUTH_STORAGE_KEYS.LAST_LOGIN);
      await SecureStore.deleteItemAsync(AUTH_STORAGE_KEYS.SESSION);

      // Sign out from Clerk
      await clerkSignOut();

      console.log('[SignOut] Succesvol uitgelogd');
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('[SignOut] Fout bij uitloggen:', error);
    } finally {
      setIsSigningOut(false);
    }
  }, [clerkSignOut, router]);

  return { signOut, isSigningOut };
}
