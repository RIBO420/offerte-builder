"use client";

import { useQuery, useMutation } from "convex/react";
import { useMemo, useCallback } from "react";
import { useCurrentUser } from "../../hooks/use-current-user";
import type { TableNames, Id } from "../../../convex/_generated/dataModel";
import type { FunctionReference, FunctionArgs, FunctionReturnType } from "convex/server";

// ============================================================================
// GENERIC HOOK FACTORY
// ============================================================================
// This factory reduces 80%+ duplicate code across resource hooks by extracting
// common patterns into reusable, type-safe functions.
//
// USAGE:
// ```typescript
// const useKlantFactory = createGetResourceHook(api.klanten.get, "klanten");
//
// export function useKlant(id: Id<"klanten"> | null) {
//   const { data, isLoading } = useKlantFactory(id);
//   return { klant: data, isLoading };
// }
// ```
// ============================================================================

// Type for any Convex query function - use looser typing to work with useQuery
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyConvexQuery = FunctionReference<"query", "public", any, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyConvexMutation = FunctionReference<"mutation", "public", any, any>;

/**
 * Return type for useGet hook
 */
export interface UseGetReturn<TData> {
  data: TData | undefined;
  isLoading: boolean;
}

/**
 * Creates a hook for getting a single resource by ID.
 * This is the most commonly reused pattern across hooks.
 *
 * @example
 * ```typescript
 * const useKlantFactory = createGetResourceHook(api.klanten.get, "klanten");
 *
 * export function useKlant(id: Id<"klanten"> | null) {
 *   const { data, isLoading } = useKlantFactory(id);
 *   return { klant: data, isLoading };
 * }
 * ```
 */
export function createGetResourceHook<
  TGetQuery extends AnyConvexQuery,
  TTableName extends TableNames,
>(
  getQuery: TGetQuery,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _tableName?: TTableName
): (id: Id<TTableName> | null) => UseGetReturn<FunctionReturnType<TGetQuery>> {
  type GetData = FunctionReturnType<TGetQuery>;

  return function useGetResource(id: Id<TTableName> | null): UseGetReturn<GetData> {
    // Use the query with proper skip handling
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = useQuery(getQuery as any, id ? { id } : "skip") as GetData | undefined;

    const isLoading = id !== null && data === undefined;

    return {
      data,
      isLoading,
    };
  };
}

/**
 * Creates a search hook for resources with standard search patterns.
 *
 * @example
 * ```typescript
 * const useKlantenSearchFactory = createSearchHook(api.klanten.search);
 *
 * export function useKlantenSearch(searchTerm: string) {
 *   const { results, isLoading } = useKlantenSearchFactory(searchTerm);
 *   return { results: results ?? [], isLoading };
 * }
 * ```
 */
export function createSearchHook<
  TSearchQuery extends AnyConvexQuery,
>(
  searchQuery: TSearchQuery,
  options?: {
    minSearchLength?: number;
  }
) {
  type SearchResult = FunctionReturnType<TSearchQuery>;
  type SearchArgs = FunctionArgs<TSearchQuery>;

  const minLength = options?.minSearchLength ?? 2;

  return function useSearch(searchTerm: string, extraArgs?: Omit<SearchArgs, "searchTerm">) {
    const { user } = useCurrentUser();

    const shouldSearch = !!user?._id && searchTerm.length >= minLength;

    const args = { searchTerm, ...extraArgs } as SearchArgs;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = useQuery(searchQuery as any, shouldSearch ? args : "skip") as SearchResult | undefined;

    return {
      results: results ?? ([] as unknown as SearchResult),
      isLoading: shouldSearch && results === undefined,
    };
  };
}

/**
 * Creates a standard list hook with authentication check.
 *
 * @example
 * ```typescript
 * const useKlantenListFactory = createListHook(api.klanten.list);
 *
 * export function useKlantenList() {
 *   return useKlantenListFactory();
 * }
 * ```
 */
export function createListHook<
  TListQuery extends AnyConvexQuery,
>(
  listQuery: TListQuery
) {
  type ListData = FunctionReturnType<TListQuery>;
  type ListArgs = FunctionArgs<TListQuery>;

  return function useList(args?: Partial<ListArgs>) {
    const { user } = useCurrentUser();

    const queryArgs = (args ?? {}) as ListArgs;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = useQuery(listQuery as any, user?._id ? queryArgs : "skip") as ListData | undefined;

    const isLoading = !!user && data === undefined;

    return {
      data,
      isLoading,
    };
  };
}

/**
 * Creates memoized CRUD mutation hooks.
 *
 * @example
 * ```typescript
 * const useKlantenMutations = createMutationsHook({
 *   createMutation: api.klanten.create,
 *   updateMutation: api.klanten.update,
 *   removeMutation: api.klanten.remove,
 *   name: "klanten",
 * });
 * ```
 */
export function createMutationsHook<
  TCreateMutation extends AnyConvexMutation,
  TUpdateMutation extends AnyConvexMutation,
  TRemoveMutation extends AnyConvexMutation,
  TTableName extends TableNames,
