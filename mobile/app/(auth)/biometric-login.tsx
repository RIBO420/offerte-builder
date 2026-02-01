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
  StyleSheet,
  Alert,
  ActivityIndicator,
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
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#2d5016" />
          <Text style={styles.loadingText}>Laden...</Text>
        </View>
      </View>
    );
  }

  const biometricLabel = biometricType === 'face' ? 'Face ID' : 'Touch ID';
  const biometricIcon = biometricType === 'face' ? 'eye' : 'smartphone';

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo en titel */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Feather name="sun" size={48} color="#2d5016" />
          </View>
          <Text style={styles.title}>Top Tuinen</Text>
          <Text style={styles.subtitle}>Welkom terug</Text>
        </View>

        {/* Biometric button */}
        <TouchableOpacity
          style={[styles.biometricButton, isAuthenticating && styles.buttonDisabled]}
          onPress={handleBiometricLogin}
          disabled={isAuthenticating}
        >
          {isAuthenticating ? (
            <ActivityIndicator size="small" color="#fff" style={styles.buttonIcon} />
          ) : (
            <Feather name={biometricIcon} size={24} color="#fff" style={styles.buttonIcon} />
          )}
          <Text style={styles.biometricButtonText}>
            {isAuthenticating ? 'Verificatie...' : `Inloggen met ${biometricLabel}`}
          </Text>
        </TouchableOpacity>

        {/* Alternatieve login */}
        <TouchableOpacity style={styles.emailButton} onPress={handleUseEmail}>
          <Feather name="mail" size={18} color="#666" />
          <Text style={styles.emailButtonText}>Gebruik magic link</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#f0f9e8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2d5016',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
  },
  biometricButton: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#2d5016',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#93c47d',
  },
  buttonIcon: {
    marginRight: 10,
  },
  biometricButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  emailButtonText: {
    fontSize: 15,
    color: '#666',
  },
});
