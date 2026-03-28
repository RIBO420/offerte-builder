"use client";

import { Button } from "@/components/ui/button";
import { AreaInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import type { BestratingZone } from "@/types/offerte";
import { BESTRATINGTYPE_OPTIONS, FUNDERINGS_SPECS } from "./bestrating-constants";

// ─── Zone kaart component ────────────────────────────────────────────────────

interface ZoneKaartProps {
  zone: BestratingZone;
  index: number;
  onUpdate: (zone: BestratingZone) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export function ZoneKaart({ zone, index, onUpdate, onRemove, canRemove }: ZoneKaartProps) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Zone {index + 1}</span>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Zone type selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Type</label>
        <div className="grid grid-cols-3 gap-1.5">
          {BESTRATINGTYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onUpdate({ ...zone, type: opt.value })}
              className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                zone.type === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-muted bg-muted/30 text-muted-foreground hover:bg-muted/60"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Zone oppervlakte */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Oppervlakte (m&#178;)
        </label>
        <AreaInput
          id={`zone-${zone.id}-oppervlakte`}
          min={0}
          value={zone.oppervlakte}
          onChange={(val) => onUpdate({ ...zone, oppervlakte: val })}
          showStepper={false}
        />
      </div>

      {/* Zone materiaal */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Materiaal</label>
        <Select
          value={zone.materiaal || ""}
          onValueChange={(val) => onUpdate({ ...zone, materiaal: val })}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Selecteer materiaal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tegel">Tegels</SelectItem>
            <SelectItem value="klinker">Klinkers</SelectItem>
            <SelectItem value="natuursteen">Natuursteen</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mini fundering info */}
      {zone.type && (
        <div className="rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
          Fundering: {FUNDERINGS_SPECS[zone.type].gebrokenPuin} cm puin
          {FUNDERINGS_SPECS[zone.type].brekerszand
            ? ` + ${FUNDERINGS_SPECS[zone.type].brekerszand} cm brekerszand`
            : ""}
          {FUNDERINGS_SPECS[zone.type].zand > 0
            ? ` + ${FUNDERINGS_SPECS[zone.type].zand} cm straatzand`
            : ""}
          {FUNDERINGS_SPECS[zone.type].stabiliser ? " + stabiliser" : ""}
        </div>
      )}
    </div>
  );
}
