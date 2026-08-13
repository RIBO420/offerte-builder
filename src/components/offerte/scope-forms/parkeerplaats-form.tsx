"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SquareParking, Info } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  AreaInput,
  LengthInput,
  NumberInput,
  QuantityInput,
} from "@/components/ui/number-input";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFormValidationSync } from "@/hooks/use-scope-form-sync";
import {
  parkeerplaatsSchema,
  type ParkeerplaatsFormData,
} from "@/lib/validations/aanleg-scopes";
import {
  PARKEERPLAATS_FUNDERING_CM,
  schatOpsluitbandMeters,
} from "@/lib/offerte-calculator";
import type { ParkeerplaatsData } from "@/types/offerte";

const TOOLTIPS = {
  draagkracht:
    "De zwaarste voertuigen die er komen bepalen de fundering. Personenauto's: ~25 cm gebroken puin. Bestelbussen/kleine vrachtwagens: ~35 cm. Vrachtverkeer en containers: ~50 cm plus een dikkere zandlaag. Dit is verreweg de grootste kostenpost van een parkeerplaats.",
  verharding:
    "Betonklinkers zijn de standaard voor parkeren: sterk en herstelbaar. Grasbetontegels zijn waterdoorlatend (vaak eis van de gemeente). Halfverharding is de goedkoopste optie maar minder geschikt voor zwaar verkeer. Asfalt is machinaal en pas rendabel vanaf grotere oppervlakken.",
  afwatering:
    "Kolken voeren water af naar het riool of een put — reken op één kolk per ca. 150 m². Infiltratie (waterdoorlatende verharding of een grindkoffer) is vaak vereist bij nieuwbouw en gemeentelijke eisen.",
  belijning:
    "Vakbelijning met markeerverf of belijningstegels. Wordt per vak berekend; vul hierboven het aantal plaatsen in.",
} as const;

interface ParkeerplaatsFormProps {
  data: ParkeerplaatsData;
  onChange: (data: ParkeerplaatsData) => void;
  onValidationChange?: (
    isValid: boolean,
    errors: Record<string, string>
  ) => void;
}

