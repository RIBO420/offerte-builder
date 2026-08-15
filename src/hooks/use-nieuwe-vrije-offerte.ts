"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { getMutationErrorMessage } from "@/lib/error-handling";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export interface VrijeOfferteOpties {
  /** Klant die al vaststaat (klantdossier, `?klantId=` in de URL). */
  klantId?: Id<"klanten">;
  /** TT-004: alleen `aanleg` of `onderhoud`. Standaard `aanleg` (maatwerk). */
  type?: "aanleg" | "onderhoud";
}

/**
 * "Vrije offerte" uit de entree-dropdown: één klik, en je staat in een leeg
 * document.
 *
 * Er zit bewust géén tussenscherm meer tussen de knop en de regel-editor. De
 * offerte wordt hier direct als concept aangemaakt en de gebruiker landt in
 * `/offertes/{id}/vrij`. Dat kan sinds de klant optioneel is bij concept
 * (convex/lib/offerteKlant.ts) — hij wordt weer hard vereist zodra de offerte
 * de conceptfase verlaat.
 *
 * Het offertenummer komt server-side uit `reserveerOfferteNummer`; nooit meer
 * client-side ophalen vóór de create (dat was een raceconditie).
 */
export function useNieuweVrijeOfferte() {
  const router = useRouter();
  const createOfferte = useMutation(api.offertes.create);
  const [bezig, setBezig] = useState(false);
  const [mislukt, setMislukt] = useState(false);
  // Dubbelklik of een tweede render mag geen tweede leeg concept opleveren.
  const loopt = useRef(false);

  const startVrijeOfferte = useCallback(
    async (opties?: VrijeOfferteOpties): Promise<string | null> => {
      if (loopt.current) return null;
      loopt.current = true;
      setBezig(true);
      setMislukt(false);

      const maak = (klantId?: Id<"klanten">) =>
        createOfferte({
          type: opties?.type ?? "aanleg",
          bron: "vrij",
          klantId,
          algemeenParams: { bereikbaarheid: "goed" },
        });

      try {
        let id: Id<"offertes">;
        try {
          id = await maak(opties?.klantId);
        } catch (fout) {
          // Een klant-id uit een URL is ongevalideerde invoer. Liever een lege
          // offerte dan een doodlopend foutscherm: opnieuw zonder klant, met
          // een eerlijke melding erbij.
          if (!opties?.klantId) throw fout;
          id = await maak(undefined);
          toast.warning("Klant uit de link niet gevonden", {
            description:
              "De offerte is zonder klant aangemaakt — koppel hem hieronder alsnog.",
          });
        }
        router.push(`/offertes/${id}/vrij`);
        return id;
      } catch (fout) {
        setMislukt(true);
        toast.error("Offerte aanmaken mislukt", {
          description: getMutationErrorMessage(fout),
        });
        return null;
      } finally {
        loopt.current = false;
        setBezig(false);
      }
    },
    [createOfferte, router]
  );

  return { startVrijeOfferte, bezig, mislukt };
}
