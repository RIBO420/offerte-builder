"use client";

import type { UseFormReturn, FieldErrors } from "react-hook-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import type { GazonanalyseFormData } from "./schema";

interface GazonSpecificatiesProps {
  form: UseFormReturn<GazonanalyseFormData>;
  errors: FieldErrors<GazonanalyseFormData>;
  bodemtype: string | undefined;
}

export function GazonSpecificaties({ form, errors, bodemtype }: GazonSpecificatiesProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Gazon specificaties</CardTitle>
        <CardDescription className="text-xs">
          Afmetingen, grastype en bodemtype
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <FormField
          control={form.control}
          name="specificaties.oppervlakte"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>Oppervlakte gazon</FormLabel>
              <FormControl>
                <AreaInput
                  id="gazon-oppervlakte"
                  min={0}
                  value={field.value || 0}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  showStepper={false}
                  error={!!errors.specificaties?.oppervlakte}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="specificaties.grastype"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Huidig grastype</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger id="grastype">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="onbekend">Onbekend</SelectItem>
                    <SelectItem value="sport">Sportgras</SelectItem>
                    <SelectItem value="sier">Siergazon</SelectItem>
                    <SelectItem value="schaduw">Schaduwgras</SelectItem>
                    <SelectItem value="mix">Mix</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="specificaties.bodemtype"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bodemtype</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger id="bodemtype">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="zand">Zand</SelectItem>
                    <SelectItem value="klei">Klei</SelectItem>
                    <SelectItem value="veen">Veen</SelectItem>
                    <SelectItem value="leem">Leem</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription className="text-xs">
                  {bodemtype === "klei" &&
                    "Kleigrond: verdichting en wateroverlast zijn aandachtspunten."}
                  {bodemtype === "veen" &&
                    "Veengrond: verzakking en verzuring treden sneller op."}
                  {bodemtype === "zand" &&
                    "Zandgrond: droogte-gevoelig, goede doorlaatbaarheid."}
                  {bodemtype === "leem" &&
                    "Leemgrond: vruchtbaar maar verdichtingsgevoelig."}
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