export function ParkeerplaatsForm({
  data,
  onChange,
  onValidationChange,
}: ParkeerplaatsFormProps) {
  const form = useForm<ParkeerplaatsFormData>({
    resolver: zodResolver(parkeerplaatsSchema),
    defaultValues: data,
    mode: "onChange",
  });

  const {
    formState: { errors, isValid },
    watch,
  } = form;

  useEffect(() => {
    const subscription = watch((values) => {
      if (values.oppervlakte === undefined) return;
      onChange({
        oppervlakte: values.oppervlakte ?? 0,
        aantalPlaatsen: values.aantalPlaatsen || undefined,
        verharding: values.verharding ?? "betonklinker",
        draagkracht: values.draagkracht ?? "personenauto",
        ontgraven: values.ontgraven ?? true,
        funderingslagen: values.funderingslagen
          ? {
              gebrokenPuin: values.funderingslagen.gebrokenPuin ?? 0,
              zand: values.funderingslagen.zand ?? 0,
            }
          : undefined,
        opsluitbanden: values.opsluitbanden ?? false,
        opsluitbandenMeters: values.opsluitbandenMeters || undefined,
        afwatering: values.afwatering ?? "geen",
        aantalKolken: values.aantalKolken || undefined,
        belijning: values.belijning ?? false,
      });
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange]);

  useFormValidationSync(errors, isValid, onValidationChange);

  const waarden = watch();
  const fundering =
    waarden.funderingslagen ??
    PARKEERPLAATS_FUNDERING_CM[waarden.draagkracht ?? "personenauto"];
  const oppervlakte = waarden.oppervlakte ?? 0;
  const puinM3 = (oppervlakte * fundering.gebrokenPuin) / 100;
  const zandM3 = (oppervlakte * fundering.zand) / 100;
  const bandMeters =
    waarden.opsluitbandenMeters ?? schatOpsluitbandMeters(oppervlakte);

  return (
    <Form {...form}>
      <form>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <SquareParking className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Parkeerplaats aanleggen</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Verharding met een fundering op de verkeersbelasting, inclusief
              afwatering en belijning
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                control={form.control}
                name="oppervlakte"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Oppervlakte</FormLabel>
                    <FormControl>
                      <AreaInput
                        id="parkeerplaats-oppervlakte"
                        min={0}
                        value={field.value || 0}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        showStepper={false}
                        error={!!errors.oppervlakte}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="aantalPlaatsen"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aantal parkeerplaatsen</FormLabel>
                    <FormControl>
                      <QuantityInput
                        id="parkeerplaats-aantal"
                        min={0}
                        value={field.value ?? 0}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        error={!!errors.aantalPlaatsen}
                      />
                    </FormControl>
                    <FormDescription>
                      Voor de omschrijving en de belijning
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                control={form.control}
                name="verharding"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-1.5">
                      <FormLabel required>Verharding</FormLabel>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[260px]">
                          {TOOLTIPS.verharding}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger id="parkeerplaats-verharding">
                          <SelectValue placeholder="Selecteer verharding" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="betonklinker">
                          Betonklinkers
                        </SelectItem>
                        <SelectItem value="grasbetontegel">
                          Grasbetontegels (waterdoorlatend)
                        </SelectItem>
                        <SelectItem value="halfverharding">
                          Halfverharding (split/grind)
                        </SelectItem>
                        <SelectItem value="asfalt">Asfalt</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="draagkracht"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-1.5">
                      <FormLabel required>Verkeersbelasting</FormLabel>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[260px]">
                          {TOOLTIPS.draagkracht}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger id="parkeerplaats-draagkracht">
                          <SelectValue placeholder="Selecteer belasting" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="personenauto">
                          Personenauto&apos;s
                        </SelectItem>
                        <SelectItem value="bestelbus">
                          Bestelbussen / lichte vrachtwagens
                        </SelectItem>
                        <SelectItem value="vrachtverkeer">
                          Vrachtverkeer / containers
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Bepaalt de fundering</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Funderingsopbouw: standaard uit de verkeersbelasting, handmatig
                te overschrijven als de ondergrond daarom vraagt. */}
            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Funderingsopbouw</p>
                  <p className="text-xs text-muted-foreground">
                    {waarden.funderingslagen
                      ? "Handmatig ingesteld"
                      : `Standaard bij ${
                          waarden.draagkracht === "vrachtverkeer"
                            ? "vrachtverkeer"
                            : waarden.draagkracht === "bestelbus"
                              ? "bestelbussen"
                              : "personenauto's"
                        }: ${fundering.gebrokenPuin} cm puin + ${fundering.zand} cm zand`}
                  </p>
                </div>
                <Switch
                  checked={Boolean(waarden.funderingslagen)}
                  onCheckedChange={(aan) =>
                    form.setValue(
                      "funderingslagen",
                      aan
                        ? {
                            gebrokenPuin: fundering.gebrokenPuin,
                            zand: fundering.zand,
                          }
                        : undefined,
                      { shouldValidate: true, shouldDirty: true }
                    )
                  }
                  aria-label="Funderingsdiktes handmatig instellen"
                />
              </div>

              {waarden.funderingslagen && (
                <div className="grid gap-3 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="funderingslagen.gebrokenPuin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gebroken puin (cm)</FormLabel>
                        <FormControl>
                          <NumberInput
                            id="parkeerplaats-puin"
                            min={0}
                            max={100}
                            suffix="cm"
                            value={field.value ?? 0}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="funderingslagen.zand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Straatzand (cm)</FormLabel>
                        <FormControl>
                          <NumberInput
                            id="parkeerplaats-zand"
                            min={0}
                            max={100}
                            suffix="cm"
                            value={field.value ?? 0}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {oppervlakte > 0 && (
                <p className="text-xs text-muted-foreground">
                  Benodigd: {puinM3.toFixed(1)} m³ gebroken puin ·{" "}
                  {zandM3.toFixed(1)} m³ straatzand
                </p>
              )}
            </div>

            <FormField
              control={form.control}
              name="ontgraven"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0">
                    <FormLabel className="text-sm">
                      Ontgraven en afvoeren
                    </FormLabel>
                    <FormDescription className="text-xs">
                      Zet uit als het grondwerk al onder de scope Grondwerk valt
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

            <FormField
              control={form.control}
              name="opsluitbanden"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0">
                    <FormLabel className="text-sm">Opsluitbanden</FormLabel>
                    <FormDescription className="text-xs">
                      Rondom de verharding — bij parkeren vrijwel altijd nodig
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

            {waarden.opsluitbanden && (
              <FormField
                control={form.control}
                name="opsluitbandenMeters"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lengte opsluitbanden</FormLabel>
                    <FormControl>
                      <LengthInput
                        id="parkeerplaats-bandmeters"
                        min={0}
                        value={field.value ?? 0}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        error={!!errors.opsluitbandenMeters}
                      />
                    </FormControl>
                    <FormDescription>
                      Leeg laten = schatting op basis van de oppervlakte (
                      {bandMeters.toFixed(0)} m)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                control={form.control}
                name="afwatering"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-1.5">
                      <FormLabel required>Afwatering</FormLabel>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[260px]">
                          {TOOLTIPS.afwatering}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger id="parkeerplaats-afwatering">
                          <SelectValue placeholder="Selecteer afwatering" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="geen">
                          Geen (afschot op maaiveld)
                        </SelectItem>
                        <SelectItem value="kolken">
                          Kolken met afvoer
                        </SelectItem>
                        <SelectItem value="infiltratie">
                          Infiltratiekoffer
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {waarden.afwatering === "kolken" && (
                <FormField
                  control={form.control}
                  name="aantalKolken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>Aantal kolken</FormLabel>
                      <FormControl>
                        <QuantityInput
                          id="parkeerplaats-kolken"
                          min={0}
                          value={field.value ?? 0}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          error={!!errors.aantalKolken}
                        />
                      </FormControl>
                      <FormDescription>
                        Vuistregel: één kolk per ca. 150 m² (
                        {Math.max(1, Math.ceil(oppervlakte / 150))} bij deze
                        oppervlakte)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="belijning"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0">
                    <div className="flex items-center gap-1.5">
                      <FormLabel className="text-sm">Vakbelijning</FormLabel>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[260px]">
                          {TOOLTIPS.belijning}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <FormDescription className="text-xs">
                      Parkeervakken markeren
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
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
