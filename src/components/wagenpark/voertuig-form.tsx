"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Loader2, CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { nl } from "@/lib/date-locale";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { showSuccessToast, showErrorToast } from "@/lib/toast-utils";
import { getMutationErrorMessage } from "@/lib/error-handling";

// Common vehicle brands in the Netherlands for landscaping/construction
const vehicleBrands = [
  "Mercedes",
  "Volkswagen",
  "Ford",
  "Renault",
  "Iveco",
  "Peugeot",
  "Citroen",
  "Fiat",
  "Overig",
];

// Vehicle types
const vehicleTypes = [
  { value: "bus", label: "Bus" },
  { value: "bestelwagen", label: "Bestelwagen" },
  { value: "pickup", label: "Pickup" },
  { value: "aanhanger", label: "Aanhanger" },
  { value: "overig", label: "Overig" },
];

// Status options
const statusOptions = [
  { value: "actief", label: "Actief" },
  { value: "onderhoud", label: "In onderhoud" },
  { value: "inactief", label: "Inactief" },
];

export interface VoertuigFormData {
  kenteken: string;
  merk: string;
  model: string;
  type: string;
  bouwjaar?: number;
  kleur?: string;
  kmStand?: number;
  status: "actief" | "inactief" | "onderhoud";
  notities?: string;
  // Compliance fields
  apkVervaldatum?: number;
  verzekeringsVervaldatum?: number;
  verzekeraar?: string;
  polisnummer?: string;
}

export interface Voertuig extends VoertuigFormData {
  _id: Id<"voertuigen">;
}

/**
 * Format Dutch license plate to standard format (XX-XX-XX or XX-XXX-X, etc.)
 * Converts to uppercase and adds dashes in appropriate places
 */
function formatKenteken(value: string): string {
  // Remove all non-alphanumeric characters and convert to uppercase
  const cleaned = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  // Dutch license plates are typically 6 characters
  // Common formats: XX-XX-XX, XX-XXX-X, X-XXX-XX, etc.
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
  if (cleaned.length <= 6)
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4)}`;

  // For longer plates, just format as XX-XX-XX...
  return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4, 6)}`;
}

/**
 * Validate Dutch license plate format
 * Returns true if valid, false if invalid
 */
function validateKenteken(kenteken: string): boolean {
  // Remove dashes for validation
  const cleaned = kenteken.replace(/-/g, "");

  // Dutch plates are 6 characters
  if (cleaned.length !== 6) return false;

  // Must be alphanumeric
  if (!/^[A-Z0-9]+$/.test(cleaned)) return false;

  return true;
}

// Zod schema for voertuig form
const voertuigFormSchema = z.object({
  kenteken: z.string().min(1, "Kenteken is verplicht").refine(
    (val) => validateKenteken(val),
    { message: "Ongeldig kenteken formaat (bijv. AB-12-CD)" }
  ),
  merk: z.string().min(1, "Merk is verplicht"),
  model: z.string().min(1, "Model is verplicht"),
  type: z.string().min(1, "Type is verplicht"),
  bouwjaar: z.number().min(1990).max(new Date().getFullYear() + 1).optional(),
  kleur: z.string().optional(),
  kmStand: z.number().min(0).optional(),
  status: z.enum(["actief", "inactief", "onderhoud"]),
  notities: z.string().optional(),
  apkVervaldatum: z.date().optional(),
  verzekeringsVervaldatum: z.date().optional(),
  verzekeraar: z.string().optional(),
  polisnummer: z.string().optional(),
});

type VoertuigFormSchemaData = z.infer<typeof voertuigFormSchema>;

interface VoertuigFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Voertuig | null;
  onSuccess?: () => void;
}

