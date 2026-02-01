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

// Current user hook (with role info)
export {
  useCurrentUser,
  type UserRole as CurrentUserRole,
  type CurrentUserResult,
} from './use-current-user';

// User role hook for RBAC
export {
  useUserRole,
  normalizeRole,
  getRoleDisplayName,
  getRoleBadgeVariant,
  hasAdminPrivileges,
  getPermissionsForRole,
  ROLE_BADGE_COLORS,
  type UserRole,
  type NormalizedRole,
  type RolePermissions,
  type UseUserRoleReturn,
} from './use-user-role';
