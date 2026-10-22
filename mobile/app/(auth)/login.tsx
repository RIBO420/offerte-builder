import { useState, useEffect, useCallback, useRef, type ComponentType, type ReactNode } from 'react';
import {
  View,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Text, TextInput } from '../../components/ui/Tekst';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Leaf, RefreshCw, Zap } from 'lucide-react-native';
import { useSignIn, useAuth, useSSO } from '@clerk/clerk-expo';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { isAuthConfigured } from '../../lib/env';
import { LinearGradient } from 'expo-linear-gradient';
import { tekst, useColors } from '../../theme';
import { Button, Input } from '../../components/ui';
import { Drukvlak, IcoonTegel, Melding } from '../../components/werk/Bouwstenen';

// Complete any pending auth sessions (required for OAuth redirect flow)
WebBrowser.maybeCompleteAuthSession();

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
  const [password, setPassword] = useState('');
  const [passwordMode, setPasswordMode] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loginState, setLoginState] = useState<LoginState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const digitInputRefs = useRef<(TextInput | null)[]>([]);
  const wachtwoordRef = useRef<TextInput>(null);
  const kleuren = useColors();

  // Altijd hooks aanroepen (React rules of hooks)
  const signInHook = useSignIn();
  const authHook = useAuth();
  const { startSSOFlow } = useSSO();

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
  }, [isSignedIn, router]);

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
          'Start `npm run dev:login -- --mobiel` en zet de geprinte URL in mobile/.env.local.'
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
        // Geen router.replace: OrgGate remount de stack na setActive en de
        // isSignedIn-effect hierboven navigeert al (anders 'REPLACE not handled').
        await setActive({ session: result.createdSessionId });
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

  const handleGoogleLogin = async () => {
    if (!AUTH_CONFIGURED) {
      Alert.alert('Development Mode', 'Clerk authenticatie is niet geconfigureerd.');
      return;
    }

    setLoginState('sending');
    setErrorMessage(null);

    try {
      const redirectUrl = Linking.createURL('callback', { scheme: 'toptuinen' });

      const { createdSessionId, setActive: ssoSetActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl,
      });

      if (createdSessionId && ssoSetActive) {
        await ssoSetActive({ session: createdSessionId });
        router.replace('/(auth)/biometric');
      } else {
        setLoginState('idle');
        setErrorMessage('Google login niet compleet. Probeer opnieuw.');
      }
    } catch (error: any) {
      console.error('[Login] Google OAuth error:', error);
      setLoginState('idle');

      if (error.message?.includes('cancelled') || error.message?.includes('dismiss')) {
        // User cancelled - no error message needed
        return;
      }

      const clerkError = error.errors?.[0];
      setErrorMessage(
        clerkError?.message || error.message || 'Google login mislukt. Probeer opnieuw.'
      );
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

  const handlePasswordLogin = async () => {
    if (!validateEmail(email) || !password || !signIn || !setActive) return;
    setLoginState('sending');
    setErrorMessage(null);
    try {
      const result = await signIn.create({ identifier: email.trim().toLowerCase(), password });
      if (result.status === 'complete') {
        setPassword('');
        await setActive({ session: result.createdSessionId });
        router.replace('/(auth)/biometric');
      } else {
        setLoginState('error');
        setErrorMessage('Je account vraagt een extra verificatiestap. Gebruik een inlogcode of Google.');
      }
    } catch (error) {
      setLoginState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Inloggen mislukt. Controleer je gegevens of gebruik een inlogcode.');
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
    const cijfers = text.replace(/[^0-9]/g, '');
    // Autofill of plakken: iOS zet de hele code in het eerste vakje.
    if (cijfers.length === 6) {
      setCode(cijfers);
      setErrorMessage(null);
      digitInputRefs.current[5]?.focus();
      return;
    }
    const digit = cijfers.slice(-1);
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

  const bezig = loginState === 'sending';
  const kanVersturen = !!email.trim() && !emailError && !bezig;

  // Loading state als Clerk nog niet geladen is
  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: kleuren.background }}>
        <ActivityIndicator size="large" color={kleuren.primary} />
        <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Laden…</Text>
      </View>
    );
  }

  // Code verificatie scherm
  if (loginState === 'code_sent' || loginState === 'verifying') {
    const verifieren = loginState === 'verifying';
    return (
      <Scherm>
        <View style={{ gap: 8 }}>
          <Merk />
          <Text accessibilityRole="header" style={[tekst.titel1, { color: kleuren.foreground, marginTop: 20 }]}>
            Check je inbox
          </Text>
          <Text style={[tekst.callout, { color: kleuren.mutedForeground }]}>
            We hebben een code gestuurd naar{' '}
            <Text style={{ color: kleuren.foreground, fontWeight: '600' }}>{email}</Text>
          </Text>
        </View>

        <View style={{ gap: 16 }}>
          <View style={{ gap: 8 }}>
            <Text style={[tekst.sub, { color: kleuren.foreground, fontWeight: '600' }]}>Inlogcode</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[0, 1, 2, 3, 4, 5].map((index) => {
                const gevuld = !!code[index];
                return (
                  <TextInput
                    key={index}
                    ref={(ref) => { digitInputRefs.current[index] = ref; }}
                    style={[
                      tekst.titel2,
                      tekst.cijfers,
                      {
                        flex: 1,
                        height: 60,
                        // Geen lineHeight op een TextInput: iOS verschuift dan de cursor.
                        lineHeight: undefined,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: errorMessage ? kleuren.danger : gevuld ? kleuren.primary : kleuren.randSterk,
                        backgroundColor: kleuren.input,
                        color: kleuren.foreground,
                        textAlign: 'center',
                      },
                    ]}
                    value={code[index] || ''}
                    onChangeText={(text) => handleDigitChange(text, index)}
                    onKeyPress={(e) => handleDigitKeyPress(e, index)}
                    keyboardType="number-pad"
                    textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    // Het eerste vakje neemt een geplakte of ingevulde code in één keer aan.
                    maxLength={index === 0 ? 6 : 1}
                    autoFocus={index === 0}
                    editable={!verifieren}
                    selectionColor={kleuren.primary}
                    accessibilityLabel={`Inlogcode, cijfer ${index + 1} van 6`}
                  />
                );
              })}
            </View>
          </View>

          {errorMessage && <Melding tekst={errorMessage} toon="gemist" />}

          <Button
            title={verifieren ? 'Verifiëren…' : 'Inloggen'}
            size="lg"
            fullWidth
            loading={verifieren}
            onPress={handleVerifyCode}
            disabled={code.length < 6 || verifieren}
          />

          <View style={{ alignItems: 'center', gap: 4 }}>
            <TekstKnop
              label="Nieuwe code versturen"
              icoon={RefreshCw}
              onPress={() => {
                setCode('');
                setErrorMessage(null);
                handleSendCode();
              }}
            />
            <TekstKnop
              label="Ander e-mailadres"
              gedempt
              onPress={() => {
                setLoginState('idle');
                setCode('');
                setErrorMessage(null);
              }}
            />
          </View>
        </View>
      </Scherm>
    );
  }

  return (
    <Scherm>
      <View style={{ gap: 8 }}>
        <Merk />
        <Text accessibilityRole="header" style={[tekst.titel1, { color: kleuren.foreground, marginTop: 20 }]}>
          Welkom terug
        </Text>
        <Text style={[tekst.callout, { color: kleuren.mutedForeground }]}>Log in op de medewerkersapp.</Text>
      </View>

      <View style={{ gap: 16 }}>
        <Input
          label="E-mailadres"
          className="mb-0"
          value={email}
          onChangeText={handleEmailChange}
          error={emailError ?? undefined}
          status={loginState === 'error' ? 'invalid' : 'idle'}
          placeholder="je@email.nl"
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType={passwordMode ? 'next' : 'send'}
          onSubmitEditing={() => {
            if (passwordMode) wachtwoordRef.current?.focus();
            else if (kanVersturen) handleSendCode();
          }}
          disabled={bezig}
        />

        {passwordMode && (
          <Input
            ref={wachtwoordRef}
            label="Wachtwoord"
            className="mb-0"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={() => {
              if (kanVersturen) handlePasswordLogin();
            }}
            disabled={bezig}
          />
        )}

        {/* Server error message */}
        {errorMessage && <Melding tekst={errorMessage} toon="gemist" />}

        <Button
          title={bezig ? 'Even geduld…' : passwordMode ? 'Inloggen' : 'Stuur inlogcode'}
          size="lg"
          fullWidth
          loading={bezig}
          onPress={passwordMode ? handlePasswordLogin : handleSendCode}
          disabled={!kanVersturen}
        />

        <Text style={[tekst.sub, { color: kleuren.mutedForeground, textAlign: 'center' }]}>
          {passwordMode ? 'Wachtwoord vergeten? Gebruik een inlogcode om je account te openen.' : 'We sturen een 6-cijferige code naar je e-mailadres.'}
        </Text>

        <View style={{ alignItems: 'center' }}>
          <TekstKnop
            label={passwordMode ? 'Inloggen met een code' : 'Inloggen met wachtwoord'}
            disabled={bezig}
            onPress={() => { setPasswordMode(!passwordMode); setPassword(''); setErrorMessage(null); }}
          />
        </View>

        {/* Divider */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: kleuren.border }} />
          <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground }]}>of</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: kleuren.border }} />
        </View>

        {/* Google OAuth login */}
        <Button
          title="Inloggen met Google"
          variant="secondary"
          size="lg"
          fullWidth
          onPress={handleGoogleLogin}
          disabled={bezig}
        />

        {/* Dev mode: login via server-side sign-in token */}
        {__DEV__ && (
          <Drukvlak
            onPress={handleDevLogin}
            disabled={bezig}
            accessibilityLabel="Dev Login (medewerker)"
            accessibilityHint="Alleen in ontwikkelbuilds"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              minHeight: 48,
              borderRadius: 12,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: kleuren.warning,
              backgroundColor: kleuren.warningSoft,
            }}
          >
            <Zap size={18} color={kleuren.warning} strokeWidth={2} />
            <Text style={[tekst.callout, { color: kleuren.warning, fontWeight: '600' }]}>Dev Login (medewerker)</Text>
          </Drukvlak>
        )}
      </View>
    </Scherm>
  );
}

