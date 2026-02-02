import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
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
import { cn } from '@/lib/utils';

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
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#2d5016" />
        <Text className="mt-3 text-sm text-muted-foreground">Laden...</Text>
      </View>
    );
  }

  // Code verificatie scherm
  if (loginState === 'code_sent' || loginState === 'verifying') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-background"
      >
        <View className="flex-1 px-6 justify-center">
          <View className="items-center mb-12">
            <View className="w-24 h-24 rounded-full bg-green-100 items-center justify-center mb-4">
              <Feather name="mail" size={48} color="#2d5016" />
            </View>
            <Text className="text-3xl font-bold text-[#2d5016] mb-1">Check je inbox</Text>
            <Text className="text-base text-muted-foreground mt-2">
              We hebben een code verstuurd naar:
            </Text>
            <Text className="text-base font-semibold text-foreground mt-1">{email}</Text>
          </View>

          <View className="gap-4">
            <Text className="text-sm font-semibold text-foreground mb-1">Verificatiecode</Text>
            <TextInput
              className={cn(
                "border border-border rounded-xl px-4 py-3.5 text-2xl bg-card text-center font-semibold",
                errorMessage && "border-red-600 bg-red-50"
              )}
              style={{ letterSpacing: 8 }}
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
              <View className="flex-row items-start gap-2 bg-red-50 p-3 rounded-lg">
                <Feather name="alert-circle" size={16} color="#dc2626" />
                <Text className="text-xs text-red-600 flex-1">{errorMessage}</Text>
              </View>
            )}

            <TouchableOpacity
              className={cn(
                "flex-row bg-accent rounded-xl py-4 items-center justify-center mt-2",
                (code.length < 6 || loginState === 'verifying') && "bg-gray-300"
              )}
              onPress={handleVerifyCode}
              disabled={code.length < 6 || loginState === 'verifying'}
            >
              {loginState === 'verifying' ? (
                <ActivityIndicator size="small" color="#fff" className="mr-2" />
              ) : (
                <Feather name="check" size={20} color="#fff" className="mr-2" />
              )}
              <Text className="text-white text-base font-semibold">
                {loginState === 'verifying' ? 'Verifiëren...' : 'Inloggen'}
              </Text>
            </TouchableOpacity>

            <View className="gap-4 items-center mt-4">
              <TouchableOpacity
                className="flex-row items-center gap-2 py-3 px-5 rounded-lg bg-green-50"
                onPress={() => {
                  setCode('');
                  setErrorMessage(null);
                  handleSendCode();
                }}
              >
                <Feather name="refresh-cw" size={16} color="#2d5016" />
                <Text className="text-sm font-semibold text-[#2d5016]">Nieuwe code versturen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="py-2"
                onPress={() => {
                  setLoginState('idle');
                  setCode('');
                  setErrorMessage(null);
                }}
              >
                <Text className="text-sm text-muted-foreground">Ander e-mailadres</Text>
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
      className="flex-1 bg-background"
    >
      <View className="flex-1 px-6 justify-center">
        {/* Logo en titel */}
        <View className="items-center mb-12">
          <View className="w-24 h-24 rounded-full bg-green-50 items-center justify-center mb-4">
            <Feather name="sun" size={48} color="#2d5016" />
          </View>
          <Text className="text-3xl font-bold text-[#2d5016] mb-1">Top Tuinen</Text>
          <Text className="text-base text-muted-foreground">Medewerkers App</Text>
        </View>

        {/* Login formulier */}
        <View className="gap-4">
          <Text className="text-sm font-semibold text-foreground mb-1">E-mailadres</Text>
          <TextInput
            className={cn(
              "border border-border rounded-xl px-4 py-3.5 text-base bg-card",
              (emailError || loginState === 'error') && "border-red-600 bg-red-50"
            )}
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
            <Text className="text-xs text-red-600">{emailError}</Text>
          )}

          {/* Server error message */}
          {loginState === 'error' && errorMessage && (
            <View className="flex-row items-start gap-2 bg-red-50 p-3 rounded-lg">
              <Feather name="alert-circle" size={16} color="#dc2626" />
              <Text className="text-xs text-red-600 flex-1">{errorMessage}</Text>
            </View>
          )}

          <TouchableOpacity
            className={cn(
              "flex-row bg-accent rounded-xl py-4 items-center justify-center mt-2",
              (!email.trim() || !!emailError || loginState === 'sending') && "bg-gray-300"
            )}
            onPress={handleSendCode}
            disabled={!email.trim() || !!emailError || loginState === 'sending'}
          >
            {loginState === 'sending' ? (
              <ActivityIndicator size="small" color="#fff" className="mr-2" />
            ) : (
              <Feather
                name="mail"
                size={20}
                color="#fff"
                className="mr-2"
              />
            )}
            <Text className="text-white text-base font-semibold">
              {loginState === 'sending' ? 'Verzenden...' : 'Stuur inlogcode'}
            </Text>
          </TouchableOpacity>

          <Text className="text-xs text-muted-foreground text-center mt-2">
            We sturen een 6-cijferige code naar je e-mailadres.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

