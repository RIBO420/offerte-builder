"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, X } from "lucide-react";

// All available scopes
const availableScopes = [
  // Aanleg scopes
  { id: "grondwerk", label: "Grondwerk", category: "aanleg" },
  { id: "bestrating", label: "Bestrating", category: "aanleg" },
  { id: "borders", label: "Borders", category: "aanleg" },
  { id: "gras", label: "Gazon", category: "aanleg" },
  { id: "houtwerk", label: "Houtwerk", category: "aanleg" },
  { id: "water_elektra", label: "Water/Elektra", category: "aanleg" },
  { id: "specials", label: "Specials", category: "aanleg" },
  // Onderhoud scopes
  { id: "gras_onderhoud", label: "Gras Onderhoud", category: "onderhoud" },
  { id: "borders_onderhoud", label: "Borders Onderhoud", category: "onderhoud" },
  { id: "heggen", label: "Heggen", category: "onderhoud" },
  { id: "bomen", label: "Bomen", category: "onderhoud" },
  { id: "overig", label: "Overig", category: "onderhoud" },
];

export interface MachineFormData {
  naam: string;
  type: "intern" | "extern";
  tarief: number;
  tariefType: "uur" | "dag";
  gekoppeldeScopes: string[];
}

interface Machine extends MachineFormData {
  _id: string;
  isActief: boolean;
}

interface MachineFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machine?: Machine | null;
  onSubmit: (data: MachineFormData) => Promise<void>;
  isLoading?: boolean;
}

const defaultFormData: MachineFormData = {
  naam: "",
  type: "intern",
  tarief: 0,
  tariefType: "dag",
  gekoppeldeScopes: [],
};

export function MachineForm({
  open,
  onOpenChange,
  machine,
  onSubmit,
  isLoading = false,
}: MachineFormProps) {
  const [formData, setFormData] = useState<MachineFormData>(defaultFormData);

  // Reset form when dialog opens/closes or machine changes
  useEffect(() => {
    if (machine) {
      setFormData({
        naam: machine.naam,
        type: machine.type,
        tarief: machine.tarief,
        tariefType: machine.tariefType,
        gekoppeldeScopes: machine.gekoppeldeScopes,
      });
    } else {
      setFormData(defaultFormData);
    }
  }, [machine, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  const toggleScope = (scopeId: string) => {
    setFormData((prev) => ({
      ...prev,
      gekoppeldeScopes: prev.gekoppeldeScopes.includes(scopeId)
        ? prev.gekoppeldeScopes.filter((s) => s !== scopeId)
        : [...prev.gekoppeldeScopes, scopeId],
    }));
  };

  const removeScope = (scopeId: string) => {
    setFormData((prev) => ({
      ...prev,
      gekoppeldeScopes: prev.gekoppeldeScopes.filter((s) => s !== scopeId),
    }));
  };

  const aanlegScopes = availableScopes.filter((s) => s.category === "aanleg");
  const onderhoudScopes = availableScopes.filter(
    (s) => s.category === "onderhoud"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {machine ? "Machine bewerken" : "Nieuwe machine"}
            </DialogTitle>
            <DialogDescription>
              {machine
                ? "Pas de gegevens van de machine aan"
                : "Voeg een machine toe aan je machinepark"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Naam */}
            <div className="grid gap-2">
              <Label htmlFor="naam">Naam</Label>
              <Input
                id="naam"
                value={formData.naam}
                onChange={(e) =>
                  setFormData({ ...formData, naam: e.target.value })
                }
                placeholder="Bijv. Minikraan, Trilplaat"
                required
              />
            </div>

            {/* Type en Tarief */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: "intern" | "extern") =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="intern">Intern (eigen)</SelectItem>
                    <SelectItem value="extern">Extern (huur)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formData.type === "intern"
                    ? "Eigen materieel"
                    : "Gehuurd materieel"}
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tariefType">Tarief type</Label>
                <Select
                  value={formData.tariefType}
                  onValueChange={(value: "uur" | "dag") =>
                    setFormData({ ...formData, tariefType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uur">Per uur</SelectItem>
                    <SelectItem value="dag">Per dag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tarief */}
            <div className="grid gap-2">
              <Label htmlFor="tarief">
                Tarief ({formData.tariefType === "uur" ? "per uur" : "per dag"})
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">
                  &euro;
                </span>
                <Input
                  id="tarief"
                  type="number"
                  min="0"
                  step="0.01"
                  className="pl-7"
                  value={formData.tarief}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tarief: parseFloat(e.target.value) || 0,
                    })
                  }
                  required
                />
              </div>
            </div>

            {/* Gekoppelde Scopes */}
            <div className="grid gap-2">
              <Label>Gekoppelde scopes</Label>
              <p className="text-xs text-muted-foreground">
                Selecteer de werkzaamheden waarvoor deze machine automatisch
                wordt voorgesteld
              </p>

              {/* Selected scopes */}
              {formData.gekoppeldeScopes.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {formData.gekoppeldeScopes.map((scopeId) => {
                    const scope = availableScopes.find((s) => s.id === scopeId);
                    return (
                      <Badge
                        key={scopeId}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => removeScope(scopeId)}
                      >
                        {scope?.label || scopeId}
                        <X className="ml-1 h-3 w-3" />
                      </Badge>
                    );
                  })}
                </div>
              )}

              {/* Aanleg scopes */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Aanleg
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {aanlegScopes.map((scope) => (
                    <div key={scope.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`scope-${scope.id}`}
                        checked={formData.gekoppeldeScopes.includes(scope.id)}
                        onCheckedChange={() => toggleScope(scope.id)}
                      />
                      <label
                        htmlFor={`scope-${scope.id}`}
                        className="text-sm cursor-pointer"
                      >
                        {scope.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Onderhoud scopes */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Onderhoud
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {onderhoudScopes.map((scope) => (
                    <div key={scope.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`scope-${scope.id}`}
                        checked={formData.gekoppeldeScopes.includes(scope.id)}
                        onCheckedChange={() => toggleScope(scope.id)}
                      />
                      <label
                        htmlFor={`scope-${scope.id}`}
                        className="text-sm cursor-pointer"
                      >
                        {scope.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuleren
            </Button>
            <Button type="submit" disabled={isLoading || !formData.naam}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {machine ? "Bijwerken" : "Toevoegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
