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
  SquareParking,
  Droplets,
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
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { KlantSelector } from "@/components/offerte/klant-selector";
import type { Bereikbaarheid } from "@/types/offerte";
import type { AanlegScope } from "../hooks/useAanlegWizard";
import { SCOPES } from "../hooks/useAanlegWizard";
import { AanlegNavigation } from "./AanlegNavigation";
import { Id } from "../../../../../../../convex/_generated/dataModel";

// Scope icons mapping
const SCOPE_ICONS = {
  grondwerk: Shovel,
  bestrating: Layers,
  parkeerplaats: SquareParking,
  beregening: Droplets,
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
  klantvriendelijkheid?: number;
  onKlantDataChange: (data: KlantData) => void;
  onKlantSelect: (klantId: string | null) => void;
  onLeadSelect?: (leadId: string | null) => void;
  initialLeadId?: Id<"configuratorAanvragen">;
  onBereikbaarheidChange: (value: Bereikbaarheid) => void;
  onToggleScope: (scopeId: AanlegScope) => void;
  onKlantvriendelijkheidChange?: (value: number) => void;
  onNext: () => void;
  onPrev: () => void;
}

// WS6: geherformuleerd — "Klantvriendelijkheid (Lastig—Makkelijk)" was intern
// jargon dat pijnlijk wordt zodra een klant meekijkt. De schaal beschrijft nu
// de verwachte afstemming, niet de klant zelf.
const KLANTVRIENDELIJKHEID_LABELS: Record<number, string> = {
  1: "Veel afstemming",
  2: "Extra afstemming",
  3: "Normaal",
  4: "Soepel",
  5: "Zeer soepel",
};

export function AanlegKlantScopesStep({
  klantData,
  bereikbaarheid,
  selectedScopes,
  hasVerplichtWarning,
  isStep1Valid,
  isStep2Valid,
  totalSteps,
  klantvriendelijkheid = 3,
  onKlantDataChange,
  onKlantSelect,
  onLeadSelect,
  initialLeadId,
  onBereikbaarheidChange,
  onToggleScope,
  onKlantvriendelijkheidChange,
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
              onLeadSelect={(leadId) => onLeadSelect?.(leadId as string)}
              initialLeadId={initialLeadId}
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

            {onKlantvriendelijkheidChange && (
              <>
                <Separator className="my-4" />
                <div className="space-y-3">
                  <Label>Samenwerking met de klant</Label>
                  <div className="px-1">
                    <Slider
                      value={[klantvriendelijkheid]}
                      onValueChange={([val]) => onKlantvriendelijkheidChange(val)}
                      min={1}
                      max={5}
                      step={1}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1 - Veel afstemming</span>
                    <span>3 - Normaal</span>
                    <span>5 - Zeer soepel</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Huidige inschatting:{" "}
                    <span className="font-medium text-foreground">
                      {klantvriendelijkheid} - {KLANTVRIENDELIJKHEID_LABELS[klantvriendelijkheid] || "Normaal"}
                    </span>
                  </p>
                </div>
              </>
            )}
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
            {/* Checklist-look (WS6): multi-select leest als aanvinklijst, niet
                als hetzelfde grote tegelraster als de één-keuze-dialoog. */}
            <div className="grid gap-1.5 md:grid-cols-2">
              {SCOPES.map((scope) => {
                const isSelected = selectedScopes.includes(scope.id);
                const Icon = SCOPE_ICONS[scope.id];
                return (
                  <div
                    key={scope.id}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 transition-colors touch-manipulation ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
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
                    <span
                      className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border transition-colors ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background"
                      }`}
                      aria-hidden="true"
                    >
                      {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Icon
                          className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                            isSelected ? "text-primary" : "text-muted-foreground"
                          }`}
                        />
                        <span className="text-sm font-medium">{scope.naam}</span>
                        {scope.verplicht &&
                          scope.verplicht.map((v) => (
                            <Badge key={v} variant="secondary" className="text-[10px] px-1.5 py-0">
                              + {v}
                            </Badge>
                          ))}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                        {scope.beschrijving}
                      </p>
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

      {/* Rail: op deze stap alleen een compacte scopes-teller (WS6) — een
          samenvatting die de velden ernaast letterlijk herhaalde, vatte niets
          samen. De volledige samenvatting komt vanaf stap 3/review. */}
      <div className="space-y-3">
        <Card className="sticky top-4">
          <CardContent className="space-y-3 pt-4">
            <div className="flex items-center gap-2 text-sm">
              {selectedScopes.length > 0 ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              )}
              <span>
                {selectedScopes.length > 0
                  ? `${selectedScopes.length} scope${selectedScopes.length === 1 ? "" : "s"} geselecteerd`
                  : "Nog geen scopes geselecteerd"}
              </span>
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
