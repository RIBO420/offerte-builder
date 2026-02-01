"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import {
  Shovel,
  Layers,
  Flower2,
  Trees,
  Hammer,
  Zap,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  Loader2,
  Check,
  Save,
  CheckCircle2,
  Circle,
  Calculator,
  Edit,
  PartyPopper,
  ArrowRight,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useOffertes } from "@/hooks/use-offertes";
import { useInstellingen } from "@/hooks/use-instellingen";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useOfferteCalculation } from "@/hooks/use-offerte-calculation";
import { useWizardAutosave } from "@/hooks/use-wizard-autosave";
import {
  GrondwerkForm,
  BestratingForm,
  BordersForm,
  GrasForm,
  HoutwerkForm,
  WaterElektraForm,
  SpecialsForm,
} from "@/components/offerte/scope-forms";
import { TemplateSelector } from "@/components/offerte/template-selector";
import { PackageSelector } from "@/components/offerte/package-selector";
import { RestoreDraftDialog } from "@/components/offerte/restore-draft-dialog";
import { KlantSelector } from "@/components/offerte/klant-selector";
import { WizardSteps, type WizardStep } from "@/components/offerte/wizard-steps";
import { ValidationSummary, type ScopeValidation } from "@/components/offerte/validation-summary";
import { useKlanten } from "@/hooks/use-klanten";
import { Id } from "../../../../../../convex/_generated/dataModel";
import type { OffertePackage } from "@/lib/constants/packages";
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

type AanlegScope =
  | "grondwerk"
  | "bestrating"
  | "borders"
  | "gras"
  | "houtwerk"
  | "water_elektra"
  | "specials";

const SCOPES = [
  {
    id: "grondwerk" as AanlegScope,
    naam: "Grondwerk",
    icon: Shovel,
    beschrijving: "Ontgraven, afvoer, machine-uren",
    color: "bg-amber-500",
  },
  {
    id: "bestrating" as AanlegScope,
    naam: "Bestrating",
    icon: Layers,
    beschrijving: "Tegels/klinkers/natuursteen + onderbouw",
    verplicht: ["onderbouw"],
    color: "bg-slate-500",
  },
  {
    id: "borders" as AanlegScope,
    naam: "Borders & Beplanting",
    icon: Flower2,
    beschrijving: "Grondbewerking, planten, afwerking",
    color: "bg-pink-500",
  },
  {
    id: "gras" as AanlegScope,
    naam: "Gras / Gazon",
    icon: Trees,
    beschrijving: "Zaaien of graszoden, ondergrondbewerking",
    color: "bg-green-500",
  },
  {
    id: "houtwerk" as AanlegScope,
    naam: "Houtwerk",
    icon: Hammer,
    beschrijving: "Schutting/vlonder/pergola + fundering",
    verplicht: ["fundering"],
    color: "bg-orange-600",
  },
  {
    id: "water_elektra" as AanlegScope,
    naam: "Water / Elektra",
    icon: Zap,
    beschrijving: "Verlichting, sleuven, bekabeling",
    verplicht: ["sleuven", "herstel"],
    color: "bg-blue-500",
  },
  {
    id: "specials" as AanlegScope,
    naam: "Specials",
    icon: Sparkles,
    beschrijving: "Jacuzzi, sauna, prefab elementen",
    color: "bg-purple-500",
  },
];

// Default values for scope data
const DEFAULT_GRONDWERK: GrondwerkData = {
  oppervlakte: 0,
  diepte: "standaard",
  afvoerGrond: false,
};

const DEFAULT_BESTRATING: BestratingData = {
  oppervlakte: 0,
  typeBestrating: "tegel",
  snijwerk: "laag",
  onderbouw: {
    type: "zandbed",
    dikteOnderlaag: 5,
    opsluitbanden: false,
  },
};

const DEFAULT_BORDERS: BordersData = {
  oppervlakte: 0,
  beplantingsintensiteit: "gemiddeld",
  bodemverbetering: false,
  afwerking: "geen",
};

