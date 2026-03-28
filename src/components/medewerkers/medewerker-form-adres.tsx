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

export function MedewerkerFormAdres() {
  const form = useFormContext<MedewerkerFormData>();

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid gap-4"
    >
      <FormField
        control={form.control}
        name="straat"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Straat + huisnummer</FormLabel>
            <FormControl>
              <Input {...field} placeholder="Hoofdstraat 123" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="postcode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Postcode</FormLabel>
              <FormControl>
                <Input
                  value={field.value}
                  onChange={(e) => {
                    const formatted = formatInput("postcode", e.target.value);
                    field.onChange(formatted);
                  }}
                  placeholder={inputPatterns.postcode.placeholder}
                  inputMode={inputPatterns.postcode.inputMode}
                  autoComplete={inputPatterns.postcode.autoComplete}
                  maxLength={inputPatterns.postcode.maxLength}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="plaats"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Plaats</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Amsterdam" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </m.div>
  );
}
