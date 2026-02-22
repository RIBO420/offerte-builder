"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Home, TreeDeciduous, Trees, Crown, Castle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TuintypologieOption {
  id: string;
  naam: string;
  m2Range: string;
  beschrijving: string;
  icon: string;
}

interface TuintypologieSelectorProps {
  selectedType: string | null;
  onSelect: (typeId: string) => void;
}

const TUINTYPES: TuintypologieOption[] = [
  {
    id: "klein_stad",
    naam: "Kleine Stadstuin",
    m2Range: "20-50 m²",
    beschrijving: "Compact maar stijlvol",
    icon: "Home",
  },
  {
    id: "normaal",
    naam: "Normale Huistuin",
    m2Range: "50-200 m²",
    beschrijving: "De standaard Nederlandse tuin",
    icon: "TreeDeciduous",
  },
  {
    id: "midden",
    naam: "Middensegment",
    m2Range: "200-500 m²",
    beschrijving: "Ruime tuin met veel mogelijkheden",
    icon: "Trees",
  },
  {
    id: "luxe",
    naam: "Luxe Tuin",
    m2Range: "500-1000 m²",
    beschrijving: "Exclusief en uitgebreid",
    icon: "Crown",
  },
  {
    id: "landgoed",
    naam: "Landgoed",
    m2Range: "1000+ m²",
    beschrijving: "Groot terrein met diverse zones",
    icon: "Castle",
  },
];

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Home,
  TreeDeciduous,
  Trees,
  Crown,
  Castle,
};

export function TuintypologieSelector({
  selectedType,
  onSelect,
}: TuintypologieSelectorProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold">Kies het tuintype</h2>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          Selecteer het type tuin dat het beste past bij het project.
        </p>
      </div>

      {/* Horizontale scroll container op mobiel, grid op desktop */}
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-5 md:overflow-x-visible md:pb-0">
        {TUINTYPES.map((type) => {
          const Icon = ICON_MAP[type.icon] || Home;
          const isSelected = selectedType === type.id;

          return (
            <Card
              key={type.id}
              className={cn(
                "min-w-[160px] flex-shrink-0 snap-start cursor-pointer transition-all hover:shadow-md touch-manipulation",
                "md:min-w-0 md:flex-shrink",
                isSelected
                  ? "ring-2 ring-primary border-primary bg-primary/5"
                  : "hover:border-primary/50"
              )}
              onClick={() => onSelect(type.id)}
            >
              <CardHeader className="p-4 pb-2 items-center text-center">
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-sm mt-2 leading-tight">
                  {type.naam}
                </CardTitle>
              </CardHeader>

              <CardContent className="p-4 pt-0 text-center space-y-1.5">
                <Badge
                  variant={isSelected ? "default" : "secondary"}
                  className="text-[11px]"
                >
                  {type.m2Range}
                </Badge>
                <CardDescription className="text-xs leading-snug">
                  {type.beschrijving}
                </CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export type { TuintypologieOption, TuintypologieSelectorProps };