const DEFAULT_GRAS: GrasData = {
  oppervlakte: 0,
  type: "graszoden",
  ondergrond: "bestaand",
  afwateringNodig: false,
};

const DEFAULT_HOUTWERK: HoutwerkData = {
  typeHoutwerk: "schutting",
  afmeting: 0,
  fundering: "standaard",
};

const DEFAULT_WATER_ELEKTRA: WaterElektraData = {
  verlichting: "geen",
  aantalPunten: 0,
  sleuvenNodig: true,
};

const DEFAULT_SPECIALS: SpecialsData = {
  items: [],
};

type ScopeData = {
  grondwerk: GrondwerkData;
  bestrating: BestratingData;
  borders: BordersData;
  gras: GrasData;
  houtwerk: HoutwerkData;
  water_elektra: WaterElektraData;
  specials: SpecialsData;
};

// Type for wizard autosave data
interface WizardData {
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

const INITIAL_WIZARD_DATA: WizardData = {
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

export default function NieuweAanlegOffertePage() {
  const router = useRouter();
  const { isLoading: isUserLoading } = useCurrentUser();
  const { create, updateRegels } = useOffertes();
  const { getNextNummer, isLoading: isSettingsLoading, instellingen } = useInstellingen();
  const { calculate, isLoading: isCalcLoading } = useOfferteCalculation();
  const { createFromOfferte: createKlantFromOfferte } = useKlanten();

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

  const totalSteps = 4;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false); // Toggle between packages and templates
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdOfferteId, setCreatedOfferteId] = useState<string | null>(null);
  const [createdOfferteNummer, setCreatedOfferteNummer] = useState<string | null>(null);

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
  const setSelectedTemplateId = (id: string | null) => {
    setWizardData((prev) => ({ ...prev, selectedTemplateId: id }));
  };

  const setSelectedKlantId = (id: string | null) => {
    setWizardData((prev) => ({ ...prev, selectedKlantId: id }));
  };

  const setSelectedScopes = (scopes: AanlegScope[] | ((prev: AanlegScope[]) => AanlegScope[])) => {
    if (typeof scopes === "function") {
      setWizardData((prev) => ({ ...prev, selectedScopes: scopes(prev.selectedScopes) }));
    } else {
      setWizardData((prev) => ({ ...prev, selectedScopes: scopes }));
    }
  };

  const setBereikbaarheid = (value: Bereikbaarheid) => {
    setWizardData((prev) => ({ ...prev, bereikbaarheid: value }));
  };

  const setKlantData = (data: typeof klantData) => {
    setWizardData((prev) => ({ ...prev, klantData: data }));
  };

  const setScopeData = (data: ScopeData) => {
    setWizardData((prev) => ({ ...prev, scopeData: data }));
  };

  const isLoading = isUserLoading || isSettingsLoading;

