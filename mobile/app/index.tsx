import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { isBiometricEnabled, getBiometricUserId } from '../lib/auth/biometric';
import { isAuthConfigured } from '../lib/env';
import { useColors } from '../theme';

// Check auth configuratie buiten component (constant tijdens runtime)
const AUTH_CONFIGURED = isAuthConfigured();

export default function Index() {
  const kleuren = useColors();
  const [checkingBiometric, setCheckingBiometric] = useState(true);
  const [hasBiometric, setHasBiometric] = useState(false);

  // Altijd useAuth aanroepen, maar resultaat negeren als niet geconfigureerd
  const clerkAuth = useAuth();
  const isLoaded = AUTH_CONFIGURED ? clerkAuth.isLoaded : true;
  const isSignedIn = AUTH_CONFIGURED ? clerkAuth.isSignedIn : false;

  useEffect(() => {
    // Functie in het effect zelf: voorkomt access-before-declaration
    // (react-hooks/immutability) zonder gedragswijziging — draait eenmalig bij mount.
    const checkBiometricStatus = async () => {
      try {
        const enabled = await isBiometricEnabled();
        const userId = await getBiometricUserId();
        setHasBiometric(enabled && !!userId);
      } catch (error) {
        console.error('[Index] Biometric check error:', error);
      } finally {
        setCheckingBiometric(false);
      }
    };
    checkBiometricStatus();
  }, []);

  // Toon loading indicator terwijl auth status wordt geladen
  if (!isLoaded || checkingBiometric) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: kleuren.background }}>
        <ActivityIndicator size="large" color={kleuren.primary} accessibilityLabel="Laden" />
      </View>
    );
  }

  // Als gebruiker al ingelogd is, ga naar tabs
  if (isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  // Als biometric is ingeschakeld maar niet ingelogd,
  // laat biometric login zien
  if (hasBiometric) {
    return <Redirect href="/(auth)/biometric-login" />;
  }

  // Anders, ga naar normale login
  return <Redirect href="/(auth)/login" />;
}
