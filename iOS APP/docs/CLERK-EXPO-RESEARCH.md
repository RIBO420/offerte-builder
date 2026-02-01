# Clerk Expo Integratie Research

**Datum:** 2026-02-01
**Project:** Top Tuinen Medewerkers App
**Versie:** 1.0

---

## Inhoudsopgave

1. [Overzicht](#1-overzicht)
2. [Setup Stappen](#2-setup-stappen)
3. [ClerkProvider Configuratie](#3-clerkprovider-configuratie)
4. [SecureStore Token Cache](#4-securestore-token-cache)
5. [Clerk Organizations](#5-clerk-organizations)
6. [Magic Link Login Flow](#6-magic-link-login-flow)
7. [Biometric Authentication](#7-biometric-authentication)
8. [Webhook Setup](#8-webhook-setup)
9. [Best Practices](#9-best-practices)
10. [Potentiele Issues en Oplossingen](#10-potentiele-issues-en-oplossingen)

---

## 1. Overzicht

### Huidige Situatie
Het bestaande offerte-builder project gebruikt al `@clerk/nextjs` voor authenticatie in de web applicatie. De configuratie in `apps/web/src/app/layout.tsx` toont:

```tsx
import { ClerkProvider } from "@clerk/nextjs";
import { nlNL } from "@clerk/localizations";

// ...

<ClerkProvider localization={nlNL}>
  {/* ... */}
</ClerkProvider>
```

### Doel
De Expo mobile app moet dezelfde Clerk instance gebruiken zodat:
- Medewerkers kunnen inloggen met dezelfde accounts
- Organizations (bedrijven) consistent zijn tussen web en mobile
- Sessies veilig worden opgeslagen op het device

### Benodigde Packages

```bash
# Core Clerk Expo package
npx expo install @clerk/clerk-expo

# Required peer dependencies
npx expo install expo-secure-store expo-web-browser expo-linking
```

---

## 2. Setup Stappen

### Stap 1: Package Installatie

```bash
cd apps/mobile

# Installeer Clerk Expo SDK
npx expo install @clerk/clerk-expo

# Installeer required dependencies
npx expo install expo-secure-store expo-web-browser expo-linking

# Voor biometrics (later nodig)
npx expo install expo-local-authentication
```

### Stap 2: Environment Variables

Maak `.env` bestand in `apps/mobile`:

```bash
# apps/mobile/.env
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx
EXPO_PUBLIC_CONVEX_URL=https://xxx.convex.cloud
```

**Belangrijk:** De `EXPO_PUBLIC_` prefix is vereist voor Expo om de variabelen beschikbaar te maken in de client-side code.

### Stap 3: App Config (app.json)

```json
{
  "expo": {
    "name": "Top Tuinen",
    "slug": "top-tuinen",
    "scheme": "toptuinen",
    "ios": {
      "bundleIdentifier": "nl.toptuinen.medewerkers",
      "infoPlist": {
        "NSFaceIDUsageDescription": "Gebruik Face ID om snel en veilig in te loggen op Top Tuinen"
      }
    },
    "android": {
      "package": "nl.toptuinen.medewerkers"
    }
  }
}
```

### Stap 4: Deep Linking Setup

In `app.json` voor magic links:

```json
{
  "expo": {
    "scheme": "toptuinen"
  }
}
```

Dit maakt URLs mogelijk zoals `toptuinen://auth/callback`.

---

## 3. ClerkProvider Configuratie

### Basis Setup

```tsx
// apps/mobile/app/_layout.tsx

import { ClerkProvider, ClerkLoaded } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { Slot } from 'expo-router';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY');
}

export default function RootLayout() {
  return (
    <ClerkProvider
      tokenCache={tokenCache}
      publishableKey={publishableKey}
    >
      <ClerkLoaded>
        <Slot />
      </ClerkLoaded>
    </ClerkProvider>
  );
}
```

### Met Convex Integratie

```tsx
// apps/mobile/app/_layout.tsx

import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';
import { Slot } from 'expo-router';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

export default function RootLayout() {
  return (
    <ClerkProvider
      tokenCache={tokenCache}
      publishableKey={publishableKey}
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <Slot />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
```

### Met Offline Support (Experimenteel)

Voor apps die moeten werken zonder internetverbinding bij het opstarten:

```tsx
// apps/mobile/app/_layout.tsx

import { ClerkProvider } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { resourceCache } from '@clerk/clerk-expo/resource-cache';
import { Slot } from 'expo-router';

export default function RootLayout() {
  return (
    <ClerkProvider
      tokenCache={tokenCache}
      __experimental_resourceCache={resourceCache}
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
    >
      <Slot />
    </ClerkProvider>
  );
}
```

**Let op:** `resourceCache` is een experimentele feature. Gebruik deze alleen als offline support cruciaal is.

---

## 4. SecureStore Token Cache

### Waarom SecureStore?

- **Encryptie:** Tokens worden versleuteld opgeslagen
- **Keychain (iOS) / Keystore (Android):** Maakt gebruik van platform-specifieke secure storage
- **Persistence:** Tokens blijven behouden na app restart

### Automatische Token Cache

Clerk Expo biedt een ingebouwde token cache die `expo-secure-store` gebruikt:

```tsx
import { tokenCache } from '@clerk/clerk-expo/token-cache';

<ClerkProvider tokenCache={tokenCache}>
  {/* ... */}
</ClerkProvider>
```

### Custom Token Cache Implementatie

Als je meer controle nodig hebt:

```tsx
// apps/mobile/lib/auth/token-cache.ts

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const createTokenCache = () => {
  return {
    getToken: async (key: string): Promise<string | null> => {
      try {
        const item = await SecureStore.getItemAsync(key);
        if (item) {
          console.log(`Token retrieved for key: ${key.substring(0, 10)}...`);
        }
        return item;
      } catch (error) {
        console.error('Error getting token:', error);
        await SecureStore.deleteItemAsync(key);
        return null;
      }
    },

    saveToken: async (key: string, token: string): Promise<void> => {
      try {
        await SecureStore.setItemAsync(key, token, {
          // iOS only: bepaalt wanneer het item toegankelijk is
          keychainAccessible: SecureStore.WHEN_UNLOCKED,
        });
      } catch (error) {
        console.error('Error saving token:', error);
      }
    },

    clearToken: async (key: string): Promise<void> => {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (error) {
        console.error('Error clearing token:', error);
      }
    },
  };
};

export const tokenCache = createTokenCache();
```

### SecureStore Opties

```typescript
interface SecureStoreOptions {
  // iOS-only: Bepaalt wanneer keychain item toegankelijk is
  keychainAccessible?: KeychainAccessibilityConstant;

  // iOS-only: Keychain service name
  keychainService?: string;

  // iOS-only: Vereist biometric authentication voor toegang
  requireAuthentication?: boolean;

  // iOS-only: Bericht getoond bij biometric prompt
  authenticationPrompt?: string;
}

// Accessibility opties:
SecureStore.WHEN_UNLOCKED              // Default, toegankelijk als device unlocked
SecureStore.AFTER_FIRST_UNLOCK         // Toegankelijk na eerste unlock na reboot
SecureStore.ALWAYS                     // Altijd toegankelijk (minder veilig)
SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY  // Meest veilig
```

---

## 5. Clerk Organizations

### Overzicht

Organizations in Clerk maken het mogelijk om:
- Medewerkers te groeperen per bedrijf
- Rollen en permissies te beheren
- Team-specifieke toegang te configureren

### Organization Hooks

```tsx
// apps/mobile/hooks/use-organization.ts

import {
  useOrganization,
  useOrganizationList,
  useAuth
} from '@clerk/clerk-expo';

export function useCurrentOrganization() {
  const { organization, membership, isLoaded } = useOrganization();

  return {
    organization,
    membership,
    isLoaded,
    isAdmin: membership?.role === 'org:admin',
    isMember: membership?.role === 'org:member',
  };
}

export function useOrganizations() {
  const {
    organizationList,
    setActive,
    isLoaded
  } = useOrganizationList();

  const switchOrganization = async (orgId: string) => {
    await setActive({ organization: orgId });
  };

  return {
    organizations: organizationList?.map(m => m.organization) || [],
    switchOrganization,
    isLoaded,
  };
}
```

### Organization Membership Controle

```tsx
// apps/mobile/components/auth/organization-guard.tsx

import { useOrganization } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';

interface OrganizationGuardProps {
  children: React.ReactNode;
  requiredRole?: 'org:admin' | 'org:member';
}

export function OrganizationGuard({ children, requiredRole }: OrganizationGuardProps) {
  const { organization, membership, isLoaded } = useOrganization();

  if (!isLoaded) {
    return <LoadingSpinner />;
  }

  if (!organization) {
    return <Redirect href="/select-organization" />;
  }

  if (requiredRole && membership?.role !== requiredRole) {
    return <Redirect href="/unauthorized" />;
  }

  return <>{children}</>;
}
```

### Medewerker Uitnodigen

```tsx
// apps/mobile/lib/auth/invite-member.ts

import { useOrganization } from '@clerk/clerk-expo';

export function useInviteMember() {
  const { organization } = useOrganization();

  const inviteMember = async (email: string, role: 'org:admin' | 'org:member' = 'org:member') => {
    if (!organization) {
      throw new Error('No organization selected');
    }

    try {
      const invitation = await organization.inviteMember({
        emailAddress: email,
        role: role,
      });

      return invitation;
    } catch (error) {
      console.error('Failed to invite member:', error);
      throw error;
    }
  };

  const inviteMembers = async (emails: string[], role: 'org:admin' | 'org:member' = 'org:member') => {
    if (!organization) {
      throw new Error('No organization selected');
    }

    try {
      const invitations = await organization.inviteMembers({
        emailAddresses: emails,
        role: role,
      });

      return invitations;
    } catch (error) {
      console.error('Failed to invite members:', error);
      throw error;
    }
  };

  return { inviteMember, inviteMembers };
}
```

### Organization Rollen Configuratie

In het Clerk Dashboard, configureer rollen:

| Rol | Key | Permissies |
|-----|-----|------------|
| Eigenaar | `org:admin` | Volledige toegang, medewerkers beheren |
| Medewerker | `org:member` | Uren registreren, projecten bekijken |

Custom permissies kunnen worden toegevoegd:

```
org:manage_employees     - Medewerkers toevoegen/verwijderen
org:view_reports        - Rapporten inzien
org:manage_projects     - Projecten beheren
org:register_hours      - Uren registreren
```

---

## 6. Magic Link Login Flow

### Waarom Magic Links?

- **Geen wachtwoord nodig:** Veiliger en gebruiksvriendelijker
- **Email verificatie inbegrepen:** Automatische verificatie
- **Ideaal voor mobile:** Geen copy-paste van wachtwoorden

### Setup

#### Stap 1: Deep Link Configuratie

```json
// app.json
{
  "expo": {
    "scheme": "toptuinen",
    "ios": {
      "associatedDomains": ["applinks:app.toptuinen.nl"]
    },
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "https",
              "host": "app.toptuinen.nl",
              "pathPrefix": "/auth"
            },
            {
              "scheme": "toptuinen"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

#### Stap 2: Login Screen

```tsx
// apps/mobile/app/(auth)/login.tsx

import { useState } from 'react';
import { View, TextInput, Text, Pressable, Alert } from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';

export default function LoginScreen() {
  const { signIn, isLoaded } = useSignIn();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleMagicLink = async () => {
    if (!isLoaded || !signIn) return;

    setIsLoading(true);

    try {
      // Start sign-in met email link strategie
      const { supportedFirstFactors } = await signIn.create({
        identifier: email,
      });

      // Vind de email link factor
      const emailLinkFactor = supportedFirstFactors?.find(
        (factor) => factor.strategy === 'email_link'
      );

      if (!emailLinkFactor || emailLinkFactor.strategy !== 'email_link') {
        Alert.alert('Fout', 'Magic link is niet beschikbaar voor dit account');
        return;
      }

      // Maak de redirect URL
      const redirectUrl = Linking.createURL('/auth/callback');

      // Start de email link flow
      const { startEmailLinkFlow } = signIn.createEmailLinkFlow();

      await startEmailLinkFlow({
        emailAddressId: emailLinkFactor.emailAddressId,
        redirectUrl: redirectUrl,
      });

      // Navigeer naar check-email scherm
      router.push({
        pathname: '/(auth)/check-email',
        params: { email },
      });

    } catch (error: any) {
      console.error('Magic link error:', error);
      Alert.alert(
        'Fout',
        error.errors?.[0]?.message || 'Er ging iets mis. Probeer het opnieuw.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white p-6 justify-center">
      <Text className="text-3xl font-bold text-center mb-2">
        Top Tuinen
      </Text>
      <Text className="text-gray-500 text-center mb-8">
        Log in met je e-mailadres
      </Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="je@email.nl"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4 text-lg"
      />

      <Pressable
        onPress={handleMagicLink}
        disabled={!email || isLoading}
        className={`rounded-lg py-4 ${
          email && !isLoading ? 'bg-green-600' : 'bg-gray-300'
        }`}
      >
        <Text className="text-white text-center font-semibold text-lg">
          {isLoading ? 'Bezig...' : 'Stuur magic link'}
        </Text>
      </Pressable>
    </View>
  );
}
```

#### Stap 3: Check Email Screen

```tsx
// apps/mobile/app/(auth)/check-email.tsx

import { View, Text, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function CheckEmailScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const router = useRouter();

  return (
    <View className="flex-1 bg-white p-6 justify-center items-center">
      <View className="bg-green-100 w-20 h-20 rounded-full items-center justify-center mb-6">
        <Ionicons name="mail-outline" size={40} color="#16a34a" />
      </View>

      <Text className="text-2xl font-bold text-center mb-2">
        Check je email
      </Text>

      <Text className="text-gray-500 text-center mb-8">
        We hebben een magic link gestuurd naar{'\n'}
        <Text className="font-semibold text-gray-700">{email}</Text>
      </Text>

      <Text className="text-gray-400 text-center text-sm mb-8">
        Klik op de link in de email om in te loggen.{'\n'}
        De link is 10 minuten geldig.
      </Text>

      <Pressable
        onPress={() => router.back()}
        className="py-3"
      >
        <Text className="text-green-600 font-semibold">
          Ander e-mailadres gebruiken
        </Text>
      </Pressable>
    </View>
  );
}
```

#### Stap 4: Callback Handler

```tsx
// apps/mobile/app/auth/callback.tsx

import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useAuth, useSignIn } from '@clerk/clerk-expo';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function AuthCallbackScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    if (!isLoaded) return;

    const handleCallback = async () => {
      try {
        // Clerk handelt de verificatie automatisch af
        // via de URL parameters

        if (signIn?.status === 'complete' && signIn.createdSessionId) {
          await setActive({ session: signIn.createdSessionId });
          router.replace('/(app)/dashboard');
        }
      } catch (error) {
        console.error('Callback error:', error);
        router.replace('/(auth)/login');
      }
    };

    if (isSignedIn) {
      router.replace('/(app)/dashboard');
    } else {
      handleCallback();
    }
  }, [isLoaded, isSignedIn, signIn?.status]);

  return (
    <View className="flex-1 bg-white justify-center items-center">
      <ActivityIndicator size="large" color="#16a34a" />
      <Text className="text-gray-500 mt-4">Even geduld...</Text>
    </View>
  );
}
```

---

## 7. Biometric Authentication

### Overzicht

Biometric authentication (Face ID / Touch ID) wordt gebruikt als snelle re-login methode nadat de gebruiker eenmaal is ingelogd.

### Implementatie Strategie

1. **Eerste login:** Via magic link (of andere methode)
2. **Biometric setup:** Na succesvolle login, vraag om biometric te activeren
3. **Volgende keer:** Gebruik biometrics voor snelle toegang
4. **Fallback:** Als biometric faalt, terug naar magic link

### Biometric Service

```tsx
// apps/mobile/lib/auth/biometric-service.ts

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const SESSION_TOKEN_KEY = 'biometric_session_token';

export const BiometricService = {
  /**
   * Check of biometrics beschikbaar is op dit device
   */
  async isAvailable(): Promise<boolean> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  },

  /**
   * Bepaal het type biometric (face of fingerprint)
   */
  async getBiometricType(): Promise<'face' | 'fingerprint' | null> {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'face';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'fingerprint';
    }
    return null;
  },

  /**
   * Check of biometric login is ingeschakeld voor deze gebruiker
   */
  async isEnabled(): Promise<boolean> {
    const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    return enabled === 'true';
  },

  /**
   * Activeer biometric login en sla session token op
   */
  async enable(sessionToken: string): Promise<boolean> {
    const available = await this.isAvailable();
    if (!available) {
      return false;
    }

    try {
      // Sla de session token veilig op
      await SecureStore.setItemAsync(SESSION_TOKEN_KEY, sessionToken, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
      });

      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');

      return true;
    } catch (error) {
      console.error('Failed to enable biometric:', error);
      return false;
    }
  },

  /**
   * Deactiveer biometric login
   */
  async disable(): Promise<void> {
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
    await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
  },

  /**
   * Authenticeer met biometrics en return session token
   */
  async authenticate(): Promise<{ success: boolean; token?: string; error?: string }> {
    const isEnabled = await this.isEnabled();

    if (!isEnabled) {
      return { success: false, error: 'Biometric login is niet ingeschakeld' };
    }

    const biometricType = await this.getBiometricType();
    const promptMessage = biometricType === 'face'
      ? 'Log in met Face ID'
      : 'Log in met je vingerafdruk';

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: 'Gebruik pincode',
        disableDeviceFallback: false,
        cancelLabel: 'Annuleren',
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Authenticatie mislukt'
        };
      }

      // Haal de opgeslagen session token op
      const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);

      if (!token) {
        // Token is verlopen of verwijderd
        await this.disable();
        return {
          success: false,
          error: 'Sessie verlopen. Log opnieuw in.'
        };
      }

      return { success: true, token };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Er ging iets mis'
      };
    }
  },
};
```

### Biometric Hook

```tsx
// apps/mobile/hooks/use-biometric.ts

