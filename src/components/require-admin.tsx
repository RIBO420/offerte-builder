"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useIsAdmin, useCurrentUserRole, type UserRole } from "@/hooks/use-users";
import { useCurrentUser } from "@/hooks/use-current-user";

interface RequireAdminProps {
  children: React.ReactNode;
  fallbackUrl?: string;
}

/**
 * Restrict page access to directie/admin only.
 * For broader role access, use RequireRole instead.
 */
export function RequireAdmin({ children, fallbackUrl = "/projecten" }: RequireAdminProps) {
  const router = useRouter();
  const { isLoading } = useCurrentUser();
  const isAdmin = useIsAdmin();

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.push(fallbackUrl);
    }
  }, [isLoading, isAdmin, router, fallbackUrl]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Laden...</div>;
  }

  if (!isAdmin) {
    return null;
  }

  return <>{children}</>;
}

interface RequireRoleProps {
  children: React.ReactNode;
  /** Roles allowed to access this page. Legacy "admin" maps to "directie", "viewer" maps to "klant". */
  allowedRoles: UserRole[];
  fallbackUrl?: string;
}

/**
 * Restrict page access to specific roles.
 * Handles backward compatibility: "admin" users match "directie", "viewer" matches "klant".
 */
export function RequireRole({ children, allowedRoles, fallbackUrl = "/dashboard" }: RequireRoleProps) {
  const router = useRouter();
  const { isLoading } = useCurrentUser();
  const role = useCurrentUserRole();

  // Normalize legacy roles for comparison
  const normalizedRole = role === "admin" ? "directie" : role === "viewer" ? "klant" : role;
  const hasAccess = normalizedRole !== null && allowedRoles.includes(normalizedRole);

  useEffect(() => {
    if (!isLoading && !hasAccess) {
      router.push(fallbackUrl);
    }
  }, [isLoading, hasAccess, router, fallbackUrl]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Laden...</div>;
  }

  if (!hasAccess) {
    return null;
  }

  return <>{children}</>;
}
