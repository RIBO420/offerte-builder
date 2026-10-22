/**
 * Biometric Login Screen
 *
 * Dit scherm wordt getoond aan gebruikers die biometric login hebben ingeschakeld.
 * Het biedt een snelle manier om in te loggen met Face ID of Touch ID.
 *
 * Na succesvolle biometric verificatie wordt de Clerk sessie hersteld via
 * clerk.setActive() met de opgeslagen session ID.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Text } from '../../components/ui/Tekst';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Fingerprint, Leaf, ShieldCheck, Mail } from 'lucide-react-native';
import { useAuth, useClerk } from '@clerk/clerk-expo';
import {
  authenticateWithBiometric,
  getBiometricType,
  disableBiometric,
  BiometricType,
} from '../../lib/auth/biometric';
import { isAuthConfigured } from '../../lib/env';
import { tekst, useColors } from '../../theme';
import { Button } from '../../components/ui';
import { Drukvlak, IcoonTegel } from '../../components/werk/Bouwstenen';

// Check auth configuratie buiten component (constant tijdens runtime)
const AUTH_CONFIGURED = isAuthConfigured();

export default function BiometricLoginScreen() {
  const router = useRouter();
  const kleuren = useColors();
  const [biometricType, setBiometricType] = useState<BiometricType>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const hasInitialized = useRef(false);

  // Altijd hooks aanroepen (React rules of hooks)
  const authHook = useAuth();
  const clerk = useClerk();

  // Gebruik resultaat alleen als auth geconfigureerd is
  const isSignedIn = AUTH_CONFIGURED ? authHook.isSignedIn : false;

  /**
   * Restore Clerk session using stored session ID after biometric verification.
   * Falls back to regular login if session is expired or invalid.
   */
  const handleBiometricLogin = useCallback(async () => {
    if (isAuthenticating) return;

    setIsAuthenticating(true);

    try {
      const result = await authenticateWithBiometric();

      if (result.success && result.sessionId && result.userId) {
        // Biometric verification succeeded — try to restore the Clerk session
        try {
          await clerk.setActive({ session: result.sessionId });

          // Session restored successfully — navigate to the app
          router.replace('/(tabs)');
          return;
        } catch (sessionError: any) {
          console.warn(
            '[BiometricLogin] Session restore failed, session may be expired:',
            sessionError?.message || sessionError
          );

          // Session is expired or invalid — clean up and redirect to login
          await disableBiometric();
          Alert.alert(
            'Sessie Verlopen',
            'Je sessie is verlopen. Log opnieuw in.',
            [
              {
                text: 'OK',
                onPress: () => router.replace('/(auth)/login'),
              },
            ]
          );
          return;
        }
      } else {
        // Biometric authenticatie gefaald
        if (result.error === 'Authenticatie geannuleerd') {
          // Gebruiker heeft geannuleerd, geen actie nodig
          return;
        }

        if (result.error === 'Sessie verlopen. Log opnieuw in.') {
          Alert.alert(
            'Sessie Verlopen',
            'Je sessie is verlopen. Log opnieuw in.',
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
  }, [isAuthenticating, clerk, router]);

  const initializeBiometric = useCallback(async () => {
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
  }, [handleBiometricLogin]);

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      initializeBiometric();
    }
  }, [initializeBiometric]);

  // Als al ingelogd, redirect naar tabs
  useEffect(() => {
    if (isSignedIn) {
      router.replace('/(tabs)');
    }
  }, [isSignedIn, router]);

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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: kleuren.background }}>
        <ActivityIndicator size="large" color={kleuren.primary} />
        <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Laden…</Text>
      </View>
    );
  }

  const biometricLabel = biometricType === 'face' ? 'Face ID' : 'Touch ID';
  const BiometricIcon = biometricType === 'face' ? ShieldCheck : Fingerprint;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: kleuren.background }} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center', gap: 40 }}>
          {/* Logo-lockup */}
          <View
            accessible
            accessibilityLabel="Top Tuinen"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
          >
            <IcoonTegel icoon={Leaf} toon="primair" grootte={40} />
            <Text style={[tekst.titel3, { color: kleuren.foreground }]}>Top Tuinen</Text>
          </View>

          <View style={{ alignItems: 'center', gap: 12 }}>
            <IcoonTegel icoon={BiometricIcon} toon="primair" grootte={80} />
            <Text accessibilityRole="header" style={[tekst.titel1, { color: kleuren.foreground, textAlign: 'center', marginTop: 8 }]}>
              Welkom terug
            </Text>
            <Text style={[tekst.callout, { color: kleuren.mutedForeground, textAlign: 'center' }]}>
              Log in met {biometricLabel}.
            </Text>
          </View>

          <View style={{ gap: 8, alignItems: 'center' }}>
            <Button
              title={isAuthenticating ? 'Verificatie…' : `Gebruik ${biometricLabel}`}
              size="lg"
              fullWidth
              loading={isAuthenticating}
              icon={<BiometricIcon size={20} color={kleuren.primaryForeground} strokeWidth={2} />}
              onPress={handleBiometricLogin}
              disabled={isAuthenticating}
            />

            {/* Terugval naar e-mail */}
            <Drukvlak
              onPress={handleUseEmail}
              haptic="selection"
              accessibilityLabel="Inloggen met e-mail"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 12 }}
            >
              <Mail size={16} color={kleuren.primary} strokeWidth={2} />
              <Text style={[tekst.callout, { color: kleuren.primary, fontWeight: '600' }]}>Inloggen met e-mail</Text>
            </Drukvlak>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
