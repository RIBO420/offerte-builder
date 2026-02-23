"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { toast } from "sonner";
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
  ImageOff,
  ExternalLink,
  Leaf,
  Calculator,
  Info,
  CreditCard,
  Loader2,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BeschikbaarheidsKalender } from "@/components/beschikbaarheids-kalender";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TypeGras = "graszoden" | "inzaaien" | "kunstgras";
type Ondergrond = "bestaand_gras" | "kale_grond" | "bestrating_verwijderen";

interface KlantGegevens {
  naam: string;
  email: string;
  telefoon: string;
  adres: string;
  postcode: string;
  plaats: string;
  poortbreedte: string;
}

interface GazonSpecs {
  oppervlakte: string;
  typeGras: TypeGras | "";
  ondergrond: Ondergrond | "";
  drainage: boolean;
  opsluitbanden: boolean;
  opsluitbandenMeters: string;
  gewensteStartdatum: Date | undefined;
}

interface FormData {
  klant: KlantGegevens;
  specs: GazonSpecs;
}

interface PrijsBerekening {
  gazonRegel: { label: string; m2: number; tarief: number; totaal: number };
  ondergrondRegel: { label: string; m2: number; tarief: number; totaal: number } | null;
  drainageRegel: { label: string; meters: number; tarief: number; totaal: number } | null;
  opsluitbandenRegel: { label: string; meters: number; tarief: number; totaal: number } | null;
  voorrijkosten: number;
  handmatigToeslag: boolean;
  handmatigToeslagPercent: number;
  subtotaalExToeslag: number;
  toeslagBedrag: number;
  subtotaal: number;
  btw: number;
  totaal: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STAP_LABELS = ["Klantgegevens", "Gazon specificaties", "Foto's", "Prijsoverzicht"];
const TOTAAL_STAPPEN = 4;
const AANBETALING_BEDRAG = 75;

const TYPE_GRAS_CONFIG: Record<
  TypeGras,
  { label: string; uitleg: string; prijsIndicatie: string; tarief: number; kleur: string }
> = {
  graszoden: {
    label: "Graszoden",
    uitleg: "Direct mooi resultaat. Hoge kwaliteit graszoden worden vakkundig gelegd voor een instant gazon.",
    prijsIndicatie: "€12–15 / m²",
    tarief: 14,
    kleur: "border-green-500 bg-green-50",
  },
  inzaaien: {
    label: "Inzaaien",
    uitleg: "Voordeliger optie met een groeitijd van 4–8 weken. Ideaal voor grote oppervlakken.",
    prijsIndicatie: "€5–8 / m²",
    tarief: 6,
    kleur: "border-lime-500 bg-lime-50",
  },
  kunstgras: {
    label: "Kunstgras",
    uitleg: "Onderhoudsvrij en altijd groen. Ideaal voor gezinnen met kinderen of huisdieren.",
    prijsIndicatie: "€35–60 / m²",
    tarief: 45,
    kleur: "border-emerald-500 bg-emerald-50",
  },
};

const ONDERGROND_CONFIG: Record<
  Ondergrond,
  { label: string; uitleg: string; tarief: number; toeslag: boolean }
> = {
  bestaand_gras: {
    label: "Bestaand gras verwijderen",
    uitleg: "Huidig gras wordt gefreesd of afgeplagd en afgevoerd.",
    tarief: 2,
    toeslag: false,
  },
  kale_grond: {
    label: "Kale grond (klaar voor gebruik)",
    uitleg: "De grond is al vrijgemaakt. Enkel nivelleren en voorbereiden.",
    tarief: 0,
    toeslag: false,
  },
  bestrating_verwijderen: {
    label: "Bestrating verwijderen",
    uitleg: "Tegels, klinkers of ander verhardingsmateriaal wordt verwijderd en afgevoerd.",
    tarief: 8,
    toeslag: true,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEuro(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDatumVolledig(datum: Date): string {
  return datum.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function berekenPrijs(data: FormData): PrijsBerekening | null {
  const m2 = parseFloat(data.specs.oppervlakte);
  if (!data.specs.typeGras || !data.specs.ondergrond || isNaN(m2) || m2 < 10) {
    return null;
  }

  const gazonTarief = TYPE_GRAS_CONFIG[data.specs.typeGras as TypeGras].tarief;
  const ondergrondTarief = ONDERGROND_CONFIG[data.specs.ondergrond as Ondergrond].tarief;
  const gazonLabel = TYPE_GRAS_CONFIG[data.specs.typeGras as TypeGras].label;
  const ondergrondLabel = ONDERGROND_CONFIG[data.specs.ondergrond as Ondergrond].label;

  const gazonRegel = {
    label: `Gazon (${gazonLabel.toLowerCase()})`,
    m2,
    tarief: gazonTarief,
    totaal: m2 * gazonTarief,
  };

  const ondergrondRegel =
    ondergrondTarief > 0
      ? {
          label: `Ondergrond (${ondergrondLabel.toLowerCase()})`,
          m2,
          tarief: ondergrondTarief,
          totaal: m2 * ondergrondTarief,
        }
      : null;

  const geschatDrainageMeters = data.specs.drainage ? Math.ceil(m2 / 10) : 0;
  const drainageRegel =
    data.specs.drainage && geschatDrainageMeters > 0
      ? {
          label: "Drainage",
          meters: geschatDrainageMeters,
          tarief: 15,
          totaal: geschatDrainageMeters * 15,
        }
      : null;

  const opsluitbandenMeters = data.specs.opsluitbanden
    ? parseFloat(data.specs.opsluitbandenMeters) || 0
    : 0;
  const opsluitbandenRegel =
    data.specs.opsluitbanden && opsluitbandenMeters > 0
      ? {
          label: "Opsluitbanden",
          meters: opsluitbandenMeters,
          tarief: 18,
          totaal: opsluitbandenMeters * 18,
        }
      : null;

  const voorrijkosten = 75;

  const subtotaalExToeslag =
    gazonRegel.totaal +
    (ondergrondRegel?.totaal ?? 0) +
    (drainageRegel?.totaal ?? 0) +
    (opsluitbandenRegel?.totaal ?? 0) +
    voorrijkosten;

  const poort = parseFloat(data.klant.poortbreedte);
  const handmatigToeslag = !isNaN(poort) && poort < 80;
  const handmatigToeslagPercent = 25;
  const toeslagBedrag = handmatigToeslag
    ? Math.round(subtotaalExToeslag * (handmatigToeslagPercent / 100) * 100) / 100
    : 0;

  const subtotaal = subtotaalExToeslag + toeslagBedrag;
  const btw = Math.round(subtotaal * 0.21 * 100) / 100;
  const totaal = subtotaal + btw;

  return {
    gazonRegel,
    ondergrondRegel,
    drainageRegel,
    opsluitbandenRegel,
    voorrijkosten,
    handmatigToeslag,
    handmatigToeslagPercent,
    subtotaalExToeslag,
    toeslagBedrag,
    subtotaal,
    btw,
    totaal,
  };
}

// ---------------------------------------------------------------------------
// Validation
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

function validateStap2(specs: GazonSpecs): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!specs.oppervlakte.trim()) {
    errors.oppervlakte = "Oppervlakte is verplicht";
  } else {
    const opp = parseFloat(specs.oppervlakte);
    if (isNaN(opp) || opp < 10) {
      errors.oppervlakte = "Minimaal 10 m²";
    }
  }

  if (!specs.typeGras) errors.typeGras = "Selecteer een type gras";
  if (!specs.ondergrond) errors.ondergrond = "Selecteer de huidige ondergrond";

  if (specs.opsluitbanden) {
    const meters = parseFloat(specs.opsluitbandenMeters);
    if (!specs.opsluitbandenMeters.trim() || isNaN(meters) || meters <= 0) {
      errors.opsluitbandenMeters = "Voer het aantal meters in";
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StapIndicator({ huidigStap }: { huidigStap: number }) {
  const voortgang = (huidigStap / TOTAAL_STAPPEN) * 100;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">
          Stap {huidigStap} van {TOTAAL_STAPPEN}
        </span>
        <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
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
              className={cn(
                "flex flex-col items-center gap-1",
                "hidden sm:flex"
              )}
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
                  "text-xs text-center",
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
            Helaas kunnen wij hier niet werken met onze machines bij een poortbreedte
            van minder dan 60 cm. Neem contact met ons op voor een maatwerkoplossing.
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

function Field({ label, error, children, verplicht = true, hulptekst }: FieldProps) {
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

      {/* Naam */}
      <Field label="Volledige naam" error={errors.naam}>
        <Input
          placeholder="Jan de Vries"
          value={data.naam}
          onChange={(e) => onChange("naam", e.target.value)}
          className={cn(errors.naam && "border-red-400 focus-visible:ring-red-400")}
        />
      </Field>

      {/* Email + Telefoon */}
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
            className={cn(errors.telefoon && "border-red-400 focus-visible:ring-red-400")}
          />
        </Field>
      </div>

      {/* Adres */}
      <Field label="Straat en huisnummer" error={errors.adres}>
        <Input
          placeholder="Tuinstraat 12"
          value={data.adres}
          onChange={(e) => onChange("adres", e.target.value)}
          className={cn(errors.adres && "border-red-400 focus-visible:ring-red-400")}
        />
      </Field>

      {/* Postcode + Plaats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Field label="Postcode" error={errors.postcode}>
          <Input
            placeholder="1234 AB"
            value={data.postcode}
            onChange={(e) => onChange("postcode", e.target.value)}
            className={cn(errors.postcode && "border-red-400 focus-visible:ring-red-400")}
          />
        </Field>
        <div className="col-span-1 sm:col-span-2">
          <Field label="Plaats" error={errors.plaats}>
            <Input
              placeholder="Amsterdam"
              value={data.plaats}
              onChange={(e) => onChange("plaats", e.target.value)}
              className={cn(errors.plaats && "border-red-400 focus-visible:ring-red-400")}
            />
          </Field>
        </div>
      </div>

      <Separator />

      {/* Poortbreedte */}
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
// Stap 2: Gazon specificaties
// ---------------------------------------------------------------------------

function Stap2GazonSpecs({
  data,
  errors,
  onChange,
}: {
  data: GazonSpecs;
  errors: Record<string, string>;
  onChange: <K extends keyof GazonSpecs>(field: K, value: GazonSpecs[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-xl">Gazon specificaties</CardTitle>
        <CardDescription>
          Vertel ons over uw tuin en gewenste gazon. Wij controleren de
          afmetingen later on-site.
        </CardDescription>
      </CardHeader>

      {/* Oppervlakte */}
      <Field
        label="Geschatte oppervlakte"
        error={errors.oppervlakte}
        hulptekst="Meet uw tuin op of schat het oppervlak. Wij controleren dit later ter plaatse."
      >
        <div className="flex items-center gap-3">
          <Input
            type="number"
            placeholder="50"
            min={10}
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

      {/* Type gras */}
      <div className="space-y-3">
        <Label className={cn("text-sm font-medium", errors.typeGras && "text-red-600")}>
          Type gras <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.entries(TYPE_GRAS_CONFIG) as [TypeGras, typeof TYPE_GRAS_CONFIG[TypeGras]][]).map(
            ([type, config]) => (
              <button
                key={type}
                type="button"
                onClick={() => onChange("typeGras", type)}
                className={cn(
                  "text-left p-4 rounded-lg border-2 transition-all cursor-pointer hover:shadow-sm",
                  data.typeGras === type
                    ? config.kleur + " shadow-sm"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                )}
              >
                <p className="font-semibold text-sm text-gray-900">{config.label}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {config.uitleg}
                </p>
                <Badge
                  variant="outline"
                  className={cn(
                    "mt-3 text-xs",
                    data.typeGras === type
                      ? "border-current"
                      : "border-gray-300"
                  )}
                >
                  {config.prijsIndicatie}
                </Badge>
              </button>
            )
          )}
        </div>
        {errors.typeGras && (
          <p className="text-xs text-red-600">{errors.typeGras}</p>
        )}
      </div>

      {/* Ondergrond */}
      <div className="space-y-3">
        <Label className={cn("text-sm font-medium", errors.ondergrond && "text-red-600")}>
          Huidige ondergrond <span className="text-red-500">*</span>
        </Label>
        <div className="space-y-2">
          {(Object.entries(ONDERGROND_CONFIG) as [Ondergrond, typeof ONDERGROND_CONFIG[Ondergrond]][]).map(
            ([type, config]) => (
              <button
                key={type}
                type="button"
                onClick={() => onChange("ondergrond", type)}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-lg border-2 transition-all cursor-pointer hover:shadow-sm flex items-start justify-between gap-4",
                  data.ondergrond === type
                    ? "border-green-500 bg-green-50 shadow-sm"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900">{config.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{config.uitleg}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {config.toeslag && (
                    <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50">
                      Toeslag
                    </Badge>
                  )}
                  {config.tarief > 0 && (
                    <span className="text-xs font-medium text-gray-600">
                      +€{config.tarief}/m²
                    </span>
                  )}
                  {config.tarief === 0 && (
                    <span className="text-xs font-medium text-green-700">
                      Inbegrepen
                    </span>
                  )}
                </div>
              </button>
            )
          )}
        </div>
        {errors.ondergrond && (
          <p className="text-xs text-red-600">{errors.ondergrond}</p>
        )}
      </div>

      <Separator />

      {/* Opties */}
      <div className="space-y-4">
        <p className="text-sm font-medium text-gray-900">Extra opties</p>

        {/* Drainage */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-gray-50">
          <div className="flex-1 pr-4">
            <p className="text-sm font-medium text-gray-900">Drainage aanleggen</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Aanbevolen bij zware kleigrond of wateroverlast. Schatting: 1 m
              drainage per 10 m² — €15/m
            </p>
          </div>
          <Switch
            checked={data.drainage}
            onCheckedChange={(checked) => onChange("drainage", checked)}
          />
        </div>

        {/* Opsluitbanden */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-gray-50">
          <div className="flex-1 pr-4">
            <p className="text-sm font-medium text-gray-900">Opsluitbanden plaatsen</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Nette afscheiding van het gazon naar borders, paden of bestrating — €18/m
            </p>
          </div>
          <Switch
            checked={data.opsluitbanden}
            onCheckedChange={(checked) => {
              onChange("opsluitbanden", checked);
              if (!checked) onChange("opsluitbandenMeters", "");
            }}
          />
        </div>

        {/* Opsluitbanden meters — alleen zichtbaar als toggle aan */}
        {data.opsluitbanden && (
          <div className="ml-4 pl-4 border-l-2 border-green-200">
            <Field label="Aantal strekkende meters" error={errors.opsluitbandenMeters}>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  placeholder="20"
                  min={1}
                  value={data.opsluitbandenMeters}
                  onChange={(e) => onChange("opsluitbandenMeters", e.target.value)}
                  className={cn(
                    "max-w-36",
                    errors.opsluitbandenMeters &&
                      "border-red-400 focus-visible:ring-red-400"
                  )}
                />
                <span className="text-sm text-muted-foreground">m</span>
              </div>
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stap 3: Foto upload
// ---------------------------------------------------------------------------

function Stap3FotoUpload() {
  return (
    <div className="space-y-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-xl">Foto&#39;s van uw tuin</CardTitle>
        <CardDescription>
          Upload foto&#39;s van uw huidige tuin zodat wij een accurate beoordeling
          kunnen maken. Minimaal 2 foto&#39;s zijn nodig.
        </CardDescription>
      </CardHeader>

      {/* Upload zone — placeholder */}
      <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <ImageOff className="h-7 w-7 text-gray-400" />
          </div>
          <div>
            <p className="font-medium text-gray-600">Foto upload wordt binnenkort toegevoegd</p>
            <p className="text-sm text-muted-foreground mt-1">
              U kunt foto&#39;s later per e-mail sturen naar info@toptuinen.nl
            </p>
          </div>
          <Badge variant="outline" className="text-gray-500 border-gray-300 mt-2">
            Binnenkort beschikbaar
          </Badge>
        </div>
      </div>

      {/* Instructies */}
      <Card className="border-blue-100 bg-blue-50/50">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-blue-900">Tips voor goede foto&#39;s</p>
              <ul className="text-sm text-blue-800 space-y-1 list-none">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">1.</span>
                  Maak een overzichtsfoto van de gehele tuin
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">2.</span>
                  Foto van de poort / doorgang naar de tuin
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">3.</span>
                  Foto&#39;s van de huidige ondergrond (gras, tegels, e.d.)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">4.</span>
                  Eventuele probleemgebieden (waterplassen, kale plekken)
                </li>
              </ul>
              <a
                href="#"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-900 underline underline-offset-2 mt-1"
                onClick={(e) => e.preventDefault()}
              >
                Bekijk hoe u correct opmeet
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-lg">
        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          <span className="font-semibold">Let op:</span> De foto&#39;s zijn niet verplicht
          voor het indienen van uw aanvraag, maar helpen ons bij een nauwkeurigere
          beoordeling en snellere afhandeling.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stap 4: Prijsoverzicht
// ---------------------------------------------------------------------------

function PrijsRegelRij({
  label,
  detail,
  bedrag,
  isSubtotaal,
}: {
  label: string;
  detail?: string;
  bedrag: string;
  isSubtotaal?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between py-2 gap-4",
        isSubtotaal && "font-medium"
      )}
    >
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm", isSubtotaal && "font-semibold")}>{label}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
      <p className={cn("text-sm font-medium flex-shrink-0 tabular-nums", isSubtotaal && "font-semibold")}>
        {bedrag}
      </p>
    </div>
  );
}

function Stap4Prijsoverzicht({
  data,
  akkoordVoorwaarden,
  onAkkoordChange,
  onVersturen,
  isSubmitting,
  onStartdatumChange,
}: {
  data: FormData;
  akkoordVoorwaarden: boolean;
  onAkkoordChange: (value: boolean) => void;
  onVersturen: () => void;
  isSubmitting: boolean;
  onStartdatumChange: (datum: Date | undefined) => void;
}) {
  const prijs = berekenPrijs(data);

  if (!prijs) {
    return (
      <div className="space-y-6">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-xl">Prijsoverzicht</CardTitle>
        </CardHeader>
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <Calculator className="h-10 w-10 mb-3 opacity-40" />
          <p className="font-medium">Onvolledige gegevens</p>
          <p className="text-sm mt-1">
            Ga terug en vul alle verplichte velden in om een prijs te berekenen.
          </p>
        </div>
      </div>
    );
  }

  const m2 = parseFloat(data.specs.oppervlakte);
  const typeLabel =
    data.specs.typeGras
      ? TYPE_GRAS_CONFIG[data.specs.typeGras as TypeGras].label
      : "";

  return (
    <div className="space-y-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-xl">Prijsoverzicht & Bevestiging</CardTitle>
        <CardDescription>
          Hieronder vindt u de indicatieprijs op basis van de door u opgegeven
          gegevens. Na uw aanvraag controleren wij de details ter plaatse.
        </CardDescription>
      </CardHeader>

      {/* Klantgegevens samenvatting */}
      <Card className="bg-gray-50 border-gray-200">
        <CardContent className="pt-4 pb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Aanvraag voor
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm">
            <div>
              <span className="text-muted-foreground">Naam: </span>
              <span className="font-medium">{data.klant.naam}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Email: </span>
              <span className="font-medium">{data.klant.email}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Adres: </span>
              <span className="font-medium">
                {data.klant.adres}, {data.klant.postcode} {data.klant.plaats}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Oppervlakte: </span>
              <span className="font-medium">{m2} m² ({typeLabel})</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prijsberekening */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4 text-green-600" />
            Indicatieprijs berekening
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-gray-100">
            {/* Gazon */}
            <PrijsRegelRij
              label={prijs.gazonRegel.label}
              detail={`${m2} m² × ${formatEuro(prijs.gazonRegel.tarief)}/m²`}
              bedrag={formatEuro(prijs.gazonRegel.totaal)}
            />

            {/* Ondergrond */}
            {prijs.ondergrondRegel && (
              <PrijsRegelRij
                label={prijs.ondergrondRegel.label}
                detail={`${m2} m² × ${formatEuro(prijs.ondergrondRegel.tarief)}/m²`}
                bedrag={formatEuro(prijs.ondergrondRegel.totaal)}
              />
            )}

            {/* Drainage */}
            {prijs.drainageRegel && (
              <PrijsRegelRij
                label={prijs.drainageRegel.label}
                detail={`${prijs.drainageRegel.meters} m × ${formatEuro(prijs.drainageRegel.tarief)}/m (schatting)`}
                bedrag={formatEuro(prijs.drainageRegel.totaal)}
              />
            )}

            {/* Opsluitbanden */}
            {prijs.opsluitbandenRegel && (
              <PrijsRegelRij
                label={prijs.opsluitbandenRegel.label}
                detail={`${prijs.opsluitbandenRegel.meters} m × ${formatEuro(prijs.opsluitbandenRegel.tarief)}/m`}
                bedrag={formatEuro(prijs.opsluitbandenRegel.totaal)}
              />
            )}

            {/* Voorrijkosten */}
            <PrijsRegelRij
              label="Voorrijkosten"
              bedrag={formatEuro(prijs.voorrijkosten)}
            />

            {/* Handmatig werk toeslag */}
            {prijs.handmatigToeslag && (
              <PrijsRegelRij
                label={`Toeslag handmatig werk (${prijs.handmatigToeslagPercent}%)`}
                detail="Smalste doorgang < 80 cm — extra arbeidsintensief"
                bedrag={formatEuro(prijs.toeslagBedrag)}
              />
            )}
          </div>

          <Separator className="my-4" />

          {/* Subtotaal, BTW, Totaal */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotaal (excl. BTW)</span>
              <span className="font-medium tabular-nums">{formatEuro(prijs.subtotaal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">BTW (21%)</span>
              <span className="font-medium tabular-nums">{formatEuro(prijs.btw)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-bold pt-1">
              <span>Totaal (incl. BTW)</span>
              <span className="text-green-700 tabular-nums">{formatEuro(prijs.totaal)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

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

      {/* Gewenste startdatum */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-green-600" />
          <h3 className="text-sm font-semibold text-gray-900">Gewenste startdatum</h3>
          <Badge variant="outline" className="text-xs text-muted-foreground border-gray-300">
            Optioneel
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Selecteer uw voorkeursdatum voor de start van de werkzaamheden. Wij
          bevestigen de definitieve datum na overleg.
        </p>
        <BeschikbaarheidsKalender
          mode="selectie"
          selectedDatum={data.specs.gewensteStartdatum}
          onDatumSelect={onStartdatumChange}
        />
        {data.specs.gewensteStartdatum && (
          <button
            type="button"
            onClick={() => onStartdatumChange(undefined)}
            className="text-xs text-muted-foreground hover:text-red-600 underline underline-offset-2 transition-colors"
          >
            Datum wissen
          </button>
        )}
      </div>

      {/* Akkoord voorwaarden */}
      <div className="flex items-start gap-3 p-4 rounded-lg border-2 border-gray-200 hover:border-green-300 transition-colors cursor-pointer"
        onClick={() => onAkkoordChange(!akkoordVoorwaarden)}
      >
        <div
          className={cn(
            "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 mt-0.5 transition-colors",
            akkoordVoorwaarden
              ? "bg-green-600 border-green-600"
              : "border-gray-300 bg-white"
          )}
        >
          {akkoordVoorwaarden && (
            <CheckCircle2 className="h-3.5 w-3.5 text-white" />
          )}
        </div>
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
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Aanvraag versturen...
          </>
        ) : (
          <>
            <Leaf className="mr-2 h-5 w-5" />
            Aanvraag versturen
          </>
        )}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Success Dialog
// ---------------------------------------------------------------------------

interface SuccessDialogProps {
  open: boolean;
  email: string;
  referentie: string;
  klantNaam: string;
  klantEmail: string;
  onSluiten: () => void;
}

function SuccessDialog({
  open,
  email,
  referentie,
  klantNaam,
  klantEmail,
  onSluiten,
}: SuccessDialogProps) {
  const [aanbetaalBezig, setAanbetaalBezig] = useState(false);

  const startAanbetaling = async () => {
    if (aanbetaalBezig) return;
    setAanbetaalBezig(true);

    try {
      const appUrl = window.location.origin;
      const redirectUrl = `${appUrl}/configurator/bedankt?referentie=${encodeURIComponent(referentie)}&betaald=1`;

      const response = await fetch("/api/mollie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: {
            currency: "EUR",
            value: AANBETALING_BEDRAG.toFixed(2),
          },
          description: `Aanbetaling gazon configuratie — ${referentie}`,
          redirectUrl,
          metadata: {
            referentie,
            klantNaam,
            klantEmail,
            type: "configurator",
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Fout bij starten van betaling");
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error("Geen checkout URL ontvangen van Mollie");
      }
    } catch (err) {
      const foutmelding =
        err instanceof Error ? err.message : "Fout bij starten van betaling";
      toast.error(foutmelding);
      setAanbetaalBezig(false);
    }
  };

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
                Uw aanvraag is ontvangen — u ontvangt een bevestiging per email op{" "}
                <span className="font-semibold text-foreground">{email}</span>.
                Wij beoordelen uw aanvraag binnen{" "}
                <span className="font-semibold text-foreground">2 werkdagen</span>.
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
            <Leaf className="h-8 w-8 text-green-200" />
          </div>

          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
              Uw aanvraag is ontvangen en geregistreerd
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
              Wij nemen contact met u op voor een afspraak ter plaatse
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
              Na inspectie ontvangt u een definitieve offerte
            </li>
          </ul>

          {/* Aanbetaling sectie */}
          <div className="rounded-lg border-2 border-dashed border-green-200 bg-green-50/50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-green-700" />
              <p className="text-sm font-semibold text-green-900">
                Aanbetaling (optioneel)
              </p>
            </div>
            <p className="text-xs text-green-800 leading-relaxed">
              Betaal €{AANBETALING_BEDRAG} aanbetaling om uw aanvraag prioriteit te
              geven. Uw aanvraag wordt dan direct behandeld.
            </p>
            <Button
              onClick={startAanbetaling}
              disabled={aanbetaalBezig}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium"
              size="sm"
            >
              {aanbetaalBezig ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Betaling starten...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Betaal €{AANBETALING_BEDRAG} aanbetaling om uw aanvraag te bevestigen
                </>
              )}
            </Button>
            <button
              type="button"
              onClick={onSluiten}
              className="w-full text-xs text-muted-foreground hover:text-gray-700 underline underline-offset-2 transition-colors py-1"
            >
              Of ga verder zonder aanbetaling
            </button>
          </div>
        </div>

        <Button
          onClick={onSluiten}
          variant="outline"
          className="w-full"
        >
          Sluiten
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

const LEEG_SPECS: GazonSpecs = {
  oppervlakte: "",
  typeGras: "",
  ondergrond: "",
  drainage: false,
  opsluitbanden: false,
  opsluitbandenMeters: "",
  gewensteStartdatum: undefined,
};

export default function GazonConfiguratorPage() {
  const [huidigStap, setHuidigStap] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    klant: LEEG_KLANT,
    specs: LEEG_SPECS,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [akkoordVoorwaarden, setAkkoordVoorwaarden] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [referentieNummer, setReferentieNummer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createAanvraag = useMutation(api.configuratorAanvragen.create);

  const updateKlant = useCallback(
    (field: keyof KlantGegevens, value: string) => {
      setFormData((prev) => ({
        ...prev,
        klant: { ...prev.klant, [field]: value },
      }));
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
    <K extends keyof GazonSpecs>(field: K, value: GazonSpecs[K]) => {
      setFormData((prev) => ({
        ...prev,
        specs: { ...prev.specs, [field]: value },
      }));
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

  const updateStartdatum = useCallback((datum: Date | undefined) => {
    setFormData((prev) => ({
      ...prev,
      specs: { ...prev.specs, gewensteStartdatum: datum },
    }));
  }, []);

  const naarVolgendeStap = () => {
    let stapErrors: Record<string, string> = {};

    if (huidigStap === 1) {
      stapErrors = validateStap1(formData.klant);
      const poort = parseFloat(formData.klant.poortbreedte);
      if (!isNaN(poort) && poort < 60) {
        stapErrors.poortbreedte =
          "Poortbreedte te smal — wij kunnen hier helaas niet werken";
      }
    } else if (huidigStap === 2) {
      stapErrors = validateStap2(formData.specs);
    }

    if (Object.keys(stapErrors).length > 0) {
      setErrors(stapErrors);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setErrors({});
    setHuidigStap((s) => Math.min(s + 1, TOTAAL_STAPPEN));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const naarVorigeStap = () => {
    setErrors({});
    setHuidigStap((s) => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleVersturen = async () => {
    if (isSubmitting) return;

    const prijs = berekenPrijs(formData);
    if (!prijs) {
      toast.error("Er ging iets mis bij het versturen. Probeer het opnieuw.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Stel specificaties samen inclusief startdatum
      const specificaties = {
        oppervlakte: parseFloat(formData.specs.oppervlakte),
        typeGras: formData.specs.typeGras,
        ondergrond: formData.specs.ondergrond,
        drainage: formData.specs.drainage,
        opsluitbanden: formData.specs.opsluitbanden,
        opsluitbandenMeters: formData.specs.opsluitbanden
          ? parseFloat(formData.specs.opsluitbandenMeters) || 0
          : 0,
        poortbreedte: parseFloat(formData.klant.poortbreedte),
        handmatigToeslag: prijs.handmatigToeslag,
        gewensteStartdatum: formData.specs.gewensteStartdatum
          ? formData.specs.gewensteStartdatum.toISOString().split("T")[0]
          : null,
        prijsDetails: {
          subtotaalExBtw: prijs.subtotaal,
          btw: prijs.btw,
          totaalInclBtw: prijs.totaal,
        },
      };

      // Stuur aanvraag naar Convex — retourneert { id, referentie }
      const resultaat = await createAanvraag({
        type: "gazon",
        klantNaam: formData.klant.naam,
        klantEmail: formData.klant.email,
        klantTelefoon: formData.klant.telefoon,
        klantAdres: formData.klant.adres,
        klantPostcode: formData.klant.postcode,
        klantPlaats: formData.klant.plaats,
        specificaties,
        indicatiePrijs: prijs.totaal,
      });

      // Gebruik het door Convex gegenereerde CFG-referentienummer
      const cfgRef = resultaat.referentie;
      setReferentieNummer(cfgRef);

      // Stuur bevestigingsmail
      const typeGrasLabel = formData.specs.typeGras
        ? TYPE_GRAS_CONFIG[formData.specs.typeGras as TypeGras].label
        : "";
      const ondergrondLabel = formData.specs.ondergrond
        ? ONDERGROND_CONFIG[formData.specs.ondergrond as Ondergrond].label
        : "";

      const aanvraagDetails = [
        `Type gazon: ${typeGrasLabel}`,
        `Oppervlakte: ${formData.specs.oppervlakte} m²`,
        `Ondergrond: ${ondergrondLabel}`,
        formData.specs.drainage ? "Drainage: ja" : null,
        formData.specs.opsluitbanden
          ? `Opsluitbanden: ${formData.specs.opsluitbandenMeters} m`
          : null,
        formData.specs.gewensteStartdatum
          ? `Gewenste startdatum: ${formatDatumVolledig(formData.specs.gewensteStartdatum)}`
          : null,
        `Indicatieprijs: ${formatEuro(prijs.totaal)} incl. BTW`,
        `Referentienummer: ${cfgRef}`,
      ]
        .filter(Boolean)
        .join("\n");

      try {
        await fetch("/api/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "bevestiging",
            to: formData.klant.email,
            klantNaam: formData.klant.naam,
            aanvraagType: "configurator",
            aanvraagDetails,
            datumOpties: [],
            bedrijfsnaam: "Top Tuinen",
            bedrijfsEmail: "info@toptuinen.nl",
            bedrijfsTelefoon: "085-0601024",
          }),
        });
      } catch {
        // Email fout is niet fataal — aanvraag is al opgeslagen
        console.warn("[gazon] Bevestigingsmail mislukt, aanvraag is wel opgeslagen");
      }

      // Toon success dialog
      setShowSuccessDialog(true);
    } catch (err) {
      const foutmelding =
        err instanceof Error ? err.message : "Onbekende fout";
      console.error("[gazon] Fout bij versturen aanvraag:", foutmelding);
      toast.error("Er ging iets mis bij het versturen. Probeer het opnieuw.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessSluiten = () => {
    setShowSuccessDialog(false);
    setFormData({ klant: LEEG_KLANT, specs: LEEG_SPECS });
    setHuidigStap(1);
    setAkkoordVoorwaarden(false);
    setErrors({});
    setReferentieNummer("");
  };

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4">
      {/* Paginatitel */}
      <div className="mb-8 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Gazon aanleggen
        </h2>
        <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
          Configureer uw gazonproject en ontvang direct een indicatieprijs.
          Vrijblijvend en eenvoudig in 4 stappen.
        </p>
      </div>

      {/* Stap indicator */}
      <StapIndicator huidigStap={huidigStap} />

      {/* Formulier kaart */}
      <Card className="shadow-sm border-gray-200">
        <CardContent className="pt-6 pb-6">
          {huidigStap === 1 && (
            <Stap1Klantgegevens
              data={formData.klant}
              errors={errors}
              onChange={updateKlant}
            />
          )}
          {huidigStap === 2 && (
            <Stap2GazonSpecs
              data={formData.specs}
              errors={errors}
              onChange={updateSpecs}
            />
          )}
          {huidigStap === 3 && <Stap3FotoUpload />}
          {huidigStap === 4 && (
            <Stap4Prijsoverzicht
              data={formData}
              akkoordVoorwaarden={akkoordVoorwaarden}
              onAkkoordChange={setAkkoordVoorwaarden}
              onVersturen={handleVersturen}
              isSubmitting={isSubmitting}
              onStartdatumChange={updateStartdatum}
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

        {huidigStap < TOTAAL_STAPPEN && (
          <Button
            onClick={naarVolgendeStap}
            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            Volgende stap
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}

        {huidigStap === TOTAAL_STAPPEN && (
          <div /> /* Ruimte — verstuurknop zit in Stap4 */
        )}
      </div>

      {/* Success dialog */}
      <SuccessDialog
        open={showSuccessDialog}
        email={formData.klant.email}
        referentie={referentieNummer}
        klantNaam={formData.klant.naam}
        klantEmail={formData.klant.email}
        onSluiten={handleSuccessSluiten}
      />
    </div>
  );
}
