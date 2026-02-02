"use client";

import { useQuery, useMutation } from "convex/react";
import { useMemo, useCallback } from "react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useCurrentUser } from "./use-current-user";

export function useKlanten() {
  const { user } = useCurrentUser();

  // Use combined query to reduce 2 round-trips to 1
  const data = useQuery(
    api.klanten.listWithRecent,
    user?._id ? {} : "skip"
  );

  const createMutation = useMutation(api.klanten.create);
  const updateMutation = useMutation(api.klanten.update);
  const removeMutation = useMutation(api.klanten.remove);
  const createFromOfferteMutation = useMutation(api.klanten.createFromOfferte);

  const isLoading = user && data === undefined;

  // Memoize lists to prevent reference changes
  const klanten = useMemo(() => data?.klanten ?? [], [data?.klanten]);
  const recentKlanten = useMemo(() => data?.recentKlanten ?? [], [data?.recentKlanten]);

  // Memoize callbacks to prevent unnecessary re-renders in child components
  const create = useCallback(
    async (klantData: {
      naam: string;
      adres: string;
      postcode: string;
      plaats: string;
      email?: string;
      telefoon?: string;
      notities?: string;
    }) => {
      if (!user?._id) throw new Error("User not found");
      return await createMutation(klantData);
    },
    [user?._id, createMutation]
  );

  const update = useCallback(
    async (
      id: Id<"klanten">,
      klantData: {
        naam?: string;
        adres?: string;
        postcode?: string;
        plaats?: string;
        email?: string;
        telefoon?: string;
        notities?: string;
      }
    ) => {
      return await updateMutation({ id, ...klantData });
    },
    [updateMutation]
  );

  const remove = useCallback(
    async (id: Id<"klanten">) => {
      return await removeMutation({ id });
    },
    [removeMutation]
  );

  const createFromOfferte = useCallback(
    async (klantData: {
      naam: string;
      adres: string;
      postcode: string;
      plaats: string;
      email?: string;
      telefoon?: string;
    }) => {
      if (!user?._id) throw new Error("User not found");
      return await createFromOfferteMutation(klantData);
    },
    [user?._id, createFromOfferteMutation]
  );

  return {
    klanten,
    recentKlanten,
    isLoading,
    create,
    update,
    remove,
    createFromOfferte,
  };
}

export function useKlant(id: Id<"klanten"> | null) {
  const klant = useQuery(
    api.klanten.get,
    id ? { id } : "skip"
  );

  return {
    klant,
    isLoading: id !== null && klant === undefined,
  };
}

export function useKlantWithOffertes(id: Id<"klanten"> | null) {
  const data = useQuery(
    api.klanten.getWithOffertes,
    id ? { id } : "skip"
  );

  return {
    klant: data,
    isLoading: id !== null && data === undefined,
  };
}

export function useKlantenSearch(searchTerm: string) {
  const { user } = useCurrentUser();

  const results = useQuery(
    api.klanten.search,
    user?._id ? { searchTerm } : "skip"
  );

  return {
    results: results ?? [],
    isLoading: results === undefined,
  };
}
