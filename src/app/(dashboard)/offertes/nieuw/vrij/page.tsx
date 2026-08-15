"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNieuweVrijeOfferte } from "@/hooks/use-nieuwe-vrije-offerte";
import type { Id } from "../../../../../../convex/_generated/dataModel";

/**
 * Route 2 — vrije offerte. Dit was een tussenscherm waarin je eerst een klant
 * en een soort werk koos; sinds de klant optioneel is bij concept (masterplan
 * A3) is dat scherm overbodig. Wat overblijft is een doorgeefluik: de offerte
 * wordt meteen aangemaakt en je landt in de regel-editor, waar "Klant koppelen"
 * bovenin staat.
 *
 * Daarmee is meteen de `?klantId=`-bug weg: die parameter kwam hier binnen maar
 * werd nooit gelezen, dus vanuit een klantdossier raakte je de klant kwijt.
 *
 * Parameters: `?klantId=` (klant uit het dossier) en `?type=onderhoud` (TT-004;
 * standaard `aanleg` — eenmalig werk en maatwerk).
 */
export default function NieuweVrijeOffertePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { startVrijeOfferte, mislukt } = useNieuweVrijeOfferte();
  // Zonder deze vlag maakt Reacts dubbele effect-run in dev twee lege concepten.
  const gestart = useRef(false);

  const klantId = searchParams.get("klantId") ?? undefined;
  const type = searchParams.get("type") === "onderhoud" ? "onderhoud" : "aanleg";

  const start = useCallback(
    () =>
      startVrijeOfferte({
        klantId: klantId as Id<"klanten"> | undefined,
        type,
      }),
    [startVrijeOfferte, klantId, type]
  );

  useEffect(() => {
    if (gestart.current) return;
    gestart.current = true;
    void start();
  }, [start]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      {mislukt ? (
        <>
          <PenLine className="size-5 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">
            De offerte kon niet worden aangemaakt
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void start()}>
              Opnieuw proberen
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push("/offertes")}
            >
              Terug naar offertes
            </Button>
          </div>
        </>
      ) : (
        <p
          className="flex items-center gap-2 text-sm text-muted-foreground"
          role="status"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Lege offerte wordt aangemaakt…
        </p>
      )}
    </div>
  );
}
