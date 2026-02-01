/**
 * Biometric Authentication Helpers voor Top Tuinen Mobile App
 *
 * Dit bestand bevat functies voor Face ID / Touch ID authenticatie.
 * Biometrics wordt gebruikt als snelle re-login methode na eerste login.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

// Keys voor SecureStore
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const SESSION_TOKEN_KEY = 'biometric_session_token';
const USER_ID_KEY = 'biometric_user_id';

export type BiometricType = 'face' | 'fingerprint' | null;

export interface BiometricAuthResult {
  success: boolean;
  token?: string;
  userId?: string;
  error?: string;
}

/**
 * Check of biometric authenticatie beschikbaar is op dit device
 * @returns true als device biometrics ondersteunt en er biometrics zijn geregistreerd
 */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    // Check of device hardware heeft voor biometrics
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      console.log('[Biometric] Geen biometric hardware gevonden');
      return false;
    }

    // Check of er biometrics zijn geregistreerd (Face ID of Touch ID ingesteld)
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      console.log('[Biometric] Geen biometrics geregistreerd op device');
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Biometric] Fout bij controleren beschikbaarheid:', error);
    return false;
  }
}

/**
 * Bepaal het type biometric dat beschikbaar is
 * @returns 'face' voor Face ID, 'fingerprint' voor Touch ID, of null als niet beschikbaar
 */
export async function getBiometricType(): Promise<BiometricType> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

    // Face ID heeft voorrang als beide beschikbaar zijn
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'face';
    }

    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'fingerprint';
    }

    return null;
  } catch (error) {
    console.error('[Biometric] Fout bij bepalen biometric type:', error);
    return null;
  }
}

/**
 * Check of biometric login is ingeschakeld voor de huidige gebruiker
 * @returns true als biometric login is geactiveerd
 */
export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    return enabled === 'true';
  } catch (error) {
    console.error('[Biometric] Fout bij controleren enabled status:', error);
    return false;
  }
}

/**
 * Activeer biometric login en sla session token veilig op
 *
 * @param sessionToken - De huidige session token van Clerk
 * @param userId - De Clerk user ID voor identificatie
 * @returns true als activatie succesvol was
 */
export async function setupBiometric(
  sessionToken: string,
  userId: string
): Promise<boolean> {
  try {
    // Check eerst of biometrics beschikbaar is
    const available = await isBiometricAvailable();
    if (!available) {
      console.log('[Biometric] Setup mislukt: biometrics niet beschikbaar');
      return false;
    }

    // Sla de session token veilig op met biometric bescherming
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, sessionToken, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });

    // Sla user ID op voor verificatie
    await SecureStore.setItemAsync(USER_ID_KEY, userId, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });

    // Markeer biometric als enabled
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');

    console.log('[Biometric] Setup succesvol voltooid');
    return true;
  } catch (error) {
    console.error('[Biometric] Fout bij setup:', error);
    return false;
  }
}

/**
 * Deactiveer biometric login en verwijder opgeslagen tokens
 */
export async function disableBiometric(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_ID_KEY);
    await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
    console.log('[Biometric] Uitgeschakeld en tokens verwijderd');
  } catch (error) {
    console.error('[Biometric] Fout bij uitschakelen:', error);
  }
}

/**
 * Authenticeer met biometrics en haal opgeslagen session token op
 *
 * @returns Object met success status en optioneel token/error
 */
export async function authenticateWithBiometric(): Promise<BiometricAuthResult> {
  try {
    // Check of biometric login is ingeschakeld
    const isEnabled = await isBiometricEnabled();
    if (!isEnabled) {
      return {
        success: false,
        error: 'Biometric login is niet ingeschakeld',
      };
    }

    // Bepaal biometric type voor juiste prompt tekst
    const biometricType = await getBiometricType();
    const promptMessage =
      biometricType === 'face'
        ? 'Log in met Face ID'
        : biometricType === 'fingerprint'
          ? 'Log in met je vingerafdruk'
          : 'Log in met biometrics';

    // Start biometric authenticatie
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Gebruik pincode',
      disableDeviceFallback: false,
      cancelLabel: 'Annuleren',
    });

    if (!result.success) {
      // Bepaal specifieke foutmelding
      let error = 'Authenticatie mislukt';
      if (result.error === 'user_cancel') {
        error = 'Authenticatie geannuleerd';
      } else if (result.error === 'user_fallback') {
        error = 'Gebruik alternatieve login methode';
      } else if (result.error === 'lockout') {
        error = 'Te veel mislukte pogingen. Probeer later opnieuw.';
      }

      return { success: false, error };
    }

    // Haal opgeslagen session token op
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    const userId = await SecureStore.getItemAsync(USER_ID_KEY);

    if (!token || !userId) {
      // Token is verlopen of verwijderd, disable biometric
      await disableBiometric();
      return {
        success: false,
        error: 'Sessie verlopen. Log opnieuw in.',
      };
    }

    console.log('[Biometric] Authenticatie succesvol');
    return {
      success: true,
      token,
      userId,
    };
  } catch (error: any) {
    console.error('[Biometric] Fout bij authenticatie:', error);
    return {
      success: false,
      error: error.message || 'Er ging iets mis bij de biometric authenticatie',
    };
  }
}

/**
 * Update de opgeslagen session token (bijv. na token refresh)
 *
 * @param newToken - De nieuwe session token
 */
export async function updateBiometricToken(newToken: string): Promise<void> {
  try {
    const isEnabled = await isBiometricEnabled();
    if (!isEnabled) {
      return;
    }

    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, newToken, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
    console.log('[Biometric] Token bijgewerkt');
  } catch (error) {
    console.error('[Biometric] Fout bij bijwerken token:', error);
  }
}

/**
 * Haal de opgeslagen user ID op (zonder biometric verificatie)
 * Nuttig om te checken of er een gebruiker bekend is
 */
export async function getBiometricUserId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(USER_ID_KEY);
  } catch (error) {
    console.error('[Biometric] Fout bij ophalen user ID:', error);
    return null;
  }
}
