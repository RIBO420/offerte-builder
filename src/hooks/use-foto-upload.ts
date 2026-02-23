"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

// ============================================
// Types
// ============================================

export interface FotoUploadVoortgang {
  /** Unieke bestandsnaam voor identificatie tijdens upload */
  bestandsnaam: string;
  /** Uploadstatus */
  status: "wachtend" | "bezig" | "voltooid" | "fout";
  /** Voortgangspercentage (0–100) */
  voortgang: number;
  /** Foutmelding indien van toepassing */
  fout?: string;
  /** Storage ID na succesvolle upload */
  storageId?: Id<"_storage">;
}

export interface FotoUploadResultaat {
  storageId: Id<"_storage">;
  bestandsnaam: string;
}

// ============================================
// Constanten
// ============================================

const MAX_BESTAND_GROOTTE_BYTES = 10 * 1024 * 1024; // 10 MB
const TOEGESTANE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];

// ============================================
// Validatie helpers
// ============================================

function valideerBestand(bestand: File): string | null {
  if (!TOEGESTANE_MIME_TYPES.includes(bestand.type)) {
    return `Bestandstype "${bestand.type}" is niet toegestaan. Alleen afbeeldingen zijn toegestaan.`;
  }
  if (bestand.size > MAX_BESTAND_GROOTTE_BYTES) {
    const grootteInMb = (bestand.size / (1024 * 1024)).toFixed(1);
    return `Bestand is te groot (${grootteInMb} MB). Maximale bestandsgrootte is 10 MB.`;
  }
  return null;
}

// ============================================
// useFotoUpload hook
// ============================================

/**
 * Hook voor het uploaden van foto's naar Convex file storage.
 * Beheert upload-voortgang, foutafhandeling en meerdere foto's tegelijkertijd.
 *
 * Gebruik:
 * ```tsx
 * const { uploadFotos, fotos, verwijderFoto, isBezig, fout } = useFotoUpload();
 * ```
 */
export function useFotoUpload() {
  const generateUploadUrl = useMutation(api.fotoStorage.generateUploadUrl);

  const [voortgangen, setVoortgangen] = useState<FotoUploadVoortgang[]>([]);
  const [fout, setFout] = useState<string | null>(null);

  /**
   * Update de voortgang van een specifiek bestand.
   */
  const updateVoortgang = useCallback(
    (bestandsnaam: string, update: Partial<FotoUploadVoortgang>) => {
      setVoortgangen((huidig) =>
        huidig.map((v) =>
          v.bestandsnaam === bestandsnaam ? { ...v, ...update } : v
        )
      );
    },
    []
  );

  /**
   * Upload één bestand naar Convex file storage.
   * Geeft het storage ID terug bij succes.
   */
  const uploadEnkelBestand = useCallback(
    async (bestand: File): Promise<Id<"_storage"> | null> => {
      const validatieFout = valideerBestand(bestand);
      if (validatieFout) {
        updateVoortgang(bestand.name, { status: "fout", fout: validatieFout });
        return null;
      }

      try {
        updateVoortgang(bestand.name, { status: "bezig", voortgang: 10 });

        // Stap 1: Haal een upload URL op van Convex
        const uploadUrl = await generateUploadUrl();

        updateVoortgang(bestand.name, { voortgang: 30 });

        // Stap 2: Upload het bestand direct naar de Convex storage URL
        const uploadReactie = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": bestand.type,
          },
          body: bestand,
        });

        updateVoortgang(bestand.name, { voortgang: 80 });

        if (!uploadReactie.ok) {
          throw new Error(
            `Upload mislukt met statuscode ${uploadReactie.status}`
          );
        }

        const { storageId } = (await uploadReactie.json()) as {
          storageId: Id<"_storage">;
        };

        updateVoortgang(bestand.name, {
          status: "voltooid",
          voortgang: 100,
          storageId,
        });

        return storageId;
      } catch (err) {
        const foutBericht =
          err instanceof Error ? err.message : "Upload mislukt";
        updateVoortgang(bestand.name, { status: "fout", fout: foutBericht });
        return null;
      }
    },
    [generateUploadUrl, updateVoortgang]
  );

  /**
   * Upload meerdere bestanden. Bestanden worden parallel geüpload.
   * Geeft een array van succesvolle storage IDs terug.
   */
  const uploadFotos = useCallback(
    async (
      bestanden: File[],
      maxFotos: number = 5
    ): Promise<FotoUploadResultaat[]> => {
      setFout(null);

      if (bestanden.length === 0) return [];

      // Voeg bestanden toe aan de voortgangslijst
      const nieuweVoortgangen: FotoUploadVoortgang[] = bestanden.map(
        (bestand) => ({
          bestandsnaam: bestand.name,
          status: "wachtend" as const,
          voortgang: 0,
        })
      );

      setVoortgangen((huidig) => {
        const huidigAantal = huidig.filter(
          (v) => v.status === "voltooid"
        ).length;
        const beschikbaarSlots = maxFotos - huidigAantal;

        if (beschikbaarSlots <= 0) {
          setFout(`Maximaal ${maxFotos} foto's toegestaan.`);
          return huidig;
        }

        return [
          ...huidig,
          ...nieuweVoortgangen.slice(0, beschikbaarSlots),
        ];
      });

      // Upload alle bestanden parallel
      const resultaten = await Promise.all(
        bestanden.map(async (bestand): Promise<FotoUploadResultaat | null> => {
          const storageId = await uploadEnkelBestand(bestand);
          if (!storageId) return null;
          return { storageId, bestandsnaam: bestand.name };
        })
      );

      return resultaten.filter(
        (r): r is FotoUploadResultaat => r !== null
      );
    },
    [uploadEnkelBestand]
  );

  /**
   * Verwijder een foto uit de lokale voortgangslijst.
   * Dit verwijdert het bestand NIET uit de storage — gebruik daarvoor de
   * `removeFotoFromAanvraag` mutation op de server.
   */
  const verwijderFotoUitLijst = useCallback((bestandsnaam: string) => {
    setVoortgangen((huidig) =>
      huidig.filter((v) => v.bestandsnaam !== bestandsnaam)
    );
  }, []);

  /**
   * Reset alle voortgangen en de foutmelding.
   */
  const reset = useCallback(() => {
    setVoortgangen([]);
    setFout(null);
  }, []);

  const isBezig = voortgangen.some((v) => v.status === "bezig");
  const voltooideFotos = voortgangen.filter((v) => v.status === "voltooid");
  const storageIds = voltooideFotos
    .map((v) => v.storageId)
    .filter((id): id is Id<"_storage"> => id !== undefined);

  return {
    uploadFotos,
    verwijderFotoUitLijst,
    reset,
    voortgangen,
    storageIds,
    isBezig,
    fout,
  };
}

// ============================================
// useFotoUrls hook
// ============================================

/**
 * Hook die publieke download URLs ophaalt voor een array van storage IDs.
 * Geeft een map terug van storageId → URL.
 *
 * Gebruik:
 * ```tsx
 * const { urls, isLoading } = useFotoUrls(storageIds);
 * ```
 */
export function useFotoUrls(storageIds: Id<"_storage">[]): {
  urls: Map<string, string>;
  isLoading: boolean;
} {
  const resultaten = useQuery(
    api.fotoStorage.getUrls,
    storageIds.length > 0 ? { storageIds } : "skip"
  );

  const urls = new Map<string, string>();
  if (resultaten) {
    for (const { storageId, url } of resultaten) {
      if (url) {
        urls.set(storageId, url);
      }
    }
  }

  return {
    urls,
    isLoading: storageIds.length > 0 && resultaten === undefined,
  };
}
