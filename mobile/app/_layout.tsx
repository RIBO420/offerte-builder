import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ClerkProvider, ClerkLoaded, useAuth } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { getConvexClient } from '../lib/convex';
import { CLERK_PUBLISHABLE_KEY } from '../lib/env';
import { ThemeProvider } from '../theme';
import { useCurrentUser } from '../hooks/use-current-user';
import { usePushNotifications } from '../hooks/use-push-notifications';
import { RoleProvider } from '../contexts/RoleContext';

// Convex client instantie
const convex = getConvexClient();

/**
 * User Sync Component
 *
 * Zorgt ervoor dat de Clerk user wordt gesynchroniseerd naar Convex.
 * Moet binnen de ConvexProviderWithClerk staan.
 */
function UserSync({ children }: { children: React.ReactNode }) {
  // This hook syncs Clerk user to Convex
  useCurrentUser();
  return <>{children}</>;
}

/**
 * Push Notifications Initializer
 *
 * Initializes push notifications after user is authenticated.
 * Must be inside ConvexProviderWithClerk for backend token registration.
 *
 * Note: Push notifications are not available in Expo Go or simulators.
 * This is expected behavior - no warnings are logged in these environments.
 */
function PushNotificationsInitializer({ children }: { children: React.ReactNode }) {
  // Initialize push notifications - handles permission, token registration, and listeners
  // The hook silently handles Expo Go and simulator environments
  usePushNotifications();

  return <>{children}</>;
}

/**
 * Inner Layout Component
 *
 * Dit component bevat de navigatie stack en wordt gewrapped
 * door de Clerk en Convex providers.
 *
 * Providers (innermost to outermost):
 * - Stack: Navigation
 * - PushNotificationsInitializer: Push notification setup
 * - RoleProvider: Role-based access control
 * - UserSync: Clerk to Convex user sync
 */
function InnerLayout() {
  return (
    <UserSync>
      <RoleProvider>
        <PushNotificationsInitializer>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </PushNotificationsInitializer>
      </RoleProvider>
    </UserSync>
  );
}

/**
 * Root Layout Component
 *
 * De root layout van de app die alle providers configureert:
 * - SafeAreaProvider voor safe area insets
 * - ClerkProvider voor authenticatie met tokenCache voor secure storage
 * - ConvexProviderWithClerk voor database met auth integratie
 */
export default function RootLayout() {
  // Valideer dat Clerk publishable key is geconfigureerd
  if (!CLERK_PUBLISHABLE_KEY) {
    console.warn(
      'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is niet geconfigureerd. ' +
      'Authenticatie is uitgeschakeld. Voeg de key toe aan .env.local.'
    );

    // Fallback zonder Clerk (voor development zonder auth)
    return (
      <SafeAreaProvider>
        <ThemeProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ClerkProvider
          tokenCache={tokenCache}
          publishableKey={CLERK_PUBLISHABLE_KEY}
        >
          <ClerkLoaded>
            <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
              <InnerLayout />
            </ConvexProviderWithClerk>
          </ClerkLoaded>
        </ClerkProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
