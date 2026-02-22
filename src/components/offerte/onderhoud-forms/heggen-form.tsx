"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { LengthInput } from "@/components/ui/number-input";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Scissors, Info, AlertTriangle, AlertCircle } from "lucide-react";
import { heggenOnderhoudSchema } from "@/lib/validations/onderhoud-scopes";
import type { HeggenOnderhoudData } from "@/types/offerte";

// Lokale uitbreiding van het schema voor de extra UI-velden.
// De basisvelden komen van heggenOnderhoudSchema; de nieuwe velden zijn optioneel
// zodat backwards compatibility behouden blijft.
const heggenFormExtendedSchema = heggenOnderhoudSchema.extend({
  diepte: z.number().min(0).optional(),
  haagsoort: z
    .enum(["liguster", "beuk", "taxus", "conifeer", "buxus", "overig"])
    .optional(),
  overigHaagsoort: z.string().optional(),
  hoogwerkerInzetten: z.boolean().optional(),
  ondergrond: z
    .enum(["bestrating", "border", "grind", "gras", "anders"])
    .optional(),
  frequentie: z.enum(["1x", "2x", "3x"]).optional(),
});

type HeggenFormExtended = z.infer<typeof heggenFormExtendedSchema>;

interface HeggenFormProps {
  data: HeggenOnderhoudData;
  onChange: (data: HeggenOnderhoudData) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

export function HeggenForm({ data, onChange, onValidationChange }: HeggenFormProps) {
  const form = useForm<HeggenFormExtended>({
    resolver: zodResolver(heggenFormExtendedSchema),
    defaultValues: {
      ...data,
      diepte: undefined,
      haagsoort: undefined,
      overigHaagsoort: "",
      hoogwerkerInzetten: false,
      ondergrond: undefined,
      frequentie: "2x",
    },
    mode: "onChange",
  });

  const { formState: { errors, isValid }, watch } = form;

  // Synchroniseer wijzigingen met de parent — geef alleen de basisvelden mee
  useEffect(() => {
    const subscription = watch((values) => {
      if (values.lengte !== undefined) {
        onChange({
          lengte: values.lengte ?? 0,
          hoogte: values.hoogte ?? 0,
          breedte: values.breedte ?? 0,
          snoei: values.snoei ?? "beide",
          afvoerSnoeisel: values.afvoerSnoeisel ?? false,
        });
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange]);

  // Validatiestatus doorgeven aan parent
  useEffect(() => {
    if (onValidationChange) {
      const errorMessages: Record<string, string> = {};
      Object.entries(errors).forEach(([key, error]) => {
        const fieldError = error as { message?: string } | undefined;
        if (fieldError?.message) {
          errorMessages[key] = fieldError.message;
        }
      });
      onValidationChange(isValid, errorMessages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(errors), isValid]);

  const watchedValues = watch();

  const hoogte = watchedValues.hoogte ?? 0;
  const lengte = watchedValues.lengte ?? 0;
  const breedte = watchedValues.breedte ?? 0;
  const diepte = watchedValues.diepte ?? 0;

  const volume = lengte * hoogte * breedte;
  const volumeMetDiepte = diepte > 0 ? lengte * hoogte * breedte * diepte : volume;
  const isVolumeComplete = lengte > 0 && hoogte > 0 && breedte > 0;

  // Hoogwerker logica
  const hoogwerkerMogelijkNodig = hoogte > 2.5 && hoogte <= 4;
  const hoogwerkerVerplicht = hoogte > 4;

  // Auto-zet hoogwerker aan bij hoogte > 4m (éénmalig via useEffect)
  useEffect(() => {
    if (hoogte > 4 && !watchedValues.hoogwerkerInzetten) {
      form.setValue("hoogwerkerInzetten", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoogte]);

  // Toeslag-indicatie voor haagsoort
  const haagsoortToeslag: Record<string, string> = {
    taxus: "toeslag — langzaam groeiend, arbeidsintensief",
    conifeer: "toeslag — moeilijk te snoeien",
  };
  const haagsoort = watchedValues.haagsoort;
  const heeftHaagsoortToeslag =
    haagsoort === "taxus" || haagsoort === "conifeer";

  return (
    <Form {...form}>
      <form>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Scissors className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Heggen Onderhoud</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Snoei van heggen (L × H × B voor volume)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">

            {/* ── Afmetingen ── */}
            <div className="grid gap-3 md:grid-cols-4">
              <FormField
                control={form.control}
                name="lengte"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>
                      Lengte
                      <span className="text-xs text-orange-600 font-normal ml-2">(verplicht)</span>
                    </FormLabel>
                    <FormControl>
                      <LengthInput
                        id="heg-lengte"
                        min={0}
                        value={field.value || 0}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        showStepper={false}
                        error={!!errors.lengte}
                        className="border-orange-300"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hoogte"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>
                      Hoogte
                      <span className="text-xs text-orange-600 font-normal ml-2">(verplicht)</span>
                    </FormLabel>
                    <FormControl>
                      <LengthInput
                        id="heg-hoogte"
                        min={0}
                        value={field.value || 0}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        showStepper={false}
                        error={!!errors.hoogte}
                        className="border-orange-300"
                      />
                    </FormControl>
                    {hoogte > 2 && !hoogwerkerMogelijkNodig && !hoogwerkerVerplicht && (
                      <p className="text-xs text-orange-600">
                        Hoogte &gt;2m: toeslag voor ladder/hoogwerker
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="breedte"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>
                      Breedte
                      <span className="text-xs text-orange-600 font-normal ml-2">(verplicht)</span>
                    </FormLabel>
                    <FormControl>
                      <LengthInput
                        id="heg-breedte"
                        min={0}
                        value={field.value || 0}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        showStepper={false}
                        error={!!errors.breedte}
                        className="border-orange-300"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="diepte"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Diepte (m)</FormLabel>
                    <FormControl>
                      <LengthInput
                        id="heg-diepte"
                        min={0}
                        value={field.value ?? 0}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        showStepper={false}
                        error={!!errors.diepte}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">Optioneel, voor volume</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ── Volume samenvatting ── */}
            {isVolumeComplete && (
              <div className="rounded-lg bg-primary/10 p-2 text-center">
                <p className="text-xs text-muted-foreground">Volume</p>
                {diepte > 0 ? (
                  <>
                    <p className="text-lg font-bold">{volumeMetDiepte.toFixed(2)} m⁴</p>
                    <p className="text-xs text-muted-foreground">
                      ({volume.toFixed(1)} m³ × {diepte.toFixed(1)} m diepte)
                    </p>
                  </>
                ) : (
                  <p className="text-lg font-bold">{volume.toFixed(1)} m³</p>
                )}
              </div>
            )}

            {/* ── Hoogwerker waarschuwingen ── */}
            {(hoogwerkerMogelijkNodig || hoogwerkerVerplicht) && (
              <div className="flex flex-col gap-2">
                {hoogwerkerVerplicht && (
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="destructive"
                      className="gap-1.5"
                    >
                      <AlertCircle className="h-3 w-3" />
                      Hoogwerker verplicht
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Hoogte &gt;4m — veiligheidsregel
                    </span>
                  </div>
                )}
                {hoogwerkerMogelijkNodig && !hoogwerkerVerplicht && (
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="gap-1.5 border-orange-400 text-orange-700 bg-orange-50"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      Hoogwerker mogelijk nodig
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Hoogte &gt;2,5m
                    </span>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="hoogwerkerInzetten"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                      <FormLabel className="text-sm font-normal">Hoogwerker inzetten</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value ?? false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* ── Haagsoort ── */}
            <FormField
              control={form.control}
              name="haagsoort"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Haagsoort</FormLabel>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(val) => {
                      field.onChange(val === "" ? undefined : val);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger id="heg-haagsoort">
                        <SelectValue placeholder="Selecteer haagsoort (optioneel)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="liguster">Liguster — snelgroeiend, makkelijker</SelectItem>
                      <SelectItem value="beuk">Beuk — snelgroeiend, makkelijker</SelectItem>
                      <SelectItem value="taxus">Taxus — langzaam, arbeidsintensief (toeslag)</SelectItem>
                      <SelectItem value="conifeer">Conifeer — moeilijk te snoeien (toeslag)</SelectItem>
                      <SelectItem value="buxus">Buxus — klein, makkelijk</SelectItem>
                      <SelectItem value="overig">Overig — omschrijf hieronder</SelectItem>
                    </SelectContent>
                  </Select>
                  {heeftHaagsoortToeslag && haagsoort && (
                    <FormDescription className="text-amber-700">
                      Let op: {haagsoortToeslag[haagsoort]}
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── Vrij tekstveld bij haagsoort "overig" ── */}
            {haagsoort === "overig" && (
              <FormField
                control={form.control}
                name="overigHaagsoort"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Omschrijving haagsoort</FormLabel>
                    <FormControl>
                      <Input
                        id="heg-overig-haagsoort"
                        placeholder="Bijv. bamboe, laurier..."
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* ── Snoei type ── */}
            <FormField
              control={form.control}
              name="snoei"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Snoei type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger id="heg-snoei">
                        <SelectValue placeholder="Selecteer snoei type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="zijkanten">Alleen zijkanten</SelectItem>
                      <SelectItem value="bovenkant">Alleen bovenkant</SelectItem>
                      <SelectItem value="beide">Zijkanten én bovenkant</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {watchedValues.snoei === "beide"
                      ? "Volledige snoei rondom"
                      : watchedValues.snoei === "zijkanten"
                        ? "Alleen de zijkanten bijwerken"
                        : "Alleen de bovenkant egaliseren"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── Snoeifrequentie ── */}
            <FormField
              control={form.control}
              name="frequentie"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Snoeifrequentie per jaar</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value ?? "2x"}
                      onValueChange={field.onChange}
                      className="flex gap-4"
                    >
                      {(["1x", "2x", "3x"] as const).map((optie) => (
                        <FormItem
                          key={optie}
                          className="flex items-center gap-2 space-y-0"
                        >
                          <FormControl>
                            <RadioGroupItem value={optie} id={`frequentie-${optie}`} />
                          </FormControl>
                          <FormLabel
                            htmlFor={`frequentie-${optie}`}
                            className="font-normal cursor-pointer"
                          >
                            {optie} per jaar
                          </FormLabel>
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── Ondergrond ── */}
            <FormField
              control={form.control}
              name="ondergrond"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ondergrond onder de haag</FormLabel>
                  <FormDescription className="text-xs">
                    Beïnvloedt afvoerwerk en beschermingsmaatregelen
                  </FormDescription>
                  <FormControl>
                    <RadioGroup
                      value={field.value ?? ""}
                      onValueChange={(val) =>
                        field.onChange(val === "" ? undefined : val)
                      }
                      className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3"
                    >
                      {(
                        [
                          { value: "bestrating", label: "Bestrating" },
                          { value: "border", label: "Border" },
                          { value: "grind", label: "Grind" },
                          { value: "gras", label: "Gras" },
                          { value: "anders", label: "Anders" },
                        ] as const
                      ).map(({ value, label }) => (
                        <FormItem key={value} className="space-y-0">
                          <FormLabel
                            htmlFor={`ondergrond-${value}`}
                            className={[
                              "flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer font-normal text-sm transition-colors",
                              field.value === value
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-muted/50",
                            ].join(" ")}
                          >
                            <FormControl>
                              <RadioGroupItem
                                value={value}
                                id={`ondergrond-${value}`}
                              />
                            </FormControl>
                            {label}
                            {value === "bestrating" && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  Extra afdekken nodig om tegels te beschermen
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </FormLabel>
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── Afvoer snoeisel ── */}
            <FormField
              control={form.control}
              name="afvoerSnoeisel"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                  <FormLabel className="text-sm font-normal">Afvoer snoeisel</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* ── Indicatie ── */}
            {isVolumeComplete && (
              <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                <span className="font-medium">Indicatie:</span>{" "}
                snoeitijd: ~{(
                  Math.round(
                    volume *
                    (watchedValues.snoei === "beide"
                      ? 0.5
                      : watchedValues.snoei === "zijkanten"
                        ? 0.35
                        : 0.25) *
                    (hoogte > 2 ? 1.3 : 1.0) *
                    (heeftHaagsoortToeslag ? 1.25 : 1.0) *
                    (watchedValues.frequentie === "3x"
                      ? 3
                      : watchedValues.frequentie === "1x"
                        ? 1
                        : 2) *
                    4
                  ) / 4
                ).toFixed(2)}u/jaar
                {watchedValues.afvoerSnoeisel &&
                  `, afval: ~${(volume * 0.1).toFixed(2)} m³`}
                {hoogte > 2 && (
                  <span className="text-orange-600"> (+30% hoogte)</span>
                )}
                {heeftHaagsoortToeslag && (
                  <span className="text-amber-600"> (+25% haagsoort)</span>
                )}
                {watchedValues.hoogwerkerInzetten && (
                  <span className="text-blue-600"> (hoogwerker ingecalculeerd)</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
