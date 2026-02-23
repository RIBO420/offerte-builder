"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Clock,
  Mail,
  CalendarCheck,
  Loader2,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BetalingStatus = "open" | "betaald" | "mislukt";

function betalingStatusLabel(status: BetalingStatus): string {
  switch (status) {
    case "betaald":
      return "Betaald";
    case "open":
      return "In afwachting";
    case "mislukt":
      return "Mislukt";
  }
}

function betalingStatusVariant(
  status: BetalingStatus
): "default" | "secondary" | "destructive" {
  switch (status) {
    case "betaald":
      return "default";
    case "open":
      return "secondary";
    case "mislukt":
      return "destructive";
  }
}

// ---------------------------------------------------------------------------
// Volgende stappen component
// ---------------------------------------------------------------------------

const VOLGENDE_STAPPEN = [
  {
    icon: Clock,
    titel: "Wij beoordelen uw aanvraag",
    omschrijving: "Binnen 2 werkdagen bekijken wij uw aanvraag en nemen contact op.",
  },
  {
    icon: Mail,
    titel: "Bevestiging per e-mail",
    omschrijving: "U ontvangt een bevestiging op het door u opgegeven e-mailadres.",
  },
  {
    icon: CalendarCheck,
    titel: "Inplannen van de werkzaamheden",
    omschrijving: "Na goedkeuring plannen wij samen met u de werkzaamheden in.",
  },
] as const;

// ---------------------------------------------------------------------------
// Aanvraag ophalen + weergeven
// ---------------------------------------------------------------------------

interface BedanktMetReferentieProps {
  referentie: string;
  betaald: boolean;
}

function BedanktMetReferentie({ referentie, betaald }: BedanktMetReferentieProps) {
  const aanvraag = useQuery(api.configuratorAanvragen.getByReferentie, {
    referentie,
  });

  const isLaden = aanvraag === undefined;

  return (
    <div className="container max-w-2xl mx-auto px-4 py-12">
      <Card className="border-green-200 shadow-lg overflow-hidden">
        {/* Groene top-banner */}
        <div className="h-2 bg-gradient-to-r from-green-500 to-green-600" />

        <CardHeader className="pt-10 pb-6 text-center space-y-4">
          {/* Vinkje met pulse animatie */}
          <div className="flex justify-center">
            <div className="relative inline-flex">
              <span className="absolute inset-0 rounded-full bg-green-200 animate-ping opacity-60" />
              <CheckCircle2
                className="relative h-16 w-16 text-green-600"
                strokeWidth={1.5}
              />
            </div>
          </div>

          <div className="space-y-1">
            <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-900">
              Bedankt voor uw aanvraag!
            </CardTitle>
            {betaald && (
              <p className="text-green-700 font-medium text-base">
                Uw aanbetaling is ontvangen
              </p>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-8 pb-10">
          {/* Referentienummer */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-muted-foreground">Uw referentienummer</p>
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-5 py-3">
              <FileText className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span className="text-lg font-mono font-bold tracking-widest text-green-800">
                {referentie}
              </span>
            </div>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              Bewaar dit nummer — u heeft het nodig om de status van uw aanvraag te volgen.
            </p>
          </div>

          {/* Betaalstatus (indien aanvraag geladen en status aanwezig) */}
          {!isLaden && aanvraag?.betalingStatus && (
            <div className="flex justify-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Betaalstatus:</span>
                <Badge
                  variant={betalingStatusVariant(aanvraag.betalingStatus)}
                  className={cn(
                    aanvraag.betalingStatus === "betaald" &&
                      "bg-green-100 text-green-800 border-green-200 hover:bg-green-100"
                  )}
                >
                  {betalingStatusLabel(aanvraag.betalingStatus)}
                </Badge>
              </div>
            </div>
          )}

          {isLaden && (
            <div className="flex justify-center py-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          <Separator />

          {/* Volgende stappen */}
          <div className="space-y-4">
            <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide text-center">
              Wat er nu gaat gebeuren
            </p>
            <ol className="space-y-4">
              {VOLGENDE_STAPPEN.map((stap, index) => {
                const Icon = stap.icon;
                return (
                  <li key={index} className="flex gap-4">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold text-sm">
                        {index + 1}
                      </div>
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <p className="font-medium text-gray-900 text-sm">
                          {stap.titel}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {stap.omschrijving}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <Separator />

          {/* Acties */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild className="flex-1 bg-green-600 hover:bg-green-700 text-white">
              <Link href={`/configurator/status?ref=${referentie}`}>
                Volg uw aanvraag
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <a
                href="https://www.toptuinen.nl"
                target="_blank"
                rel="noopener noreferrer"
              >
                Terug naar Top Tuinen
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generiek bedankt (geen referentie)
// ---------------------------------------------------------------------------

function BedanktGeneriek() {
  return (
    <div className="container max-w-2xl mx-auto px-4 py-12">
      <Card className="border-green-200 shadow-lg overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-green-500 to-green-600" />

        <CardHeader className="pt-10 pb-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="relative inline-flex">
              <span className="absolute inset-0 rounded-full bg-green-200 animate-ping opacity-60" />
              <CheckCircle2
                className="relative h-16 w-16 text-green-600"
                strokeWidth={1.5}
              />
            </div>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-900">
              Bedankt!
            </CardTitle>
            <p className="text-muted-foreground text-base">
              Wij hebben uw aanvraag ontvangen en nemen zo snel mogelijk contact met u op.
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pb-10">
          <Separator />

          <div className="space-y-4">
            <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide text-center">
              Wat er nu gaat gebeuren
            </p>
            <ol className="space-y-4">
              {VOLGENDE_STAPPEN.map((stap, index) => {
                const Icon = stap.icon;
                return (
                  <li key={index} className="flex gap-4">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold text-sm">
                        {index + 1}
                      </div>
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <p className="font-medium text-gray-900 text-sm">
                          {stap.titel}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {stap.omschrijving}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <Separator />

          <Button asChild variant="outline" className="w-full">
            <a
              href="https://www.toptuinen.nl"
              target="_blank"
              rel="noopener noreferrer"
            >
              Terug naar Top Tuinen
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagina-wrapper — leest query params
// ---------------------------------------------------------------------------

function BedanktPaginaInhoud() {
  const searchParams = useSearchParams();
  const referentie = searchParams.get("referentie") ?? searchParams.get("ref");
  const betaaldParam = searchParams.get("betaald");
  const betaald = betaaldParam === "true" || betaaldParam === "1";

  if (!referentie) {
    return <BedanktGeneriek />;
  }

  return <BedanktMetReferentie referentie={referentie} betaald={betaald} />;
}

// ---------------------------------------------------------------------------
// Export — Suspense vereist voor useSearchParams in Next.js 13+
// ---------------------------------------------------------------------------

export default function BedanktPagina() {
  return (
    <Suspense
      fallback={
        <div className="container max-w-2xl mx-auto px-4 py-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        </div>
      }
    >
      <BedanktPaginaInhoud />
    </Suspense>
  );
}
