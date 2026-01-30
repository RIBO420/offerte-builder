"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";
import { Id, Doc } from "../../convex/_generated/dataModel";

type Template = Doc<"standaardtuinen"> & { isSystem: boolean };

export function useStandaardtuinen(type?: "aanleg" | "onderhoud") {
  const { user } = useCurrentUser();

  // Query uses auth context - no userId args needed
  const templates = useQuery(
    api.standaardtuinen.list,
    user?._id ? { type } : "skip"
  );

  const createTemplate = useMutation(api.standaardtuinen.create);
  const updateTemplate = useMutation(api.standaardtuinen.update);
  const deleteTemplate = useMutation(api.standaardtuinen.remove);
  const initSystem = useMutation(api.standaardtuinen.initializeSystemTemplates);
  const createFromTemplate = useMutation(api.standaardtuinen.createOfferteFromTemplate);

  const create = async (data: {
    naam: string;
    omschrijving?: string;
    type: "aanleg" | "onderhoud";
    scopes: string[];
    defaultWaarden: Record<string, unknown>;
  }) => {
    if (!user?._id) throw new Error("User not found");
    return createTemplate(data);
  };

  const update = async (
    id: Id<"standaardtuinen">,
    data: {
      naam?: string;
      omschrijving?: string;
      scopes?: string[];
      defaultWaarden?: Record<string, unknown>;
    }
  ) => {
    return updateTemplate({ id, ...data });
  };

  const remove = async (id: Id<"standaardtuinen">) => {
    return deleteTemplate({ id });
  };

  const createOfferte = async (
    templateId: Id<"standaardtuinen">,
    data: {
      offerteNummer: string;
      klant: {
        naam: string;
        adres: string;
        postcode: string;
        plaats: string;
        email?: string;
        telefoon?: string;
      };
      bereikbaarheid: "goed" | "beperkt" | "slecht";
      achterstalligheid?: "laag" | "gemiddeld" | "hoog";
    }
  ) => {
    if (!user?._id) throw new Error("User not found");
    return createFromTemplate({
      templateId,
      ...data,
    });
  };

  // Separate system and user templates
  const systemTemplates = templates?.filter((t: Template) => t.isSystem) || [];
  const userTemplates = templates?.filter((t: Template) => !t.isSystem) || [];

  return {
    templates: templates || [],
    systemTemplates,
    userTemplates,
    isLoading: user && templates === undefined,
    create,
    update,
    delete: remove,
    initializeSystemTemplates: initSystem,
    createOfferte,
  };
}

export function useStandaardtuin(id: Id<"standaardtuinen"> | undefined) {
  const template = useQuery(
    api.standaardtuinen.get,
    id ? { id } : "skip"
  );

  return {
    template,
    isLoading: id && template === undefined,
  };
}
