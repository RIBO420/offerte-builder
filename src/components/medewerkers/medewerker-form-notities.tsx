"use client";

import { useFormContext } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import type { MedewerkerFormData } from "./medewerker-form";

export function MedewerkerFormNotities() {
  const form = useFormContext<MedewerkerFormData>();

  return (
    <div>
      <FormField
        control={form.control}
        name="notities"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Textarea
                {...field}
                placeholder="Extra informatie over de medewerker..."
                rows={4}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
