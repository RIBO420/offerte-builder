"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { AanlegScope, ScopeData } from "../hooks/useAanlegWizard";
import { SCOPES } from "../hooks/useAanlegWizard";
import type { Bereikbaarheid } from "@/types/offerte";
import { AanlegNavigation } from "./AanlegNavigation";

interface KlantData {
  naam: string;
  adres: string;
  postcode: string;
  plaats: string;
  email: string;
  telefoon: string;
}

interface AanlegReviewSectionProps {
  klantData: KlantData;
  bereikbaarheid: Bereikbaarheid;
  selectedScopes: AanlegScope[];
  scopeData: ScopeData;
  isSubmitting: boolean;
  onSubmit: () => void;
  onPrev: () => void;
}

export function AanlegReviewSection({
  klantData,
  bereikbaarheid,
  selectedScopes,
  scopeData,
  isSubmitting,
  onSubmit,
  onPrev,
}: AanlegReviewSectionProps) {
  const renderScopeSummary = (scopeId: AanlegScope) => {
    const scope = SCOPES.find((s) => s.id === scopeId);

    return (
      <div
        key={scopeId}
        className="rounded-lg border p-3 space-y-1 transition-all hover:shadow-sm"
      >
        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-lg ${scope?.color || "bg-primary"} flex items-center justify-center`}>
            <span className="text-white text-xs font-bold">
              {scope?.naam?.charAt(0) || "?"}
            </span>
          </div>
          <span className="font-medium">{scope?.naam}</span>
          <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto" />
        </div>
        <div className="text-sm text-muted-foreground">
          {scopeId === "grondwerk" && (
            <>
              {scopeData.grondwerk.oppervlakte} m², diepte:{" "}
              {scopeData.grondwerk.diepte}
              {scopeData.grondwerk.afvoerGrond && ", incl. afvoer"}
            </>
          )}
          {scopeId === "bestrating" && (
            <>
              {scopeData.bestrating.oppervlakte} m²,{" "}
              {scopeData.bestrating.typeBestrating}, snijwerk:{" "}
              {scopeData.bestrating.snijwerk}
              <br />
              Onderbouw: {scopeData.bestrating.onderbouw.type},{" "}
              {scopeData.bestrating.onderbouw.dikteOnderlaag}cm
              {scopeData.bestrating.onderbouw.opsluitbanden &&
                ", incl. opsluitbanden"}
            </>
          )}
          {scopeId === "borders" && (
            <>
              {scopeData.borders.oppervlakte} m², intensiteit:{" "}
              {scopeData.borders.beplantingsintensiteit}
              {scopeData.borders.bodemverbetering &&
                ", incl. bodemverbetering"}
              {scopeData.borders.afwerking !== "geen" &&
                `, afwerking: ${scopeData.borders.afwerking}`}
            </>
          )}
          {scopeId === "gras" && (
            <>
              {scopeData.gras.oppervlakte} m², {scopeData.gras.type}
              , ondergrond: {scopeData.gras.ondergrond}
              {scopeData.gras.afwateringNodig &&
                ", incl. drainage"}
            </>
          )}
          {scopeId === "houtwerk" && (
            <>
              {scopeData.houtwerk.typeHoutwerk},{" "}
              {scopeData.houtwerk.afmeting}
              {scopeData.houtwerk.typeHoutwerk === "schutting"
                ? " m"
                : " m²"}
              <br />
              Fundering: {scopeData.houtwerk.fundering}
            </>
          )}
          {scopeId === "water_elektra" && (
            <>
              Verlichting: {scopeData.water_elektra.verlichting}
              {scopeData.water_elektra.aantalPunten > 0 &&
                `, ${scopeData.water_elektra.aantalPunten} aansluitpunten`}
              <br />
              Incl. sleuven en herstelwerk
            </>
          )}
          {scopeId === "specials" && (
            <>
              {scopeData.specials.items.length} item(s):{" "}
              {scopeData.specials.items
                .map((i) => i.omschrijving)
                .join(", ")}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="lg:col-span-2 space-y-4 lg:space-y-5">
        {/* Klant samenvatting */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Klantgegevens</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <dl className="grid gap-4 md:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Naam
                </dt>
                <dd className="text-sm">{klantData.naam}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Telefoon
                </dt>
                <dd className="text-sm">{klantData.telefoon || "—"}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-sm font-medium text-muted-foreground">
                  Adres
                </dt>
                <dd className="text-sm">
                  {klantData.adres}, {klantData.postcode} {klantData.plaats}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  E-mail
                </dt>
                <dd className="text-sm">{klantData.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Bereikbaarheid
                </dt>
                <dd className="text-sm capitalize">{bereikbaarheid}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Scopes samenvatting */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Geselecteerde Scopes</CardTitle>
            <CardDescription className="text-xs">
              Overzicht van alle werkzaamheden
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {selectedScopes.map(renderScopeSummary)}
          </CardContent>
        </Card>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Let op</AlertTitle>
          <AlertDescription>
            Na het aanmaken wordt de offerte berekend op basis van de
            normuren en correctiefactoren. U kunt de offerte daarna nog
            bewerken.
          </AlertDescription>
        </Alert>
      </div>

      {/* Sidebar met acties */}
      <div className="space-y-3">
        <Card className="sticky top-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Offerte Aanmaken</CardTitle>
            <CardDescription className="text-xs">
              Controleer de gegevens en maak de offerte aan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {/* Checklist voor voltooide secties */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Klantgegevens ingevuld</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>{selectedScopes.length} scope{selectedScopes.length !== 1 ? "s" : ""} geselecteerd</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Scope details ingevuld</span>
              </div>
            </div>

            <Separator />

            {/* Scope overzicht met kleuren */}
            <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground mb-2">Geselecteerde scopes</p>
              {selectedScopes.map((scopeId) => {
                const scope = SCOPES.find((s) => s.id === scopeId);
                return (
                  <div key={scopeId} className="flex items-center gap-2 text-sm">
                    <div className={`h-2 w-2 rounded-full ${scope?.color || "bg-primary"}`} />
                    <span>{scope?.naam}</span>
                  </div>
                );
              })}
            </div>

            <Separator />

            <AanlegNavigation
              currentStep={3}
              totalSteps={4}
              isStep1Valid={true}
              isStep2Valid={true}
              isSubmitting={isSubmitting}
              onNext={() => {}}
              onPrev={onPrev}
              onSubmit={onSubmit}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