import { useState, useEffect, useCallback } from 'react';
import { BiometricService } from '@/lib/auth/biometric-service';

export function useBiometric() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<'face' | 'fingerprint' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkBiometric();
  }, []);

  const checkBiometric = async () => {
    setIsLoading(true);
    try {
      const available = await BiometricService.isAvailable();
      const enabled = await BiometricService.isEnabled();
      const type = await BiometricService.getBiometricType();

      setIsAvailable(available);
      setIsEnabled(enabled);
      setBiometricType(type);
    } finally {
      setIsLoading(false);
    }
  };

  const enableBiometric = useCallback(async (sessionToken: string) => {
    const success = await BiometricService.enable(sessionToken);
    if (success) {
      setIsEnabled(true);
    }
    return success;
  }, []);

  const disableBiometric = useCallback(async () => {
    await BiometricService.disable();
    setIsEnabled(false);
  }, []);

  const authenticate = useCallback(async () => {
    return BiometricService.authenticate();
  }, []);

  return {
    isAvailable,
    isEnabled,
    biometricType,
    isLoading,
    enableBiometric,
    disableBiometric,
    authenticate,
    refresh: checkBiometric,
  };
}
```

### Login Screen met Biometric

```tsx
// apps/mobile/app/(auth)/login.tsx

