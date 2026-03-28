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
import { AlertTriangle } from "lucide-react";
import type { ReinigingFormData } from "./reiniging-form";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReinigingOnkruidSectie() {
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext<ReinigingFormData>();

  const onkruidBestratingAan = watch("onkruidBestratingAan");
  const onkruidMethode = watch("onkruidMethode");

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <FormField
        control={control}
        name="onkruidBestratingAan"
        render={({ field }) => (
          <FormItem className="flex items-center justify-between">
            <div className="space-y-0.5">
              <FormLabel className="text-sm">
                Onkruidbestrijding bestrating
              </FormLabel>
              <p className="text-xs text-muted-foreground">
                Onkruid uit voegen en bestrating verwijderen
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

      {onkruidBestratingAan && (
        <div className="space-y-3 pl-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              control={control}
              name="onkruidOppervlakte"
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
                      id="onkruid-oppervlakte"
                      min={0}
                      value={field.value ?? 0}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      showStepper={false}
                      error={!!errors.onkruidOppervlakte}
                      className="border-orange-300"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="onkruidMethode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>
                    Methode
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
                        id="onkruid-methode"
                        className="border-orange-300"
                      >
                        <SelectValue placeholder="Selecteer methode" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="handmatig">Handmatig</SelectItem>
                      <SelectItem value="branden">Branden</SelectItem>
                      <SelectItem value="heet_water">Heet water</SelectItem>
                      <SelectItem value="chemisch">Chemisch</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {onkruidMethode === "chemisch" && (
            <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700 leading-relaxed font-medium">
                Let op: chemische onkruidbestrijding is aan wettelijke
                regels gebonden
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
