"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  ClipboardList,
  Clock,
  CheckCircle,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Printer,
  Phone,
  MapPin,
  User,
  Tag,
  CalendarDays,
  EuroIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Status =
  | "nieuw"
  | "in_behandeling"
  | "goedgekeurd"
  | "afgekeurd"
  | "voltooid";

type AanvraagType = "gazon" | "boomschors" | "verticuteren";

interface Aanvraag {
  _id: string;
  referentie: string;
  type: AanvraagType;
  status: Status;
  klantNaam: string;
  klantAdres: string;
  klantPostcode: string;
  klantPlaats: string;
  indicatiePrijs: number;
  definitievePrijs?: number;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  Status,
  {
    label: string;
    uitleg: string;
    badgeClass: string;
    iconClass: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  nieuw: {
    label: "Nieuw",
    uitleg:
      "Uw aanvraag is ontvangen en wordt binnen 2 werkdagen beoordeeld.",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
    iconClass: "text-blue-600",
    Icon: ClipboardList,
  },
  in_behandeling: {
    label: "In behandeling",
    uitleg:
      "Uw aanvraag wordt momenteel beoordeeld door ons team.",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    iconClass: "text-amber-600",
    Icon: Clock,
  },
  goedgekeurd: {
    label: "Goedgekeurd",
    uitleg:
      "Uw aanvraag is goedgekeurd! U wordt binnenkort gecontacteerd voor de planning.",
    badgeClass: "bg-green-100 text-green-800 border-green-200",
    iconClass: "text-green-600",
    Icon: CheckCircle,
  },
  afgekeurd: {
    label: "Afgekeurd",
    uitleg:
      "Helaas kunnen wij deze aanvraag niet uitvoeren. Neem contact op voor meer informatie.",
    badgeClass: "bg-red-100 text-red-800 border-red-200",
    iconClass: "text-red-600",
    Icon: XCircle,
  },
  voltooid: {
    label: "Voltooid",
    uitleg:
      "De werkzaamheden zijn voltooid. Bedankt voor uw vertrouwen!",
    badgeClass: "bg-green-100 text-green-800 border-green-200",
    iconClass: "text-green-600",
    Icon: CheckCircle2,
  },
};

const TYPE_LABELS: Record<AanvraagType, string> = {
  gazon: "Gazon aanleggen",
  boomschors: "Boomschors",
  verticuteren: "Verticuteren",
};

const TYPE_BADGE_CLASS: Record<AanvraagType, string> = {
  gazon: "bg-green-50 text-green-700 border-green-200",
  boomschors: "bg-amber-50 text-amber-700 border-amber-200",
  verticuteren: "bg-lime-50 text-lime-700 border-lime-200",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDatum(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

function formatPrijs(bedrag: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(bedrag);
}

/**
 * Maskeert de naam: "Ricardo Bos" -> "R. Bos"
 */
function maskeerNaam(naam: string): string {
  const delen = naam.trim().split(/\s+/);
  if (delen.length === 0) return naam;
  if (delen.length === 1) return `${delen[0].charAt(0)}.`;
  const voornaamInitiaal = delen[0].charAt(0).toUpperCase();
  const achternaam = delen.slice(1).join(" ");
  return `${voornaamInitiaal}. ${achternaam}`;
}

/**
 * Maskeert het adres: "Tuinstraat 12" + "Amsterdam" -> "***straat 12, Amsterdam"
 */
function maskeerAdres(adres: string, plaats: string): string {
  const gemaskeerd = adres.length > 6
    ? `***${adres.slice(Math.floor(adres.length / 2))}`
    : `***`;
  return `${gemaskeerd}, ${plaats}`;
}

/**
 * Geeft de index terug van de huidige status in de workflow.
 * "afgekeurd" wordt behandeld als een eindstap na "in_behandeling".
 */
function getStatusIndex(status: Status): number {
  const volgorde: Status[] = [
    "nieuw",
    "in_behandeling",
    "goedgekeurd",
    "voltooid",
  ];
  if (status === "afgekeurd") return 2; // Staat na "in_behandeling"
  return volgorde.indexOf(status);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: Status }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium border",
        config.badgeClass
      )}
    >
      <config.Icon className={cn("h-3.5 w-3.5", config.iconClass)} />
      {config.label}
    </Badge>
  );
}

