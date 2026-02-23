"use client";

import * as React from "react";
import {
  CheckCircle2Icon,
  FileTextIcon,
  PenLineIcon,
  ShieldCheckIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { AlgemeneVoorwaarden } from "@/components/algemene-voorwaarden";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AkkoordData {
  akkoordGegeven: boolean;
  klantNaam: string;
  klantEmail: string;
  referentie: string;
  voorwaardenGelezen: boolean;
  handtekening?: string;
  datumAkkoord: string;
  ipAdres?: string;
}

export interface AkkoordFormulierProps {
  klantNaam: string;
  klantEmail: string;
  referentie: string;
  type: "offerte" | "configurator" | "hogedrukspuit";
  onAkkoord: (akkoordData: AkkoordData) => void;
  onAnnuleer?: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Hulpfuncties
// ---------------------------------------------------------------------------

function formatDatum(datum: Date): string {
  return datum.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDatumISO(datum: Date): string {
  return datum.toISOString();
}

function getTypeLabel(type: AkkoordFormulierProps["type"]): string {
  switch (type) {
    case "offerte":
      return "Offerte";
    case "configurator":
      return "Configurator";
    case "hogedrukspuit":
      return "Hogedrukspuit";
  }
}

// ---------------------------------------------------------------------------
// Voortgangsindicator
// ---------------------------------------------------------------------------

interface VoortgangProps {
  totaal: number;
  voltooid: number;
}

function Voortgangsindicator({ totaal, voltooid }: VoortgangProps) {
  const percentage = totaal === 0 ? 0 : Math.round((voltooid / totaal) * 100);
  const isKlaar = voltooid === totaal;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {voltooid} van {totaal} stappen voltooid
        </span>
        <span
          className={cn(
            "font-medium transition-colors",
            isKlaar ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
          )}
        >
          {percentage}%
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            isKlaar
              ? "bg-green-500 dark:bg-green-400"
              : "bg-primary"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Succes-overlay
// ---------------------------------------------------------------------------

function SuccesWeergave({
  klantNaam,
  referentie,
  datumAkkoord,
}: {
  klantNaam: string;
  referentie: string;
  datumAkkoord: string;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-8 px-4 text-center">
      {/* Animatie-ring */}
      <div className="relative">
        <div className="size-20 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center animate-in zoom-in-50 duration-500">
          <CheckCircle2Icon className="size-10 text-green-600 dark:text-green-400" />
        </div>
        <div className="absolute inset-0 rounded-full bg-green-200 dark:bg-green-900 opacity-50 animate-ping" />
      </div>

      <div className="space-y-2 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-200">
        <h3 className="text-xl font-semibold">Akkoord ontvangen</h3>
        <p className="text-muted-foreground text-sm max-w-sm">
          Bedankt, <strong>{klantNaam}</strong>. Uw akkoord voor referentie{" "}
          <strong>{referentie}</strong> is vastgelegd op {formatDatum(new Date(datumAkkoord))}.
        </p>
      </div>

      <Badge
        variant="outline"
        className="gap-1.5 border-green-300 text-green-700 bg-green-50 dark:border-green-700 dark:text-green-300 dark:bg-green-950 animate-in fade-in-0 duration-700 delay-300"
      >
        <ShieldCheckIcon className="size-3.5" />
        Digitaal ondertekend en opgeslagen
      </Badge>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hoofd component
// ---------------------------------------------------------------------------

export function AkkoordFormulier({
  klantNaam,
  klantEmail,
  referentie,
  type,
  onAkkoord,
  onAnnuleer,
  className,
}: AkkoordFormulierProps) {
  const vandaag = React.useMemo(() => new Date(), []);

  // Checkbox-state
  const [voorwaardenAkkoord, setVoorwaardenAkkoord] = React.useState(false);
  const [prijsVoorbehoud, setPrijsVoorbehoud] = React.useState(false);
  const [hogedrukAkkoord, setHogedrukAkkoord] = React.useState(false);

  // Handtekening
  const [handtekening, setHandtekening] = React.useState("");

  // Status
  const [akkoordGegeven, setAkkoordGegeven] = React.useState(false);
  const [isBezig, setIsBezig] = React.useState(false);

  // Aantal verplichte stappen berekenen
  const totaleStappen = type === "hogedrukspuit" ? 4 : 3;
  const voltooidStappen =
    (voorwaardenAkkoord ? 1 : 0) +
    (prijsVoorbehoud ? 1 : 0) +
    (type === "hogedrukspuit" && hogedrukAkkoord ? 1 : 0) +
    (handtekening.trim().length >= 2 ? 1 : 0);

  const kanAkkoordGeven =
    voorwaardenAkkoord &&
    prijsVoorbehoud &&
    (type !== "hogedrukspuit" || hogedrukAkkoord) &&
    handtekening.trim().length >= 2;

  const handleAkkoord = async () => {
    if (!kanAkkoordGeven) return;

    setIsBezig(true);

    // Simuleer een korte verwerking voor UX feedback
    await new Promise<void>((resolve) => setTimeout(resolve, 600));

    const akkoordData: AkkoordData = {
      akkoordGegeven: true,
      klantNaam,
      klantEmail,
      referentie,
      voorwaardenGelezen: voorwaardenAkkoord,
      handtekening: handtekening.trim(),
      datumAkkoord: formatDatumISO(vandaag),
    };

    setAkkoordGegeven(true);
    setIsBezig(false);
    onAkkoord(akkoordData);
  };

  // Toon succes-scherm na akkoord
  if (akkoordGegeven) {
    return (
      <Card className={cn("w-full max-w-2xl", className)}>
        <SuccesWeergave
          klantNaam={klantNaam}
          referentie={referentie}
          datumAkkoord={formatDatumISO(vandaag)}
        />
      </Card>
    );
  }

  return (
    <Card className={cn("w-full max-w-2xl", className)}>
      {/* Header */}
      <CardHeader className="border-b pb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileTextIcon className="size-5 text-muted-foreground shrink-0" />
              Akkoordverklaring
            </CardTitle>
            <CardDescription>
              {getTypeLabel(type)} — Referentie:{" "}
              <span className="font-mono font-medium text-foreground">
                {referentie}
              </span>
            </CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0 text-xs">
            {formatDatum(vandaag)}
          </Badge>
        </div>

        {/* Klantgegevens */}
        <div className="mt-3 rounded-md bg-muted/50 px-4 py-3 text-sm space-y-0.5">
          <p>
            <span className="text-muted-foreground">Naam: </span>
            <span className="font-medium">{klantNaam}</span>
          </p>
          <p>
            <span className="text-muted-foreground">E-mailadres: </span>
            <span className="font-medium">{klantEmail}</span>
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {/* Stap 1: Samenvatting voorwaarden */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Stap 1 — Voorwaarden
          </h3>

          <div className="rounded-lg border bg-muted/20 p-4">
            <AlgemeneVoorwaarden mode="samenvatting" />
          </div>

          {/* Link naar volledige voorwaarden (popup) */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground pl-1">
            <span>Wilt u alles lezen?</span>
            <AlgemeneVoorwaarden
              mode="popup"
              onGelezen={() => setVoorwaardenAkkoord(true)}
            />
          </div>
        </div>

        <Separator />

        {/* Stap 2: Checkboxes */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Stap 2 — Akkoordverklaringen
          </h3>

          <div className="space-y-4">
            {/* Checkbox 1: Algemene voorwaarden */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <Checkbox
                id="checkbox-voorwaarden"
                checked={voorwaardenAkkoord}
                onCheckedChange={(checked) =>
                  setVoorwaardenAkkoord(checked === true)
                }
                className="mt-0.5"
              />
              <span className="text-sm leading-relaxed group-hover:text-foreground transition-colors">
                <span className="font-medium">
                  Ik heb de algemene voorwaarden gelezen en ga hiermee akkoord.
                </span>{" "}
                <span className="text-muted-foreground">
                  De volledige voorwaarden van Top Tuinen B.V. zijn van toepassing op deze opdracht.
                </span>
              </span>
            </label>

            {/* Checkbox 2: Prijsvoorbehoud */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <Checkbox
                id="checkbox-prijs"
                checked={prijsVoorbehoud}
                onCheckedChange={(checked) =>
                  setPrijsVoorbehoud(checked === true)
                }
                className="mt-0.5"
              />
              <span className="text-sm leading-relaxed group-hover:text-foreground transition-colors">
                <span className="font-medium">
                  Ik begrijp dat prijzen onder voorbehoud zijn tot definitieve beoordeling.
                </span>{" "}
                <span className="text-muted-foreground">
                  De definitieve prijs kan afwijken na inspectie ter plaatse.
                </span>
              </span>
            </label>

            {/* Checkbox 3 (hogedrukspuit-specifiek) */}
            {type === "hogedrukspuit" && (
              <label
                className={cn(
                  "flex items-start gap-3 cursor-pointer group rounded-lg border p-3 transition-colors",
                  hogedrukAkkoord
                    ? "border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/30"
                    : "border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/10"
                )}
              >
                <Checkbox
                  id="checkbox-hogedruk"
                  checked={hogedrukAkkoord}
                  onCheckedChange={(checked) =>
                    setHogedrukAkkoord(checked === true)
                  }
                  className="mt-0.5"
                />
                <span className="text-sm leading-relaxed group-hover:text-foreground transition-colors">
                  <span className="font-medium text-orange-800 dark:text-orange-300">
                    Ik ga akkoord met het gebruik van een hogedrukspuit en accepteer het risico op spatschade.
                  </span>{" "}
                  <span className="text-orange-700/80 dark:text-orange-400/80">
                    Top Tuinen B.V. is niet aansprakelijk voor spatschade die ontstaat bij het reinigen
                    met hogedrukspuit (artikel 10 van de algemene voorwaarden).
                  </span>
                </span>
              </label>
            )}
          </div>
        </div>

        <Separator />

        {/* Stap 3: Digitale handtekening */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Stap 3 — Digitale handtekening
          </h3>

          <div className="space-y-2">
            <label
              htmlFor="handtekening-input"
              className="flex items-center gap-2 text-sm font-medium"
            >
              <PenLineIcon className="size-4 text-muted-foreground" />
              Volledige naam als handtekening
            </label>

            <Input
              id="handtekening-input"
              type="text"
              placeholder="Typ uw volledige naam"
              value={handtekening}
              onChange={(e) => setHandtekening(e.target.value)}
              className={cn(
                "font-serif text-base italic transition-colors",
                handtekening.trim().length >= 2 &&
                  "border-green-400 ring-1 ring-green-400/30 dark:border-green-600 dark:ring-green-600/30"
              )}
              autoComplete="name"
              spellCheck={false}
            />

            <p className="text-xs text-muted-foreground pl-0.5">
              Door uw naam in te vullen geeft u een digitale handtekening. Dit is juridisch gelijkwaardig
              aan een fysieke handtekening conform artikel 2 van de algemene voorwaarden.
            </p>
          </div>

          {/* Datum */}
          <div className="rounded-md bg-muted/40 px-3 py-2.5 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Datum akkoord</span>
            <span className="text-sm font-medium">{formatDatum(vandaag)}</span>
          </div>
        </div>

        <Separator />

        {/* Voortgang */}
        <Voortgangsindicator totaal={totaleStappen} voltooid={voltooidStappen} />

        {/* Samenvatting wanneer klaar */}
        {kanAkkoordGeven && (
          <div className="rounded-lg border border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/30 px-4 py-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            <div className="flex items-start gap-2">
              <CheckCircle2Icon className="size-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  Alles is ingevuld
                </p>
                <p className="text-xs text-green-700/80 dark:text-green-400/80">
                  U kunt nu akkoord geven. Uw digitale handtekening{" "}
                  <em>&ldquo;{handtekening.trim()}&rdquo;</em> wordt vastgelegd
                  op {formatDatum(vandaag)}.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {/* Footer met knoppen */}
      <CardFooter className="border-t pt-6 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
        {onAnnuleer && (
          <Button
            variant="outline"
            onClick={onAnnuleer}
            disabled={isBezig}
            className="w-full sm:w-auto"
          >
            Annuleren
          </Button>
        )}

        <Button
          onClick={handleAkkoord}
          disabled={!kanAkkoordGeven || isBezig}
          className={cn(
            "w-full sm:w-auto gap-2 transition-all",
            kanAkkoordGeven &&
              "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white shadow-md hover:shadow-lg"
          )}
        >
          {isBezig ? (
            <>
              <span className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Verwerken...
            </>
          ) : (
            <>
              <ShieldCheckIcon className="size-4" />
              Akkoord geven
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
