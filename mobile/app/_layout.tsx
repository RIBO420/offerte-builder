import '../global.css';
import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Pressable, StyleSheet } from 'react-native';
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
import { Feather } from '@expo/vector-icons';

// Convex client instantie
const convex = getConvexClient();

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
        <View style={errorStyles.container}>
          <View style={errorStyles.iconContainer}>
            <Feather name="alert-triangle" size={48} color="#4ADE80" />
          </View>

          <Text style={errorStyles.title}>Er is iets misgegaan</Text>
          <Text style={errorStyles.subtitle}>
            De app heeft een onverwachte fout ondervonden. Probeer de app opnieuw te laden.
          </Text>

          {__DEV__ && this.state.error && (
            <View style={errorStyles.debugBox}>
              <Text style={errorStyles.debugText} numberOfLines={4}>
                {this.state.error.message}
              </Text>
            </View>
          )}

          <Pressable
            style={errorStyles.retryButton}
            onPress={this.handleRetry}
          >
            <Feather name="refresh-cw" size={18} color="#0A0A0A" />
            <Text style={errorStyles.retryButtonText}>Probeer opnieuw</Text>
          </Pressable>

          <Pressable
            style={errorStyles.reportButton}
            onPress={this.handleReport}
          >
            <Feather name="flag" size={16} color="#888888" />
            <Text style={errorStyles.reportButtonText}>Meld probleem</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FAFAFA',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  debugBox: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: '#222222',
  },
  debugText: {
    fontSize: 12,
    color: '#EF4444',
    fontFamily: 'monospace',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4ADE80',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
    width: '100%',
    marginBottom: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A0A0A',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    width: '100%',
    borderWidth: 1,
    borderColor: '#222222',
  },
  reportButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#888888',
  },
});

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
          <StatusBar style="light" />
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
          <AppErrorBoundary>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
          </AppErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppErrorBoundary>
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
        </AppErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
