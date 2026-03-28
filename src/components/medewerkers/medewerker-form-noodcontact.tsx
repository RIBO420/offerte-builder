"use client";

import { useFormContext } from "react-hook-form";
import { m } from "framer-motion";
import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { inputPatterns, formatInput } from "@/lib/input-patterns";
import type { MedewerkerFormData } from "./medewerker-form";

export function MedewerkerFormNoodcontact() {
  const form = useFormContext<MedewerkerFormData>();

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="noodcontactNaam"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Naam</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Maria Jansen" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="noodcontactRelatie"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Relatie</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Partner" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={form.control}
        name="noodcontactTelefoon"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Telefoon</FormLabel>
            <FormControl>
              <Input
                value={field.value}
                onChange={(e) => {
                  const formatted = formatInput("telefoon", e.target.value);
                  field.onChange(formatted);
                }}
                placeholder={inputPatterns.telefoon.placeholder}
                inputMode={inputPatterns.telefoon.inputMode}
                autoComplete={inputPatterns.telefoon.autoComplete}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </m.div>
  );
}
