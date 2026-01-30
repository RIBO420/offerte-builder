"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Progress } from "@/components/ui/progress";
import {
  Trees,
  Flower2,
  TreeDeciduous,
  Scissors,
  Leaf,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  Loader2,
  Check,
  Save,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { useOffertes } from "@/hooks/use-offertes";
import { useInstellingen } from "@/hooks/use-instellingen";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useOfferteCalculation } from "@/hooks/use-offerte-calculation";
import { useWizardAutosave } from "@/hooks/use-wizard-autosave";
import {
  GrasOnderhoudForm,
  BordersOnderhoudForm,
  HeggenForm,
  BomenForm,
  OverigForm,
} from "@/components/offerte/onderhoud-forms";
import { TemplateSelector } from "@/components/offerte/template-selector";
import { RestoreDraftDialog } from "@/components/offerte/restore-draft-dialog";
import { KlantSelector } from "@/components/offerte/klant-selector";
import { useKlanten } from "@/hooks/use-klanten";
import { Id } from "../../../../../../convex/_generated/dataModel";
import type {
  Bereikbaarheid,
  Achterstalligheid,
  GrasOnderhoudData,
  BordersOnderhoudData,
  HeggenOnderhoudData,
  BomenOnderhoudData,
  OverigeOnderhoudData,
} from "@/types/offerte";

type OnderhoudScope = "gras" | "borders" | "heggen" | "bomen" | "overig";

const SCOPES = [
  {
    id: "gras" as OnderhoudScope,
    naam: "Gras onderhoud",
    icon: Trees,
    beschrijving: "Maaien, kanten steken, verticuteren",
  },
  {
    id: "borders" as OnderhoudScope,
    naam: "Borders onderhoud",
    icon: Flower2,
    beschrijving: "Wieden, snoei, bodemonderhoud",
    verplicht: ["intensiteit"],
  },
  {
    id: "heggen" as OnderhoudScope,
    naam: "Heggen onderhoud",
    icon: Scissors,
    beschrijving: "Snoei, volumeberekening L×H×B",
    verplicht: ["lengte", "hoogte", "breedte"],
  },
  {
    id: "bomen" as OnderhoudScope,
    naam: "Bomen onderhoud",
    icon: TreeDeciduous,
    beschrijving: "Snoei, hoogteklasse",
  },
  {
    id: "overig" as OnderhoudScope,
    naam: "Overige werkzaamheden",
    icon: Leaf,
    beschrijving: "Bladruimen, terras, onkruid bestrating",
  },
];

// Default values for scope data
const DEFAULT_GRAS_ONDERHOUD: GrasOnderhoudData = {
  grasAanwezig: true,
  grasOppervlakte: 0,
  maaien: true,
  kantenSteken: false,
  verticuteren: false,
  afvoerGras: false,
};

const DEFAULT_BORDERS_ONDERHOUD: BordersOnderhoudData = {
  borderOppervlakte: 0,
  onderhoudsintensiteit: "gemiddeld",
  onkruidVerwijderen: true,
  snoeiInBorders: "geen",
  bodem: "open",
  afvoerGroenafval: false,
};

const DEFAULT_HEGGEN: HeggenOnderhoudData = {
  lengte: 0,
  hoogte: 0,
  breedte: 0,
  snoei: "beide",
  afvoerSnoeisel: false,
};

const DEFAULT_BOMEN: BomenOnderhoudData = {
  aantalBomen: 0,
  snoei: "licht",
  hoogteklasse: "laag",
  afvoer: false,
};

const DEFAULT_OVERIG: OverigeOnderhoudData = {
  bladruimen: false,
  terrasReinigen: false,
  terrasOppervlakte: 0,
  onkruidBestrating: false,
  bestratingOppervlakte: 0,
  afwateringControleren: false,
  aantalAfwateringspunten: 0,
  overigNotities: "",
  overigUren: 0,
};

type OnderhoudScopeData = {
  gras: GrasOnderhoudData;
  borders: BordersOnderhoudData;
  heggen: HeggenOnderhoudData;
  bomen: BomenOnderhoudData;
  overig: OverigeOnderhoudData;
};

