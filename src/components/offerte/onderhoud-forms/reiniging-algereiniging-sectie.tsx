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

export function ReinigingAlgereinigingSectie() {
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext<ReinigingFormData>();

  const algereinigingAan = watch("algereinigingAan");

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <FormField
        control={control}
        name="algereinigingAan"
        render={({ field }) => (
          <FormItem className="flex items-center justify-between">
            <div className="space-y-0.5">
              <FormLabel className="text-sm">
                Algereiniging / mosbestrijding
              </FormLabel>
              <p className="text-xs text-muted-foreground">
                Verwijdering van algen en mos
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

      {algereinigingAan && (
        <div className="space-y-3 pl-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              control={control}
              name="algereinigingOppervlakte"
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
                      id="algereiniging-oppervlakte"
                      min={0}
                      value={field.value ?? 0}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      showStepper={false}
                      error={!!errors.algereinigingOppervlakte}
                      className="border-orange-300"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="algereinigingType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>
                    Type oppervlak
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
                        id="algereiniging-type"
                        className="border-orange-300"
                      >
                        <SelectValue placeholder="Selecteer type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="dak">Dak</SelectItem>
                      <SelectItem value="bestrating">Bestrating</SelectItem>
                      <SelectItem value="hekwerk">Hekwerk</SelectItem>
                      <SelectItem value="muur">Muur</SelectItem>
                    </SelectContent>
                  </Select>
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
