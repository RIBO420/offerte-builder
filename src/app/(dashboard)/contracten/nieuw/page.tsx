"use client";

import { useState, useMemo, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import { m } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Trash2,
  Users,
  Leaf,
  Sun,
  CloudRain,
  Snowflake,
  Euro,
  ScrollText,
} from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import type { Id } from "../../../../../convex/_generated/dataModel";

// Types
interface WerkzaamheidInput {
  id: string;
  omschrijving: string;
  scope?: string;
  seizoen: "voorjaar" | "zomer" | "herfst" | "winter";
  frequentie: number;
  geschatteUrenPerBeurt: number;
}

interface FormData {
  // Step 1: Klant
  klantId: string;
  // Step 2: Locatie + periode
  locatieAdres: string;
  locatiePostcode: string;
  locatiePlaats: string;
  locatieNotities: string;
  startDatum: string;
  eindDatum: string;
  opzegtermijnDagen: number;
  // Step 3: Werkzaamheden
  werkzaamheden: WerkzaamheidInput[];
  // Step 4: Tarief
  tariefPerTermijn: number;
  betalingsfrequentie: "maandelijks" | "per_kwartaal" | "halfjaarlijks" | "jaarlijks";
  indexatiePercentage: number;
  autoVerlenging: boolean;
  verlengingsPeriodeInMaanden: number;
  naam: string;
  notities: string;
}

const STEPS = [
  { title: "Klant", description: "Selecteer een klant" },
  { title: "Locatie & Periode", description: "Contractgegevens invullen" },
  { title: "Werkzaamheden", description: "Per seizoen defini\u00EBren" },
  { title: "Overzicht", description: "Controleer en opslaan" },
];

const seizoenConfig = {
  voorjaar: { label: "Voorjaar", icon: Leaf, months: "Mrt - Mei" },
  zomer: { label: "Zomer", icon: Sun, months: "Jun - Aug" },
  herfst: { label: "Herfst", icon: CloudRain, months: "Sep - Nov" },
  winter: { label: "Winter", icon: Snowflake, months: "Dec - Feb" },
} as const;

const frequentieLabels: Record<string, string> = {
  maandelijks: "Maandelijks",
  per_kwartaal: "Per kwartaal",
  halfjaarlijks: "Halfjaarlijks",
  jaarlijks: "Jaarlijks",
};

