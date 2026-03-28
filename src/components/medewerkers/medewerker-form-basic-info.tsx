"use client";

import { useFormContext } from "react-hook-form";
import { m } from "framer-motion";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { inputPatterns, formatInput } from "@/lib/input-patterns";
import {
  FUNCTIE_OPTIONS,
  CONTRACT_TYPE_OPTIONS,
  type MedewerkerFormData,
} from "./medewerker-form";

export function MedewerkerFormBasicInfo() {
  const form = useFormContext<MedewerkerFormData>();

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid gap-4"
    >
      {/* Naam en Functie */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="naam"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Naam *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Jan Jansen" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="functie"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Functie</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer functie" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {FUNCTIE_OPTIONS.map((functie) => (
                    <SelectItem key={functie} value={functie}>
                      {functie}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Email en Telefoon */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  placeholder={inputPatterns.email.placeholder}
                  inputMode={inputPatterns.email.inputMode}
                  autoComplete={inputPatterns.email.autoComplete}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="telefoon"
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
      </div>

      {/* Contract Type en Uurtarief */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="contractType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contract type</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CONTRACT_TYPE_OPTIONS.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="uurtarief"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Uurtarief (optioneel)</FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    EUR
                  </span>
                  <Input
                    {...field}
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-12"
                    placeholder="45.00"
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </m.div>
  );
}
