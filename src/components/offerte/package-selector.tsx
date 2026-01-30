"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutGrid,
  Square,
  Leaf,
  Flower2,
  Fence,
  RectangleHorizontal,
  Lightbulb,
  TreeDeciduous,
  Trees,
  Scissors,
  Wind,
  Package,
  Clock,
  Euro,
  ChevronRight,
  Sparkles,
  FileText,
} from "lucide-react";
import { getPackagesByType, type OffertePackage } from "@/lib/constants/packages";
import { cn } from "@/lib/utils";

// Icon mapping
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutGrid,
  Square,
  Leaf,
  Flower2,
  Fence,
  RectangleHorizontal,
  Lightbulb,
  TreeDeciduous,
  Trees,
  Scissors,
  Wind,
  Shrub: Trees, // Fallback
  Package,
};

interface PackageSelectorProps {
  type: "aanleg" | "onderhoud";
  onSelectPackage: (pkg: OffertePackage) => void;
  onSkip: () => void;
  onSelectTemplate?: () => void;
}

export function PackageSelector({
  type,
  onSelectPackage,
  onSkip,
  onSelectTemplate,
}: PackageSelectorProps) {
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const packages = getPackagesByType(type);

  // Group packages by complexity
  const simplePackages = packages.filter((p) => p.scopes.length <= 2);
  const completePackages = packages.filter((p) => p.scopes.length > 2);

  const handleSelectPackage = (pkg: OffertePackage) => {
    setSelectedPackageId(pkg.id);
  };

  const handleConfirm = () => {
    const pkg = packages.find((p) => p.id === selectedPackageId);
    if (pkg) {
      onSelectPackage(pkg);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Snelstart Pakketten</h2>
        </div>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          Kies een pakket om snel te starten, of begin vanaf nul.
        </p>
      </div>

      {/* Tabs for Simple vs Complete */}
      <Tabs defaultValue="simple" className="w-full">
        <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
          <TabsTrigger value="simple" className="gap-2">
            <Package className="h-4 w-4" />
            Basis ({simplePackages.length})
          </TabsTrigger>
          <TabsTrigger value="complete" className="gap-2">
            <Trees className="h-4 w-4" />
            Compleet ({completePackages.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="simple" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {simplePackages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                isSelected={selectedPackageId === pkg.id}
                onSelect={() => handleSelectPackage(pkg)}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="complete" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {completePackages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                isSelected={selectedPackageId === pkg.id}
                onSelect={() => handleSelectPackage(pkg)}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-3 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={onSkip}
          className="w-full sm:w-auto"
        >
          <FileText className="mr-2 h-4 w-4" />
          Start vanaf nul
        </Button>

        {onSelectTemplate && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSelectTemplate}
            className="w-full sm:w-auto"
          >
            <Package className="mr-2 h-4 w-4" />
            Kies template
          </Button>
        )}

        <Button
          size="sm"
          onClick={handleConfirm}
          disabled={!selectedPackageId}
          className="w-full sm:w-auto"
        >
          Gebruik pakket
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface PackageCardProps {
  pkg: OffertePackage;
  isSelected: boolean;
  onSelect: () => void;
}

function PackageCard({ pkg, isSelected, onSelect }: PackageCardProps) {
  const Icon = ICON_MAP[pkg.icon] || Package;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md touch-manipulation",
        isSelected
          ? "ring-2 ring-primary border-primary bg-primary/5"
          : "hover:border-primary/50"
      )}
      onClick={onSelect}
    >
      <CardHeader className="p-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
          )}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base leading-tight">{pkg.naam}</CardTitle>
            <CardDescription className="text-xs line-clamp-2 mt-0.5">
              {pkg.omschrijving}
            </CardDescription>
          </div>
          {isSelected && (
            <Badge variant="default" className="bg-primary text-xs shrink-0">
              Gekozen
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {/* Scopes */}
        <div className="flex flex-wrap gap-1 mb-2">
          {pkg.scopes.map((scope) => (
            <Badge key={scope} variant="secondary" className="text-[10px] px-1.5 py-0">
              {formatScopeName(scope)}
            </Badge>
          ))}
        </div>

        {/* Meta info */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{pkg.geschatteTijd}</span>
          </div>
          {pkg.prijsIndicatie && (
            <div className="flex items-center gap-1">
              <Euro className="h-3 w-3" />
              <span>{pkg.prijsIndicatie}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper to format scope names in Dutch
function formatScopeName(scope: string): string {
  const names: Record<string, string> = {
    grondwerk: "Grondwerk",
    bestrating: "Bestrating",
    borders: "Borders",
    gras: "Gazon",
    houtwerk: "Houtwerk",
    water_elektra: "Verlichting",
    specials: "Specials",
    heggen: "Heggen",
    bomen: "Bomen",
    overig: "Overig",
  };
  return names[scope] || scope;
}
