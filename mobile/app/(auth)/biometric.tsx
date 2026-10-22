import { useState, useEffect } from 'react';
import {
  View,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Text } from '../../components/ui/Tekst';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ShieldCheck, Fingerprint, Zap, Shield, Lock } from 'lucide-react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth, useUser } from '@clerk/clerk-expo';
import {
  isBiometricAvailable,
  getBiometricType,
  setupBiometric,
  BiometricType,
} from '../../lib/auth/biometric';
import { isAuthConfigured } from '../../lib/env';
import { tekst, useColors } from '../../theme';
import { Button } from '../../components/ui';
import { IcoonTegel, Kaart } from '../../components/werk/Bouwstenen';

// Check auth configuratie buiten component (constant tijdens runtime)
const AUTH_CONFIGURED = isAuthConfigured();

export default function BiometricSetupScreen() {
  const router = useRouter();
  const kleuren = useColors();
  const [biometricType, setBiometricType] = useState<BiometricType>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingUp, setIsSettingUp] = useState(false);

  // Altijd hooks aanroepen (React rules of hooks)
  const authHook = useAuth();
  const userHook = useUser();

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

    // Functie in het effect zelf: voorkomt access-before-declaration
    // (react-hooks/immutability) zonder gedragswijziging.
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
    checkBiometricAvailability();
    // router uit useRouter is een stabiele referentie; opnemen is gedragsneutraal.
  }, [isSignedIn, router]);

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

  const wachten = (tekstje: string) => (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: kleuren.background }}>
      <ActivityIndicator size="large" color={kleuren.primary} />
      <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>{tekstje}</Text>
    </View>
  );

  // Loading state
  if (isLoading) {
    return wachten('Biometrie controleren…');
  }

  // Als biometrie niet beschikbaar is, skip naar dashboard
  if (!isAvailable) {
    // Use effect-like behavior met een timeout
    setTimeout(() => {
      router.replace('/(tabs)');
    }, 100);

    return wachten('Doorsturen…');
  }

  const biometricLabel = biometricType === 'face' ? 'Face ID' : 'Touch ID';
  const BiometricIcon = biometricType === 'face' ? ShieldCheck : Fingerprint;
  const voordelen = [
    { icoon: Zap, label: 'Direct inloggen in 1 seconde' },
    { icoon: Shield, label: 'Extra beveiligd met biometrie' },
    { icoon: Lock, label: 'Geen wachtwoord onthouden' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: kleuren.background }} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center', gap: 28 }}>
          <View style={{ alignItems: 'center', gap: 12 }}>
            <IcoonTegel icoon={BiometricIcon} toon="primair" grootte={80} />
            <Text accessibilityRole="header" style={[tekst.titel1, { color: kleuren.foreground, textAlign: 'center', marginTop: 8 }]}>
              Sneller inloggen?
            </Text>
            <Text style={[tekst.callout, { color: kleuren.mutedForeground, textAlign: 'center', maxWidth: 340 }]}>
              Schakel {biometricLabel} in om de volgende keer sneller en veiliger in te loggen op de Top Tuinen app.
            </Text>
          </View>

          <Kaart style={{ gap: 4 }}>
            {voordelen.map(({ icoon, label }) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
                <IcoonTegel icoon={icoon} toon="primair" grootte={36} />
                <Text style={[tekst.body, { color: kleuren.foreground, flex: 1 }]}>{label}</Text>
              </View>
            ))}
          </Kaart>

          <View style={{ gap: 8 }}>
            <Button
              title={isSettingUp ? 'Bezig…' : `Activeer ${biometricLabel}`}
              size="lg"
              fullWidth
              loading={isSettingUp}
              icon={<BiometricIcon size={20} color={kleuren.primaryForeground} strokeWidth={2} />}
              onPress={handleEnableBiometric}
              disabled={isSettingUp}
            />
            <Button
              title="Later instellen"
              variant="ghost"
              size="lg"
              fullWidth
              onPress={handleSkip}
              disabled={isSettingUp}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
