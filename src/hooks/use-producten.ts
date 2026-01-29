"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";
import { Id } from "../../convex/_generated/dataModel";

export function useProducten() {
  const { user } = useCurrentUser();

  const producten = useQuery(
    api.producten.list,
    user?._id ? { userId: user._id } : "skip"
  );

  const categories = useQuery(
    api.producten.getCategories,
    user?._id ? { userId: user._id } : "skip"
  );

  const countByCategorie = useQuery(
    api.producten.countByCategorie,
    user?._id ? { userId: user._id } : "skip"
  );

  const createProduct = useMutation(api.producten.create);
  const updateProduct = useMutation(api.producten.update);
  const deleteProduct = useMutation(api.producten.remove);
  const bulkImport = useMutation(api.producten.bulkImport);

  const create = async (data: {
    productnaam: string;
    categorie: string;
    inkoopprijs: number;
    verkoopprijs: number;
    eenheid: string;
    leverancier?: string;
    verliespercentage: number;
  }) => {
    if (!user?._id) throw new Error("User not found");
    return createProduct({ userId: user._id, ...data });
  };

  const importProducts = async (
    producten: Array<{
      productnaam: string;
      categorie: string;
      inkoopprijs: number;
      verkoopprijs: number;
      eenheid: string;
      leverancier?: string;
      verliespercentage: number;
    }>
  ) => {
    if (!user?._id) throw new Error("User not found");
    return bulkImport({ userId: user._id, producten });
  };

  return {
    producten: producten?.filter((p) => p.isActief) || [],
    allProducten: producten || [],
    categories: categories || [],
    countByCategorie: countByCategorie || {},
    isLoading: user && producten === undefined,
    create,
    update: updateProduct,
    delete: deleteProduct,
    importProducts,
  };
}

export function useProduct(id: Id<"producten"> | null) {
  const product = useQuery(api.producten.get, id ? { id } : "skip");

  return {
    product,
    isLoading: id && product === undefined,
  };
}

export function useProductSearch(zoekterm: string, categorie?: string) {
  const { user } = useCurrentUser();

  const results = useQuery(
    api.producten.search,
    user?._id && zoekterm.length >= 2
      ? { userId: user._id, zoekterm, categorie }
      : "skip"
  );

  return {
    results: results || [],
    isLoading: user && zoekterm.length >= 2 && results === undefined,
  };
}
