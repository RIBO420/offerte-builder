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
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth, useUser } from '@clerk/clerk-expo';
import {
  isBiometricAvailable,
  getBiometricType,
  setupBiometric,
  BiometricType,
} from '../../lib/auth/biometric';
import { isAuthConfigured } from '../../lib/env';

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
      <View style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#2d5016" />
          <Text style={styles.loadingText}>Biometrie controleren...</Text>
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
      <View style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#2d5016" />
          <Text style={styles.loadingText}>Doorsturen...</Text>
        </View>
      </View>
    );
  }

  const iconName = biometricType === 'face' ? 'eye' : 'smartphone';
  const biometricLabel = biometricType === 'face' ? 'Face ID' : 'Touch ID';

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Feather name={iconName} size={64} color="#2d5016" />
        </View>

        {/* Titel en beschrijving */}
        <Text style={styles.title}>Sneller Inloggen?</Text>
        <Text style={styles.description}>
          Schakel {biometricLabel} in om de volgende keer sneller en veiliger in
          te loggen op de Top Tuinen app.
        </Text>

        {/* Voordelen */}
        <View style={styles.benefits}>
          <View style={styles.benefitItem}>
            <Feather name="zap" size={20} color="#2d5016" />
            <Text style={styles.benefitText}>Direct inloggen in 1 seconde</Text>
          </View>
          <View style={styles.benefitItem}>
            <Feather name="shield" size={20} color="#2d5016" />
            <Text style={styles.benefitText}>Extra beveiligd met biometrie</Text>
          </View>
          <View style={styles.benefitItem}>
            <Feather name="lock" size={20} color="#2d5016" />
            <Text style={styles.benefitText}>Geen wachtwoord onthouden</Text>
          </View>
        </View>

        {/* Knoppen */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.enableButton, isSettingUp && styles.buttonDisabled]}
            onPress={handleEnableBiometric}
            disabled={isSettingUp}
          >
            {isSettingUp ? (
              <ActivityIndicator size="small" color="#fff" style={styles.buttonIcon} />
            ) : (
              <Feather
                name={biometricType === 'face' ? 'eye' : 'smartphone'}
                size={20}
                color="#fff"
                style={styles.buttonIcon}
              />
            )}
            <Text style={styles.enableButtonText}>
              {isSettingUp ? 'Bezig...' : `Activeer ${biometricLabel}`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            disabled={isSettingUp}
          >
            <Text style={styles.skipButtonText}>Later instellen</Text>
          </TouchableOpacity>
        </View>
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
  iconContainer: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: '#f0f9e8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  benefits: {
    width: '100%',
    gap: 16,
    marginBottom: 40,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  benefitText: {
    fontSize: 15,
    color: '#333',
  },
  buttons: {
    width: '100%',
    gap: 12,
  },
  enableButton: {
    flexDirection: 'row',
    backgroundColor: '#2d5016',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#93c47d',
  },
  buttonIcon: {
    marginRight: 8,
  },
  enableButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#888',
    fontSize: 15,
  },
});
