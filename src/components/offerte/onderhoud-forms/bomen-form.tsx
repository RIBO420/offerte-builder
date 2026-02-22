"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { QuantityInput, NumberInput } from "@/components/ui/number-input";
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
import { TreeDeciduous, AlertTriangle, Info, HelpCircle } from "lucide-react";
import { bomenOnderhoudSchema, type BomenOnderhoudFormData } from "@/lib/validations/onderhoud-scopes";
import type { BomenOnderhoudData } from "@/types/offerte";

// ─── types voor de nieuwe optionele velden (lokale staat) ───────────────────

type HoogtecategorieValue = "0-4m" | "4-10m" | "10-20m";
type InspectieType = "geen" | "visueel" | "gecertificeerd";

interface VeiligheidsCheck {
  nabijGebouw: boolean;
  nabijStraat: boolean;
  nabijKabels: boolean;
}

// ─── hulpcomponent: tooltip-icoon ────────────────────────────────────────────

function TooltipIcon({ tekst }: { tekst: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="inline h-3.5 w-3.5 ml-1 text-muted-foreground cursor-help shrink-0" />
      </TooltipTrigger>
      <TooltipContent className="max-w-56">{tekst}</TooltipContent>
    </Tooltip>
  );
}

// ─── hulpcomponent: visuele boom-indicator ────────────────────────────────────

function BoomIndicator({ categorie }: { categorie: HoogtecategorieValue | null }) {
  const groottes: Record<HoogtecategorieValue, { klein: boolean; middel: boolean; groot: boolean }> = {
    "0-4m":   { klein: true,  middel: false, groot: false },
    "4-10m":  { klein: true,  middel: true,  groot: false },
    "10-20m": { klein: true,  middel: true,  groot: true  },
  };

  const actief = categorie ? groottes[categorie] : null;

  return (
    <div className="flex items-end gap-0.5 h-8">
      {/* kleine boom */}
      <TreeDeciduous
        className={
          actief?.klein
            ? "h-4 w-4 text-green-600"
            : "h-4 w-4 text-muted-foreground/30"
        }
      />
      {/* middelgrote boom */}
      <TreeDeciduous
        className={
          actief?.middel
            ? "h-6 w-6 text-green-700"
            : "h-6 w-6 text-muted-foreground/30"
        }
      />
      {/* grote boom */}
      <TreeDeciduous
        className={
          actief?.groot
            ? "h-8 w-8 text-green-800"
            : "h-8 w-8 text-muted-foreground/30"
        }
      />
    </div>
  );
}

// ─── props ───────────────────────────────────────────────────────────────────

