"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Shovel,
  Layers,
  Flower2,
  Trees,
  Hammer,
  Zap,
  Sparkles,
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { KlantSelector } from "@/components/offerte/klant-selector";
import type { Bereikbaarheid } from "@/types/offerte";
import type { AanlegScope } from "../hooks/useAanlegWizard";
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

interface KlantData {
  naam: string;
  adres: string;
  postcode: string;
  plaats: string;
  email: string;
  telefoon: string;
}

interface AanlegKlantScopesStepProps {
  klantData: KlantData;
  bereikbaarheid: Bereikbaarheid;
  selectedScopes: AanlegScope[];
  hasVerplichtWarning: boolean;
  isStep1Valid: boolean;
  isStep2Valid: boolean;
  totalSteps: number;
  onKlantDataChange: (data: KlantData) => void;
  onKlantSelect: (klantId: string | null) => void;
  onBereikbaarheidChange: (value: Bereikbaarheid) => void;
  onToggleScope: (scopeId: AanlegScope) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function AanlegKlantScopesStep({
  klantData,
  bereikbaarheid,
  selectedScopes,
  hasVerplichtWarning,
  isStep1Valid,
  isStep2Valid,
  totalSteps,
  onKlantDataChange,
  onKlantSelect,
  onBereikbaarheidChange,
  onToggleScope,
  onNext,
  onPrev,
}: AanlegKlantScopesStepProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="lg:col-span-2 space-y-4 lg:space-y-6">
        {/* Klantgegevens */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Klantgegevens</CardTitle>
            <CardDescription className="text-xs">
              Selecteer een bestaande klant of voer nieuwe gegevens in
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <KlantSelector
              value={klantData}
              onChange={onKlantDataChange}
              onKlantSelect={(klantId) => onKlantSelect(klantId as string | null)}
            />
          </CardContent>
        </Card>

        {/* Algemene Parameters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Algemene Parameters</CardTitle>
            <CardDescription className="text-xs">
              Parameters die van toepassing zijn op alle scopes
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <Label htmlFor="bereikbaarheid">Bereikbaarheid</Label>
              <Select
                value={bereikbaarheid}
                onValueChange={(v) => onBereikbaarheidChange(v as Bereikbaarheid)}
              >
                <SelectTrigger id="bereikbaarheid">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="goed">Goed (factor 1.0)</SelectItem>
                  <SelectItem value="beperkt">Beperkt (factor 1.2)</SelectItem>
                  <SelectItem value="slecht">Slecht (factor 1.5)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Beperkte bereikbaarheid verhoogt de arbeidsuren
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Scope Selectie */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Scope Selectie</CardTitle>
            <CardDescription className="text-xs">
              Selecteer de werkzaamheden die onderdeel zijn van het project.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-2 md:grid-cols-2 lg:gap-3">
              {SCOPES.map((scope) => {
                const isSelected = selectedScopes.includes(scope.id);
                const Icon = SCOPE_ICONS[scope.id];
                return (
                  <div
                    key={scope.id}
                    className={`relative flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-all duration-200 hover:shadow-md active:scale-[0.98] touch-manipulation ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                    onClick={() => onToggleScope(scope.id)}
                    role="checkbox"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        onToggleScope(scope.id);
                      }
                    }}
                  >
                    <div
                      className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 transition-all duration-200 ${
                        isSelected
                          ? `${scope.color} border-transparent text-white scale-100`
                          : "border-input bg-background scale-95"
                      }`}
                    >
                      {isSelected ? (
                        <Check className="h-5 w-5 animate-in zoom-in-50 duration-200" strokeWidth={3} />
                      ) : (
                        <Icon className="h-4 w-4 text-muted-foreground opacity-50" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Icon className={`h-4 w-4 shrink-0 transition-colors ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        <Label htmlFor={scope.id} className="cursor-pointer font-medium text-sm">
                          {scope.naam}
                        </Label>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                        {scope.beschrijving}
                      </p>
                      {scope.verplicht && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {scope.verplicht.map((v) => (
                            <Badge key={v} variant="secondary" className="text-[10px] px-1.5 py-0">
                              + {v}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {hasVerplichtWarning && selectedScopes.length > 0 && (
              <Alert className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Verplichte onderdelen</AlertTitle>
                <AlertDescription>
                  Sommige geselecteerde scopes hebben verplichte onderdelen
                  die automatisch worden meegenomen in de offerte.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sidebar met samenvatting */}
      <div className="space-y-3">
        <Card className="sticky top-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Samenvatting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="flex items-start gap-2">
              {klantData.naam && klantData.adres ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Klant</p>
                <p className="text-sm truncate" title={klantData.naam ? `${klantData.naam}${klantData.plaats ? `, ${klantData.plaats}` : ""}` : undefined}>
                  {klantData.naam || "—"}
                  {klantData.plaats && `, ${klantData.plaats}`}
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Bereikbaarheid</p>
                <p className="text-sm capitalize">{bereikbaarheid}</p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-2">
              {selectedScopes.length > 0 ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Geselecteerde scopes ({selectedScopes.length})
                </p>
                {selectedScopes.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {selectedScopes.map((scopeId) => {
                      const scope = SCOPES.find((s) => s.id === scopeId);
                      return (
                        <li key={scopeId} className="flex items-center gap-2 text-sm animate-in fade-in slide-in-from-left-2 duration-200">
                          <div className={`h-2 w-2 rounded-full ${scope?.color || "bg-primary"}`} />
                          {scope?.naam}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Geen scopes geselecteerd</p>
                )}
              </div>
            </div>

            <Separator />

            <AanlegNavigation
              currentStep={1}
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
