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
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { useOffertes } from "@/hooks/use-offertes";
import { useInstellingen } from "@/hooks/use-instellingen";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useOfferteCalculation } from "@/hooks/use-offerte-calculation";
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
import { Id } from "../../../../../../convex/_generated/dataModel";
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
  },
  {
    id: "bestrating" as AanlegScope,
    naam: "Bestrating",
    icon: Layers,
    beschrijving: "Tegels/klinkers/natuursteen + onderbouw",
    verplicht: ["onderbouw"],
  },
  {
    id: "borders" as AanlegScope,
    naam: "Borders & Beplanting",
    icon: Flower2,
    beschrijving: "Grondbewerking, planten, afwerking",
  },
  {
    id: "gras" as AanlegScope,
    naam: "Gras / Gazon",
    icon: Trees,
    beschrijving: "Zaaien of graszoden, ondergrondbewerking",
  },
  {
    id: "houtwerk" as AanlegScope,
    naam: "Houtwerk",
    icon: Hammer,
    beschrijving: "Schutting/vlonder/pergola + fundering",
    verplicht: ["fundering"],
  },
  {
    id: "water_elektra" as AanlegScope,
    naam: "Water / Elektra",
    icon: Zap,
    beschrijving: "Verlichting, sleuven, bekabeling",
    verplicht: ["sleuven", "herstel"],
  },
  {
    id: "specials" as AanlegScope,
    naam: "Specials",
    icon: Sparkles,
    beschrijving: "Jacuzzi, sauna, prefab elementen",
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

export default function NieuweAanlegOffertePage() {
  const router = useRouter();
  const { isLoading: isUserLoading } = useCurrentUser();
  const { create, updateRegels } = useOffertes();
  const { getNextNummer, isLoading: isSettingsLoading, instellingen } = useInstellingen();
  const { calculate, isLoading: isCalcLoading } = useOfferteCalculation();

  // Wizard state (start at step 0 for template selection)
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 4;
  const [selectedTemplateId, setSelectedTemplateId] = useState<Id<"standaardtuinen"> | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<AanlegScope[]>([]);
  const [bereikbaarheid, setBereikbaarheid] = useState<Bereikbaarheid>("goed");
  const [klantData, setKlantData] = useState({
    naam: "",
    adres: "",
    postcode: "",
    plaats: "",
    email: "",
    telefoon: "",
  });

  // Scope-specific data
  const [scopeData, setScopeData] = useState<ScopeData>({
    grondwerk: DEFAULT_GRONDWERK,
    bestrating: DEFAULT_BESTRATING,
    borders: DEFAULT_BORDERS,
    gras: DEFAULT_GRAS,
    houtwerk: DEFAULT_HOUTWERK,
    water_elektra: DEFAULT_WATER_ELEKTRA,
    specials: DEFAULT_SPECIALS,
  });

  const isLoading = isUserLoading || isSettingsLoading;

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
    setSelectedTemplateId(templateId);

    if (templateId && templateData) {
      // Pre-fill scopes from template
      const validScopes = templateData.scopes.filter((s): s is AanlegScope =>
        SCOPES.some((scope) => scope.id === s)
      );
      setSelectedScopes(validScopes);

      // Pre-fill scope data from template
      const newScopeData = { ...scopeData };
      if (templateData.scopeData) {
        Object.entries(templateData.scopeData).forEach(([key, value]) => {
          if (key in newScopeData && value) {
            (newScopeData as Record<string, unknown>)[key] = value;
          }
        });
      }
      setScopeData(newScopeData as ScopeData);
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
                <BreadcrumbPage>Nieuwe Aanleg Offerte</BreadcrumbPage>
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

      <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Nieuwe Aanleg Offerte
            </h1>
            <p className="text-muted-foreground">
              Stap {currentStep + 1} van {totalSteps}:{" "}
              {currentStep === 0
                ? "Template Kiezen"
                : currentStep === 1
                  ? "Klantgegevens & Scopes"
                  : currentStep === 2
                    ? "Scope Details"
                    : "Bevestigen"}
            </p>
          </div>
          <div className="hidden md:flex items-center gap-4 w-64">
            <Progress value={((currentStep + 1) / totalSteps) * 100} className="h-2" />
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {Math.round(((currentStep + 1) / totalSteps) * 100)}%
            </span>
          </div>
        </div>

        {/* Step 0: Template Selectie */}
        {currentStep === 0 && (
          <div className="max-w-2xl mx-auto">
            <TemplateSelector
              type="aanleg"
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
                    Voer de gegevens van de klant in
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="naam">Naam *</Label>
                      <Input
                        id="naam"
                        placeholder="Jan Jansen"
                        value={klantData.naam}
                        onChange={(e) =>
                          setKlantData({ ...klantData, naam: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telefoon">Telefoon</Label>
                      <Input
                        id="telefoon"
                        placeholder="06-12345678"
                        value={klantData.telefoon}
                        onChange={(e) =>
                          setKlantData({ ...klantData, telefoon: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adres">Adres *</Label>
                    <Input
                      id="adres"
                      placeholder="Hoofdstraat 1"
                      value={klantData.adres}
                      onChange={(e) =>
                        setKlantData({ ...klantData, adres: e.target.value })
                      }
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="postcode">Postcode *</Label>
                      <Input
                        id="postcode"
                        placeholder="1234 AB"
                        value={klantData.postcode}
                        onChange={(e) =>
                          setKlantData({ ...klantData, postcode: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="plaats">Plaats *</Label>
                      <Input
                        id="plaats"
                        placeholder="Amsterdam"
                        value={klantData.plaats}
                        onChange={(e) =>
                          setKlantData({ ...klantData, plaats: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="jan@voorbeeld.nl"
                      value={klantData.email}
                      onChange={(e) =>
                        setKlantData({ ...klantData, email: e.target.value })
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Algemene Parameters */}
              <Card>
                <CardHeader>
                  <CardTitle>Algemene Parameters</CardTitle>
                  <CardDescription>
                    Parameters die van toepassing zijn op alle scopes
                  </CardDescription>
                </CardHeader>
                <CardContent>
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
                <CardHeader>
                  <CardTitle>Scope Selectie</CardTitle>
                  <CardDescription>
                    Selecteer de werkzaamheden die onderdeel zijn van het project.
                    Verplichte onderdelen worden automatisch meegenomen.
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
                                    variant="secondary"
                                    className="text-xs"
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
                      Bereikbaarheid
                    </p>
                    <p className="text-sm capitalize">{bereikbaarheid}</p>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Geselecteerde scopes ({selectedScopes.length})
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
                        Geen scopes geselecteerd
                      </p>
                    )}
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
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
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
                  <CardTitle>Scope Voortgang</CardTitle>
                  <CardDescription>
                    Vul alle verplichte velden in per scope
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
                <CardHeader>
                  <CardTitle>Geselecteerde Scopes</CardTitle>
                  <CardDescription>
                    Overzicht van alle werkzaamheden
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
                      <span className="text-muted-foreground">Scopes</span>
                      <span className="font-medium">{selectedScopes.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Verplichte onderdelen</span>
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
      </div>
    </>
  );
}
