/**
 * Role-based Access Control Context for Top Tuinen Mobile App
 *
 * This context provides role awareness throughout the app, enabling:
 * - Role-based UI rendering (show/hide features based on role)
 * - Access to linked medewerker profile for medewerker role
 * - Helper functions for permission checks
 *
 * Roles:
 * - admin: Full access to all features, can manage users, medewerkers, and all data
 * - medewerker: Limited access, can only see own data, linked to a medewerker profile
 * - viewer: Read-only access to allowed features
 */

import React, {
  createContext,
  useContext,
  ReactNode,
  useMemo,
} from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useCurrentUser, UserRole } from '../hooks/use-current-user';
import type { Id, Doc } from '../convex/_generated/dataModel';

/**
 * Linked medewerker information for users with medewerker role
 */
export interface LinkedMedewerker {
  _id: Id<"medewerkers">;
  naam: string;
  email?: string;
  telefoon?: string;
  functie?: string;
  isActief: boolean;
}

/**
 * Role context value type
 */
export interface RoleContextValue {
  /** The current user's role */
  role: UserRole;

  /** Whether the role has been loaded */
  isRoleLoaded: boolean;

  /** Whether the current user is an admin */
  isAdmin: boolean;

  /** Whether the current user is a medewerker */
  isMedewerker: boolean;

  /** Whether the current user is a viewer (read-only) */
  isViewer: boolean;

  /** The linked medewerker ID (for medewerker role) */
  linkedMedewerkerId: Id<"medewerkers"> | null;

  /** The linked medewerker profile (for medewerker role), or null if not linked/loading */
  linkedMedewerker: LinkedMedewerker | null;

  /** Whether the linked medewerker is being loaded */
  isLinkedMedewerkerLoading: boolean;

  /**
   * Check if the current user can perform a specific action
   * @param action - The action to check (e.g., 'manage_medewerkers', 'view_rapportages')
   * @returns Whether the user can perform the action
   */
  canPerform: (action: PermissionAction) => boolean;

  /**
   * Check if the current user can access a specific feature
   * @param feature - The feature to check (e.g., 'dashboard', 'offertes', 'wagenpark')
   * @returns Whether the user can access the feature
   */
  canAccess: (feature: FeatureAccess) => boolean;
}

/**
 * Available permission actions
 */
export type PermissionAction =
  | 'manage_medewerkers'
  | 'manage_voertuigen'
  | 'manage_machines'
  | 'create_offertes'
  | 'edit_offertes'
  | 'delete_offertes'
  | 'view_all_rapportages'
  | 'view_own_rapportages'
  | 'register_uren'
  | 'register_km'
  | 'view_instellingen'
  | 'edit_instellingen';

/**
 * Available feature access checks
 */
export type FeatureAccess =
  | 'dashboard'
  | 'offertes'
  | 'projecten'
  | 'klanten'
  | 'medewerkers'
  | 'wagenpark'
  | 'machines'
  | 'rapportages'
  | 'instellingen'
  | 'chat'
  | 'notifications'
  | 'time_registration'
  | 'km_registration';

/**
 * Permission matrix defining which roles can perform which actions
 */
const PERMISSION_MATRIX: Record<PermissionAction, UserRole[]> = {
  manage_medewerkers: ['admin'],
  manage_voertuigen: ['admin'],
  manage_machines: ['admin'],
  create_offertes: ['admin'],
  edit_offertes: ['admin'],
  delete_offertes: ['admin'],
  view_all_rapportages: ['admin'],
  view_own_rapportages: ['admin', 'medewerker'],
  register_uren: ['admin', 'medewerker'],
  register_km: ['admin', 'medewerker'],
  view_instellingen: ['admin', 'viewer'],
  edit_instellingen: ['admin'],
};

/**
 * Feature access matrix defining which roles can access which features
 */
const FEATURE_ACCESS_MATRIX: Record<FeatureAccess, UserRole[]> = {
  dashboard: ['admin', 'medewerker', 'viewer'],
  offertes: ['admin', 'viewer'],
  projecten: ['admin', 'medewerker', 'viewer'],
  klanten: ['admin', 'viewer'],
  medewerkers: ['admin'],
  wagenpark: ['admin', 'medewerker'],
  machines: ['admin'],
  rapportages: ['admin', 'medewerker', 'viewer'],
  instellingen: ['admin'],
  chat: ['admin', 'medewerker'],
  notifications: ['admin', 'medewerker', 'viewer'],
  time_registration: ['admin', 'medewerker'],
  km_registration: ['admin', 'medewerker'],
};

// Create the context with undefined as default
const RoleContext = createContext<RoleContextValue | undefined>(undefined);

/**
 * RoleProvider Props
 */
interface RoleProviderProps {
  children: ReactNode;
}

/**
 * RoleProvider Component
 *
 * Provides role-based access control context to the app.
 * Must be placed inside ConvexProviderWithClerk to access the authenticated user.
 *
 * @example
 * ```tsx
 * <RoleProvider>
 *   <App />
 * </RoleProvider>
 * ```
 */
