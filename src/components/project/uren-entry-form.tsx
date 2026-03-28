"use client";

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Loader2, Plus, Clock } from "lucide-react";
import { format, subDays } from "date-fns";
import { nl } from "@/lib/date-locale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// All available scopes
const availableScopes = [
  { id: "grondwerk", label: "Grondwerk" },
  { id: "bestrating", label: "Bestrating" },
  { id: "borders", label: "Borders" },
  { id: "gras", label: "Gazon" },
  { id: "houtwerk", label: "Houtwerk" },
  { id: "water_elektra", label: "Water/Elektra" },
  { id: "specials", label: "Specials" },
  { id: "gras_onderhoud", label: "Gras Onderhoud" },
  { id: "borders_onderhoud", label: "Borders Onderhoud" },
  { id: "heggen", label: "Heggen" },
  { id: "bomen", label: "Bomen" },
  { id: "overig", label: "Overig" },
];

export interface UrenEntryData {
  datum: string;
  medewerker: string;
  uren: number;
  scope?: string;
  notities?: string;
}

// Type for medewerker from database
export interface DatabaseMedewerker {
  _id: string;
  naam: string;
  functie?: string;
}

// Zod schema
const urenEntrySchema = z.object({
  datum: z.date({ message: "Datum is verplicht" }),
  medewerker: z.string().min(1, "Medewerker is verplicht"),
  uren: z.string().min(1, "Uren is verplicht").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    { message: "Voer geldige uren in" }
  ),
  scope: z.string().optional(),
  notities: z.string().optional(),
});

type UrenEntryFormData = z.infer<typeof urenEntrySchema>;

interface UrenEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: UrenEntryData) => Promise<void>;
  isLoading?: boolean;
  initialData?: Partial<UrenEntryData>;
  existingMedewerkers?: string[];
  /** Medewerkers from database to show in dropdown */
  databaseMedewerkers?: DatabaseMedewerker[];
  projectScopes?: string[];
}

