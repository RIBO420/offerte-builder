"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useIsAdmin } from "@/hooks/use-users";
import { useCurrentUser } from "@/hooks/use-current-user";

interface RequireAdminProps {
  children: React.ReactNode;
  fallbackUrl?: string;
}

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
