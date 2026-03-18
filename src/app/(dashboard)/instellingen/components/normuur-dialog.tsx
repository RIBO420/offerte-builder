"use client";

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
import { Loader2 } from "lucide-react";
import { scopeLabels } from "./constants";
import type { Normuur, NormuurFormData } from "./types";

interface NormuurDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingNormuur: Normuur | null;
  normuurForm: NormuurFormData;
  setNormuurForm: (form: NormuurFormData) => void;
  isSaving: boolean;
  onSave: () => void;
}

export function NormuurDialog({
  open,
  onOpenChange,
  editingNormuur,
  normuurForm,
  setNormuurForm,
  isSaving,
  onSave,
}: NormuurDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingNormuur ? "Normuur bewerken" : "Nieuwe normuur"}
          </DialogTitle>
          <DialogDescription>
            Voeg een standaard normuur toe voor berekeningen
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Activiteit</Label>
            <Input
              value={normuurForm.activiteit}
              onChange={(e) =>
                setNormuurForm({ ...normuurForm, activiteit: e.target.value })
              }
              placeholder="Bijv. Tegels leggen"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Scope</Label>
              <Select
                value={normuurForm.scope}
                onValueChange={(value) =>
                  setNormuurForm({ ...normuurForm, scope: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(scopeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Eenheid</Label>
              <Select
                value={normuurForm.eenheid}
                onValueChange={(value) =>
                  setNormuurForm({ ...normuurForm, eenheid: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="m²">m²</SelectItem>
                  <SelectItem value="m³">m³</SelectItem>
                  <SelectItem value="m">m (strekkend)</SelectItem>
                  <SelectItem value="stuk">stuk</SelectItem>
                  <SelectItem value="uur">uur</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Normuur per eenheid</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={normuurForm.normuurPerEenheid}
              onChange={(e) =>
                setNormuurForm({
                  ...normuurForm,
                  normuurPerEenheid: parseFloat(e.target.value) || 0,
                })
              }
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground">
              Aantal uren per {normuurForm.eenheid}
            </p>
          </div>
          <div className="grid gap-2">
            <Label>Omschrijving (optioneel)</Label>
            <Input
              value={normuurForm.omschrijving}
              onChange={(e) =>
                setNormuurForm({ ...normuurForm, omschrijving: e.target.value })
              }
              placeholder="Extra toelichting"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Annuleren
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {editingNormuur ? "Bijwerken" : "Toevoegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