function getTermijnenPerJaar(
  freq: "maandelijks" | "per_kwartaal" | "halfjaarlijks" | "jaarlijks"
): number {
  switch (freq) {
    case "maandelijks": return 12;
    case "per_kwartaal": return 4;
    case "halfjaarlijks": return 2;
    case "jaarlijks": return 1;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

// Defaults for today and +1 year
function getDefaultStartDate(): string {
  return new Date().toISOString().split("T")[0];
}

function getDefaultEndDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split("T")[0];
}

export default function NieuwContractPage() {
  return (
    <Suspense fallback={<NieuwContractLoader />}>
      <NieuwContractContent />
    </Suspense>
  );
}

function NieuwContractLoader() {
  return (
    <>
      <PageHeader />
      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </>
  );
}

function NieuwContractContent() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { user } = useCurrentUser();

  const klanten = useQuery(
    api.klanten.list,
    user?._id ? {} : "skip"
  );

  const createContract = useMutation(api.onderhoudscontracten.create);

  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [klantSearch, setKlantSearch] = useState("");

  const [formData, setFormData] = useState<FormData>({
    klantId: "",
    locatieAdres: "",
    locatiePostcode: "",
    locatiePlaats: "",
    locatieNotities: "",
    startDatum: getDefaultStartDate(),
    eindDatum: getDefaultEndDate(),
    opzegtermijnDagen: 30,
    werkzaamheden: [],
    tariefPerTermijn: 0,
    betalingsfrequentie: "per_kwartaal",
    indexatiePercentage: 0,
    autoVerlenging: true,
    verlengingsPeriodeInMaanden: 12,
    naam: "",
    notities: "",
  });

  // Selected klant data
  const selectedKlant = useMemo(() => {
    if (!klanten || !formData.klantId) return null;
    return klanten.find((k) => k._id === formData.klantId) ?? null;
  }, [klanten, formData.klantId]);

  // Filtered klanten by search
  const filteredKlanten = useMemo(() => {
    if (!klanten) return [];
    if (!klantSearch.trim()) return klanten;
    const q = klantSearch.toLowerCase();
    return klanten.filter(
      (k) =>
        k.naam.toLowerCase().includes(q) ||
        k.plaats?.toLowerCase().includes(q) ||
        k.adres?.toLowerCase().includes(q)
    );
  }, [klanten, klantSearch]);

  // Calculate jaarlijks tarief
  const jaarlijksTarief = useMemo(() => {
    return formData.tariefPerTermijn * getTermijnenPerJaar(formData.betalingsfrequentie);
  }, [formData.tariefPerTermijn, formData.betalingsfrequentie]);

  // Total estimated hours
  const totalUren = useMemo(() => {
    return formData.werkzaamheden.reduce(
      (sum, w) => sum + w.frequentie * w.geschatteUrenPerBeurt,
      0
    );
  }, [formData.werkzaamheden]);

  // Validate current step
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 0: // Klant
        return !!formData.klantId;
      case 1: // Locatie + periode
        return (
          formData.locatieAdres.trim() !== "" &&
          formData.locatiePostcode.trim() !== "" &&
          formData.locatiePlaats.trim() !== "" &&
          formData.startDatum !== "" &&
          formData.eindDatum !== "" &&
          formData.naam.trim() !== ""
        );
      case 2: // Werkzaamheden
        return formData.werkzaamheden.length > 0;
      case 3: // Review
        return formData.tariefPerTermijn > 0;
      default:
        return false;
    }
  }, [currentStep, formData]);

  // Handlers
  const handleSelectKlant = useCallback(
    (klantId: string) => {
      setFormData((prev) => {
        const klant = klanten?.find((k) => k._id === klantId);
        return {
          ...prev,
          klantId,
          // Pre-fill locatie from klant
          locatieAdres: klant?.adres ?? prev.locatieAdres,
          locatiePostcode: klant?.postcode ?? prev.locatiePostcode,
          locatiePlaats: klant?.plaats ?? prev.locatiePlaats,
          naam: klant
            ? `Jaaronderhoud ${klant.naam}`
            : prev.naam,
        };
      });
    },
    [klanten]
  );

  const handleAddWerkzaamheid = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      werkzaamheden: [
        ...prev.werkzaamheden,
        {
          id: crypto.randomUUID(),
          omschrijving: "",
          seizoen: "voorjaar",
          frequentie: 1,
          geschatteUrenPerBeurt: 1,
        },
      ],
    }));
  }, []);

  const handleUpdateWerkzaamheid = useCallback(
    (id: string, field: string, value: string | number) => {
      setFormData((prev) => ({
        ...prev,
        werkzaamheden: prev.werkzaamheden.map((w) =>
          w.id === id ? { ...w, [field]: value } : w
        ),
      }));
    },
    []
  );

  const handleRemoveWerkzaamheid = useCallback((id: string) => {
    setFormData((prev) => ({
      ...prev,
      werkzaamheden: prev.werkzaamheden.filter((w) => w.id !== id),
    }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!formData.klantId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const contractId = await createContract({
        klantId: formData.klantId as Id<"klanten">,
        naam: formData.naam,
        locatie: {
          adres: formData.locatieAdres,
          postcode: formData.locatiePostcode,
          plaats: formData.locatiePlaats,
          notities: formData.locatieNotities || undefined,
        },
        startDatum: formData.startDatum,
        eindDatum: formData.eindDatum,
        opzegtermijnDagen: formData.opzegtermijnDagen,
        tariefPerTermijn: formData.tariefPerTermijn,
        betalingsfrequentie: formData.betalingsfrequentie,
        indexatiePercentage: formData.indexatiePercentage || undefined,
        autoVerlenging: formData.autoVerlenging,
        verlengingsPeriodeInMaanden: formData.autoVerlenging
          ? formData.verlengingsPeriodeInMaanden
          : undefined,
        werkzaamheden: formData.werkzaamheden.map((w) => ({
          omschrijving: w.omschrijving,
          scope: w.scope,
          seizoen: w.seizoen,
          frequentie: w.frequentie,
          geschatteUrenPerBeurt: w.geschatteUrenPerBeurt,
        })),
        notities: formData.notities || undefined,
      });

      toast.success("Contract aangemaakt");
      router.push(`/contracten/${contractId}`);
    } catch (error) {
      toast.error("Kon contract niet aanmaken");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, createContract, router, isSubmitting]);

  return (
    <>
      <PageHeader />

      <m.div
        initial={reducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.5, ease: "easeOut" }}
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/contracten")}
            aria-label="Terug naar contracten"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Nieuw contract
            </h1>
            <p className="text-muted-foreground">
              Maak een nieuw onderhoudscontract aan
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {STEPS.map((step, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${
                  index === currentStep
                    ? "bg-primary text-primary-foreground"
                    : index < currentStep
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {index < currentStep ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <span className="font-medium">{index + 1}</span>
                )}
                <span className="hidden sm:inline">{step.title}</span>
              </div>
              {index < STEPS.length - 1 && (
                <div className="h-px w-6 bg-border" />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <Card>
          <CardHeader>
            <CardTitle>{STEPS[currentStep].title}</CardTitle>
            <CardDescription>{STEPS[currentStep].description}</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Step 1: Klant selectie */}
            {currentStep === 0 && (
              <div className="space-y-4">
                <div className="relative">
                  <Users className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Zoek klant op naam, adres of plaats..."
                    className="pl-8"
                    value={klantSearch}
                    onChange={(e) => setKlantSearch(e.target.value)}
                  />
                </div>
                <div className="grid gap-2 max-h-96 overflow-y-auto">
                  {filteredKlanten.map((klant) => (
                    <div
                      key={klant._id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        formData.klantId === klant._id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => handleSelectKlant(klant._id)}
                    >
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{klant.naam}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {klant.adres}, {klant.postcode} {klant.plaats}
                        </p>
                      </div>
                      {formData.klantId === klant._id && (
                        <Check className="h-5 w-5 text-primary shrink-0" />
                      )}
                    </div>
                  ))}
                  {filteredKlanten.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      {klantSearch
                        ? "Geen klanten gevonden"
                        : "Nog geen klanten beschikbaar"}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Locatie + Periode */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="naam">Contractnaam</Label>
                    <Input
                      id="naam"
                      placeholder="bijv. Jaaronderhoud Familie De Vries"
                      value={formData.naam}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, naam: e.target.value }))
                      }
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="adres">Adres werklocatie</Label>
                      <Input
                        id="adres"
                        placeholder="Straat en huisnummer"
                        value={formData.locatieAdres}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            locatieAdres: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postcode">Postcode</Label>
                      <Input
                        id="postcode"
                        placeholder="1234 AB"
                        value={formData.locatiePostcode}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            locatiePostcode: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plaats">Plaats</Label>
                      <Input
                        id="plaats"
                        placeholder="Plaats"
                        value={formData.locatiePlaats}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            locatiePlaats: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="locatieNotities">Toegangsnotities (optioneel)</Label>
                    <Textarea
                      id="locatieNotities"
                      placeholder="bijv. Achterom links, hek code 1234"
                      value={formData.locatieNotities}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          locatieNotities: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="startDatum">Startdatum</Label>
                      <Input
                        id="startDatum"
                        type="date"
                        value={formData.startDatum}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            startDatum: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="eindDatum">Einddatum</Label>
                      <Input
                        id="eindDatum"
                        type="date"
                        value={formData.eindDatum}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            eindDatum: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="opzegtermijn">Opzegtermijn (dagen)</Label>
                      <Input
                        id="opzegtermijn"
                        type="number"
                        min={0}
                        value={formData.opzegtermijnDagen}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            opzegtermijnDagen: parseInt(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Werkzaamheden */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Definieer de werkzaamheden per seizoen.
                    Totaal geschat: <strong>{totalUren}</strong> uur/jaar.
                  </p>
                  <Button size="sm" onClick={handleAddWerkzaamheid}>
                    <Plus className="h-4 w-4 mr-2" />
                    Werkzaamheid
                  </Button>
                </div>

                {formData.werkzaamheden.length === 0 ? (
                  <div className="text-center py-12 border rounded-lg bg-muted/30">
                    <Leaf className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground mb-3">
                      Nog geen werkzaamheden toegevoegd
                    </p>
                    <Button size="sm" onClick={handleAddWerkzaamheid}>
                      <Plus className="h-4 w-4 mr-2" />
                      Eerste werkzaamheid toevoegen
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.werkzaamheden.map((w) => {
                      const seizConf = seizoenConfig[w.seizoen];
                      const SeizIcon = seizConf.icon;
                      return (
                        <Card key={w.id}>
                          <CardContent className="pt-4">
                            <div className="grid gap-3 sm:grid-cols-12 items-end">
                              <div className="sm:col-span-4 space-y-1.5">
                                <Label className="text-xs">Omschrijving</Label>
                                <Input
                                  placeholder="bijv. Gazon maaien"
                                  value={w.omschrijving}
                                  onChange={(e) =>
                                    handleUpdateWerkzaamheid(
                                      w.id,
                                      "omschrijving",
                                      e.target.value
                                    )
                                  }
                                />
                              </div>
                              <div className="sm:col-span-3 space-y-1.5">
                                <Label className="text-xs">Seizoen</Label>
                                <Select
                                  value={w.seizoen}
                                  onValueChange={(val) =>
                                    handleUpdateWerkzaamheid(w.id, "seizoen", val)
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="voorjaar">
                                      Voorjaar
                                    </SelectItem>
                                    <SelectItem value="zomer">Zomer</SelectItem>
                                    <SelectItem value="herfst">
                                      Herfst
                                    </SelectItem>
                                    <SelectItem value="winter">
                                      Winter
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="sm:col-span-2 space-y-1.5">
                                <Label className="text-xs">Frequentie</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  value={w.frequentie}
                                  onChange={(e) =>
                                    handleUpdateWerkzaamheid(
                                      w.id,
                                      "frequentie",
                                      parseInt(e.target.value) || 1
                                    )
                                  }
                                />
                              </div>
                              <div className="sm:col-span-2 space-y-1.5">
                                <Label className="text-xs">Uren/beurt</Label>
                                <Input
                                  type="number"
                                  min={0.5}
                                  step={0.5}
                                  value={w.geschatteUrenPerBeurt}
                                  onChange={(e) =>
                                    handleUpdateWerkzaamheid(
                                      w.id,
                                      "geschatteUrenPerBeurt",
                                      parseFloat(e.target.value) || 1
                                    )
                                  }
                                />
                              </div>
                              <div className="sm:col-span-1 flex items-end justify-end">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9"
                                  onClick={() => handleRemoveWerkzaamheid(w.id)}
                                  aria-label="Werkzaamheid verwijderen"
                                >
                                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                              <SeizIcon className="h-3 w-3" />
                              {seizConf.label} ({seizConf.months}) -{" "}
                              {w.frequentie * w.geschatteUrenPerBeurt} uur
                              totaal
                            </p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Review + Tarief */}
            {currentStep === 3 && (
              <div className="space-y-6">
                {/* Tarief section */}
                <div className="space-y-4">
                  <h3 className="font-medium">Tarieven & Betaling</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="tarief">Tarief per termijn (excl. BTW)</Label>
                      <Input
                        id="tarief"
                        type="number"
                        min={0}
                        step={0.01}
                        value={formData.tariefPerTermijn || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            tariefPerTermijn: parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="frequentie">Betalingsfrequentie</Label>
                      <Select
                        value={formData.betalingsfrequentie}
                        onValueChange={(val) =>
                          setFormData((prev) => ({
                            ...prev,
                            betalingsfrequentie: val as typeof prev.betalingsfrequentie,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="maandelijks">Maandelijks</SelectItem>
                          <SelectItem value="per_kwartaal">Per kwartaal</SelectItem>
                          <SelectItem value="halfjaarlijks">Halfjaarlijks</SelectItem>
                          <SelectItem value="jaarlijks">Jaarlijks</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="indexatie">
                        Jaarlijkse indexatie (%)
                      </Label>
                      <Input
                        id="indexatie"
                        type="number"
                        min={0}
                        step={0.1}
                        value={formData.indexatiePercentage || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            indexatiePercentage:
                              parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Automatische verlenging</Label>
                      <div className="flex items-center gap-3 pt-1">
                        <Switch
                          checked={formData.autoVerlenging}
                          onCheckedChange={(val) =>
                            setFormData((prev) => ({
                              ...prev,
                              autoVerlenging: val,
                            }))
                          }
                        />
                        <span className="text-sm text-muted-foreground">
                          {formData.autoVerlenging ? "Ja" : "Nee"}
                        </span>
                        {formData.autoVerlenging && (
                          <Input
                            type="number"
                            min={1}
                            className="w-24"
                            value={formData.verlengingsPeriodeInMaanden}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                verlengingsPeriodeInMaanden:
                                  parseInt(e.target.value) || 12,
                              }))
                            }
                          />
                        )}
                        {formData.autoVerlenging && (
                          <span className="text-sm text-muted-foreground">
                            mnd
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {formData.tariefPerTermijn > 0 && (
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                          <Euro className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-medium">
                              {formatCurrency(jaarlijksTarief)} / jaar
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatCurrency(formData.tariefPerTermijn)}{" "}
                              {frequentieLabels[formData.betalingsfrequentie]?.toLowerCase()}
                              {" x "}
                              {getTermijnenPerJaar(formData.betalingsfrequentie)}{" "}
                              termijnen
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Notities */}
                <div className="space-y-2">
                  <Label htmlFor="notities">Notities (optioneel)</Label>
                  <Textarea
                    id="notities"
                    placeholder="Eventuele opmerkingen over het contract..."
                    value={formData.notities}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        notities: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* Summary */}
                <div className="space-y-4">
                  <h3 className="font-medium">Samenvatting</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Klant</p>
                        <p className="font-medium">
                          {selectedKlant?.naam ?? "Onbekend"}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">
                          Contractnaam
                        </p>
                        <p className="font-medium">{formData.naam}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">
                          Locatie
                        </p>
                        <p className="font-medium">
                          {formData.locatieAdres}, {formData.locatiePlaats}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">
                          Werkzaamheden
                        </p>
                        <p className="font-medium">
                          {formData.werkzaamheden.length} items - {totalUren}{" "}
                          uur/jaar
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() =>
              currentStep === 0
                ? router.push("/contracten")
                : setCurrentStep((s) => s - 1)
            }
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {currentStep === 0 ? "Annuleren" : "Vorige"}
          </Button>

          {currentStep < STEPS.length - 1 ? (
            <Button
              onClick={() => setCurrentStep((s) => s + 1)}
              disabled={!canProceed}
            >
              Volgende
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!canProceed || isSubmitting}
            >
              {isSubmitting ? (
                "Opslaan..."
              ) : (
                <>
                  <ScrollText className="h-4 w-4 mr-2" />
                  Contract aanmaken
                </>
              )}
            </Button>
          )}
        </div>
      </m.div>
    </>
  );
}