import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { useSignIn, useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBiometric } from '@/hooks/use-biometric';

export default function LoginScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { getToken } = useAuth();
  const router = useRouter();
  const {
    isAvailable: biometricAvailable,
    isEnabled: biometricEnabled,
    biometricType,
    authenticate
  } = useBiometric();

  const [email, setEmail] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-attempt biometric login op mount
  useEffect(() => {
    if (biometricEnabled && !showEmailForm) {
      handleBiometricLogin();
    }
  }, [biometricEnabled]);

  const handleBiometricLogin = async () => {
    setIsLoading(true);

    try {
      const result = await authenticate();

      if (result.success && result.token) {
        // Valideer en activeer de sessie
        await setActive({ session: result.token });
        router.replace('/(app)/dashboard');
      } else {
        // Biometric faalde, toon email form
        setShowEmailForm(true);
        if (result.error) {
          Alert.alert('Biometric login mislukt', result.error);
        }
      }
    } catch (error) {
      console.error('Biometric login error:', error);
      setShowEmailForm(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async () => {
    // ... (zie vorige sectie)
  };

  // Toon biometric login als dat enabled is
  if (biometricEnabled && !showEmailForm) {
    return (
      <View className="flex-1 bg-white p-6 justify-center items-center">
        <Text className="text-3xl font-bold mb-8">Top Tuinen</Text>

        <Pressable
          onPress={handleBiometricLogin}
          disabled={isLoading}
          className="w-24 h-24 bg-green-600 rounded-full items-center justify-center mb-6"
        >
          <Ionicons
            name={biometricType === 'face' ? 'scan-outline' : 'finger-print-outline'}
            size={48}
            color="white"
          />
        </Pressable>

        <Text className="text-gray-500 text-center mb-8">
          {biometricType === 'face'
            ? 'Gebruik Face ID om in te loggen'
            : 'Gebruik je vingerafdruk om in te loggen'}
        </Text>

        <Pressable onPress={() => setShowEmailForm(true)}>
          <Text className="text-green-600 font-semibold">
            Andere methode gebruiken
          </Text>
        </Pressable>
      </View>
    );
  }

  // Toon email login form
  return (
    <View className="flex-1 bg-white p-6 justify-center">
      {/* Email form - zie vorige sectie */}
    </View>
  );
}
```

### Biometric Setup na Login

```tsx
// apps/mobile/app/(auth)/biometric-setup.tsx

import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useBiometric } from '@/hooks/use-biometric';

export default function BiometricSetupScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { biometricType, enableBiometric, isAvailable } = useBiometric();

  const handleEnable = async () => {
    try {
      // Haal huidige session token op
      const token = await getToken();

      if (token) {
        const success = await enableBiometric(token);

        if (success) {
          router.replace('/(app)/dashboard');
        }
      }
    } catch (error) {
      console.error('Failed to enable biometric:', error);
    }
  };

  const handleSkip = () => {
    router.replace('/(app)/dashboard');
  };

  if (!isAvailable) {
    // Device ondersteunt geen biometrics
    router.replace('/(app)/dashboard');
    return null;
  }

  return (
    <View className="flex-1 bg-white p-6 justify-center items-center">
      <View className="bg-green-100 w-24 h-24 rounded-full items-center justify-center mb-6">
        <Ionicons
          name={biometricType === 'face' ? 'scan-outline' : 'finger-print-outline'}
          size={48}
          color="#16a34a"
        />
      </View>

      <Text className="text-2xl font-bold text-center mb-2">
        Sneller inloggen?
      </Text>

      <Text className="text-gray-500 text-center mb-8 px-4">
        {biometricType === 'face'
          ? 'Gebruik Face ID om de volgende keer sneller in te loggen'
          : 'Gebruik je vingerafdruk om de volgende keer sneller in te loggen'}
      </Text>

      <Pressable
        onPress={handleEnable}
        className="bg-green-600 rounded-lg py-4 px-8 mb-4 w-full"
      >
        <Text className="text-white text-center font-semibold text-lg">
          {biometricType === 'face' ? 'Activeer Face ID' : 'Activeer Touch ID'}
        </Text>
      </Pressable>

      <Pressable onPress={handleSkip} className="py-3">
        <Text className="text-gray-500">Later instellen</Text>
      </Pressable>
    </View>
  );
}
```

---

## 8. Webhook Setup

### Waarom Webhooks?

Webhooks zijn nodig om:
- Nieuwe Clerk gebruikers te synchroniseren naar Convex database
- Medewerker records automatisch aan te maken
- User metadata te updaten

### Clerk Dashboard Configuratie

1. Ga naar Clerk Dashboard > Webhooks
2. Klik "Add Endpoint"
3. Configureer:
   - **Endpoint URL:** `https://your-domain.com/api/webhooks/clerk`
   - **Events:** `user.created`, `user.updated`, `user.deleted`, `organization.membership.created`
