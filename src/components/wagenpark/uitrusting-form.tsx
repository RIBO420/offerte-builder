"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Loader2, Calendar } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
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

interface UitrustingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voertuigId?: Id<"voertuigen">;
  initialData?: Uitrusting | null;
  onSuccess?: () => void;
}

const defaultFormData: Omit<UitrustingFormData, "voertuigId"> = {
  naam: "",
  categorie: "handgereedschap",
  hoeveelheid: 1,
  serienummer: "",
  aanschafDatum: undefined,
  aanschafPrijs: undefined,
  status: "aanwezig",
  notities: "",
};

export function UitrustingForm({
  open,
  onOpenChange,
  voertuigId: propVoertuigId,
  initialData,
  onSuccess,
}: UitrustingFormProps) {
  const [formData, setFormData] = useState<Omit<UitrustingFormData, "voertuigId"> & { voertuigId?: Id<"voertuigen"> }>({
    ...defaultFormData,
    voertuigId: propVoertuigId,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const voertuigen = useQuery(api.voertuigen.getActive);
  const createUitrusting = useMutation(api.voertuigUitrusting.create);
  const updateUitrusting = useMutation(api.voertuigUitrusting.update);

  const isEditMode = !!initialData;

  // Reset form when dialog opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData({
          voertuigId: initialData.voertuigId,
          naam: initialData.naam,
          categorie: initialData.categorie,
          hoeveelheid: initialData.hoeveelheid,
          serienummer: initialData.serienummer || "",
          aanschafDatum: initialData.aanschafDatum,
          aanschafPrijs: initialData.aanschafPrijs,
          status: initialData.status,
          notities: initialData.notities || "",
        });
        setSelectedDate(
          initialData.aanschafDatum ? new Date(initialData.aanschafDatum) : undefined
        );
      } else {
        setFormData({
          ...defaultFormData,
          voertuigId: propVoertuigId,
        });
        setSelectedDate(undefined);
      }
    }
  }, [initialData, propVoertuigId, open]);

  const handleDateSelect = useCallback((date: Date | undefined) => {
    setSelectedDate(date);
    setFormData((prev) => ({
      ...prev,
      aanschafDatum: date ? date.getTime() : undefined,
    }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.voertuigId) {
      toast.error("Selecteer een voertuig");
      return;
    }

    if (!formData.naam.trim()) {
      toast.error("Naam is verplicht");
      return;
    }

    if (formData.hoeveelheid < 1) {
      toast.error("Hoeveelheid moet minimaal 1 zijn");
      return;
    }

    setIsLoading(true);

    try {
      if (isEditMode && initialData) {
        await updateUitrusting({
          id: initialData._id,
          voertuigId: formData.voertuigId,
          naam: formData.naam,
          categorie: formData.categorie,
          hoeveelheid: formData.hoeveelheid,
          serienummer: formData.serienummer || undefined,
          aanschafDatum: formData.aanschafDatum,
          aanschafPrijs: formData.aanschafPrijs,
          status: formData.status,
          notities: formData.notities || undefined,
        });
        toast.success("Uitrusting bijgewerkt");
      } else {
        await createUitrusting({
          voertuigId: formData.voertuigId!,
          naam: formData.naam,
          categorie: formData.categorie,
          hoeveelheid: formData.hoeveelheid,
          serienummer: formData.serienummer || undefined,
          aanschafDatum: formData.aanschafDatum,
          aanschafPrijs: formData.aanschafPrijs,
          status: formData.status,
          notities: formData.notities || undefined,
        });
        toast.success("Uitrusting toegevoegd");
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving uitrusting:", error);
      toast.error(
        isEditMode
          ? "Fout bij bijwerken uitrusting"
          : "Fout bij toevoegen uitrusting"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setFormData({ ...defaultFormData, voertuigId: propVoertuigId });
    setSelectedDate(undefined);
  }, [onOpenChange, propVoertuigId]);

  const isFormValid =
    formData.voertuigId &&
    formData.naam.trim() &&
    formData.hoeveelheid >= 1;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
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

          <div className="grid gap-4 py-4">
            {/* Voertuig selectie */}
            <div className="grid gap-2">
              <Label htmlFor="voertuig">Voertuig *</Label>
              <Select
                value={formData.voertuigId}
                onValueChange={(value) =>
                  setFormData({ ...formData, voertuigId: value as Id<"voertuigen"> })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer voertuig" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  {voertuigen?.map((v) => (
                    <SelectItem key={v._id} value={v._id}>
                      {v.kenteken} - {v.merk} {v.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isEditMode && (
                <p className="text-xs text-muted-foreground">
                  Je kunt uitrusting verplaatsen naar een ander voertuig
                </p>
              )}
            </div>

            {/* Naam */}
            <div className="grid gap-2">
              <Label htmlFor="naam">Naam *</Label>
              <Input
                id="naam"
                value={formData.naam}
                onChange={(e) =>
                  setFormData({ ...formData, naam: e.target.value })
                }
                placeholder="Bijv. Kettingzaag Stihl MS 261"
                required
              />
            </div>

            {/* Categorie en Hoeveelheid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="categorie">Categorie *</Label>
                <Select
                  value={formData.categorie}
                  onValueChange={(value: Categorie) =>
                    setFormData({ ...formData, categorie: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    {categorieOptions.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="hoeveelheid">Hoeveelheid *</Label>
                <Input
                  id="hoeveelheid"
                  type="number"
                  min="1"
                  value={formData.hoeveelheid}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      hoeveelheid: parseInt(e.target.value) || 1,
                    })
                  }
                  required
                />
              </div>
            </div>

            {/* Serienummer */}
            <div className="grid gap-2">
              <Label htmlFor="serienummer">Serienummer</Label>
              <Input
                id="serienummer"
                value={formData.serienummer}
                onChange={(e) =>
                  setFormData({ ...formData, serienummer: e.target.value })
                }
                placeholder="Optioneel"
              />
            </div>

            {/* Aanschaf datum en prijs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Aanschafdatum</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {selectedDate ? (
                        format(selectedDate, "d MMM yyyy", { locale: nl })
                      ) : (
                        <span>Selecteer</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
                      initialFocus
                      locale={nl}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="aanschafPrijs">Aanschafprijs</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">
                    &euro;
                  </span>
                  <Input
                    id="aanschafPrijs"
                    type="number"
                    min="0"
                    step="0.01"
                    className="pl-7"
                    value={formData.aanschafPrijs ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        aanschafPrijs: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      })
                    }
                    placeholder="0,00"
                  />
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: UitrustingStatus) =>
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