  // Scroll naar top bij stap wisseling
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStep]);

  const toggleScope = (scopeId: AanlegScope) => {
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
  const isScopeDataValid = (scope: AanlegScope): boolean => {
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
  };

  const isStep2Valid = selectedScopes.every(isScopeDataValid);

  // Wizard steps configuration with summaries
  const wizardSteps: WizardStep[] = [
    {
      id: 0,
      name: "Snelstart",
      shortName: "Start",
      summary: selectedTemplateId ? (
        selectedTemplateId.startsWith("package:") ? (
          <span>Pakket geselecteerd</span>
        ) : (
          <span>Template geselecteerd</span>
        )
      ) : (
        <span>Handmatige invoer</span>
      ),
    },
    {
      id: 1,
      name: "Klantgegevens & Scopes",
      shortName: "Klant & Scopes",
      isValid: !!isStep1Valid,
      summary: (
        <div className="space-y-1">
          <div><strong>Klant:</strong> {klantData.naam || "—"}{klantData.plaats && `, ${klantData.plaats}`}</div>
          <div><strong>Bereikbaarheid:</strong> <span className="capitalize">{bereikbaarheid}</span></div>
          <div><strong>Scopes:</strong> {selectedScopes.length > 0
            ? selectedScopes.map(s => SCOPES.find(sc => sc.id === s)?.naam).join(", ")
            : "Geen geselecteerd"}
          </div>
        </div>
      ),
    },
    {
      id: 2,
      name: "Scope Details",
      shortName: "Details",
      isValid: isStep2Valid,
      summary: (
        <div className="space-y-1">
          {selectedScopes.map(scopeId => {
            const scope = SCOPES.find(s => s.id === scopeId);
            const valid = isScopeDataValid(scopeId);
            return (
              <div key={scopeId} className="flex items-center gap-2">
                {valid ? (
                  <Check className="h-3 w-3 text-green-600" />
                ) : (
                  <span className="h-3 w-3 rounded-full bg-orange-400" />
                )}
                <span>{scope?.naam}</span>
              </div>
            );
          })}
        </div>
      ),
    },
    {
      id: 3,
      name: "Bevestigen",
      shortName: "Bevestigen",
    },
  ];

  const handleStepNavigation = (stepIndex: number) => {
    // Only allow navigation to previous steps
    if (stepIndex < currentStep) {
      setCurrentStep(stepIndex);
    }
  };

  const handleSubmit = async () => {
    if (!isStep1Valid || !isStep2Valid) return;

    setIsSubmitting(true);
    try {
      const offerteNummer = await getNextNummer();

      // Build scope data object with only selected scopes
      const filteredScopeData: Record<string, unknown> = {};
      selectedScopes.forEach((scope) => {
        filteredScopeData[scope] = scopeData[scope];
      });

      // Create or get klant ID
      let klantId: Id<"klanten"> | undefined;
      if (selectedKlantId) {
        klantId = selectedKlantId as Id<"klanten">;
      } else if (klantData.naam && klantData.adres) {
        // Create new klant from offerte data
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
        type: "aanleg",
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
        },
        scopes: selectedScopes,
        scopeData: filteredScopeData,
        klantId,
      });

      // Calculate and save regels
      const calculationResult = calculate({
        type: "aanleg",
        scopes: selectedScopes,
        scopeData: filteredScopeData,
        bereikbaarheid,
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

      // Clear the draft after successful creation
      clearDraft();

      // Show success dialog with next steps
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
      // Pre-fill scopes from template
      const validScopes = templateData.scopes.filter((s): s is AanlegScope =>
        SCOPES.some((scope) => scope.id === s)
      );

      // Pre-fill scope data from template
      const newScopeData = { ...scopeData };
      if (templateData.scopeData) {
        Object.entries(templateData.scopeData).forEach(([key, value]) => {
          if (key in newScopeData && value) {
            (newScopeData as Record<string, unknown>)[key] = value;
          }
        });
      }

      // Update all at once
      setWizardData({
        ...wizardData,
        selectedTemplateId: templateId,
        selectedScopes: validScopes,
        scopeData: newScopeData as ScopeData,
      });
    } else {
      setSelectedTemplateId(templateId ? templateId : null);
    }

    // Move to step 1
    setCurrentStep(1);
  };

  const handleTemplateSkip = () => {
    setCurrentStep(1);
  };

  // Handle package selection
  const handlePackageSelect = (pkg: OffertePackage) => {
    // Pre-fill scopes from package
    const validScopes = pkg.scopes.filter((s): s is AanlegScope =>
      SCOPES.some((scope) => scope.id === s)
    );

    // Pre-fill scope data from package
    const newScopeData = { ...INITIAL_WIZARD_DATA.scopeData };
    if (pkg.defaultWaarden) {
      Object.entries(pkg.defaultWaarden).forEach(([key, value]) => {
        if (key in newScopeData && value) {
          (newScopeData as Record<string, unknown>)[key] = value;
        }
      });
    }

    // Update wizard data with package data
    setWizardData({
      ...wizardData,
      selectedTemplateId: `package:${pkg.id}`,
      selectedScopes: validScopes,
      scopeData: newScopeData as ScopeData,
    });

    // Move to step 1
    setCurrentStep(1);
  };

  const handleShowTemplates = () => {
    setShowTemplates(true);
  };

  const handleShowPackages = () => {
    setShowTemplates(false);
  };

  if (isLoading) {
    return (
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/offertes">Offertes</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Nieuwe Aanleg Offerte</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex flex-1 items-center justify-center"
        >
          <div className="relative flex flex-col items-center gap-4">
            {/* Gradient background glow */}
            <div className="absolute inset-0 -m-8 rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-amber-100/40 dark:from-primary/10 dark:via-primary/5 dark:to-amber-900/20 blur-2xl" />

            {/* Pulsing glow effect behind icon */}
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.6, 0.3]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute h-16 w-16 rounded-full bg-gradient-to-br from-primary/40 to-amber-400/40 dark:from-primary/30 dark:to-amber-500/30 blur-xl"
            />

            {/* Icon container with scale animation */}
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-amber-50 dark:from-primary/20 dark:to-amber-950/50 border border-primary/20 dark:border-primary/30 shadow-lg shadow-primary/10"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="h-8 w-8 text-primary" />
              </motion.div>
            </motion.div>

            {/* Loading text with fade */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="relative text-center"
            >
              <p className="text-sm font-medium text-primary">Wizard laden...</p>
              <p className="text-xs text-muted-foreground mt-1">Even geduld alstublieft</p>
            </motion.div>
          </div>
        </motion.div>
      </>
    );
  }

  return (
    <>
      {/* Restore Draft Dialog */}
      <RestoreDraftDialog
        open={showRestoreDialog}
        draftAge={draftAge}
        type="aanleg"
        onRestore={restoreDraft}
        onDiscard={discardDraft}
      />

      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/offertes">Offertes</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Nieuwe Aanleg Offerte</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-1 flex-col gap-3 p-3 md:gap-4 md:p-4 lg:gap-6 lg:p-6"
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight md:text-2xl lg:text-3xl">
                Nieuwe Aanleg Offerte
              </h1>
              <p className="text-sm text-muted-foreground">
                Stap {currentStep + 1} van {totalSteps}:{" "}
                {wizardSteps[currentStep]?.name}
              </p>
            </div>
            {/* Auto-save indicator */}
            {currentStep > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Save className="h-3 w-3" />
                <span className="hidden sm:inline">Auto-save aan</span>
              </div>
            )}
          </div>

          {/* Wizard Steps Navigation */}
          <WizardSteps
            steps={wizardSteps}
            currentStep={currentStep}
            onStepClick={handleStepNavigation}
            allowNavigation={true}
            showSummaries={currentStep > 0}
            className={currentStep === 0 ? "max-w-4xl mx-auto" : ""}
          />
        </motion.div>

        {/* Step 0: Package/Template Selectie */}
        {currentStep === 0 && (
          <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
            {showTemplates ? (
              <div className="space-y-4">
                <Button
                  variant="ghost"
                  onClick={handleShowPackages}
                  className="mb-2"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Terug naar Snelstart Pakketten
                </Button>
                <TemplateSelector
                  type="aanleg"
                  onSelect={handleTemplateSelect}
                  onSkip={handleTemplateSkip}
                />
              </div>
            ) : (
              <PackageSelector
                type="aanleg"
                onSelectPackage={handlePackageSelect}
                onSkip={handleTemplateSkip}
                onSelectTemplate={handleShowTemplates}
              />
            )}
          </div>
        )}

        {/* Step 1: Klantgegevens & Scope Selectie */}
        {currentStep === 1 && (
          <div className="grid gap-4 lg:grid-cols-3 lg:gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="lg:col-span-2 space-y-4 lg:space-y-6">
              {/* Klantgegevens */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Klantgegevens</CardTitle>
                  <CardDescription className="text-xs">
                    Selecteer een bestaande klant of voer nieuwe gegevens in
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <KlantSelector
                    value={klantData}
                    onChange={setKlantData}
                    onKlantSelect={(klantId) => setSelectedKlantId(klantId as string | null)}
                  />
                </CardContent>
              </Card>

              {/* Algemene Parameters */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Algemene Parameters</CardTitle>
                  <CardDescription className="text-xs">
                    Parameters die van toepassing zijn op alle scopes
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <Label htmlFor="bereikbaarheid">Bereikbaarheid</Label>
                    <Select
                      value={bereikbaarheid}
                      onValueChange={(v) => setBereikbaarheid(v as Bereikbaarheid)}
                    >
                      <SelectTrigger id="bereikbaarheid">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="goed">Goed (factor 1.0)</SelectItem>
                        <SelectItem value="beperkt">Beperkt (factor 1.2)</SelectItem>
                        <SelectItem value="slecht">Slecht (factor 1.5)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Beperkte bereikbaarheid verhoogt de arbeidsuren
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Scope Selectie */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Scope Selectie</CardTitle>
                  <CardDescription className="text-xs">
                    Selecteer de werkzaamheden die onderdeel zijn van het project.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid gap-2 md:grid-cols-2 lg:gap-3">
                    {SCOPES.map((scope) => {
                      const isSelected = selectedScopes.includes(scope.id);
                      return (
                        <div
                          key={scope.id}
                          className={`relative flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-all duration-200 hover:shadow-md active:scale-[0.98] touch-manipulation ${
                            isSelected
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-border hover:border-muted-foreground/30"
                          }`}
                          onClick={() => toggleScope(scope.id)}
                          role="checkbox"
                          aria-checked={isSelected}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === " " || e.key === "Enter") {
                              e.preventDefault();
                              toggleScope(scope.id);
                            }
                          }}
                        >
                          {/* Custom checkbox indicator with scope color */}
                          <div
                            className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 transition-all duration-200 ${
                              isSelected
                                ? `${scope.color} border-transparent text-white scale-100`
                                : "border-input bg-background scale-95"
                            }`}
                          >
                            {isSelected ? (
                              <Check className="h-5 w-5 animate-in zoom-in-50 duration-200" strokeWidth={3} />
                            ) : (
                              <scope.icon className="h-4 w-4 text-muted-foreground opacity-50" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <scope.icon className={`h-4 w-4 shrink-0 transition-colors ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                              <Label
                                htmlFor={scope.id}
                                className="cursor-pointer font-medium text-sm"
                              >
                                {scope.naam}
                              </Label>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                              {scope.beschrijving}
                            </p>
                            {scope.verplicht && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {scope.verplicht.map((v) => (
                                  <Badge
                                    key={v}
                                    variant="secondary"
                                    className="text-[10px] px-1.5 py-0"
                                  >
                                    + {v}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {hasVerplichtWarning && selectedScopes.length > 0 && (
                    <Alert className="mt-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Verplichte onderdelen</AlertTitle>
                      <AlertDescription>
                        Sommige geselecteerde scopes hebben verplichte onderdelen
                        die automatisch worden meegenomen in de offerte.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar met samenvatting */}
            <div className="space-y-3">
              <Card className="sticky top-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Samenvatting</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {/* Klant sectie met status indicator */}
                  <div className="flex items-start gap-2">
                    {klantData.naam && klantData.adres ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-muted-foreground">
                        Klant
                      </p>
                      <p className="text-sm truncate">
                        {klantData.naam || "—"}
                        {klantData.plaats && `, ${klantData.plaats}`}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Bereikbaarheid sectie */}
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Bereikbaarheid
                      </p>
                      <p className="text-sm capitalize">{bereikbaarheid}</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Scopes sectie met status indicator */}
                  <div className="flex items-start gap-2">
                    {selectedScopes.length > 0 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Geselecteerde scopes ({selectedScopes.length})
                      </p>
                      {selectedScopes.length > 0 ? (
                        <ul className="mt-2 space-y-1.5">
                          {selectedScopes.map((scopeId) => {
                            const scope = SCOPES.find((s) => s.id === scopeId);
                            return (
                              <li
                                key={scopeId}
                                className="flex items-center gap-2 text-sm animate-in fade-in slide-in-from-left-2 duration-200"
                              >
                                <div className={`h-2 w-2 rounded-full ${scope?.color || "bg-primary"}`} />
                                {scope?.naam}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Geen scopes geselecteerd
                        </p>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <Button
                    className="w-full"
                    disabled={!isStep1Valid}
                    onClick={nextStep}
                  >
                    Volgende: Scope Details
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>

                  <Button variant="outline" className="w-full" onClick={prevStep}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Terug naar Template
                  </Button>

                  <Button variant="ghost" className="w-full" asChild>
                    <Link href="/offertes">Annuleren</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Step 2: Scope Details */}
        {currentStep === 2 && (
          <div className="grid gap-4 lg:grid-cols-3 lg:gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="lg:col-span-2 space-y-4 lg:space-y-5">
              {selectedScopes.map((scopeId) => {
                switch (scopeId) {
                  case "grondwerk":
                    return (
                      <GrondwerkForm
                        key={scopeId}
                        data={scopeData.grondwerk}
                        onChange={(data) =>
                          setScopeData({ ...scopeData, grondwerk: data })
                        }
                        onValidationChange={scopeValidationHandlers.grondwerk}
                      />
                    );
                  case "bestrating":
                    return (
                      <BestratingForm
                        key={scopeId}
                        data={scopeData.bestrating}
                        onChange={(data) =>
                          setScopeData({ ...scopeData, bestrating: data })
                        }
                        onValidationChange={scopeValidationHandlers.bestrating}
                      />
                    );
                  case "borders":
                    return (
                      <BordersForm
                        key={scopeId}
                        data={scopeData.borders}
                        onChange={(data) =>
                          setScopeData({ ...scopeData, borders: data })
                        }
                        onValidationChange={scopeValidationHandlers.borders}
                      />
                    );
                  case "gras":
                    return (
                      <GrasForm
                        key={scopeId}
                        data={scopeData.gras}
                        onChange={(data) =>
                          setScopeData({ ...scopeData, gras: data })
                        }
                        onValidationChange={scopeValidationHandlers.gras}
                      />
                    );
                  case "houtwerk":
                    return (
                      <HoutwerkForm
                        key={scopeId}
                        data={scopeData.houtwerk}
                        onChange={(data) =>
                          setScopeData({ ...scopeData, houtwerk: data })
                        }
                        onValidationChange={scopeValidationHandlers.houtwerk}
                      />
                    );
                  case "water_elektra":
                    return (
                      <WaterElektraForm
                        key={scopeId}
                        data={scopeData.water_elektra}
                        onChange={(data) =>
                          setScopeData({ ...scopeData, water_elektra: data })
                        }
                        onValidationChange={scopeValidationHandlers.water_elektra}
                      />
                    );
                  case "specials":
                    return (
                      <SpecialsForm
                        key={scopeId}
                        data={scopeData.specials}
                        onChange={(data) =>
                          setScopeData({ ...scopeData, specials: data })
                        }
                        onValidationChange={scopeValidationHandlers.specials}
                      />
                    );
                  default:
                    return null;
                }
              })}
            </div>

            {/* Sidebar met voortgang */}
            <div className="space-y-3">
              <Card className="sticky top-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Scope Voortgang</CardTitle>
                  <CardDescription className="text-xs">
                    Vul alle verplichte velden in per scope
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <ValidationSummary
                    validations={selectedScopes.map((scopeId) => {
                      const scope = SCOPES.find((s) => s.id === scopeId);
                      const errors = scopeValidationErrors[scopeId] || {};
                      return {
                        scopeId,
                        scopeName: scope?.naam || scopeId,
                        isValid: isScopeDataValid(scopeId) && Object.keys(errors).length === 0,
                        errors: Object.entries(errors).map(([field, message]) => ({
                          field,
                          message,
                        })),
                        icon: scope?.icon,
                      } as ScopeValidation;
                    })}
                  />

                  <Separator />

                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      disabled={!isStep2Valid}
                      onClick={nextStep}
                    >
                      Volgende: Bevestigen
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>

                    <Button variant="outline" className="w-full" onClick={prevStep}>
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Terug
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Step 3: Bevestigen */}
        {currentStep === 3 && (
          <div className="grid gap-4 lg:grid-cols-3 lg:gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="lg:col-span-2 space-y-4 lg:space-y-5">
              {/* Klant samenvatting */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Klantgegevens</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <dl className="grid gap-4 md:grid-cols-2">
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">
                        Naam
                      </dt>
                      <dd className="text-sm">{klantData.naam}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">
                        Telefoon
                      </dt>
                      <dd className="text-sm">{klantData.telefoon || "—"}</dd>
                    </div>
                    <div className="md:col-span-2">
                      <dt className="text-sm font-medium text-muted-foreground">
                        Adres
                      </dt>
                      <dd className="text-sm">
                        {klantData.adres}, {klantData.postcode} {klantData.plaats}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">
                        E-mail
                      </dt>
                      <dd className="text-sm">{klantData.email || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">
                        Bereikbaarheid
                      </dt>
                      <dd className="text-sm capitalize">{bereikbaarheid}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Scopes samenvatting */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Geselecteerde Scopes</CardTitle>
                  <CardDescription className="text-xs">
                    Overzicht van alle werkzaamheden
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {selectedScopes.map((scopeId) => {
                    const scope = SCOPES.find((s) => s.id === scopeId);
                    return (
                      <div
                        key={scopeId}
                        className="rounded-lg border p-3 space-y-1 transition-all hover:shadow-sm"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`h-8 w-8 rounded-lg ${scope?.color || "bg-primary"} flex items-center justify-center`}>
                            {scope?.icon && (
                              <scope.icon className="h-4 w-4 text-white" />
                            )}
                          </div>
                          <span className="font-medium">{scope?.naam}</span>
                          <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto" />
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {scopeId === "grondwerk" && (
                            <>
                              {scopeData.grondwerk.oppervlakte} m², diepte:{" "}
                              {scopeData.grondwerk.diepte}
                              {scopeData.grondwerk.afvoerGrond && ", incl. afvoer"}
                            </>
                          )}
                          {scopeId === "bestrating" && (
                            <>
                              {scopeData.bestrating.oppervlakte} m²,{" "}
                              {scopeData.bestrating.typeBestrating}, snijwerk:{" "}
                              {scopeData.bestrating.snijwerk}
                              <br />
                              Onderbouw: {scopeData.bestrating.onderbouw.type},{" "}
                              {scopeData.bestrating.onderbouw.dikteOnderlaag}cm
                              {scopeData.bestrating.onderbouw.opsluitbanden &&
                                ", incl. opsluitbanden"}
                            </>
                          )}
                          {scopeId === "borders" && (
                            <>
                              {scopeData.borders.oppervlakte} m², intensiteit:{" "}
                              {scopeData.borders.beplantingsintensiteit}
                              {scopeData.borders.bodemverbetering &&
                                ", incl. bodemverbetering"}
                              {scopeData.borders.afwerking !== "geen" &&
                                `, afwerking: ${scopeData.borders.afwerking}`}
                            </>
                          )}
                          {scopeId === "gras" && (
                            <>
                              {scopeData.gras.oppervlakte} m², {scopeData.gras.type}
                              , ondergrond: {scopeData.gras.ondergrond}
                              {scopeData.gras.afwateringNodig &&
                                ", incl. drainage"}
                            </>
                          )}
                          {scopeId === "houtwerk" && (
                            <>
                              {scopeData.houtwerk.typeHoutwerk},{" "}
                              {scopeData.houtwerk.afmeting}
                              {scopeData.houtwerk.typeHoutwerk === "schutting"
                                ? " m"
                                : " m²"}
                              <br />
                              Fundering: {scopeData.houtwerk.fundering}
                            </>
                          )}
                          {scopeId === "water_elektra" && (
                            <>
                              Verlichting: {scopeData.water_elektra.verlichting}
                              {scopeData.water_elektra.aantalPunten > 0 &&
                                `, ${scopeData.water_elektra.aantalPunten} aansluitpunten`}
                              <br />
                              Incl. sleuven en herstelwerk
                            </>
                          )}
                          {scopeId === "specials" && (
                            <>
                              {scopeData.specials.items.length} item(s):{" "}
                              {scopeData.specials.items
                                .map((i) => i.omschrijving)
                                .join(", ")}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Let op</AlertTitle>
                <AlertDescription>
                  Na het aanmaken wordt de offerte berekend op basis van de
                  normuren en correctiefactoren. U kunt de offerte daarna nog
                  bewerken.
                </AlertDescription>
              </Alert>
            </div>

            {/* Sidebar met acties */}
            <div className="space-y-3">
              <Card className="sticky top-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Offerte Aanmaken</CardTitle>
                  <CardDescription className="text-xs">
                    Controleer de gegevens en maak de offerte aan
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {/* Checklist voor voltooide secties */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Klantgegevens ingevuld</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>{selectedScopes.length} scope{selectedScopes.length !== 1 ? "s" : ""} geselecteerd</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Scope details ingevuld</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Scope overzicht met kleuren */}
                  <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Geselecteerde scopes</p>
                    {selectedScopes.map((scopeId) => {
                      const scope = SCOPES.find((s) => s.id === scopeId);
                      return (
                        <div key={scopeId} className="flex items-center gap-2 text-sm">
                          <div className={`h-2 w-2 rounded-full ${scope?.color || "bg-primary"}`} />
                          <span>{scope?.naam}</span>
                        </div>
                      );
                    })}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      disabled={isSubmitting}
                      onClick={handleSubmit}
                      size="lg"
                    >
                      {isSubmitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      Offerte Aanmaken
                    </Button>

                    <Button variant="outline" className="w-full" onClick={prevStep}>
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Terug naar Scope Details
                    </Button>

                    <Button variant="ghost" className="w-full" asChild>
                      <Link href="/offertes">Annuleren</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </motion.div>

      {/* Success Dialog with Next Steps */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
              <PartyPopper className="h-8 w-8 text-green-600" />
            </div>
            <DialogTitle className="text-center text-xl">
              Offerte {createdOfferteNummer} aangemaakt!
            </DialogTitle>
            <DialogDescription className="text-center">
              Je offerte is succesvol opgeslagen. Wat wil je nu doen?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {/* Recommended: Voorcalculatie */}
            <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
              onClick={() => {
                setShowSuccessDialog(false);
                router.push(`/offertes/${createdOfferteId}/voorcalculatie`);
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
                    <Calculator className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">Voorcalculatie invullen</p>
                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        Aanbevolen
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Bepaal teamgrootte en geschatte projectduur
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-blue-500 shrink-0 mt-2.5" />
                </div>
              </CardContent>
            </Card>

            {/* Edit offerte */}
            <Card className="cursor-pointer hover:border-muted-foreground/30 transition-colors"
              onClick={() => {
                setShowSuccessDialog(false);
                router.push(`/offertes/${createdOfferteId}/bewerken`);
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Edit className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Offerte bewerken</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Pas regels en prijzen aan
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 mt-2.5" />
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter className="sm:justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowSuccessDialog(false);
                router.push(`/offertes/${createdOfferteId}`);
              }}
            >
              Bekijk offerte
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setShowSuccessDialog(false);
                router.push("/offertes");
              }}
            >
              Naar overzicht
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
