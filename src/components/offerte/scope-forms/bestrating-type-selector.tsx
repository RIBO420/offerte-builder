"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Layers, Info, Car, Footprints, Warehouse, AlertTriangle } from "lucide-react";
import type { Bestratingtype } from "@/types/offerte";
import { BESTRATINGTYPE_OPTIONS, FUNDERINGS_SPECS } from "./bestrating-constants";
import { FunderingsVisualisatie } from "./bestrating-fundering";

// ─── Icon mapping (JSX cannot be stored in constants file) ───────────────────

const BESTRATINGTYPE_ICONS: Record<Bestratingtype, React.ReactNode> = {
  pad: <Footprints className="h-5 w-5" />,
  oprit: <Car className="h-5 w-5" />,
  terrein: <Warehouse className="h-5 w-5" />,
};

// ─── Bestratingtype selector with fundering preview ──────────────────────────

interface BestratingTypeSelectorProps {
  bestratingtype: Bestratingtype | undefined;
  onBestratingtypeChange: (value: Bestratingtype) => void;
}

export function BestratingTypeSelector({
  bestratingtype,
  onBestratingtypeChange,
}: BestratingTypeSelectorProps) {
  return (
    <>
      {/* ─── Type selector card ─── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Type bestrating</CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="inline-flex rounded-full p-0.5 text-muted-foreground hover:text-foreground">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[260px]">
                Het bestratingtype bepaalt automatisch de benodigde funderingsopbouw en bijbehorende kosten.
              </TooltipContent>
            </Tooltip>
          </div>
          <CardDescription className="text-xs">
            Kies het type om automatisch de juiste fundering te berekenen
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <RadioGroup
            value={bestratingtype ?? ""}
            onValueChange={(val) => onBestratingtypeChange(val as Bestratingtype)}
            className="grid gap-2 sm:grid-cols-3"
          >
            {BESTRATINGTYPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                htmlFor={`bestratingtype-${opt.value}`}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 ${
                  bestratingtype === opt.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-muted"
                }`}
              >
                <RadioGroupItem
                  value={opt.value}
                  id={`bestratingtype-${opt.value}`}
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">{BESTRATINGTYPE_ICONS[opt.value]}</span>
                    <span className="text-sm font-medium">{opt.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{opt.beschrijving}</p>
                </div>
              </label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* ─── Funderingsvisualisatie (als type gekozen) ─── */}
      <div
        className="grid transition-all duration-200 ease-in-out"
        style={{
          gridTemplateRows: bestratingtype ? "1fr" : "0fr",
          opacity: bestratingtype ? 1 : 0,
        }}
      >
        <div className="overflow-hidden">
          {bestratingtype && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <CardTitle className="text-base">Berekende fundering</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Automatisch bepaald op basis van type &quot;{BESTRATINGTYPE_OPTIONS.find(o => o.value === bestratingtype)?.label}&quot;
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <FunderingsVisualisatie spec={FUNDERINGS_SPECS[bestratingtype]} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
