"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AreaInput } from "@/components/ui/number-input";
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
import { Sprout, Info } from "lucide-react";

// ---------------------------------------------------------------------------
// Zod schema — defined locally in this file
// ---------------------------------------------------------------------------

const onkruidTypeSchema = z.enum(["breed", "smal", "klaver"]);

const gazonanalyseSchema = z.object({
  // 1. Gazonbeoordeling
  conditieScore: z.number().int().min(1).max(5),

  // 2. Problemen checklist
  problemen: z.object({
    mos: z.boolean(),
    mosPercentage: z.number().min(0).max(100),
    kalePlekken: z.boolean(),
    kalePlekkenOppervlakte: z.number().min(0),
    onkruid: z.boolean(),
    onkruidType: onkruidTypeSchema.optional(),
    verdroging: z.boolean(),
    wateroverlast: z.boolean(),
    schaduw: z.boolean(),
    schaduwPercentage: z.number().min(0).max(100),
    verzuring: z.boolean(),
    muizenMollen: z.boolean(),
  }),

  // 3. Gazon specificaties
  specificaties: z.object({
    oppervlakte: z
      .number({ error: "Voer een getal in" })
      .min(0, "Oppervlakte mag niet negatief zijn"),
    grastype: z.enum(["onbekend", "sport", "sier", "schaduw", "mix"]),
    bodemtype: z.enum(["zand", "klei", "veen", "leem"]),
  }),

  // 4. Herstelpad
  herstelActies: z.array(z.string()),

  // 5. Aanvullende aanbevelingen
  aanbevelingen: z.object({
    drainageAanleggen: z.boolean(),
    bekalken: z.boolean(),
    robotmaaierAdvies: z.boolean(),
    beregeningsadvies: z.boolean(),
  }),
});

type GazonanalyseFormData = z.infer<typeof gazonanalyseSchema>;

// ---------------------------------------------------------------------------
// Public data type — exported so parent components can import it if needed
// ---------------------------------------------------------------------------

export type GazonanalyseData = GazonanalyseFormData;

// ---------------------------------------------------------------------------
// Default value helper
// ---------------------------------------------------------------------------

export const defaultGazonanalyseData: GazonanalyseData = {
  conditieScore: 3,
  problemen: {
    mos: false,
    mosPercentage: 0,
    kalePlekken: false,
    kalePlekkenOppervlakte: 0,
    onkruid: false,
    onkruidType: undefined,
    verdroging: false,
    wateroverlast: false,
    schaduw: false,
    schaduwPercentage: 0,
    verzuring: false,
    muizenMollen: false,
  },
  specificaties: {
    oppervlakte: 0,
    grastype: "onbekend",
    bodemtype: "zand",
  },
  herstelActies: [],
  aanbevelingen: {
    drainageAanleggen: false,
    bekalken: false,
    robotmaaierAdvies: false,
    beregeningsadvies: false,
  },
};

// ---------------------------------------------------------------------------
// Score helpers
// ---------------------------------------------------------------------------

