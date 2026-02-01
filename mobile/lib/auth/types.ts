/**
 * Authentication Types voor Top Tuinen Mobile App
 *
 * Dit bestand bevat TypeScript types voor authenticatie hooks en session management.
 */

import type { UserResource } from '@clerk/types';

/**
 * Session state returned by useAuthSession hook
 */
export interface AuthSessionState {
  /** Whether the session has been validated */
  isSessionValid: boolean;
  /** Whether Clerk has finished loading */
  isLoaded: boolean;
  /** The current authenticated user, or null if not signed in */
  user: UserResource | null | undefined;
}

/**
 * Biometric authentication state returned by useBiometricAuth hook
 */
export interface BiometricAuthState {
  /** Whether biometric authentication is available on this device */
  biometricAvailable: boolean;
  /** The type of biometric available ('face', 'fingerprint', or null) */
  biometricType: 'face' | 'fingerprint' | null;
  /** Function to trigger biometric authentication */
  authenticate: () => Promise<BiometricAuthResult>;
}

/**
 * Result of biometric authentication attempt
 */
export interface BiometricAuthResult {
  /** Whether authentication was successful */
  success: boolean;
  /** Session token if authentication succeeded */
  token?: string;
  /** User ID if authentication succeeded */
  userId?: string;
  /** Error message if authentication failed */
  error?: string;
}

/**
 * Authentication requirement state returned by useRequireAuth hook
 */
export interface RequireAuthState {
  /** Whether the user is signed in */
  isSignedIn: boolean | undefined;
  /** Whether Clerk has finished loading */
  isLoaded: boolean;
}

/**
 * Session storage keys used by auth hooks
 */
export const AUTH_STORAGE_KEYS = {
  /** Key for storing session data */
  SESSION: 'toptuinen_session',
  /** Key for storing last login timestamp */
  LAST_LOGIN: 'toptuinen_last_login',
} as const;

/**
 * Configuration constants for session management
 */
export const SESSION_CONFIG = {
  /** Maximum number of days a session is valid */
  MAX_SESSION_DAYS: 7,
  /** Token refresh interval in milliseconds (50 seconds) */
  TOKEN_REFRESH_INTERVAL: 50000,
} as const;
