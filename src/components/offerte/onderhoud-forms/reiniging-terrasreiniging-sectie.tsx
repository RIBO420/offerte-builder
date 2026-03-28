"use client";

import { useFormContext } from "react-hook-form";
import { AreaInput } from "@/components/ui/number-input";
import {
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
import { Switch } from "@/components/ui/switch";
import { Info } from "lucide-react";
import type { ReinigingFormData } from "./reiniging-form";

// ---------------------------------------------------------------------------
// Tooltip-tekst per terras-type
// ---------------------------------------------------------------------------

const TERRAS_TYPE_TOOLTIPS: Record<string, string> = {
  keramisch: "Voorzichtig, kan krasbaar zijn",
  hout: "Lagere druk, speciaal reinigingsmiddel",
  natuursteen: "Niet met hogedruk, zacht reinigen",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReinigingTerrasreinigingSectie() {
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext<ReinigingFormData>();

  const terrasreinigingAan = watch("terrasreinigingAan");
  const terrasType = watch("terrasType");
  const terrasTypeTooltip = terrasType
    ? TERRAS_TYPE_TOOLTIPS[terrasType]
    : undefined;

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <FormField
        control={control}
        name="terrasreinigingAan"
        render={({ field }) => (
          <FormItem className="flex items-center justify-between">
            <div className="space-y-0.5">
              <FormLabel className="text-sm">Terrasreiniging</FormLabel>
              <p className="text-xs text-muted-foreground">
                Hogedruk reiniging van terras of bestrating
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

      {terrasreinigingAan && (
        <div className="space-y-3 pl-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              control={control}
              name="terrasType"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-1.5">
                    <FormLabel required>
                      Terras-type
                      <span className="text-xs text-orange-600 font-normal ml-2">
                        (verplicht)
                      </span>
                    </FormLabel>
                    {terrasTypeTooltip && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {terrasTypeTooltip}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger
                        id="terras-type"
                        className="border-orange-300"
                      >
                        <SelectValue placeholder="Selecteer type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="keramisch">Keramisch</SelectItem>
                      <SelectItem value="beton">Beton</SelectItem>
                      <SelectItem value="klinkers">Klinkers</SelectItem>
                      <SelectItem value="natuursteen">Natuursteen</SelectItem>
                      <SelectItem value="hout">Hout</SelectItem>
                    </SelectContent>
                  </Select>
                  {terrasType &&
                    TERRAS_TYPE_TOOLTIPS[terrasType] && (
                      <FormDescription className="flex items-center gap-1 text-xs">
                        <Info className="h-3 w-3 shrink-0" />
                        {TERRAS_TYPE_TOOLTIPS[terrasType]}
                      </FormDescription>
                    )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="terrasOppervlakte"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>
                    Oppervlakte
                    <span className="text-xs text-orange-600 font-normal ml-2">
                      (verplicht)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <AreaInput
                      id="terras-oppervlakte"
                      min={0}
                      value={field.value ?? 0}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      showStepper={false}
                      error={!!errors.terrasOppervlakte}
                      className="border-orange-300"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}