interface ScoreInfo {
  label: string;
  emoji: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

const SCORE_INFO: Record<number, ScoreInfo> = {
  1: {
    label: "Zeer slecht — volledig opnieuw aanleggen",
    emoji: "💀",
    colorClass: "text-red-600",
    bgClass: "bg-red-50",
    borderClass: "border-red-200",
  },
  2: {
    label: "Slecht — veel kale plekken, mos",
    emoji: "😟",
    colorClass: "text-orange-600",
    bgClass: "bg-orange-50",
    borderClass: "border-orange-200",
  },
  3: {
    label: "Matig — verbetering mogelijk",
    emoji: "😐",
    colorClass: "text-yellow-600",
    bgClass: "bg-yellow-50",
    borderClass: "border-yellow-200",
  },
  4: {
    label: "Goed — licht onderhoud nodig",
    emoji: "😊",
    colorClass: "text-lime-600",
    bgClass: "bg-lime-50",
    borderClass: "border-lime-200",
  },
  5: {
    label: "Uitstekend — alleen bijhouden",
    emoji: "🌿",
    colorClass: "text-green-600",
    bgClass: "bg-green-50",
    borderClass: "border-green-200",
  },
};

// Score-gradient track: inline style for a red→green gradient fill
function ScoreColorBar({ score }: { score: number }) {
  const percentage = ((score - 1) / 4) * 100;
  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gradient-to-r from-red-400 via-yellow-400 to-green-500">
      <div
        className="h-full rounded-full bg-transparent outline outline-2 outline-white"
        style={{ width: `${percentage}%`, minWidth: "0.5rem" }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Herstelpad data
// ---------------------------------------------------------------------------

interface HerstelOptie {
  id: string;
  label: string;
  omschrijving: string;
  kostenIndicatie?: string;
}

const HERSTEL_OPTIES_SCORE_1_2: HerstelOptie[] = [
  {
    id: "graszoden",
    label: "Nieuwe grasmat (graszoden)",
    omschrijving: "Bestaand gazon volledig verwijderen en nieuwe graszoden leggen.",
    kostenIndicatie: "€ 8–14 / m²",
  },
  {
    id: "opnieuw_inzaaien_vol",
    label: "Opnieuw inzaaien",
    omschrijving: "Bodem frezen, egaliseren en volledig opnieuw inzaaien.",
    kostenIndicatie: "€ 4–8 / m²",
  },
];

const HERSTEL_OPTIES_SCORE_3: HerstelOptie[] = [
  {
    id: "verticuteren_doorzaaien",
    label: "Verticuteren + doorzaaien",
    omschrijving: "Filtvilt en mos verwijderen, daarna doorzaaien op kale plekken.",
    kostenIndicatie: "€ 3–6 / m²",
  },
  {
    id: "plaggen_inzaaien",
    label: "Plaggen + opnieuw inzaaien",
    omschrijving: "Toplaag verwijderen (plaggen), bodem verbeteren en nieuw zaaien.",
    kostenIndicatie: "€ 5–9 / m²",
  },
];

const HERSTEL_OPTIES_SCORE_4_5: HerstelOptie[] = [
  {
    id: "verticuteren",
    label: "Verticuteren",
    omschrijving: "Filtvilt doorsnijden voor betere doorluchting en wateropname.",
    kostenIndicatie: "€ 1–3 / m²",
  },
  {
    id: "bemesting",
    label: "Bemesting",
    omschrijving: "Seizoensgebonden bemesting voor gezonde grasgroei.",
    kostenIndicatie: "€ 0,50–1,50 / m²",
  },
  {
    id: "bijzaaien",
    label: "Bijzaaien kale plekken",
    omschrijving: "Kleine kale plekken aanpakken met doorzaai.",
    kostenIndicatie: "€ 2–4 / m²",
  },
];

function getHerstelOpties(score: number): { titel: string; omschrijving: string; opties: HerstelOptie[] } {
  if (score <= 2) {
    return {
      titel: "Aanbevolen: Volledig vernieuwen",
      omschrijving: "Het gazon is te ver heen voor herstel. Vernieuwen geeft het beste resultaat.",
      opties: HERSTEL_OPTIES_SCORE_1_2,
    };
  }
  if (score === 3) {
    return {
      titel: "Aanbevolen: Intensief herstel",
      omschrijving: "Met intensief herstel kan dit gazon sterk verbeteren.",
      opties: HERSTEL_OPTIES_SCORE_3,
    };
  }
  return {
    titel: "Aanbevolen: Regulier onderhoud",
    omschrijving: "Het gazon is in goede staat. Regulier onderhoud houdt het op niveau.",
    opties: HERSTEL_OPTIES_SCORE_4_5,
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GazonanalyseFormProps {
  data: GazonanalyseData;
  onChange: (data: GazonanalyseData) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GazonanalyseForm({
  data,
  onChange,
  onValidationChange,
}: GazonanalyseFormProps) {
  const form = useForm<GazonanalyseFormData>({
    resolver: zodResolver(gazonanalyseSchema),
    defaultValues: data,
    mode: "onChange",
  });

  const {
    formState: { errors, isValid },
    watch,
    setValue,
  } = form;

  // Sync with parent on any change
  useEffect(() => {
    const subscription = watch((values) => {
      // values is a deep partial — cast carefully
      const v = values as GazonanalyseFormData;
      onChange(v);
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange]);

  // Notify parent of validation state
  useEffect(() => {
    if (onValidationChange) {
      const errorMessages: Record<string, string> = {};
      // Flatten nested errors
      const flattenErrors = (
        obj: Record<string, unknown>,
        prefix = ""
      ) => {
        Object.entries(obj).forEach(([key, val]) => {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          if (val && typeof val === "object" && "message" in val) {
            errorMessages[fullKey] = (val as { message: string }).message;
          } else if (val && typeof val === "object") {
            flattenErrors(val as Record<string, unknown>, fullKey);
          }
        });
      };
      flattenErrors(errors as Record<string, unknown>);
      onValidationChange(isValid, errorMessages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(errors), isValid]);

  const watchedValues = watch();
  const score = watchedValues.conditieScore ?? 3;
  const scoreInfo = SCORE_INFO[score] ?? SCORE_INFO[3];
  const herstel = getHerstelOpties(score);

  const problemen = watchedValues.problemen ?? defaultGazonanalyseData.problemen;
  const aanbevelingen =
    watchedValues.aanbevelingen ?? defaultGazonanalyseData.aanbevelingen;

  // Auto-suggest toggles based on problemen
  const toonDrainage = problemen.wateroverlast;
  const toonBekalken = problemen.verzuring;
  const toonBeregeningsadvies = problemen.verdroging;

  // Toggle a herstel-actie in the array
  const toggleHerstelActie = (id: string, checked: boolean) => {
    const current = watchedValues.herstelActies ?? [];
    if (checked) {
      setValue("herstelActies", [...current, id], { shouldValidate: true });
    } else {
      setValue(
        "herstelActies",
        current.filter((a) => a !== id),
        { shouldValidate: true }
      );
    }
  };

  return (
    <Form {...form}>
      <form className="space-y-4">
        {/* ------------------------------------------------------------------ */}
        {/* 1. GAZONBEOORDELING                                                  */}
        {/* ------------------------------------------------------------------ */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sprout className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Gazonbeoordeling</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Beoordeel de huidige conditie van het gazon (1–5)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <FormField
              control={form.control}
              name="conditieScore"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between mb-1">
                    <FormLabel className="text-sm font-medium">
                      Algehele conditie
                    </FormLabel>
                    <div className="flex items-center gap-2">
                      <span className="text-xl" aria-hidden>
                        {scoreInfo.emoji}
                      </span>
                      <Badge
                        variant="outline"
                        className={`${scoreInfo.colorClass} border-current font-bold`}
                      >
                        {field.value} / 5
                      </Badge>
                    </div>
                  </div>

                  {/* Score indicator */}
                  <div
                    className={`rounded-lg border p-3 ${scoreInfo.bgClass} ${scoreInfo.borderClass}`}
                  >
                    <p className={`text-sm font-medium ${scoreInfo.colorClass}`}>
                      {scoreInfo.label}
                    </p>
                    <ScoreColorBar score={field.value} />
                  </div>

                  {/* Slider */}
                  <FormControl>
                    <div className="px-1 pt-3">
                      <Slider
                        min={1}
                        max={5}
                        step={1}
                        value={[field.value]}
                        onValueChange={(vals) => field.onChange(vals[0])}
                        aria-label="Conditiescore gazon"
                      />
                      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                        <span>1 — Zeer slecht</span>
                        <span>5 — Uitstekend</span>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ------------------------------------------------------------------ */}
        {/* 2. PROBLEMEN CHECKLIST                                               */}
        {/* ------------------------------------------------------------------ */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Problemen</CardTitle>
            <CardDescription className="text-xs">
              Selecteer aanwezige problemen — vul details in waar van toepassing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {/* Mos */}
            <div className="space-y-2 rounded-lg border p-3">
              <FormField
                control={form.control}
                name="problemen.mos"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        id="probleem-mos"
                      />
                    </FormControl>
                    <FormLabel htmlFor="probleem-mos" className="text-sm font-medium cursor-pointer">
                      Mos
                    </FormLabel>
                  </FormItem>
                )}
              />
              {problemen.mos && (
                <FormField
                  control={form.control}
                  name="problemen.mosPercentage"
                  render={({ field }) => (
                    <FormItem className="pl-7">
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-xs text-muted-foreground">
                          Geschat mospercentage
                        </FormLabel>
                        <Badge variant="secondary" className="text-xs">
                          {field.value}%
                        </Badge>
                      </div>
                      <FormControl>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[field.value]}
                          onValueChange={(vals) => field.onChange(vals[0])}
                          aria-label="Mospercentage"
                        />
                      </FormControl>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0%</span>
                        <span>100%</span>
                      </div>
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Kale plekken */}
            <div className="space-y-2 rounded-lg border p-3">
              <FormField
                control={form.control}
                name="problemen.kalePlekken"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        id="probleem-kale-plekken"
                      />
                    </FormControl>
                    <FormLabel htmlFor="probleem-kale-plekken" className="text-sm font-medium cursor-pointer">
                      Kale plekken
                    </FormLabel>
                  </FormItem>
                )}
              />
              {problemen.kalePlekken && (
                <FormField
                  control={form.control}
                  name="problemen.kalePlekkenOppervlakte"
                  render={({ field }) => (
                    <FormItem className="pl-7">
                      <FormLabel className="text-xs text-muted-foreground">
                        Oppervlakte kale plekken
                      </FormLabel>
                      <FormControl>
                        <AreaInput
                          id="kale-plekken-opp"
                          min={0}
                          value={field.value || 0}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          showStepper={false}
                          error={!!errors.problemen?.kalePlekkenOppervlakte}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Onkruid */}
            <div className="space-y-2 rounded-lg border p-3">
              <FormField
                control={form.control}
                name="problemen.onkruid"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        id="probleem-onkruid"
                      />
                    </FormControl>
                    <FormLabel htmlFor="probleem-onkruid" className="text-sm font-medium cursor-pointer">
                      Onkruid
                    </FormLabel>
                  </FormItem>
                )}
              />
              {problemen.onkruid && (
                <FormField
                  control={form.control}
                  name="problemen.onkruidType"
                  render={({ field }) => (
                    <FormItem className="pl-7">
                      <FormLabel className="text-xs text-muted-foreground">
                        Type onkruid
                      </FormLabel>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger id="onkruid-type" className="h-9 text-sm">
                            <SelectValue placeholder="Selecteer type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="breed">Breedbladig (paardenbloem, weegbree)</SelectItem>
                          <SelectItem value="smal">Smalbladig (raaigras, beemdgras)</SelectItem>
                          <SelectItem value="klaver">Klaver</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Grid van toggle-problemen */}
            <div className="grid gap-2 sm:grid-cols-2">
              {/* Verdroging */}
              <FormField
                control={form.control}
                name="problemen.verdroging"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                    <FormLabel className="text-sm font-normal cursor-pointer">
                      Verdroging
                    </FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Wateroverlast */}
              <FormField
                control={form.control}
                name="problemen.wateroverlast"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                    <FormLabel className="text-sm font-normal cursor-pointer">
                      Wateroverlast
                    </FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Verzuring */}
              <FormField
                control={form.control}
                name="problemen.verzuring"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                    <FormLabel className="text-sm font-normal cursor-pointer">
                      Verzuring
                    </FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Muizen/mollen */}
              <FormField
                control={form.control}
                name="problemen.muizenMollen"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                    <FormLabel className="text-sm font-normal cursor-pointer">
                      Muizen / mollen
                    </FormLabel>
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

            {/* Schaduw — apart vanwege percentage slider */}
            <div className="space-y-2 rounded-lg border p-3">
              <FormField
                control={form.control}
                name="problemen.schaduw"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel className="text-sm font-medium cursor-pointer">
                      Schaduw
                    </FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              {problemen.schaduw && (
                <FormField
                  control={form.control}
                  name="problemen.schaduwPercentage"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-xs text-muted-foreground">
                          Percentage schaduw over gazon
                        </FormLabel>
                        <Badge variant="secondary" className="text-xs">
                          {field.value}%
                        </Badge>
                      </div>
                      <FormControl>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[field.value]}
                          onValueChange={(vals) => field.onChange(vals[0])}
                          aria-label="Schaduwpercentage"
                        />
                      </FormControl>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0%</span>
                        <span>100%</span>
                      </div>
                    </FormItem>
                  )}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* ------------------------------------------------------------------ */}
        {/* 3. GAZON SPECIFICATIES                                               */}
        {/* ------------------------------------------------------------------ */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Gazon specificaties</CardTitle>
            <CardDescription className="text-xs">
              Afmetingen, grastype en bodemtype
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <FormField
              control={form.control}
              name="specificaties.oppervlakte"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Oppervlakte gazon</FormLabel>
                  <FormControl>
                    <AreaInput
                      id="gazon-oppervlakte"
                      min={0}
                      value={field.value || 0}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      showStepper={false}
                      error={!!errors.specificaties?.oppervlakte}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="specificaties.grastype"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Huidig grastype</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger id="grastype">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="onbekend">Onbekend</SelectItem>
                        <SelectItem value="sport">Sportgras</SelectItem>
                        <SelectItem value="sier">Siergazon</SelectItem>
                        <SelectItem value="schaduw">Schaduwgras</SelectItem>
                        <SelectItem value="mix">Mix</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="specificaties.bodemtype"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bodemtype</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger id="bodemtype">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="zand">Zand</SelectItem>
                        <SelectItem value="klei">Klei</SelectItem>
                        <SelectItem value="veen">Veen</SelectItem>
                        <SelectItem value="leem">Leem</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs">
                      {watchedValues.specificaties?.bodemtype === "klei" &&
                        "Kleigrond: verdichting en wateroverlast zijn aandachtspunten."}
                      {watchedValues.specificaties?.bodemtype === "veen" &&
                        "Veengrond: verzakking en verzuring treden sneller op."}
                      {watchedValues.specificaties?.bodemtype === "zand" &&
                        "Zandgrond: droogte-gevoelig, goede doorlaatbaarheid."}
                      {watchedValues.specificaties?.bodemtype === "leem" &&
                        "Leemgrond: vruchtbaar maar verdichtingsgevoelig."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* ------------------------------------------------------------------ */}
        {/* 4. HERSTELPAD                                                         */}
        {/* ------------------------------------------------------------------ */}
        <Card
          className={`border-2 ${
            score <= 2
              ? "border-red-200"
              : score === 3
                ? "border-yellow-200"
                : "border-green-200"
          }`}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{herstel.titel}</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {herstel.omschrijving}
                </CardDescription>
              </div>
              <Badge
                className={`shrink-0 ${
                  score <= 2
                    ? "bg-red-100 text-red-700 border-red-200"
                    : score === 3
                      ? "bg-yellow-100 text-yellow-700 border-yellow-200"
                      : "bg-green-100 text-green-700 border-green-200"
                }`}
                variant="outline"
              >
                Score {score}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <p className="text-xs font-medium text-muted-foreground">
              Kies herstelacties (meerdere mogelijk):
            </p>
            {herstel.opties.map((optie) => {
              const isSelected = (watchedValues.herstelActies ?? []).includes(
                optie.id
              );
              return (
                <div
                  key={optie.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`herstel-${optie.id}`}
                      checked={isSelected}
                      onCheckedChange={(checked) =>
                        toggleHerstelActie(optie.id, !!checked)
                      }
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <label
                        htmlFor={`herstel-${optie.id}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {optie.label}
                      </label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {optie.omschrijving}
                      </p>
                      {optie.kostenIndicatie && (
                        <Badge
                          variant="secondary"
                          className="mt-1.5 text-xs font-normal"
                        >
                          Indicatie: {optie.kostenIndicatie}
                        </Badge>
                      )}
                      {isSelected &&
                        watchedValues.specificaties?.oppervlakte > 0 && (
                          <p className="text-xs text-primary font-medium mt-1">
                            Oppervlakte: {watchedValues.specificaties.oppervlakte} m²
                          </p>
                        )}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* ------------------------------------------------------------------ */}
        {/* 5. AANVULLENDE AANBEVELINGEN                                          */}
        {/* ------------------------------------------------------------------ */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Aanvullende aanbevelingen</CardTitle>
            <CardDescription className="text-xs">
              Optionele adviezen en aanvullende diensten
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {/* Drainage — alleen tonen als wateroverlast is aangevinkt */}
            {toonDrainage && (
              <FormField
                control={form.control}
                name="aanbevelingen.drainageAanleggen"
                render={({ field }) => (
                  <FormItem className="flex items-start justify-between rounded-lg border border-blue-200 bg-blue-50 p-3 gap-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">
                        Drainage aanleggen
                      </FormLabel>
                      <FormDescription className="text-xs">
                        Aanbevolen bij wateroverlast — afvoerpijpen of
                        drainagemat verbeteren afwatering.
                      </FormDescription>
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
            )}

            {/* Bekalken — alleen tonen als verzuring is aangevinkt */}
            {toonBekalken && (
              <FormField
                control={form.control}
                name="aanbevelingen.bekalken"
                render={({ field }) => (
                  <FormItem className="flex items-start justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 gap-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">
                        Bekalken
                      </FormLabel>
                      <FormDescription className="text-xs">
                        Aanbevolen bij verzuring — kalk neutraliseert de
                        bodemzuurgraad (pH verhogen).
                      </FormDescription>
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
            )}

            {/* Beregeningsadvies — alleen tonen als verdroging is aangevinkt */}
            {toonBeregeningsadvies && (
              <FormField
                control={form.control}
                name="aanbevelingen.beregeningsadvies"
                render={({ field }) => (
                  <FormItem className="flex items-start justify-between rounded-lg border border-cyan-200 bg-cyan-50 p-3 gap-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">
                        Beregeningsadvies
                      </FormLabel>
                      <FormDescription className="text-xs">
                        Aanbevolen bij verdroging — advies over optimale
                        bevloeiingsfrequentie en hoeveelheid.
                      </FormDescription>
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
            )}

            {/* Robotmaaier advies — altijd zichtbaar (upsell) */}
            <FormField
              control={form.control}
              name="aanbevelingen.robotmaaierAdvies"
              render={({ field }) => (
                <FormItem className="space-y-0">
                  <div className="flex items-start justify-between rounded-lg border p-3 gap-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">
                        Robotmaaier advies
                      </FormLabel>
                      <FormDescription className="text-xs">
                        Advies over aanschaf en installatie van een robotmaaier.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </div>

                  {/* Info card wanneer robotmaaier advies actief is */}
                  {aanbevelingen.robotmaaierAdvies && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex gap-2">
                      <Info className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-green-800">
                        <span className="font-semibold">Robotmaaier tip:</span>{" "}
                        Een robotmaaier maait dagelijks kleine stukjes — het
                        gazon wordt er beter van! Kort gras stimuleert
                        uitstoeling en houdt onkruid en mos op afstand.
                      </p>
                    </div>
                  )}
                </FormItem>
              )}
            />

            {/* Samenvatting actieve aanbevelingen */}
            {(aanbevelingen.drainageAanleggen ||
              aanbevelingen.bekalken ||
              aanbevelingen.beregeningsadvies ||
              aanbevelingen.robotmaaierAdvies) && (
              <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                <span className="font-medium">Actieve aanbevelingen:</span>{" "}
                {[
                  aanbevelingen.drainageAanleggen && "drainage",
                  aanbevelingen.bekalken && "bekalken",
                  aanbevelingen.beregeningsadvies && "beregeningsadvies",
                  aanbevelingen.robotmaaierAdvies && "robotmaaier advies",
                ]
                  .filter(Boolean)
                  .join(", ")}
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
