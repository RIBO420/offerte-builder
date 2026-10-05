/** Native capability mirror. Unknown/loading identities receive no permissions. */
export const USER_ROLES = ['directie', 'projectleider', 'voorman', 'medewerker', 'klant', 'onderaannemer_zzp', 'materiaalman'] as const;
export type UserRole = typeof USER_ROLES[number];
export type NativeRole = UserRole | 'onbekend';

export function normalizeRole(role: unknown): NativeRole {
  if (role === 'admin') return 'directie';
  if (role === 'viewer') return 'klant';
  return USER_ROLES.includes(role as UserRole) ? role as UserRole : 'onbekend';
}
export const ROLE_LABELS: Record<NativeRole, string> = {
  directie: 'Directie', projectleider: 'Projectleider', voorman: 'Voorman',
  medewerker: 'Medewerker', klant: 'Klant', onderaannemer_zzp: 'Onderaannemer / zzp',
  materiaalman: 'Materiaalman', onbekend: 'Geen toegang',
};
export const isKantoorRole = (role: NativeRole) => role === 'directie' || role === 'projectleider';
export const isFieldRole = (role: NativeRole) => ['voorman', 'medewerker', 'onderaannemer_zzp', 'materiaalman'].includes(role);
export const isInternalRole = (role: NativeRole) => isKantoorRole(role) || isFieldRole(role);

export interface RolePermissions {
  canViewDashboard: boolean; canViewUren: boolean; canViewNotifications: boolean;
  canViewChat: boolean; canViewProfiel: boolean; canManageUsers: boolean;
  canManageSettings: boolean; canViewReports: boolean; canManageMedewerkers: boolean;
  canManageProjects: boolean; canCreateEntries: boolean; canEditEntries: boolean;
  canDeleteEntries: boolean; isReadOnly: boolean;
}
export function getPermissionsForRole(value: unknown): RolePermissions {
  const role = normalizeRole(value);
  const internal = isInternalRole(role);
  const directie = role === 'directie';
  return {
    canViewDashboard: internal, canViewUren: internal, canViewNotifications: internal,
    canViewChat: internal, canViewProfiel: role !== 'onbekend',
    canManageUsers: directie, canManageSettings: directie,
    canViewReports: isKantoorRole(role) || role === 'materiaalman',
    canManageMedewerkers: directie, canManageProjects: isKantoorRole(role),
    canCreateEntries: internal, canEditEntries: internal,
    canDeleteEntries: isKantoorRole(role), isReadOnly: !internal,
  };
}