export function RoleProvider({ children }: RoleProviderProps) {
  // Get current user with role information
  const {
    role,
    isAdmin,
    isMedewerker,
    isViewer,
    linkedMedewerkerId,
    isLoading: isUserLoading,
    isAuthenticated,
  } = useCurrentUser();

  // Fetch linked medewerker profile if the user has medewerker role
  const linkedMedewerkerData = useQuery(
    api.medewerkers.get,
    linkedMedewerkerId ? { id: linkedMedewerkerId } : 'skip'
  );

  // Compute if linked medewerker is loading
  const isLinkedMedewerkerLoading = linkedMedewerkerId !== null && linkedMedewerkerData === undefined;

  // Build the linked medewerker object
  const linkedMedewerker: LinkedMedewerker | null = useMemo(() => {
    if (!linkedMedewerkerData) return null;

    return {
      _id: linkedMedewerkerData._id,
      naam: linkedMedewerkerData.naam,
      email: linkedMedewerkerData.email,
      telefoon: linkedMedewerkerData.telefoon,
      functie: linkedMedewerkerData.functie,
      isActief: linkedMedewerkerData.isActief,
    };
  }, [linkedMedewerkerData]);

  // Permission check function
  const canPerform = useMemo(() => {
    return (action: PermissionAction): boolean => {
      const allowedRoles = PERMISSION_MATRIX[action];
      return allowedRoles.includes(role);
    };
  }, [role]);

  // Feature access check function
  const canAccess = useMemo(() => {
    return (feature: FeatureAccess): boolean => {
      const allowedRoles = FEATURE_ACCESS_MATRIX[feature];
      return allowedRoles.includes(role);
    };
  }, [role]);

  // Build context value
  const contextValue: RoleContextValue = useMemo(() => ({
    role,
    isRoleLoaded: !isUserLoading && isAuthenticated,
    isAdmin,
    isMedewerker,
    isViewer,
    linkedMedewerkerId,
    linkedMedewerker,
    isLinkedMedewerkerLoading,
    canPerform,
    canAccess,
  }), [
    role,
    isUserLoading,
    isAuthenticated,
    isAdmin,
    isMedewerker,
    isViewer,
    linkedMedewerkerId,
    linkedMedewerker,
    isLinkedMedewerkerLoading,
    canPerform,
    canAccess,
  ]);

  return (
    <RoleContext.Provider value={contextValue}>
      {children}
    </RoleContext.Provider>
  );
}

/**
 * useRole Hook
 *
 * Access the role context value in any component.
 *
 * @throws Error if used outside of RoleProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isAdmin, isMedewerker, canPerform } = useRole();
 *
 *   if (isAdmin) {
 *     return <AdminView />;
 *   }
 *
 *   if (canPerform('register_uren')) {
 *     return <TimeRegistrationForm />;
 *   }
 *
 *   return <ReadOnlyView />;
 * }
 * ```
 */
export function useRole(): RoleContextValue {
  const context = useContext(RoleContext);

  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }

  return context;
}

/**
 * RoleGate Component
 *
 * Conditionally render children based on role or permission.
 *
 * @example
 * ```tsx
 * // Show only for admins
 * <RoleGate roles={['admin']}>
 *   <AdminOnlyContent />
 * </RoleGate>
 *
 * // Show for admins and medewerkers
 * <RoleGate roles={['admin', 'medewerker']}>
 *   <TimeRegistrationButton />
 * </RoleGate>
 *
 * // Show based on permission
 * <RoleGate permission="manage_medewerkers">
 *   <MedewerkersManagement />
 * </RoleGate>
 *
 * // Show with fallback
 * <RoleGate roles={['admin']} fallback={<NoAccessMessage />}>
 *   <AdminPanel />
 * </RoleGate>
 * ```
 */
interface RoleGateProps {
  /** Roles that can access this content */
  roles?: UserRole[];
  /** Permission required to access this content */
  permission?: PermissionAction;
  /** Feature required to access this content */
  feature?: FeatureAccess;
  /** Fallback content to show if access is denied */
  fallback?: ReactNode;
  /** Children to render if access is granted */
  children: ReactNode;
}

export function RoleGate({
  roles,
  permission,
  feature,
  fallback = null,
  children,
}: RoleGateProps) {
  const { role, canPerform, canAccess, isRoleLoaded } = useRole();

  // Wait for role to load
  if (!isRoleLoaded) {
    return null;
  }

  // Check role-based access
  if (roles && roles.length > 0) {
    if (!roles.includes(role)) {
      return <>{fallback}</>;
    }
  }

  // Check permission-based access
  if (permission) {
    if (!canPerform(permission)) {
      return <>{fallback}</>;
    }
  }

  // Check feature-based access
  if (feature) {
    if (!canAccess(feature)) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}

/**
 * AdminOnly Component
 *
 * Shorthand for RoleGate with roles={['admin']}
 */
export function AdminOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <RoleGate roles={['admin']} fallback={fallback}>
      {children}
    </RoleGate>
  );
}

/**
 * MedewerkerOnly Component
 *
 * Shorthand for RoleGate with roles={['medewerker']}
 */
export function MedewerkerOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <RoleGate roles={['medewerker']} fallback={fallback}>
      {children}
    </RoleGate>
  );
}

/**
 * AdminOrMedewerker Component
 *
 * Shorthand for RoleGate with roles={['admin', 'medewerker']}
 */
export function AdminOrMedewerker({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <RoleGate roles={['admin', 'medewerker']} fallback={fallback}>
      {children}
    </RoleGate>
  );
}

export default RoleProvider;
