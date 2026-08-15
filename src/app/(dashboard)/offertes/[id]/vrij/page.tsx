"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Save, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  VrijeRegelEditor,
  Overzichtsblok,
  TekstblokKiezer,
  type VrijeTeksten,
} from "@/components/offerte/vrije-builder";
import { KlantKoppelStrip } from "@/components/offerte/klant-koppel-strip";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import type { VrijeRegel } from "../../../../../../convex/vrijeOfferteBerekening";

/**
 * Regel-editor voor een vrije offerte (route 2, PRD §2.5b). Werkt op een
 * bestaand offerte-record; opslaan herberekent server-side en verhoogt de
 * gebruiksteller van nieuw gebruikte artikelen.
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
  const updateVrijeRegels = useMutation(api.vrijeOfferte.updateVrijeRegels);

  const [regels, setRegels] = useState<VrijeRegel[]>([]);
  const [teksten, setTeksten] = useState<VrijeTeksten>({});
  const [korting, setKorting] = useState(0);
  const [geladen, setGeladen] = useState(false);
  const [opslaan, setOpslaan] = useState(false);

  // Eénmalig initialiseren zodra de offerte binnen is
  useEffect(() => {
    if (offerte && !geladen) {
      setRegels(offerte.regels as VrijeRegel[]);
      setTeksten(offerte.vrijeTeksten ?? {});
      setKorting(offerte.kortingOpTotaal ?? 0);
      setGeladen(true);
    }
  }, [offerte, geladen]);

  // Wizard-offertes horen hier niet: terug naar de gewone bewerk-flow
  useEffect(() => {
    if (offerte && offerte.bron !== "vrij") {
      router.replace(`/offertes/${offerteId}`);
    }
  }, [offerte, offerteId, router]);

  if (offerte === undefined || !geladen) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (offerte === null) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Offerte niet gevonden.</p>
      </div>
    );
  }

  const vergrendeld = offerte.status === "geaccepteerd";

  const handleOpslaan = async () => {
    setOpslaan(true);
    try {
      await updateVrijeRegels({
        id: offerteId,
        regels: regels.map((r) => ({
          ...r,
          productId: r.productId as Id<"producten"> | undefined,
        })),
        vrijeTeksten:
          teksten.aanhef || teksten.voorwaarden ? teksten : undefined,
        kortingOpTotaal: korting > 0 ? korting : undefined,
        registreerGebruik: true,
      });
      toast.success("Offerte opgeslagen");
    } catch (e) {
      toast.error("Opslaan mislukt", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setOpslaan(false);
    }
  };

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
              : "Onderhoud"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Vrije builder</Badge>
          <Button asChild variant="outline" size="sm">
            <Link href={`/offertes/${offerteId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Naar offerte
            </Link>
          </Button>
          <Button
            size="sm"
            onClick={handleOpslaan}
            disabled={opslaan || vergrendeld}
          >
            {opslaan ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Opslaan
          </Button>
        </div>
      </div>

      <KlantKoppelStrip
        offerteId={offerteId}
        klant={offerte.klant}
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