4. Kopieer de **Signing Secret** (`whsec_...`)

### Webhook Handler (Next.js)

```tsx
// apps/web/src/app/api/webhooks/clerk/route.ts

import { verifyWebhook } from "@clerk/backend/webhooks";
import { api } from "@/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { NextRequest, NextResponse } from "next/server";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    // Verifieer de webhook signature
    const evt = await verifyWebhook(request);

    const eventType = evt.type;

    console.log(`Webhook received: ${eventType}`);

    // Handle user.created event
    if (eventType === "user.created") {
      const {
        id: clerkUserId,
        email_addresses,
        first_name,
        last_name,
        image_url,
      } = evt.data;

      const primaryEmail = email_addresses.find(
        (e) => e.id === evt.data.primary_email_address_id
      )?.email_address;

      // Maak medewerker aan in Convex
      await convex.mutation(api.medewerkers.createFromClerk, {
        clerkUserId,
        email: primaryEmail || "",
        naam: `${first_name || ""} ${last_name || ""}`.trim() || "Onbekend",
        imageUrl: image_url,
      });

      console.log(`Created medewerker for Clerk user: ${clerkUserId}`);
    }

    // Handle user.updated event
    if (eventType === "user.updated") {
      const {
        id: clerkUserId,
        email_addresses,
        first_name,
        last_name,
        image_url,
      } = evt.data;

      const primaryEmail = email_addresses.find(
        (e) => e.id === evt.data.primary_email_address_id
      )?.email_address;

      await convex.mutation(api.medewerkers.updateFromClerk, {
        clerkUserId,
        email: primaryEmail,
        naam: `${first_name || ""} ${last_name || ""}`.trim(),
        imageUrl: image_url,
      });

      console.log(`Updated medewerker for Clerk user: ${clerkUserId}`);
    }

    // Handle user.deleted event
    if (eventType === "user.deleted") {
      const { id: clerkUserId } = evt.data;

      await convex.mutation(api.medewerkers.deactivateByClerkId, {
        clerkUserId,
      });

      console.log(`Deactivated medewerker for Clerk user: ${clerkUserId}`);
    }

    // Handle organization membership created
    if (eventType === "organization.membership.created") {
      const { organization, public_user_data } = evt.data;

      await convex.mutation(api.medewerkers.linkToOrganization, {
        clerkUserId: public_user_data.user_id,
        clerkOrgId: organization.id,
      });

      console.log(`Linked user ${public_user_data.user_id} to org ${organization.id}`);
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (err) {
    console.error("Webhook verification failed:", err);
    return NextResponse.json(
      { error: "Webhook verification failed" },
      { status: 400 }
    );
  }
}
```

