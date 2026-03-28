"use client";

import { useCallback } from "react";
import { useFormContext } from "react-hook-form";
import { m } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { WERKDAGEN, type MedewerkerFormData } from "./medewerker-form";

export function MedewerkerFormBeschikbaarheid() {
  const form = useFormContext<MedewerkerFormData>();

  const handleWerkdagToggle = useCallback(
    (dag: number) => {
      const current = form.getValues("werkdagen") ?? [];
      const newDagen = current.includes(dag)
        ? current.filter((d) => d !== dag)
        : [...current, dag];
      form.setValue("werkdagen", newDagen);
    },
    [form]
  );

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      {/* Werkdagen */}
      <div className="space-y-3">
        <Label>Werkdagen</Label>
        <div className="flex flex-wrap gap-2">
          {WERKDAGEN.map((dag) => (
            <div
              key={dag.key}
              className="flex items-center space-x-2"
            >
              <Checkbox
                id={`dag-${dag.key}`}
                checked={(form.watch("werkdagen") ?? []).includes(dag.key)}
                onCheckedChange={() => handleWerkdagToggle(dag.key)}
              />
              <Label
                htmlFor={`dag-${dag.key}`}
                className="text-sm font-normal cursor-pointer"
              >
                {dag.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Uren */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="urenPerWeek"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Uren per week</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  min="0"
                  max="60"
                  placeholder="40"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="maxUrenPerDag"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Max uren per dag</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  min="0"
                  max="12"
                  placeholder="8"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </m.div>
  );
}