interface BomenFormProps {
  data: BomenOnderhoudData;
  onChange: (data: BomenOnderhoudData) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

// ─── hoofd component ─────────────────────────────────────────────────────────

export function BomenForm({ data, onChange, onValidationChange }: BomenFormProps) {
  const form = useForm<BomenOnderhoudFormData>({
    resolver: zodResolver(bomenOnderhoudSchema),
    defaultValues: data,
    mode: "onChange",
  });

  const { formState: { errors, isValid }, watch } = form;

  // ── lokale staat voor nieuwe optionele velden ──────────────────────────────
  const [hoogtecategorie, setHoogtecategorie] = useState<HoogtecategorieValue | null>(null);
  const [veiligheid, setVeiligheid] = useState<VeiligheidsCheck>({
    nabijGebouw: false,
    nabijStraat: false,
    nabijKabels: false,
  });
  const [afstandStraat, setAfstandStraat] = useState<number>(0);
  const [inspectieType, setInspectieType] = useState<InspectieType>("geen");
  const [boomsoort, setBoomsoort] = useState<string>("");
  const [kroondiameter, setKroondiameter] = useState<number>(0);

  // ── afgeleide berekeningen ──────────────────────────────────────────────────
  const heeftVeiligheidsrisico =
    veiligheid.nabijGebouw || veiligheid.nabijStraat || veiligheid.nabijKabels;

  const toonVerkeersmaatregelenWaarschuwing =
    afstandStraat > 0 && afstandStraat < 5;

  // ── sync met ouder-component ───────────────────────────────────────────────
  useEffect(() => {
    const subscription = watch((values) => {
      if (values.aantalBomen !== undefined) {
        onChange({
          aantalBomen: values.aantalBomen ?? 0,
          snoei: values.snoei ?? "licht",
          hoogteklasse: values.hoogteklasse ?? "laag",
          afvoer: values.afvoer ?? false,
        });
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange]);

  // ── validatiewijzigingen doorgeven ──────────────────────────────────────────
  useEffect(() => {
    if (onValidationChange) {
      const errorMessages: Record<string, string> = {};
      Object.entries(errors).forEach(([key, error]) => {
        if (error?.message) {
          errorMessages[key] = error.message;
        }
      });
      onValidationChange(isValid, errorMessages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(errors), isValid]);

  const watchedValues = watch();

  // ── toggle hulpfunctie ──────────────────────────────────────────────────────
  function toggleVeiligheid(veld: keyof VeiligheidsCheck) {
    setVeiligheid((vorige) => ({ ...vorige, [veld]: !vorige[veld] }));
  }

  // ─── render ────────────────────────────────────────────────────────────────
  return (
    <Form {...form}>
      <form>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TreeDeciduous className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Bomen Onderhoud</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Snoei van bomen per hoogteklasse
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5 pt-0">

            {/* ── Basisgegevens ─────────────────────────────────────────── */}
            <FormField
              control={form.control}
              name="aantalBomen"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Aantal bomen</FormLabel>
                  <FormControl>
                    <QuantityInput
                      id="bomen-aantal"
                      min={0}
                      value={field.value || 0}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      showStepper={false}
                      error={!!errors.aantalBomen}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── Snoei type ────────────────────────────────────────────── */}
            <FormField
              control={form.control}
              name="snoei"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Snoei type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger id="bomen-snoei">
                        <SelectValue placeholder="Selecteer snoei type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="licht">Licht (onderhoudssnoei)</SelectItem>
                      <SelectItem value="zwaar">Zwaar (vormsnoei/verjonging)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {watchedValues.snoei === "zwaar"
                      ? "Intensieve snoei voor vorm of verjonging"
                      : "Regulier onderhoud en dood hout verwijderen"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── Groottecategorie (vervangt hoogteklasse visueel) ─────── */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium leading-none">
                  Hoogtecategorie
                </span>
                <span className="text-xs text-muted-foreground">(optioneel)</span>
              </div>

              <RadioGroup
                value={hoogtecategorie ?? ""}
                onValueChange={(v) => setHoogtecategorie(v as HoogtecategorieValue)}
                className="gap-2"
              >
                {/* 0–4m */}
                <label
                  htmlFor="hc-klein"
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                    hoogtecategorie === "0-4m"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <RadioGroupItem value="0-4m" id="hc-klein" />
                  <TreeDeciduous className="h-4 w-4 shrink-0 text-green-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">0–4 m — Klein</p>
                    <p className="text-xs text-muted-foreground">
                      Bereikbaar vanaf de grond, geen speciale maatregelen
                    </p>
                  </div>
                </label>

                {/* 4–10m */}
                <label
                  htmlFor="hc-middel"
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                    hoogtecategorie === "4-10m"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <RadioGroupItem value="4-10m" id="hc-middel" />
                  <TreeDeciduous className="h-6 w-6 shrink-0 text-green-700" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">4–10 m — Middel</p>
                    <p className="text-xs text-muted-foreground">
                      Ladder vereist, steigerwerk mogelijk
                    </p>
                  </div>
                </label>

                {/* 10–20m */}
                <label
                  htmlFor="hc-groot"
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                    hoogtecategorie === "10-20m"
                      ? "border-destructive/40 bg-destructive/5"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <RadioGroupItem value="10-20m" id="hc-groot" />
                  <TreeDeciduous className="h-8 w-8 shrink-0 text-green-800" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">10–20 m — Groot</p>
                    <p className="text-xs text-muted-foreground">
                      Hoogwerker verplicht, specialistisch werk
                    </p>
                  </div>
                </label>
              </RadioGroup>

              {/* visuele boom-indicator */}
              <div className="flex items-center gap-3 pt-1">
                <BoomIndicator categorie={hoogtecategorie} />
                {hoogtecategorie && (
                  <span className="text-xs text-muted-foreground">
                    Geselecteerde categorie: <span className="font-medium">{hoogtecategorie}</span>
                  </span>
                )}
              </div>

              {/* waarschuwing bij >10m */}
              {hoogtecategorie === "10-20m" && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <p className="text-xs text-destructive font-medium">
                    Hoogwerker verplicht — extra kosten van toepassing
                  </p>
                </div>
              )}
            </div>

            {/* ── Hoogteklasse (bestaand schema-veld, verborgen select) ── */}
            <FormField
              control={form.control}
              name="hoogteklasse"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Hoogteklasse</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger id="bomen-hoogte">
                        <SelectValue placeholder="Selecteer hoogteklasse" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="laag">Laag (&lt;4m, vanaf grond)</SelectItem>
                      <SelectItem value="middel">Middel (4-8m, korte ladder)</SelectItem>
                      <SelectItem value="hoog">Hoog (&gt;8m, hoogwerker/klimmen)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {watchedValues.hoogteklasse === "hoog"
                      ? "Specialistisch werk, extra tijd en materieel"
                      : watchedValues.hoogteklasse === "middel"
                        ? "Ladder nodig, matige toeslag"
                        : "Vanaf grond bereikbaar"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── Boomsoort ─────────────────────────────────────────────── */}
            <FormItem>
              <FormLabel className="flex items-center gap-1">
                Boomsoort (optioneel)
                <TooltipIcon tekst="Sommige boomsoorten vereisen speciale snoeitechnieken" />
              </FormLabel>
              <FormControl>
                <Input
                  id="bomen-soort"
                  placeholder="Bijv. eik, beuk, den..."
                  value={boomsoort}
                  onChange={(e) => setBoomsoort(e.target.value)}
                />
              </FormControl>
            </FormItem>

            {/* ── Kroondiameter ─────────────────────────────────────────── */}
            <FormItem>
              <FormLabel className="flex items-center gap-1">
                Kroondiameter (m)
                <TooltipIcon tekst="Geschatte diameter van de boomkroon — beïnvloedt afvoervolume" />
              </FormLabel>
              <FormControl>
                <NumberInput
                  id="bomen-kroon"
                  min={0}
                  max={30}
                  step={0.5}
                  decimals={1}
                  suffix="m"
                  value={kroondiameter}
                  onChange={setKroondiameter}
                  showStepper={false}
                />
              </FormControl>
            </FormItem>

            {/* ── Afstand tot straat ────────────────────────────────────── */}
            <FormItem>
              <FormLabel className="flex items-center gap-1">
                Afstand tot straat (m)
                <TooltipIcon tekst="Bij werkzaamheden dicht bij openbare weg kan een verkeersplan vereist zijn" />
              </FormLabel>
              <FormControl>
                <NumberInput
                  id="bomen-afstand-straat"
                  min={0}
                  max={500}
                  step={0.5}
                  decimals={1}
                  suffix="m"
                  value={afstandStraat}
                  onChange={setAfstandStraat}
                  showStepper={false}
                />
              </FormControl>
              {toonVerkeersmaatregelenWaarschuwing && (
                <div className="flex items-center gap-1.5 pt-1">
                  <Info className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                  <Badge
                    variant="outline"
                    className="text-blue-700 border-blue-300 bg-blue-50 text-xs"
                  >
                    Mogelijk verkeersmaatregelen nodig
                  </Badge>
                </div>
              )}
            </FormItem>

            {/* ── Veiligheidscheck ──────────────────────────────────────── */}
            <div className="space-y-2">
              <p className="text-sm font-medium leading-none">Veiligheidscheck</p>
              <p className="text-xs text-muted-foreground">
                Selecteer van toepassing zijnde omgevingsfactoren
              </p>

              <div className="space-y-2">
                {/* Nabij gebouw */}
                <div className="flex items-center justify-between rounded-lg border p-2.5">
                  <span className="text-sm">Nabij gebouw (huis/schuur)</span>
                  <Switch
                    id="veilig-gebouw"
                    checked={veiligheid.nabijGebouw}
                    onCheckedChange={() => toggleVeiligheid("nabijGebouw")}
                  />
                </div>

                {/* Nabij straat/openbaar */}
                <div className="flex items-center justify-between rounded-lg border p-2.5">
                  <span className="text-sm">Nabij straat/openbaar</span>
                  <Switch
                    id="veilig-straat"
                    checked={veiligheid.nabijStraat}
                    onCheckedChange={() => toggleVeiligheid("nabijStraat")}
                  />
                </div>

                {/* Nabij kabels/leidingen */}
                <div className="flex items-center justify-between rounded-lg border p-2.5">
                  <span className="text-sm">Nabij kabels/leidingen</span>
                  <Switch
                    id="veilig-kabels"
                    checked={veiligheid.nabijKabels}
                    onCheckedChange={() => toggleVeiligheid("nabijKabels")}
                  />
                </div>
              </div>

              {/* Veiligheidswaarschuwing */}
              {heeftVeiligheidsrisico && (
                <Card className="border-orange-300 bg-orange-50">
                  <CardContent className="flex items-start gap-2 p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-orange-800">
                        Veiligheidsmaatregelen vereist
                      </p>
                      <ul className="text-xs text-orange-700 space-y-0.5 list-disc list-inside">
                        {veiligheid.nabijGebouw && (
                          <li>Bescherming gevelbekleding/dakgoot aanbevolen</li>
                        )}
                        {veiligheid.nabijStraat && (
                          <li>Verkeersplan en afzetting openbare weg mogelijk vereist</li>
                        )}
                        {veiligheid.nabijKabels && (
                          <li>KLIC-melding en voorzichtigheid bij graaf-/kapwerkzaamheden</li>
                        )}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* ── Boominspectie type ────────────────────────────────────── */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium leading-none">Boominspectie type</span>
                <TooltipIcon tekst="Gecertificeerde boominspectie is verplicht bij bomen nabij openbare weg of gebouwen" />
              </div>

              <RadioGroup
                value={inspectieType}
                onValueChange={(v) => setInspectieType(v as InspectieType)}
                className="gap-2"
              >
                {/* geen */}
                <label
                  htmlFor="inspectie-geen"
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition-colors ${
                    inspectieType === "geen"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <RadioGroupItem value="geen" id="inspectie-geen" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">Geen inspectie</p>
                  </div>
                </label>

                {/* visueel */}
                <label
                  htmlFor="inspectie-visueel"
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition-colors ${
                    inspectieType === "visueel"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <RadioGroupItem value="visueel" id="inspectie-visueel" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Visuele inspectie</p>
                    <p className="text-xs text-muted-foreground">
                      Standaard visuele controle van boom en kroon
                    </p>
                  </div>
                </label>

                {/* gecertificeerd */}
                <label
                  htmlFor="inspectie-gecertificeerd"
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition-colors ${
                    inspectieType === "gecertificeerd"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <RadioGroupItem value="gecertificeerd" id="inspectie-gecertificeerd" />
                  <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">BHV-gecertificeerde inspectie</p>
                      <p className="text-xs text-muted-foreground">
                        Officieel inspectierapport met certificaat
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      €150–300
                    </Badge>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {/* ── Afvoer snoeihout ──────────────────────────────────────── */}
            <FormField
              control={form.control}
              name="afvoer"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                  <FormLabel className="text-sm font-normal">Afvoer snoeihout</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* ── Indicatieblok ─────────────────────────────────────────── */}
            {watchedValues.aantalBomen > 0 && (
              <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground space-y-0.5">
                <div>
                  <span className="font-medium">Indicatie:</span>{" "}
                  snoeitijd: ~{(Math.round(watchedValues.aantalBomen * (
                    watchedValues.snoei === "zwaar" ? 1.5 : 0.75
                  ) * (
                    watchedValues.hoogteklasse === "hoog" ? 2.0 :
                    watchedValues.hoogteklasse === "middel" ? 1.3 : 1.0
                  ) * 4) / 4).toFixed(2)}u
                  {watchedValues.afvoer && (
                    `, snoeihout: ~${(watchedValues.aantalBomen * (watchedValues.snoei === "zwaar" ? 0.3 : 0.1)).toFixed(1)} m³`
                  )}
                  {watchedValues.hoogteklasse === "hoog" && (
                    <span className="text-orange-600"> (hoogwerker nodig)</span>
                  )}
                </div>
                {kroondiameter > 0 && (
                  <div>
                    <span className="font-medium">Kroondiameter:</span> {kroondiameter} m
                    {" — "}geschat afvoervolume: ~{(
                      Math.PI * Math.pow(kroondiameter / 2, 2) * 0.5 * watchedValues.aantalBomen
                    ).toFixed(1)} m³
                  </div>
                )}
                {boomsoort && (
                  <div>
                    <span className="font-medium">Boomsoort:</span> {boomsoort}
                  </div>
                )}
                {inspectieType !== "geen" && (
                  <div>
                    <span className="font-medium">Inspectie:</span>{" "}
                    {inspectieType === "gecertificeerd"
                      ? "BHV-gecertificeerde inspectie (toeslag €150–300)"
                      : "Visuele inspectie"}
                  </div>
                )}
              </div>
            )}

          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
