/**
 * Auth Module Exports
 *
 * Centrale export voor alle authenticatie gerelateerde functies en componenten.
 */

// Clerk exports
export {
  ClerkProviderWrapper,
  tokenCache,
  useAuth,
  useUser,
  useSignIn,
  useSignUp,
  useClerk,
  ClerkLoaded,
  ClerkLoading,
} from './clerk';

// Biometric exports
export {
  isBiometricAvailable,
  getBiometricType,
  isBiometricEnabled,
  setupBiometric,
  disableBiometric,
  authenticateWithBiometric,
  updateBiometricToken,
  getBiometricUserId,
} from './biometric';

export type { BiometricType, BiometricAuthResult } from './biometric';

// Auth hooks exports
export {
  useAuthSession,
  useBiometricAuth,
  useTokenRefresh,
  useRequireAuth,
  useAuthToken,
  useSignOut,
} from './hooks';

// Types exports
export type {
  AuthSessionState,
  BiometricAuthState,
  RequireAuthState,
} from './types';

export { AUTH_STORAGE_KEYS, SESSION_CONFIG } from './types';
