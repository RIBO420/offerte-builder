"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, CheckCircle2, Leaf, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
  validateKlant,
  validateSpecs,
  StapIndicator,
  StapKlantgegevens,
  StapGazonSpecs,
  StapFotoUpload,
  StapPrijsoverzicht,
  SuccessDialog,
} from "./components";
import { logger } from "@/lib/logger";

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

  // WS9-stapvolgorde (keuzepunt 5): 1 specificaties → 2 foto's →
  // 3 prijsindicatie → 4 gegevens. NAW wordt pas ná de prijs gevraagd.
  const naarVolgendeStap = useCallback(() => {
    let stapErrors: Record<string, string> = {};

    if (huidigStap === 1) {
      stapErrors = validateSpecs(formData.specs);
      const poort = parseFloat(formData.specs.poortbreedte);
      if (!isNaN(poort) && poort < 60) {
        stapErrors.poortbreedte =
          "Poortbreedte te smal — wij kunnen hier helaas niet werken";
      }
    }

    if (Object.keys(stapErrors).length > 0) {
      setErrors(stapErrors);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setErrors({});
    setHuidigStap((s) => Math.min(s + 1, TOTAAL_STAPPEN));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [huidigStap, formData.specs]);

  const naarVorigeStap = useCallback(() => {
    setErrors({});
    setHuidigStap((s) => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleVersturen = useCallback(async () => {
    if (isSubmitting) return;

    // NAW is nu de slotstap: valideren vlak vóór het versturen.
    const klantErrors = validateKlant(formData.klant);
    if (Object.keys(klantErrors).length > 0) {
      setErrors(klantErrors);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setErrors({});

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
        poortbreedte: parseFloat(formData.specs.poortbreedte),
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
      } catch (mailFout) {
        // Email fout is niet fataal — aanvraag is al opgeslagen. De klant krijgt
        // dan wel geen bevestiging, dus we willen dit terugzien in Sentry.
        logger.warn("Bevestigingsmail mislukt, aanvraag is wel opgeslagen", {
          module: "configurator/gazon",
          fout: mailFout instanceof Error ? mailFout.message : String(mailFout),
        });
      }

      setShowSuccessDialog(true);
    } catch (err) {
      logger.error("Versturen gazon-aanvraag mislukt", err, {
        module: "configurator/gazon",
      });
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

  // Compacte herinnering aan de indicatieprijs op de slotstap (gegevens).
  const prijsRecap = huidigStap === TOTAAL_STAPPEN ? berekenPrijs(formData) : null;

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4">
      {/* Sfeerbeeld — eigen foto van Top Tuinen (hoofdsite) */}
      <div className="relative mb-6 h-36 sm:h-44 overflow-hidden rounded-xl border border-border shadow-sm">
        <Image
          src="/images/configurator/gazon.webp"
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
          Gazon aanleggen
        </h2>
        <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
          Configureer uw gazonproject en ontvang direct een indicatieprijs.
          Vrijblijvend en eenvoudig in 4 stappen.
        </p>
      </div>

      {/* Stap indicator */}
      <StapIndicator huidigStap={huidigStap} />

      {/* Formulier kaart — WS9-volgorde: specs → foto's → prijs → gegevens */}
      <Card className="shadow-sm border-border">
        <CardContent className="pt-6 pb-6">
          {huidigStap === 1 && (
            <StapGazonSpecs
              data={formData.specs}
              errors={errors}
              onChange={updateSpecs}
            />
          )}
          {huidigStap === 2 && <StapFotoUpload />}
          {huidigStap === 3 && (
            <StapPrijsoverzicht
              data={formData}
              onStartdatumChange={updateStartdatum}
            />
          )}
          {huidigStap === 4 && (
            <div className="space-y-6">
              <StapKlantgegevens
                data={formData.klant}
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

              {/* Akkoord voorwaarden */}
              <div
                className="flex items-start gap-3 p-4 rounded-lg border-2 border-border hover:border-primary/40 transition-colors cursor-pointer"
                onClick={() => setAkkoordVoorwaarden(!akkoordVoorwaarden)}
              >
                <div
                  className={cn(
                    "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 mt-0.5 transition-colors",
                    akkoordVoorwaarden
                      ? "bg-primary border-primary"
                      : "border-border bg-background"
                  )}
                >
                  {akkoordVoorwaarden && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />
                  )}
                </div>
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
            // --primary (loofgroen, L0.44) haalt ruim AA met witte tekst
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Volgende stap
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}

        {huidigStap === TOTAAL_STAPPEN && (
          <div /> /* Ruimte — verstuurknop zit in de gegevens-stap */
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
