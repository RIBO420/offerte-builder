"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Shovel,
  Layers,
  Flower2,
  Trees,
  Hammer,
  Zap,
  Sparkles,
} from "lucide-react";
import {
  GrondwerkForm,
  BestratingForm,
  BordersForm,
  GrasForm,
  HoutwerkForm,
  WaterElektraForm,
  SpecialsForm,
} from "@/components/offerte/scope-forms";
import { ValidationSummary, type ScopeValidation } from "@/components/offerte/validation-summary";
import type { AanlegScope, ScopeData } from "../hooks/useAanlegWizard";
import { SCOPES } from "../hooks/useAanlegWizard";
import { AanlegNavigation } from "./AanlegNavigation";

// Scope icons mapping
const SCOPE_ICONS = {
  grondwerk: Shovel,
  bestrating: Layers,
  borders: Flower2,
  gras: Trees,
  houtwerk: Hammer,
  water_elektra: Zap,
  specials: Sparkles,
} as const;

interface AanlegScopeDetailsStepProps {
  selectedScopes: AanlegScope[];
  scopeData: ScopeData;
  scopeValidationErrors: Record<AanlegScope, Record<string, string>>;
  scopeValidationHandlers: Record<AanlegScope, (isValid: boolean, errors: Record<string, string>) => void>;
  isStep1Valid: boolean;
  isStep2Valid: boolean;
  totalSteps: number;
  isScopeDataValid: (scope: AanlegScope) => boolean;
  onScopeDataChange: (data: ScopeData) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function AanlegScopeDetailsStep({
  selectedScopes,
  scopeData,
  scopeValidationErrors,
  scopeValidationHandlers,
  isStep1Valid,
  isStep2Valid,
  totalSteps,
  isScopeDataValid,
  onScopeDataChange,
  onNext,
  onPrev,
}: AanlegScopeDetailsStepProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="lg:col-span-2 space-y-4 lg:space-y-5">
        {selectedScopes.map((scopeId) => {
          switch (scopeId) {
            case "grondwerk":
              return (
                <GrondwerkForm
                  key={scopeId}
                  data={scopeData.grondwerk}
                  onChange={(data) => onScopeDataChange({ ...scopeData, grondwerk: data })}
                  onValidationChange={scopeValidationHandlers.grondwerk}
                />
              );
            case "bestrating":
              return (
                <BestratingForm
                  key={scopeId}
                  data={scopeData.bestrating}
                  onChange={(data) => onScopeDataChange({ ...scopeData, bestrating: data })}
                  onValidationChange={scopeValidationHandlers.bestrating}
                />
              );
            case "borders":
              return (
                <BordersForm
                  key={scopeId}
                  data={scopeData.borders}
                  onChange={(data) => onScopeDataChange({ ...scopeData, borders: data })}
                  onValidationChange={scopeValidationHandlers.borders}
                />
              );
            case "gras":
              return (
                <GrasForm
                  key={scopeId}
                  data={scopeData.gras}
                  onChange={(data) => onScopeDataChange({ ...scopeData, gras: data })}
                  onValidationChange={scopeValidationHandlers.gras}
                />
              );
            case "houtwerk":
              return (
                <HoutwerkForm
                  key={scopeId}
                  data={scopeData.houtwerk}
                  onChange={(data) => onScopeDataChange({ ...scopeData, houtwerk: data })}
                  onValidationChange={scopeValidationHandlers.houtwerk}
                />
              );
            case "water_elektra":
              return (
                <WaterElektraForm
                  key={scopeId}
                  data={scopeData.water_elektra}
                  onChange={(data) => onScopeDataChange({ ...scopeData, water_elektra: data })}
                  onValidationChange={scopeValidationHandlers.water_elektra}
                />
              );
            case "specials":
              return (
                <SpecialsForm
                  key={scopeId}
                  data={scopeData.specials}
                  onChange={(data) => onScopeDataChange({ ...scopeData, specials: data })}
                  onValidationChange={scopeValidationHandlers.specials}
                />
              );
            default:
              return null;
          }
        })}
      </div>

      <div className="space-y-3">
        <Card className="sticky top-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Scope Voortgang</CardTitle>
            <CardDescription className="text-xs">
              Vul alle verplichte velden in per scope
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <ValidationSummary
              validations={selectedScopes.map((scopeId) => {
                const scope = SCOPES.find((s) => s.id === scopeId);
                const errors = scopeValidationErrors[scopeId] || {};
                const Icon = SCOPE_ICONS[scopeId];
                return {
                  scopeId,
                  scopeName: scope?.naam || scopeId,
                  isValid: isScopeDataValid(scopeId) && Object.keys(errors).length === 0,
                  errors: Object.entries(errors).map(([field, message]) => ({ field, message })),
                  icon: Icon,
                } as ScopeValidation;
              })}
            />

            <Separator />

            <AanlegNavigation
              currentStep={2}
              totalSteps={totalSteps}
              isStep1Valid={isStep1Valid}
              isStep2Valid={isStep2Valid}
              onNext={onNext}
              onPrev={onPrev}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
