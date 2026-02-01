/**
 * Hooks Module Exports
 *
 * Centrale export voor alle custom hooks.
 */

// Auth hooks
export { useAppAuth, type UseAuthReturn, type AuthState, type AuthActions } from './use-auth';

// Offline sync hooks
export {
  useSyncStatus,
  usePendingCount,
  useFailedSyncItems,
  useSyncQueue,
  useNetworkStatus,
} from './use-offline-sync';

// Push notifications hook
export {
  usePushNotifications,
  type PushNotificationState,
} from './use-push-notifications';

// Current user hook
export { useCurrentUser } from './use-current-user';
