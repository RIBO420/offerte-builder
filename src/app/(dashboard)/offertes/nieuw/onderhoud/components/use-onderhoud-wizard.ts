"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useOffertes } from "@/hooks/use-offertes";
import { useInstellingen } from "@/hooks/use-instellingen";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useOfferteCalculation } from "@/hooks/use-offerte-calculation";
import { useWizardAutosave } from "@/hooks/use-wizard-autosave";
import { useKlanten } from "@/hooks/use-klanten";
import { Id } from "../../../../../../../convex/_generated/dataModel";
import type { OffertePackage } from "@/lib/constants/packages";
import type { Bereikbaarheid, Achterstalligheid } from "@/types/offerte";
import { SCOPES, INITIAL_WIZARD_DATA } from "./constants";
import type { OnderhoudScope, OnderhoudScopeData, WizardData } from "./types";

export function useOnderhoudWizard() {
  const { isLoading: isUserLoading } = useCurrentUser();
  const { create, updateRegels } = useOffertes();
  const { getNextNummer, isLoading: isSettingsLoading, instellingen } = useInstellingen();
  const { calculate } = useOfferteCalculation();
  const { createFromOfferte: createKlantFromOfferte } = useKlanten();

  // Wizard autosave hook
  const {
    data: wizardData,
    step: currentStep,
    setData: setWizardData,
    setStep: setCurrentStep,
    draftAge,
    restoreDraft,
    discardDraft,
    clearDraft,
    showRestoreDialog,
  } = useWizardAutosave<WizardData>({
    key: "onderhoud",
    type: "onderhoud",
    initialData: INITIAL_WIZARD_DATA,
    initialStep: 0,
  });

  const totalSteps = 4;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdOfferteId, setCreatedOfferteId] = useState<string | null>(null);
  const [createdOfferteNummer, setCreatedOfferteNummer] = useState<string | null>(null);

  // Track validation errors per scope
  const [scopeValidationErrors, setScopeValidationErrors] = useState<Record<OnderhoudScope, Record<string, string>>>({
    gras: {},
    borders: {},
    heggen: {},
    bomen: {},
    overig: {},
    reiniging: {},
    bemesting: {},
    gazonanalyse: {},
    mollenbestrijding: {},
  });

  // Memoized handlers for scope validation changes to prevent infinite loops
  const scopeValidationHandlers = useMemo(() => ({
    gras: (_isValid: boolean, errors: Record<string, string>) => {
      setScopeValidationErrors(prev => ({ ...prev, gras: errors }));
    },
    borders: (_isValid: boolean, errors: Record<string, string>) => {
      setScopeValidationErrors(prev => ({ ...prev, borders: errors }));
    },
    heggen: (_isValid: boolean, errors: Record<string, string>) => {
      setScopeValidationErrors(prev => ({ ...prev, heggen: errors }));
    },
    bomen: (_isValid: boolean, errors: Record<string, string>) => {
      setScopeValidationErrors(prev => ({ ...prev, bomen: errors }));
    },
    overig: (_isValid: boolean, errors: Record<string, string>) => {
      setScopeValidationErrors(prev => ({ ...prev, overig: errors }));
    },
    reiniging: (_isValid: boolean, errors: Record<string, string>) => {
      setScopeValidationErrors(prev => ({ ...prev, reiniging: errors }));
    },
    bemesting: (_isValid: boolean, errors: Record<string, string>) => {
      setScopeValidationErrors(prev => ({ ...prev, bemesting: errors }));
    },
    gazonanalyse: (_isValid: boolean, errors: Record<string, string>) => {
      setScopeValidationErrors(prev => ({ ...prev, gazonanalyse: errors }));
    },
    mollenbestrijding: (_isValid: boolean, errors: Record<string, string>) => {
      setScopeValidationErrors(prev => ({ ...prev, mollenbestrijding: errors }));
    },
  }), []);

  // Extract data from wizard state for easier access
  const { selectedTemplateId, selectedKlantId, selectedScopes, bereikbaarheid, achterstalligheid, tuinOppervlakte, klantData, scopeData } = wizardData;

  // Helper functions to update wizard data
  const setSelectedTemplateId = (id: string | null) => {
    setWizardData((prev) => ({ ...prev, selectedTemplateId: id }));
  };

  const setSelectedKlantId = (id: string | null) => {
    setWizardData((prev) => ({ ...prev, selectedKlantId: id }));
  };

  const setSelectedScopes = (scopes: OnderhoudScope[] | ((prev: OnderhoudScope[]) => OnderhoudScope[])) => {
    if (typeof scopes === "function") {
      setWizardData((prev) => ({ ...prev, selectedScopes: scopes(prev.selectedScopes) }));
    } else {
      setWizardData((prev) => ({ ...prev, selectedScopes: scopes }));
    }
  };

  const setBereikbaarheid = (value: Bereikbaarheid) => {
    setWizardData((prev) => ({ ...prev, bereikbaarheid: value }));
  };

  const setAchterstalligheid = (value: Achterstalligheid) => {
    setWizardData((prev) => ({ ...prev, achterstalligheid: value }));
  };

  const setTuinOppervlakte = (value: string) => {
    setWizardData((prev) => ({ ...prev, tuinOppervlakte: value }));
  };

  const setKlantData = (data: typeof klantData) => {
    setWizardData((prev) => ({ ...prev, klantData: data }));
  };

  const setScopeData = (data: OnderhoudScopeData) => {
    setWizardData((prev) => ({ ...prev, scopeData: data }));
  };

  const isLoading = isUserLoading || isSettingsLoading;

  const toggleScope = (scopeId: OnderhoudScope) => {
    setSelectedScopes((prev) =>
      prev.includes(scopeId)
        ? prev.filter((s) => s !== scopeId)
        : [...prev, scopeId]
    );
  };

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
  const isScopeDataValid = (scope: OnderhoudScope): boolean => {
    switch (scope) {
      case "gras":
        return (
          !scopeData.gras.grasAanwezig ||
          scopeData.gras.grasOppervlakte > 0
        );
      case "borders":
        return (
          scopeData.borders.borderOppervlakte > 0 &&
          !!scopeData.borders.onderhoudsintensiteit
        );
      case "heggen":
        return (
          scopeData.heggen.lengte > 0 &&
          scopeData.heggen.hoogte > 0 &&
          scopeData.heggen.breedte > 0
        );
      case "bomen":
        return scopeData.bomen.aantalBomen > 0;
      case "overig":
        return true;
      case "reiniging":
        return true;
      case "bemesting":
        return true;
      case "gazonanalyse":
        return true;
      case "mollenbestrijding":
        return true;
      default:
        return false;
    }
  };

  const isStep2Valid = selectedScopes.every(isScopeDataValid);

  const handleStepNavigation = (stepIndex: number) => {
    if (stepIndex < currentStep) {
      setCurrentStep(stepIndex);
    }
  };

  const handleSubmit = async () => {
    if (!isStep1Valid || !isStep2Valid) return;

    setIsSubmitting(true);
    try {
      const offerteNummer = await getNextNummer();

      const filteredScopeData: Record<string, unknown> = {
        tuinOppervlakte: tuinOppervlakte ? parseFloat(tuinOppervlakte) : undefined,
      };
      selectedScopes.forEach((scope) => {
        filteredScopeData[scope] = scopeData[scope];
      });

      let klantId: Id<"klanten"> | undefined;
      if (selectedKlantId) {
        klantId = selectedKlantId as Id<"klanten">;
      } else if (klantData.naam && klantData.adres) {
        klantId = await createKlantFromOfferte({
          naam: klantData.naam,
          adres: klantData.adres,
          postcode: klantData.postcode,
          plaats: klantData.plaats,
          email: klantData.email || undefined,
          telefoon: klantData.telefoon || undefined,
        });
      }

      const offerteId = await create({
        type: "onderhoud",
        offerteNummer,
        klant: {
          naam: klantData.naam,
          adres: klantData.adres,
          postcode: klantData.postcode,
          plaats: klantData.plaats,
          email: klantData.email || undefined,
          telefoon: klantData.telefoon || undefined,
        },
        algemeenParams: {
          bereikbaarheid,
          achterstalligheid,
        },
        scopes: selectedScopes,
        scopeData: filteredScopeData,
        klantId,
      });

      const calculationResult = calculate({
        type: "onderhoud",
        scopes: selectedScopes,
        scopeData: filteredScopeData,
        bereikbaarheid,
        achterstalligheid,
      });

      if (calculationResult && calculationResult.regels.length > 0) {
        await updateRegels({
          id: offerteId,
          regels: calculationResult.regels,
          margePercentage: instellingen?.standaardMargePercentage || 15,
          btwPercentage: instellingen?.btwPercentage || 21,
          uurtarief: instellingen?.uurtarief || 45,
        });
      }

      clearDraft();
      setCreatedOfferteId(offerteId);
      setCreatedOfferteNummer(offerteNummer);
      setShowSuccessDialog(true);
      toast.success(`Offerte ${offerteNummer} aangemaakt`);
    } catch {
      toast.error("Fout bij aanmaken offerte");
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Handle template selection
  const handleTemplateSelect = (
    templateId: Id<"standaardtuinen"> | null,
    templateData?: { scopes: string[]; scopeData: Record<string, unknown> }
  ) => {
    if (templateId && templateData) {
      const validScopes = templateData.scopes.filter((s): s is OnderhoudScope =>
        SCOPES.some((scope) => scope.id === s)
      );

      const newScopeData = { ...scopeData };
      if (templateData.scopeData) {
        Object.entries(templateData.scopeData).forEach(([key, value]) => {
          if (key in newScopeData && value) {
            (newScopeData as Record<string, unknown>)[key] = value;
          }
        });
      }

      setWizardData({
        ...wizardData,
        selectedTemplateId: templateId,
        selectedScopes: validScopes,
        scopeData: newScopeData as OnderhoudScopeData,
      });
    } else {
      setSelectedTemplateId(templateId ? templateId : null);
    }

    setCurrentStep(1);
  };

  const handleTemplateSkip = () => {
    setCurrentStep(1);
  };

  // Handle package selection
  const handlePackageSelect = (pkg: OffertePackage) => {
    const validScopes = pkg.scopes.filter((s): s is OnderhoudScope =>
      SCOPES.some((scope) => scope.id === s)
    );

    const newScopeData = { ...INITIAL_WIZARD_DATA.scopeData };
    if (pkg.defaultWaarden) {
      Object.entries(pkg.defaultWaarden).forEach(([key, value]) => {
        if (key in newScopeData && value) {
          (newScopeData as Record<string, unknown>)[key] = value;
        }
      });
    }

    setWizardData({
      ...wizardData,
      selectedTemplateId: `package:${pkg.id}`,
      selectedScopes: validScopes,
      scopeData: newScopeData as OnderhoudScopeData,
    });

    setCurrentStep(1);
  };

  return {
    // State
    wizardData,
    currentStep,
    totalSteps,
    isLoading,
    isSubmitting,
    showTemplates,
    showSuccessDialog,
    createdOfferteId,
    createdOfferteNummer,
    showRestoreDialog,
    draftAge,
    scopeValidationErrors,
    scopeValidationHandlers,

    // Derived data
    selectedTemplateId,
    selectedKlantId,
    selectedScopes,
    bereikbaarheid,
    achterstalligheid,
    tuinOppervlakte,
    klantData,
    scopeData,
    hasVerplichtWarning,
    isStep1Valid,
    isStep2Valid,

    // Setters
    setShowTemplates,
    setShowSuccessDialog,
    setSelectedKlantId,
    setBereikbaarheid,
    setAchterstalligheid,
    setTuinOppervlakte,
    setKlantData,
    setScopeData,

    // Actions
    toggleScope,
    isScopeDataValid,
    handleStepNavigation,
    handleSubmit,
    nextStep,
    prevStep,
    handleTemplateSelect,
    handleTemplateSkip,
    handlePackageSelect,
    restoreDraft,
    discardDraft,
  };
}