export function VoertuigForm({
  open,
  onOpenChange,
  initialData,
  onSuccess,
}: VoertuigFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const createVoertuig = useMutation(api.voertuigen.create);
  const updateVoertuig = useMutation(api.voertuigen.update);

  const isEditMode = !!initialData;

  const form = useForm<VoertuigFormSchemaData>({
    resolver: zodResolver(voertuigFormSchema),
    defaultValues: {
      kenteken: "",
      merk: "",
      model: "",
      type: "",
      bouwjaar: undefined,
      kleur: "",
      kmStand: undefined,
      status: "actief",
      notities: "",
      apkVervaldatum: undefined,
      verzekeringsVervaldatum: undefined,
      verzekeraar: "",
      polisnummer: "",
    },
  });

  // Reset form when dialog opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      if (initialData) {
        form.reset({
          kenteken: initialData.kenteken,
          merk: initialData.merk,
          model: initialData.model,
          type: initialData.type,
          bouwjaar: initialData.bouwjaar,
          kleur: initialData.kleur || "",
          kmStand: initialData.kmStand,
          status: initialData.status,
          notities: initialData.notities || "",
          apkVervaldatum: (initialData as { apkVervaldatum?: number }).apkVervaldatum
            ? new Date((initialData as { apkVervaldatum?: number }).apkVervaldatum!)
            : undefined,
          verzekeringsVervaldatum: (initialData as { verzekeringsVervaldatum?: number }).verzekeringsVervaldatum
            ? new Date((initialData as { verzekeringsVervaldatum?: number }).verzekeringsVervaldatum!)
            : undefined,
          verzekeraar: (initialData as { verzekeraar?: string }).verzekeraar || "",
          polisnummer: (initialData as { polisnummer?: string }).polisnummer || "",
        });
      } else {
        form.reset({
          kenteken: "",
          merk: "",
          model: "",
          type: "",
          bouwjaar: undefined,
          kleur: "",
          kmStand: undefined,
          status: "actief",
          notities: "",
          apkVervaldatum: undefined,
          verzekeringsVervaldatum: undefined,
          verzekeraar: "",
          polisnummer: "",
        });
      }
    }
  }, [initialData, open, form]);

  const handleFormSubmit = async (data: VoertuigFormSchemaData) => {
    setIsLoading(true);

    try {
      if (isEditMode && initialData) {
        await updateVoertuig({
          id: initialData._id,
          kenteken: data.kenteken,
          merk: data.merk,
          model: data.model,
          type: data.type,
          bouwjaar: data.bouwjaar,
          kleur: data.kleur || undefined,
          kmStand: data.kmStand,
          status: data.status,
          notities: data.notities || undefined,
          apkVervaldatum: data.apkVervaldatum?.getTime(),
          verzekeringsVervaldatum: data.verzekeringsVervaldatum?.getTime(),
          verzekeraar: data.verzekeraar || undefined,
          polisnummer: data.polisnummer || undefined,
        });
        showSuccessToast("Voertuig bijgewerkt");
      } else {
        await createVoertuig({
          kenteken: data.kenteken,
          merk: data.merk,
          model: data.model,
          type: data.type,
          bouwjaar: data.bouwjaar,
          kleur: data.kleur || undefined,
          kmStand: data.kmStand,
          status: data.status,
          notities: data.notities || undefined,
          apkVervaldatum: data.apkVervaldatum?.getTime(),
          verzekeringsVervaldatum: data.verzekeringsVervaldatum?.getTime(),
          verzekeraar: data.verzekeraar || undefined,
          polisnummer: data.polisnummer || undefined,
        });
        showSuccessToast("Voertuig toegevoegd");
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving voertuig:", error);
      showErrorToast(
        isEditMode
          ? "Fout bij bijwerken voertuig"
          : "Fout bij toevoegen voertuig",
        { description: getMutationErrorMessage(error) }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Voertuig bewerken" : "Nieuw voertuig"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Pas de gegevens van het voertuig aan"
              : "Voeg een voertuig toe aan je wagenpark"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)}>
            <div className="grid gap-4 py-4">
              {/* Kenteken */}
              <FormField
                control={form.control}
                name="kenteken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kenteken *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(e) => {
                          const formatted = formatKenteken(e.target.value);
                          field.onChange(formatted);
                        }}
                        placeholder="XX-XX-XX"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Merk en Model */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="merk"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Merk *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecteer merk" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper" sideOffset={4}>
                          {vehicleBrands.map((brand) => (
                            <SelectItem key={brand} value={brand}>
                              {brand}
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
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Bijv. Sprinter, Transporter"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Type */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecteer type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent position="popper" sideOffset={4}>
                        {vehicleTypes.map((type) => (
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

              {/* Bouwjaar en Kleur */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="bouwjaar"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bouwjaar</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1990"
                          max={new Date().getFullYear() + 1}
                          value={field.value || ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                ? parseInt(e.target.value)
                                : undefined
                            )
                          }
                          placeholder={`Bijv. ${new Date().getFullYear()}`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="kleur"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kleur</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Bijv. Wit, Grijs" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* KM Stand */}
              <FormField
                control={form.control}
                name="kmStand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>KM Stand</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={field.value || ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value
                              ? parseInt(e.target.value)
                              : undefined
                          )
                        }
                        placeholder="Bijv. 125000"
                      />
                    </FormControl>
                    <FormDescription>
                      Huidige kilometerstand van het voertuig
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent position="popper" sideOffset={4}>
                        {statusOptions.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Compliance Section */}
              <Separator className="my-2" />
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">
                  APK & Verzekering
                </h4>

                {/* APK Vervaldatum */}
                <FormField
                  control={form.control}
                  name="apkVervaldatum"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>APK Vervaldatum</FormLabel>
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
                                format(field.value, "d MMMM yyyy", {
                                  locale: nl,
                                })
                              ) : (
                                <span>Selecteer APK vervaldatum</span>
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
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Verzekering Vervaldatum */}
                <FormField
                  control={form.control}
                  name="verzekeringsVervaldatum"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Verzekering Vervaldatum</FormLabel>
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
                                format(field.value, "d MMMM yyyy", {
                                  locale: nl,
                                })
                              ) : (
                                <span>Selecteer verzekering vervaldatum</span>
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
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Verzekeraar en Polisnummer */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="verzekeraar"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Verzekeraar</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Bijv. ANWB, Centraal Beheer"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="polisnummer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Polisnummer</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Bijv. 123456789" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator className="my-2" />

              {/* Notities */}
              <FormField
                control={form.control}
                name="notities"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notities</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Eventuele opmerkingen over het voertuig..."
                        rows={3}
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
                {isEditMode ? "Bijwerken" : "Toevoegen"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
