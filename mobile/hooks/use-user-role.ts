/**
 * Hook for role-based access control
 *
 * Provides utilities to check user role and conditionally render UI
 * Roles:
 * - admin: Full access to all features including team overview, all projects, financial metrics
 * - medewerker: Limited access to own hours, assigned projects
 * - viewer: Read-only access, no create/edit actions
 * - user: Default role (same as admin for backwards compatibility)
 *
 * Also provides access to linked medewerker profile for medewerker role users.
 */

import { useCurrentUser } from './use-current-user';
import type { Id } from '../convex/_generated/dataModel';

export type UserRole = 'admin' | 'medewerker' | 'viewer' | 'user';

// Normalized role type (without legacy 'user')
export type NormalizedRole = 'admin' | 'medewerker' | 'viewer';

// Permission flags for role-based access
export interface RolePermissions {
  // Navigation visibility
  canViewDashboard: boolean;
  canViewUren: boolean;
  canViewNotifications: boolean;
  canViewChat: boolean;
  canViewProfiel: boolean;

  // Admin-only features
  canManageUsers: boolean;
  canManageSettings: boolean;
  canViewReports: boolean;
  canManageMedewerkers: boolean;
  canManageProjects: boolean;

  // Create/Edit permissions
  canCreateEntries: boolean;
  canEditEntries: boolean;
  canDeleteEntries: boolean;

  // Read-only indicator
  isReadOnly: boolean;
}

// Define permissions per role
const ROLE_PERMISSIONS: Record<NormalizedRole, RolePermissions> = {
  admin: {
    canViewDashboard: true,
    canViewUren: true,
    canViewNotifications: true,
    canViewChat: true,
    canViewProfiel: true,
    canManageUsers: true,
    canManageSettings: true,
    canViewReports: true,
    canManageMedewerkers: true,
    canManageProjects: true,
    canCreateEntries: true,
    canEditEntries: true,
    canDeleteEntries: true,
    isReadOnly: false,
  },
  medewerker: {
    canViewDashboard: true,
    canViewUren: true,
    canViewNotifications: true,
    canViewChat: true,
    canViewProfiel: true,
    canManageUsers: false,
    canManageSettings: false,
    canViewReports: false,
    canManageMedewerkers: false,
    canManageProjects: false,
    canCreateEntries: true,
    canEditEntries: true,
    canDeleteEntries: false,
    isReadOnly: false,
  },
  viewer: {
    canViewDashboard: true,
    canViewUren: true,
    canViewNotifications: true,
    canViewChat: true,
    canViewProfiel: true,
    canManageUsers: false,
    canManageSettings: false,
    canViewReports: false,
    canManageMedewerkers: false,
    canManageProjects: false,
    canCreateEntries: false,
    canEditEntries: false,
    canDeleteEntries: false,
    isReadOnly: true,
  },
};

// Role badge colors for visual indication
export const ROLE_BADGE_COLORS: Record<NormalizedRole, { background: string; text: string }> = {
  admin: { background: '#3B82F6', text: '#FFFFFF' }, // Blue
  medewerker: { background: '#10B981', text: '#FFFFFF' }, // Green
  viewer: { background: '#6B7280', text: '#FFFFFF' }, // Gray
};

export interface UseUserRoleReturn {
  /** The user's role */
  role: UserRole;
  /** Normalized role (without legacy 'user') */
  normalizedRole: NormalizedRole;
  /** Whether the user has admin privileges (admin or user role) */
  isAdmin: boolean;
  /** Whether the user is a medewerker (employee) */
  isMedewerker: boolean;
  /** Whether the user is a viewer (read-only) */
  isViewer: boolean;
  /** Whether the role is loaded */
  isLoaded: boolean;
  /** User-friendly display name for the role */
  roleDisplayName: string;
  /** Role badge variant for UI */
  roleBadgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
  /** Role badge colors for custom styling */
  roleBadgeColors: { background: string; text: string };
  /** Full permissions object */
  permissions: RolePermissions;
  /** Check if user has a specific permission */
  hasPermission: (permission: keyof RolePermissions) => boolean;
  /** The linked medewerker ID (for medewerker role) */
  linkedMedewerkerId: Id<"medewerkers"> | null;
}

/**
 * Normalize role to remove legacy 'user' role
 */
export function normalizeRole(role: UserRole | undefined | null): NormalizedRole {
  if (role === 'admin' || role === 'user' || role === undefined || role === null) {
    return 'admin';
  }
  if (role === 'viewer') {
    return 'viewer';
  }
  return 'medewerker';
}

/**
 * Get the display name for a role
 */
export function getRoleDisplayName(role: UserRole | NormalizedRole): string {
  const normalized = normalizeRole(role);
  switch (normalized) {
    case 'admin':
      return 'Beheerder';
    case 'medewerker':
      return 'Medewerker';
    case 'viewer':
      return 'Alleen lezen';
    default:
      return 'Onbekend';
  }
}

/**
 * Get the badge variant for a role
 */
export function getRoleBadgeVariant(role: UserRole | NormalizedRole): 'default' | 'secondary' | 'destructive' | 'outline' {
  const normalized = normalizeRole(role);
  switch (normalized) {
    case 'admin':
      return 'default';
    case 'medewerker':
      return 'secondary';
    case 'viewer':
      return 'outline';
    default:
      return 'outline';
  }
}

/**
 * Check if a role has admin privileges
 */
export function hasAdminPrivileges(role: UserRole | undefined | null): boolean {
  // 'user' is treated as admin for backwards compatibility
  return role === 'admin' || role === 'user' || role === undefined || role === null;
}

/**
 * Get permissions for a role
 */
export function getPermissionsForRole(role: UserRole | undefined | null): RolePermissions {
  const normalized = normalizeRole(role);
  return ROLE_PERMISSIONS[normalized];
}

/**
 * Hook to get user role information and utilities
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isAdmin, isMedewerker, isViewer, roleDisplayName, permissions, hasPermission } = useUserRole();
 *
 *   return (
 *     <View>
 *       {isAdmin && <AdminDashboard />}
 *       {isMedewerker && <MedewerkerDashboard />}
 *       {isViewer && <ViewerDashboard />}
 *       <Text>Role: {roleDisplayName}</Text>
 *       {hasPermission('canCreateEntries') && <CreateButton />}
 *     </View>
 *   );
 * }
 * ```
 */
export function useUserRole(): UseUserRoleReturn {
  const { user, isLoading, isUserSynced, linkedMedewerkerId } = useCurrentUser();

  // Get role from user, default to 'user' if not set (backwards compatibility)
  const role: UserRole = (user?.role as UserRole) || 'user';

  // Normalize role
  const normalized = normalizeRole(role);

  // Role checks
  const isAdmin = hasAdminPrivileges(role);
  const isMedewerker = normalized === 'medewerker';
  const isViewer = normalized === 'viewer';

  // Get display name, badge variant, and permissions
  const roleDisplayName = getRoleDisplayName(role);
  const roleBadgeVariant = getRoleBadgeVariant(role);
  const roleBadgeColors = ROLE_BADGE_COLORS[normalized];
  const permissions = ROLE_PERMISSIONS[normalized];

  // Helper to check specific permission
  const hasPermission = (permission: keyof RolePermissions): boolean => {
    return !!permissions[permission];
  };

  return {
    role,
    normalizedRole: normalized,
    isAdmin,
    isMedewerker,
    isViewer,
    isLoaded: !isLoading && isUserSynced,
    roleDisplayName,
    roleBadgeVariant,
    roleBadgeColors,
    permissions,
    hasPermission,
    linkedMedewerkerId,
  };
}

export default useUserRole;
