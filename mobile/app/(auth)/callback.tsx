/**
 * Magic Link Callback Screen
 *
 * Dit scherm handelt de deep link callback af wanneer de gebruiker
 * op de magic link in de email klikt. Het verifieert de sessie en
 * leidt de gebruiker door naar de biometric setup of het dashboard.
 */

import { useEffect, useState, useRef, useCallback, type ReactNode } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Text } from '../../components/ui/Tekst';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSignIn, useSignUp, useAuth } from '@clerk/clerk-expo';
import { CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react-native';
import { isAuthConfigured } from '../../lib/env';
import { tekst, useColors } from '../../theme';
import { Button } from '../../components/ui';
import { IcoonTegel, Melding } from '../../components/werk/Bouwstenen';

type CallbackStatus = 'verifying' | 'success' | 'error';

// Check auth configuratie buiten component (constant tijdens runtime)
const AUTH_CONFIGURED = isAuthConfigured();

export default function CallbackScreen() {
  const router = useRouter();
  const kleuren = useColors();
  const [status, setStatus] = useState<CallbackStatus>('verifying');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs for interval/timeout cleanup
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const statusRef = useRef<CallbackStatus>('verifying');

  // Altijd hooks aanroepen (React rules of hooks)
  const signInHook = useSignIn();
  const signUpHook = useSignUp();
  const authHook = useAuth();

  // Gebruik resultaat alleen als auth geconfigureerd is
  const signIn = AUTH_CONFIGURED ? signInHook.signIn : null;
  const signUp = AUTH_CONFIGURED ? signUpHook.signUp : null;
  const setActiveSignIn = AUTH_CONFIGURED ? signInHook.setActive : null;
  const setActiveSignUp = AUTH_CONFIGURED ? signUpHook.setActive : null;
  const isSignedIn = AUTH_CONFIGURED ? authHook.isSignedIn : false;

  // Keep status ref in sync for use inside interval/timeout callbacks
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Clean up interval and timeout on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCallback = useCallback(async () => {
    try {
      if (!AUTH_CONFIGURED) {
        setStatus('error');
        setErrorMessage('Authenticatie is niet geconfigureerd');
        return;
      }

      // Clerk magic links bevatten specifieke query parameters
      // De verificatie wordt automatisch afgehandeld door Clerk

      // Check of signIn of signUp actief is
      if (signIn?.status === 'complete') {
        // Sign in is complete
        if (signIn.createdSessionId && setActiveSignIn) {
          await setActiveSignIn({ session: signIn.createdSessionId });
          setStatus('success');
          return;
        }
      }

      if (signUp?.status === 'complete') {
        // Sign up is complete (nieuwe gebruiker)
        if (signUp.createdSessionId && setActiveSignUp) {
          await setActiveSignUp({ session: signUp.createdSessionId });
          setStatus('success');
          return;
        }
      }

      // Als we hier komen en niet ingelogd zijn, probeer de verificatie
      // De magic link flow in Clerk v2 werkt asynchroon
      // Het kan even duren voordat de status bijgewerkt is

      // Clear any previous interval/timeout
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      // Wacht even en check opnieuw
      intervalRef.current = setInterval(async () => {
        if (signIn?.status === 'complete' && signIn.createdSessionId && setActiveSignIn) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          await setActiveSignIn({ session: signIn.createdSessionId });
          setStatus('success');
        }
      }, 500);

      // Timeout na 30 seconden
      timeoutRef.current = setTimeout(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (statusRef.current === 'verifying') {
          setStatus('error');
          setErrorMessage(
            'De verificatie duurde te lang. De link is mogelijk verlopen. ' +
            'Vraag een nieuwe magic link aan.'
          );
        }
      }, 30000);

    } catch (error: any) {
      console.error('[Callback] Error:', error);
      setStatus('error');

      const clerkError = error.errors?.[0];
      if (clerkError) {
        switch (clerkError.code) {
          case 'session_exists':
            // Al ingelogd, redirect
            router.replace('/(auth)/biometric');
            return;
          case 'verification_expired':
            setErrorMessage(
              'De magic link is verlopen. Vraag een nieuwe aan.'
            );
            break;
          case 'verification_failed':
            setErrorMessage(
              'De verificatie is mislukt. Probeer het opnieuw.'
            );
            break;
          default:
            setErrorMessage(clerkError.message || 'Er ging iets mis bij de verificatie.');
        }
      } else {
        setErrorMessage(
          error.message || 'Er ging iets mis bij de verificatie.'
        );
      }
    }
  }, [signIn, signUp, setActiveSignIn, setActiveSignUp, router]);

  useEffect(() => {
    // Schedule on next tick to avoid state updates during render
    const startTimer = setTimeout(() => handleCallback(), 0);
    return () => clearTimeout(startTimer);
  }, [handleCallback]);

  // Als al ingelogd, redirect naar biometric setup
  useEffect(() => {
    if (isSignedIn && status === 'success') {
      // Kleine delay om de success state te tonen
      const timer = setTimeout(() => {
        router.replace('/(auth)/biometric');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isSignedIn, status, router]);

  const handleRetry = () => {
    router.replace('/(auth)/login');
  };

  // Verifying state
  if (status === 'verifying') {
    return (
      <Vlak>
        <ActivityIndicator size="large" color={kleuren.primary} />
        <Text accessibilityRole="header" style={[tekst.titel3, { color: kleuren.foreground, textAlign: 'center', marginTop: 8 }]}>
          Even geduld…
        </Text>
        <Text style={[tekst.callout, { color: kleuren.mutedForeground, textAlign: 'center' }]}>
          We controleren je inloglink. Dit duurt maar even.
        </Text>
      </Vlak>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <Vlak>
        <IcoonTegel icoon={CheckCircle} toon="succes" grootte={80} />
        <Text accessibilityRole="header" style={[tekst.titel1, { color: kleuren.foreground, textAlign: 'center', marginTop: 8 }]}>
          Ingelogd
        </Text>
        <Text style={[tekst.callout, { color: kleuren.mutedForeground, textAlign: 'center' }]}>
          Je wordt doorgestuurd…
        </Text>
      </Vlak>
    );
  }

  // Error state
  return (
    <Vlak>
      <IcoonTegel icoon={AlertCircle} toon="gemist" grootte={80} />
      <Text accessibilityRole="header" style={[tekst.titel1, { color: kleuren.foreground, textAlign: 'center', marginTop: 8 }]}>
        Verificatie mislukt
      </Text>
      <View style={{ alignSelf: 'stretch', gap: 16, marginTop: 8 }}>
        <Melding tekst={errorMessage || 'Er ging iets mis bij de verificatie.'} toon="gemist" />
        <Button
          title="Terug naar inloggen"
          size="lg"
          fullWidth
          icon={<ArrowLeft size={20} color={kleuren.primaryForeground} strokeWidth={2} />}
          onPress={handleRetry}
        />
      </View>
    </Vlak>
  );
}

/** Gecentreerd statusvlak binnen de veilige marges. */
function Vlak({ children }: { children: ReactNode }) {
  const kleuren = useColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: kleuren.background }} edges={['top', 'bottom']}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
        <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center', alignItems: 'center', gap: 12 }}>
          {children}
        </View>
      </View>
    </SafeAreaView>
  );
}