// Type for wizard autosave data
interface WizardData {
  selectedTemplateId: string | null;
  selectedKlantId: string | null;
  selectedScopes: OnderhoudScope[];
  bereikbaarheid: Bereikbaarheid;
  achterstalligheid: Achterstalligheid;
  tuinOppervlakte: string;
  klantData: {
    naam: string;
    adres: string;
    postcode: string;
    plaats: string;
    email: string;
    telefoon: string;
  };
  scopeData: OnderhoudScopeData;
}

const INITIAL_WIZARD_DATA: WizardData = {
  selectedTemplateId: null,
  selectedKlantId: null,
  selectedScopes: [],
  bereikbaarheid: "goed",
  achterstalligheid: "laag",
  tuinOppervlakte: "",
  klantData: {
    naam: "",
    adres: "",
    postcode: "",
    plaats: "",
    email: "",
    telefoon: "",
  },
  scopeData: {
    gras: DEFAULT_GRAS_ONDERHOUD,
    borders: DEFAULT_BORDERS_ONDERHOUD,
    heggen: DEFAULT_HEGGEN,
    bomen: DEFAULT_BOMEN,
    overig: DEFAULT_OVERIG,
  },
};

export default function NieuweOnderhoudOffertePage() {
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
    key: "onderhoud",
    type: "onderhoud",
    initialData: INITIAL_WIZARD_DATA,
    initialStep: 0,
  });

  const totalSteps = 4;
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Extract data from wizard state for easier access
  const { selectedTemplateId, selectedKlantId, selectedScopes, bereikbaarheid, achterstalligheid, tuinOppervlakte, klantData, scopeData } = wizardData;

  // Helper functions to update wizard data
  const setSelectedTemplateId = (id: string | null) => {
    setWizardData({ ...wizardData, selectedTemplateId: id });
  };

  const setSelectedKlantId = (id: string | null) => {
    setWizardData({ ...wizardData, selectedKlantId: id });
  };

  const setSelectedScopes = (scopes: OnderhoudScope[] | ((prev: OnderhoudScope[]) => OnderhoudScope[])) => {
    if (typeof scopes === "function") {
      setWizardData({ ...wizardData, selectedScopes: scopes(wizardData.selectedScopes) });
    } else {
      setWizardData({ ...wizardData, selectedScopes: scopes });
    }
  };

  const setBereikbaarheid = (value: Bereikbaarheid) => {
    setWizardData({ ...wizardData, bereikbaarheid: value });
  };

  const setAchterstalligheid = (value: Achterstalligheid) => {
    setWizardData({ ...wizardData, achterstalligheid: value });
  };

  const setTuinOppervlakte = (value: string) => {
    setWizardData({ ...wizardData, tuinOppervlakte: value });
  };

  const setKlantData = (data: typeof klantData) => {
    setWizardData({ ...wizardData, klantData: data });
  };

  const setScopeData = (data: OnderhoudScopeData) => {
    setWizardData({ ...wizardData, scopeData: data });
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
        // Overig is always valid - all fields are optional
        return true;
      default:
        return false;
    }
  };

  const isStep2Valid = selectedScopes.every(isScopeDataValid);

  const handleSubmit = async () => {
    if (!isStep1Valid || !isStep2Valid) return;

    setIsSubmitting(true);
    try {
      const offerteNummer = await getNextNummer();

      // Build scope data object with only selected scopes
      const filteredScopeData: Record<string, unknown> = {
        tuinOppervlakte: tuinOppervlakte ? parseFloat(tuinOppervlakte) : undefined,
      };
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

      // Calculate and save regels
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

      // Clear the draft after successful creation
      clearDraft();

      toast.success(`Offerte ${offerteNummer} aangemaakt`);
      router.push(`/offertes/${offerteId}/bewerken`);
    } catch (error) {
      toast.error("Fout bij aanmaken offerte");
      console.error(error);
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
      const validScopes = templateData.scopes.filter((s): s is OnderhoudScope =>
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
        scopeData: newScopeData as OnderhoudScopeData,
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
                <BreadcrumbPage>Nieuwe Onderhoud Offerte</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  return (
    <>
      {/* Restore Draft Dialog */}
      <RestoreDraftDialog
        open={showRestoreDialog}
        draftAge={draftAge}
        type="onderhoud"
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
              <BreadcrumbPage>Nieuwe Onderhoud Offerte</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Nieuwe Onderhoud Offerte
            </h1>
            <p className="text-muted-foreground">
              Stap {currentStep + 1} van {totalSteps}:{" "}
              {currentStep === 0
                ? "Template Kiezen"
                : currentStep === 1
                  ? "Klantgegevens & Werkzaamheden"
                  : currentStep === 2
                    ? "Details per Werkzaamheid"
                    : "Bevestigen"}
            </p>
          </div>
          <div className="hidden md:flex items-center gap-4">
            {/* Auto-save indicator */}
            {currentStep > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Save className="h-3 w-3" />
                <span>Auto-save aan</span>
              </div>
            )}
            <div className="flex items-center gap-4 w-64">
              <Progress value={((currentStep + 1) / totalSteps) * 100} className="h-2" />
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {Math.round(((currentStep + 1) / totalSteps) * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Step 0: Template Selectie */}
        {currentStep === 0 && (
          <div className="max-w-2xl mx-auto">
            <TemplateSelector
              type="onderhoud"
              onSelect={handleTemplateSelect}
              onSkip={handleTemplateSkip}
            />
          </div>
        )}

        {/* Step 1: Klantgegevens & Scope Selectie */}
        {currentStep === 1 && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              {/* Klantgegevens */}
              <Card>
                <CardHeader>
                  <CardTitle>Klantgegevens</CardTitle>
                  <CardDescription>
                    Selecteer een bestaande klant of voer nieuwe gegevens in
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <KlantSelector
                    value={klantData}
                    onChange={setKlantData}
                    onKlantSelect={(klantId) => setSelectedKlantId(klantId as string | null)}
                  />
                </CardContent>
              </Card>

              {/* Algemene Parameters */}
              <Card>
                <CardHeader>
                  <CardTitle>Algemene Parameters</CardTitle>
                  <CardDescription>
                    Parameters die van toepassing zijn op alle werkzaamheden
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tuinoppervlakte">
                      Totale tuinoppervlakte (m²)
                    </Label>
                    <Input
                      id="tuinoppervlakte"
                      type="number"
                      placeholder="150"
                      value={tuinOppervlakte}
                      onChange={(e) => setTuinOppervlakte(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="bereikbaarheid">Bereikbaarheid</Label>
                      <Select
                        value={bereikbaarheid}
                        onValueChange={(v) =>
                          setBereikbaarheid(v as Bereikbaarheid)
                        }
                      >
                        <SelectTrigger id="bereikbaarheid">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="goed">Goed (factor 1.0)</SelectItem>
                          <SelectItem value="beperkt">
                            Beperkt (factor 1.2)
                          </SelectItem>
                          <SelectItem value="slecht">
                            Slecht (factor 1.5)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="achterstalligheid">Achterstalligheid</Label>
                      <Select
                        value={achterstalligheid}
                        onValueChange={(v) =>
                          setAchterstalligheid(v as Achterstalligheid)
                        }
                      >
                        <SelectTrigger id="achterstalligheid">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="laag">Laag (factor 1.0)</SelectItem>
                          <SelectItem value="gemiddeld">
                            Gemiddeld (factor 1.3)
                          </SelectItem>
                          <SelectItem value="hoog">Hoog (factor 1.6)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Achterstallig onderhoud verhoogt de arbeidsuren met de
                    achterstaligheidsfactor
                  </p>
                </CardContent>
              </Card>

              {/* Scope Selectie */}
              <Card>
                <CardHeader>
                  <CardTitle>Werkzaamheden Selectie</CardTitle>
                  <CardDescription>
                    Selecteer de onderhoudswerkzaamheden. Let op verplichte velden
                    per categorie.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2">
                    {SCOPES.map((scope) => {
                      const isSelected = selectedScopes.includes(scope.id);
                      return (
                        <div
                          key={scope.id}
                          className={`relative flex cursor-pointer items-start space-x-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 ${
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border"
                          }`}
                          onClick={() => toggleScope(scope.id)}
                        >
                          <Checkbox
                            id={scope.id}
                            checked={isSelected}
                            onCheckedChange={() => toggleScope(scope.id)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <scope.icon className="h-4 w-4 text-muted-foreground" />
                              <Label
                                htmlFor={scope.id}
                                className="cursor-pointer font-medium"
                              >
                                {scope.naam}
                              </Label>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {scope.beschrijving}
                            </p>
                            {scope.verplicht && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {scope.verplicht.map((v) => (
                                  <Badge
                                    key={v}
                                    variant="outline"
                                    className="text-xs border-amber-500 text-amber-600"
                                  >
                                    verplicht: {v}
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
                    <Alert className="mt-4" variant="default">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Verplichte velden</AlertTitle>
                      <AlertDescription>
                        <strong>Borders:</strong> Onderhoudsintensiteit is
                        verplicht.
                        <br />
                        <strong>Heggen:</strong> Lengte, hoogte en breedte zijn
                        alle drie verplicht voor de volumeberekening.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar met samenvatting */}
            <div className="space-y-4">
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle>Samenvatting</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Klant
                    </p>
                    <p className="text-sm">
                      {klantData.naam || "—"}
                      {klantData.plaats && `, ${klantData.plaats}`}
                    </p>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Tuinoppervlakte
                    </p>
                    <p className="text-sm">
                      {tuinOppervlakte ? `${tuinOppervlakte} m²` : "—"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Bereikbaarheid
                      </p>
                      <p className="text-sm capitalize">{bereikbaarheid}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Achterstalligheid
                      </p>
                      <p className="text-sm capitalize">{achterstalligheid}</p>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Geselecteerde werkzaamheden ({selectedScopes.length})
                    </p>
                    {selectedScopes.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {selectedScopes.map((scopeId) => {
                          const scope = SCOPES.find((s) => s.id === scopeId);
                          return (
                            <li
                              key={scopeId}
                              className="flex items-center gap-2 text-sm"
                            >
                              {scope?.icon && (
                                <scope.icon className="h-3 w-3 text-muted-foreground" />
                              )}
                              {scope?.naam}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Geen werkzaamheden geselecteerd
                      </p>
                    )}
                  </div>

                  <Separator />

                  <Button
                    className="w-full"
                    disabled={!isStep1Valid}
                    onClick={nextStep}
                  >
                    Volgende: Details
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
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              {selectedScopes.map((scopeId) => {
                switch (scopeId) {
                  case "gras":
                    return (
                      <GrasOnderhoudForm
                        key={scopeId}
                        data={scopeData.gras}
                        onChange={(data) =>
                          setScopeData({ ...scopeData, gras: data })
                        }
                      />
                    );
                  case "borders":
                    return (
                      <BordersOnderhoudForm
                        key={scopeId}
                        data={scopeData.borders}
                        onChange={(data) =>
                          setScopeData({ ...scopeData, borders: data })
                        }
                      />
                    );
                  case "heggen":
                    return (
                      <HeggenForm
                        key={scopeId}
                        data={scopeData.heggen}
                        onChange={(data) =>
                          setScopeData({ ...scopeData, heggen: data })
                        }
                      />
                    );
                  case "bomen":
                    return (
                      <BomenForm
                        key={scopeId}
                        data={scopeData.bomen}
                        onChange={(data) =>
                          setScopeData({ ...scopeData, bomen: data })
                        }
                      />
                    );
                  case "overig":
                    return (
                      <OverigForm
                        key={scopeId}
                        data={scopeData.overig}
                        onChange={(data) =>
                          setScopeData({ ...scopeData, overig: data })
                        }
                      />
                    );
                  default:
                    return null;
                }
              })}
            </div>

            {/* Sidebar met voortgang */}
            <div className="space-y-4">
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle>Voortgang</CardTitle>
                  <CardDescription>
                    Vul alle verplichte velden in per werkzaamheid
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {selectedScopes.map((scopeId) => {
                      const scope = SCOPES.find((s) => s.id === scopeId);
                      const isValid = isScopeDataValid(scopeId);
                      return (
                        <div
                          key={scopeId}
                          className="flex items-center justify-between py-2"
                        >
                          <div className="flex items-center gap-2">
                            {scope?.icon && (
                              <scope.icon className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="text-sm">{scope?.naam}</span>
                          </div>
                          {isValid ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <span className="text-xs text-orange-600">
                              Onvolledig
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

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
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              {/* Klant samenvatting */}
              <Card>
                <CardHeader>
                  <CardTitle>Klantgegevens</CardTitle>
                </CardHeader>
                <CardContent>
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
                        Tuinoppervlakte
                      </dt>
                      <dd className="text-sm">
                        {tuinOppervlakte ? `${tuinOppervlakte} m²` : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">
                        Bereikbaarheid / Achterstalligheid
                      </dt>
                      <dd className="text-sm capitalize">
                        {bereikbaarheid} / {achterstalligheid}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Werkzaamheden samenvatting */}
              <Card>
                <CardHeader>
                  <CardTitle>Geselecteerde Werkzaamheden</CardTitle>
                  <CardDescription>
                    Overzicht van alle onderhoudswerkzaamheden
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedScopes.map((scopeId) => {
                    const scope = SCOPES.find((s) => s.id === scopeId);
                    return (
                      <div
                        key={scopeId}
                        className="rounded-lg border p-4 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          {scope?.icon && (
                            <scope.icon className="h-5 w-5 text-muted-foreground" />
                          )}
                          <span className="font-medium">{scope?.naam}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {scopeId === "gras" && (
                            <>
                              {scopeData.gras.grasAanwezig ? (
                                <>
                                  {scopeData.gras.grasOppervlakte} m²
                                  {scopeData.gras.maaien && ", maaien"}
                                  {scopeData.gras.kantenSteken && ", kanten steken"}
                                  {scopeData.gras.verticuteren && ", verticuteren"}
                                  {scopeData.gras.afvoerGras && ", incl. afvoer"}
                                </>
                              ) : (
                                "Geen gras aanwezig"
                              )}
                            </>
                          )}
                          {scopeId === "borders" && (
                            <>
                              {scopeData.borders.borderOppervlakte} m², intensiteit:{" "}
                              {scopeData.borders.onderhoudsintensiteit}
                              {scopeData.borders.onkruidVerwijderen && ", wieden"}
                              {scopeData.borders.snoeiInBorders !== "geen" &&
                                `, snoei: ${scopeData.borders.snoeiInBorders}`}
                              <br />
                              Bodem: {scopeData.borders.bodem}
                              {scopeData.borders.afvoerGroenafval && ", incl. afvoer"}
                            </>
                          )}
                          {scopeId === "heggen" && (
                            <>
                              {scopeData.heggen.lengte}m × {scopeData.heggen.hoogte}m × {scopeData.heggen.breedte}m
                              {" = "}
                              {(scopeData.heggen.lengte * scopeData.heggen.hoogte * scopeData.heggen.breedte).toFixed(1)} m³
                              <br />
                              Snoei: {scopeData.heggen.snoei}
                              {scopeData.heggen.afvoerSnoeisel && ", incl. afvoer"}
                            </>
                          )}
                          {scopeId === "bomen" && (
                            <>
                              {scopeData.bomen.aantalBomen} bomen, snoei:{" "}
                              {scopeData.bomen.snoei}, hoogte: {scopeData.bomen.hoogteklasse}
                              {scopeData.bomen.afvoer && ", incl. afvoer"}
                            </>
                          )}
                          {scopeId === "overig" && (
                            <>
                              {[
                                scopeData.overig.bladruimen && "Bladruimen",
                                scopeData.overig.terrasReinigen && `Terras (${scopeData.overig.terrasOppervlakte || 0}m²)`,
                                scopeData.overig.onkruidBestrating && `Onkruid bestrating (${scopeData.overig.bestratingOppervlakte || 0}m²)`,
                                scopeData.overig.afwateringControleren && `Afwatering (${scopeData.overig.aantalAfwateringspunten || 0} punten)`,
                                scopeData.overig.overigNotities && "Overige werkzaamheden",
                              ].filter(Boolean).join(", ") || "Geen specifieke werkzaamheden"}
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
            <div className="space-y-4">
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle>Offerte Aanmaken</CardTitle>
                  <CardDescription>
                    Controleer de gegevens en maak de offerte aan
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Werkzaamheden</span>
                      <span className="font-medium">{selectedScopes.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Verplichte velden</span>
                      <span className="font-medium">
                        {selectedScopes.filter((s) =>
                          SCOPES.find((sc) => sc.id === s)?.verplicht
                        ).length}
                      </span>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      disabled={isSubmitting}
                      onClick={handleSubmit}
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
                      Terug naar Details
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
      </div>
    </>
  );
}
