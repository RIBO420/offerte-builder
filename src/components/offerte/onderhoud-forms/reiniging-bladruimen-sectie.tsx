"use client";

import { useFormContext } from "react-hook-form";
import { AreaInput } from "@/components/ui/number-input";
import {
  FormControl,
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
import { Switch } from "@/components/ui/switch";
import type { ReinigingFormData } from "./reiniging-form";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReinigingBladruimenSectie() {
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext<ReinigingFormData>();

  const bladruimenAan = watch("bladruimenAan");

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <FormField
        control={control}
        name="bladruimenAan"
        render={({ field }) => (
          <FormItem className="flex items-center justify-between">
            <div className="space-y-0.5">
              <FormLabel className="text-sm">Bladruimen</FormLabel>
              <p className="text-xs text-muted-foreground">
                Seizoensgebonden bladverwijdering
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

      {bladruimenAan && (
        <div className="space-y-3 pl-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              control={control}
              name="bladruimenOppervlakte"
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
                      id="bladruimen-oppervlakte"
                      min={0}
                      value={field.value ?? 0}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      showStepper={false}
                      error={!!errors.bladruimenOppervlakte}
                      className="border-orange-300"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="bladruimenFrequentie"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>
                    Frequentie
                    <span className="text-xs text-orange-600 font-normal ml-2">
                      (verplicht)
                    </span>
                  </FormLabel>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger
                        id="bladruimen-frequentie"
                        className="border-orange-300"
                      >
                        <SelectValue placeholder="Selecteer frequentie" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="eenmalig">Eenmalig</SelectItem>
                      <SelectItem value="seizoen">
                        Seizoen (okt-dec, meerdere beurten)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={control}
            name="bladafvoerAan"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                <FormLabel className="text-sm font-normal">
                  Afvoer bladafval
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
      )}
    </div>
  );
}
