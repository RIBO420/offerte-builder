/**
 * Contexts Module Exports
 *
 * Central export for all context providers and hooks.
 */

// Toast Context
export { ToastProvider, useToast } from './ToastContext';

// Role Context - Role-based access control
export {
  RoleProvider,
  useRole,
  RoleGate,
  AdminOnly,
  MedewerkerOnly,
  AdminOrMedewerker,
} from './RoleContext';

export type {
  RoleContextValue,
  LinkedMedewerker,
  PermissionAction,
  FeatureAccess,
} from './RoleContext';
