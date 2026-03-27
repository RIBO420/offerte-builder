"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { useVerlof, type VerlofType } from "@/hooks/use-verlof";
import { useCurrentUser } from "@/hooks/use-current-user";
import { showSuccessToast, showErrorToast } from "@/lib/toast-utils";

const VERLOF_TYPES: { value: VerlofType; label: string }[] = [
  { value: "vakantie", label: "Vakantie" },
  { value: "bijzonder", label: "Bijzonder verlof" },
  { value: "onbetaald", label: "Onbetaald verlof" },
  { value: "compensatie", label: "Compensatie (ATV/ADV)" },
];

// Zod schema
const verlofFormSchema = z.object({
  medewerkerId: z.string().min(1, "Selecteer een medewerker"),
  type: z.enum(["vakantie", "bijzonder", "onbetaald", "compensatie"]),
  startDatum: z.string().min(1, "Vul een startdatum in"),
  eindDatum: z.string().min(1, "Vul een einddatum in"),
  aantalDagen: z.number().min(0.5, "Aantal dagen moet groter zijn dan 0"),
  opmerking: z.string().optional(),
});

type VerlofFormData = z.infer<typeof verlofFormSchema>;

interface VerlofFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    _id: Id<"verlofaanvragen">;
    medewerkerId: Id<"medewerkers">;
    startDatum: string;
    eindDatum: string;
    aantalDagen: number;
    type: VerlofType;
    opmerking?: string;
  };
  defaultMedewerkerId?: Id<"medewerkers">;
}

function calculateWorkingDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const startDate = new Date(start);
  const endDate = new Date(end);
  let days = 0;
  const current = new Date(startDate);
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      days++;
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
}

export function VerlofForm({
  open,
  onOpenChange,
  initialData,
  defaultMedewerkerId,
}: VerlofFormProps) {
  const { user } = useCurrentUser();
  const { create, update } = useVerlof();
  const [isLoading, setIsLoading] = useState(false);

  const isEditMode = !!initialData;

  // Load medewerkers for the dropdown (admin only)
  const medewerkers = useQuery(
    api.medewerkers.list,
    user?._id ? { isActief: true } : "skip"
  );
  const medewerkersList = useMemo(() => medewerkers ?? [], [medewerkers]);

  const form = useForm<VerlofFormData>({
    resolver: zodResolver(verlofFormSchema),
    defaultValues: {
      medewerkerId: defaultMedewerkerId?.toString() ?? "",
      type: "vakantie",
      startDatum: "",
      eindDatum: "",
      aantalDagen: 0,
      opmerking: "",
    },
  });

  // Reset form on open
  useEffect(() => {
    if (open) {
      if (initialData) {
        form.reset({
          medewerkerId: initialData.medewerkerId.toString(),
          startDatum: initialData.startDatum,
          eindDatum: initialData.eindDatum,
          aantalDagen: initialData.aantalDagen,
          type: initialData.type,
          opmerking: initialData.opmerking ?? "",
        });
      } else {
        form.reset({
          medewerkerId: defaultMedewerkerId?.toString() ?? "",
          startDatum: "",
          eindDatum: "",
          aantalDagen: 0,
          type: "vakantie",
          opmerking: "",
        });
      }
    }
  }, [open, initialData, defaultMedewerkerId, form]);

  // Auto-calculate working days when dates change
  const startDatum = form.watch("startDatum");
  const eindDatum = form.watch("eindDatum");

  useEffect(() => {
    if (startDatum && eindDatum) {
      form.setValue("aantalDagen", calculateWorkingDays(startDatum, eindDatum));
    }
  }, [startDatum, eindDatum, form]);

  const handleFormSubmit = async (data: VerlofFormData) => {
    setIsLoading(true);

    try {
      if (isEditMode) {
        await update(initialData._id, {
          startDatum: data.startDatum,
          eindDatum: data.eindDatum,
          aantalDagen: data.aantalDagen,
          type: data.type,
          opmerking: data.opmerking || undefined,
        });
        showSuccessToast("Verlofaanvraag bijgewerkt");
      } else {
        await create({
          medewerkerId: data.medewerkerId as Id<"medewerkers">,
          startDatum: data.startDatum,
          eindDatum: data.eindDatum,
          aantalDagen: data.aantalDagen,
          type: data.type,
          opmerking: data.opmerking || undefined,
        });
        showSuccessToast("Verlofaanvraag ingediend");
      }
      onOpenChange(false);
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Er is een fout opgetreden"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Verlofaanvraag bewerken" : "Nieuw verlofaanvraag"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleFormSubmit)}
            className="space-y-4"
          >
            {/* Medewerker selector */}
            <FormField
              control={form.control}
              name="medewerkerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medewerker</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isEditMode}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecteer medewerker" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {medewerkersList.map((m) => (
                        <SelectItem key={m._id} value={m._id}>
                          {m.naam}
                          {m.functie ? ` — ${m.functie}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type verlof</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {VERLOF_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date range */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startDatum"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Startdatum</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="eindDatum"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Einddatum</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        min={startDatum}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Calculated days */}
            <FormField
              control={form.control}
              name="aantalDagen"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aantal werkdagen</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    Automatisch berekend op basis van werkdagen (ma-vr). Pas aan
                    voor halve dagen.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Opmerking */}
            <FormField
              control={form.control}
              name="opmerking"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Opmerking (optioneel)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Reden of toelichting..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuleren
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEditMode ? "Opslaan" : "Indienen"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
