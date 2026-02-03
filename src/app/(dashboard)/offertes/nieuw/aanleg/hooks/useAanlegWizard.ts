"use client";

import { useState, useMemo, useCallback } from "react";
import { useWizardAutosave } from "@/hooks/use-wizard-autosave";
import type {
  Bereikbaarheid,
  GrondwerkData,
  BestratingData,
  BordersData,
  GrasData,
  HoutwerkData,
  WaterElektraData,
  SpecialsData,
} from "@/types/offerte";

export type AanlegScope =
  | "grondwerk"
  | "bestrating"
  | "borders"
  | "gras"
  | "houtwerk"
  | "water_elektra"
  | "specials";

export type ScopeData = {
  grondwerk: GrondwerkData;
  bestrating: BestratingData;
  borders: BordersData;
  gras: GrasData;
  houtwerk: HoutwerkData;
  water_elektra: WaterElektraData;
  specials: SpecialsData;
};

// Default values for scope data
export const DEFAULT_GRONDWERK: GrondwerkData = {
  oppervlakte: 0,
  diepte: "standaard",
  afvoerGrond: false,
};

export const DEFAULT_BESTRATING: BestratingData = {
  oppervlakte: 0,
  typeBestrating: "tegel",
  snijwerk: "laag",
  onderbouw: {
    type: "zandbed",
    dikteOnderlaag: 5,
    opsluitbanden: false,
  },
};

export const DEFAULT_BORDERS: BordersData = {
  oppervlakte: 0,
  beplantingsintensiteit: "gemiddeld",
  bodemverbetering: false,
  afwerking: "geen",
};

export const DEFAULT_GRAS: GrasData = {
  oppervlakte: 0,
  type: "graszoden",
  ondergrond: "bestaand",
  afwateringNodig: false,
};

export const DEFAULT_HOUTWERK: HoutwerkData = {
  typeHoutwerk: "schutting",
  afmeting: 0,
  fundering: "standaard",
};

export const DEFAULT_WATER_ELEKTRA: WaterElektraData = {
  verlichting: "geen",
  aantalPunten: 0,
  sleuvenNodig: true,
};

export const DEFAULT_SPECIALS: SpecialsData = {
  items: [],
};

// Type for wizard autosave data
export interface WizardData {
  selectedTemplateId: string | null;
  selectedKlantId: string | null;
  selectedScopes: AanlegScope[];
  bereikbaarheid: Bereikbaarheid;
  klantData: {
    naam: string;
    adres: string;
    postcode: string;
    plaats: string;
    email: string;
    telefoon: string;
  };
  scopeData: ScopeData;
}

export const INITIAL_WIZARD_DATA: WizardData = {
  selectedTemplateId: null,
  selectedKlantId: null,
  selectedScopes: [],
  bereikbaarheid: "goed",
  klantData: {
    naam: "",
    adres: "",
    postcode: "",
    plaats: "",
    email: "",
    telefoon: "",
  },
  scopeData: {
    grondwerk: DEFAULT_GRONDWERK,
    bestrating: DEFAULT_BESTRATING,
    borders: DEFAULT_BORDERS,
    gras: DEFAULT_GRAS,
    houtwerk: DEFAULT_HOUTWERK,
    water_elektra: DEFAULT_WATER_ELEKTRA,
    specials: DEFAULT_SPECIALS,
  },
};

// Scope definitions with icons and colors
export const SCOPES = [
  {
    id: "grondwerk" as AanlegScope,
    naam: "Grondwerk",
    beschrijving: "Ontgraven, afvoer, machine-uren",
    color: "bg-amber-500",
  },
  {
    id: "bestrating" as AanlegScope,
    naam: "Bestrating",
    beschrijving: "Tegels/klinkers/natuursteen + onderbouw",
    verplicht: ["onderbouw"],
    color: "bg-slate-500",
  },
  {
    id: "borders" as AanlegScope,
    naam: "Borders & Beplanting",
    beschrijving: "Grondbewerking, planten, afwerking",
    color: "bg-pink-500",
  },
  {
    id: "gras" as AanlegScope,
    naam: "Gras / Gazon",
    beschrijving: "Zaaien of graszoden, ondergrondbewerking",
    color: "bg-green-500",
  },
  {
    id: "houtwerk" as AanlegScope,
    naam: "Houtwerk",
    beschrijving: "Schutting/vlonder/pergola + fundering",
    verplicht: ["fundering"],
    color: "bg-orange-600",
  },
  {
    id: "water_elektra" as AanlegScope,
    naam: "Water / Elektra",
    beschrijving: "Verlichting, sleuven, bekabeling",
    verplicht: ["sleuven", "herstel"],
    color: "bg-blue-500",
  },
  {
    id: "specials" as AanlegScope,
    naam: "Specials",
    beschrijving: "Jacuzzi, sauna, prefab elementen",
    color: "bg-purple-500",
  },
];

