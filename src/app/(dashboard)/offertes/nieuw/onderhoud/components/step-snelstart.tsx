"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { TemplateSelector } from "@/components/offerte/template-selector";
import { PackageSelector } from "@/components/offerte/package-selector";
import type { OffertePackage } from "@/lib/constants/packages";
import { Id } from "../../../../../../../convex/_generated/dataModel";

interface StepSnelstartProps {
  showTemplates: boolean;
  onShowPackages: () => void;
  onTemplateSelect: (
    templateId: Id<"standaardtuinen"> | null,
    templateData?: { scopes: string[]; scopeData: Record<string, unknown> }
  ) => void;
  onTemplateSkip: () => void;
  onPackageSelect: (pkg: OffertePackage) => void;
  onShowTemplates: () => void;
}

export function StepSnelstart({
  showTemplates,
  onShowPackages,
  onTemplateSelect,
  onTemplateSkip,
  onPackageSelect,
  onShowTemplates,
}: StepSnelstartProps) {
  return (
    <div className="max-w-4xl mx-auto">
      {showTemplates ? (
        <div className="space-y-4">
          <Button
            variant="ghost"
            onClick={onShowPackages}
            className="mb-2"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Terug naar Snelstart Pakketten
          </Button>
          <TemplateSelector
            type="onderhoud"
            onSelect={onTemplateSelect}
            onSkip={onTemplateSkip}
          />
        </div>
      ) : (
        <PackageSelector
          type="onderhoud"
          onSelectPackage={onPackageSelect}
          onSkip={onTemplateSkip}
          onSelectTemplate={onShowTemplates}
        />
      )}
    </div>
  );
}