export function UrenEntryForm({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  initialData,
  existingMedewerkers = [],
  databaseMedewerkers = [],
  projectScopes,
}: UrenEntryFormProps) {
  const [showNewMedewerker, setShowNewMedewerker] = useState(false);

  const form = useForm<UrenEntryFormData>({
    resolver: zodResolver(urenEntrySchema),
    defaultValues: {
      datum: initialData?.datum ? new Date(initialData.datum) : new Date(),
      medewerker: initialData?.medewerker || "",
      uren: initialData?.uren?.toString() || "",
      scope: initialData?.scope || "",
      notities: initialData?.notities || "",
    },
  });

  // Combine database medewerkers with existing medewerkers, removing duplicates
  const allMedewerkers = [
    ...databaseMedewerkers.map((m) => ({ naam: m.naam, functie: m.functie, isFromDb: true })),
    ...existingMedewerkers
      .filter((name) => !databaseMedewerkers.some((m) => m.naam === name))
      .map((naam) => ({ naam, functie: undefined, isFromDb: false })),
  ];

  // Filter scopes if project has specific scopes
  const filteredScopes = projectScopes?.length
    ? availableScopes.filter((s) => projectScopes.includes(s.id))
    : availableScopes;

  const handleFormSubmit = useCallback(
    async (data: UrenEntryFormData) => {
      await onSubmit({
        datum: format(data.datum, "yyyy-MM-dd"),
        medewerker: data.medewerker.trim(),
        uren: parseFloat(data.uren) || 0,
        scope: data.scope && data.scope !== "__none__" ? data.scope : undefined,
        notities: data.notities?.trim() || undefined,
      });

      // Reset form after successful submit
      form.reset({
        datum: form.getValues("datum"),
        medewerker: "",
        uren: "",
        scope: "",
        notities: "",
      });
      setShowNewMedewerker(false);
    },
    [onSubmit, form]
  );

  const handleClose = useCallback(() => {
    onOpenChange(false);
    form.reset({
      datum: new Date(),
      medewerker: "",
      uren: "",
      scope: "",
      notities: "",
    });
    setShowNewMedewerker(false);
  }, [onOpenChange, form]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Uren registreren</DialogTitle>
          <DialogDescription>
            Voeg handmatig gewerkte uren toe aan het project
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)}>
            <div className="grid gap-4 py-4">
              {/* Datum met snelkeuze */}
              <FormField
                control={form.control}
                name="datum"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Datum</FormLabel>
                    {/* Snelkeuze knoppen */}
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge
                        variant={field.value && format(field.value, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") ? "default" : "outline"}
                        className="cursor-pointer hover:bg-primary/80 transition-colors"
                        onClick={() => field.onChange(new Date())}
                      >
                        Vandaag
                      </Badge>
                      <Badge
                        variant={field.value && format(field.value, "yyyy-MM-dd") === format(subDays(new Date(), 1), "yyyy-MM-dd") ? "default" : "outline"}
                        className="cursor-pointer hover:bg-primary/80 transition-colors"
                        onClick={() => field.onChange(subDays(new Date(), 1))}
                      >
                        Gisteren
                      </Badge>
                      <Badge
                        variant={field.value && format(field.value, "yyyy-MM-dd") === format(subDays(new Date(), 2), "yyyy-MM-dd") ? "default" : "outline"}
                        className="cursor-pointer hover:bg-primary/80 transition-colors"
                        onClick={() => field.onChange(subDays(new Date(), 2))}
                      >
                        Eergisteren
                      </Badge>
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? (
                              format(field.value, "EEEE d MMMM yyyy", { locale: nl })
                            ) : (
                              <span>Selecteer datum</span>
                            )}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          locale={nl}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Medewerker */}
              <FormField
                control={form.control}
                name="medewerker"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medewerker</FormLabel>
                    {allMedewerkers.length > 0 && !showNewMedewerker ? (
                      <div className="flex gap-2">
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Kies medewerker" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent position="popper" sideOffset={4}>
                            {allMedewerkers.map((m) => (
                              <SelectItem key={m.naam} value={m.naam}>
                                {m.naam}
                                {m.functie && (
                                  <span className="text-muted-foreground ml-1">
                                    ({m.functie})
                                  </span>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setShowNewMedewerker(true);
                            field.onChange("");
                          }}
                          title="Handmatig invoeren"
                          aria-label="Handmatig invoeren"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Naam medewerker"
                          />
                        </FormControl>
                        {allMedewerkers.length > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowNewMedewerker(false)}
                          >
                            Kiezen
                          </Button>
                        )}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Uren met snelkeuze */}
              <FormField
                control={form.control}
                name="uren"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Uren</FormLabel>
                    {/* Snelkeuze knoppen voor veelvoorkomende uren */}
                    <div className="flex flex-wrap gap-2 mb-2">
                      {[4, 6, 7.5, 8, 9, 10].map((hours) => (
                        <Badge
                          key={hours}
                          variant={field.value === hours.toString() ? "default" : "outline"}
                          className="cursor-pointer hover:bg-primary/80 transition-colors"
                          onClick={() => field.onChange(hours.toString())}
                        >
                          <Clock className="mr-1 h-3 w-3" />
                          {hours} uur
                        </Badge>
                      ))}
                    </div>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min="0"
                        max="24"
                        step="0.5"
                        placeholder="8"
                      />
                    </FormControl>
                    <FormDescription>
                      Gewerkte uren (halve uren toegestaan, bijv. 7.5)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Scope (optional) */}
              <FormField
                control={form.control}
                name="scope"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scope / Taak (optioneel)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecteer scope" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent position="popper" sideOffset={4}>
                        <SelectItem value="__none__">Geen scope</SelectItem>
                        {filteredScopes.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notities (optional) */}
              <FormField
                control={form.control}
                name="notities"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notities (optioneel)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Beschrijving van werkzaamheden..."
                        rows={2}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Annuleren
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Toevoegen
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Button trigger component for convenience
interface UrenEntryButtonProps {
  onClick: () => void;
}

export function UrenEntryButton({ onClick }: UrenEntryButtonProps) {
  return (
    <Button onClick={onClick}>
      <Plus className="mr-2 h-4 w-4" />
      Uren registreren
    </Button>
  );
}
