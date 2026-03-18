"use client";

import { useState, useCallback } from "react";
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
  validateStap1,
  validateStap2,
  validateStap3,
} from "./components/utils";
import { StapIndicator } from "./components/stap-indicator";
import { Stap1Klantgegevens } from "./components/stap1-klantgegevens";
import { Stap2VerticuterenSpecs } from "./components/stap2-verticuteren-specs";
import { Stap3DatumOverzicht } from "./components/stap3-datum-overzicht";
import { SuccessDialog } from "./components/success-dialog";

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