function Timeline({ status }: { status: Status }) {
  const isAfgekeurd = status === "afgekeurd";
  const huidigIndex = getStatusIndex(status);

  const stappen: { key: Status; label: string }[] = isAfgekeurd
    ? [
        { key: "nieuw", label: "Aanvraag ontvangen" },
        { key: "in_behandeling", label: "In behandeling" },
        { key: "afgekeurd", label: "Afgekeurd" },
      ]
    : [
        { key: "nieuw", label: "Aanvraag ontvangen" },
        { key: "in_behandeling", label: "In behandeling" },
        { key: "goedgekeurd", label: "Goedgekeurd" },
        { key: "voltooid", label: "Voltooid" },
      ];

  return (
    <div className="space-y-0">
      {stappen.map((stap, index) => {
        const isKlaar = index < huidigIndex;
        const isHuidig = index === huidigIndex;
        const isLaatste = index === stappen.length - 1;

        return (
          <div key={stap.key} className="flex items-start gap-4">
            {/* Lijn + stip kolom */}
            <div className="flex flex-col items-center flex-shrink-0">
              {/* Stip */}
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors z-10",
                  isKlaar
                    ? "bg-green-600 border-green-600"
                    : isHuidig
                    ? stap.key === "afgekeurd"
                      ? "bg-red-600 border-red-600"
                      : "bg-blue-600 border-blue-600"
                    : "bg-white border-gray-200"
                )}
              >
                {isKlaar ? (
                  <CheckCircle2 className="h-4 w-4 text-white" />
                ) : isHuidig ? (
                  stap.key === "afgekeurd" ? (
                    <XCircle className="h-4 w-4 text-white" />
                  ) : (
                    <div className="h-2.5 w-2.5 rounded-full bg-white" />
                  )
                ) : (
                  <div className="h-2.5 w-2.5 rounded-full bg-gray-200" />
                )}
              </div>
              {/* Verbindingslijn */}
              {!isLaatste && (
                <div
                  className={cn(
                    "w-0.5 flex-1 min-h-[2rem]",
                    isKlaar ? "bg-green-400" : "bg-gray-200"
                  )}
                />
              )}
            </div>

            {/* Label kolom */}
            <div className="pb-6 pt-1 min-w-0">
              <p
                className={cn(
                  "text-sm font-medium leading-tight",
                  isKlaar
                    ? "text-green-700"
                    : isHuidig
                    ? stap.key === "afgekeurd"
                      ? "text-red-700"
                      : "text-blue-700"
                    : "text-gray-400"
                )}
              >
                {stap.label}
              </p>
              {isHuidig && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {STATUS_CONFIG[stap.key].uitleg}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AanvraagKaart({ aanvraag }: { aanvraag: Aanvraag }) {
  const config = STATUS_CONFIG[aanvraag.status];

  return (
    <div className="space-y-4 print:space-y-3">
      {/* Header */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Referentienummer
              </p>
              <p className="text-xl font-bold font-mono text-gray-900">
                {aanvraag.referentie}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge
                className={cn(
                  "border text-xs font-medium px-2.5 py-0.5",
                  TYPE_BADGE_CLASS[aanvraag.type]
                )}
              >
                <Tag className="h-3 w-3 mr-1" />
                {TYPE_LABELS[aanvraag.type]}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Status indicator */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-gray-50 border border-gray-100">
            <config.Icon
              className={cn("h-5 w-5 flex-shrink-0 mt-0.5", config.iconClass)}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-900">
                  Huidige status:
                </p>
                <StatusBadge status={aanvraag.status} />
              </div>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                {config.uitleg}
              </p>
            </div>
          </div>

          <Separator />

          {/* Twee kolommen: timeline + klantgegevens/prijzen */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Timeline */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Voortgang
              </p>
              <Timeline status={aanvraag.status} />
            </div>

            {/* Klantgegevens & prijzen */}
            <div className="space-y-5">
              {/* Klantgegevens — gedeeltelijk gemaskeerd */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Aanvraaggegevens
                </p>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5 text-sm">
                    <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-gray-700">
                      {maskeerNaam(aanvraag.klantNaam)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-gray-700">
                      {maskeerAdres(aanvraag.klantAdres, aanvraag.klantPlaats)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm">
                    <CalendarDays className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-gray-700">
                      Ingediend op {formatDatum(aanvraag.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Prijzen */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Prijsinformatie
                </p>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2.5">
                      <EuroIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-gray-600">Indicatieprijs</span>
                    </div>
                    <span className="font-semibold text-gray-900">
                      {formatPrijs(aanvraag.indicatiePrijs)}
                    </span>
                  </div>

                  {aanvraag.definitievePrijs !== undefined && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2.5">
                          <EuroIcon className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span className="text-gray-600 font-medium">
                            Definitieve prijs
                          </span>
                        </div>
                        <span className="font-bold text-green-700 text-base">
                          {formatPrijs(aanvraag.definitievePrijs)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground ml-6">
                        Inclusief BTW, na inspectie vastgesteld
                      </p>
                    </>
                  )}

                  {aanvraag.definitievePrijs === undefined && (
                    <p className="text-xs text-muted-foreground ml-6">
                      Definitieve prijs wordt vastgesteld na beoordeling
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Print knop */}
      <div className="flex justify-end print:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          className="gap-2 text-gray-600 hover:text-gray-900"
        >
          <Printer className="h-4 w-4" />
          Afdrukken
        </Button>
      </div>
    </div>
  );
}

function NietGevonden() {
  return (
    <Card className="shadow-sm border-red-100 bg-red-50/40">
      <CardContent className="py-10">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-7 w-7 text-red-600" />
          </div>
          <div className="space-y-1.5">
            <CardTitle className="text-lg text-gray-900">
              Geen aanvraag gevonden
            </CardTitle>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Geen aanvraag gevonden met dit referentienummer. Controleer het
              nummer en probeer opnieuw.
            </p>
          </div>
          <Separator className="w-24" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4 flex-shrink-0" />
            <span>
              Hulp nodig?{" "}
              <a
                href="mailto:info@toptuinen.nl"
                className="text-green-700 font-medium hover:text-green-900 underline underline-offset-2"
              >
                Neem contact met ons op
              </a>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Zoek sectie met Convex query
// ---------------------------------------------------------------------------

function ZoekResultaat({ referentie }: { referentie: string }) {
  const aanvraag = useQuery(
    api.configuratorAanvragen.getByReferentie,
    { referentie }
  );

  if (aanvraag === undefined) {
    // Laden...
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 rounded-xl bg-gray-100 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (aanvraag === null) {
    return <NietGevonden />;
  }

  return <AanvraagKaart aanvraag={aanvraag as Aanvraag} />;
}

// ---------------------------------------------------------------------------
// Hoofd pagina content (gesplitst voor Suspense)
// ---------------------------------------------------------------------------

function StatusPageContent() {
  const searchParams = useSearchParams();
  const refParam = searchParams.get("ref") ?? "";

  const [inputWaarde, setInputWaarde] = useState(refParam);
  const [zoekReferentie, setZoekReferentie] = useState(refParam);
  const [validatieFout, setValidatieFout] = useState("");

  // Automatisch zoeken als ref query param aanwezig is bij laden
  useEffect(() => {
    if (refParam) {
      setInputWaarde(refParam);
      setZoekReferentie(refParam);
    }
  }, [refParam]);

  function handleZoeken() {
    const trimmed = inputWaarde.trim().toUpperCase();

    if (!trimmed) {
      setValidatieFout("Voer een referentienummer in.");
      return;
    }

    if (!trimmed.startsWith("CFG-")) {
      setValidatieFout(
        'Referentienummer moet beginnen met "CFG-". Controleer het nummer en probeer opnieuw.'
      );
      return;
    }

    setValidatieFout("");
    setZoekReferentie(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleZoeken();
    }
  }

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4">
      {/* Paginatitel */}
      <div className="mb-8 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Aanvraagstatus opzoeken
        </h2>
        <p className="text-muted-foreground mt-2 max-w-lg mx-auto text-sm sm:text-base">
          Voer uw referentienummer in om de actuele status van uw aanvraag te
          bekijken.
        </p>
      </div>

      {/* Zoekbalk */}
      <Card className="shadow-sm border-gray-200 mb-6">
        <CardContent className="pt-5 pb-5">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={inputWaarde}
                onChange={(e) => {
                  setInputWaarde(e.target.value);
                  if (validatieFout) setValidatieFout("");
                }}
                onKeyDown={handleKeyDown}
                placeholder="Voer uw referentienummer in (bijv. CFG-20260223-1234)"
                className={cn(
                  "pl-9 font-mono text-sm h-11",
                  validatieFout &&
                    "border-red-400 focus-visible:ring-red-400"
                )}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {validatieFout && (
              <p className="text-xs text-red-600 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                {validatieFout}
              </p>
            )}

            <Button
              onClick={handleZoeken}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white gap-2"
            >
              <Search className="h-4 w-4" />
              Zoeken
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultaat */}
      {zoekReferentie && (
        <ZoekResultaat referentie={zoekReferentie} />
      )}

      {/* Hulp tekst wanneer er nog niet gezocht is */}
      {!zoekReferentie && (
        <div className="text-center py-10 text-muted-foreground">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            Uw referentienummer vindt u in de bevestigingsmail die u heeft
            ontvangen na het indienen van uw aanvraag.
          </p>
          <p className="text-xs mt-3">
            Heeft u geen referentienummer?{" "}
            <a
              href="mailto:info@toptuinen.nl"
              className="text-green-700 font-medium hover:text-green-900 underline underline-offset-2"
            >
              Neem contact met ons op
            </a>
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hoofd export (gewrapped in Suspense voor useSearchParams)
// ---------------------------------------------------------------------------

export default function AanvraagStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="container max-w-3xl mx-auto py-8 px-4">
          <div className="space-y-4">
            <div className="h-10 bg-gray-100 rounded-lg animate-pulse mx-auto w-64" />
            <div className="h-4 bg-gray-100 rounded animate-pulse mx-auto w-80" />
            <div className="h-24 bg-gray-100 rounded-xl animate-pulse mt-8" />
          </div>
        </div>
      }
    >
      <StatusPageContent />
    </Suspense>
  );
}
