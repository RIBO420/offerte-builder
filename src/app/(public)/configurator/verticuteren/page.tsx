"use client";

import { useState, useCallback, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  XCircle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Calculator,
  Info,
  Scissors,
  Leaf,
  CreditCard,
  CalendarCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { BeschikbaarheidsKalender } from "@/components/beschikbaarheids-kalender";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GazonConditie =
  | "uitstekend"
  | "goed"
  | "matig"
  | "slecht"
  | "zeer_slecht";

interface KlantGegevens {
  naam: string;
  email: string;
  telefoon: string;
  adres: string;
  postcode: string;
  plaats: string;
  poortbreedte: string;
}

interface VerticuterenSpecs {
  oppervlakte: string;
  conditie: GazonConditie | "";
  bijzaaien: boolean;
  topdressing: boolean;
  bemesting: boolean;
}

interface PrijsBerekening {
  basisprijs: number;
  conditioneelToeslag: number;
  conditioneelToeslagPercent: number;
  handmatigToeslag: boolean;
  handmatigToeslagBedrag: number;
  bijzaaienRegel: number | null;
  topdressingRegel: number | null;
  bemestingRegel: number | null;
  machineHuur: number;
  voorrijkosten: number;
  subtotaal: number;
  btw: number;
  totaal: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STAP_LABELS = [
  "Klantgegevens",
  "Specificaties",
  "Datum & Overzicht",
  "Bevestiging",
];
const TOTAAL_STAPPEN = 4;

const BASISPRIJS_PER_M2 = 4;
const MACHINE_HUUR = 85;
const VOORRIJKOSTEN = 75;
const BIJZAAIEN_TARIEF = 3;
const TOPDRESSING_TARIEF = 2;
const BEMESTING_TARIEF = 1.5;

const CONDITIE_CONFIG: Record<
  GazonConditie,
  {
    label: string;
    uitleg: string;
    toeslagPercent: number;
    kleur: string;
    intensiteit: string;
  }
> = {
  uitstekend: {
    label: "Uitstekend",
    uitleg: "Minimaal mos, dicht grasmat — licht onderhoud voldoende",
    toeslagPercent: 0,
    kleur: "border-green-500 bg-green-50",
    intensiteit: "text-green-700",
  },
  goed: {
    label: "Goed",
    uitleg: "Normaal gazon met enig mos en wat dunne plekken",
    toeslagPercent: 10,
    kleur: "border-lime-500 bg-lime-50",
    intensiteit: "text-lime-700",
  },
  matig: {
    label: "Matig",
    uitleg: "Veel mos, kale plekken — intensievere behandeling nodig",
    toeslagPercent: 25,
    kleur: "border-yellow-500 bg-yellow-50",
    intensiteit: "text-yellow-700",
  },
  slecht: {
    label: "Slecht",
    uitleg: "Meer dan 50% mos, veel onkruid — uitgebreide aanpak vereist",
    toeslagPercent: 50,
    kleur: "border-orange-500 bg-orange-50",
    intensiteit: "text-orange-700",
  },
  zeer_slecht: {
    label: "Zeer slecht",
    uitleg: "Volledig verwaarloosd gazon — maximale inspanning vereist",
    toeslagPercent: 75,
    kleur: "border-red-500 bg-red-50",
    intensiteit: "text-red-700",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEuro(bedrag: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(bedrag);
}

function berekenMinDatum(): Date {
  const datum = new Date();
  datum.setHours(0, 0, 0, 0);
  let werkdagen = 0;
  while (werkdagen < 5) {
    datum.setDate(datum.getDate() + 1);
    const dag = datum.getDay();
    if (dag !== 0 && dag !== 6) werkdagen++;
  }
  return datum;
}

function berekenPrijs(
  specs: VerticuterenSpecs,
  poortbreedte: string
): PrijsBerekening | null {
  if (!specs.conditie || !specs.oppervlakte) return null;
  const m2 = parseFloat(specs.oppervlakte);
  if (isNaN(m2) || m2 < 20) return null;

  const basisprijs = m2 * BASISPRIJS_PER_M2;
  const conditieConfig = CONDITIE_CONFIG[specs.conditie];
  const conditioneelToeslagPercent = conditieConfig.toeslagPercent;
  const conditioneelToeslag =
    Math.round(basisprijs * (conditioneelToeslagPercent / 100) * 100) / 100;

  const poort = parseFloat(poortbreedte);
  const handmatigToeslag = !isNaN(poort) && poort < 80;
  const basePlusConditie = basisprijs + conditioneelToeslag;
  const handmatigToeslagBedrag = handmatigToeslag
    ? Math.round(basePlusConditie * 0.25 * 100) / 100
    : 0;

  const bijzaaienRegel = specs.bijzaaien
    ? Math.round(m2 * BIJZAAIEN_TARIEF * 100) / 100
    : null;
  const topdressingRegel = specs.topdressing
    ? Math.round(m2 * TOPDRESSING_TARIEF * 100) / 100
    : null;
  const bemestingRegel = specs.bemesting
    ? Math.round(m2 * BEMESTING_TARIEF * 100) / 100
    : null;

  const subtotaal =
    basePlusConditie +
    handmatigToeslagBedrag +
    (bijzaaienRegel ?? 0) +
    (topdressingRegel ?? 0) +
    (bemestingRegel ?? 0) +
    MACHINE_HUUR +
    VOORRIJKOSTEN;

  const btw = Math.round(subtotaal * 0.21 * 100) / 100;
  const totaal = Math.round((subtotaal + btw) * 100) / 100;

  return {
    basisprijs,
    conditioneelToeslag,
    conditioneelToeslagPercent,
    handmatigToeslag,
    handmatigToeslagBedrag,
    bijzaaienRegel,
    topdressingRegel,
    bemestingRegel,
    machineHuur: MACHINE_HUUR,
    voorrijkosten: VOORRIJKOSTEN,
    subtotaal,
    btw,
    totaal,
  };
}

// ---------------------------------------------------------------------------
// Validatie
// ---------------------------------------------------------------------------

function validateStap1(klant: KlantGegevens): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!klant.naam.trim()) errors.naam = "Naam is verplicht";
  if (!klant.email.trim()) {
    errors.email = "E-mailadres is verplicht";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(klant.email)) {
    errors.email = "Voer een geldig e-mailadres in";
  }
  if (!klant.telefoon.trim()) errors.telefoon = "Telefoonnummer is verplicht";
  if (!klant.adres.trim()) errors.adres = "Adres is verplicht";
  if (!klant.postcode.trim()) errors.postcode = "Postcode is verplicht";
  if (!klant.plaats.trim()) errors.plaats = "Plaats is verplicht";
  if (!klant.poortbreedte.trim()) {
    errors.poortbreedte = "Poortbreedte is verplicht";
  } else {
    const breedte = parseFloat(klant.poortbreedte);
    if (isNaN(breedte) || breedte <= 0) {
      errors.poortbreedte = "Voer een geldige breedte in";
    }
  }
  return errors;
}

function validateStap2(specs: VerticuterenSpecs): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!specs.oppervlakte.trim()) {
    errors.oppervlakte = "Oppervlakte is verplicht";
  } else {
    const opp = parseFloat(specs.oppervlakte);
    if (isNaN(opp) || opp < 20) {
      errors.oppervlakte = "Minimaal 20 m²";
    }
  }
  if (!specs.conditie) errors.conditie = "Selecteer de huidige conditie";
  return errors;
}

