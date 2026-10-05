import '../global.css';
import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ClerkProvider, ClerkLoaded } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { SessieConvexProvider } from '../components/SessieConvexProvider';
import { CLERK_PUBLISHABLE_KEY } from '../lib/env';
import { ThemeProvider, useTheme, useColors, tekst, typography } from '../theme';
import { useCurrentUser } from '../hooks/use-current-user';
import { usePushNotifications } from '../hooks/use-push-notifications';
import { RoleProvider } from '../contexts/RoleContext';
import { ToastProvider } from '../contexts/ToastContext';
import { OrgGate } from '../components/OrgGate';
import { AlertTriangle, Flag, RefreshCw } from 'lucide-react-native';


// ============================================
// ERROR BOUNDARY
// ============================================

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * App-level ErrorBoundary component.
 *
 * Vangt onverwachte JavaScript-fouten op en toont een
 * gebruiksvriendelijk foutscherm met herstart- en meldopties.
 */
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error for debugging / future crash reporting
    console.error('[AppErrorBoundary] Uncaught error:', error, errorInfo);
  }

  handleRetry = () => {
    // Reset the error boundary state to re-render the children tree
    this.setState({ hasError: false, error: null });
  };

  handleReport = () => {
    // Placeholder for future crash reporting integration (e.g. Sentry)
    // For now, log to console
    if (this.state.error) {
      console.warn('[AppErrorBoundary] User reported error:', this.state.error.message);
    }
    // Could open a mailto link or support form in the future
  };

  render() {
    if (this.state.hasError) {
      return (
        <FoutScherm
          melding={__DEV__ ? this.state.error?.message : undefined}
          onOpnieuw={this.handleRetry}
          onMeld={this.handleReport}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Foutscherm van de ErrorBoundary. De boundary staat binnen ThemeProvider, dus
 * de kleuren volgen licht/donker. Bewust kale primitieven (geen Button/Drukvlak):
 * dit scherm moet ook renderen als een gedeelde bouwsteen de fout veroorzaakte.
 */
function FoutScherm({ melding, onOpnieuw, onMeld }: { melding?: string; onOpnieuw: () => void; onMeld: () => void }) {
  const kleuren = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: kleuren.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
      <View style={{ width: '100%', maxWidth: 400, alignItems: 'center' }}>
        <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: kleuren.warningSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <AlertTriangle size={40} color={kleuren.warning} strokeWidth={2} />
        </View>

        <Text accessibilityRole="header" style={[tekst.titel2, { color: kleuren.foreground, textAlign: 'center', marginBottom: 12 }]}>
          Er is iets misgegaan
        </Text>
        <Text style={[tekst.callout, { color: kleuren.mutedForeground, textAlign: 'center', marginBottom: 32 }]}>
          De app heeft een onverwachte fout ondervonden. Probeer de app opnieuw te laden.
        </Text>

        {melding && (
          <View style={{ alignSelf: 'stretch', backgroundColor: kleuren.dangerSoft, borderRadius: 12, padding: 12, marginBottom: 24 }}>
            <Text style={[tekst.bijschrift, { color: kleuren.danger, fontFamily: typography.fontFamily.mono }]} numberOfLines={4}>
              {melding}
            </Text>
          </View>
        )}

        <Pressable
          onPress={onOpnieuw}
          accessibilityRole="button"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            alignSelf: 'stretch',
            minHeight: 52,
            borderRadius: 12,
            backgroundColor: kleuren.primary,
            opacity: pressed ? 0.85 : 1,
            marginBottom: 12,
          })}
        >
          <RefreshCw size={18} color={kleuren.primaryForeground} strokeWidth={2} />
          <Text style={[tekst.kop, { color: kleuren.primaryForeground }]}>Probeer opnieuw</Text>
        </Pressable>

        <Pressable
          onPress={onMeld}
          accessibilityRole="button"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            alignSelf: 'stretch',
            minHeight: 48,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: kleuren.border,
            backgroundColor: kleuren.card,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Flag size={16} color={kleuren.mutedForeground} strokeWidth={2} />
          <Text style={[tekst.callout, { color: kleuren.foreground, fontWeight: '500' }]}>Meld probleem</Text>
        </Pressable>
      </View>
    </View>
  );
}

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
 * - OrgGate: actieve Clerk-organisatie (elke Convex-query eronder is org-gescoped)
 *
 * OrgGate staat bewust bóven UserSync: zonder `org_id`-claim mogen `users.current`
 * en de rol-queries niet eens afvuren. Uitgelogd laat de gate alles door, zodat de
 * `(auth)`-loginschermen gewoon renderen.
 */
/** Statusbalk volgt het thema: lichte tekst op donker, donkere op licht. */
function ThemaStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

function InnerLayout() {
  return (
    <OrgGate>
      <UserSync>
        <RoleProvider>
          <PushNotificationsInitializer>
            <ThemaStatusBar />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="admin/index" options={{ headerShown: false, presentation: 'modal' }} />
              <Stack.Screen name="project/[id]" options={{ headerShown: false }} />
            </Stack>
          </PushNotificationsInitializer>
        </RoleProvider>
      </UserSync>
    </OrgGate>
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
          <ToastProvider>
            <AppErrorBoundary>
              <StatusBar style="light" />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              </Stack>
            </AppErrorBoundary>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {/* ToastProvider hoort op rootniveau, niet in InnerLayout: het Clerk-loze
            fallbackpad hierboven rendert (auth)/login.tsx en heeft hem óók nodig.
            Binnen SafeAreaProvider houden — Toast.tsx gebruikt useSafeAreaInsets. */}
        <ToastProvider>
          <AppErrorBoundary>
            <ClerkProvider
              tokenCache={tokenCache}
              publishableKey={CLERK_PUBLISHABLE_KEY}
            >
              <ClerkLoaded>
                <SessieConvexProvider>
                  <InnerLayout />
                </SessieConvexProvider>
              </ClerkLoaded>
            </ClerkProvider>
          </AppErrorBoundary>
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
