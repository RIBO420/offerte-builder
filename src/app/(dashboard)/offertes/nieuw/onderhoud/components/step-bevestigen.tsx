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
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft,
  AlertTriangle,
  Loader2,
  Check,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SCOPES } from "./constants";
import type { OnderhoudScope, OnderhoudScopeData } from "./types";

interface StepBevestigenProps {
  klantData: {
    naam: string;
    adres: string;
    postcode: string;
    plaats: string;
    email: string;
    telefoon: string;
  };
  tuinOppervlakte: string;
  bereikbaarheid: string;
  achterstalligheid: string;
  selectedScopes: OnderhoudScope[];
  scopeData: OnderhoudScopeData;
  isSubmitting: boolean;
  onSubmit: () => void;
  prevStep: () => void;
}

export function StepBevestigen({
  klantData,
  tuinOppervlakte,
  bereikbaarheid,
  achterstalligheid,
  selectedScopes,
  scopeData,
  isSubmitting,
  onSubmit,
  prevStep,
}: StepBevestigenProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
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
                <dd className="text-sm">{klantData.telefoon || "\u2014"}</dd>
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
                  Tuinoppervlakte
                </dt>
                <dd className="text-sm">
                  {tuinOppervlakte ? `${tuinOppervlakte} m\u00B2` : "\u2014"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Bereikbaarheid / Achterstalligheid
                </dt>
                <dd className="text-sm capitalize">
                  {bereikbaarheid} / {achterstalligheid}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Werkzaamheden samenvatting */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Geselecteerde Werkzaamheden</CardTitle>
            <CardDescription className="text-xs">
              Overzicht van alle onderhoudswerkzaamheden
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {selectedScopes.map((scopeId) => {
              const scope = SCOPES.find((s) => s.id === scopeId);
              return (
                <div
                  key={scopeId}
                  className="rounded-lg border p-3 space-y-1"
                >
                  <div className="flex items-center gap-2">
                    {scope?.icon && (
                      <scope.icon className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="font-medium">{scope?.naam}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {scopeId === "gras" && (
                      <>
                        {scopeData.gras.grasAanwezig ? (
                          <>
                            {scopeData.gras.grasOppervlakte} m²
                            {scopeData.gras.maaien && ", maaien"}
                            {scopeData.gras.kantenSteken && ", kanten steken"}
                            {scopeData.gras.verticuteren && ", verticuteren"}
                            {scopeData.gras.afvoerGras && ", incl. afvoer"}
                          </>
                        ) : (
                          "Geen gras aanwezig"
                        )}
                      </>
                    )}
                    {scopeId === "borders" && (
                      <>
                        {scopeData.borders.borderOppervlakte} m², intensiteit:{" "}
                        {scopeData.borders.onderhoudsintensiteit}
                        {scopeData.borders.onkruidVerwijderen && ", wieden"}
                        {scopeData.borders.snoeiInBorders !== "geen" &&
                          `, snoei: ${scopeData.borders.snoeiInBorders}`}
                        <br />
                        Bodem: {scopeData.borders.bodem}
                        {scopeData.borders.afvoerGroenafval && ", incl. afvoer"}
                      </>
                    )}
                    {scopeId === "heggen" && (
                      <>
                        {scopeData.heggen.lengte}m × {scopeData.heggen.hoogte}m × {scopeData.heggen.breedte}m
                        {" = "}
                        {(scopeData.heggen.lengte * scopeData.heggen.hoogte * scopeData.heggen.breedte).toFixed(1)} m³
                        <br />
                        Snoei: {scopeData.heggen.snoei}
                        {scopeData.heggen.afvoerSnoeisel && ", incl. afvoer"}
                      </>
                    )}
                    {scopeId === "bomen" && (
                      <>
                        {scopeData.bomen.aantalBomen} bomen, snoei:{" "}
                        {scopeData.bomen.snoei}, hoogte: {scopeData.bomen.hoogteklasse}
                        {scopeData.bomen.afvoer && ", incl. afvoer"}
                      </>
                    )}
                    {scopeId === "overig" && (
                      <>
                        {[
                          scopeData.overig.bladruimen && "Bladruimen",
                          scopeData.overig.terrasReinigen && `Terras (${scopeData.overig.terrasOppervlakte || 0}m²)`,
                          scopeData.overig.onkruidBestrating && `Onkruid bestrating (${scopeData.overig.bestratingOppervlakte || 0}m²)`,
                          scopeData.overig.afwateringControleren && `Afwatering (${scopeData.overig.aantalAfwateringspunten || 0} punten)`,
                          scopeData.overig.overigNotities && "Overige werkzaamheden",
                        ].filter(Boolean).join(", ") || "Geen specifieke werkzaamheden"}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
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
        <Card className="sticky top-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Offerte Aanmaken</CardTitle>
            <CardDescription className="text-xs">
              Controleer de gegevens en maak de offerte aan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Werkzaamheden</span>
                <span className="font-medium">{selectedScopes.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Verplichte velden</span>
                <span className="font-medium">
                  {selectedScopes.filter((s) =>
                    SCOPES.find((sc) => sc.id === s)?.verplicht
                  ).length}
                </span>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Button
                className="w-full"
                disabled={isSubmitting}
                onClick={onSubmit}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Offerte Aanmaken
              </Button>

              <Button variant="outline" className="w-full" onClick={prevStep}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Terug naar Details
              </Button>

              <Button variant="ghost" className="w-full" asChild>
                <Link href="/offertes">Annuleren</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
