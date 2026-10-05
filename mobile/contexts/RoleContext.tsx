/**
 * Role-based Access Control Context for Top Tuinen Mobile App
 *
 * This context provides role awareness throughout the app, enabling:
 * - Role-based UI rendering (show/hide features based on role)
 * - Access to linked medewerker profile for medewerker role
 * - Helper functions for permission checks
 *
 * Roles:
 * Canonical seven-role model. Legacy admin/viewer are normalized by useCurrentUser.
 * Unknown/loading identities cannot perform actions.
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
import type { Id } from '../convex/_generated/dataModel';

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
const INTERNAL: UserRole[] = ['directie', 'projectleider', 'voorman', 'medewerker', 'onderaannemer_zzp', 'materiaalman'];
const OFFICE: UserRole[] = ['directie', 'projectleider'];
const PERMISSION_MATRIX: Record<PermissionAction, UserRole[]> = {
  manage_medewerkers: ['directie'], manage_voertuigen: ['directie', 'materiaalman'],
  manage_machines: ['directie'], create_offertes: OFFICE, edit_offertes: OFFICE,
  delete_offertes: ['directie'], view_all_rapportages: OFFICE,
  view_own_rapportages: INTERNAL, register_uren: INTERNAL, register_km: INTERNAL,
  view_instellingen: OFFICE, edit_instellingen: ['directie'],
};
const FEATURE_ACCESS_MATRIX: Record<FeatureAccess, UserRole[]> = {
  dashboard: INTERNAL, offertes: OFFICE, projecten: INTERNAL, klanten: OFFICE,
  medewerkers: ['directie', 'projectleider', 'voorman'],
  wagenpark: ['directie', 'projectleider', 'voorman', 'materiaalman'], machines: ['directie'],
  rapportages: ['directie', 'projectleider', 'materiaalman'], instellingen: OFFICE,
  chat: INTERNAL, notifications: INTERNAL, time_registration: INTERNAL, km_registration: INTERNAL,
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
    isAuthenticated && !isUserLoading && linkedMedewerkerId ? { id: linkedMedewerkerId } : 'skip'
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
      return isAuthenticated && !isUserLoading && allowedRoles.includes(role);
    };
  }, [role, isAuthenticated, isUserLoading]);

  // Feature access check function
  const canAccess = useMemo(() => {
    return (feature: FeatureAccess): boolean => {
      const allowedRoles = FEATURE_ACCESS_MATRIX[feature];
      return isAuthenticated && !isUserLoading && allowedRoles.includes(role);
    };
  }, [role, isAuthenticated, isUserLoading]);

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
 * <RoleGate roles={['directie']}>
 *   <AdminOnlyContent />
 * </RoleGate>
 *
 * // Show for admins and medewerkers
 * <RoleGate permission="register_uren">
 *   <TimeRegistrationButton />
 * </RoleGate>
 *
 * // Show based on permission
 * <RoleGate permission="manage_medewerkers">
 *   <MedewerkersManagement />
 * </RoleGate>
 *
 * // Show with fallback
 * <RoleGate roles={['directie']} fallback={<NoAccessMessage />}>
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
 * Shorthand for RoleGate with roles={['directie']}
 */
export function AdminOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <RoleGate roles={['directie']} fallback={fallback}>
      {children}
    </RoleGate>
  );
}

/**
 * MedewerkerOnly Component
 *
 * Shorthand for RoleGate with roles={['voorman', 'medewerker', 'onderaannemer_zzp', 'materiaalman']}
 */
export function MedewerkerOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <RoleGate roles={['voorman', 'medewerker', 'onderaannemer_zzp', 'materiaalman']} fallback={fallback}>
      {children}
    </RoleGate>
  );
}

/**
 * AdminOrMedewerker Component
 *
 * Shorthand for RoleGate with permission="register_uren"
 */
export function AdminOrMedewerker({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <RoleGate permission="register_uren" fallback={fallback}>
      {children}
    </RoleGate>
  );
}

export default RoleProvider;
