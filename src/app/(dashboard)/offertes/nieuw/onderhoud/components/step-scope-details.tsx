"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChevronRight, ChevronLeft } from "lucide-react";
import {
  GrasOnderhoudForm,
  BordersOnderhoudForm,
  HeggenForm,
  BomenForm,
  OverigForm,
  ReinigingForm,
  BemestingForm,
  GazonanalyseForm,
  MollenbestrijdingForm,
} from "@/components/offerte/onderhoud-forms";
import { ValidationSummary, type ScopeValidation } from "@/components/offerte/validation-summary";
import { SCOPES } from "./constants";
import type { OnderhoudScope, OnderhoudScopeData } from "./types";

interface StepScopeDetailsProps {
  selectedScopes: OnderhoudScope[];
  scopeData: OnderhoudScopeData;
  setScopeData: (data: OnderhoudScopeData) => void;
  scopeValidationHandlers: Record<OnderhoudScope, (_isValid: boolean, errors: Record<string, string>) => void>;
  scopeValidationErrors: Record<OnderhoudScope, Record<string, string>>;
  isScopeDataValid: (scope: OnderhoudScope) => boolean;
  isStep2Valid: boolean;
  nextStep: () => void;
  prevStep: () => void;
}

export function StepScopeDetails({
  selectedScopes,
  scopeData,
  setScopeData,
  scopeValidationHandlers,
  scopeValidationErrors,
  isScopeDataValid,
  isStep2Valid,
  nextStep,
  prevStep,
}: StepScopeDetailsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
      <div className="lg:col-span-2 space-y-4 lg:space-y-5">
        {selectedScopes.map((scopeId) => {
          switch (scopeId) {
            case "gras":
              return (
                <GrasOnderhoudForm
                  key={scopeId}
                  data={scopeData.gras}
                  onChange={(data) =>
                    setScopeData({ ...scopeData, gras: data })
                  }
                  onValidationChange={scopeValidationHandlers.gras}
                />
              );
            case "borders":
              return (
                <BordersOnderhoudForm
                  key={scopeId}
                  data={scopeData.borders}
                  onChange={(data) =>
                    setScopeData({ ...scopeData, borders: data })
                  }
                  onValidationChange={scopeValidationHandlers.borders}
                />
              );
            case "heggen":
              return (
                <HeggenForm
                  key={scopeId}
                  data={scopeData.heggen}
                  onChange={(data) =>
                    setScopeData({ ...scopeData, heggen: data })
                  }
                  onValidationChange={scopeValidationHandlers.heggen}
                />
              );
            case "bomen":
              return (
                <BomenForm
                  key={scopeId}
                  data={scopeData.bomen}
                  onChange={(data) =>
                    setScopeData({ ...scopeData, bomen: data })
                  }
                  onValidationChange={scopeValidationHandlers.bomen}
                />
              );
            case "overig":
              return (
                <OverigForm
                  key={scopeId}
                  data={scopeData.overig}
                  onChange={(data) =>
                    setScopeData({ ...scopeData, overig: data })
                  }
                  onValidationChange={scopeValidationHandlers.overig}
                />
              );
            case "reiniging":
              return (
                <ReinigingForm
                  key={scopeId}
                  data={scopeData.reiniging}
                  onChange={(data) =>
                    setScopeData({ ...scopeData, reiniging: data })
                  }
                  onValidationChange={scopeValidationHandlers.reiniging}
                />
              );
            case "bemesting":
              return (
                <BemestingForm
                  key={scopeId}
                  data={scopeData.bemesting}
                  onChange={(data) =>
                    setScopeData({ ...scopeData, bemesting: data })
                  }
                  onValidationChange={scopeValidationHandlers.bemesting}
                />
              );
            case "gazonanalyse":
              return (
                <GazonanalyseForm
                  key={scopeId}
                  data={scopeData.gazonanalyse}
                  onChange={(data) =>
                    setScopeData({ ...scopeData, gazonanalyse: data })
                  }
                  onValidationChange={scopeValidationHandlers.gazonanalyse}
                />
              );
            case "mollenbestrijding":
              return (
                <MollenbestrijdingForm
                  key={scopeId}
                  data={scopeData.mollenbestrijding}
                  onChange={(data) =>
                    setScopeData({ ...scopeData, mollenbestrijding: data })
                  }
                  onValidationChange={scopeValidationHandlers.mollenbestrijding}
                />
              );
            default:
              return null;
          }
        })}
      </div>

      {/* Sidebar met voortgang */}
      <div className="space-y-3">
        <Card className="sticky top-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Voortgang</CardTitle>
            <CardDescription className="text-xs">
              Vul alle verplichte velden in per werkzaamheid
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <ValidationSummary
              validations={selectedScopes.map((scopeId) => {
                const scope = SCOPES.find((s) => s.id === scopeId);
                const errors = scopeValidationErrors[scopeId] || {};
                return {
                  scopeId,
                  scopeName: scope?.naam || scopeId,
                  isValid: isScopeDataValid(scopeId) && Object.keys(errors).length === 0,
                  errors: Object.entries(errors).map(([field, message]) => ({
                    field,
                    message,
                  })),
                  icon: scope?.icon,
                } as ScopeValidation;
              })}
            />

            <Separator />

            <div className="space-y-2">
              <Button
                className="w-full"
                disabled={!isStep2Valid}
                onClick={nextStep}
              >
                Volgende: Bevestigen
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>

              <Button variant="outline" className="w-full" onClick={prevStep}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Terug
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