/** Logo-lockup: blad in een icoontegel naast de naam. */
function Merk() {
  const kleuren = useColors();
  return (
    <View
      accessible
      accessibilityLabel="Top Tuinen"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
    >
      <IcoonTegel icoon={Leaf} toon="primair" grootte={40} />
      <Text style={[tekst.titel3, { color: kleuren.foreground }]}>Top Tuinen</Text>
    </View>
  );
}

/** Schermraam: veilige marges, toetsenbordruimte en een zachte groene was bovenin. */
function Scherm({ children }: { children: ReactNode }) {
  const kleuren = useColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: kleuren.background }} edges={['top', 'bottom']}>
      <LinearGradient
        pointerEvents="none"
        colors={[kleuren.primarySoft, kleuren.background]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 320 }}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center', gap: 32 }}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Tekstknop met een raakvlak van 44pt: voor de stille nevenroutes. */
function TekstKnop({
  label,
  onPress,
  icoon: I,
  gedempt,
  disabled,
}: {
  label: string;
  onPress: () => void;
  icoon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  gedempt?: boolean;
  disabled?: boolean;
}) {
  const kleuren = useColors();
  const kleur = gedempt ? kleuren.mutedForeground : kleuren.primary;
  return (
    <Drukvlak
      onPress={onPress}
      disabled={disabled}
      haptic="selection"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 12 }}
    >
      {I && <I size={16} color={kleur} strokeWidth={2} />}
      <Text style={[tekst.callout, { color: kleur, fontWeight: '600' }]}>{label}</Text>
    </Drukvlak>
  );
}
