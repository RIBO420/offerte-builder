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
import { nl } from "date-fns/locale";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";

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

interface VoertuigFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Voertuig | null;
  onSuccess?: () => void;
}

const defaultFormData: VoertuigFormData = {
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
};

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

export function VoertuigForm({
  open,
  onOpenChange,
  initialData,
  onSuccess,
}: VoertuigFormProps) {
  const [formData, setFormData] = useState<VoertuigFormData>(defaultFormData);
  const [isLoading, setIsLoading] = useState(false);
  const [kentekenError, setKentekenError] = useState<string | null>(null);

  const createVoertuig = useMutation(api.voertuigen.create);
  const updateVoertuig = useMutation(api.voertuigen.update);

  const isEditMode = !!initialData;

  // Reset form when dialog opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData({
          kenteken: initialData.kenteken,
          merk: initialData.merk,
          model: initialData.model,
          type: initialData.type,
          bouwjaar: initialData.bouwjaar,
          kleur: initialData.kleur || "",
          kmStand: initialData.kmStand,
          status: initialData.status,
          notities: initialData.notities || "",
          apkVervaldatum: (initialData as { apkVervaldatum?: number }).apkVervaldatum,
          verzekeringsVervaldatum: (initialData as { verzekeringsVervaldatum?: number }).verzekeringsVervaldatum,
          verzekeraar: (initialData as { verzekeraar?: string }).verzekeraar || "",
          polisnummer: (initialData as { polisnummer?: string }).polisnummer || "",
        });
      } else {
        setFormData(defaultFormData);
      }
      setKentekenError(null);
    }
  }, [initialData, open]);

  const handleKentekenChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatKenteken(e.target.value);
      setFormData((prev) => ({ ...prev, kenteken: formatted }));

      // Clear error when user is typing
      if (kentekenError) {
        setKentekenError(null);
      }
    },
    [kentekenError]
  );

  const handleKentekenBlur = useCallback(() => {
    if (formData.kenteken && !validateKenteken(formData.kenteken)) {
      setKentekenError("Ongeldig kenteken formaat (bijv. AB-12-CD)");
    } else {
      setKentekenError(null);
    }
  }, [formData.kenteken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate kenteken before submit
    if (!validateKenteken(formData.kenteken)) {
      setKentekenError("Ongeldig kenteken formaat (bijv. AB-12-CD)");
      return;
    }

    setIsLoading(true);

    try {
      if (isEditMode && initialData) {
        await updateVoertuig({
          id: initialData._id,
          kenteken: formData.kenteken,
          merk: formData.merk,
          model: formData.model,
          type: formData.type,
          bouwjaar: formData.bouwjaar,
          kleur: formData.kleur || undefined,
          kmStand: formData.kmStand,
          status: formData.status,
          notities: formData.notities || undefined,
          apkVervaldatum: formData.apkVervaldatum,
          verzekeringsVervaldatum: formData.verzekeringsVervaldatum,
          verzekeraar: formData.verzekeraar || undefined,
          polisnummer: formData.polisnummer || undefined,
        });
        toast.success("Voertuig bijgewerkt");
      } else {
        await createVoertuig({
          kenteken: formData.kenteken,
          merk: formData.merk,
          model: formData.model,
          type: formData.type,
          bouwjaar: formData.bouwjaar,
          kleur: formData.kleur || undefined,
          kmStand: formData.kmStand,
          status: formData.status,
          notities: formData.notities || undefined,
          apkVervaldatum: formData.apkVervaldatum,
          verzekeringsVervaldatum: formData.verzekeringsVervaldatum,
          verzekeraar: formData.verzekeraar || undefined,
          polisnummer: formData.polisnummer || undefined,
        });
        toast.success("Voertuig toegevoegd");
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving voertuig:", error);
      toast.error(
        isEditMode
          ? "Fout bij bijwerken voertuig"
          : "Fout bij toevoegen voertuig"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setFormData(defaultFormData);
    setKentekenError(null);
  }, [onOpenChange]);

  const isFormValid =
    formData.kenteken &&
    formData.merk &&
    formData.model &&
    formData.type &&
    !kentekenError;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
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

          <div className="grid gap-4 py-4">
            {/* Kenteken */}
            <div className="grid gap-2">
              <Label htmlFor="kenteken">Kenteken *</Label>
              <Input
                id="kenteken"
                value={formData.kenteken}
                onChange={handleKentekenChange}
                onBlur={handleKentekenBlur}
                placeholder="XX-XX-XX"
                className={kentekenError ? "border-destructive" : ""}
                required
              />
              {kentekenError ? (
                <p className="text-xs text-destructive">{kentekenError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nederlands kenteken formaat (bijv. AB-12-CD)
                </p>
              )}
            </div>

            {/* Merk en Model */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="merk">Merk *</Label>
                <Select
                  value={formData.merk}
                  onValueChange={(value) =>
                    setFormData({ ...formData, merk: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer merk" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    {vehicleBrands.map((brand) => (
                      <SelectItem key={brand} value={brand}>
                        {brand}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="model">Model *</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) =>
                    setFormData({ ...formData, model: e.target.value })
                  }
                  placeholder="Bijv. Sprinter, Transporter"
                  required
                />
              </div>
            </div>

            {/* Type */}
            <div className="grid gap-2">
              <Label htmlFor="type">Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer type" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  {vehicleTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bouwjaar en Kleur */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="bouwjaar">Bouwjaar</Label>
                <Input
                  id="bouwjaar"
                  type="number"
                  min="1990"
                  max={new Date().getFullYear() + 1}
                  value={formData.bouwjaar || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bouwjaar: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder={`Bijv. ${new Date().getFullYear()}`}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="kleur">Kleur</Label>
                <Input
                  id="kleur"
                  value={formData.kleur}
                  onChange={(e) =>
                    setFormData({ ...formData, kleur: e.target.value })
                  }
                  placeholder="Bijv. Wit, Grijs"
                />
              </div>
            </div>

            {/* KM Stand */}
            <div className="grid gap-2">
              <Label htmlFor="kmStand">KM Stand</Label>
              <Input
                id="kmStand"
                type="number"
                min="0"
                step="1"
                value={formData.kmStand || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    kmStand: e.target.value
                      ? parseInt(e.target.value)
                      : undefined,
                  })
                }
                placeholder="Bijv. 125000"
              />
              <p className="text-xs text-muted-foreground">
                Huidige kilometerstand van het voertuig
              </p>
            </div>

            {/* Status */}
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: "actief" | "inactief" | "onderhoud") =>
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

            {/* Compliance Section */}
            <Separator className="my-2" />
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">
                APK & Verzekering
              </h4>

              {/* APK Vervaldatum */}
              <div className="grid gap-2">
                <Label>APK Vervaldatum</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !formData.apkVervaldatum && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.apkVervaldatum ? (
                        format(new Date(formData.apkVervaldatum), "d MMMM yyyy", {
                          locale: nl,
                        })
                      ) : (
                        <span>Selecteer APK vervaldatum</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={
                        formData.apkVervaldatum
                          ? new Date(formData.apkVervaldatum)
                          : undefined
                      }
                      onSelect={(date) =>
                        setFormData({
                          ...formData,
                          apkVervaldatum: date?.getTime(),
                        })
                      }
                      locale={nl}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Verzekering Vervaldatum */}
              <div className="grid gap-2">
                <Label>Verzekering Vervaldatum</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !formData.verzekeringsVervaldatum && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.verzekeringsVervaldatum ? (
                        format(
                          new Date(formData.verzekeringsVervaldatum),
                          "d MMMM yyyy",
                          { locale: nl }
                        )
                      ) : (
                        <span>Selecteer verzekering vervaldatum</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={
                        formData.verzekeringsVervaldatum
                          ? new Date(formData.verzekeringsVervaldatum)
                          : undefined
                      }
                      onSelect={(date) =>
                        setFormData({
                          ...formData,
                          verzekeringsVervaldatum: date?.getTime(),
                        })
                      }
                      locale={nl}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Verzekeraar en Polisnummer */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="verzekeraar">Verzekeraar</Label>
                  <Input
                    id="verzekeraar"
                    value={formData.verzekeraar}
                    onChange={(e) =>
                      setFormData({ ...formData, verzekeraar: e.target.value })
                    }
                    placeholder="Bijv. ANWB, Centraal Beheer"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="polisnummer">Polisnummer</Label>
                  <Input
                    id="polisnummer"
                    value={formData.polisnummer}
                    onChange={(e) =>
                      setFormData({ ...formData, polisnummer: e.target.value })
                    }
                    placeholder="Bijv. 123456789"
                  />
                </div>
              </div>
            </div>

            <Separator className="my-2" />

            {/* Notities */}
            <div className="grid gap-2">
              <Label htmlFor="notities">Notities</Label>
              <Textarea
                id="notities"
                value={formData.notities}
                onChange={(e) =>
                  setFormData({ ...formData, notities: e.target.value })
                }
                placeholder="Eventuele opmerkingen over het voertuig..."
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
