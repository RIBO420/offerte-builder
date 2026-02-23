"use client";

import * as React from "react";
import {
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CreditCardIcon,
  InfoIcon,
  Loader2Icon,
  PackageIcon,
  TruckIcon,
} from "lucide-react";
import { addDays, format, isWeekend } from "date-fns";
import { nl } from "date-fns/locale";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BeschikbaarheidsKalender } from "@/components/beschikbaarheids-kalender";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIJZEN = {
  grove_schors: 32,
  fijne_schors: 38,
  cacaodoppen: 45,
  houtsnippers: 25,
} as const;

type BoomschorsType = keyof typeof PRIJZEN;

const DIKTE_FACTOR = {
  "5cm": 0.05,
  "7cm": 0.07,
  "10cm": 0.1,
} as const;

type LaagDikte = keyof typeof DIKTE_FACTOR;

const PRODUCT_INFO: Record<
  BoomschorsType,
  { label: string; subtitel: string; beschrijving: string; badge?: string }
> = {
  grove_schors: {
    label: "Grove boomschors",
    subtitel: "20-40mm",
    beschrijving: "Ideaal voor borders, onderhoudsvriendelijk",
    badge: "Populair",
  },
  fijne_schors: {
    label: "Fijne boomschors",
    subtitel: "10-20mm",
    beschrijving: "Decoratief, nette uitstraling",
  },
  cacaodoppen: {
    label: "Cacaodoppen",
    subtitel: "Premium",
    beschrijving: "Premium, chocoladegeur",
    badge: "Premium",
  },
  houtsnippers: {
    label: "Houtsnippers",
    subtitel: "Natuurlijk",
    beschrijving: "Natuurlijk, budget-vriendelijk",
    badge: "Voordelig",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Round up to nearest 0.5 m³ */
function roundUpHalf(value: number): number {
  return Math.ceil(value * 2) / 2;
}

function berekenM3(oppervlakte: number, dikte: LaagDikte): number {
  if (oppervlakte <= 0) return 0;
  const raw = oppervlakte * DIKTE_FACTOR[dikte];
  return roundUpHalf(raw);
}

function formatEuro(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Get +3 werkdagen (skip weekends) from a given date */
function addWerkdagen(startDate: Date, days: number): Date {
  let date = new Date(startDate);
  let added = 0;
  while (added < days) {
    date = addDays(date, 1);
    if (!isWeekend(date)) {
      added++;
    }
  }
  return date;
}

const MIN_LEVERDATUM = addWerkdagen(new Date(), 3);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KlantGegevens {
  naam: string;
  email: string;
  telefoon: string;
  adres: string;
  postcode: string;
  plaats: string;
}

interface BoomschorsSpecificaties {
  soort: BoomschorsType;
  oppervlakte: string;
  laagDikte: LaagDikte;
  bezorging: "ophalen" | "bezorgen";
  bezorgPostcode: string;
}

interface Samenvatting {
  leveringsDatum: Date | undefined;
  opmerkingen: string;
  akkoordVoorwaarden: boolean;
}

interface FormErrors {
  [key: string]: string;
}

// ---------------------------------------------------------------------------
// Bezorgkosten helper
// ---------------------------------------------------------------------------

type BezorgInfo =
  | { type: "prijs"; prijs: number; label: string }
  | { type: "contact"; label: string };

function getBezorgInfo(postcode: string): BezorgInfo | null {
  const cleaned = postcode.replace(/\s/g, "").toUpperCase();
  if (cleaned.length < 4) return null;

  const numericPart = parseInt(cleaned.slice(0, 4), 10);
  if (isNaN(numericPart)) return null;

  const diff = Math.abs(numericPart - 2000);

  if (diff < 300) {
    return { type: "prijs", prijs: 45, label: "< 15 km" };
  } else if (diff < 800) {
    return { type: "prijs", prijs: 75, label: "15-30 km" };
  } else if (diff < 1500) {
    return { type: "prijs", prijs: 125, label: "30-50 km" };
  } else {
    return { type: "contact", label: "> 50 km" };
  }
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

interface StepIndicatorProps {
  huidigeStap: number;
  totaalStappen: number;
  stapLabels: string[];
}

function StapIndicator({
  huidigeStap,
  totaalStappen,
  stapLabels,
}: StepIndicatorProps) {
  const voortgang = ((huidigeStap - 1) / (totaalStappen - 1)) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">
          Stap {huidigeStap} van {totaalStappen}
        </span>
        <span className="text-muted-foreground">{stapLabels[huidigeStap - 1]}</span>
      </div>
      <Progress value={voortgang} className="h-2" />
      <div className="hidden sm:flex justify-between">
        {stapLabels.map((label, index) => {
          const stapNummer = index + 1;
          const isVoltooid = stapNummer < huidigeStap;
          const isActief = stapNummer === huidigeStap;
          return (
            <div key={label} className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex items-center justify-center size-7 rounded-full text-xs font-semibold border-2 transition-colors",
                  isVoltooid &&
                    "bg-primary border-primary text-primary-foreground",
                  isActief && "bg-background border-primary text-primary",
                  !isVoltooid &&
                    !isActief &&
                    "bg-background border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {isVoltooid ? (
                  <CheckCircle2Icon className="size-4" />
                ) : (
                  stapNummer
                )}
              </div>
              <span
                className={cn(
                  "text-xs",
                  isActief ? "text-foreground font-medium" : "text-muted-foreground"
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

// ---------------------------------------------------------------------------
// Stap 1: Klantgegevens
// ---------------------------------------------------------------------------

interface Stap1Props {
  gegevens: KlantGegevens;
  onChange: (gegevens: KlantGegevens) => void;
  errors: FormErrors;
}

function Stap1Klantgegevens({ gegevens, onChange, errors }: Stap1Props) {
  function handleChange(field: keyof KlantGegevens, value: string) {
    onChange({ ...gegevens, [field]: value });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Uw gegevens</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Vul uw contactgegevens en afleveradres in.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="naam">
            Naam <span className="text-destructive">*</span>
          </Label>
          <Input
            id="naam"
            placeholder="Voor- en achternaam"
            value={gegevens.naam}
            onChange={(e) => handleChange("naam", e.target.value)}
            aria-invalid={!!errors.naam}
          />
          {errors.naam && (
            <p className="text-destructive text-xs">{errors.naam}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">
            E-mailadres <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="uw@email.nl"
            value={gegevens.email}
            onChange={(e) => handleChange("email", e.target.value)}
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <p className="text-destructive text-xs">{errors.email}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="telefoon">
            Telefoonnummer <span className="text-destructive">*</span>
          </Label>
          <Input
            id="telefoon"
            type="tel"
            placeholder="06-12345678"
            value={gegevens.telefoon}
            onChange={(e) => handleChange("telefoon", e.target.value)}
            aria-invalid={!!errors.telefoon}
          />
          {errors.telefoon && (
            <p className="text-destructive text-xs">{errors.telefoon}</p>
          )}
        </div>

        <div className="sm:col-span-2">
          <Separator className="my-2" />
          <p className="text-sm font-medium text-foreground mt-3 mb-4">
            Afleveradres
          </p>
        </div>

        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="adres">
            Straat en huisnummer <span className="text-destructive">*</span>
          </Label>
          <Input
            id="adres"
            placeholder="Voorbeeldstraat 12"
            value={gegevens.adres}
            onChange={(e) => handleChange("adres", e.target.value)}
            aria-invalid={!!errors.adres}
          />
          {errors.adres && (
            <p className="text-destructive text-xs">{errors.adres}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="postcode">
            Postcode <span className="text-destructive">*</span>
          </Label>
          <Input
            id="postcode"
            placeholder="1234 AB"
            value={gegevens.postcode}
            onChange={(e) => handleChange("postcode", e.target.value)}
            aria-invalid={!!errors.postcode}
          />
          {errors.postcode && (
            <p className="text-destructive text-xs">{errors.postcode}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="plaats">
            Plaats <span className="text-destructive">*</span>
          </Label>
          <Input
            id="plaats"
            placeholder="Amsterdam"
            value={gegevens.plaats}
            onChange={(e) => handleChange("plaats", e.target.value)}
            aria-invalid={!!errors.plaats}
          />
          {errors.plaats && (
            <p className="text-destructive text-xs">{errors.plaats}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stap 2: Boomschors specificaties
// ---------------------------------------------------------------------------

interface Stap2Props {
  specificaties: BoomschorsSpecificaties;
  onChange: (specificaties: BoomschorsSpecificaties) => void;
  errors: FormErrors;
}

function Stap2Specificaties({ specificaties, onChange, errors }: Stap2Props) {
  function handleChange<K extends keyof BoomschorsSpecificaties>(
    field: K,
    value: BoomschorsSpecificaties[K]
  ) {
    onChange({ ...specificaties, [field]: value });
  }

  const m3Nodig = berekenM3(
    parseFloat(specificaties.oppervlakte) || 0,
    specificaties.laagDikte
  );

  const bezorgInfo =
    specificaties.bezorging === "bezorgen"
      ? getBezorgInfo(specificaties.bezorgPostcode)
      : null;

  const dikte_opties: LaagDikte[] = ["5cm", "7cm", "10cm"];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Boomschors specificaties</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Kies uw gewenste product en hoeveelheid.
        </p>
      </div>

      {/* Product keuze */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          Soort boomschors <span className="text-destructive">*</span>
        </Label>
        <RadioGroup
          value={specificaties.soort}
          onValueChange={(value) =>
            handleChange("soort", value as BoomschorsType)
          }
          className="grid gap-3 sm:grid-cols-2"
        >
          {(Object.keys(PRIJZEN) as BoomschorsType[]).map((key) => {
            const info = PRODUCT_INFO[key];
            const prijs = PRIJZEN[key];
            const isGeselecteerd = specificaties.soort === key;

            return (
              <label
                key={key}
                htmlFor={`soort-${key}`}
                className={cn(
                  "relative flex cursor-pointer rounded-xl border-2 p-4 gap-3 transition-all",
                  isGeselecteerd
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
                )}
              >
                <RadioGroupItem
                  id={`soort-${key}`}
                  value={key}
                  className="mt-0.5 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-semibold text-sm">{info.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {info.subtitel}
                      </p>
                    </div>
                    {info.badge && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {info.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {info.beschrijving}
                  </p>
                  <p className="text-sm font-bold text-primary mt-2">
                    {formatEuro(prijs)}/m³
                  </p>
                </div>
              </label>
            );
          })}
        </RadioGroup>
        {errors.soort && (
          <p className="text-destructive text-xs">{errors.soort}</p>
        )}
      </div>

      {/* Hoeveelheid */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Hoeveelheid</Label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="oppervlakte">
              Oppervlakte (m²) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="oppervlakte"
              type="number"
              min="1"
              step="0.5"
              placeholder="bijv. 20"
              value={specificaties.oppervlakte}
              onChange={(e) => handleChange("oppervlakte", e.target.value)}
              aria-invalid={!!errors.oppervlakte}
            />
            {errors.oppervlakte && (
              <p className="text-destructive text-xs">{errors.oppervlakte}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="block">
              Gewenste laagdikte <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              {dikte_opties.map((dikte) => (
                <button
                  key={dikte}
                  type="button"
                  onClick={() => handleChange("laagDikte", dikte)}
                  className={cn(
                    "flex-1 rounded-lg border-2 py-2 text-sm font-medium transition-all",
                    specificaties.laagDikte === dikte
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  {dikte}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              7cm is de standaard aanbevolen dikte voor optimale
              onkruidonderdrukking.
            </p>
          </div>
        </div>

        {/* M3 berekening */}
        {(parseFloat(specificaties.oppervlakte) || 0) > 0 && (
          <div
            className={cn(
              "rounded-xl border p-4 flex items-start gap-3",
              m3Nodig < 1
                ? "border-destructive/50 bg-destructive/5"
                : "border-primary/30 bg-primary/5"
            )}
          >
            <InfoIcon
              className={cn(
                "size-4 shrink-0 mt-0.5",
                m3Nodig < 1 ? "text-destructive" : "text-primary"
              )}
            />
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                U heeft{" "}
                <span
                  className={cn(
                    "font-bold",
                    m3Nodig < 1 ? "text-destructive" : "text-primary"
                  )}
                >
                  {m3Nodig} m³
                </span>{" "}
                boomschors nodig
              </p>
              <p className="text-xs text-muted-foreground">
                {specificaties.oppervlakte} m² × {specificaties.laagDikte}{" "}
                laagdikte, afgerond naar boven op 0,5 m³
              </p>
              {m3Nodig < 1 && (
                <p className="text-xs text-destructive font-medium">
                  Minimale bestelling is 1 m³. Voer een grotere oppervlakte in.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bezorging */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Bezorging</Label>

        <RadioGroup
          value={specificaties.bezorging}
          onValueChange={(value) =>
            handleChange("bezorging", value as "ophalen" | "bezorgen")
          }
          className="grid gap-3 sm:grid-cols-2"
        >
          <label
            htmlFor="bezorging-ophalen"
            className={cn(
              "relative flex cursor-pointer rounded-xl border-2 p-4 gap-3 transition-all",
              specificaties.bezorging === "ophalen"
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
            )}
          >
            <RadioGroupItem
              id="bezorging-ophalen"
              value="ophalen"
              className="mt-0.5 shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <PackageIcon className="size-4 text-muted-foreground" />
                <p className="font-semibold text-sm">Ophalen</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                U haalt de boomschors zelf op bij ons depot.
              </p>
              <p className="text-sm font-bold text-green-600 mt-2">Gratis</p>
            </div>
          </label>

          <label
            htmlFor="bezorging-bezorgen"
            className={cn(
              "relative flex cursor-pointer rounded-xl border-2 p-4 gap-3 transition-all",
              specificaties.bezorging === "bezorgen"
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
            )}
          >
            <RadioGroupItem
              id="bezorging-bezorgen"
              value="bezorgen"
              className="mt-0.5 shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <TruckIcon className="size-4 text-muted-foreground" />
                <p className="font-semibold text-sm">Bezorgen</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Wij leveren bij u thuis met een containerwagen.
              </p>
              <p className="text-sm font-bold text-primary mt-2">
                Prijs op basis van afstand
              </p>
            </div>
          </label>
        </RadioGroup>

        {specificaties.bezorging === "bezorgen" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bezorgPostcode">
                Postcode bezorgadres <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bezorgPostcode"
                placeholder="1234 AB"
                value={specificaties.bezorgPostcode}
                onChange={(e) =>
                  handleChange("bezorgPostcode", e.target.value)
                }
                aria-invalid={!!errors.bezorgPostcode}
                className="max-w-[200px]"
              />
              {errors.bezorgPostcode && (
                <p className="text-destructive text-xs">
                  {errors.bezorgPostcode}
                </p>
              )}
            </div>

            {bezorgInfo && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/50 p-4">
                <div className="flex items-start gap-3">
                  <TruckIcon className="size-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                      Geschatte bezorgkosten ({bezorgInfo.label})
                    </p>
                    {bezorgInfo.type === "prijs" ? (
                      <p className="text-lg font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                        {formatEuro(bezorgInfo.prijs)}
                      </p>
                    ) : (
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                        Neem contact met ons op voor een maatwerkprijs.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 text-xs text-muted-foreground rounded-lg bg-muted/50 p-3">
              <InfoIcon className="size-3.5 shrink-0 mt-0.5" />
              <span>
                Bezorging met containerwagen — zorg voor voldoende ruimte bij
                uw oprit of inrit (minimaal 3,5 meter breed en 4 meter hoog).
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stap 3: Samenvatting
// ---------------------------------------------------------------------------

interface PrijsBerekening {
  soort: BoomschorsType;
  laagDikte: LaagDikte;
  oppervlakte: number;
  m3Nodig: number;
  prijs_per_m3: number;
  schors_totaal: number;
  bezorgkosten: number;
  subtotaal: number;
  btw: number;
  totaal: number;
  bezorgLabel: string;
  heeftBezorgMaatwerk: boolean;
}

function berekenPrijs(specificaties: BoomschorsSpecificaties): PrijsBerekening {
  const oppervlakte = parseFloat(specificaties.oppervlakte) || 0;
  const m3Nodig = berekenM3(oppervlakte, specificaties.laagDikte);
  const prijs_per_m3 = PRIJZEN[specificaties.soort];
  const schors_totaal = m3Nodig * prijs_per_m3;

  let bezorgkosten = 0;
  let bezorgLabel = "Ophalen (gratis)";
  let heeftBezorgMaatwerk = false;

  if (specificaties.bezorging === "bezorgen") {
    const info = getBezorgInfo(specificaties.bezorgPostcode);
    if (info) {
      if (info.type === "prijs") {
        bezorgkosten = info.prijs;
        bezorgLabel = `Bezorging (${info.label})`;
      } else {
        bezorgLabel = `Bezorging (${info.label}) — maatwerk`;
        heeftBezorgMaatwerk = true;
      }
    } else {
      bezorgLabel = "Bezorging — postcode invullen";
    }
  }

  const subtotaal = schors_totaal + bezorgkosten;
  const btw = subtotaal * 0.21;
  const totaal = subtotaal + btw;

  return {
    soort: specificaties.soort,
    laagDikte: specificaties.laagDikte,
    oppervlakte,
    m3Nodig,
    prijs_per_m3,
    schors_totaal,
    bezorgkosten,
    subtotaal,
    btw,
    totaal,
    bezorgLabel,
    heeftBezorgMaatwerk,
  };
}

interface Stap3Props {
  klantGegevens: KlantGegevens;
  specificaties: BoomschorsSpecificaties;
  samenvatting: Samenvatting;
  onSamenvattingChange: (samenvatting: Samenvatting) => void;
  errors: FormErrors;
}

function Stap3Samenvatting({
  klantGegevens,
  specificaties,
  samenvatting,
  onSamenvattingChange,
  errors,
}: Stap3Props) {
  const berekening = berekenPrijs(specificaties);
  const productInfo = PRODUCT_INFO[specificaties.soort];

  function handleChange<K extends keyof Samenvatting>(
    field: K,
    value: Samenvatting[K]
  ) {
    onSamenvattingChange({ ...samenvatting, [field]: value });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Samenvatting &amp; bevestiging</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Controleer uw bestelling en kies een leveringsdatum.
        </p>
      </div>

      {/* Klantgegevens samenvatting */}
      <Card variant="subtle">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Uw gegevens
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="space-y-1 text-sm">
            <p className="font-medium">{klantGegevens.naam}</p>
            <p className="text-muted-foreground">{klantGegevens.email}</p>
            <p className="text-muted-foreground">{klantGegevens.telefoon}</p>
            <p className="text-muted-foreground">
              {klantGegevens.adres}, {klantGegevens.postcode}{" "}
              {klantGegevens.plaats}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Prijsoverzicht */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Prijsoverzicht
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          {/* Boomschors regel */}
          <div className="flex items-start justify-between gap-4 text-sm">
            <div>
              <p className="font-medium">
                {productInfo.label} ({specificaties.laagDikte})
              </p>
              <p className="text-muted-foreground text-xs">
                {berekening.oppervlakte} m² &rarr; {berekening.m3Nodig} m³ &times;{" "}
                {formatEuro(berekening.prijs_per_m3)}/m³
              </p>
            </div>
            <p className="font-semibold whitespace-nowrap">
              {formatEuro(berekening.schors_totaal)}
            </p>
          </div>

          {/* Bezorgkosten */}
          <div className="flex items-start justify-between gap-4 text-sm">
            <p className="text-muted-foreground">{berekening.bezorgLabel}</p>
            <p className="font-semibold whitespace-nowrap">
              {berekening.heeftBezorgMaatwerk
                ? "Nader te bepalen"
                : specificaties.bezorging === "ophalen"
                  ? "Gratis"
                  : formatEuro(berekening.bezorgkosten)}
            </p>
          </div>

          <Separator />

          {/* Subtotaal */}
          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">Subtotaal (excl. BTW)</p>
            <p className="font-medium">
              {berekening.heeftBezorgMaatwerk
                ? "—"
                : formatEuro(berekening.subtotaal)}
            </p>
          </div>

          {/* BTW */}
          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">BTW (21%)</p>
            <p className="font-medium">
              {berekening.heeftBezorgMaatwerk
                ? "—"
                : formatEuro(berekening.btw)}
            </p>
          </div>

          <Separator />

          {/* Totaal */}
          <div className="flex items-center justify-between">
            <p className="font-bold text-base">Totaal (incl. BTW)</p>
            <p className="font-bold text-lg text-primary">
              {berekening.heeftBezorgMaatwerk
                ? "Op aanvraag"
                : formatEuro(berekening.totaal)}
            </p>
          </div>

          {berekening.heeftBezorgMaatwerk && (
            <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2 mt-1">
              De bezorgkosten voor uw locatie worden nader bepaald. Wij nemen
              contact met u op voor een definitieve prijs.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Leveringsdatum via BeschikbaarheidsKalender */}
      <div className="space-y-2">
        <Label className="text-base font-medium">
          Gewenste leveringsdatum <span className="text-destructive">*</span>
        </Label>
        <p className="text-xs text-muted-foreground">
          Vroegst mogelijke levering:{" "}
          {format(MIN_LEVERDATUM, "EEEE d MMMM yyyy", { locale: nl })}
        </p>
        <BeschikbaarheidsKalender
          mode="selectie"
          minDatum={MIN_LEVERDATUM}
          selectedDatum={samenvatting.leveringsDatum}
          onDatumSelect={(datum) => handleChange("leveringsDatum", datum)}
          geblokkeerdeDagen={[0, 6]}
        />
        {errors.leveringsDatum && (
          <p className="text-destructive text-xs">{errors.leveringsDatum}</p>
        )}
      </div>

      {/* Opmerkingen */}
      <div className="space-y-1.5">
        <Label htmlFor="opmerkingen">Opmerkingen (optioneel)</Label>
        <Textarea
          id="opmerkingen"
          placeholder="Eventuele bijzonderheden voor de levering, toegangsinstructies, etc."
          value={samenvatting.opmerkingen}
          onChange={(e) => handleChange("opmerkingen", e.target.value)}
          rows={3}
        />
      </div>

      {/* Algemene voorwaarden */}
      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <Checkbox
            id="akkoord"
            checked={samenvatting.akkoordVoorwaarden}
            onCheckedChange={(checked) =>
              handleChange("akkoordVoorwaarden", checked === true)
            }
            aria-invalid={!!errors.akkoordVoorwaarden}
            className="mt-0.5"
          />
          <Label
            htmlFor="akkoord"
            className="text-sm font-normal cursor-pointer leading-relaxed"
          >
            Ik ga akkoord met de{" "}
            <a
              href="/algemene-voorwaarden"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:no-underline"
            >
              algemene voorwaarden
            </a>{" "}
            van Top Tuinen.{" "}
            <span className="text-destructive">*</span>
          </Label>
        </div>
        {errors.akkoordVoorwaarden && (
          <p className="text-destructive text-xs ml-7">
            {errors.akkoordVoorwaarden}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Validatie helpers
// ---------------------------------------------------------------------------

function validateStap1(gegevens: KlantGegevens): FormErrors {
  const errors: FormErrors = {};
  if (!gegevens.naam.trim()) errors.naam = "Naam is verplicht.";
  if (!gegevens.email.trim()) {
    errors.email = "E-mailadres is verplicht.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gegevens.email)) {
    errors.email = "Voer een geldig e-mailadres in.";
  }
  if (!gegevens.telefoon.trim())
    errors.telefoon = "Telefoonnummer is verplicht.";
  if (!gegevens.adres.trim())
    errors.adres = "Straat en huisnummer zijn verplicht.";
  if (!gegevens.postcode.trim()) errors.postcode = "Postcode is verplicht.";
  if (!gegevens.plaats.trim()) errors.plaats = "Plaats is verplicht.";
  return errors;
}

function validateStap2(specificaties: BoomschorsSpecificaties): FormErrors {
  const errors: FormErrors = {};
  const oppervlakte = parseFloat(specificaties.oppervlakte);
  if (!specificaties.oppervlakte || isNaN(oppervlakte) || oppervlakte <= 0) {
    errors.oppervlakte = "Voer een geldige oppervlakte in.";
  } else {
    const m3 = berekenM3(oppervlakte, specificaties.laagDikte);
    if (m3 < 1) {
      errors.oppervlakte = `De minimale bestelling is 1 m³. Verhoog de oppervlakte of kies een dikkere laag.`;
    }
  }
  if (
    specificaties.bezorging === "bezorgen" &&
    !specificaties.bezorgPostcode.trim()
  ) {
    errors.bezorgPostcode = "Vul een postcode in voor bezorging.";
  }
  return errors;
}

function validateStap3(samenvatting: Samenvatting): FormErrors {
  const errors: FormErrors = {};
  if (!samenvatting.leveringsDatum) {
    errors.leveringsDatum = "Selecteer een gewenste leveringsdatum.";
  }
  if (!samenvatting.akkoordVoorwaarden) {
    errors.akkoordVoorwaarden =
      "U dient akkoord te gaan met de algemene voorwaarden om verder te gaan.";
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Success Dialog (met Mollie aanbetaling)
// ---------------------------------------------------------------------------

interface SuccessDialogProps {
  open: boolean;
  referentie: string;
  klantNaam: string;
  klantEmail: string;
}

function SuccessDialog({
  open,
  referentie,
  klantNaam,
  klantEmail,
}: SuccessDialogProps) {
  const [betalingBezig, setBetalingBezig] = React.useState(false);

  async function startAanbetaling() {
    setBetalingBezig(true);
    try {
      const response = await fetch("/api/mollie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: { currency: "EUR", value: "50.00" },
          description: `Aanbetaling boomschors ${referentie}`,
          redirectUrl: `${window.location.origin}/configurator/boomschors?betaald=true`,
          metadata: {
            referentie,
            klantNaam,
            klantEmail,
            type: "aanbetaling",
          },
        }),
      });

      const data = (await response.json()) as {
        checkoutUrl?: string;
        error?: string;
      };

      if (!response.ok || !data.checkoutUrl) {
        toast.error(
          data.error ?? "Betaling kon niet worden gestart. Probeer het later opnieuw."
        );
        return;
      }

      window.location.href = data.checkoutUrl;
    } catch {
      toast.error(
        "Er is een fout opgetreden bij het starten van de betaling. Uw aanvraag is wel opgeslagen."
      );
    } finally {
      setBetalingBezig(false);
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="sm:max-w-md text-center">
        <DialogHeader>
          <div className="flex justify-center mb-2">
            <div className="size-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2Icon className="size-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            Bedankt voor uw bestelling!
          </DialogTitle>
          <DialogDescription className="text-center space-y-3">
            <span className="block text-sm">
              Uw bestelling is succesvol ontvangen. Een bevestiging is
              verstuurd naar uw e-mailadres.
            </span>
            <span className="block">
              <span className="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm font-mono font-medium">
                Referentienummer: {referentie}
              </span>
            </span>
            <span className="block text-sm text-muted-foreground">
              Wij nemen binnen 1 werkdag contact met u op om de levering te
              bevestigen.
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Aanbetaling sectie */}
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3 text-left">
          <div className="flex items-start gap-3">
            <CreditCardIcon className="size-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Optionele aanbetaling</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Zet uw levering vast met een aanbetaling van €50. Dit is niet
                verplicht.
              </p>
            </div>
          </div>
          <Button
            onClick={startAanbetaling}
            disabled={betalingBezig}
            className="w-full gap-2"
          >
            {betalingBezig ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Betaling starten...
              </>
            ) : (
              <>
                <CreditCardIcon className="size-4" />
                Betaal €50 aanbetaling
              </>
            )}
          </Button>
        </div>

        <DialogFooter className="sm:justify-center mt-2">
          <Button
            variant="ghost"
            onClick={() => (window.location.href = "/")}
            className="w-full sm:w-auto text-muted-foreground"
          >
            Ga verder zonder aanbetaling
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

const STAP_LABELS = ["Uw gegevens", "Specificaties", "Bevestiging"];

export default function BoomschorsConfiguratorPage() {
  const createAanvraag = useMutation(api.configuratorAanvragen.create);

  const [huidigeStap, setHuidigeStap] = React.useState(1);
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [isVerstuurd, setIsVerstuurd] = React.useState(false);
  const [isVersturen, setIsVersturen] = React.useState(false);
  const [referentie, setReferentie] = React.useState("");

  const [klantGegevens, setKlantGegevens] = React.useState<KlantGegevens>({
    naam: "",
    email: "",
    telefoon: "",
    adres: "",
    postcode: "",
    plaats: "",
  });

  const [specificaties, setSpecificaties] =
    React.useState<BoomschorsSpecificaties>({
      soort: "grove_schors",
      oppervlakte: "",
      laagDikte: "7cm",
      bezorging: "bezorgen",
      bezorgPostcode: "",
    });

  const [samenvatting, setSamenvatting] = React.useState<Samenvatting>({
    leveringsDatum: undefined,
    opmerkingen: "",
    akkoordVoorwaarden: false,
  });

  function volgendeStap() {
    let newErrors: FormErrors = {};
    if (huidigeStap === 1) newErrors = validateStap1(klantGegevens);
    if (huidigeStap === 2) newErrors = validateStap2(specificaties);

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setHuidigeStap((prev) => Math.min(prev + 1, 3));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function vorigeStap() {
    setErrors({});
    setHuidigeStap((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleVersturen() {
    const newErrors = validateStap3(samenvatting);
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setIsVersturen(true);

    const berekening = berekenPrijs(specificaties);

    try {
      // 1. Sla de aanvraag op in Convex
      const result = await createAanvraag({
        type: "boomschors",
        klantNaam: klantGegevens.naam,
        klantEmail: klantGegevens.email,
        klantTelefoon: klantGegevens.telefoon,
        klantAdres: klantGegevens.adres,
        klantPostcode: klantGegevens.postcode,
        klantPlaats: klantGegevens.plaats,
        specificaties: {
          boomschorsType: specificaties.soort,
          oppervlakte: parseFloat(specificaties.oppervlakte) || 0,
          laagDikte: specificaties.laagDikte,
          m3Nodig: berekening.m3Nodig,
          bezorging: specificaties.bezorging === "bezorgen",
          bezorgPostcode: specificaties.bezorgPostcode,
          leveringsDatum: samenvatting.leveringsDatum
            ? samenvatting.leveringsDatum.toISOString()
            : null,
          opmerkingen: samenvatting.opmerkingen,
        },
        indicatiePrijs: berekening.heeftBezorgMaatwerk
          ? berekening.schors_totaal * 1.21
          : berekening.totaal,
      });

      const refNummer = result.referentie;
      setReferentie(refNummer);

      // 2. Stuur bevestigingsmail (fire & forget — fouten tonen we als toast)
      const leveringsDatumLabel = samenvatting.leveringsDatum
        ? format(samenvatting.leveringsDatum, "EEEE d MMMM yyyy", {
            locale: nl,
          })
        : "Niet opgegeven";

      fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "bevestiging",
          to: klantGegevens.email,
          klantNaam: klantGegevens.naam,
          bedrijfsnaam: "Top Tuinen",
          bedrijfsEmail: "info@toptuinen.nl",
          bedrijfsTelefoon: "020-123 4567",
          aanvraagType: "configurator",
          aanvraagDetails: [
            `Referentienummer: ${refNummer}`,
            `Product: ${PRODUCT_INFO[specificaties.soort].label} (${specificaties.laagDikte})`,
            `Hoeveelheid: ${berekening.m3Nodig} m³ (${berekening.oppervlakte} m²)`,
            `Bezorging: ${specificaties.bezorging === "bezorgen" ? `Bezorgen naar ${specificaties.bezorgPostcode}` : "Ophalen"}`,
            `Gewenste leverdatum: ${leveringsDatumLabel}`,
            berekening.heeftBezorgMaatwerk
              ? "Totaalprijs: Op aanvraag (bezorgkosten nader te bepalen)"
              : `Totaalprijs: ${formatEuro(berekening.totaal)} incl. BTW`,
          ].join("\n"),
        }),
      }).catch(() => {
        // Bevestigingsmail fout is niet kritiek — aanvraag is al opgeslagen
        toast.warning(
          "Bevestigingsmail kon niet worden verzonden, maar uw aanvraag is wel opgeslagen."
        );
      });

      // 3. Toon success dialog
      setIsVerstuurd(true);
    } catch (err) {
      const boodschap =
        err instanceof Error ? err.message : "Er is een onbekende fout opgetreden.";
      toast.error(`Fout bij plaatsen bestelling: ${boodschap}`);
    } finally {
      setIsVersturen(false);
    }
  }

  // Real-time price strip — show on stap 2 and 3
  const berekening = huidigeStap >= 2 ? berekenPrijs(specificaties) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <Badge variant="secondary" className="mb-3">
            Zelf bestellen
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Boomschors bestellen
          </h1>
          <p className="text-muted-foreground mt-2">
            Configureer uw bestelling in 3 eenvoudige stappen.
          </p>
        </div>

        {/* Stap indicator */}
        <div className="mb-8">
          <StapIndicator
            huidigeStap={huidigeStap}
            totaalStappen={3}
            stapLabels={STAP_LABELS}
          />
        </div>

        {/* Real-time prijs banner (stap 2+) */}
        {berekening &&
          !berekening.heeftBezorgMaatwerk &&
          berekening.m3Nodig >= 1 && (
            <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
              <div className="text-sm">
                <span className="text-muted-foreground">Geschatte prijs: </span>
                <span className="font-bold text-primary">
                  {formatEuro(berekening.totaal)}
                </span>
                <span className="text-muted-foreground text-xs">
                  {" "}
                  (incl. BTW)
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {berekening.m3Nodig} m³{" "}
                {PRODUCT_INFO[berekening.soort].label.toLowerCase()}
              </div>
            </div>
          )}

        {/* Formulier kaart */}
        <Card className="shadow-sm">
          <CardContent className="pt-6 pb-6">
            {huidigeStap === 1 && (
              <Stap1Klantgegevens
                gegevens={klantGegevens}
                onChange={setKlantGegevens}
                errors={errors}
              />
            )}
            {huidigeStap === 2 && (
              <Stap2Specificaties
                specificaties={specificaties}
                onChange={setSpecificaties}
                errors={errors}
              />
            )}
            {huidigeStap === 3 && (
              <Stap3Samenvatting
                klantGegevens={klantGegevens}
                specificaties={specificaties}
                samenvatting={samenvatting}
                onSamenvattingChange={setSamenvatting}
                errors={errors}
              />
            )}
          </CardContent>
        </Card>

        {/* Navigatie knoppen */}
        <div className="mt-6 flex items-center gap-3">
          {huidigeStap > 1 && (
            <Button
              variant="outline"
              onClick={vorigeStap}
              disabled={isVersturen}
              className="gap-2"
            >
              <ChevronLeftIcon className="size-4" />
              Vorige
            </Button>
          )}

          <div className="flex-1" />

          {huidigeStap < 3 ? (
            <Button onClick={volgendeStap} className="gap-2">
              Volgende
              <ChevronRightIcon className="size-4" />
            </Button>
          ) : (
            <Button
              onClick={handleVersturen}
              size="lg"
              className="gap-2"
              disabled={isVerstuurd || isVersturen}
            >
              {isVersturen ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Bestelling plaatsen...
                </>
              ) : (
                <>
                  <CheckCircle2Icon className="size-4" />
                  Bestelling plaatsen
                </>
              )}
            </Button>
          )}
        </div>

        {/* Footer tekst */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Heeft u vragen? Bel ons op{" "}
          <a href="tel:+31201234567" className="text-primary hover:underline">
            020-123 4567
          </a>{" "}
          of stuur een e-mail naar{" "}
          <a
            href="mailto:info@toptuinen.nl"
            className="text-primary hover:underline"
          >
            info@toptuinen.nl
          </a>
          .
        </p>
      </div>

      {/* Success dialog */}
      <SuccessDialog
        open={isVerstuurd}
        referentie={referentie}
        klantNaam={klantGegevens.naam}
        klantEmail={klantGegevens.email}
      />
    </div>
  );
}
