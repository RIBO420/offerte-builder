"use client";

import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { QuantityInput } from "@/components/ui/number-input";
import { PriceEstimateBadge } from "@/components/ui/price-estimate-badge";
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
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Zap, AlertTriangle, Info } from "lucide-react";
import { waterElektraSchema, type WaterElektraFormData } from "@/lib/validations/aanleg-scopes";
import type { WaterElektraData } from "@/types/offerte";

const WATER_ELEKTRA_TOOLTIPS: Record<string, string> = {
  aantalPunten:
    "Een 'punt' is elk aansluitpunt in de tuin: buitenstopcontact, waterkraan, sproeieraansluiting, afvoerput of pompput. Elk punt vereist aparte bekabeling of leiding naar de meterkast/watermeter.",
  sleuvenNodig:
    "Kabelsleuven zijn nodig om leidingen en kabels veilig ondergronds te leggen. De kosten hangen af van de lengte en diepte (minimaal 60 cm voor elektra). Sleuven door bestaande bestrating zijn duurder door het herstelwerk.",
  verlichting:
    "Basis verlichting (1-3 armaturen) omvat bijv. padverlichting of een buitenlamp. Uitgebreide verlichting (4+ armaturen) is voor sfeerverlichting, spotjes en functionele verlichting. Meer armaturen = meer bekabeling en hogere installatiekosten.",
};

interface WaterElektraFormProps {
  data: WaterElektraData;
  onChange: (data: WaterElektraData) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

export function WaterElektraForm({ data, onChange, onValidationChange }: WaterElektraFormProps) {
  const form = useForm<WaterElektraFormData>({
    resolver: zodResolver(waterElektraSchema),
    defaultValues: data,
    mode: "onChange",
  });

  const { formState: { errors, isValid }, watch, setValue } = form;

  // Watch for changes and sync with parent
  useEffect(() => {
    const subscription = watch((values) => {
      if (values.verlichting !== undefined) {
        onChange({
          verlichting: values.verlichting ?? "geen",
          aantalPunten: values.aantalPunten ?? 0,
          sleuvenNodig: values.sleuvenNodig ?? true,
        });
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange]);

  // Notify parent of validation state changes (only when errors object changes)
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
  const heeftElektra = watchedValues.verlichting !== "geen" || watchedValues.aantalPunten > 0;

  // Track whether the initial render has completed to avoid toasting on mount
  const hasInitialized = useRef(false);
  useEffect(() => {
    hasInitialized.current = true;
  }, []);

  // Auto-enable sleuven when elektra is selected
  useEffect(() => {
    if (heeftElektra && !watchedValues.sleuvenNodig) {
      setValue("sleuvenNodig", true);
      if (hasInitialized.current) {
        toast.info("Sleufwerk automatisch ingeschakeld (verplicht voor elektra)");
      }
    }
  }, [heeftElektra, watchedValues.sleuvenNodig, setValue]);

  const totalPunten = watchedValues.aantalPunten + (
    watchedValues.verlichting === "basis" ? 2 :
    watchedValues.verlichting === "uitgebreid" ? 5 : 0
  );

  return (
    <Form {...form}>
      <form className="space-y-3">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Water / Elektra</CardTitle>
              </div>
              <PriceEstimateBadge
                scope="water_elektra"
                oppervlakte={totalPunten}
              />
            </div>
            <CardDescription className="text-xs">
              Tuinverlichting, aansluitpunten en bekabeling
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                control={form.control}
                name="verlichting"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-1.5">
                      <FormLabel required>Verlichting</FormLabel>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="inline-flex rounded-full p-0.5 text-muted-foreground hover:text-foreground">
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[260px]">
                          {WATER_ELEKTRA_TOOLTIPS.verlichting}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger id="elektra-verlichting">
                          <SelectValue placeholder="Selecteer niveau" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="geen">Geen verlichting</SelectItem>
                        <SelectItem value="basis">Basis (1-3 armaturen)</SelectItem>
                        <SelectItem value="uitgebreid">Uitgebreid (4+ armaturen)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Sfeer- en functionele verlichting
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="aantalPunten"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-1.5">
                      <FormLabel>Aantal aansluitpunten</FormLabel>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="inline-flex rounded-full p-0.5 text-muted-foreground hover:text-foreground">
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[260px]">
                          {WATER_ELEKTRA_TOOLTIPS.aantalPunten}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <FormControl>
                      <QuantityInput
                        id="elektra-punten"
                        min={0}
                        max={20}
                        value={field.value || 0}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        showStepper={false}
                        error={!!errors.aantalPunten}
                      />
                    </FormControl>
                    <FormDescription>
                      Stopcontacten, waterpunten, etc.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div
              className="grid transition-all duration-200 ease-in-out"
              style={{
                gridTemplateRows: !heeftElektra ? "1fr" : "0fr",
                opacity: !heeftElektra ? 1 : 0,
              }}
            >
              <div className="overflow-hidden">
                <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                  Selecteer verlichting of voeg aansluitpunten toe.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Verplichte sleuven sectie - alleen tonen als er elektra is */}
        <div
          className="grid transition-all duration-200 ease-in-out"
          style={{
            gridTemplateRows: heeftElektra ? "1fr" : "0fr",
            opacity: heeftElektra ? 1 : 0,
          }}
        >
          <div className="overflow-hidden">
          <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <CardTitle className="text-orange-900 dark:text-orange-100">Sleuven & Herstel (Verplicht)</CardTitle>
              </div>
              <CardDescription className="text-orange-700 dark:text-orange-300">
                Elektra zonder sleufwerk en herstel is niet toegestaan in het systeem
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert variant="default" className="border-orange-300 bg-orange-100/50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertTitle className="text-orange-900">Automatisch inbegrepen</AlertTitle>
                <AlertDescription className="text-orange-700">
                  Sleufwerk voor bekabeling en herstel van bestrating/grond worden automatisch meegenomen in de offerte.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-orange-200 bg-muted/50 p-4 dark:border-orange-800 dark:bg-orange-950/30">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-base">Sleuven graven</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="inline-flex rounded-full p-0.5 text-muted-foreground hover:text-foreground">
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[260px]">
                          {WATER_ELEKTRA_TOOLTIPS.sleuvenNodig}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Verplicht voor veilige bekabeling
                    </p>
                  </div>
                  <span className="text-sm font-medium text-orange-600">Inbegrepen</span>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-orange-200 bg-muted/50 p-4 dark:border-orange-800 dark:bg-orange-950/30">
                  <div className="space-y-0.5">
                    <Label className="text-base">Herstelwerk</Label>
                    <p className="text-sm text-muted-foreground">
                      Dichten sleuven, herstel bestrating/gras
                    </p>
                  </div>
                  <span className="text-sm font-medium text-orange-600">Inbegrepen</span>
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground dark:bg-orange-950/30">
                <div className="font-medium mb-1">Automatisch berekend:</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    Sleuven: geschat op basis van {totalPunten} punten
                  </li>
                  <li>Bekabeling: ~{totalPunten * 8} m (schatting)</li>
                  <li>Herstelwerk: afhankelijk van ondergrond</li>
                </ul>
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
      </form>
    </Form>
  );
}
