"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { AreaInput, QuantityInput } from "@/components/ui/number-input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Shield,
  Star,
  TrendingUp,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Zod schema — local to this file
// ---------------------------------------------------------------------------

const tuinTypeValues = ["gazon", "border", "moestuin", "gemengd"] as const;
const pakketValues = ["basis", "premium", "premium-plus"] as const;

const mollenbestrijdingSchema = z.object({
  // Situatie-beoordeling
  aantalMolshopen: z.number().min(0, "Vul een geldig aantal in"),
  tuinOppervlakte: z.number().min(1, "Vul de tuinoppervlakte in (minimaal 1 m²)"),
  tuinType: z.enum(tuinTypeValues, { error: "Selecteer een tuin-type" }),
  ernst: z.number().min(1).max(5),

  // Pakket
  gekozenPakket: z.enum(pakketValues, { error: "Kies een pakket" }),

  // Aanvullende opties
  gazonherstel: z.boolean(),
  gazonherstelOppervlakte: z.number().min(0).optional(),
  preventiefGaas: z.boolean(),
  preventiefGaasOppervlakte: z.number().min(0).optional(),
  terugkeerCheck: z.boolean(),
});

type MollenbestrijdingFormData = z.infer<typeof mollenbestrijdingSchema>;

// ---------------------------------------------------------------------------
// Types for external data contract
// ---------------------------------------------------------------------------

export interface MollenbestrijdingData {
  aantalMolshopen: number;
  tuinOppervlakte: number;
  tuinType: "gazon" | "border" | "moestuin" | "gemengd";
  ernst: number;
  gekozenPakket: "basis" | "premium" | "premium-plus";
  gazonherstel: boolean;
  gazonherstelOppervlakte?: number;
  preventiefGaas: boolean;
  preventiefGaasOppervlakte?: number;
  terugkeerCheck: boolean;
}

