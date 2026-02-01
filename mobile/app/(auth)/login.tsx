import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSignIn, useAuth } from '@clerk/clerk-expo';
import * as Linking from 'expo-linking';
import { isAuthConfigured } from '../../lib/env';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// States voor login flow
type LoginState = 'idle' | 'sending' | 'code_sent' | 'verifying' | 'error';

// Check auth configuratie buiten component (constant tijdens runtime)
const AUTH_CONFIGURED = isAuthConfigured();

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loginState, setLoginState] = useState<LoginState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Altijd hooks aanroepen (React rules of hooks)
  const signInHook = useSignIn();
  const authHook = useAuth();

  // Gebruik resultaat alleen als auth geconfigureerd is
  const signIn = AUTH_CONFIGURED ? signInHook.signIn : null;
  const setActive = AUTH_CONFIGURED ? signInHook.setActive : null;
  const isLoaded = AUTH_CONFIGURED ? signInHook.isLoaded : true;
  const isSignedIn = AUTH_CONFIGURED ? authHook.isSignedIn : false;

  // Redirect als al ingelogd
  useEffect(() => {
    if (isSignedIn) {
      router.replace('/(auth)/biometric');
    }
  }, [isSignedIn]);

  // Valideer email bij elke wijziging
  const validateEmail = useCallback((value: string) => {
    if (!value.trim()) {
      setEmailError(null);
      return false;
    }
    if (!EMAIL_REGEX.test(value)) {
      setEmailError('Voer een geldig e-mailadres in');
      return false;
    }
    setEmailError(null);
    return true;
  }, []);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    validateEmail(value);
    // Reset error state wanneer gebruiker begint te typen
    if (loginState === 'error') {
      setLoginState('idle');
      setErrorMessage(null);
    }
  };

  const handleSendCode = async () => {
    if (!validateEmail(email)) {
      Alert.alert('Fout', 'Voer een geldig e-mailadres in');
      return;
    }

    // Als auth niet geconfigureerd is, toon development mode
    if (!AUTH_CONFIGURED || !signIn) {
      Alert.alert(
        'Development Mode',
        'Clerk authenticatie is niet geconfigureerd. Voeg EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY toe aan .env.local',
        [{ text: 'OK' }]
      );
      return;
    }

    setLoginState('sending');
    setErrorMessage(null);

    try {
      // Start sign in flow met email identifier
      const { supportedFirstFactors } = await signIn.create({
        identifier: email.trim().toLowerCase(),
      });

      console.log('[Login] Supported factors:', supportedFirstFactors?.map(f => f.strategy));

      // Probeer eerst email_code (meest ondersteund)
      const emailCodeFactor = supportedFirstFactors?.find(
        (factor): factor is typeof factor & { strategy: 'email_code'; emailAddressId: string } =>
          factor.strategy === 'email_code'
      );

      if (emailCodeFactor) {
        // Stuur verificatie code
        await signIn.prepareFirstFactor({
          strategy: 'email_code',
          emailAddressId: emailCodeFactor.emailAddressId,
        });

        setLoginState('code_sent');
        return;
      }

      // Fallback naar email_link
      const emailLinkFactor = supportedFirstFactors?.find(
        (factor): factor is typeof factor & { strategy: 'email_link'; emailAddressId: string } =>
          factor.strategy === 'email_link'
      );

      if (emailLinkFactor) {
        // Genereer redirect URL voor de deep link
        const redirectUrl = Linking.createURL('callback', {
          scheme: 'toptuinen',
        });

        console.log('[Login] Redirect URL:', redirectUrl);

        // Start email link flow
        const { startEmailLinkFlow } = signIn.createEmailLinkFlow();

        // Stuur magic link email
        await startEmailLinkFlow({
          emailAddressId: emailLinkFactor.emailAddressId,
          redirectUrl: redirectUrl,
        });

        Alert.alert(
          'Magic Link Verzonden',
          `We hebben een inloglink verstuurd naar ${email}.\n\n` +
          'Open de email en klik op de link om in te loggen.',
          [{ text: 'OK' }]
        );
        setLoginState('idle');
        return;
      }

      // Geen ondersteunde methode gevonden
      setLoginState('error');
      setErrorMessage(
        'Geen ondersteunde login methode gevonden voor dit account. ' +
        'Neem contact op met de beheerder.'
      );

    } catch (error: any) {
      console.error('[Login] Error:', error);
      setLoginState('error');

      // Specifieke foutmeldingen
      const clerkError = error.errors?.[0];
      if (clerkError) {
        switch (clerkError.code) {
          case 'form_identifier_not_found':
            setErrorMessage(
              'Dit e-mailadres is niet geregistreerd. Neem contact op met de beheerder.'
            );
            break;
          case 'form_identifier_exists':
            setErrorMessage(
              'Er is al een inlogpoging gestart. Check je email of probeer opnieuw.'
            );
            break;
          case 'too_many_requests':
            setErrorMessage(
              'Te veel pogingen. Wacht een paar minuten en probeer opnieuw.'
            );
            break;
          default:
            setErrorMessage(clerkError.message || 'Er ging iets mis. Probeer het opnieuw.');
        }
      } else {
        setErrorMessage(
          error.message || 'Er ging iets mis. Probeer het opnieuw.'
        );
      }
    }
  };

  const handleVerifyCode = async () => {
    if (code.length < 6) {
      Alert.alert('Fout', 'Voer de 6-cijferige code in');
      return;
    }

    if (!signIn || !setActive) return;

    setLoginState('verifying');
    setErrorMessage(null);

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'email_code',
        code: code,
      });

      console.log('[Login] Verify result:', result.status);

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(auth)/biometric');
      } else {
        setLoginState('code_sent');
        setErrorMessage('Verificatie niet compleet. Probeer opnieuw.');
      }
    } catch (error: any) {
      console.error('[Login] Verify error:', error);
      setLoginState('code_sent');

      const clerkError = error.errors?.[0];
      if (clerkError?.code === 'form_code_incorrect') {
        setErrorMessage('Onjuiste code. Controleer en probeer opnieuw.');
      } else {
        setErrorMessage(clerkError?.message || 'Verificatie mislukt. Probeer opnieuw.');
      }
    }
  };

  // Loading state als Clerk nog niet geladen is
  if (!isLoaded) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#2d5016" />
        <Text style={styles.loadingText}>Laden...</Text>
      </View>
    );
  }

  // Code verificatie scherm
  if (loginState === 'code_sent' || loginState === 'verifying') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={[styles.logoContainer, styles.successContainer]}>
              <Feather name="mail" size={48} color="#2d5016" />
            </View>
            <Text style={styles.title}>Check je inbox</Text>
            <Text style={styles.sentSubtitle}>
              We hebben een code verstuurd naar:
            </Text>
            <Text style={styles.emailDisplay}>{email}</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Verificatiecode</Text>
            <TextInput
              style={[
                styles.input,
                styles.codeInput,
                errorMessage && styles.inputError,
              ]}
              value={code}
              onChangeText={(text) => {
                setCode(text.replace(/[^0-9]/g, '').slice(0, 6));
                setErrorMessage(null);
              }}
              placeholder="000000"
              placeholderTextColor="#999"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              editable={loginState !== 'verifying'}
            />

            {errorMessage && (
              <View style={styles.errorContainer}>
                <Feather name="alert-circle" size={16} color="#dc2626" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.button,
                (code.length < 6 || loginState === 'verifying') && styles.buttonDisabled,
              ]}
              onPress={handleVerifyCode}
              disabled={code.length < 6 || loginState === 'verifying'}
            >
              {loginState === 'verifying' ? (
                <ActivityIndicator size="small" color="#fff" style={styles.buttonIcon} />
              ) : (
                <Feather name="check" size={20} color="#fff" style={styles.buttonIcon} />
              )}
              <Text style={styles.buttonText}>
                {loginState === 'verifying' ? 'Verifiëren...' : 'Inloggen'}
              </Text>
            </TouchableOpacity>

            <View style={styles.sentActions}>
              <TouchableOpacity
                style={styles.resendButton}
                onPress={() => {
                  setCode('');
                  setErrorMessage(null);
                  handleSendCode();
                }}
              >
                <Feather name="refresh-cw" size={16} color="#2d5016" />
                <Text style={styles.resendButtonText}>Nieuwe code versturen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.changeEmailButton}
                onPress={() => {
                  setLoginState('idle');
                  setCode('');
                  setErrorMessage(null);
                }}
              >
                <Text style={styles.changeEmailText}>Ander e-mailadres</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Logo en titel */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Feather name="sun" size={48} color="#2d5016" />
          </View>
          <Text style={styles.title}>Top Tuinen</Text>
          <Text style={styles.subtitle}>Medewerkers App</Text>
        </View>

        {/* Login formulier */}
        <View style={styles.form}>
          <Text style={styles.label}>E-mailadres</Text>
          <TextInput
            style={[
              styles.input,
              emailError && styles.inputError,
              loginState === 'error' && styles.inputError,
            ]}
            value={email}
            onChangeText={handleEmailChange}
            placeholder="je@email.nl"
            placeholderTextColor="#999"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            editable={loginState !== 'sending'}
          />

          {/* Email validatie fout */}
          {emailError && (
            <Text style={styles.errorText}>{emailError}</Text>
          )}

          {/* Server error message */}
          {loginState === 'error' && errorMessage && (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={16} color="#dc2626" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.button,
              (!email.trim() || !!emailError || loginState === 'sending') &&
                styles.buttonDisabled,
            ]}
            onPress={handleSendCode}
            disabled={!email.trim() || !!emailError || loginState === 'sending'}
          >
            {loginState === 'sending' ? (
              <ActivityIndicator size="small" color="#fff" style={styles.buttonIcon} />
            ) : (
              <Feather
                name="mail"
                size={20}
                color="#fff"
                style={styles.buttonIcon}
              />
            )}
            <Text style={styles.buttonText}>
              {loginState === 'sending' ? 'Verzenden...' : 'Stuur inlogcode'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            We sturen een 6-cijferige code naar je e-mailadres.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#f0f9e8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successContainer: {
    backgroundColor: '#dcfce7',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2d5016',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  sentSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  emailDisplay: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
  },
  form: {
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  codeInput: {
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    fontWeight: '600',
  },
  inputError: {
    borderColor: '#dc2626',
    backgroundColor: '#fef2f2',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#dc2626',
    flex: 1,
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#2d5016',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  sentActions: {
    gap: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#f0f9e8',
  },
  resendButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d5016',
  },
  changeEmailButton: {
    paddingVertical: 8,
  },
  changeEmailText: {
    fontSize: 14,
    color: '#888',
  },
});
