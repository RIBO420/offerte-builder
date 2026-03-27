"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft } from "lucide-react";
import {
  type KlantGegevens,
  type GazonSpecs,
  type FormData,
  type TypeGras,
  type Ondergrond,
  TOTAAL_STAPPEN,
  TYPE_GRAS_CONFIG,
  ONDERGROND_CONFIG,
  LEEG_KLANT,
  LEEG_SPECS,
  berekenPrijs,
  formatEuro,
  formatDatumVolledig,
  validateStap1,
  validateStap2,
  StapIndicator,
  Stap1Klantgegevens,
  Stap2GazonSpecs,
  Stap3FotoUpload,
  Stap4Prijsoverzicht,
  SuccessDialog,
} from "./components";

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

  const naarVolgendeStap = useCallback(() => {
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
  }, [huidigStap, formData.klant, formData.specs]);

  const naarVorigeStap = useCallback(() => {
    setErrors({});
    setHuidigStap((s) => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleVersturen = useCallback(async () => {
    if (isSubmitting) return;

    const prijs = berekenPrijs(formData);
    if (!prijs) {
      toast.error("Er ging iets mis bij het versturen. Probeer het opnieuw.");
      return;
    }

    setIsSubmitting(true);

    try {
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

      setShowSuccessDialog(true);
    } catch (err) {
      const foutmelding =
        err instanceof Error ? err.message : "Onbekende fout";
      console.error("[gazon] Fout bij versturen aanvraag:", foutmelding);
      toast.error("Er ging iets mis bij het versturen. Probeer het opnieuw.");
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, formData, createAanvraag]);

  const handleSuccessSluiten = useCallback(() => {
    setShowSuccessDialog(false);
    setFormData({ klant: LEEG_KLANT, specs: LEEG_SPECS });
    setHuidigStap(1);
    setAkkoordVoorwaarden(false);
    setErrors({});
    setReferentieNummer("");
  }, []);

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
