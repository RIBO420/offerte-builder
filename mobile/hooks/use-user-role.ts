import { useCurrentUser } from './use-current-user';
import { colors, lightColors } from '../theme/colors';
import { normalizeRole, getPermissionsForRole, isFieldRole, ROLE_LABELS, USER_ROLES, type NativeRole, type RolePermissions } from '../lib/roles';
export { normalizeRole, getPermissionsForRole } from '../lib/roles';
export type { RolePermissions } from '../lib/roles';
export type UserRole = NativeRole;
export type NormalizedRole = NativeRole;
export const hasAdminPrivileges = (role: unknown) => normalizeRole(role) === 'directie';
export const getRoleDisplayName = (role: unknown) => ROLE_LABELS[normalizeRole(role)];
export const getRoleBadgeVariant = (role: unknown): 'default' | 'secondary' | 'outline' =>
  hasAdminPrivileges(role) ? 'default' : isFieldRole(normalizeRole(role)) ? 'secondary' : 'outline';
export const ROLE_BADGE_COLORS = Object.fromEntries(
  [...USER_ROLES, 'onbekend'].map(role => [role, {
    background: role === 'klant' || role === 'onbekend' ? colors.werkLoods : lightColors.primary ?? colors.primary, text: colors.opBeeld,
  }])
) as Record<NativeRole, { background: string; text: string }>;
export function useUserRole() {
  const { role, isLoading, isUserSynced, isAuthenticated, linkedMedewerkerId } = useCurrentUser();
  const effectiveRole = isAuthenticated && isUserSynced ? role : 'onbekend';
  const permissions = getPermissionsForRole(effectiveRole);
  return {
    role: effectiveRole, normalizedRole: effectiveRole,
    isAdmin: hasAdminPrivileges(effectiveRole), isMedewerker: isFieldRole(effectiveRole),
    isViewer: effectiveRole === 'klant', isLoaded: !isLoading && isUserSynced,
    roleDisplayName: getRoleDisplayName(effectiveRole), roleBadgeVariant: getRoleBadgeVariant(effectiveRole),
    roleBadgeColors: ROLE_BADGE_COLORS[effectiveRole], permissions,
    hasPermission: (permission: keyof RolePermissions) => permissions[permission], linkedMedewerkerId,
  };
}
export type UseUserRoleReturn = ReturnType<typeof useUserRole>;
export default useUserRole;
