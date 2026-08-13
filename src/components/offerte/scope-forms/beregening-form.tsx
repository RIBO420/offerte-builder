"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Droplets, Info } from "lucide-react";
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
  beregeningSchema,
  type BeregeningFormData,
} from "@/lib/validations/aanleg-scopes";
import {
  schatBeregeningLeiding,
  schatSproeiers,
} from "@/lib/offerte-calculator";
import type { BeregeningData } from "@/types/offerte";

const TOOLTIPS = {
  zones:
    "Een zone is een groep sproeiers die tegelijk draait. De waterdruk bepaalt hoeveel sproeiers per zone kunnen — reken bij een normale huisaansluiting op ca. 5 tot 7 pop-ups per zone. Meer zones betekent meer magneetventielen, maar wel een werkende installatie.",
  sproeier:
    "Pop-up sproeiers verdwijnen in het gazon en zijn de standaard voor gras. Sproeidoppen staan op een steel en zijn geschikt voor borders. Druppelslang geeft water direct bij de wortel — zuinig en ideaal voor beplanting. Combinatie betekent gras met pop-ups en borders met druppelslang.",
  waterbron:
    "De waterleiding is het eenvoudigst maar kost drinkwater. Een slaan van een put is een eenmalige investering met veel lagere gebruikskosten. Regenwater uit een tank is het duurzaamst, maar vraagt een pomp en voldoende bufferruimte.",
  wintervast:
    "Een leegblaasaansluiting laat je de leidingen voor de vorst met perslucht leegblazen. Zonder deze voorziening vriezen leidingen en sproeiers stuk — de meest voorkomende schadepost bij beregening.",
} as const;

interface BeregeningFormProps {
  data: BeregeningData;
  onChange: (data: BeregeningData) => void;
  onValidationChange?: (
    isValid: boolean,
    errors: Record<string, string>
  ) => void;
}

export function BeregeningForm({
  data,
  onChange,
  onValidationChange,
}: BeregeningFormProps) {
  const form = useForm<BeregeningFormData>({
    resolver: zodResolver(beregeningSchema),
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
        aantalZones: values.aantalZones ?? 1,
        sproeierType: values.sproeierType ?? "popup",
        waterbron: values.waterbron ?? "waterleiding",
        leidinglengte: values.leidinglengte || undefined,
        regelkast: values.regelkast ?? false,
        wifiModule: values.wifiModule ?? false,
        wintervast: values.wintervast ?? false,
      });
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange]);

  useFormValidationSync(errors, isValid, onValidationChange);

  const waarden = watch();
  const oppervlakte = waarden.oppervlakte ?? 0;
  const zones = waarden.aantalZones ?? 1;
  const sproeiers = schatSproeiers(oppervlakte, waarden.sproeierType ?? "popup");
  const leiding =
    waarden.leidinglengte ?? schatBeregeningLeiding(oppervlakte, zones);

  return (
    <Form {...form}>
      <form>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Beregening</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Automatische sproei-installatie: zones, leidingwerk, regelkast en
              wintervast maken
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                control={form.control}
                name="oppervlakte"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Te beregenen oppervlakte</FormLabel>
                    <FormControl>
                      <AreaInput
                        id="beregening-oppervlakte"
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
                name="aantalZones"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-1.5">
                      <FormLabel required>Aantal zones</FormLabel>
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
                          {TOOLTIPS.zones}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <FormControl>
                      <QuantityInput
                        id="beregening-zones"
                        min={1}
                        max={30}
                        value={field.value ?? 1}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        error={!!errors.aantalZones}
                      />
                    </FormControl>
                    <FormDescription>
                      Elke zone krijgt een eigen magneetventiel
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                control={form.control}
                name="sproeierType"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-1.5">
                      <FormLabel required>Type sproeier</FormLabel>
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
                          {TOOLTIPS.sproeier}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger id="beregening-sproeier">
                          <SelectValue placeholder="Selecteer type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="popup">
                          Pop-up sproeiers (gazon)
                        </SelectItem>
                        <SelectItem value="sproeidop">
                          Sproeidoppen op steel (borders)
                        </SelectItem>
                        <SelectItem value="druppelslang">
                          Druppelslang (beplanting)
                        </SelectItem>
                        <SelectItem value="combinatie">
                          Combinatie gazon + borders
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="waterbron"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-1.5">
                      <FormLabel required>Waterbron</FormLabel>
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
                          {TOOLTIPS.waterbron}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger id="beregening-waterbron">
                          <SelectValue placeholder="Selecteer bron" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="waterleiding">
                          Waterleiding
                        </SelectItem>
                        <SelectItem value="put">Geslagen put</SelectItem>
                        <SelectItem value="regenwater">
                          Regenwatertank + pomp
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="leidinglengte"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lengte leidingwerk</FormLabel>
                  <FormControl>
                    <LengthInput
                      id="beregening-leiding"
                      min={0}
                      value={field.value ?? 0}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      error={!!errors.leidinglengte}
                    />
                  </FormControl>
                  <FormDescription>
                    Leeg laten = schatting op basis van oppervlakte en zones (
                    {leiding.toFixed(0)} m)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="regelkast"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0">
                    <FormLabel className="text-sm">
                      Automatische regelkast
                    </FormLabel>
                    <FormDescription className="text-xs">
                      Tijdsturing per zone
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

            {waarden.regelkast && (
              <FormField
                control={form.control}
                name="wifiModule"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0">
                      <FormLabel className="text-sm">Wifi-module</FormLabel>
                      <FormDescription className="text-xs">
                        Bedienen via app, past zich aan op de weersverwachting
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value ?? false}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="wintervast"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0">
                    <div className="flex items-center gap-1.5">
                      <FormLabel className="text-sm">
                        Wintervast (leegblaasaansluiting)
                      </FormLabel>
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
                          {TOOLTIPS.wintervast}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <FormDescription className="text-xs">
                      Sterk aanbevolen — voorkomt vorstschade
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

            {oppervlakte > 0 && (
              <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                Geschat: {sproeiers} sproeipunten over {zones}{" "}
                {zones === 1 ? "zone" : "zones"} · {leiding.toFixed(0)} m leiding
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