export interface UseAanlegWizardReturn {
  // Wizard state
  wizardData: WizardData;
  currentStep: number;
  totalSteps: number;

  // Extracted data from wizard state
  selectedTemplateId: string | null;
  selectedKlantId: string | null;
  selectedScopes: AanlegScope[];
  bereikbaarheid: Bereikbaarheid;
  klantData: WizardData["klantData"];
  scopeData: ScopeData;

  // Setters
  setWizardData: (data: WizardData | ((prev: WizardData) => WizardData)) => void;
  setCurrentStep: (step: number) => void;
  setSelectedTemplateId: (id: string | null) => void;
  setSelectedKlantId: (id: string | null) => void;
  setSelectedScopes: (scopes: AanlegScope[] | ((prev: AanlegScope[]) => AanlegScope[])) => void;
  setBereikbaarheid: (value: Bereikbaarheid) => void;
  setKlantData: (data: WizardData["klantData"]) => void;
  setScopeData: (data: ScopeData) => void;

  // Navigation
  nextStep: () => void;
  prevStep: () => void;
  handleStepNavigation: (stepIndex: number) => void;

  // Scope operations
  toggleScope: (scopeId: AanlegScope) => void;

  // Validation
  isStep1Valid: boolean;
  isStep2Valid: boolean;
  isScopeDataValid: (scope: AanlegScope) => boolean;
  hasVerplichtWarning: boolean;

  // Scope validation errors tracking
  scopeValidationErrors: Record<AanlegScope, Record<string, string>>;
  scopeValidationHandlers: Record<AanlegScope, (isValid: boolean, errors: Record<string, string>) => void>;

  // Draft management
  hasDraft: boolean;
  draftAge: string | null;
  restoreDraft: () => void;
  discardDraft: () => void;
  clearDraft: () => void;
  showRestoreDialog: boolean;
  setShowRestoreDialog: (show: boolean) => void;
}

