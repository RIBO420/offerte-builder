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
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Snelstart Pakketten</h2>
        </div>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Kies een voorgedefinieerd pakket om snel te starten, of begin vanaf nul.
          Je kunt de gegevens altijd aanpassen in de volgende stappen.
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

        <TabsContent value="simple" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

        <TabsContent value="complete" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 border-t">
        <Button
          variant="outline"
          onClick={onSkip}
          className="w-full sm:w-auto"
        >
          <FileText className="mr-2 h-4 w-4" />
          Start vanaf nul
        </Button>

        {onSelectTemplate && (
          <Button
            variant="outline"
            onClick={onSelectTemplate}
            className="w-full sm:w-auto"
          >
            <Package className="mr-2 h-4 w-4" />
            Kies eigen template
          </Button>
        )}

        <Button
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
        "cursor-pointer transition-all hover:shadow-md",
        isSelected
          ? "ring-2 ring-primary border-primary bg-primary/5"
          : "hover:border-primary/50"
      )}
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
          )}>
            <Icon className="h-5 w-5" />
          </div>
          {isSelected && (
            <Badge variant="default" className="bg-primary">
              Geselecteerd
            </Badge>
          )}
        </div>
        <CardTitle className="text-lg mt-3">{pkg.naam}</CardTitle>
        <CardDescription className="text-sm">
          {pkg.omschrijving}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Scopes */}
        <div className="flex flex-wrap gap-1 mb-3">
          {pkg.scopes.map((scope) => (
            <Badge key={scope} variant="secondary" className="text-xs">
              {formatScopeName(scope)}
            </Badge>
          ))}
        </div>

        {/* Meta info */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>{pkg.geschatteTijd}</span>
          </div>
          {pkg.prijsIndicatie && (
            <div className="flex items-center gap-1">
              <Euro className="h-3.5 w-3.5" />
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
