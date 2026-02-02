"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Loader2, Package, TrendingUp, TrendingDown, RefreshCw, RotateCcw } from "lucide-react";

export type MutatieType = "inkoop" | "verbruik" | "correctie" | "retour";

export interface VoorraadItem {
  _id: string;
  productnaam: string;
  hoeveelheid: number;
  eenheid: string;
  minVoorraad: number;
  locatie: string;
  inkoopprijs: number;
}

interface VoorraadAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: VoorraadItem | null;
  onSubmit: (data: {
    itemId: string;
    type: MutatieType;
    hoeveelheid: number;
    opmerking: string;
  }) => Promise<void>;
}

const mutatieTypeConfig: Record<MutatieType, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  inkoop: { label: "Inkoop", icon: TrendingUp, color: "text-green-600" },
  verbruik: { label: "Verbruik", icon: TrendingDown, color: "text-orange-600" },
  correctie: { label: "Correctie", icon: RefreshCw, color: "text-blue-600" },
  retour: { label: "Retour", icon: RotateCcw, color: "text-purple-600" },
};

export function VoorraadAdjustDialog({
  open,
  onOpenChange,
  item,
  onSubmit,
}: VoorraadAdjustDialogProps) {
  const [type, setType] = useState<MutatieType>("inkoop");
  const [hoeveelheid, setHoeveelheid] = useState<number>(0);
  const [opmerking, setOpmerking] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (!item || hoeveelheid === 0) return;

    setIsSaving(true);
    try {
      await onSubmit({
        itemId: item._id,
        type,
        hoeveelheid,
        opmerking,
      });
      // Reset form
      setType("inkoop");
      setHoeveelheid(0);
      setOpmerking("");
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const getNewStock = () => {
    if (!item) return 0;
    switch (type) {
      case "inkoop":
      case "retour":
        return item.hoeveelheid + Math.abs(hoeveelheid);
      case "verbruik":
        return item.hoeveelheid - Math.abs(hoeveelheid);
      case "correctie":
        return hoeveelheid;
      default:
        return item.hoeveelheid;
    }
  };

  const newStock = getNewStock();
  const isUnderMinimum = newStock < (item?.minVoorraad || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Voorraad Aanpassen
          </DialogTitle>
          <DialogDescription>
            {item?.productnaam}
          </DialogDescription>
        </DialogHeader>

        {item && (
          <div className="grid gap-4 py-4">
            {/* Current stock info */}
            <div className="rounded-lg border bg-muted/50 p-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Huidige voorraad</span>
                <span className="font-semibold">
                  {item.hoeveelheid} {item.eenheid}
                </span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-sm text-muted-foreground">Minimum voorraad</span>
                <span className="text-sm">
                  {item.minVoorraad} {item.eenheid}
                </span>
              </div>
            </div>

            {/* Mutation type */}
            <div className="grid gap-2">
              <Label>Type aanpassing</Label>
              <Select value={type} onValueChange={(value: MutatieType) => setType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(mutatieTypeConfig).map(([key, config]) => {
                    const IconComponent = config.icon;
                    return (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <IconComponent className={`h-4 w-4 ${config.color}`} />
                          {config.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="grid gap-2">
              <Label>
                {type === "correctie" ? "Nieuwe voorraad" : "Hoeveelheid"}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={type === "correctie" ? 0 : 1}
                  step="1"
                  value={hoeveelheid}
                  onChange={(e) => setHoeveelheid(parseFloat(e.target.value) || 0)}
                  placeholder={type === "correctie" ? "Nieuwe voorraad" : "Aantal"}
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {item.eenheid}
                </span>
              </div>
            </div>

            {/* Remark */}
            <div className="grid gap-2">
              <Label>Opmerking (optioneel)</Label>
              <Textarea
                value={opmerking}
                onChange={(e) => setOpmerking(e.target.value)}
                placeholder="Bijv. leverancier naam, projectnummer, reden correctie..."
                rows={2}
              />
            </div>

            {/* Preview new stock */}
            {hoeveelheid !== 0 && (
              <div className={`rounded-lg border p-3 ${isUnderMinimum ? "border-red-500 bg-red-50 dark:bg-red-950/20" : "border-green-500 bg-green-50 dark:bg-green-950/20"}`}>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">
                    Nieuwe voorraad
                  </span>
                  <span className={`font-bold ${isUnderMinimum ? "text-red-600" : "text-green-600"}`}>
                    {newStock} {item.eenheid}
                  </span>
                </div>
                {isUnderMinimum && (
                  <p className="text-xs text-red-600 mt-1">
                    Let op: Dit is onder de minimum voorraad!
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Annuleren
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSaving || hoeveelheid === 0}
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Opslaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
