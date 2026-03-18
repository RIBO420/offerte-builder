"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { KlantSelector } from "@/components/offerte/klant-selector";
import type { Bereikbaarheid, Achterstalligheid } from "@/types/offerte";
import { SCOPES } from "./constants";
import type { OnderhoudScope } from "./types";

interface StepKlantScopesProps {
  klantData: {
    naam: string;
    adres: string;
    postcode: string;
    plaats: string;
    email: string;
    telefoon: string;
  };
  setKlantData: (data: StepKlantScopesProps["klantData"]) => void;
  setSelectedKlantId: (id: string | null) => void;
  tuinOppervlakte: string;
  setTuinOppervlakte: (value: string) => void;
  bereikbaarheid: Bereikbaarheid;
  setBereikbaarheid: (value: Bereikbaarheid) => void;
  achterstalligheid: Achterstalligheid;
  setAchterstalligheid: (value: Achterstalligheid) => void;
  selectedScopes: OnderhoudScope[];
  toggleScope: (scopeId: OnderhoudScope) => void;
  hasVerplichtWarning: boolean;
  isStep1Valid: unknown;
  nextStep: () => void;
  prevStep: () => void;
}

export function StepKlantScopes({
  klantData,
  setKlantData,
  setSelectedKlantId,
  tuinOppervlakte,
  setTuinOppervlakte,
  bereikbaarheid,
  setBereikbaarheid,
  achterstalligheid,
  setAchterstalligheid,
  selectedScopes,
  toggleScope,
  hasVerplichtWarning,
  isStep1Valid,
  nextStep,
  prevStep,
}: StepKlantScopesProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
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
              onChange={setKlantData}
              onKlantSelect={(klantId) => setSelectedKlantId(klantId as string | null)}
            />
          </CardContent>
        </Card>

        {/* Algemene Parameters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Algemene Parameters</CardTitle>
            <CardDescription className="text-xs">
              Parameters die van toepassing zijn op alle werkzaamheden
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="space-y-2">
              <Label htmlFor="tuinoppervlakte">
                Totale tuinoppervlakte (m²)
              </Label>
              <Input
                id="tuinoppervlakte"
                type="number"
                placeholder="150"
                value={tuinOppervlakte}
                onChange={(e) => setTuinOppervlakte(e.target.value)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bereikbaarheid">Bereikbaarheid</Label>
                <Select
                  value={bereikbaarheid}
                  onValueChange={(v) =>
                    setBereikbaarheid(v as Bereikbaarheid)
                  }
                >
                  <SelectTrigger id="bereikbaarheid">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="goed">Goed (factor 1.0)</SelectItem>
                    <SelectItem value="beperkt">
                      Beperkt (factor 1.2)
                    </SelectItem>
                    <SelectItem value="slecht">
                      Slecht (factor 1.5)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="achterstalligheid">Achterstalligheid</Label>
                <Select
                  value={achterstalligheid}
                  onValueChange={(v) =>
                    setAchterstalligheid(v as Achterstalligheid)
                  }
                >
                  <SelectTrigger id="achterstalligheid">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="laag">Laag (factor 1.0)</SelectItem>
                    <SelectItem value="gemiddeld">
                      Gemiddeld (factor 1.3)
                    </SelectItem>
                    <SelectItem value="hoog">Hoog (factor 1.6)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Achterstallig onderhoud verhoogt de arbeidsuren met de
              achterstaligheidsfactor
            </p>
          </CardContent>
        </Card>

        {/* Scope Selectie */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Werkzaamheden Selectie</CardTitle>
            <CardDescription className="text-xs">
              Selecteer de onderhoudswerkzaamheden.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-2 md:grid-cols-2 lg:gap-3">
              {SCOPES.map((scope) => {
                const isSelected = selectedScopes.includes(scope.id);
                return (
                  <div
                    key={scope.id}
                    className={`relative flex cursor-pointer items-start space-x-2 rounded-lg border p-3 transition-colors hover:bg-muted/50 active:bg-muted/70 touch-manipulation ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                    onClick={() => toggleScope(scope.id)}
                  >
                    <Checkbox
                      id={scope.id}
                      checked={isSelected}
                      onCheckedChange={() => toggleScope(scope.id)}
                      className="mt-0.5 h-5 w-5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <scope.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <Label
                          htmlFor={scope.id}
                          className="cursor-pointer font-medium text-sm"
                        >
                          {scope.naam}
                        </Label>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                        {scope.beschrijving}
                      </p>
                      {scope.verplicht && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {scope.verplicht.map((v) => (
                            <Badge
                              key={v}
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 border-amber-500 text-amber-600"
                            >
                              verplicht: {v}
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
              <Alert className="mt-4" variant="default">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Verplichte velden</AlertTitle>
                <AlertDescription>
                  <strong>Borders:</strong> Onderhoudsintensiteit is
                  verplicht.
                  <br />
                  <strong>Heggen:</strong> Lengte, hoogte en breedte zijn
                  alle drie verplicht voor de volumeberekening.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sidebar met samenvatting */}
      <div className="space-y-3">
        <Card className="sticky top-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Samenvatting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Klant
              </p>
              <p className="text-sm">
                {klantData.naam || "\u2014"}
                {klantData.plaats && `, ${klantData.plaats}`}
              </p>
            </div>

            <Separator />

            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Tuinoppervlakte
              </p>
              <p className="text-sm">
                {tuinOppervlakte ? `${tuinOppervlakte} m\u00B2` : "\u2014"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Bereikbaarheid
                </p>
                <p className="text-sm capitalize">{bereikbaarheid}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Achterstalligheid
                </p>
                <p className="text-sm capitalize">{achterstalligheid}</p>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Geselecteerde werkzaamheden ({selectedScopes.length})
              </p>
              {selectedScopes.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {selectedScopes.map((scopeId) => {
                    const scope = SCOPES.find((s) => s.id === scopeId);
                    return (
                      <li
                        key={scopeId}
                        className="flex items-center gap-2 text-sm"
                      >
                        {scope?.icon && (
                          <scope.icon className="h-3 w-3 text-muted-foreground" />
                        )}
                        {scope?.naam}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Geen werkzaamheden geselecteerd
                </p>
              )}
            </div>

            <Separator />

            <Button
              className="w-full"
              disabled={!isStep1Valid}
              onClick={nextStep}
            >
              Volgende: Details
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>

            <Button variant="outline" className="w-full" onClick={prevStep}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Terug naar Template
            </Button>

            <Button variant="ghost" className="w-full" asChild>
              <Link href="/offertes">Annuleren</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