interface MollenbestrijdingFormProps {
  data: MollenbestrijdingData;
  onChange: (data: MollenbestrijdingData) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

// ---------------------------------------------------------------------------
// Ernst-label helper
// ---------------------------------------------------------------------------

function ernstLabel(ernst: number): string {
  switch (ernst) {
    case 1:
      return "Enkele molshopen";
    case 2:
      return "Matige aantasting";
    case 3:
      return "Duidelijke aantasting";
    case 4:
      return "Ernstige aantasting";
    case 5:
      return "Hele tuin aangetast";
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Pakket-configuratie
// ---------------------------------------------------------------------------

const PAKKETTEN = [
  {
    id: "basis" as const,
    naam: "Basis Pakket",
    ondertitel: "Eenmalige behandeling",
    prijs: "Vanaf €149",
    bezoeken: "1 bezoek",
    kenmerken: [
      "Plaatsen klemmen/vallen",
      "Controle na 1 week",
    ],
    badge: null as string | null,
    stijl: {
      ring: "ring-muted-foreground/40",
      headerBg: "bg-muted/40",
      badgeBg: "",
      badgeText: "",
      buttonVariant: "outline" as const,
    },
  },
  {
    id: "premium" as const,
    naam: "Premium Pakket",
    ondertitel: "Seizoensbehandeling",
    prijs: "Vanaf €349",
    bezoeken: "3 bezoeken (maandelijks)",
    kenmerken: [
      "Plaatsen klemmen + preventieve maatregelen",
      "Tussentijdse controles",
    ],
    badge: "Meest gekozen",
    stijl: {
      ring: "ring-primary",
      headerBg: "bg-primary/10",
      badgeBg: "bg-primary",
      badgeText: "text-primary-foreground",
      buttonVariant: "default" as const,
    },
  },
  {
    id: "premium-plus" as const,
    naam: "Premium Plus",
    ondertitel: "Jaarrond bescherming",
    prijs: "Vanaf €599",
    bezoeken: "Onbeperkte bezoeken",
    kenmerken: [
      "Proactieve monitoring",
      "Seizoenspreventie",
      "Rapportage per bezoek",
    ],
    badge: "Meest compleet",
    stijl: {
      ring: "ring-amber-500",
      headerBg: "bg-amber-50",
      badgeBg: "bg-amber-500",
      badgeText: "text-white",
      buttonVariant: "outline" as const,
    },
  },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MollenbestrijdingForm({
  data,
  onChange,
  onValidationChange,
}: MollenbestrijdingFormProps) {
  const form = useForm<MollenbestrijdingFormData>({
    resolver: zodResolver(mollenbestrijdingSchema),
    defaultValues: data,
    mode: "onChange",
  });

  const { formState: { errors, isValid }, watch } = form;

  // Watch for changes and sync with parent
  useEffect(() => {
    const subscription = watch((values) => {
      if (values.tuinOppervlakte !== undefined) {
        onChange({
          aantalMolshopen: values.aantalMolshopen ?? 0,
          tuinOppervlakte: values.tuinOppervlakte ?? 0,
          tuinType: values.tuinType ?? "gazon",
          ernst: values.ernst ?? 3,
          gekozenPakket: values.gekozenPakket ?? "premium",
          gazonherstel: values.gazonherstel ?? false,
          gazonherstelOppervlakte: values.gazonherstelOppervlakte,
          preventiefGaas: values.preventiefGaas ?? false,
          preventiefGaasOppervlakte: values.preventiefGaasOppervlakte,
          terugkeerCheck: values.terugkeerCheck ?? false,
        });
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange]);

  // Notify parent of validation state changes
  useEffect(() => {
    if (onValidationChange) {
      const errorMessages: Record<string, string> = {};
      Object.entries(errors).forEach(([key, error]) => {
        if (error && typeof error === "object" && "message" in error && error.message) {
          errorMessages[key] = error.message as string;
        }
      });
      onValidationChange(isValid, errorMessages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(errors), isValid]);

  const watchedValues = watch();
  const geselecteerdPakket = watchedValues.gekozenPakket;

  return (
    <Form {...form}>
      <form>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Mollenbestrijding</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Professionele mollenbestrijding op maat — kies het pakket dat bij u past
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-0">

            {/* ----------------------------------------------------------------
                Sectie 1 — Situatie-beoordeling
            ---------------------------------------------------------------- */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Situatie-beoordeling</h3>

              <div className="grid gap-3 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="aantalMolshopen"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Geschat aantal molshopen</FormLabel>
                      <FormControl>
                        <QuantityInput
                          id="mollen-molshopen"
                          min={0}
                          max={999}
                          value={field.value ?? 0}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          showStepper={false}
                          error={!!errors.aantalMolshopen}
                        />
                      </FormControl>
                      <FormDescription>Benaderd aantal zichtbare molshopen</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tuinOppervlakte"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>
                        Oppervlakte tuin
                        <span className="text-xs text-orange-600 font-normal ml-2">(verplicht)</span>
                      </FormLabel>
                      <FormControl>
                        <AreaInput
                          id="mollen-oppervlakte"
                          min={1}
                          value={field.value ?? 0}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          showStepper={false}
                          error={!!errors.tuinOppervlakte}
                          className={errors.tuinOppervlakte ? "border-orange-300" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="tuinType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>
                      Tuin-type
                      <span className="text-xs text-orange-600 font-normal ml-2">(verplicht)</span>
                    </FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger
                          id="mollen-tuintype"
                          className={errors.tuinType ? "border-orange-300" : ""}
                        >
                          <SelectValue placeholder="Selecteer tuin-type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="gazon">Gazon</SelectItem>
                        <SelectItem value="border">Border</SelectItem>
                        <SelectItem value="moestuin">Moestuin</SelectItem>
                        <SelectItem value="gemengd">Gemengd (meerdere typen)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ernst"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Ernst van de aantasting</FormLabel>
                      <span className="text-xs font-medium text-muted-foreground">
                        {field.value} / 5 — {ernstLabel(field.value)}
                      </span>
                    </div>
                    <FormControl>
                      <Slider
                        id="mollen-ernst"
                        min={1}
                        max={5}
                        step={1}
                        value={[field.value]}
                        onValueChange={(vals) => field.onChange(vals[0])}
                        className="mt-2"
                      />
                    </FormControl>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Enkele molshopen</span>
                      <span>Hele tuin aangetast</span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ----------------------------------------------------------------
                Sectie 2 — Marketing statistieken
            ---------------------------------------------------------------- */}
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-700 shrink-0" />
                <p className="text-sm font-semibold text-green-800">
                  Dit jaar al 127 mollen verplaatst in uw regio!
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-green-700 shrink-0" />
                <p className="text-sm text-green-700">
                  96% van onze klanten is tevreden met de aanpak
                </p>
              </div>
            </div>

            {/* ----------------------------------------------------------------
                Sectie 3 — Disclaimer (altijd zichtbaar)
            ---------------------------------------------------------------- */}
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-yellow-700 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-yellow-800">
                    Let op: geen garantie op mollenbestrijding
                  </p>
                  <p className="text-xs text-yellow-700 leading-relaxed">
                    Op mollenbestrijding wordt geen garantie verleend. Mollen zijn wilde dieren en
                    kunnen terugkeren. Wij doen ons uiterste best maar kunnen geen molvrije tuin
                    garanderen.
                  </p>
                </div>
              </div>
            </div>

            {/* ----------------------------------------------------------------
                Sectie 4 — Pakket-selectie
            ---------------------------------------------------------------- */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Kies uw pakket</h3>

              <FormField
                control={form.control}
                name="gekozenPakket"
                render={({ field }) => (
                  <FormItem>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {PAKKETTEN.map((pakket) => {
                        const isSelected = field.value === pakket.id;
                        const isPremium = pakket.id === "premium";
                        const isPremiumPlus = pakket.id === "premium-plus";

                        return (
                          <button
                            key={pakket.id}
                            type="button"
                            onClick={() => field.onChange(pakket.id)}
                            className={[
                              "relative flex flex-col rounded-xl border-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                              isSelected
                                ? `ring-2 ${pakket.stijl.ring} border-transparent shadow-md`
                                : "border-border hover:border-muted-foreground/40 hover:shadow-sm",
                              isPremiumPlus && isSelected
                                ? "border-transparent"
                                : "",
                            ].join(" ")}
                            aria-pressed={isSelected}
                          >
                            {/* Pakket header */}
                            <div
                              className={[
                                "rounded-t-[10px] px-4 py-3 space-y-1",
                                isSelected && isPremium
                                  ? "bg-primary/10"
                                  : isSelected && isPremiumPlus
                                    ? "bg-amber-50"
                                    : isSelected
                                      ? "bg-muted/50"
                                      : "bg-muted/30",
                              ].join(" ")}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-bold text-foreground leading-tight">
                                  {pakket.naam}
                                </p>
                                {pakket.badge && (
                                  <Badge
                                    className={[
                                      "text-[10px] px-1.5 py-0.5 shrink-0",
                                      isPremium
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-amber-500 text-white",
                                    ].join(" ")}
                                  >
                                    {pakket.badge}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{pakket.ondertitel}</p>
                            </div>

                            {/* Pakket body */}
                            <div className="flex flex-col flex-1 px-4 py-3 space-y-3">
                              {/* Prijs */}
                              <p
                                className={[
                                  "text-xl font-bold",
                                  isPremiumPlus
                                    ? "text-amber-600"
                                    : isPremium
                                      ? "text-primary"
                                      : "text-foreground",
                                ].join(" ")}
                              >
                                {pakket.prijs}
                              </p>

                              {/* Bezoeken */}
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Shield className="h-3.5 w-3.5 shrink-0" />
                                <span>{pakket.bezoeken}</span>
                              </div>

                              {/* Kenmerken */}
                              <ul className="space-y-1.5 flex-1">
                                {pakket.kenmerken.map((kenmerk) => (
                                  <li key={kenmerk} className="flex items-start gap-1.5">
                                    <CheckCircle2
                                      className={[
                                        "h-3.5 w-3.5 shrink-0 mt-0.5",
                                        isPremiumPlus
                                          ? "text-amber-500"
                                          : isPremium
                                            ? "text-primary"
                                            : "text-muted-foreground",
                                      ].join(" ")}
                                    />
                                    <span className="text-xs text-muted-foreground leading-tight">
                                      {kenmerk}
                                    </span>
                                  </li>
                                ))}
                              </ul>

                              {/* Kies-knop */}
                              <Button
                                type="button"
                                variant={isSelected ? pakket.stijl.buttonVariant : "outline"}
                                size="sm"
                                className={[
                                  "w-full mt-2 pointer-events-none",
                                  isSelected && isPremium
                                    ? "bg-primary text-primary-foreground"
                                    : isSelected && isPremiumPlus
                                      ? "border-amber-500 text-amber-700"
                                      : "",
                                ].join(" ")}
                                tabIndex={-1}
                                aria-hidden="true"
                              >
                                {isSelected
                                  ? "Geselecteerd"
                                  : pakket.id === "basis"
                                    ? "Kies Basis"
                                    : pakket.id === "premium"
                                      ? "Kies Premium"
                                      : "Kies Premium Plus"}
                              </Button>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ----------------------------------------------------------------
                Sectie 5 — Aanvullende opties
            ---------------------------------------------------------------- */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Aanvullende opties</h3>

              {/* Gazonherstel */}
              <FormField
                control={form.control}
                name="gazonherstel"
                render={({ field }) => (
                  <FormItem className="flex flex-col rounded-lg border p-3 gap-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <FormLabel className="text-sm font-normal cursor-pointer">
                          Gazonherstel na behandeling
                        </FormLabel>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Opplekken herstellen na mollenbestrijding
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </div>
                    {field.value && (
                      <div className="mt-3 pt-3 border-t">
                        <FormField
                          control={form.control}
                          name="gazonherstelOppervlakte"
                          render={({ field: subField }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Geschatte oppervlakte herstel</FormLabel>
                              <FormControl>
                                <AreaInput
                                  id="mollen-gazonherstel-opp"
                                  min={0}
                                  value={subField.value ?? 0}
                                  onChange={subField.onChange}
                                  onBlur={subField.onBlur}
                                  showStepper={false}
                                  error={!!errors.gazonherstelOppervlakte}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </FormItem>
                )}
              />

              {/* Preventief gaas */}
              <FormField
                control={form.control}
                name="preventiefGaas"
                render={({ field }) => (
                  <FormItem className="flex flex-col rounded-lg border p-3 gap-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <FormLabel className="text-sm font-normal cursor-pointer">
                          Preventief gaas plaatsen
                        </FormLabel>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Mollenwerend gaas onder gazon aanbrengen
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </div>
                    {field.value && (
                      <div className="mt-3 pt-3 border-t">
                        <FormField
                          control={form.control}
                          name="preventiefGaasOppervlakte"
                          render={({ field: subField }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Oppervlakte gaas</FormLabel>
                              <FormControl>
                                <AreaInput
                                  id="mollen-gaas-opp"
                                  min={0}
                                  value={subField.value ?? 0}
                                  onChange={subField.onChange}
                                  onBlur={subField.onBlur}
                                  showStepper={false}
                                  error={!!errors.preventiefGaasOppervlakte}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </FormItem>
                )}
              />

              {/* Terugkeer-check */}
              <FormField
                control={form.control}
                name="terugkeerCheck"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel className="text-sm font-normal cursor-pointer">
                        Terugkeer-check
                      </FormLabel>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Extra controlebezoek na 3 maanden
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* ----------------------------------------------------------------
                Samenvatting-indicatie
            ---------------------------------------------------------------- */}
            {geselecteerdPakket && (
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                <p>
                  <span className="font-medium text-foreground">Geselecteerd: </span>
                  {PAKKETTEN.find((p) => p.id === geselecteerdPakket)?.naam}
                  {" — "}
                  {PAKKETTEN.find((p) => p.id === geselecteerdPakket)?.prijs}
                </p>
                {(watchedValues.gazonherstel || watchedValues.preventiefGaas || watchedValues.terugkeerCheck) && (
                  <p>
                    <span className="font-medium text-foreground">Extra opties: </span>
                    {[
                      watchedValues.gazonherstel && "Gazonherstel",
                      watchedValues.preventiefGaas && "Preventief gaas",
                      watchedValues.terugkeerCheck && "Terugkeer-check",
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
