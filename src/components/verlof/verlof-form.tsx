"use client";

import { useState, useEffect, useMemo } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  // Form state
  const [medewerkerId, setMedewerkerId] = useState<string>("");
  const [startDatum, setStartDatum] = useState("");
  const [eindDatum, setEindDatum] = useState("");
  const [aantalDagen, setAantalDagen] = useState(0);
  const [type, setType] = useState<VerlofType>("vakantie");
  const [opmerking, setOpmerking] = useState("");

  const isEditMode = !!initialData;

  // Load medewerkers for the dropdown (admin only)
  const medewerkers = useQuery(
    api.medewerkers.list,
    user?._id ? { isActief: true } : "skip"
  );

  const medewerkersList = useMemo(() => medewerkers ?? [], [medewerkers]);

  // Reset form on open
  useEffect(() => {
    if (open) {
      if (initialData) {
        setMedewerkerId(initialData.medewerkerId.toString());
        setStartDatum(initialData.startDatum);
        setEindDatum(initialData.eindDatum);
        setAantalDagen(initialData.aantalDagen);
        setType(initialData.type);
        setOpmerking(initialData.opmerking ?? "");
      } else {
        setMedewerkerId(defaultMedewerkerId?.toString() ?? "");
        setStartDatum("");
        setEindDatum("");
        setAantalDagen(0);
        setType("vakantie");
        setOpmerking("");
      }
    }
  }, [open, initialData, defaultMedewerkerId]);

  // Auto-calculate working days when dates change
  useEffect(() => {
    if (startDatum && eindDatum) {
      setAantalDagen(calculateWorkingDays(startDatum, eindDatum));
    }
  }, [startDatum, eindDatum]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!medewerkerId) {
      showErrorToast("Selecteer een medewerker");
      return;
    }

    if (!startDatum || !eindDatum) {
      showErrorToast("Vul een start- en einddatum in");
      return;
    }

    if (aantalDagen <= 0) {
      showErrorToast("Aantal dagen moet groter zijn dan 0");
      return;
    }

    setIsLoading(true);

    try {
      if (isEditMode) {
        await update(initialData._id, {
          startDatum,
          eindDatum,
          aantalDagen,
          type,
          opmerking: opmerking || undefined,
        });
        showSuccessToast("Verlofaanvraag bijgewerkt");
      } else {
        await create({
          medewerkerId: medewerkerId as Id<"medewerkers">,
          startDatum,
          eindDatum,
          aantalDagen,
          type,
          opmerking: opmerking || undefined,
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Medewerker selector */}
          <div className="space-y-2">
            <Label htmlFor="medewerker">Medewerker</Label>
            <Select
              value={medewerkerId}
              onValueChange={setMedewerkerId}
              disabled={isEditMode}
            >
              <SelectTrigger id="medewerker">
                <SelectValue placeholder="Selecteer medewerker" />
              </SelectTrigger>
              <SelectContent>
                {medewerkersList.map((m) => (
                  <SelectItem key={m._id} value={m._id}>
                    {m.naam}
                    {m.functie ? ` — ${m.functie}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Type verlof</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as VerlofType)}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VERLOF_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDatum">Startdatum</Label>
              <Input
                id="startDatum"
                type="date"
                value={startDatum}
                onChange={(e) => setStartDatum(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eindDatum">Einddatum</Label>
              <Input
                id="eindDatum"
                type="date"
                value={eindDatum}
                onChange={(e) => setEindDatum(e.target.value)}
                min={startDatum}
                required
              />
            </div>
          </div>

          {/* Calculated days */}
          <div className="space-y-2">
            <Label htmlFor="aantalDagen">Aantal werkdagen</Label>
            <Input
              id="aantalDagen"
              type="number"
              min={0.5}
              step={0.5}
              value={aantalDagen}
              onChange={(e) => setAantalDagen(Number(e.target.value))}
              required
            />
            <p className="text-xs text-muted-foreground">
              Automatisch berekend op basis van werkdagen (ma-vr). Pas aan voor halve dagen.
            </p>
          </div>

          {/* Opmerking */}
          <div className="space-y-2">
            <Label htmlFor="opmerking">Opmerking (optioneel)</Label>
            <Textarea
              id="opmerking"
              value={opmerking}
              onChange={(e) => setOpmerking(e.target.value)}
              placeholder="Reden of toelichting..."
              rows={3}
            />
          </div>

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
      </DialogContent>
    </Dialog>
  );
}
