"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { scopeLabels } from "./constants";
import { formatCurrency } from "./utils";
import type { Regel } from "./types";

interface EditRegelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRegel: Regel | null;
  onEditingRegelChange: (regel: Regel | null) => void;
  availableScopes: string[];
  onUpdate: () => void;
  standaardMargePercentage?: number;
}

export function EditRegelDialog({
  open,
  onOpenChange,
  editingRegel,
  onEditingRegelChange,
  availableScopes,
  onUpdate,
  standaardMargePercentage,
}: EditRegelDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Regel bewerken</DialogTitle>
          <DialogDescription>
            Pas de gegevens van deze regel aan
          </DialogDescription>
        </DialogHeader>
        {editingRegel && (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select
                value={editingRegel.type}
                onValueChange={(value) =>
                  onEditingRegelChange({ ...editingRegel, type: value as Regel["type"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="materiaal">Materiaal</SelectItem>
                  <SelectItem value="arbeid">Arbeid</SelectItem>
                  <SelectItem value="machine">Machine</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Scope</Label>
              <Select
                value={editingRegel.scope}
                onValueChange={(value) =>
                  onEditingRegelChange({ ...editingRegel, scope: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableScopes.map((scope) => (
                    <SelectItem key={scope} value={scope}>
                      {scopeLabels[scope] || scope}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Omschrijving</Label>
              <Input
                value={editingRegel.omschrijving}
                onChange={(e) =>
                  onEditingRegelChange({ ...editingRegel, omschrijving: e.target.value })
                }
                placeholder="Bijv. Bestratingswerk - stenen"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Hoeveelheid</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={editingRegel.hoeveelheid}
                  onChange={(e) =>
                    onEditingRegelChange({
                      ...editingRegel,
                      hoeveelheid: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Eenheid</Label>
                <Select
                  value={editingRegel.eenheid}
                  onValueChange={(value) =>
                    onEditingRegelChange({ ...editingRegel, eenheid: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stuk">stuk</SelectItem>
                    <SelectItem value="m²">m²</SelectItem>
                    <SelectItem value="m³">m³</SelectItem>
                    <SelectItem value="m¹">m¹</SelectItem>
                    <SelectItem value="uur">uur</SelectItem>
                    <SelectItem value="dag">dag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Prijs per eenheid</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={editingRegel.prijsPerEenheid}
                onChange={(e) =>
                  onEditingRegelChange({
                    ...editingRegel,
                    prijsPerEenheid: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>
                Marge % (optioneel)
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  Laat leeg voor scope/standaard marge
                </span>
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  className="pr-7"
                  placeholder={String(standaardMargePercentage || 15)}
                  value={editingRegel.margePercentage ?? ""}
                  onChange={(e) =>
                    onEditingRegelChange({
                      ...editingRegel,
                      margePercentage: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                />
                <span className="absolute right-3 top-2.5 text-muted-foreground">%</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-optioneel"
                checked={editingRegel.optioneel ?? false}
                onCheckedChange={(checked) =>
                  onEditingRegelChange({
                    ...editingRegel,
                    optioneel: checked === true || undefined,
                  })
                }
              />
              <Label htmlFor="edit-optioneel" className="text-sm font-normal cursor-pointer">
                Optionele post (klant kan deze aan/uit zetten)
              </Label>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-interne-notitie">
                Interne notitie
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  (niet zichtbaar voor klant)
                </span>
              </Label>
              <Textarea
                id="edit-interne-notitie"
                value={editingRegel.interneNotitie ?? ""}
                onChange={(e) =>
                  onEditingRegelChange({
                    ...editingRegel,
                    interneNotitie: e.target.value || undefined,
                  })
                }
                placeholder="Interne opmerkingen bij deze regel..."
                className="h-20 resize-none"
              />
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm text-muted-foreground">
                Totaal:{" "}
                <span className="font-semibold text-foreground">
                  {formatCurrency(
                    editingRegel.hoeveelheid * editingRegel.prijsPerEenheid
                  )}
                </span>
                {editingRegel.margePercentage !== undefined && (
                  <span className="ml-2 text-xs">
                    (+{editingRegel.margePercentage}% marge)
                  </span>
                )}
              </p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onEditingRegelChange(null);
            }}
          >
            Annuleren
          </Button>
          <Button onClick={onUpdate}>Opslaan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
