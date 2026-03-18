"use client";

import * as React from "react";
import {
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "@/lib/date-locale";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import {
  StapIndicator,
  Stap1Klantgegevens,
  Stap2Specificaties,
  Stap3Samenvatting,
  SuccessDialog,
} from "./components";
import { PRODUCT_INFO, STAP_LABELS } from "./components/constants";
import { berekenPrijs, formatEuro, validateStap1, validateStap2, validateStap3 } from "./components/utils";
import type {
  KlantGegevens,
  BoomschorsSpecificaties,
  Samenvatting,
  FormErrors,
} from "./components/types";

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

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