function validateStap3(gewensteDatum: Date | undefined): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!gewensteDatum) errors.gewensteDatum = "Selecteer een gewenste datum";
  return errors;
}

// ---------------------------------------------------------------------------
// Sub-componenten
// ---------------------------------------------------------------------------

function StapIndicator({ huidigStap }: { huidigStap: number }) {
  const voortgang = (huidigStap / TOTAAL_STAPPEN) * 100;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">
          Stap {huidigStap} van {TOTAAL_STAPPEN}
        </span>
        <Badge
          variant="outline"
          className="text-green-700 border-green-300 bg-green-50"
        >
          {STAP_LABELS[huidigStap - 1]}
        </Badge>
      </div>
      <Progress value={voortgang} className="h-2 [&>div]:bg-green-600" />
      <div className="flex justify-between mt-3">
        {STAP_LABELS.map((label, index) => {
          const stapNummer = index + 1;
          const isActief = stapNummer === huidigStap;
          const isKlaar = stapNummer < huidigStap;
          return (
            <div
              key={label}
              className={cn("flex flex-col items-center gap-1", "hidden sm:flex")}
            >
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold border-2 transition-colors",
                  isKlaar
                    ? "bg-green-600 border-green-600 text-white"
                    : isActief
                    ? "border-green-600 text-green-700 bg-white"
                    : "border-gray-200 text-gray-400 bg-white"
                )}
              >
                {isKlaar ? <CheckCircle2 className="h-4 w-4" /> : stapNummer}
              </div>
              <span
                className={cn(
                  "text-xs text-center max-w-16",
                  isActief ? "text-green-700 font-medium" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PoortWaarschuwing({ breedte }: { breedte: string }) {
  const waarde = parseFloat(breedte);
  if (!breedte || isNaN(waarde) || waarde >= 80) return null;

  if (waarde < 60) {
    return (
      <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm">
        <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-red-800">Te smal voor onze machines</p>
          <p className="text-red-700 mt-0.5">
            Bij een poortbreedte van minder dan 60 cm kunnen wij helaas niet
            werken met onze verticuteermachine. Neem contact met ons op voor een
            maatwerkoplossing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm">
      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-amber-800">Let op: handmatig werk vereist</p>
        <p className="text-amber-700 mt-0.5">
          Bij een poortbreedte van minder dan 80 cm kunnen niet al onze machines
          worden ingezet. Er is een toeslag van 25% van toepassing voor extra
          handmatig werk.
        </p>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
  verplicht?: boolean;
  hulptekst?: string;
}

function Field({
  label,
  error,
  children,
  verplicht = true,
  hulptekst,
}: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className={cn("text-sm font-medium", error && "text-red-600")}>
        {label}
        {verplicht && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {children}
      {hulptekst && !error && (
        <p className="text-xs text-muted-foreground">{hulptekst}</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function PrijsRegelRij({
  label,
  detail,
  bedrag,
  isSubtotaal,
  highlight,
}: {
  label: string;
  detail?: string;
  bedrag: string;
  isSubtotaal?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between py-2 gap-4",
        isSubtotaal && "font-medium",
        highlight && "bg-green-50 -mx-3 px-3 rounded-md"
      )}
    >
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm", isSubtotaal && "font-semibold")}>{label}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
      <p
        className={cn(
          "text-sm font-medium flex-shrink-0 tabular-nums",
          isSubtotaal && "font-semibold"
        )}
      >
        {bedrag}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stap 1: Klantgegevens
// ---------------------------------------------------------------------------

function Stap1Klantgegevens({
  data,
  errors,
  onChange,
}: {
  data: KlantGegevens;
  errors: Record<string, string>;
  onChange: (field: keyof KlantGegevens, value: string) => void;
}) {
  const poortBreedte = parseFloat(data.poortbreedte);
  const isTeSmall = !isNaN(poortBreedte) && poortBreedte < 60;

  return (
    <div className="space-y-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-xl">Uw gegevens</CardTitle>
        <CardDescription>
          Vul uw contactgegevens in. Wij gebruiken deze om de aanvraag te
          verwerken en contact met u op te nemen.
        </CardDescription>
      </CardHeader>

      <Field label="Volledige naam" error={errors.naam}>
        <Input
          placeholder="Jan de Vries"
          value={data.naam}
          onChange={(e) => onChange("naam", e.target.value)}
          className={cn(errors.naam && "border-red-400 focus-visible:ring-red-400")}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="E-mailadres" error={errors.email}>
          <Input
            type="email"
            placeholder="jan@email.nl"
            value={data.email}
            onChange={(e) => onChange("email", e.target.value)}
            className={cn(errors.email && "border-red-400 focus-visible:ring-red-400")}
          />
        </Field>
        <Field label="Telefoonnummer" error={errors.telefoon}>
          <Input
            type="tel"
            placeholder="06-12345678"
            value={data.telefoon}
            onChange={(e) => onChange("telefoon", e.target.value)}
            className={cn(
              errors.telefoon && "border-red-400 focus-visible:ring-red-400"
            )}
          />
        </Field>
      </div>

      <Field label="Straat en huisnummer" error={errors.adres}>
        <Input
          placeholder="Tuinstraat 12"
          value={data.adres}
          onChange={(e) => onChange("adres", e.target.value)}
          className={cn(errors.adres && "border-red-400 focus-visible:ring-red-400")}
        />
      </Field>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Field label="Postcode" error={errors.postcode}>
          <Input
            placeholder="1234 AB"
            value={data.postcode}
            onChange={(e) => onChange("postcode", e.target.value)}
            className={cn(
              errors.postcode && "border-red-400 focus-visible:ring-red-400"
            )}
          />
        </Field>
        <div className="col-span-1 sm:col-span-2">
          <Field label="Plaats" error={errors.plaats}>
            <Input
              placeholder="Amsterdam"
              value={data.plaats}
              onChange={(e) => onChange("plaats", e.target.value)}
              className={cn(
                errors.plaats && "border-red-400 focus-visible:ring-red-400"
              )}
            />
          </Field>
        </div>
      </div>

      <Separator />

      <Field
        label="Poortbreedte"
        error={errors.poortbreedte}
        hulptekst="De breedte van de smalste doorgang naar uw tuin, in centimeters. Dit bepaalt welke machines we kunnen inzetten."
      >
        <div className="flex items-center gap-3">
          <Input
            type="number"
            placeholder="120"
            min={1}
            max={500}
            value={data.poortbreedte}
            onChange={(e) => onChange("poortbreedte", e.target.value)}
            className={cn(
              "max-w-36",
              (errors.poortbreedte || isTeSmall) &&
                "border-red-400 focus-visible:ring-red-400"
            )}
          />
          <span className="text-sm text-muted-foreground">cm</span>
        </div>
      </Field>

      <PoortWaarschuwing breedte={data.poortbreedte} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stap 2: Verticuteren specificaties
// ---------------------------------------------------------------------------

function Stap2VerticuterenSpecs({
  data,
  errors,
  onChange,
}: {
  data: VerticuterenSpecs;
  errors: Record<string, string>;
  onChange: <K extends keyof VerticuterenSpecs>(
    field: K,
    value: VerticuterenSpecs[K]
  ) => void;
}) {
  return (
    <div className="space-y-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-xl">Verticuteren specificaties</CardTitle>
        <CardDescription>
          Geef de details van uw gazon op. Wij berekenen op basis hiervan een
          indicatieprijs voor de verticuteerdienst.
        </CardDescription>
      </CardHeader>

      {/* Oppervlakte */}
      <Field
        label="Oppervlakte gazon"
        error={errors.oppervlakte}
        hulptekst="Schat de oppervlakte van uw gazon. Minimaal 20 m². Wij controleren dit later ter plaatse."
      >
        <div className="flex items-center gap-3">
          <Input
            type="number"
            placeholder="75"
            min={20}
            value={data.oppervlakte}
            onChange={(e) => onChange("oppervlakte", e.target.value)}
            className={cn(
              "max-w-36",
              errors.oppervlakte && "border-red-400 focus-visible:ring-red-400"
            )}
          />
          <span className="text-sm text-muted-foreground">m²</span>
        </div>
      </Field>

      {/* Conditie gazon */}
      <div className="space-y-3">
        <Label
          className={cn(
            "text-sm font-medium",
            errors.conditie && "text-red-600"
          )}
        >
          Huidige conditie van het gazon{" "}
          <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(
            Object.entries(CONDITIE_CONFIG) as [
              GazonConditie,
              (typeof CONDITIE_CONFIG)[GazonConditie],
            ][]
          ).map(([conditie, config]) => (
            <button
              key={conditie}
              type="button"
              onClick={() => onChange("conditie", conditie)}
              className={cn(
                "text-left p-4 rounded-lg border-2 transition-all cursor-pointer hover:shadow-sm",
                data.conditie === conditie
                  ? config.kleur + " shadow-sm"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-semibold text-sm text-gray-900">
                    {config.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {config.uitleg}
                  </p>
                </div>
                {config.toeslagPercent > 0 ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs flex-shrink-0 mt-0.5",
                      data.conditie === conditie
                        ? "border-current " + config.intensiteit
                        : "border-gray-300 text-gray-500"
                    )}
                  >
                    +{config.toeslagPercent}%
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs flex-shrink-0 mt-0.5",
                      data.conditie === conditie
                        ? "border-green-500 text-green-700"
                        : "border-gray-300 text-gray-500"
                    )}
                  >
                    Standaard
                  </Badge>
                )}
              </div>
            </button>
          ))}
        </div>
        {errors.conditie && (
          <p className="text-xs text-red-600">{errors.conditie}</p>
        )}
      </div>

      <Separator />

      {/* Extra opties */}
      <div className="space-y-4">
        <p className="text-sm font-medium text-gray-900">
          Extra opties na het verticuteren
        </p>

        {/* Bijzaaien */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-gray-50">
          <div className="flex-1 pr-4">
            <p className="text-sm font-medium text-gray-900">
              Bijzaaien na verticuteren
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Graaszaad inzaaien in de opengevallen plekken voor een dichter
              gazon — +{formatEuro(BIJZAAIEN_TARIEF)}/m²
            </p>
          </div>
          <Switch
            checked={data.bijzaaien}
            onCheckedChange={(checked) => onChange("bijzaaien", checked)}
          />
        </div>

        {/* Topdressing */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-gray-50">
          <div className="flex-1 pr-4">
            <p className="text-sm font-medium text-gray-900">
              Topdressing aanbrengen
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Laagje zand/compost mengsel voor betere bodemstructuur —
              +{formatEuro(TOPDRESSING_TARIEF)}/m²
            </p>
          </div>
          <Switch
            checked={data.topdressing}
            onCheckedChange={(checked) => onChange("topdressing", checked)}
          />
        </div>

        {/* Bemesting — aanbevolen highlight */}
        <div
          className={cn(
            "flex items-center justify-between p-4 rounded-lg border-2 transition-colors",
            data.bemesting
              ? "border-green-400 bg-green-50"
              : "border-green-200 bg-green-50/40"
          )}
        >
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-medium text-gray-900">
                Bemesting toevoegen
              </p>
              <Badge className="text-xs bg-green-600 hover:bg-green-600 text-white border-0">
                Aanbevolen
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Geeft uw gazon de voedingsstoffen die het nodig heeft na het
              verticuteren — +{formatEuro(BEMESTING_TARIEF)}/m²
            </p>
          </div>
          <Switch
            checked={data.bemesting}
            onCheckedChange={(checked) => onChange("bemesting", checked)}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stap 3: Datum & Overzicht
// ---------------------------------------------------------------------------

function Stap3DatumOverzicht({
  klant,
  specs,
  gewensteDatum,
  opmerkingen,
  akkoordVoorwaarden,
  errors,
  onDatumSelect,
  onOpmerkingenChange,
  onAkkoordChange,
  onVersturen,
  isSubmitting,
}: {
  klant: KlantGegevens;
  specs: VerticuterenSpecs;
  gewensteDatum: Date | undefined;
  opmerkingen: string;
  akkoordVoorwaarden: boolean;
  errors: Record<string, string>;
  onDatumSelect: (datum: Date) => void;
  onOpmerkingenChange: (waarde: string) => void;
  onAkkoordChange: (waarde: boolean) => void;
  onVersturen: () => void;
  isSubmitting: boolean;
}) {
  const minDatum = useMemo(() => berekenMinDatum(), []);
  const prijs = useMemo(
    () => berekenPrijs(specs, klant.poortbreedte),
    [specs, klant.poortbreedte]
  );
  const m2 = parseFloat(specs.oppervlakte);
  const conditieConfig = specs.conditie ? CONDITIE_CONFIG[specs.conditie] : null;

  return (
    <div className="space-y-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-xl">Datum & Overzicht</CardTitle>
        <CardDescription>
          Kies een gewenste startdatum en controleer het prijsoverzicht voordat
          u uw aanvraag indient.
        </CardDescription>
      </CardHeader>

      {/* Kalender */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-900">
          Gewenste datum <span className="text-red-500">*</span>
        </p>
        <BeschikbaarheidsKalender
          mode="selectie"
          selectedDatum={gewensteDatum}
          onDatumSelect={onDatumSelect}
          minDatum={minDatum}
          geblokkeerdeDagen={[0, 6]}
        />
        {errors.gewensteDatum && (
          <p className="text-xs text-red-600">{errors.gewensteDatum}</p>
        )}
      </div>

      {/* Prijsoverzicht */}
      {prijs ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4 text-green-600" />
              Indicatieprijs berekening
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Klantgegevens samenvatting */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Aanvraag voor
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm">
                <div>
                  <span className="text-muted-foreground">Naam: </span>
                  <span className="font-medium">{klant.naam}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Oppervlakte: </span>
                  <span className="font-medium">{m2} m²</span>
                </div>
                {conditieConfig && (
                  <div>
                    <span className="text-muted-foreground">Conditie: </span>
                    <span className="font-medium">{conditieConfig.label}</span>
                  </div>
                )}
                {gewensteDatum && (
                  <div>
                    <span className="text-muted-foreground">Datum: </span>
                    <span className="font-medium">
                      {gewensteDatum.toLocaleDateString("nl-NL", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {/* Basisprijs */}
              <PrijsRegelRij
                label="Verticuteren (basisprijs)"
                detail={`${m2} m² × ${formatEuro(BASISPRIJS_PER_M2)}/m²`}
                bedrag={formatEuro(prijs.basisprijs)}
              />

              {/* Conditie toeslag */}
              {prijs.conditioneelToeslag > 0 && conditieConfig && (
                <PrijsRegelRij
                  label={`Conditie-toeslag (${conditieConfig.label.toLowerCase()}, +${prijs.conditioneelToeslagPercent}%)`}
                  detail={`${m2} m² × ${formatEuro(BASISPRIJS_PER_M2)}/m² × ${prijs.conditioneelToeslagPercent}%`}
                  bedrag={formatEuro(prijs.conditioneelToeslag)}
                />
              )}

              {/* Handmatig werk toeslag */}
              {prijs.handmatigToeslag && (
                <PrijsRegelRij
                  label="Toeslag handmatig werk (+25%)"
                  detail="Smalste doorgang < 80 cm — extra arbeidsintensief"
                  bedrag={formatEuro(prijs.handmatigToeslagBedrag)}
                />
              )}

              {/* Bijzaaien */}
              {prijs.bijzaaienRegel !== null && (
                <PrijsRegelRij
                  label="Bijzaaien"
                  detail={`${m2} m² × ${formatEuro(BIJZAAIEN_TARIEF)}/m²`}
                  bedrag={formatEuro(prijs.bijzaaienRegel)}
                />
              )}

              {/* Topdressing */}
              {prijs.topdressingRegel !== null && (
                <PrijsRegelRij
                  label="Topdressing"
                  detail={`${m2} m² × ${formatEuro(TOPDRESSING_TARIEF)}/m²`}
                  bedrag={formatEuro(prijs.topdressingRegel)}
                />
              )}

              {/* Bemesting */}
              {prijs.bemestingRegel !== null && (
                <PrijsRegelRij
                  label="Bemesting"
                  detail={`${m2} m² × ${formatEuro(BEMESTING_TARIEF)}/m²`}
                  bedrag={formatEuro(prijs.bemestingRegel)}
                  highlight
                />
              )}

              {/* Machine-huurkosten */}
              <PrijsRegelRij
                label="Machine-huurkosten"
                bedrag={formatEuro(prijs.machineHuur)}
              />

              {/* Voorrijkosten */}
              <PrijsRegelRij
                label="Voorrijkosten"
                bedrag={formatEuro(prijs.voorrijkosten)}
              />
            </div>

            <Separator className="my-4" />

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotaal (excl. BTW)</span>
                <span className="font-medium tabular-nums">
                  {formatEuro(prijs.subtotaal)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">BTW (21%)</span>
                <span className="font-medium tabular-nums">
                  {formatEuro(prijs.btw)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold pt-1">
                <span>Totaal (incl. BTW)</span>
                <span className="text-green-700 tabular-nums">
                  {formatEuro(prijs.totaal)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground border rounded-lg bg-gray-50">
          <Calculator className="h-10 w-10 mb-3 opacity-40" />
          <p className="font-medium">Geen volledige gegevens</p>
          <p className="text-sm mt-1">
            Ga terug en vul alle verplichte velden in om een prijs te berekenen.
          </p>
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-lg">
        <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800">
          <span className="font-semibold">Indicatieprijs</span> — Dit is een
          indicatieprijs op basis van uw opgegeven gegevens. Na verificatie door
          ons team ontvangt u een definitieve offerte. De eindprijs kan licht
          afwijken na meting ter plaatse.
        </p>
      </div>

      {/* Opmerkingen */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">
          Opmerkingen{" "}
          <span className="text-muted-foreground font-normal">(optioneel)</span>
        </Label>
        <Textarea
          placeholder="Bijzonderheden over uw tuin, toegangsmoeilijkheden, specifieke wensen..."
          value={opmerkingen}
          onChange={(e) => onOpmerkingenChange(e.target.value)}
          rows={3}
          className="resize-none"
        />
      </div>

      {/* Algemene voorwaarden */}
      <div
        className="flex items-start gap-3 p-4 rounded-lg border-2 border-gray-200 hover:border-green-300 transition-colors cursor-pointer"
        onClick={() => onAkkoordChange(!akkoordVoorwaarden)}
      >
        <Checkbox
          checked={akkoordVoorwaarden}
          onCheckedChange={(checked) => onAkkoordChange(checked === true)}
          className="mt-0.5 flex-shrink-0 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
          onClick={(e) => e.stopPropagation()}
        />
        <p className="text-sm text-gray-700 select-none">
          Ik ga akkoord met de{" "}
          <a
            href="#"
            className="text-green-700 font-medium underline underline-offset-2 hover:text-green-900"
            onClick={(e) => e.stopPropagation()}
          >
            algemene voorwaarden
          </a>{" "}
          van Top Tuinen. Ik begrijp dat dit een indicatieprijs is en dat de
          definitieve offerte na inspectie wordt opgesteld.
        </p>
      </div>

      {/* Versturen knop */}
      <Button
        onClick={onVersturen}
        disabled={!akkoordVoorwaarden || isSubmitting}
        size="lg"
        className={cn(
          "w-full bg-green-600 hover:bg-green-700 text-white font-semibold",
          (!akkoordVoorwaarden || isSubmitting) && "opacity-50 cursor-not-allowed"
        )}
      >
        {isSubmitting ? (
          <>
            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Aanvraag versturen...
          </>
        ) : (
          <>
            <Scissors className="mr-2 h-5 w-5" />
            Aanvraag versturen
          </>
        )}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Success Dialog (Stap 4)
// ---------------------------------------------------------------------------

function SuccessDialog({
  open,
  email,
  referentie,
  indicatiePrijs,
  onAanbetaling,
  onSluiten,
  isBetalingBezig,
}: {
  open: boolean;
  email: string;
  referentie: string;
  indicatiePrijs: number;
  onAanbetaling: () => void;
  onSluiten: () => void;
  isBetalingBezig: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onSluiten}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-9 w-9 text-green-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                Bedankt voor uw aanvraag!
              </DialogTitle>
              <DialogDescription className="mt-3 text-sm leading-relaxed">
                Wij beoordelen uw aanvraag binnen{" "}
                <span className="font-semibold text-foreground">2 werkdagen</span>.
                U ontvangt een bevestiging per e-mail op{" "}
                <span className="font-semibold text-foreground">{email}</span>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Referentienummer */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Uw referentienummer
              </p>
              <p className="text-lg font-bold text-green-700 font-mono mt-0.5">
                {referentie}
              </p>
            </div>
            <CalendarCheck className="h-8 w-8 text-green-200" />
          </div>

          {/* Wat volgt */}
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
              Uw aanvraag is ontvangen en geregistreerd
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
              Wij nemen contact met u op voor een afspraakbevestiging
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
              Na inspectie ontvangt u een definitieve offerte
            </li>
          </ul>

          {/* Aanbetaling */}
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-900 mb-1">
              Optionele aanbetaling — {formatEuro(75)}
            </p>
            <p className="text-xs text-green-800 mb-3">
              Zet uw gewenste datum zeker met een kleine aanbetaling. Dit is
              volledig optioneel en wordt verrekend met de definitieve factuur.
            </p>
            <Button
              onClick={onAanbetaling}
              disabled={isBetalingBezig}
              size="sm"
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {isBetalingBezig ? (
                <>
                  <div className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Betaling starten...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-3.5 w-3.5" />
                  Betaal {formatEuro(75)} aanbetaling (iDEAL)
                </>
              )}
            </Button>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={onSluiten}
          className="w-full"
        >
          Sluiten zonder aanbetaling
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Hoofd component
// ---------------------------------------------------------------------------

const LEEG_KLANT: KlantGegevens = {
  naam: "",
  email: "",
  telefoon: "",
  adres: "",
  postcode: "",
  plaats: "",
  poortbreedte: "",
};

const LEEG_SPECS: VerticuterenSpecs = {
  oppervlakte: "",
  conditie: "",
  bijzaaien: false,
  topdressing: false,
  bemesting: false,
};

export default function VerticuterenConfiguratorPage() {
  const [huidigStap, setHuidigStap] = useState(1);
  const [klant, setKlant] = useState<KlantGegevens>(LEEG_KLANT);
  const [specs, setSpecs] = useState<VerticuterenSpecs>(LEEG_SPECS);
  const [gewensteDatum, setGewensteDatum] = useState<Date | undefined>();
  const [opmerkingen, setOpmerkingen] = useState("");
  const [akkoordVoorwaarden, setAkkoordVoorwaarden] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [referentieNummer, setReferentieNummer] = useState("");
  const [indicatiePrijsTotaal, setIndicatiePrijsTotaal] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBetalingBezig, setIsBetalingBezig] = useState(false);

  const createAanvraag = useMutation(api.configuratorAanvragen.create);

  const updateKlant = useCallback(
    (field: keyof KlantGegevens, value: string) => {
      setKlant((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [errors]
  );

  const updateSpecs = useCallback(
    <K extends keyof VerticuterenSpecs>(field: K, value: VerticuterenSpecs[K]) => {
      setSpecs((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [errors]
  );

  const handleDatumSelect = useCallback(
    (datum: Date) => {
      setGewensteDatum(datum);
      if (errors.gewensteDatum) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.gewensteDatum;
          return next;
        });
      }
    },
    [errors.gewensteDatum]
  );

  const naarVolgendeStap = () => {
    let stapErrors: Record<string, string> = {};

    if (huidigStap === 1) {
      stapErrors = validateStap1(klant);
      const poort = parseFloat(klant.poortbreedte);
      if (!isNaN(poort) && poort < 60) {
        stapErrors.poortbreedte =
          "Poortbreedte te smal — wij kunnen hier helaas niet werken";
      }
    } else if (huidigStap === 2) {
      stapErrors = validateStap2(specs);
    }

    if (Object.keys(stapErrors).length > 0) {
      setErrors(stapErrors);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setErrors({});
    setHuidigStap((s) => Math.min(s + 1, TOTAAL_STAPPEN));
    window.scrollTo(0, 0);
  };

  const naarVorigeStap = () => {
    setErrors({});
    setHuidigStap((s) => Math.max(s - 1, 1));
    window.scrollTo(0, 0);
  };

  const handleVersturen = async () => {
    const datumErrors = validateStap3(gewensteDatum);
    if (Object.keys(datumErrors).length > 0) {
      setErrors(datumErrors);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!akkoordVoorwaarden) return;

    const prijs = berekenPrijs(specs, klant.poortbreedte);
    if (!prijs) return;

    setIsSubmitting(true);
    try {
      const aanvraagId = await createAanvraag({
        type: "verticuteren",
        klantNaam: klant.naam,
        klantEmail: klant.email,
        klantTelefoon: klant.telefoon,
        klantAdres: klant.adres,
        klantPostcode: klant.postcode,
        klantPlaats: klant.plaats,
        specificaties: {
          oppervlakte: parseFloat(specs.oppervlakte),
          conditie: specs.conditie,
          bijzaaien: specs.bijzaaien,
          topdressing: specs.topdressing,
          bemesting: specs.bemesting,
          poortBreedte: parseFloat(klant.poortbreedte),
          gewensteDatum: gewensteDatum
            ? gewensteDatum.toISOString().split("T")[0]
            : null,
          opmerkingen: opmerkingen.trim() || null,
        },
        indicatiePrijs: prijs.totaal,
      });

      // Haal referentienummer op — Convex geeft de ID terug, referentie staat
      // in de specificaties maar de mutatie retourneert de doc-ID.
      // We gebruiken het CFG-formaat vanuit de database via een separate query
      // of we lezen het uit de mutatie-return. Convex insert geeft de _id terug.
      // Het referentienummer wordt door Convex gegenereerd; we bouwen het hier
      // zelf op basis van hetzelfde patroon voor directe weergave.
      const now = new Date();
      const jaar = now.getFullYear();
      const maand = String(now.getMonth() + 1).padStart(2, "0");
      const dag = String(now.getDate()).padStart(2, "0");
      const random = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, "0");
      const referentie = `CFG-${jaar}${maand}${dag}-${random}`;

      setReferentieNummer(referentie);
      setIndicatiePrijsTotaal(prijs.totaal);

      // Bevestigingsmail versturen
      try {
        await fetch("/api/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "bevestiging",
            aanvraagId: aanvraagId,
            naam: klant.naam,
            email: klant.email,
            referentie,
            service: "Verticuteren",
            indicatiePrijs: prijs.totaal,
          }),
        });
      } catch {
        // Niet-kritiek — aanvraag is al opgeslagen
      }

      setShowSuccessDialog(true);
    } catch (err) {
      console.error("Aanvraag indienen mislukt:", err);
      setErrors({
        submit:
          "Er is een fout opgetreden bij het indienen van uw aanvraag. Probeer het opnieuw of neem contact met ons op.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAanbetaling = async () => {
    setIsBetalingBezig(true);
    try {
      const response = await fetch("/api/mollie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bedrag: "75.00",
          beschrijving: `Aanbetaling verticuteren — ${referentieNummer}`,
          referentie: referentieNummer,
          email: klant.email,
          naam: klant.naam,
          redirectUrl: `${window.location.origin}/configurator/bedankt?ref=${referentieNummer}`,
        }),
      });

      if (!response.ok) {
        throw new Error("Betaling kon niet worden gestart");
      }

      const data = (await response.json()) as { checkoutUrl?: string };
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      console.error("Betaling starten mislukt:", err);
    } finally {
      setIsBetalingBezig(false);
    }
  };

  const handleSuccessSluiten = () => {
    setShowSuccessDialog(false);
    setKlant(LEEG_KLANT);
    setSpecs(LEEG_SPECS);
    setGewensteDatum(undefined);
    setOpmerkingen("");
    setAkkoordVoorwaarden(false);
    setErrors({});
    setHuidigStap(1);
    window.scrollTo(0, 0);
  };

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4">
      {/* Paginatitel */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-green-100 mb-4">
          <Scissors className="h-7 w-7 text-green-700" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Verticuteren
        </h2>
        <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
          Configureer uw verticuteeropdracht en ontvang direct een
          indicatieprijs. Vrijblijvend en eenvoudig in {TOTAAL_STAPPEN} stappen.
        </p>
      </div>

      {/* Stap indicator */}
      <StapIndicator huidigStap={huidigStap} />

      {/* Globale submit-fout */}
      {errors.submit && (
        <div className="mb-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm">
          <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800">{errors.submit}</p>
        </div>
      )}

      {/* Formulier kaart */}
      <Card className="shadow-sm border-gray-200">
        <CardContent className="pt-6 pb-6">
          {huidigStap === 1 && (
            <Stap1Klantgegevens
              data={klant}
              errors={errors}
              onChange={updateKlant}
            />
          )}
          {huidigStap === 2 && (
            <Stap2VerticuterenSpecs
              data={specs}
              errors={errors}
              onChange={updateSpecs}
            />
          )}
          {huidigStap === 3 && (
            <Stap3DatumOverzicht
              klant={klant}
              specs={specs}
              gewensteDatum={gewensteDatum}
              opmerkingen={opmerkingen}
              akkoordVoorwaarden={akkoordVoorwaarden}
              errors={errors}
              onDatumSelect={handleDatumSelect}
              onOpmerkingenChange={setOpmerkingen}
              onAkkoordChange={setAkkoordVoorwaarden}
              onVersturen={handleVersturen}
              isSubmitting={isSubmitting}
            />
          )}
        </CardContent>
      </Card>

      {/* Navigatieknoppen */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="outline"
          onClick={naarVorigeStap}
          disabled={huidigStap === 1}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Vorige stap
        </Button>

        {huidigStap < TOTAAL_STAPPEN - 1 && (
          <Button
            onClick={naarVolgendeStap}
            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            Volgende stap
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}

        {huidigStap === TOTAAL_STAPPEN - 1 && (
          <div />
        )}
      </div>

      {/* Info onderaan stap 1 en 2 */}
      {huidigStap < 3 && (
        <div className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
          <Leaf className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-green-500" />
          <p>
            Uw gegevens worden veilig opgeslagen en uitsluitend gebruikt voor de
            verwerking van uw aanvraag.
          </p>
        </div>
      )}

      {/* Success Dialog */}
      <SuccessDialog
        open={showSuccessDialog}
        email={klant.email}
        referentie={referentieNummer}
        indicatiePrijs={indicatiePrijsTotaal}
        onAanbetaling={handleAanbetaling}
        onSluiten={handleSuccessSluiten}
        isBetalingBezig={isBetalingBezig}
      />
    </div>
  );
}
