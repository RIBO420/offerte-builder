"use client";

import { useQuery, useMutation } from "convex/react";
import { useMemo, useCallback } from "react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useCurrentUser } from "./use-current-user";

export type VoorraadMutatieType = "inkoop" | "verbruik" | "correctie" | "retour";

/**
 * Hook for listing all voorraad items with product details
 */
export function useVoorraad() {
  const { user } = useCurrentUser();

  const voorraadItems = useQuery(
    api.voorraad.list,
    user?._id ? {} : "skip"
  );

  const isLoading = user && voorraadItems === undefined;

  // Memoize the list
  const voorraad = useMemo(() => voorraadItems ?? [], [voorraadItems]);

  // Group by category
  const voorraadPerCategorie = useMemo(() => {
    const grouped: Record<string, typeof voorraad> = {};
    for (const item of voorraad) {
      const categorie = item.product?.categorie ?? "Onbekend";
      if (!grouped[categorie]) {
        grouped[categorie] = [];
      }
      grouped[categorie].push(item);
    }
    return grouped;
  }, [voorraad]);

  return {
    voorraad,
    voorraadPerCategorie,
    isLoading,
  };
}

/**
 * Hook for single voorraad item
 */
export function useVoorraadItem(id: Id<"voorraad"> | null) {
  const voorraadItem = useQuery(
    api.voorraad.getById,
    id ? { id } : "skip"
  );

  return {
    voorraadItem,
    product: voorraadItem?.product ?? null,
    isLoading: id !== null && voorraadItem === undefined,
  };
}

/**
 * Hook for voorraad by product
 */
export function useVoorraadByProduct(productId: Id<"producten"> | null) {
  const voorraad = useQuery(
    api.voorraad.getByProduct,
    productId ? { productId } : "skip"
  );

  return {
    voorraad,
    isLoading: productId !== null && voorraad === undefined,
  };
}

/**
 * Hook for voorraad mutations (history)
 */
export function useVoorraadMutaties(voorraadId: Id<"voorraad"> | null) {
  const mutaties = useQuery(
    api.voorraad.getMutaties,
    voorraadId ? { voorraadId } : "skip"
  );

  return {
    mutaties: mutaties ?? [],
    isLoading: voorraadId !== null && mutaties === undefined,
  };
}

/**
 * Hook for items with low stock (below minimum)
 */
export function useLowStock() {
  const { user } = useCurrentUser();

  const lowStockItems = useQuery(
    api.voorraad.getLowStock,
    user?._id ? {} : "skip"
  );

  const isLoading = user && lowStockItems === undefined;

  // Memoize the list
  const items = useMemo(() => lowStockItems ?? [], [lowStockItems]);

  // Sort by tekort (shortage) descending
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => (b.tekort ?? 0) - (a.tekort ?? 0));
  }, [items]);

  return {
    lowStockItems: sortedItems,
    count: items.length,
    isLoading,
  };
}

/**
 * Hook for voorraad statistics
 */
export function useVoorraadStats() {
  const { user } = useCurrentUser();

  const stats = useQuery(
    api.voorraad.getStats,
    user?._id ? {} : "skip"
  );

  return {
    stats,
    isLoading: user && stats === undefined,
  };
}

/**
 * Hook for voorraad mutations (create, update, adjustStock)
 */
export function useVoorraadMutations() {
  const { user } = useCurrentUser();

  const createMutation = useMutation(api.voorraad.create);
  const updateMutation = useMutation(api.voorraad.update);
  const adjustStockMutation = useMutation(api.voorraad.adjustStock);
  const removeMutation = useMutation(api.voorraad.remove);
  const initializeFromProductsMutation = useMutation(api.voorraad.initializeFromProducts);

  const create = useCallback(
    async (data: {
      productId: Id<"producten">;
      hoeveelheid: number;
      minVoorraad?: number;
      maxVoorraad?: number;
      locatie?: string;
      notities?: string;
    }) => {
      if (!user?._id) throw new Error("User not found");
      return await createMutation(data);
    },
    [user?._id, createMutation]
  );

  const update = useCallback(
    async (
      id: Id<"voorraad">,
      data: {
        minVoorraad?: number;
        maxVoorraad?: number;
        locatie?: string;
        notities?: string;
      }
    ) => {
      return await updateMutation({ id, ...data });
    },
    [updateMutation]
  );

  const adjustStock = useCallback(
    async (data: {
      voorraadId: Id<"voorraad">;
      type: VoorraadMutatieType;
      hoeveelheid: number;
      projectId?: Id<"projecten">;
      inkooporderId?: Id<"inkooporders">;
      notities?: string;
      createdBy?: string;
    }) => {
      return await adjustStockMutation(data);
    },
    [adjustStockMutation]
  );

  const remove = useCallback(
    async (id: Id<"voorraad">) => {
      return await removeMutation({ id });
    },
    [removeMutation]
  );

  const initializeFromProducts = useCallback(
    async (options?: {
      defaultMinVoorraad?: number;
      defaultMaxVoorraad?: number;
    }) => {
      if (!user?._id) throw new Error("User not found");
      return await initializeFromProductsMutation(options ?? {});
    },
    [user?._id, initializeFromProductsMutation]
  );

  return {
    create,
    update,
    adjustStock,
    remove,
    initializeFromProducts,
  };
}
