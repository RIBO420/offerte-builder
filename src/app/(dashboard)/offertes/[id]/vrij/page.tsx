"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Save, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LaadIndicator } from "@/components/ui";
import { useAutoSave } from "@/hooks/use-auto-save";
import {
  VrijeRegelEditor,
  Overzichtsblok,
  TekstblokKiezer,
  type VrijeTeksten,
} from "@/components/offerte/vrije-builder";
import { KlantKoppeling } from "@/components/offerte/klant-koppeling";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import type { VrijeRegel } from "../../../../../../convex/vrijeOfferteBerekening";

type OfferteDoc = NonNullable<
  ReturnType<typeof useQuery<typeof api.offertes.get>>
>;

/**
 * Regel-editor voor een vrije offerte (route 2, PRD §2.5b). Werkt op een
 * bestaand offerte-record; opslaan herberekent server-side en verhoogt de
 * gebruiksteller van nieuw gebruikte artikelen.
 *
 * Deze buitenlaag doet alleen het laden. De editor eronder mount pas als de
 * offerte binnen is, zodat `useAutoSave` de opgeslagen regels als nulmeting
 * krijgt en niet meteen een lege lijst als "wijziging" ziet.
 */
export default function VrijeOfferteEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const offerteId = id as Id<"offertes">;
  const router = useRouter();

  const offerte = useQuery(api.offertes.get, { id: offerteId });

  // Wizard-offertes horen hier niet: terug naar de gewone bewerk-flow
  useEffect(() => {
    if (offerte && offerte.bron !== "vrij") {
      router.replace(`/offertes/${offerteId}`);
    }
  }, [offerte, offerteId, router]);

  if (offerte === undefined) {
    return <LaadIndicator formaat="pagina" tekst="Offerte laden…" />;
  }
  if (offerte === null) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Offerte niet gevonden.</p>
      </div>
    );
  }

  // `key`: een andere offerte is een andere editor, met een eigen nulmeting.
  return (
    <VrijeOfferteEditor
      key={offerteId}
      offerteId={offerteId}
      offerte={offerte}
    />
  );
}

function VrijeOfferteEditor({
  offerteId,
  offerte,
}: {
  offerteId: Id<"offertes">;
  offerte: OfferteDoc;
}) {
  const router = useRouter();
  const updateVrijeRegels = useMutation(api.vrijeOfferte.updateVrijeRegels);

  // Nulmeting uit het record; verdere updates komen van de editor zelf, zodat
  // typen niet wordt overschreven door een binnenkomende query-update.
  const [regels, setRegels] = useState<VrijeRegel[]>(
    () => offerte.regels as VrijeRegel[]
  );
  const [teksten, setTeksten] = useState<VrijeTeksten>(
    () => offerte.vrijeTeksten ?? {}
  );
  const [korting, setKorting] = useState(() => offerte.kortingOpTotaal ?? 0);
  const [navigeert, setNavigeert] = useState(false);

  const vergrendeld = offerte.status === "geaccepteerd";

  const opslaanData = useMemo(
    () => ({ regels, teksten, korting }),
    [regels, teksten, korting]
  );

  // `saveNow()` slikt fouten in (de hook vangt ze op), dus onthouden we hier of
  // de laatste poging lukte: bij een mislukte opslag mag je niet wegnavigeren.
  const laatsteOpslagMislukt = useRef(false);

  const bewaar = useCallback(
    async (data: typeof opslaanData) => {
      try {
        await updateVrijeRegels({
          id: offerteId,
          regels: data.regels.map((r) => ({
            ...r,
            productId: r.productId as Id<"producten"> | undefined,
          })),
          vrijeTeksten:
            data.teksten.aanhef || data.teksten.voorwaarden
              ? data.teksten
              : undefined,
          kortingOpTotaal: data.korting > 0 ? data.korting : undefined,
          registreerGebruik: true,
        });
        laatsteOpslagMislukt.current = false;
      } catch (e) {
        laatsteOpslagMislukt.current = true;
        toast.error("Opslaan mislukt", {
          description: e instanceof Error ? e.message : undefined,
        });
        // Doorgooien: de hook houdt de offerte dan "vuil", zodat het werk niet
        // stilzwijgend als bewaard geldt.
        throw e;
      }
    },
    [offerteId, updateVrijeRegels]
  );

  // Automatisch bewaren, net als de werkbank: wie hier werkt hoort niets kwijt
  // te raken door een klik naast de Opslaan-knop.
  const { isSaving, isDirty, saveNow } = useAutoSave({
    data: opslaanData,
    onSave: bewaar,
    debounceMs: 2000,
    enabled: !vergrendeld,
  });

  const handleOpslaan = useCallback(async () => {
    await saveNow();
    if (!laatsteOpslagMislukt.current) toast.success("Offerte opgeslagen");
  }, [saveNow]);

  /**
   * B1: "Naar offerte" gooide onbewaard werk weg (een `<Link>` navigeerde
   * meteen). Nu eerst bewaren bij openstaande wijzigingen — zelfde volgorde als
   * `handleComplete` op de voorcalculatie-pagina — en alleen navigeren als dat
   * lukte.
   */
  const handleNaarOfferte = useCallback(async () => {
    setNavigeert(true);
    try {
      if (!vergrendeld && (isDirty || isSaving)) {
        await saveNow();
        if (laatsteOpslagMislukt.current) return;
      }
      router.push(`/offertes/${offerteId}`);
    } finally {
      setNavigeert(false);
    }
  }, [vergrendeld, isDirty, isSaving, saveNow, router, offerteId]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Vrije offerte {offerte.offerteNummer}
          </h1>
          {/* De klant staat in de koppelstrip hieronder — één plek, en daar is
              hij ook te wijzigen. Hier het soort werk, dat ná aanmaken vastligt. */}
          <p className="text-muted-foreground">
            {offerte.type === "aanleg"
              ? "Aanleg — eenmalig werk of maatwerk"
              : "Onderhoud — terugkerend werk"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Vrije builder</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNaarOfferte}
            disabled={navigeert}
          >
            {navigeert ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowLeft className="mr-2 h-4 w-4" />
            )}
            Naar offerte
          </Button>
          <Button
            size="sm"
            onClick={handleOpslaan}
            disabled={isSaving || vergrendeld}
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Opslaan
          </Button>
        </div>
      </div>

      <KlantKoppeling
        weergave="strip"
        offerteId={offerteId}
        klant={offerte.klant}
        klantId={offerte.klantId}
        status={offerte.status}
      />

      {vergrendeld && (
        <p className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
          <Lock className="h-4 w-4 shrink-0" />
          Deze offerte is geaccepteerd en vergrendeld; wijzigingen zijn niet
          mogelijk.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <VrijeRegelEditor regels={regels} onChange={setRegels} />
          <TekstblokKiezer waarde={teksten} onChange={setTeksten} />
        </div>
        <Overzichtsblok
          regels={regels}
          kortingOpTotaal={korting}
          onKortingOpTotaalChange={setKorting}
        />
      </div>
    </div>
  );
}
