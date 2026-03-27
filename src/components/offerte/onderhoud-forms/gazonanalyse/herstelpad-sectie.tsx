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
          ? "border-red-200"
          : score === 3
            ? "border-yellow-200"
            : "border-green-200"
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
                ? "bg-red-100 text-red-700 border-red-200"
                : score === 3
                  ? "bg-yellow-100 text-yellow-700 border-yellow-200"
                  : "bg-green-100 text-green-700 border-green-200"
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
