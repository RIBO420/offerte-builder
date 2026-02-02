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
import { Switch } from "@/components/ui/switch";
import { Loader2, Calendar } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { showSuccessToast, showErrorToast, showWarningToast } from "@/lib/toast-utils";
import { getMutationErrorMessage } from "@/lib/error-handling";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Ernst options
const ernstOptions = [
  { value: "klein", label: "Klein" },
  { value: "gemiddeld", label: "Gemiddeld" },
  { value: "groot", label: "Groot" },
] as const;

// Schade type options
const schadeTypeOptions = [
  { value: "deuk", label: "Deuk" },
  { value: "kras", label: "Kras" },
  { value: "breuk", label: "Breuk" },
  { value: "mechanisch", label: "Mechanisch" },
  { value: "overig", label: "Overig" },
] as const;

// Status options
const statusOptions = [
  { value: "nieuw", label: "Nieuw" },
  { value: "in_reparatie", label: "In reparatie" },
  { value: "afgehandeld", label: "Afgehandeld" },
] as const;

type Ernst = (typeof ernstOptions)[number]["value"];
type SchadeType = (typeof schadeTypeOptions)[number]["value"];
type SchadeStatus = (typeof statusOptions)[number]["value"];

export interface SchadeFormData {
  voertuigId: Id<"voertuigen">;
  datum: number;
  beschrijving: string;
  ernst: Ernst;
  schadeType: SchadeType;
  fotoUrls?: string[];
  gerapporteerdDoor: string;
  status: SchadeStatus;
  reparatieKosten?: number;
  verzekeringsClaim?: boolean;
  claimNummer?: string;
}

export interface Schade extends SchadeFormData {
  _id: Id<"voertuigSchades">;
}

interface SchadeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voertuigId?: Id<"voertuigen">;
  initialData?: Schade | null;
  onSuccess?: () => void;
}

const defaultFormData: Omit<SchadeFormData, "voertuigId"> = {
  datum: Date.now(),
  beschrijving: "",
  ernst: "klein",
  schadeType: "overig",
  gerapporteerdDoor: "",
  status: "nieuw",
  reparatieKosten: undefined,
  verzekeringsClaim: false,
  claimNummer: "",
};

