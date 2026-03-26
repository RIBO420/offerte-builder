"use client";

import { useState, useCallback, useEffect } from "react";
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
} from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, CalendarIcon } from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/lib/toast-utils";
import { getMutationErrorMessage } from "@/lib/error-handling";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { nl } from "@/lib/date-locale";
import { Id } from "../../../convex/_generated/dataModel";
import type { OnderhoudType, OnderhoudStatus, OnderhoudRecord } from "@/hooks/use-voertuig-details";

// Onderhoud type options
const onderhoudTypes: { value: OnderhoudType; label: string }[] = [
  { value: "olie", label: "Olieverversing" },
  { value: "apk", label: "APK keuring" },
  { value: "banden", label: "Banden" },
  { value: "inspectie", label: "Inspectie" },
  { value: "reparatie", label: "Reparatie" },
  { value: "overig", label: "Overig" },
];

// Status options
const statusOptions: { value: OnderhoudStatus; label: string }[] = [
  { value: "gepland", label: "Gepland" },
  { value: "in_uitvoering", label: "In uitvoering" },
  { value: "voltooid", label: "Voltooid" },
];

// Zod schema
const onderhoudFormSchema = z.object({
  type: z.enum(["olie", "apk", "banden", "inspectie", "reparatie", "overig"]),
  omschrijving: z.string().min(1, "Omschrijving is verplicht"),
  geplanteDatum: z.date({ message: "Geplande datum is verplicht" }),
  voltooidDatum: z.date().optional(),
  kosten: z.string().optional(),
  status: z.enum(["gepland", "in_uitvoering", "voltooid"]),
  notities: z.string().optional(),
});

type OnderhoudFormData = z.infer<typeof onderhoudFormSchema>;

interface OnderhoudFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voertuigId: Id<"voertuigen">;
  initialData?: OnderhoudRecord | null;
  onSubmit: (data: {
    voertuigId: Id<"voertuigen">;
    type: OnderhoudType;
    omschrijving: string;
    geplanteDatum: number;
    voltooidDatum?: number;
    kosten?: number;
    status?: OnderhoudStatus;
    notities?: string;
  }) => Promise<unknown>;
  onUpdate?: (
    id: Id<"voertuigOnderhoud">,
    data: {
      type?: OnderhoudType;
      omschrijving?: string;
      geplanteDatum?: number;
      voltooidDatum?: number;
      kosten?: number;
      status?: OnderhoudStatus;
      notities?: string;
    }
  ) => Promise<unknown>;
}

export function OnderhoudForm({
  open,
  onOpenChange,
  voertuigId,
  initialData,
  onSubmit,
  onUpdate,
}: OnderhoudFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const isEditMode = !!initialData;

  const form = useForm<OnderhoudFormData>({
    resolver: zodResolver(onderhoudFormSchema),
    defaultValues: {
      type: "overig",
      omschrijving: "",
      geplanteDatum: undefined,
      voltooidDatum: undefined,
      kosten: "",
      status: "gepland",
      notities: "",
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (initialData) {
        form.reset({
          type: initialData.type,
          omschrijving: initialData.omschrijving,
          geplanteDatum: new Date(initialData.geplanteDatum),
          voltooidDatum: initialData.voltooidDatum
            ? new Date(initialData.voltooidDatum)
            : undefined,
          kosten: initialData.kosten?.toString() ?? "",
          status: initialData.status,
          notities: initialData.notities ?? "",
        });
      } else {
        form.reset({
          type: "overig",
          omschrijving: "",
          geplanteDatum: undefined,
          voltooidDatum: undefined,
          kosten: "",
          status: "gepland",
          notities: "",
        });
      }
    }
  }, [open, initialData, form]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleFormSubmit = async (data: OnderhoudFormData) => {
    setIsLoading(true);

    try {
      const submitData = {
        type: data.type,
        omschrijving: data.omschrijving.trim(),
        geplanteDatum: data.geplanteDatum.getTime(),
        voltooidDatum: data.voltooidDatum?.getTime(),
        kosten: data.kosten ? parseFloat(data.kosten) : undefined,
        status: data.status,
        notities: data.notities?.trim() || undefined,
      };

      if (isEditMode && initialData && onUpdate) {
        await onUpdate(initialData._id, submitData);
        showSuccessToast("Onderhoud bijgewerkt");
      } else {
        await onSubmit({
          voertuigId,
          ...submitData,
        });
        showSuccessToast("Onderhoud toegevoegd");
      }

      handleClose();
    } catch (error) {
      console.error("Error saving onderhoud:", error);
      showErrorToast(
        isEditMode
          ? "Fout bij bijwerken onderhoud"
          : "Fout bij toevoegen onderhoud",
        { description: getMutationErrorMessage(error) }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const statusValue = form.watch("status");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Onderhoud bewerken" : "Onderhoud plannen"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Pas de gegevens van het onderhoud aan"
              : "Plan een nieuwe onderhoudsbeurt"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)}>
            <div className="grid gap-4 py-4">
              {/* Type */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type onderhoud *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecteer type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent position="popper" sideOffset={4}>
                        {onderhoudTypes.map((type) => (
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

              {/* Omschrijving */}
              <FormField
                control={form.control}
                name="omschrijving"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Omschrijving *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Bijv. Jaarlijkse APK keuring"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Geplande Datum */}
              <FormField
                control={form.control}
                name="geplanteDatum"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Geplande datum *</FormLabel>
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
                              format(field.value, "d MMMM yyyy", { locale: nl })
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
                        />
                      </PopoverContent>
                    </Popover>
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

              {/* Voltooid Datum (only show if status is voltooid) */}
              {statusValue === "voltooid" && (
                <FormField
                  control={form.control}
                  name="voltooidDatum"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Voltooid op</FormLabel>
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
                                format(field.value, "d MMMM yyyy", { locale: nl })
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
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Kosten */}
              <FormField
                control={form.control}
                name="kosten"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kosten (EUR)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0,00"
                      />
                    </FormControl>
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
