"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

export function useKlanten() {
  const klanten = useQuery(api.klanten.list);
  const recentKlanten = useQuery(api.klanten.getRecent);

  const createMutation = useMutation(api.klanten.create);
  const updateMutation = useMutation(api.klanten.update);
  const removeMutation = useMutation(api.klanten.remove);
  const createFromOfferteMutation = useMutation(api.klanten.createFromOfferte);

  const isLoading = klanten === undefined;

  const create = async (data: {
    naam: string;
    adres: string;
    postcode: string;
    plaats: string;
    email?: string;
    telefoon?: string;
    notities?: string;
  }) => {
    return await createMutation(data);
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
    return await createFromOfferteMutation(data);
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
  const results = useQuery(api.klanten.search, { searchTerm });

  return {
    results: results ?? [],
    isLoading: results === undefined,
  };
}
