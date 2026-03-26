"use client";

import { useState } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { scopeLabels } from "./constants";
import { formatCurrency } from "./utils";
import type { Regel } from "./types";

interface AddRegelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableScopes: string[];
  onAdd: (regel: Regel) => void;
  modKey: string;
}

export function AddRegelDialog({
  open,
  onOpenChange,
  availableScopes,
  onAdd,
  modKey,
}: AddRegelDialogProps) {
  const [newRegel, setNewRegel] = useState<Partial<Regel>>({
    scope: "overig",
    omschrijving: "",
    eenheid: "stuk",
    hoeveelheid: 1,
    prijsPerEenheid: 0,
    type: "materiaal",
  });

  const handleAddRegel = () => {
    if (!newRegel.omschrijving) {
      toast.error("Vul een omschrijving in");
      return;
    }

    const totaal = (newRegel.hoeveelheid || 0) * (newRegel.prijsPerEenheid || 0);
    const regel: Regel = {
      id: crypto.randomUUID(),
      scope: newRegel.scope || "overig",
      omschrijving: newRegel.omschrijving,
      eenheid: newRegel.eenheid || "stuk",
      hoeveelheid: newRegel.hoeveelheid || 1,
      prijsPerEenheid: newRegel.prijsPerEenheid || 0,
      totaal,
      type: newRegel.type || "materiaal",
      ...(newRegel.interneNotitie ? { interneNotitie: newRegel.interneNotitie } : {}),
      ...(newRegel.optioneel ? { optioneel: true } : {}),
    };

    onAdd(regel);
    setNewRegel({
      scope: "overig",
      omschrijving: "",
      eenheid: "stuk",
      hoeveelheid: 1,
      prijsPerEenheid: 0,
      type: "materiaal",
    });
    onOpenChange(false);
    toast.success("Regel toegevoegd");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button title={`Regel toevoegen (${modKey}+N)`}>
          <Plus className="mr-2 h-4 w-4" />
          Regel toevoegen
          <kbd className="ml-2 px-1.5 py-0.5 bg-primary-foreground/20 rounded text-[10px] hidden sm:inline">
            {modKey}N
          </kbd>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nieuwe regel</DialogTitle>
          <DialogDescription>
            Voeg een nieuwe regel toe aan de offerte
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Type</Label>
            <Select
              value={newRegel.type}
              onValueChange={(value) =>
                setNewRegel({ ...newRegel, type: value as Regel["type"] })
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
              value={newRegel.scope}
              onValueChange={(value) =>
                setNewRegel({ ...newRegel, scope: value })
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
              value={newRegel.omschrijving}
              onChange={(e) =>
                setNewRegel({ ...newRegel, omschrijving: e.target.value })
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
                value={newRegel.hoeveelheid}
                onChange={(e) =>
                  setNewRegel({
                    ...newRegel,
                    hoeveelheid: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Eenheid</Label>
              <Select
                value={newRegel.eenheid}
                onValueChange={(value) =>
                  setNewRegel({ ...newRegel, eenheid: value })
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
              value={newRegel.prijsPerEenheid}
              onChange={(e) =>
                setNewRegel({
                  ...newRegel,
                  prijsPerEenheid: parseFloat(e.target.value) || 0,
                })
              }
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="add-optioneel"
              checked={newRegel.optioneel ?? false}
              onCheckedChange={(checked) =>
                setNewRegel({
                  ...newRegel,
                  optioneel: checked === true || undefined,
                })
              }
            />
            <Label htmlFor="add-optioneel" className="text-sm font-normal cursor-pointer">
              Optionele post (klant kan deze aan/uit zetten)
            </Label>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-interne-notitie">
              Interne notitie
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                (niet zichtbaar voor klant)
              </span>
            </Label>
            <Textarea
              id="add-interne-notitie"
              value={newRegel.interneNotitie ?? ""}
              onChange={(e) =>
                setNewRegel({
                  ...newRegel,
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
                  (newRegel.hoeveelheid || 0) *
                    (newRegel.prijsPerEenheid || 0)
                )}
              </span>
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Annuleren
          </Button>
          <Button onClick={handleAddRegel}>Toevoegen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
