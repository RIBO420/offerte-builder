"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Shield, ShieldCheck, ShieldPlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface GarantiePakket {
  id: string;
  naam: string;
  tier: "basis" | "premium" | "premium_plus";
  prijs: number;
  duurJaren: number;
  maxCallbacks: number;
  beschrijving: string;
  features: string[];
  isAanbevolen?: boolean;
}

interface GarantiePakketSelectorProps {
  selectedPakketId: string | null;
  onSelect: (pakketId: string | null) => void;
  pakketten?: GarantiePakket[];
}

const DEFAULT_PAKKETTEN: GarantiePakket[] = [
  {
    id: "garantie-basis",
    naam: "Basis",
    tier: "basis",
    prijs: 299,
    duurJaren: 5,
    maxCallbacks: 1,
    beschrijving: "5 jaar garantie op aanleg",
    features: ["5 jaar garantie", "1 callback/jaar", "Email support"],
    isAanbevolen: false,
  },
  {
    id: "garantie-premium",
    naam: "Premium",
    tier: "premium",
    prijs: 599,
    duurJaren: 7,
    maxCallbacks: 3,
    beschrijving: "7 jaar uitgebreide garantie",
    features: [
      "7 jaar garantie",
      "3 callbacks/jaar",
      "Tel. support",
      "Jaarlijkse inspectie",
    ],
    isAanbevolen: true,
  },
  {
    id: "garantie-premium-plus",
    naam: "Premium Plus",
    tier: "premium_plus",
    prijs: 999,
    duurJaren: 10,
    maxCallbacks: -1, // onbeperkt
    beschrijving: "10 jaar all-in garantie",
    features: [
      "10 jaar garantie",
      "Onbeperkt callbacks",
      "Prioriteit support",
      "2x inspectie/jaar",
    ],
    isAanbevolen: false,
  },
];

const TIER_ICONS = {
  basis: Shield,
  premium: ShieldCheck,
  premium_plus: ShieldPlus,
} as const;

const TIER_COLORS = {
  basis: "text-slate-600 dark:text-slate-400",
  premium: "text-primary",
  premium_plus: "text-amber-600 dark:text-amber-400",
} as const;

export function GarantiePakketSelector({
  selectedPakketId,
  onSelect,
  pakketten = DEFAULT_PAKKETTEN,
}: GarantiePakketSelectorProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Garantiepakket</h2>
        </div>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          Kies een garantiepakket voor extra zekerheid na oplevering van het
          project.
        </p>
      </div>

      {/* Kaarten */}
      <div className="grid gap-4 md:grid-cols-3">
        {pakketten.map((pakket) => {
          const isSelected = selectedPakketId === pakket.id;
          const Icon = TIER_ICONS[pakket.tier];
          const iconColor = TIER_COLORS[pakket.tier];

          return (
            <Card
              key={pakket.id}
              className={cn(
                "relative cursor-pointer transition-all hover:shadow-md touch-manipulation",
                isSelected
                  ? "ring-2 ring-primary border-primary bg-primary/5"
                  : "hover:border-primary/50",
                pakket.isAanbevolen && !isSelected && "border-primary/30"
              )}
              onClick={() =>
                onSelect(isSelected ? null : pakket.id)
              }
            >
              {pakket.isAanbevolen && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <Badge className="bg-primary text-primary-foreground shadow-sm">
                    Meest gekozen
                  </Badge>
                </div>
              )}

              <CardHeader className="pb-3 pt-5">
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        isSelected ? "text-primary-foreground" : iconColor
                      )}
                    />
                  </div>
                  {isSelected && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <CardTitle className="text-lg mt-2">{pakket.naam}</CardTitle>
                <CardDescription className="text-xs">
                  {pakket.beschrijving}
                </CardDescription>
              </CardHeader>

              <CardContent className="pb-3">
                {/* Prijs */}
                <div className="mb-4">
                  <span className="text-3xl font-bold">
                    &euro;{pakket.prijs}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">
                    eenmalig
                  </span>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                  <span>{pakket.duurJaren} jaar</span>
                  <span>
                    {pakket.maxCallbacks === -1
                      ? "Onbeperkt callbacks"
                      : `${pakket.maxCallbacks} callback${pakket.maxCallbacks !== 1 ? "s" : ""}/jaar`}
                  </span>
                </div>

                {/* Features */}
                <ul className="space-y-2">
                  {pakket.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isSelected
                            ? "text-primary"
                            : "text-muted-foreground/60"
                        )}
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="pt-0">
                <Button
                  variant={isSelected ? "default" : "outline"}
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(isSelected ? null : pakket.id);
                  }}
                >
                  {isSelected ? "Geselecteerd" : "Selecteer"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Overslaan link */}
      <div className="text-center">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={cn(
            "text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors",
            selectedPakketId === null && "text-foreground font-medium"
          )}
        >
          Geen garantiepakket kiezen
        </button>
      </div>
    </div>
  );
}
