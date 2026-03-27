"use client";

import Link from "next/link";
import { Doc } from "../../../../../../../convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Receipt } from "lucide-react";
import { WorkflowStepIndicator } from "./workflow-step-indicator";
import { InvoicePreviewCard } from "./invoice-preview-card";
import { formatCurrency } from "./types";

interface NoFactuurStateProps {
  projectId: string;
  projectNaam: string;
  offerte: Doc<"offertes"> | null;
  nacalculatie: Doc<"nacalculaties"> | null;
  project: Doc<"projecten">;
  onGenerate: () => Promise<void>;
  isGenerating: boolean;
}

export function NoFactuurState({
  projectId,
  projectNaam,
  offerte,
  nacalculatie,
  project,
  onGenerate,
  isGenerating,
}: NoFactuurStateProps) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" asChild aria-label="Terug naar project">
            <Link href={`/projecten/${projectId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <Receipt className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Factuur
              </h1>
            </div>
            <p className="text-muted-foreground">{projectNaam}</p>
          </div>
        </div>
      </div>

      {/* Workflow Step Indicator */}
      <Card className="p-4 md:p-6">
        <WorkflowStepIndicator currentStep={0} status={null} />
      </Card>

      {/* Invoice Preview Card with Info Sidebar */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <InvoicePreviewCard
            offerte={offerte}
            nacalculatie={nacalculatie ?? null}
            project={project}
            onGenerate={onGenerate}
            isGenerating={isGenerating}
          />
        </div>

        {/* Info sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hoe werkt het?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                  1
                </div>
                <div>
                  <p className="font-medium">Genereer</p>
                  <p className="text-sm text-muted-foreground">
                    Maak de factuur aan op basis van de offerte
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                  2
                </div>
                <div>
                  <p className="font-medium">Controleer</p>
                  <p className="text-sm text-muted-foreground">
                    Bekijk de factuur en maak eventueel aanpassingen
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                  3
                </div>
                <div>
                  <p className="font-medium">Verstuur</p>
                  <p className="text-sm text-muted-foreground">
                    Verstuur de factuur naar de klant via e-mail
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200 text-sm font-medium">
                  4
                </div>
                <div>
                  <p className="font-medium">Betaald</p>
                  <p className="text-sm text-muted-foreground">
                    Markeer als betaald wanneer de betaling is ontvangen
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick stats from offerte */}
          {offerte && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Offerte gegevens</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Klant</span>
                  <span className="font-medium">{offerte.klant.naam}</span>
                </div>
                {offerte.klant.email && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">E-mail</span>
                    <span className="font-medium truncate max-w-[150px]" title={offerte.klant.email}>
                      {offerte.klant.email}
                    </span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Totaal</span>
                  <span className="font-bold text-lg text-primary">
                    {formatCurrency(offerte.totalen.totaalInclBtw)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