>(config: {
  createMutation: TCreateMutation;
  updateMutation: TUpdateMutation;
  removeMutation: TRemoveMutation;
  tableName: TTableName;
  name: string;
}) {
  type CreateInput = FunctionArgs<TCreateMutation>;
  type UpdateInput = Omit<FunctionArgs<TUpdateMutation>, "id">;
  type CreateReturn = FunctionReturnType<TCreateMutation>;
  type UpdateReturn = FunctionReturnType<TUpdateMutation>;
  type RemoveReturn = FunctionReturnType<TRemoveMutation>;

  return function useMutations() {
    const { user } = useCurrentUser();

    const createMutation = useMutation(config.createMutation);
    const updateMutation = useMutation(config.updateMutation);
    const removeMutation = useMutation(config.removeMutation);

    const create = useCallback(
      async (data: CreateInput): Promise<CreateReturn> => {
        if (!user?._id) {
          throw new Error(`User not found - cannot create ${config.name}`);
        }
        return await createMutation(data) as CreateReturn;
      },
      [user?._id, createMutation]
    );

    const update = useCallback(
      async (id: Id<TTableName>, data: UpdateInput): Promise<UpdateReturn> => {
        return await updateMutation({ id, ...data } as FunctionArgs<TUpdateMutation>) as UpdateReturn;
      },
      [updateMutation]
    );

    const remove = useCallback(
      async (id: Id<TTableName>): Promise<RemoveReturn> => {
        return await removeMutation({ id } as FunctionArgs<TRemoveMutation>) as RemoveReturn;
      },
      [removeMutation]
    );

    return {
      create,
      update,
      remove,
      isReady: !!user?._id,
    };
  };
}

/**
 * Creates a combined hook that returns both list data and mutations.
 * This is useful for simpler components that need everything in one hook.
 *
 * @example
 * ```typescript
 * const useKlanten = createCombinedResourceHook({
 *   listQuery: api.klanten.list,
 *   createMutation: api.klanten.create,
 *   updateMutation: api.klanten.update,
 *   removeMutation: api.klanten.remove,
 *   tableName: "klanten",
 *   name: "klanten",
 * });
 * ```
 */
export function createCombinedResourceHook<
  TListQuery extends AnyConvexQuery,
  TCreateMutation extends AnyConvexMutation,
  TUpdateMutation extends AnyConvexMutation,
  TRemoveMutation extends AnyConvexMutation,
  TTableName extends TableNames,
>(config: {
  listQuery: TListQuery;
  createMutation: TCreateMutation;
  updateMutation: TUpdateMutation;
  removeMutation: TRemoveMutation;
  tableName: TTableName;
  name: string;
}) {
  type ListData = FunctionReturnType<TListQuery>;
  type ListArgs = FunctionArgs<TListQuery>;
  type CreateInput = FunctionArgs<TCreateMutation>;
  type UpdateInput = Omit<FunctionArgs<TUpdateMutation>, "id">;

  return function useCombinedResource(args?: Partial<ListArgs>) {
    const { user } = useCurrentUser();

    const queryArgs = (args ?? {}) as ListArgs;

    // Query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = useQuery(config.listQuery as any, user?._id ? queryArgs : "skip") as ListData | undefined;

    // Mutations
    const createMutation = useMutation(config.createMutation);
    const updateMutation = useMutation(config.updateMutation);
    const removeMutation = useMutation(config.removeMutation);

    // Loading state
    const isLoading = !!user && data === undefined;

    // Memoize the list to prevent reference changes
    const list = useMemo(() => {
      if (!data) return [];
      return Array.isArray(data) ? data : [];
    }, [data]);

    // Memoized mutation callbacks
    const create = useCallback(
      async (createData: CreateInput) => {
        if (!user?._id) {
          throw new Error(`User not found - cannot create ${config.name}`);
        }
        return await createMutation(createData);
      },
      [user?._id, createMutation]
    );

    const update = useCallback(
      async (id: Id<TTableName>, updateData: UpdateInput) => {
        return await updateMutation({ id, ...updateData } as FunctionArgs<TUpdateMutation>);
      },
      [updateMutation]
    );

    const remove = useCallback(
      async (id: Id<TTableName>) => {
        return await removeMutation({ id } as FunctionArgs<TRemoveMutation>);
      },
      [removeMutation]
    );

    return {
      data,
      list,
      isLoading,
      create,
      update,
      remove,
    };
  };
}

/**
 * Creates a hook with list data that provides both the raw data and
 * memoized computed values.
 *
 * @example
 * ```typescript
 * const useMedewerkers = createListWithComputedHook(
 *   api.medewerkers.list,
 *   (items) => ({
 *     activeMedewerkers: items.filter(m => m.isActief),
 *   })
 * );
 * ```
 */
export function createListWithComputedHook<
  TListQuery extends AnyConvexQuery,
  TItem extends { _id: string },
  TComputed extends object,
>(
  listQuery: TListQuery,
  computeValues: (items: TItem[]) => TComputed
) {
  type ListData = FunctionReturnType<TListQuery>;
  type ListArgs = FunctionArgs<TListQuery>;

  return function useListWithComputed(args?: Partial<ListArgs>) {
    const { user } = useCurrentUser();

    const queryArgs = (args ?? {}) as ListArgs;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = useQuery(listQuery as any, user?._id ? queryArgs : "skip") as ListData | undefined;

    const isLoading = !!user && data === undefined;

    // Ensure data is an array before computing values
    const items = useMemo(() => {
      if (!data) return [] as TItem[];
      return (Array.isArray(data) ? data : []) as TItem[];
    }, [data]);

    const computed = useMemo(() => computeValues(items), [items]);

    return {
      items,
      isLoading,
      ...computed,
    };
  };
}

// ============================================================================
// TYPE HELPERS
// ============================================================================

/**
 * Helper type to extract the item type from a list query
 */
export type QueryListItem<TQuery extends AnyConvexQuery> =
  FunctionReturnType<TQuery> extends (infer U)[] ? U : never;

/**
 * Helper type to get the return data type from a get query
 */
export type QueryGetItem<TQuery extends AnyConvexQuery> = FunctionReturnType<TQuery>;
