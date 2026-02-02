"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, CalendarIcon } from "lucide-react";
import { showSuccessToast, showErrorToast, showWarningToast } from "@/lib/toast-utils";
import { getMutationErrorMessage } from "@/lib/error-handling";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
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

interface FormData {
  type: OnderhoudType;
  omschrijving: string;
  geplanteDatum: Date | undefined;
  voltooidDatum: Date | undefined;
  kosten: string;
  status: OnderhoudStatus;
  notities: string;
}

const defaultFormData: FormData = {
  type: "overig",
  omschrijving: "",
  geplanteDatum: undefined,
  voltooidDatum: undefined,
  kosten: "",
  status: "gepland",
  notities: "",
};

export function OnderhoudForm({
  open,
  onOpenChange,
  voertuigId,
  initialData,
  onSubmit,
  onUpdate,
}: OnderhoudFormProps) {
  const [formData, setFormData] = useState<FormData>(() => {
    if (initialData) {
      return {
        type: initialData.type,
        omschrijving: initialData.omschrijving,
        geplanteDatum: new Date(initialData.geplanteDatum),
        voltooidDatum: initialData.voltooidDatum
          ? new Date(initialData.voltooidDatum)
          : undefined,
        kosten: initialData.kosten?.toString() ?? "",
        status: initialData.status,
        notities: initialData.notities ?? "",
      };
    }
    return defaultFormData;
  });

  const [isLoading, setIsLoading] = useState(false);

  const isEditMode = !!initialData;

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setFormData(defaultFormData);
  }, [onOpenChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.geplanteDatum) {
      showWarningToast("Selecteer een datum");
      return;
    }

    if (!formData.omschrijving.trim()) {
      showWarningToast("Vul een omschrijving in");
      return;
    }

    setIsLoading(true);

    try {
      const data = {
        type: formData.type,
        omschrijving: formData.omschrijving.trim(),
        geplanteDatum: formData.geplanteDatum.getTime(),
        voltooidDatum: formData.voltooidDatum?.getTime(),
        kosten: formData.kosten ? parseFloat(formData.kosten) : undefined,
        status: formData.status,
        notities: formData.notities.trim() || undefined,
      };

      if (isEditMode && initialData && onUpdate) {
        await onUpdate(initialData._id, data);
        showSuccessToast("Onderhoud bijgewerkt");
      } else {
        await onSubmit({
          voertuigId,
          ...data,
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

  const isFormValid =
    formData.omschrijving.trim() && formData.geplanteDatum;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
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

          <div className="grid gap-4 py-4">
            {/* Type */}
            <div className="grid gap-2">
              <Label htmlFor="type">Type onderhoud *</Label>
              <Select
                value={formData.type}
                onValueChange={(value: OnderhoudType) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer type" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  {onderhoudTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Omschrijving */}
            <div className="grid gap-2">
              <Label htmlFor="omschrijving">Omschrijving *</Label>
              <Input
                id="omschrijving"
                value={formData.omschrijving}
                onChange={(e) =>
                  setFormData({ ...formData, omschrijving: e.target.value })
                }
                placeholder="Bijv. Jaarlijkse APK keuring"
                required
              />
            </div>

            {/* Geplande Datum */}
            <div className="grid gap-2">
              <Label>Geplande datum *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !formData.geplanteDatum && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.geplanteDatum ? (
                      format(formData.geplanteDatum, "d MMMM yyyy", { locale: nl })
                    ) : (
                      <span>Selecteer datum</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.geplanteDatum}
                    onSelect={(date) =>
                      setFormData({ ...formData, geplanteDatum: date })
                    }
                    locale={nl}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Status */}
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: OnderhoudStatus) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Voltooid Datum (only show if status is voltooid) */}
            {formData.status === "voltooid" && (
              <div className="grid gap-2">
                <Label>Voltooid op</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !formData.voltooidDatum && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.voltooidDatum ? (
                        format(formData.voltooidDatum, "d MMMM yyyy", { locale: nl })
                      ) : (
                        <span>Selecteer datum</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.voltooidDatum}
                      onSelect={(date) =>
                        setFormData({ ...formData, voltooidDatum: date })
                      }
                      locale={nl}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Kosten */}
            <div className="grid gap-2">
              <Label htmlFor="kosten">Kosten (EUR)</Label>
              <Input
                id="kosten"
                type="number"
                min="0"
                step="0.01"
                value={formData.kosten}
                onChange={(e) =>
                  setFormData({ ...formData, kosten: e.target.value })
                }
                placeholder="0,00"
              />
            </div>

            {/* Notities */}
            <div className="grid gap-2">
              <Label htmlFor="notities">Notities</Label>
              <Textarea
                id="notities"
                value={formData.notities}
                onChange={(e) =>
                  setFormData({ ...formData, notities: e.target.value })
                }
                placeholder="Eventuele opmerkingen..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Annuleren
            </Button>
            <Button type="submit" disabled={isLoading || !isFormValid}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? "Bijwerken" : "Toevoegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
