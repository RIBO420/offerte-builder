/**
 * Magic Link Callback Screen
 *
 * Dit scherm handelt de deep link callback af wanneer de gebruiker
 * op de magic link in de email klikt. Het verifieert de sessie en
 * leidt de gebruiker door naar de biometric setup of het dashboard.
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSignIn, useSignUp, useAuth } from '@clerk/clerk-expo';
import { Feather } from '@expo/vector-icons';
import { isAuthConfigured } from '../../lib/env';

type CallbackStatus = 'verifying' | 'success' | 'error';

// Check auth configuratie buiten component (constant tijdens runtime)
const AUTH_CONFIGURED = isAuthConfigured();

export default function CallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [status, setStatus] = useState<CallbackStatus>('verifying');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  useEffect(() => {
    handleCallback();
  }, []);

  // Als al ingelogd, redirect naar biometric setup
  useEffect(() => {
    if (isSignedIn && status === 'success') {
      // Kleine delay om de success state te tonen
      const timer = setTimeout(() => {
        router.replace('/(auth)/biometric');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isSignedIn, status]);

  const handleCallback = async () => {
    try {
      console.log('[Callback] Params:', params);

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
          console.log('[Callback] Sign in complete, session activated');
          setStatus('success');
          return;
        }
      }

      if (signUp?.status === 'complete') {
        // Sign up is complete (nieuwe gebruiker)
        if (signUp.createdSessionId && setActiveSignUp) {
          await setActiveSignUp({ session: signUp.createdSessionId });
          console.log('[Callback] Sign up complete, session activated');
          setStatus('success');
          return;
        }
      }

      // Als we hier komen en niet ingelogd zijn, probeer de verificatie
      // De magic link flow in Clerk v2 werkt asynchroon
      // Het kan even duren voordat de status bijgewerkt is

      // Wacht even en check opnieuw
      const checkSessionInterval = setInterval(async () => {
        if (signIn?.status === 'complete' && signIn.createdSessionId && setActiveSignIn) {
          clearInterval(checkSessionInterval);
          await setActiveSignIn({ session: signIn.createdSessionId });
          setStatus('success');
        }
      }, 500);

      // Timeout na 30 seconden
      setTimeout(() => {
        clearInterval(checkSessionInterval);
        if (status === 'verifying') {
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
  };

  const handleRetry = () => {
    router.replace('/(auth)/login');
  };

  // Verifying state
  if (status === 'verifying') {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#2d5016" />
          <Text style={styles.statusText}>Verificatie bezig...</Text>
          <Text style={styles.hintText}>
            We controleren je inloglink. Dit duurt maar even.
          </Text>
        </View>
      </View>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.successIcon}>
            <Feather name="check-circle" size={64} color="#16a34a" />
          </View>
          <Text style={styles.successText}>Ingelogd!</Text>
          <Text style={styles.hintText}>
            Je wordt doorgestuurd...
          </Text>
        </View>
      </View>
    );
  }

  // Error state
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.errorIcon}>
          <Feather name="alert-circle" size={64} color="#dc2626" />
        </View>
        <Text style={styles.errorText}>Verificatie mislukt</Text>
        <Text style={styles.errorMessage}>
          {errorMessage || 'Er ging iets mis bij de verificatie.'}
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Feather name="arrow-left" size={20} color="#2d5016" />
            <Text style={styles.retryButtonText}>
              Terug naar inloggen
            </Text>
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
  statusText: {
    marginTop: 24,
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  hintText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  successIcon: {
    marginBottom: 16,
  },
  successText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  errorMessage: {
    marginTop: 12,
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 22,
  },
  actions: {
    marginTop: 32,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: '#f0f9e8',
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d5016',
  },
});
