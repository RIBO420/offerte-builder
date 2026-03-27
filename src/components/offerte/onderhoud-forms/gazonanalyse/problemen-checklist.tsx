"use client";

import type { UseFormReturn, FieldErrors } from "react-hook-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
import type { GazonanalyseFormData } from "./schema";

interface ProblemenChecklistProps {
  form: UseFormReturn<GazonanalyseFormData>;
  problemen: GazonanalyseFormData["problemen"];
  errors: FieldErrors<GazonanalyseFormData>;
}

export function ProblemenChecklist({ form, problemen, errors }: ProblemenChecklistProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Problemen</CardTitle>
        <CardDescription className="text-xs">
          Selecteer aanwezige problemen — vul details in waar van toepassing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* Mos */}
        <div className="space-y-2 rounded-lg border p-3">
          <FormField
            control={form.control}
            name="problemen.mos"
            render={({ field }) => (
              <FormItem className="flex items-center gap-3">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    id="probleem-mos"
                  />
                </FormControl>
                <FormLabel htmlFor="probleem-mos" className="text-sm font-medium cursor-pointer">
                  Mos
                </FormLabel>
              </FormItem>
            )}
          />
          {problemen.mos && (
            <FormField
              control={form.control}
              name="problemen.mosPercentage"
              render={({ field }) => (
                <FormItem className="pl-7">
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-xs text-muted-foreground">
                      Geschat mospercentage
                    </FormLabel>
                    <Badge variant="secondary" className="text-xs">
                      {field.value}%
                    </Badge>
                  </div>
                  <FormControl>
                    <Slider
                      min={0}
                      max={100}
                      step={5}
                      value={[field.value]}
                      onValueChange={(vals) => field.onChange(vals[0])}
                      aria-label="Mospercentage"
                    />
                  </FormControl>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Kale plekken */}
        <div className="space-y-2 rounded-lg border p-3">
          <FormField
            control={form.control}
            name="problemen.kalePlekken"
            render={({ field }) => (
              <FormItem className="flex items-center gap-3">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    id="probleem-kale-plekken"
                  />
                </FormControl>
                <FormLabel htmlFor="probleem-kale-plekken" className="text-sm font-medium cursor-pointer">
                  Kale plekken
                </FormLabel>
              </FormItem>
            )}
          />
          {problemen.kalePlekken && (
            <FormField
              control={form.control}
              name="problemen.kalePlekkenOppervlakte"
              render={({ field }) => (
                <FormItem className="pl-7">
                  <FormLabel className="text-xs text-muted-foreground">
                    Oppervlakte kale plekken
                  </FormLabel>
                  <FormControl>
                    <AreaInput
                      id="kale-plekken-opp"
                      min={0}
                      value={field.value || 0}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      showStepper={false}
                      error={!!errors.problemen?.kalePlekkenOppervlakte}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Onkruid */}
        <div className="space-y-2 rounded-lg border p-3">
          <FormField
            control={form.control}
            name="problemen.onkruid"
            render={({ field }) => (
              <FormItem className="flex items-center gap-3">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    id="probleem-onkruid"
                  />
                </FormControl>
                <FormLabel htmlFor="probleem-onkruid" className="text-sm font-medium cursor-pointer">
                  Onkruid
                </FormLabel>
              </FormItem>
            )}
          />
          {problemen.onkruid && (
            <FormField
              control={form.control}
              name="problemen.onkruidType"
              render={({ field }) => (
                <FormItem className="pl-7">
                  <FormLabel className="text-xs text-muted-foreground">
                    Type onkruid
                  </FormLabel>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger id="onkruid-type" className="h-9 text-sm">
                        <SelectValue placeholder="Selecteer type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="breed">Breedbladig (paardenbloem, weegbree)</SelectItem>
                      <SelectItem value="smal">Smalbladig (raaigras, beemdgras)</SelectItem>
                      <SelectItem value="klaver">Klaver</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Grid van toggle-problemen */}
        <div className="grid gap-2 sm:grid-cols-2">
          {/* Verdroging */}
          <FormField
            control={form.control}
            name="problemen.verdroging"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                <FormLabel className="text-sm font-normal cursor-pointer">
                  Verdroging
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

          {/* Wateroverlast */}
          <FormField
            control={form.control}
            name="problemen.wateroverlast"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                <FormLabel className="text-sm font-normal cursor-pointer">
                  Wateroverlast
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

          {/* Verzuring */}
          <FormField
            control={form.control}
            name="problemen.verzuring"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                <FormLabel className="text-sm font-normal cursor-pointer">
                  Verzuring
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

          {/* Muizen/mollen */}
          <FormField
            control={form.control}
            name="problemen.muizenMollen"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-2.5">
                <FormLabel className="text-sm font-normal cursor-pointer">
                  Muizen / mollen
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

        {/* Schaduw — apart vanwege percentage slider */}
        <div className="space-y-2 rounded-lg border p-3">
          <FormField
            control={form.control}
            name="problemen.schaduw"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between">
                <FormLabel className="text-sm font-medium cursor-pointer">
                  Schaduw
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
          {problemen.schaduw && (
            <FormField
              control={form.control}
              name="problemen.schaduwPercentage"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-xs text-muted-foreground">
                      Percentage schaduw over gazon
                    </FormLabel>
                    <Badge variant="secondary" className="text-xs">
                      {field.value}%
                    </Badge>
                  </div>
                  <FormControl>
                    <Slider
                      min={0}
                      max={100}
                      step={5}
                      value={[field.value]}
                      onValueChange={(vals) => field.onChange(vals[0])}
                      aria-label="Schaduwpercentage"
                    />
                  </FormControl>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </FormItem>
              )}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
