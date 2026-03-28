"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Layers, Info, Plus } from "lucide-react";
import type { BestratingZone } from "@/types/offerte";
import { ZoneKaart } from "./bestrating-zone-kaart";

// ─── Multi-zone bestratingzones card ─────────────────────────────────────────

interface BestratingZonesCardProps {
  zones: BestratingZone[];
  totalZoneOppervlakte: number;
  hoofdOppervlakte: number;
  onAddZone: () => void;
  onUpdateZone: (index: number, zone: BestratingZone) => void;
  onRemoveZone: (index: number) => void;
}

export function BestratingZonesCard({
  zones,
  totalZoneOppervlakte,
  hoofdOppervlakte,
  onAddZone,
  onUpdateZone,
  onRemoveZone,
}: BestratingZonesCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Bestratingzones</CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="inline-flex rounded-full p-0.5 text-muted-foreground hover:text-foreground">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[260px]">
                Voeg meerdere zones toe als het terrein uit verschillende bestratingtypes bestaat, bijv. een pad naar de voordeur en een oprit.
              </TooltipContent>
            </Tooltip>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddZone}
            className="h-8 gap-1 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Zone toevoegen
          </Button>
        </div>
        <CardDescription className="text-xs">
          Optioneel: definieer aparte zones met elk een eigen type en oppervlakte
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {zones.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-center">
            <p className="text-xs text-muted-foreground">
              Nog geen zones toegevoegd. Klik op &quot;Zone toevoegen&quot; om meerdere bestratinggebieden te defini&euml;ren.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {zones.map((zone, index) => (
                <ZoneKaart
                  key={zone.id}
                  zone={zone}
                  index={index}
                  onUpdate={(updated) => onUpdateZone(index, updated)}
                  onRemove={() => onRemoveZone(index)}
                  canRemove={true}
                />
              ))}
            </div>

            {/* Zone samenvatting */}
            <div
              className="grid transition-all duration-200 ease-in-out"
              style={{
                gridTemplateRows: totalZoneOppervlakte > 0 ? "1fr" : "0fr",
                opacity: totalZoneOppervlakte > 0 ? 1 : 0,
              }}
            >
              <div className="overflow-hidden">
                <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                  <span className="font-medium">Totaal zones:</span> {zones.length} zone{zones.length !== 1 ? "s" : ""},{" "}
                  {totalZoneOppervlakte.toFixed(1)} m&#178; totaal
                  {hoofdOppervlakte > 0 && totalZoneOppervlakte !== hoofdOppervlakte && (
                    <span className="ml-1 text-amber-600 dark:text-amber-400">
                      (verschilt van hoofdoppervlakte: {hoofdOppervlakte} m&#178;)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
