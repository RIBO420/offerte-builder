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
import { Loader2, Calendar } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { showSuccessToast, showErrorToast } from "@/lib/toast-utils";
import { getMutationErrorMessage } from "@/lib/error-handling";
import { format } from "date-fns";
import { nl } from "@/lib/date-locale";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Categorie options
const categorieOptions = [
  { value: "motorgereedschap", label: "Motorgereedschap" },
  { value: "handgereedschap", label: "Handgereedschap" },
  { value: "veiligheid", label: "Veiligheid" },
  { value: "overig", label: "Overig" },
] as const;

// Status options
const statusOptions = [
  { value: "aanwezig", label: "Aanwezig" },
  { value: "vermist", label: "Vermist" },
  { value: "defect", label: "Defect" },
] as const;

type Categorie = (typeof categorieOptions)[number]["value"];
type UitrustingStatus = (typeof statusOptions)[number]["value"];

export interface UitrustingFormData {
  voertuigId: Id<"voertuigen">;
  naam: string;
  categorie: Categorie;
  hoeveelheid: number;
  serienummer?: string;
  aanschafDatum?: number;
  aanschafPrijs?: number;
  status: UitrustingStatus;
  notities?: string;
}

export interface Uitrusting extends UitrustingFormData {
  _id: Id<"voertuigUitrusting">;
}

// Zod schema
const uitrustingFormSchema = z.object({
  voertuigId: z.string().min(1, "Selecteer een voertuig"),
  naam: z.string().min(1, "Naam is verplicht"),
  categorie: z.enum(["motorgereedschap", "handgereedschap", "veiligheid", "overig"]),
  hoeveelheid: z.number().min(1, "Hoeveelheid moet minimaal 1 zijn"),
  serienummer: z.string().optional(),
  aanschafDatum: z.date().optional(),
  aanschafPrijs: z.number().min(0).optional(),
  status: z.enum(["aanwezig", "vermist", "defect"]),
  notities: z.string().optional(),
});

type UitrustingFormSchemaData = z.infer<typeof uitrustingFormSchema>;

interface UitrustingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voertuigId?: Id<"voertuigen">;
  initialData?: Uitrusting | null;
  onSuccess?: () => void;
}

export function UitrustingForm({
  open,
  onOpenChange,
  voertuigId: propVoertuigId,
  initialData,
  onSuccess,
}: UitrustingFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const voertuigen = useQuery(api.voertuigen.getActive);
  const createUitrusting = useMutation(api.voertuigUitrusting.create);
  const updateUitrusting = useMutation(api.voertuigUitrusting.update);

  const isEditMode = !!initialData;

  const form = useForm<UitrustingFormSchemaData>({
    resolver: zodResolver(uitrustingFormSchema),
    defaultValues: {
      voertuigId: propVoertuigId || "",
      naam: "",
      categorie: "handgereedschap",
      hoeveelheid: 1,
      serienummer: "",
      aanschafDatum: undefined,
      aanschafPrijs: undefined,
      status: "aanwezig",
      notities: "",
    },
  });

  // Reset form when dialog opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      if (initialData) {
        form.reset({
          voertuigId: initialData.voertuigId,
          naam: initialData.naam,
          categorie: initialData.categorie,
          hoeveelheid: initialData.hoeveelheid,
          serienummer: initialData.serienummer || "",
          aanschafDatum: initialData.aanschafDatum
            ? new Date(initialData.aanschafDatum)
            : undefined,
          aanschafPrijs: initialData.aanschafPrijs,
          status: initialData.status,
          notities: initialData.notities || "",
        });
      } else {
        form.reset({
          voertuigId: propVoertuigId || "",
          naam: "",
          categorie: "handgereedschap",
          hoeveelheid: 1,
          serienummer: "",
          aanschafDatum: undefined,
          aanschafPrijs: undefined,
          status: "aanwezig",
          notities: "",
        });
      }
    }
  }, [initialData, propVoertuigId, open, form]);

  const handleFormSubmit = async (data: UitrustingFormSchemaData) => {
    setIsLoading(true);

    try {
      if (isEditMode && initialData) {
        await updateUitrusting({
          id: initialData._id,
          voertuigId: data.voertuigId as Id<"voertuigen">,
          naam: data.naam,
          categorie: data.categorie,
          hoeveelheid: data.hoeveelheid,
          serienummer: data.serienummer || undefined,
          aanschafDatum: data.aanschafDatum?.getTime(),
          aanschafPrijs: data.aanschafPrijs,
          status: data.status,
          notities: data.notities || undefined,
        });
        showSuccessToast("Uitrusting bijgewerkt");
      } else {
        await createUitrusting({
          voertuigId: data.voertuigId as Id<"voertuigen">,
          naam: data.naam,
          categorie: data.categorie,
          hoeveelheid: data.hoeveelheid,
          serienummer: data.serienummer || undefined,
          aanschafDatum: data.aanschafDatum?.getTime(),
          aanschafPrijs: data.aanschafPrijs,
          status: data.status,
          notities: data.notities || undefined,
        });
        showSuccessToast("Uitrusting toegevoegd");
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving uitrusting:", error);
      showErrorToast(
        isEditMode
          ? "Fout bij bijwerken uitrusting"
          : "Fout bij toevoegen uitrusting",
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
            {isEditMode ? "Uitrusting bewerken" : "Nieuwe uitrusting"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Pas de uitrusting gegevens aan"
              : "Voeg gereedschap of uitrusting toe aan een voertuig"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)}>
            <div className="grid gap-4 py-4">
              {/* Voertuig selectie */}
              <FormField
                control={form.control}
                name="voertuigId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Voertuig *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecteer voertuig" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent position="popper" sideOffset={4}>
                        {voertuigen?.map((v) => (
                          <SelectItem key={v._id} value={v._id}>
                            {v.kenteken} - {v.merk} {v.model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isEditMode && (
                      <FormDescription>
                        Je kunt uitrusting verplaatsen naar een ander voertuig
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Naam */}
              <FormField
                control={form.control}
                name="naam"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Naam *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Bijv. Kettingzaag Stihl MS 261"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Categorie en Hoeveelheid */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="categorie"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categorie *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper" sideOffset={4}>
                          {categorieOptions.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
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
                  name="hoeveelheid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hoeveelheid *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          value={field.value}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 1)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Serienummer */}
              <FormField
                control={form.control}
                name="serienummer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serienummer</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Optioneel" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Aanschaf datum en prijs */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="aanschafDatum"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aanschafdatum</FormLabel>
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
                              <Calendar className="mr-2 h-4 w-4" />
                              {field.value ? (
                                format(field.value, "d MMM yyyy", { locale: nl })
                              ) : (
                                <span>Selecteer</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                            locale={nl}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="aanschafPrijs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aanschafprijs</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-muted-foreground">
                            &euro;
                          </span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="pl-7"
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value
                                  ? parseFloat(e.target.value)
                                  : undefined
                              )
                            }
                            placeholder="0,00"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                        placeholder="Eventuele opmerkingen..."
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