### Convex Mutations voor Webhooks

```typescript
// convex/medewerkers.ts

import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const createFromClerk = mutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    naam: v.string(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check of medewerker al bestaat
    const existing = await ctx.db
      .query("medewerkers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        email: args.email,
        naam: args.naam,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    // Create new medewerker
    return await ctx.db.insert("medewerkers", {
      clerkUserId: args.clerkUserId,
      email: args.email,
      naam: args.naam,
      status: "active",
      isActief: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const updateFromClerk = mutation({
  args: {
    clerkUserId: v.string(),
    email: v.optional(v.string()),
    naam: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const medewerker = await ctx.db
      .query("medewerkers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (!medewerker) {
      throw new Error(`Medewerker not found for Clerk ID: ${args.clerkUserId}`);
    }

    await ctx.db.patch(medewerker._id, {
      ...(args.email && { email: args.email }),
      ...(args.naam && { naam: args.naam }),
      updatedAt: Date.now(),
    });
  },
});

export const deactivateByClerkId = mutation({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const medewerker = await ctx.db
      .query("medewerkers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (medewerker) {
      await ctx.db.patch(medewerker._id, {
        status: "inactive",
        isActief: false,
        updatedAt: Date.now(),
      });
    }
  },
});

export const linkToOrganization = mutation({
  args: {
    clerkUserId: v.string(),
    clerkOrgId: v.string(),
  },
  handler: async (ctx, args) => {
    const medewerker = await ctx.db
      .query("medewerkers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (medewerker) {
      await ctx.db.patch(medewerker._id, {
        clerkOrgId: args.clerkOrgId,
        updatedAt: Date.now(),
      });
    }
  },
});
```

