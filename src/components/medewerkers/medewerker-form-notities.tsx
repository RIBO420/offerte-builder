"use client";

import { useFormContext } from "react-hook-form";
import { m } from "framer-motion";
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
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
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
    </m.div>
  );
}
