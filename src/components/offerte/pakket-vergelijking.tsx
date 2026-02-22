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
import { Check, Star, Crown, Leaf } from "lucide-react";
import { cn } from "@/lib/utils";

interface PakketOptie {
  id: string;
  naam: string;
  tier: "basis" | "comfort" | "premium";
  prijsIndicatie: string;
  inclusief: string[];
  isAanbevolen?: boolean;
}

interface PakketVergelijkingProps {
  pakketten?: PakketOptie[];
  tuintypologie?: string;
  onSelectPakket: (pakketId: string) => void;
}

const DEFAULT_PAKKETTEN: PakketOptie[] = [
  {
    id: "basis",
    naam: "Basis",
    tier: "basis",
    prijsIndicatie: "vanaf €3.500",
    inclusief: [
      "20m² gras (zaaien)",
      "40m² bestrating (tegels)",
      "40m² border (basis beplanting)",
      "Standaard fundering",
    ],
    isAanbevolen: false,
  },
  {
    id: "comfort",
    naam: "Comfort",
    tier: "comfort",
    prijsIndicatie: "vanaf €7.500",
    inclusief: [
      "30m² gras (graszoden) + verlichting",
      "40m² bestrating (klinkers)",
      "50m² border (betere beplanting)",
      "Verbeterde fundering",
    ],
    isAanbevolen: true,
  },
  {
    id: "premium",
    naam: "Premium",
    tier: "premium",
    prijsIndicatie: "vanaf €15.000",
    inclusief: [
      "40m² gras (premium graszoden)",
      "50m² bestrating (natuursteen)",
      "60m² border (premium beplanting)",
      "Zware fundering + verlichting",
      "Extended nazorg",
    ],
    isAanbevolen: false,
  },
];

const TIER_CONFIG: Record<
  PakketOptie["tier"],
  {
    icon: React.ComponentType<{ className?: string }>;
    accentClass: string;
    iconBgClass: string;
    buttonVariant: "outline" | "default" | "secondary";
    checkColor: string;
  }
> = {
  basis: {
    icon: Leaf,
    accentClass: "",
    iconBgClass: "bg-muted text-muted-foreground",
    buttonVariant: "outline",
    checkColor: "text-green-600",
  },
  comfort: {
    icon: Star,
    accentClass: "border-primary shadow-lg ring-2 ring-primary/20",
    iconBgClass: "bg-primary text-primary-foreground",
    buttonVariant: "default",
    checkColor: "text-primary",
  },
  premium: {
    icon: Crown,
    accentClass: "border-amber-400/60 shadow-md",
    iconBgClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    buttonVariant: "secondary",
    checkColor: "text-amber-600 dark:text-amber-400",
  },
};

export function PakketVergelijking({
  pakketten,
  tuintypologie,
  onSelectPakket,
}: PakketVergelijkingProps) {
  const items = pakketten ?? DEFAULT_PAKKETTEN;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold">Kies uw tuinpakket</h2>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          Vergelijk de pakketten en kies wat het beste bij uw wensen past.
          {tuintypologie && (
            <span className="block mt-1">
              Afgestemd op tuintype:{" "}
              <span className="font-medium text-foreground">{tuintypologie}</span>
            </span>
          )}
        </p>
      </div>

      {/* Grid van pakketten */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {items.map((pakket) => {
          const config = TIER_CONFIG[pakket.tier];
          const TierIcon = config.icon;

          return (
            <Card
              key={pakket.id}
              className={cn(
                "relative transition-all hover:shadow-lg",
                pakket.isAanbevolen && "md:scale-105 md:z-10",
                config.accentClass
              )}
            >
              {/* Aanbevolen badge */}
              {pakket.isAanbevolen && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="default" className="bg-primary shadow-sm">
                    <Star className="h-3 w-3 mr-1" />
                    Aanbevolen
                  </Badge>
                </div>
              )}

              <CardHeader className={cn(pakket.isAanbevolen && "pt-8")}>
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                      config.iconBgClass
                    )}
                  >
                    <TierIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{pakket.naam}</CardTitle>
                    <CardDescription className="text-base font-semibold text-foreground mt-1">
                      {pakket.prijsIndicatie}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <ul className="space-y-2.5">
                  {pakket.inclusief.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check
                        className={cn(
                          "h-4 w-4 mt-0.5 shrink-0",
                          config.checkColor
                        )}
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  variant={config.buttonVariant}
                  className={cn(
                    "w-full",
                    pakket.tier === "premium" &&
                      "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 dark:border-amber-700"
                  )}
                  onClick={() => onSelectPakket(pakket.id)}
                >
                  Kies dit pakket
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export type { PakketOptie, PakketVergelijkingProps };
