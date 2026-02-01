import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { isBiometricEnabled, getBiometricUserId } from '../lib/auth/biometric';
import { isAuthConfigured } from '../lib/env';

// Check auth configuratie buiten component (constant tijdens runtime)
const AUTH_CONFIGURED = isAuthConfigured();

export default function Index() {
  const [checkingBiometric, setCheckingBiometric] = useState(true);
  const [hasBiometric, setHasBiometric] = useState(false);

  // Altijd useAuth aanroepen, maar resultaat negeren als niet geconfigureerd
  const clerkAuth = useAuth();
  const isLoaded = AUTH_CONFIGURED ? clerkAuth.isLoaded : true;
  const isSignedIn = AUTH_CONFIGURED ? clerkAuth.isSignedIn : false;

  useEffect(() => {
    checkBiometricStatus();
  }, []);

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

  // Toon loading indicator terwijl auth status wordt geladen
  if (!isLoaded || checkingBiometric) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2d5016" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
