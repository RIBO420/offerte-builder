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
import { ShieldCheck, Fingerprint, Zap, Shield, Lock } from 'lucide-react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth, useUser, useClerk } from '@clerk/clerk-expo';
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
  const clerkHook = useClerk();

  // Gebruik resultaat alleen als auth geconfigureerd is
  const getToken = AUTH_CONFIGURED ? authHook.getToken : null;
  const sessionId = AUTH_CONFIGURED ? authHook.sessionId : null;
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
      if (getToken && userId && sessionId) {
        const token = await getToken();

        if (token) {
          const success = await setupBiometric(sessionId, token, userId);

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
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#4ADE80" />
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
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#4ADE80" />
          <Text style={styles.loadingText}>Doorsturen...</Text>
        </View>
      </View>
    );
  }

  const biometricLabel = biometricType === 'face' ? 'Face ID' : 'Touch ID';
  const BiometricIcon = biometricType === 'face' ? ShieldCheck : Fingerprint;

  return (
    <View style={styles.container}>
      <View style={styles.centerContent}>
        {/* Logo */}
        <Text style={styles.logoText}>TOP TUINEN</Text>

        {/* Icon */}
        <View style={styles.iconContainer}>
          <BiometricIcon size={64} color="#4ADE80" />
        </View>

        {/* Title and description */}
        <Text style={styles.title}>Sneller Inloggen?</Text>
        <Text style={styles.subtitle}>
          Schakel {biometricLabel} in om de volgende keer sneller en veiliger in
          te loggen op de Top Tuinen app.
        </Text>

        {/* Benefits */}
        <View style={styles.benefitsList}>
          <View style={styles.benefitItem}>
            <Zap size={18} color="#4ADE80" />
            <Text style={styles.benefitText}>Direct inloggen in 1 seconde</Text>
          </View>
          <View style={styles.benefitItem}>
            <Shield size={18} color="#4ADE80" />
            <Text style={styles.benefitText}>Extra beveiligd met biometrie</Text>
          </View>
          <View style={styles.benefitItem}>
            <Lock size={18} color="#4ADE80" />
            <Text style={styles.benefitText}>Geen wachtwoord onthouden</Text>
          </View>
        </View>

        {/* Buttons */}
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[
              styles.enableButton,
              isSettingUp && styles.enableButtonDisabled,
            ]}
            onPress={handleEnableBiometric}
            disabled={isSettingUp}
          >
            {isSettingUp ? (
              <ActivityIndicator size="small" color="#4ADE80" style={{ marginRight: 8 }} />
            ) : (
              <BiometricIcon size={20} color="#4ADE80" style={{ marginRight: 8 }} />
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
            <Text style={styles.skipText}>Later instellen</Text>
          </TouchableOpacity>
        </View>
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
    marginBottom: 32,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#E8E8E8',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  benefitsList: {
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
    fontSize: 14,
    color: '#E8E8E8',
  },
  buttonGroup: {
    width: '100%',
    gap: 12,
  },
  enableButton: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#1A2E1A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enableButtonDisabled: {
    opacity: 0.5,
  },
  enableButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4ADE80',
  },
  skipButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 14,
    color: '#888',
  },
});
