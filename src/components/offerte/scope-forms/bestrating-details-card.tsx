"use client";

import type { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Layers } from "lucide-react";
import { PriceEstimateBadge } from "@/components/ui/price-estimate-badge";
import type { BestratingFormData } from "@/lib/validations/aanleg-scopes";

// ─── Bestrating details card (oppervlakte, type, snijwerk) ───────────────────

interface BestratingDetailsCardProps {
  form: UseFormReturn<BestratingFormData>;
  oppervlakte: number;
}

export function BestratingDetailsCard({
  form,
  oppervlakte,
}: BestratingDetailsCardProps) {
  const { formState: { errors } } = form;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Bestrating</CardTitle>
          </div>
          <PriceEstimateBadge
            scope="bestrating"
            oppervlakte={oppervlakte}
          />
        </div>
        <CardDescription className="text-xs">
          Tegels, klinkers of natuursteen
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid gap-3 md:grid-cols-3">
          <FormField
            control={form.control}
            name="oppervlakte"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Oppervlakte</FormLabel>
                <FormControl>
                  <AreaInput
                    id="bestrating-oppervlakte"
                    min={0}
                    value={field.value || 0}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    showStepper={false}
                    error={!!errors.oppervlakte}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="typeBestrating"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Type bestrating</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger id="bestrating-type">
                      <SelectValue placeholder="Selecteer type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="tegel">Tegels</SelectItem>
                    <SelectItem value="klinker">Klinkers</SelectItem>
                    <SelectItem value="natuursteen">Natuursteen</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="snijwerk"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Snijwerk</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger id="bestrating-snijwerk">
                      <SelectValue placeholder="Selecteer niveau" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="laag">Laag (weinig hoeken)</SelectItem>
                    <SelectItem value="gemiddeld">Gemiddeld</SelectItem>
                    <SelectItem value="hoog">Hoog (veel rondingen/hoeken)</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Meer snijwerk = hogere arbeidsfactor
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
