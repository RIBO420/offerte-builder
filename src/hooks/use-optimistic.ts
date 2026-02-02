"use client";

import { useState, useCallback, useRef } from "react";

/**
 * A custom hook for managing optimistic updates with automatic rollback on failure.
 *
 * @template T The type of the data being managed
 * @param initialData The initial data state
 * @returns Object with data, setData, and optimisticUpdate function
 */
export function useOptimistic<T>(initialData: T) {
  const [data, setData] = useState<T>(initialData);
  const previousDataRef = useRef<T>(initialData);

  /**
   * Performs an optimistic update with automatic rollback on failure.
   *
   * @param optimisticValue The value to set immediately (optimistically)
   * @param serverCall The async function that performs the actual server mutation
   * @param onError Optional callback for error handling
   * @returns Promise that resolves when the server call completes
   */
  const optimisticUpdate = useCallback(
    async (
      optimisticValue: T | ((prev: T) => T),
      serverCall: () => Promise<unknown>,
      onError?: (error: Error) => void
    ): Promise<boolean> => {
      // Store current value for potential rollback
      previousDataRef.current = data;

      // Apply optimistic update immediately
      const newValue =
        typeof optimisticValue === "function"
          ? (optimisticValue as (prev: T) => T)(data)
          : optimisticValue;
      setData(newValue);

      try {
        // Perform actual server call
        await serverCall();
        return true;
      } catch (error) {
        // Rollback on error
        setData(previousDataRef.current);
        if (onError) {
          onError(error instanceof Error ? error : new Error(String(error)));
        }
        return false;
      }
    },
    [data]
  );

  return {
    data,
    setData,
    optimisticUpdate,
  };
}

/**
 * Hook for managing optimistic updates on a list of items.
 * Provides specialized methods for common list operations.
 *
 * @template T The type of items in the list (must have an id or _id property)
 */
export function useOptimisticList<T extends { _id: string } | { id: string }>(
  initialItems: T[]
) {
  const [items, setItems] = useState<T[]>(initialItems);
  const previousItemsRef = useRef<T[]>(initialItems);

  // Sync with external data when it changes
  const syncItems = useCallback((newItems: T[]) => {
    setItems(newItems);
  }, []);

  // Helper to get item ID - memoized to be stable
  const getItemId = useCallback((item: T): string => {
    return "_id" in item ? item._id : (item as { id: string }).id;
  }, []);

  /**
   * Optimistically update a single item in the list
   */
  const optimisticUpdateItem = useCallback(
    async (
      itemId: string,
      updates: Partial<T>,
      serverCall: () => Promise<unknown>,
      onError?: (error: Error) => void
    ): Promise<boolean> => {
      previousItemsRef.current = items;

      // Apply optimistic update
      setItems((prev) =>
        prev.map((item) =>
          getItemId(item) === itemId ? { ...item, ...updates } : item
        )
      );

      try {
        await serverCall();
        return true;
      } catch (error) {
        setItems(previousItemsRef.current);
        if (onError) {
          onError(error instanceof Error ? error : new Error(String(error)));
        }
        return false;
      }
    },
    [items, getItemId]
  );

  /**
   * Optimistically remove an item from the list
   */
  const optimisticRemoveItem = useCallback(
    async (
      itemId: string,
      serverCall: () => Promise<unknown>,
      onError?: (error: Error) => void
    ): Promise<boolean> => {
      previousItemsRef.current = items;

      // Apply optimistic removal
      setItems((prev) => prev.filter((item) => getItemId(item) !== itemId));

      try {
        await serverCall();
        return true;
      } catch (error) {
        setItems(previousItemsRef.current);
        if (onError) {
          onError(error instanceof Error ? error : new Error(String(error)));
        }
        return false;
      }
    },
    [items, getItemId]
  );

  /**
   * Optimistically add an item to the list
   */
  const optimisticAddItem = useCallback(
    async (
      newItem: T,
      serverCall: () => Promise<unknown>,
      onError?: (error: Error) => void
    ): Promise<boolean> => {
      previousItemsRef.current = items;

      // Apply optimistic addition
      setItems((prev) => [...prev, newItem]);

      try {
        await serverCall();
        return true;
      } catch (error) {
        setItems(previousItemsRef.current);
        if (onError) {
          onError(error instanceof Error ? error : new Error(String(error)));
        }
        return false;
      }
    },
    [items]
  );

  /**
   * Optimistically update multiple items (for bulk operations)
   */
  const optimisticBulkUpdate = useCallback(
    async (
      itemIds: string[],
      updates: Partial<T>,
      serverCall: () => Promise<unknown>,
      onError?: (error: Error) => void
    ): Promise<boolean> => {
      previousItemsRef.current = items;

      const idSet = new Set(itemIds);
      // Apply optimistic bulk update
      setItems((prev) =>
        prev.map((item) =>
          idSet.has(getItemId(item)) ? { ...item, ...updates } : item
        )
      );

      try {
        await serverCall();
        return true;
      } catch (error) {
        setItems(previousItemsRef.current);
        if (onError) {
          onError(error instanceof Error ? error : new Error(String(error)));
        }
        return false;
      }
    },
    [items, getItemId]
  );

  /**
   * Optimistically remove multiple items (for bulk delete)
   */
  const optimisticBulkRemove = useCallback(
    async (
      itemIds: string[],
      serverCall: () => Promise<unknown>,
      onError?: (error: Error) => void
    ): Promise<boolean> => {
      previousItemsRef.current = items;

      const idSet = new Set(itemIds);
      // Apply optimistic bulk removal
      setItems((prev) => prev.filter((item) => !idSet.has(getItemId(item))));

      try {
        await serverCall();
        return true;
      } catch (error) {
        setItems(previousItemsRef.current);
        if (onError) {
          onError(error instanceof Error ? error : new Error(String(error)));
        }
        return false;
      }
    },
    [items, getItemId]
  );

  return {
    items,
    setItems,
    syncItems,
    optimisticUpdateItem,
    optimisticRemoveItem,
    optimisticAddItem,
    optimisticBulkUpdate,
    optimisticBulkRemove,
  };
}

/**
 * Type helper for creating optimistic update handlers
 */
export type OptimisticHandler<T> = {
  execute: (
    optimisticValue: T | ((prev: T) => T),
    serverCall: () => Promise<unknown>
  ) => Promise<boolean>;
  rollback: () => void;
};
