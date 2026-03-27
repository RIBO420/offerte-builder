"use client";

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";

export function useAdminDashboardData() {
  const { user } = useCurrentUser();
  const data = useQuery(
    api.dashboard.getAdminDashboardData,
    user?._id ? {} : "skip"
  );

  return useMemo(
    () => ({
      ...(data ?? {}),
      isLoading: user !== undefined && data === undefined,
    }),
    [data, user]
  );
}