### Webhook Event Types

| Event | Beschrijving | Actie |
|-------|--------------|-------|
| `user.created` | Nieuwe gebruiker geregistreerd | Maak medewerker record |
| `user.updated` | Gebruiker info gewijzigd | Update medewerker data |
| `user.deleted` | Account verwijderd | Deactiveer medewerker |
| `organization.membership.created` | User toegevoegd aan org | Link medewerker aan org |
| `organization.membership.deleted` | User verwijderd uit org | Unlink van org |
| `session.created` | Nieuwe login | Log login timestamp |

---

## 9. Best Practices

### 1. Token Management

```tsx
// Refresh tokens automatisch (Clerk doet dit, maar wees bewust)
const TOKEN_REFRESH_THRESHOLD = 60 * 1000; // 1 minuut voor expiry

// In je auth context
useEffect(() => {
  const interval = setInterval(async () => {
    const token = await getToken();
    // Token wordt automatisch gerefreshed door Clerk
  }, 30 * 1000); // Check elke 30 seconden

  return () => clearInterval(interval);
}, [getToken]);
```

### 2. Error Handling

```tsx
// Centrale error handler voor auth errors
export function handleAuthError(error: any) {
  const errorCode = error.errors?.[0]?.code;

  switch (errorCode) {
    case 'session_expired':
      // Redirect naar login
      router.replace('/(auth)/login');
      break;
    case 'network_error':
      // Toon offline message
      Alert.alert('Geen verbinding', 'Controleer je internetverbinding');
      break;
    case 'user_locked':
      Alert.alert('Account geblokkeerd', 'Neem contact op met de beheerder');
      break;
    default:
      Alert.alert('Fout', error.message || 'Er ging iets mis');
  }
}
```

