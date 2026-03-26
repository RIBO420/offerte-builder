import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSignIn, useAuth } from '@clerk/clerk-expo';
import * as Linking from 'expo-linking';
import { isAuthConfigured } from '../../lib/env';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';

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
  const digitInputRefs = useRef<(TextInput | null)[]>([]);

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
      router.replace('/(tabs)');
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

  // Dev mode: quick login using a server-side endpoint that creates a sign-in token.
  // IMPORTANT: Never embed Clerk secret keys (sk_test_* / sk_live_*) in client code.
  // The server endpoint (e.g. a Convex HTTP action or Next.js API route) should hold
  // CLERK_SECRET_KEY and call https://api.clerk.com/v1/sign_in_tokens on our behalf.
  const handleDevLogin = async () => {
    if (!signIn || !setActive) return;

    setLoginState('sending');
    setErrorMessage(null);

    try {
      // Sign out any existing session first
      try {
        await authHook.signOut();
      } catch (_) {
        // Ignore sign-out errors
      }

      // Request a sign-in token from our own backend (keeps the secret key server-side)
      const devLoginUrl = process.env.EXPO_PUBLIC_DEV_LOGIN_URL;
      if (!devLoginUrl) {
        throw new Error(
          'EXPO_PUBLIC_DEV_LOGIN_URL is niet geconfigureerd. ' +
          'Stel een server-side dev-login endpoint in en voeg de URL toe aan .env.local.'
        );
      }

      const tokenRes = await fetch(devLoginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const tokenData = await tokenRes.json();

      if (!tokenData.token) {
        throw new Error('Kon geen sign-in token aanmaken via server');
      }

      // Use the ticket to sign in (bypasses all verification)
      const result = await signIn.create({
        strategy: 'ticket',
        ticket: tokenData.token,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)');
      } else {
        setLoginState('error');
        setErrorMessage('Dev login niet compleet: ' + result.status);
      }
    } catch (error: any) {
      console.error('[Login] Dev login error:', error);
      setLoginState('error');
      setErrorMessage(error.errors?.[0]?.message || error.message || 'Dev login mislukt');
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

  // Handle individual digit input for code
  const handleDigitChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const newCode = code.split('');
    newCode[index] = digit;
    const updatedCode = newCode.join('').slice(0, 6);
    setCode(updatedCode);
    setErrorMessage(null);

    // Auto-advance to next input
    if (digit && index < 5) {
      digitInputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      digitInputRefs.current[index - 1]?.focus();
      const newCode = code.split('');
      newCode[index - 1] = '';
      setCode(newCode.join(''));
    }
  };

  // Loading state als Clerk nog niet geladen is
  if (!isLoaded) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#4ADE80" />
          <Text style={styles.loadingText}>Laden...</Text>
        </View>
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
        <View style={styles.mainContent}>
          {/* Top section */}
          <View style={styles.topSection}>
            <Text style={styles.logoText}>TOP TUINEN</Text>
            <Text style={styles.heading}>Check je inbox</Text>
            <Text style={styles.subtitle}>
              We hebben een code verstuurd naar:
            </Text>
            <Text style={styles.emailDisplay}>{email}</Text>
          </View>

          {/* Code digit boxes */}
          <View style={styles.formSection}>
            <View style={styles.digitRow}>
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <TextInput
                  key={index}
                  ref={(ref) => { digitInputRefs.current[index] = ref; }}
                  style={[
                    styles.digitBox,
                    code[index] ? styles.digitBoxActive : null,
                    errorMessage ? styles.digitBoxError : null,
                  ]}
                  value={code[index] || ''}
                  onChangeText={(text) => handleDigitChange(text, index)}
                  onKeyPress={(e) => handleDigitKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  autoFocus={index === 0}
                  editable={loginState !== 'verifying'}
                  selectionColor="#4ADE80"
                />
              ))}
            </View>

            {errorMessage && (
              <Text style={styles.errorText}>{errorMessage}</Text>
            )}

            <TouchableOpacity
              style={[
                styles.submitButton,
                (code.length < 6 || loginState === 'verifying') && styles.submitButtonDisabled,
              ]}
              onPress={handleVerifyCode}
              disabled={code.length < 6 || loginState === 'verifying'}
            >
              {loginState === 'verifying' ? (
                <ActivityIndicator size="small" color="#4ADE80" style={{ marginRight: 8 }} />
              ) : null}
              <Text style={styles.submitButtonText}>
                {loginState === 'verifying' ? 'Verifieren...' : 'Inloggen'}
              </Text>
            </TouchableOpacity>

            <View style={styles.codeActions}>
              <TouchableOpacity
                style={styles.resendButton}
                onPress={() => {
                  setCode('');
                  setErrorMessage(null);
                  handleSendCode();
                }}
              >
                <Feather name="refresh-cw" size={14} color="#6B8F6B" />
                <Text style={styles.resendText}>Nieuwe code versturen</Text>
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

        {/* Bottom decorative gradient */}
        <LinearGradient
          colors={['transparent', '#1A2E1A10']}
          style={styles.bottomGradient}
        />
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.mainContent}>
        {/* Top section - logo and heading */}
        <View style={styles.topSection}>
          <Text style={styles.logoText}>TOP TUINEN</Text>
          <Text style={styles.heading}>Welkom terug</Text>
          <Text style={styles.subtitle}>Medewerkers App</Text>
        </View>

        {/* Login form */}
        <View style={styles.formSection}>
          <TextInput
            style={[
              styles.emailInput,
              (emailError || loginState === 'error') && styles.emailInputError,
            ]}
            value={email}
            onChangeText={handleEmailChange}
            placeholder="je@email.nl"
            placeholderTextColor={colors.inactive}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            editable={loginState !== 'sending'}
            selectionColor="#4ADE80"
          />

          {/* Email validatie fout */}
          {emailError && (
            <Text style={styles.errorText}>{emailError}</Text>
          )}

          {/* Server error message */}
          {loginState === 'error' && errorMessage && (
            <Text style={styles.errorText}>{errorMessage}</Text>
          )}

          <TouchableOpacity
            style={[
              styles.submitButton,
              (!email.trim() || !!emailError || loginState === 'sending') && styles.submitButtonDisabled,
            ]}
            onPress={handleSendCode}
            disabled={!email.trim() || !!emailError || loginState === 'sending'}
          >
            {loginState === 'sending' ? (
              <ActivityIndicator size="small" color="#4ADE80" style={{ marginRight: 8 }} />
            ) : null}
            <Text style={styles.submitButtonText}>
              {loginState === 'sending' ? 'Verzenden...' : 'Stuur inlogcode'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.hintText}>
            We sturen een 6-cijferige code naar je e-mailadres.
          </Text>

          {/* Dev mode: password login */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.devButton}
              onPress={handleDevLogin}
              disabled={loginState === 'sending'}
            >
              <Feather name="zap" size={18} color="#F97316" />
              <Text style={styles.devButtonText}>
                Dev Login (medewerker)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Bottom decorative gradient */}
      <LinearGradient
        colors={['transparent', '#1A2E1A10']}
        style={styles.bottomGradient}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#888',
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  topSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoText: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 3,
    color: '#6B8F6B',
    fontWeight: '600',
  },
  heading: {
    fontSize: 28,
    fontWeight: '600',
    color: '#E8E8E8',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 6,
  },
  emailDisplay: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E8E8E8',
    marginTop: 4,
  },
  formSection: {
    gap: 16,
  },
  emailInput: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#E8E8E8',
  },
  emailInputError: {
    borderColor: '#EF4444',
  },
  digitRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  digitBox: {
    width: 48,
    height: 56,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: 'bold',
    color: '#E8E8E8',
  },
  digitBoxActive: {
    borderColor: '#4ADE80',
  },
  digitBoxError: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 11,
    color: '#EF4444',
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#1A2E1A',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4ADE80',
  },
  hintText: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
  codeActions: {
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resendText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B8F6B',
  },
  changeEmailButton: {
    paddingVertical: 6,
  },
  changeEmailText: {
    fontSize: 13,
    color: '#888',
  },
  devButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A1A0A',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginTop: 8,
  },
  devButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F97316',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    pointerEvents: 'none',
  },
});
