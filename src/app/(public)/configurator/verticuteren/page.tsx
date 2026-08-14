"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  ChevronLeft,
  Scissors,
  Leaf,
  XCircle,
} from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";

import type { KlantGegevens, VerticuterenSpecs } from "./components/types";
import { TOTAAL_STAPPEN, LEEG_KLANT, LEEG_SPECS } from "./components/constants";
import {
  berekenPrijs,
  formatEuro,
  validateKlant,
  validateSpecs,
  validateDatum,
} from "./components/utils";
import { StapIndicator } from "./components/stap-indicator";
import { StapKlantgegevens } from "./components/stap1-klantgegevens";
import { StapVerticuterenSpecs } from "./components/stap2-verticuteren-specs";
import { StapDatumPrijs } from "./components/stap3-datum-overzicht";
import { SuccessDialog } from "./components/success-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

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

  // WS9-stapvolgorde (keuzepunt 5): 1 specificaties → 2 prijs & datum →
  // 3 gegevens. NAW wordt pas ná de prijsindicatie gevraagd.
  const naarVolgendeStap = () => {
    let stapErrors: Record<string, string> = {};

    if (huidigStap === 1) {
      stapErrors = validateSpecs(specs);
      const poort = parseFloat(specs.poortbreedte);
      if (!isNaN(poort) && poort < 60) {
        stapErrors.poortbreedte =
          "Poortbreedte te smal — wij kunnen hier helaas niet werken";
      }
    } else if (huidigStap === 2) {
      stapErrors = validateDatum(gewensteDatum);
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
    // NAW is nu de slotstap: valideren vlak vóór het versturen.
    const klantErrors = validateKlant(klant);
    if (Object.keys(klantErrors).length > 0) {
      setErrors(klantErrors);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setErrors({});

    if (!akkoordVoorwaarden) return;

    const prijs = berekenPrijs(specs);
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
          poortBreedte: parseFloat(specs.poortbreedte),
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
      logger.error("Indienen verticuteer-aanvraag mislukt", err, {
        module: "configurator/verticuteren",
      });
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
      logger.error("Starten aanbetaling mislukt", err, {
        module: "configurator/verticuteren",
        referentieNummer,
      });
      // De succesdialoog staat open over de pagina heen, dus het `errors.submit`
      // blok eronder is hier onzichtbaar. Zonder toast zou de knop simpelweg
      // niets doen en zou de klant niet weten dat de betaling niet startte.
      toast.error(
        "De betaling kon niet worden gestart. Probeer het opnieuw of neem contact met ons op."
      );
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

  // Compacte herinnering aan de indicatieprijs op de slotstap (gegevens).
  const prijsRecap = huidigStap === 3 ? berekenPrijs(specs) : null;

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4">
      {/* Sfeerbeeld — eigen foto van Top Tuinen (hoofdsite) */}
      <div className="relative mb-6 h-36 sm:h-44 overflow-hidden rounded-xl border border-border shadow-sm">
        <Image
          src="/images/configurator/verticuteren.webp"
          alt=""
          fill
          priority
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-cover"
        />
      </div>

      {/* Paginatitel */}
      <div className="mb-8 text-center">
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-foreground">
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

      {/* Formulier kaart — WS9-volgorde: specs → prijs & datum → gegevens */}
      <Card className="shadow-sm border-border">
        <CardContent className="pt-6 pb-6">
          {huidigStap === 1 && (
            <StapVerticuterenSpecs
              data={specs}
              errors={errors}
              onChange={updateSpecs}
            />
          )}
          {huidigStap === 2 && (
            <StapDatumPrijs
              specs={specs}
              gewensteDatum={gewensteDatum}
              opmerkingen={opmerkingen}
              errors={errors}
              onDatumSelect={handleDatumSelect}
              onOpmerkingenChange={setOpmerkingen}
            />
          )}
          {huidigStap === 3 && (
            <div className="space-y-6">
              <StapKlantgegevens
                data={klant}
                errors={errors}
                onChange={updateKlant}
              />

              {/* Compacte prijs-herinnering boven de bevestiging */}
              {prijsRecap && (
                <div className="flex items-center justify-between rounded-lg bg-secondary border border-border px-4 py-3">
                  <span className="text-sm text-secondary-foreground">
                    Uw indicatieprijs
                  </span>
                  <span className="font-display text-lg font-semibold text-primary tabular-nums">
                    {formatEuro(prijsRecap.totaal)}{" "}
                    <span className="text-xs font-sans font-normal text-muted-foreground">incl. BTW</span>
                  </span>
                </div>
              )}

              {/* Algemene voorwaarden */}
              <div
                className="flex items-start gap-3 p-4 rounded-lg border-2 border-border hover:border-primary/40 transition-colors cursor-pointer"
                onClick={() => setAkkoordVoorwaarden(!akkoordVoorwaarden)}
              >
                <Checkbox
                  checked={akkoordVoorwaarden}
                  onCheckedChange={(checked) =>
                    setAkkoordVoorwaarden(checked === true)
                  }
                  className="mt-0.5 flex-shrink-0 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  onClick={(e) => e.stopPropagation()}
                />
                <p className="text-sm text-foreground select-none">
                  Ik ga akkoord met de{" "}
                  <a
                    href="#"
                    className="text-primary font-medium underline underline-offset-2 hover:text-primary/80"
                    onClick={(e) => e.stopPropagation()}
                  >
                    algemene voorwaarden
                  </a>{" "}
                  van Top Tuinen. Ik begrijp dat dit een indicatieprijs is en dat
                  de definitieve offerte na inspectie wordt opgesteld.
                </p>
              </div>

              {/* Versturen knop */}
              <Button
                onClick={handleVersturen}
                disabled={!akkoordVoorwaarden || isSubmitting}
                size="lg"
                className={cn(
                  "w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold",
                  (!akkoordVoorwaarden || isSubmitting) &&
                    "opacity-50 cursor-not-allowed"
                )}
              >
                {isSubmitting ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
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
            // --primary (loofgroen, L0.44) haalt ruim AA met witte tekst
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
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
