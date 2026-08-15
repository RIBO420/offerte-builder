"use client";

/**
 * `/offertes/[id]/bewerken` — de wissel naar de juiste editor.
 *
 * Er leefden drie editors naast elkaar (eindschouw S1): het werkblad voor
 * nieuwe offertes, de vrije regel-editor, en op deze route nog de oude
 * regel-editor uit de wizardtijd. Die laatste is weg. Wat er nu gebeurt:
 *
 * | bron              | status                  | editor                        |
 * |-------------------|-------------------------|-------------------------------|
 * | wizard (+sjabloon)| concept, voorcalculatie | het werkblad, hier            |
 * | wizard            | verzonden/getekend/afgew| geen — terug naar de offerte  |
 * | vrij              | elke status             | `/offertes/[id]/vrij`         |
 *
 * De statusgrens volgt `offertes.koppelKlant`: wijzigen mag zolang de offerte
 * niet naar de klant is gegaan. Een verzonden of getekende offerte in een
 * autosave-werkblad openen zou stilzwijgend het document wijzigen dat de klant
 * al heeft gezien.
 */

import { Suspense, use, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Werkbank } from "@/components/offerte/werkbank";
import { WerkbankSkelet } from "@/components/offerte/werkbank/werkbank-skelet";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";

/** Statussen waarin de offerte nog van jou is en niet van de klant. */
const BEWERKBARE_STATUSSEN = ["concept", "voorcalculatie"];

export default function OfferteBewerkenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const offerteId = id as Id<"offertes">;
  const router = useRouter();

  const offerte = useQuery(api.offertes.get, { id: offerteId });

  const isVrij = offerte?.bron === "vrij";
  const isBewerkbaar = offerte
    ? BEWERKBARE_STATUSSEN.includes(offerte.status)
    : true;

  useEffect(() => {
    if (!offerte) return;
    if (isVrij) {
      router.replace(`/offertes/${offerteId}/vrij`);
      return;
    }
    if (!isBewerkbaar) {
      toast.info("Deze offerte is niet meer te bewerken", {
        description:
          "Zet hem eerst terug naar voorcalculatie via Status wijzigen; daarna staat het werkblad weer open.",
      });
      router.replace(`/offertes/${offerteId}`);
    }
  }, [offerte, isVrij, isBewerkbaar, offerteId, router]);

  if (offerte === undefined) return <WerkbankSkelet />;

  if (offerte === null) {
    return (
      <>
        <PageHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
          <p className="text-muted-foreground">Offerte niet gevonden</p>
          <Button asChild>
            <Link href="/offertes">Terug naar offertes</Link>
          </Button>
        </div>
      </>
    );
  }

  // Tijdens het omleiden hetzelfde silhouet, zodat er niets knippert.
  if (isVrij || !isBewerkbaar) return <WerkbankSkelet />;

  return (
    <Suspense fallback={<WerkbankSkelet />}>
      <Werkbank type={offerte.type} offerteId={offerteId} />
    </Suspense>
  );
}