export function SchadeForm({
  open,
  onOpenChange,
  voertuigId: propVoertuigId,
  initialData,
  onSuccess,
}: SchadeFormProps) {
  const [formData, setFormData] = useState<Omit<SchadeFormData, "voertuigId"> & { voertuigId?: Id<"voertuigen"> }>({
    ...defaultFormData,
    voertuigId: propVoertuigId,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const voertuigen = useQuery(api.voertuigen.getActive);
  const createSchade = useMutation(api.voertuigSchades.create);
  const updateSchade = useMutation(api.voertuigSchades.update);

  const isEditMode = !!initialData;

  // Reset form when dialog opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData({
          voertuigId: initialData.voertuigId,
          datum: initialData.datum,
          beschrijving: initialData.beschrijving,
          ernst: initialData.ernst,
          schadeType: initialData.schadeType,
          fotoUrls: initialData.fotoUrls,
          gerapporteerdDoor: initialData.gerapporteerdDoor,
          status: initialData.status,
          reparatieKosten: initialData.reparatieKosten,
          verzekeringsClaim: initialData.verzekeringsClaim ?? false,
          claimNummer: initialData.claimNummer || "",
        });
        setSelectedDate(new Date(initialData.datum));
      } else {
        setFormData({
          ...defaultFormData,
          voertuigId: propVoertuigId,
        });
        setSelectedDate(new Date());
      }
    }
  }, [initialData, propVoertuigId, open]);

  const handleDateSelect = useCallback((date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setFormData((prev) => ({ ...prev, datum: date.getTime() }));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.voertuigId) {
      showWarningToast("Selecteer een voertuig");
      return;
    }

    if (!formData.beschrijving.trim()) {
      showWarningToast("Beschrijving is verplicht");
      return;
    }

    if (!formData.gerapporteerdDoor.trim()) {
      showWarningToast("Gerapporteerd door is verplicht");
      return;
    }

    setIsLoading(true);

    try {
      if (isEditMode && initialData) {
        await updateSchade({
          id: initialData._id,
          datum: formData.datum,
          beschrijving: formData.beschrijving,
          ernst: formData.ernst,
          schadeType: formData.schadeType,
          fotoUrls: formData.fotoUrls,
          gerapporteerdDoor: formData.gerapporteerdDoor,
          status: formData.status,
          reparatieKosten: formData.reparatieKosten,
          verzekeringsClaim: formData.verzekeringsClaim,
          claimNummer: formData.claimNummer || undefined,
        });
        showSuccessToast("Schademelding bijgewerkt");
      } else {
        await createSchade({
          voertuigId: formData.voertuigId!,
          datum: formData.datum,
          beschrijving: formData.beschrijving,
          ernst: formData.ernst,
          schadeType: formData.schadeType,
          fotoUrls: formData.fotoUrls,
          gerapporteerdDoor: formData.gerapporteerdDoor,
          status: formData.status,
          reparatieKosten: formData.reparatieKosten,
          verzekeringsClaim: formData.verzekeringsClaim,
          claimNummer: formData.claimNummer || undefined,
        });
        showSuccessToast("Schademelding toegevoegd");
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving schade:", error);
      showErrorToast(
        isEditMode
          ? "Fout bij bijwerken schademelding"
          : "Fout bij toevoegen schademelding",
        { description: getMutationErrorMessage(error) }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setFormData({ ...defaultFormData, voertuigId: propVoertuigId });
    setSelectedDate(new Date());
  }, [onOpenChange, propVoertuigId]);

  const isFormValid =
    formData.voertuigId &&
    formData.beschrijving.trim() &&
    formData.gerapporteerdDoor.trim();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Schademelding bewerken" : "Nieuwe schademelding"}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "Pas de schademelding aan"
                : "Registreer een nieuwe schade aan een voertuig"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Voertuig selectie (alleen tonen als niet vooraf geselecteerd) */}
            {!propVoertuigId && (
              <div className="grid gap-2">
                <Label htmlFor="voertuig">Voertuig *</Label>
                <Select
                  value={formData.voertuigId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, voertuigId: value as Id<"voertuigen"> })
                  }
                  disabled={isEditMode}
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
              </div>
            )}

            {/* Datum */}
            <div className="grid gap-2">
              <Label>Datum schade *</Label>
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
                      format(selectedDate, "d MMMM yyyy", { locale: nl })
                    ) : (
                      <span>Selecteer datum</span>
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

            {/* Schade type en Ernst */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="schadeType">Type schade *</Label>
                <Select
                  value={formData.schadeType}
                  onValueChange={(value: SchadeType) =>
                    setFormData({ ...formData, schadeType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    {schadeTypeOptions.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="ernst">Ernst *</Label>
                <Select
                  value={formData.ernst}
                  onValueChange={(value: Ernst) =>
                    setFormData({ ...formData, ernst: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    {ernstOptions.map((ernst) => (
                      <SelectItem key={ernst.value} value={ernst.value}>
                        {ernst.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Beschrijving */}
            <div className="grid gap-2">
              <Label htmlFor="beschrijving">Beschrijving *</Label>
              <Textarea
                id="beschrijving"
                value={formData.beschrijving}
                onChange={(e) =>
                  setFormData({ ...formData, beschrijving: e.target.value })
                }
                placeholder="Beschrijf de schade..."
                rows={3}
                required
              />
            </div>

            {/* Gerapporteerd door */}
            <div className="grid gap-2">
              <Label htmlFor="gerapporteerdDoor">Gerapporteerd door *</Label>
              <Input
                id="gerapporteerdDoor"
                value={formData.gerapporteerdDoor}
                onChange={(e) =>
                  setFormData({ ...formData, gerapporteerdDoor: e.target.value })
                }
                placeholder="Naam medewerker"
                required
              />
            </div>

            {/* Status */}
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: SchadeStatus) =>
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

            {/* Reparatiekosten */}
            <div className="grid gap-2">
              <Label htmlFor="reparatieKosten">Reparatiekosten</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">
                  &euro;
                </span>
                <Input
                  id="reparatieKosten"
                  type="number"
                  min="0"
                  step="0.01"
                  className="pl-7"
                  value={formData.reparatieKosten ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      reparatieKosten: e.target.value
                        ? parseFloat(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder="0,00"
                />
              </div>
            </div>

            {/* Verzekeringsclaim */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="verzekeringsClaim">Verzekeringsclaim</Label>
                <p className="text-xs text-muted-foreground">
                  Is er een claim ingediend bij de verzekering?
                </p>
              </div>
              <Switch
                id="verzekeringsClaim"
                checked={formData.verzekeringsClaim}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, verzekeringsClaim: checked })
                }
              />
            </div>

            {/* Claimnummer (alleen tonen als verzekeringsClaim true is) */}
            {formData.verzekeringsClaim && (
              <div className="grid gap-2">
                <Label htmlFor="claimNummer">Claimnummer</Label>
                <Input
                  id="claimNummer"
                  value={formData.claimNummer}
                  onChange={(e) =>
                    setFormData({ ...formData, claimNummer: e.target.value })
                  }
                  placeholder="Bijv. CLM-2024-001234"
                />
              </div>
            )}
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
