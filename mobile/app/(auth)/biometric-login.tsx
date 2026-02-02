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
import { cn } from '@/lib/utils';

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
      <View className="flex-1 bg-background">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#2d5016" />
          <Text className="mt-3 text-sm text-muted-foreground">Laden...</Text>
        </View>
      </View>
    );
  }

  const biometricLabel = biometricType === 'face' ? 'Face ID' : 'Touch ID';
  const biometricIcon = biometricType === 'face' ? 'eye' : 'smartphone';

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1 px-6 justify-center items-center">
        {/* Logo en titel */}
        <View className="items-center mb-12">
          <View className="w-24 h-24 rounded-full bg-green-50 items-center justify-center mb-4">
            <Feather name="sun" size={48} color="#2d5016" />
          </View>
          <Text className="text-3xl font-bold text-[#2d5016] mb-1">Top Tuinen</Text>
          <Text className="text-lg text-muted-foreground">Welkom terug</Text>
        </View>

        {/* Biometric button */}
        <TouchableOpacity
          className={cn(
            "w-full flex-row bg-accent rounded-xl py-4.5 items-center justify-center mb-4",
            isAuthenticating && "bg-green-300"
          )}
          onPress={handleBiometricLogin}
          disabled={isAuthenticating}
        >
          {isAuthenticating ? (
            <ActivityIndicator size="small" color="#fff" className="mr-2.5" />
          ) : (
            <Feather name={biometricIcon} size={24} color="#fff" className="mr-2.5" />
          )}
          <Text className="text-white text-lg font-semibold">
            {isAuthenticating ? 'Verificatie...' : `Inloggen met ${biometricLabel}`}
          </Text>
        </TouchableOpacity>

        {/* Alternatieve login */}
        <TouchableOpacity className="flex-row items-center gap-2 py-3 px-4" onPress={handleUseEmail}>
          <Feather name="mail" size={18} color="#666" />
          <Text className="text-base text-muted-foreground">Gebruik magic link</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

