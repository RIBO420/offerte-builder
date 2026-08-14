"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { HerstelOptie } from "./schema";

interface HerstelpadSectieProps {
  score: number;
  titel: string;
  omschrijving: string;
  opties: HerstelOptie[];
  herstelActies: string[];
  oppervlakte: number;
  onToggle: (id: string, checked: boolean) => void;
}

export function HerstelpadSectie({
  score,
  titel,
  omschrijving,
  opties,
  herstelActies,
  oppervlakte,
  onToggle,
}: HerstelpadSectieProps) {
  return (
    <Card
      className={`border-2 ${
        score <= 2
          ? "border-status-vervallen-border"
          : score === 3
            ? "border-status-herinnering-border"
            : "border-status-geaccepteerd-border"
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{titel}</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {omschrijving}
            </CardDescription>
          </div>
          <Badge
            className={`shrink-0 ${
              score <= 2
                ? "bg-status-vervallen text-status-vervallen-text border-status-vervallen-border"
                : score === 3
                  ? "bg-status-herinnering text-status-herinnering-text border-status-herinnering-border"
                  : "bg-status-geaccepteerd text-status-geaccepteerd-text border-status-geaccepteerd-border"
            }`}
            variant="outline"
          >
            Score {score}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <p className="text-xs font-medium text-muted-foreground">
          Kies herstelacties (meerdere mogelijk):
        </p>
        {opties.map((optie) => {
          const isSelected = herstelActies.includes(optie.id);
          return (
            <div
              key={optie.id}
              className={`rounded-lg border p-3 transition-colors ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border"
              }`}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  id={`herstel-${optie.id}`}
                  checked={isSelected}
                  onCheckedChange={(checked) =>
                    onToggle(optie.id, !!checked)
                  }
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <label
                    htmlFor={`herstel-${optie.id}`}
                    className="text-sm font-medium cursor-pointer"
                  >
                    {optie.label}
                  </label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {optie.omschrijving}
                  </p>
                  {optie.kostenIndicatie && (
                    <Badge
                      variant="secondary"
                      className="mt-1.5 text-xs font-normal"
                    >
                      Indicatie: {optie.kostenIndicatie}
                    </Badge>
                  )}
                  {isSelected && oppervlakte > 0 && (
                    <p className="text-xs text-primary font-medium mt-1">
                      Oppervlakte: {oppervlakte} m²
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
