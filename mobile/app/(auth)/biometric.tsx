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
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth, useUser } from '@clerk/clerk-expo';
import {
  isBiometricAvailable,
  getBiometricType,
  setupBiometric,
  BiometricType,
} from '../../lib/auth/biometric';
import { isAuthConfigured } from '../../lib/env';
import { cn } from '@/lib/utils';

// Check auth configuratie buiten component (constant tijdens runtime)
const AUTH_CONFIGURED = isAuthConfigured();

export default function BiometricSetupScreen() {
  const router = useRouter();
  const [biometricType, setBiometricType] = useState<BiometricType>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingUp, setIsSettingUp] = useState(false);

  // Altijd hooks aanroepen (React rules of hooks)
  const authHook = useAuth();
  const userHook = useUser();

  // Gebruik resultaat alleen als auth geconfigureerd is
  const getToken = AUTH_CONFIGURED ? authHook.getToken : null;
  const userId = AUTH_CONFIGURED ? userHook.user?.id : null;
  const isSignedIn = AUTH_CONFIGURED ? authHook.isSignedIn : false;

  useEffect(() => {
    // Als niet ingelogd, redirect naar login
    if (AUTH_CONFIGURED && isSignedIn === false) {
      router.replace('/(auth)/login');
      return;
    }

    checkBiometricAvailability();
  }, [isSignedIn]);

  const checkBiometricAvailability = async () => {
    try {
      const available = await isBiometricAvailable();
      setIsAvailable(available);

      if (available) {
        const type = await getBiometricType();
        setBiometricType(type);
      }
    } catch (error) {
      console.error('[BiometricSetup] Check error:', error);
      setIsAvailable(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableBiometric = async () => {
    setIsSettingUp(true);

    try {
      // Vraag eerst biometric authenticatie om te bevestigen
      const biometricResult = await LocalAuthentication.authenticateAsync({
        promptMessage:
          biometricType === 'face'
            ? 'Bevestig Face ID setup'
            : 'Bevestig Touch ID setup',
        fallbackLabel: 'Gebruik pincode',
        disableDeviceFallback: false,
        cancelLabel: 'Annuleren',
      });

      if (!biometricResult.success) {
        // Gebruiker heeft geannuleerd of authenticatie gefaald
        if (biometricResult.error === 'user_cancel') {
          return;
        }
        Alert.alert(
          'Fout',
          'Biometric verificatie mislukt. Probeer het opnieuw.'
        );
        return;
      }

      // Haal Clerk token op en sla op voor biometric login
      if (getToken && userId) {
        const token = await getToken();

        if (token) {
          const success = await setupBiometric(token, userId);

          if (success) {
            Alert.alert(
              'Biometrie Ingeschakeld',
              `${biometricType === 'face' ? 'Face ID' : 'Touch ID'} is succesvol ingeschakeld. ` +
                'Je kunt nu sneller inloggen.',
              [
                {
                  text: 'OK',
                  onPress: () => router.replace('/(tabs)'),
                },
              ]
            );
            return;
          }
        }
      }

      // Fallback als token ophalen mislukt
      Alert.alert(
        'Fout',
        'Kon biometrie niet instellen. Probeer het later opnieuw.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)'),
          },
        ]
      );
    } catch (error: any) {
      console.error('[BiometricSetup] Error:', error);
      Alert.alert(
        'Fout',
        error.message || 'Kon biometrie niet inschakelen. Probeer het later opnieuw.'
      );
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  // Loading state
  if (isLoading) {
    return (
      <View className="flex-1 bg-background">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#2d5016" />
          <Text className="mt-3 text-sm text-muted-foreground">Biometrie controleren...</Text>
        </View>
      </View>
    );
  }

  // Als biometrie niet beschikbaar is, skip naar dashboard
  if (!isAvailable) {
    // Use effect-like behavior met een timeout
    setTimeout(() => {
      router.replace('/(tabs)');
    }, 100);

    return (
      <View className="flex-1 bg-background">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#2d5016" />
          <Text className="mt-3 text-sm text-muted-foreground">Doorsturen...</Text>
        </View>
      </View>
    );
  }

  const iconName = biometricType === 'face' ? 'eye' : 'smartphone';
  const biometricLabel = biometricType === 'face' ? 'Face ID' : 'Touch ID';

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1 px-6 justify-center items-center">
        {/* Icon */}
        <View className="w-32 h-32 rounded-full bg-green-50 items-center justify-center mb-8">
          <Feather name={iconName} size={64} color="#2d5016" />
        </View>

        {/* Titel en beschrijving */}
        <Text className="text-3xl font-bold text-foreground text-center mb-3">Sneller Inloggen?</Text>
        <Text className="text-base text-muted-foreground text-center leading-6 mb-8 px-4">
          Schakel {biometricLabel} in om de volgende keer sneller en veiliger in
          te loggen op de Top Tuinen app.
        </Text>

        {/* Voordelen */}
        <View className="w-full gap-4 mb-10">
          <View className="flex-row items-center gap-3 px-4">
            <Feather name="zap" size={20} color="#2d5016" />
            <Text className="text-base text-foreground">Direct inloggen in 1 seconde</Text>
          </View>
          <View className="flex-row items-center gap-3 px-4">
            <Feather name="shield" size={20} color="#2d5016" />
            <Text className="text-base text-foreground">Extra beveiligd met biometrie</Text>
          </View>
          <View className="flex-row items-center gap-3 px-4">
            <Feather name="lock" size={20} color="#2d5016" />
            <Text className="text-base text-foreground">Geen wachtwoord onthouden</Text>
          </View>
        </View>

        {/* Knoppen */}
        <View className="w-full gap-3">
          <TouchableOpacity
            className={cn(
              "flex-row bg-accent rounded-xl py-4 items-center justify-center",
              isSettingUp && "bg-green-300"
            )}
            onPress={handleEnableBiometric}
            disabled={isSettingUp}
          >
            {isSettingUp ? (
              <ActivityIndicator size="small" color="#fff" className="mr-2" />
            ) : (
              <Feather
                name={biometricType === 'face' ? 'eye' : 'smartphone'}
                size={20}
                color="#fff"
                className="mr-2"
              />
            )}
            <Text className="text-white text-base font-semibold">
              {isSettingUp ? 'Bezig...' : `Activeer ${biometricLabel}`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="py-4 items-center"
            onPress={handleSkip}
            disabled={isSettingUp}
          >
            <Text className="text-muted-foreground text-base">Later instellen</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