### 3. Loading States

```tsx
// Gebruik ClerkLoaded om te wachten tot Clerk is geladen
import { ClerkLoaded, ClerkLoading } from '@clerk/clerk-expo';

<ClerkProvider>
  <ClerkLoading>
    <LoadingSplash />
  </ClerkLoading>
  <ClerkLoaded>
    <App />
  </ClerkLoaded>
</ClerkProvider>
```

### 4. Protected Routes

```tsx
// apps/mobile/app/(app)/_layout.tsx

import { useAuth } from '@clerk/clerk-expo';
import { Redirect, Stack } from 'expo-router';

export default function AppLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return <LoadingScreen />;
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Stack />;
}
```

### 5. Secure Token Storage

```tsx
// Gebruik altijd WHEN_UNLOCKED voor gevoelige data
await SecureStore.setItemAsync(key, value, {
  keychainAccessible: SecureStore.WHEN_UNLOCKED,
});

// Voor extra gevoelige data, overweeg requireAuthentication
await SecureStore.setItemAsync(key, value, {
  requireAuthentication: true,
  authenticationPrompt: 'Authenticeer om toegang te krijgen',
});
```

### 6. Dutch Localization

```tsx
// Clerk ondersteunt nlNL localization
import { nlNL } from '@clerk/localizations';

<ClerkProvider
  localization={nlNL}
  // ... andere props
>
```

