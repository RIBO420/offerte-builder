"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useCurrentUser } from "./use-current-user";

export function useKlanten() {
  const { user } = useCurrentUser();

  const klanten = useQuery(
    api.klanten.list,
    user?._id ? { userId: user._id } : "skip"
  );

  const recentKlanten = useQuery(
    api.klanten.getRecent,
    user?._id ? { userId: user._id } : "skip"
  );

  const createMutation = useMutation(api.klanten.create);
  const updateMutation = useMutation(api.klanten.update);
  const removeMutation = useMutation(api.klanten.remove);
  const createFromOfferteMutation = useMutation(api.klanten.createFromOfferte);

  const isLoading = user && klanten === undefined;

  const create = async (data: {
    naam: string;
    adres: string;
    postcode: string;
    plaats: string;
    email?: string;
    telefoon?: string;
    notities?: string;
  }) => {
    if (!user?._id) throw new Error("User not found");
    return await createMutation({ userId: user._id, ...data });
  };

  const update = async (
    id: Id<"klanten">,
    data: {
      naam?: string;
      adres?: string;
      postcode?: string;
      plaats?: string;
      email?: string;
      telefoon?: string;
      notities?: string;
    }
  ) => {
    return await updateMutation({ id, ...data });
  };

  const remove = async (id: Id<"klanten">) => {
    return await removeMutation({ id });
  };

  const createFromOfferte = async (data: {
    naam: string;
    adres: string;
    postcode: string;
    plaats: string;
    email?: string;
    telefoon?: string;
  }) => {
    if (!user?._id) throw new Error("User not found");
    return await createFromOfferteMutation({ userId: user._id, ...data });
  };

  return {
    klanten: klanten ?? [],
    recentKlanten: recentKlanten ?? [],
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
    user?._id ? { userId: user._id, searchTerm } : "skip"
  );

  return {
    results: results ?? [],
    isLoading: results === undefined,
  };
}
