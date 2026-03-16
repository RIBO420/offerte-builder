/**
 * Biometric Login Screen
 *
 * Dit scherm wordt getoond aan gebruikers die biometric login hebben ingeschakeld.
 * Het biedt een snelle manier om in te loggen met Face ID of Touch ID.
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth, useClerk } from '@clerk/clerk-expo';
import {
  authenticateWithBiometric,
  getBiometricType,
  disableBiometric,
  BiometricType,
} from '../../lib/auth/biometric';
import { isAuthConfigured } from '../../lib/env';

// Check auth configuratie buiten component (constant tijdens runtime)
const AUTH_CONFIGURED = isAuthConfigured();

export default function BiometricLoginScreen() {
  const router = useRouter();
  const [biometricType, setBiometricType] = useState<BiometricType>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Altijd hooks aanroepen (React rules of hooks)
  const authHook = useAuth();
  const clerkHook = useClerk();

  // Gebruik resultaat alleen als auth geconfigureerd is
  const isSignedIn = AUTH_CONFIGURED ? authHook.isSignedIn : false;

  useEffect(() => {
    initializeBiometric();
  }, []);

  // Als al ingelogd, redirect naar tabs
  useEffect(() => {
    if (isSignedIn) {
      router.replace('/(tabs)');
    }
  }, [isSignedIn]);

  const initializeBiometric = async () => {
    try {
      const type = await getBiometricType();
      setBiometricType(type);

      // Start automatisch biometric authenticatie
      if (type) {
        handleBiometricLogin();
      }
    } catch (error) {
      console.error('[BiometricLogin] Init error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (isAuthenticating) return;

    setIsAuthenticating(true);

    try {
      const result = await authenticateWithBiometric();

      if (result.success && result.token && result.userId) {
        console.log('[BiometricLogin] Biometric success, validating session...');

        // De opgeslagen token is een Clerk session token
        // We moeten checken of deze nog geldig is

        // Probeer de sessie te herstellen via Clerk
        // Note: In production zou je hier een token refresh flow implementeren
        // Voor nu redirecten we naar de app en laten Clerk de session valideren

        // Als de gebruiker al ingelogd is via Clerk (sessie nog geldig)
        if (isSignedIn) {
          router.replace('/(tabs)');
          return;
        }

        // Als de sessie verlopen is, moeten we opnieuw inloggen
        // Dit gebeurt automatisch omdat biometric tokens kunnen verlopen
        Alert.alert(
          'Sessie Verlopen',
          'Je sessie is verlopen. Log opnieuw in met magic link.',
          [
            {
              text: 'OK',
              onPress: async () => {
                await disableBiometric();
                router.replace('/(auth)/login');
              },
            },
          ]
        );
      } else {
        // Biometric authenticatie gefaald
        if (result.error === 'Authenticatie geannuleerd') {
          // Gebruiker heeft geannuleerd, geen actie nodig
          return;
        }

        if (result.error === 'Sessie verlopen. Log opnieuw in.') {
          Alert.alert(
            'Sessie Verlopen',
            'Je sessie is verlopen. Log opnieuw in met magic link.',
            [
              {
                text: 'OK',
                onPress: () => router.replace('/(auth)/login'),
              },
            ]
          );
          return;
        }

        // Toon foutmelding
        Alert.alert('Fout', result.error || 'Biometric authenticatie mislukt');
      }
    } catch (error: any) {
      console.error('[BiometricLogin] Error:', error);
      Alert.alert(
        'Fout',
        error.message || 'Er ging iets mis bij de biometric authenticatie.'
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleUseEmail = async () => {
    // Optioneel: vraag bevestiging voordat we biometric uitschakelen
    Alert.alert(
      'Inloggen met email',
      'Wil je inloggen met een magic link? Biometric login blijft beschikbaar.',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Ja, gebruik email',
          onPress: () => router.push('/(auth)/login'),
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#4ADE80" />
          <Text style={styles.loadingText}>Laden...</Text>
        </View>
      </View>
    );
  }

  const biometricLabel = biometricType === 'face' ? 'Face ID' : 'Touch ID';
  const biometricIcon = biometricType === 'face' ? 'shield' : 'smartphone';

  return (
    <View style={styles.container}>
      <View style={styles.centerContent}>
        {/* Logo */}
        <Text style={styles.logoText}>TOP TUINEN</Text>

        {/* Large centered icon */}
        <View style={styles.iconContainer}>
          <Feather name={biometricIcon} size={64} color="#4ADE80" />
        </View>

        {/* Title */}
        <Text style={styles.title}>{biometricLabel}</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>Gebruik biometrie om in te loggen</Text>

        {/* Biometric button */}
        <TouchableOpacity
          style={[
            styles.biometricButton,
            isAuthenticating && styles.biometricButtonDisabled,
          ]}
          onPress={handleBiometricLogin}
          disabled={isAuthenticating}
        >
          {isAuthenticating ? (
            <ActivityIndicator size="small" color="#4ADE80" style={{ marginRight: 8 }} />
          ) : (
            <Feather name={biometricIcon} size={20} color="#4ADE80" style={{ marginRight: 8 }} />
          )}
          <Text style={styles.biometricButtonText}>
            {isAuthenticating ? 'Verificatie...' : `Gebruik ${biometricLabel}`}
          </Text>
        </TouchableOpacity>

        {/* Skip link */}
        <TouchableOpacity style={styles.skipButton} onPress={handleUseEmail}>
          <Text style={styles.skipText}>Gebruik email</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  centerContent: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#888',
  },
  logoText: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 3,
    color: '#6B8F6B',
    fontWeight: '600',
    marginBottom: 40,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#E8E8E8',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    marginBottom: 40,
  },
  biometricButton: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#1A2E1A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  biometricButtonDisabled: {
    opacity: 0.5,
  },
  biometricButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4ADE80',
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 13,
    color: '#6B8F6B',
  },
});