---

## 10. Potentiele Issues en Oplossingen

### Issue 1: Token Cache Niet Werkend

**Symptoom:** Gebruiker moet opnieuw inloggen na app restart.

**Oorzaak:** SecureStore niet correct geconfigureerd.

**Oplossing:**
```tsx
// Zorg dat expo-secure-store is geinstalleerd
npx expo install expo-secure-store

// Gebruik de ingebouwde tokenCache
import { tokenCache } from '@clerk/clerk-expo/token-cache';

<ClerkProvider tokenCache={tokenCache}>
```

### Issue 2: Deep Links Werken Niet op iOS

**Symptoom:** Magic links openen niet de app.

**Oorzaak:** Associated Domains niet geconfigureerd.

**Oplossing:**
```json
// app.json
{
  "expo": {
    "ios": {
      "associatedDomains": ["applinks:your-domain.com"]
    }
  }
}
```

En configureer Apple App Site Association op je server.

### Issue 3: Biometric Prompt Verschijnt Niet

**Symptoom:** Face ID/Touch ID prompt verschijnt niet.

**Oorzaak:** Missende Info.plist configuratie.

**Oplossing:**
```json
// app.json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSFaceIDUsageDescription": "Gebruik Face ID om in te loggen"
      }
    }
  }
}
```

### Issue 4: Webhook Signature Verification Fails

**Symptoom:** Webhooks worden afgewezen met 400 error.

**Oorzaak:** Verkeerde signing secret of raw body niet beschikbaar.

**Oplossing:**
```tsx
// Gebruik verifyWebhook van @clerk/backend
import { verifyWebhook } from "@clerk/backend/webhooks";

// Niet de body zelf parsen, laat Clerk dat doen
const evt = await verifyWebhook(request);
```

### Issue 5: Session Expiry in Background

**Symptoom:** App logged uit na lange tijd in background.

**Oorzaak:** Session token is verlopen.

**Oplossing:**
```tsx
// Implementeer session refresh bij app focus
import { useAppState } from '@react-native-community/hooks';

function useSessionRefresh() {
  const appState = useAppState();
  const { getToken } = useAuth();

  useEffect(() => {
    if (appState === 'active') {
      // Refresh token wanneer app actief wordt
      getToken({ skipCache: true });
    }
  }, [appState]);
}
```

### Issue 6: Organization Not Loading

**Symptoom:** `useOrganization` returnt undefined.

**Oorzaak:** Geen actieve organization geselecteerd.

**Oplossing:**
```tsx
// Check of user een organization heeft
const { organizationList, setActive } = useOrganizationList();

useEffect(() => {
  if (organizationList?.length === 1) {
    // Auto-select als er maar 1 org is
    setActive({ organization: organizationList[0].organization.id });
  }
}, [organizationList]);
```

### Issue 7: Offline Mode Crashes

**Symptoom:** App crashed als device offline is bij startup.

**Oorzaak:** Clerk probeert te connecten zonder cache.

**Oplossing:**
```tsx
// Gebruik experimental resourceCache
import { resourceCache } from '@clerk/clerk-expo/resource-cache';

<ClerkProvider
  tokenCache={tokenCache}
  __experimental_resourceCache={resourceCache}
>
```

---

## Conclusie

Deze research documenteert de complete integratie van Clerk met Expo voor de Top Tuinen Medewerkers App. De belangrijkste punten:

1. **Setup is straightforward** - `@clerk/clerk-expo` biedt out-of-the-box support
2. **SecureStore** - Gebruik altijd de ingebouwde `tokenCache` voor veilige opslag
3. **Organizations** - Ideaal voor team/bedrijf structuur
4. **Magic Links** - Beste UX voor mobile, geen wachtwoorden
5. **Biometrics** - Snelle re-login na eerste authenticatie
6. **Webhooks** - Essentieel voor user synchronisatie naar Convex

De volgende stap is deze research toe te passen in de daadwerkelijke implementatie van de mobile app authenticatie flow.

---

*Document gegenereerd op 2026-02-01*