export function useAanlegWizard(): UseAanlegWizardReturn {
  const totalSteps = 4;

  // Wizard autosave hook
  const {
    data: wizardData,
    step: currentStep,
    setData: setWizardData,
    setStep: setCurrentStep,
    hasDraft,
    draftAge,
    restoreDraft,
    discardDraft,
    clearDraft,
    showRestoreDialog,
    setShowRestoreDialog,
  } = useWizardAutosave<WizardData>({
    key: "aanleg",
    type: "aanleg",
    initialData: INITIAL_WIZARD_DATA,
    initialStep: 0,
  });

  // Track validation errors per scope
  const [scopeValidationErrors, setScopeValidationErrors] = useState<Record<AanlegScope, Record<string, string>>>({
    grondwerk: {},
    bestrating: {},
    borders: {},
    gras: {},
    houtwerk: {},
    water_elektra: {},
    specials: {},
  });

  // Memoized handlers for scope validation changes to prevent infinite loops
  const scopeValidationHandlers = useMemo(() => ({
    grondwerk: (_isValid: boolean, errors: Record<string, string>) => {
      setScopeValidationErrors(prev => ({ ...prev, grondwerk: errors }));
    },
    bestrating: (_isValid: boolean, errors: Record<string, string>) => {
      setScopeValidationErrors(prev => ({ ...prev, bestrating: errors }));
    },
    borders: (_isValid: boolean, errors: Record<string, string>) => {
      setScopeValidationErrors(prev => ({ ...prev, borders: errors }));
    },
    gras: (_isValid: boolean, errors: Record<string, string>) => {
      setScopeValidationErrors(prev => ({ ...prev, gras: errors }));
    },
    houtwerk: (_isValid: boolean, errors: Record<string, string>) => {
      setScopeValidationErrors(prev => ({ ...prev, houtwerk: errors }));
    },
    water_elektra: (_isValid: boolean, errors: Record<string, string>) => {
      setScopeValidationErrors(prev => ({ ...prev, water_elektra: errors }));
    },
    specials: (_isValid: boolean, errors: Record<string, string>) => {
      setScopeValidationErrors(prev => ({ ...prev, specials: errors }));
    },
  }), []);

  // Extract data from wizard state for easier access
  const { selectedTemplateId, selectedKlantId, selectedScopes, bereikbaarheid, klantData, scopeData } = wizardData;

  // Helper functions to update wizard data - using functional updates to prevent stale state
  const setSelectedTemplateId = useCallback((id: string | null) => {
    setWizardData((prev) => ({ ...prev, selectedTemplateId: id }));
  }, [setWizardData]);

  const setSelectedKlantId = useCallback((id: string | null) => {
    setWizardData((prev) => ({ ...prev, selectedKlantId: id }));
  }, [setWizardData]);

  const setSelectedScopes = useCallback((scopes: AanlegScope[] | ((prev: AanlegScope[]) => AanlegScope[])) => {
    if (typeof scopes === "function") {
      setWizardData((prev) => ({ ...prev, selectedScopes: scopes(prev.selectedScopes) }));
    } else {
      setWizardData((prev) => ({ ...prev, selectedScopes: scopes }));
    }
  }, [setWizardData]);

  const setBereikbaarheid = useCallback((value: Bereikbaarheid) => {
    setWizardData((prev) => ({ ...prev, bereikbaarheid: value }));
  }, [setWizardData]);

  const setKlantData = useCallback((data: typeof klantData) => {
    setWizardData((prev) => ({ ...prev, klantData: data }));
  }, [setWizardData]);

  const setScopeData = useCallback((data: ScopeData) => {
    setWizardData((prev) => ({ ...prev, scopeData: data }));
  }, [setWizardData]);

  // Toggle scope selection
  const toggleScope = useCallback((scopeId: AanlegScope) => {
    setSelectedScopes((prev) =>
      prev.includes(scopeId)
        ? prev.filter((s) => s !== scopeId)
        : [...prev, scopeId]
    );
  }, [setSelectedScopes]);

  // Navigation
  const nextStep = useCallback(() => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, totalSteps, setCurrentStep]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep, setCurrentStep]);

  const handleStepNavigation = useCallback((stepIndex: number) => {
    // Only allow navigation to previous steps
    if (stepIndex < currentStep) {
      setCurrentStep(stepIndex);
    }
  }, [currentStep, setCurrentStep]);

  // Validation
  const hasVerplichtWarning = selectedScopes.some((scope) => {
    const scopeConfig = SCOPES.find((s) => s.id === scope);
    return scopeConfig?.verplicht && scopeConfig.verplicht.length > 0;
  });

  const isStep1Valid =
    klantData.naam &&
    klantData.adres &&
    klantData.postcode &&
    klantData.plaats &&
    selectedScopes.length > 0;

  // Validate scope data - check if required fields are filled
  const isScopeDataValid = useCallback((scope: AanlegScope): boolean => {
    switch (scope) {
      case "grondwerk":
        return scopeData.grondwerk.oppervlakte > 0;
      case "bestrating":
        return (
          scopeData.bestrating.oppervlakte > 0 &&
          scopeData.bestrating.onderbouw.dikteOnderlaag > 0
        );
      case "borders":
        return scopeData.borders.oppervlakte > 0;
      case "gras":
        return scopeData.gras.oppervlakte > 0;
      case "houtwerk":
        return scopeData.houtwerk.afmeting > 0;
      case "water_elektra":
        return (
          scopeData.water_elektra.verlichting !== "geen" ||
          scopeData.water_elektra.aantalPunten > 0
        );
      case "specials":
        return scopeData.specials.items.length > 0;
      default:
        return false;
    }
  }, [scopeData]);

  const isStep2Valid = selectedScopes.every(isScopeDataValid);

  return {
    // Wizard state
    wizardData,
    currentStep,
    totalSteps,

    // Extracted data from wizard state
    selectedTemplateId,
    selectedKlantId,
    selectedScopes,
    bereikbaarheid,
    klantData,
    scopeData,

    // Setters
    setWizardData,
    setCurrentStep,
    setSelectedTemplateId,
    setSelectedKlantId,
    setSelectedScopes,
    setBereikbaarheid,
    setKlantData,
    setScopeData,

    // Navigation
    nextStep,
    prevStep,
    handleStepNavigation,

    // Scope operations
    toggleScope,

    // Validation
    isStep1Valid: !!isStep1Valid,
    isStep2Valid,
    isScopeDataValid,
    hasVerplichtWarning,

    // Scope validation errors tracking
    scopeValidationErrors,
    scopeValidationHandlers,

    // Draft management
    hasDraft,
    draftAge,
    restoreDraft,
    discardDraft,
    clearDraft,
    showRestoreDialog,
    setShowRestoreDialog,
  };
}
