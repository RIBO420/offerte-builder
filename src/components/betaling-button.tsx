"use client";

import { useState, useCallback } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStartMollieBetaling } from "@/hooks/use-betalingen";
import type { BetalingType } from "@/hooks/use-betalingen";

// ============================================
// TYPES
// ============================================

export interface BetalingButtonProps {
  bedrag: number;
  beschrijving: string;
  referentie: string;
  klantNaam: string;
  klantEmail: string;
  type: BetalingType;
  /** Optionele redirect URL na betaling. Standaard: /betalingen/bedankt */
  redirectUrl?: string;
  /** Optionele extra metadata voor Mollie */
  metadata?: Record<string, string>;
  /** Wordt aangeroepen nadat de betaling succesvol is aangemaakt en de klant doorgestuurd is */
  onSuccess?: () => void;
  /** Wordt aangeroepen wanneer er een fout optreedt */
  onError?: (error: string) => void;
  /** Open Mollie checkout in een nieuw venster (standaard: false = redirect in hetzelfde venster) */
  openInNieuwVenster?: boolean;
  /** Extra CSS klassen */
  className?: string;
  /** Maak de knop uitgeschakeld */
  disabled?: boolean;
}

// ============================================
// HELPERS
// ============================================

/**
 * Formatteer een bedrag als euro-string, bijv. 150 → "€150,00"
 */
function formateerBedrag(bedrag: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(bedrag);
}

// ============================================
// COMPONENT
// ============================================

/**
 * BetalingButton — Herbruikbare betaalknop voor Mollie betalingen
 *
 * Gebruik:
 * ```tsx
 * <BetalingButton
 *   bedrag={500}
 *   beschrijving="Aanbetaling offerte OFF-2024-001"
 *   referentie="OFF-2024-001"
 *   klantNaam="Jan Jansen"
 *   klantEmail="jan@voorbeeld.nl"
 *   type="aanbetaling"
 *   onSuccess={() => toast.success("Betaling gestart!")}
 *   onError={(err) => toast.error(err)}
 * />
 * ```
 */
export function BetalingButton({
  bedrag,
  beschrijving,
  referentie,
  klantNaam,
  klantEmail,
  type,
  redirectUrl,
  metadata,
  onSuccess,
  onError,
  openInNieuwVenster = false,
  className,
  disabled = false,
}: BetalingButtonProps) {
  const { startBetaling, isLoading: isBetalingBezig } =
    useStartMollieBetaling();
  const [lokaalLaden, setLokaalLaden] = useState(false);

  const isBezig = isBetalingBezig || lokaalLaden;

  const handleKlik = useCallback(async () => {
    if (isBezig || disabled) return;

    setLokaalLaden(true);

    try {
      const resultaat = await startBetaling({
        bedrag,
        beschrijving,
        referentie,
        klantNaam,
        klantEmail,
        type,
        redirectUrl,
        metadata,
      });

      // Stuur de klant door naar de Mollie checkout pagina
      if (resultaat.checkoutUrl) {
        if (openInNieuwVenster) {
          window.open(resultaat.checkoutUrl, "_blank", "noopener,noreferrer");
        } else {
          window.location.href = resultaat.checkoutUrl;
        }
      }

      onSuccess?.();
    } catch (err) {
      const foutmelding =
        err instanceof Error ? err.message : "Fout bij starten van betaling";
      onError?.(foutmelding);
    } finally {
      setLokaalLaden(false);
    }
  }, [
    isBezig,
    disabled,
    startBetaling,
    bedrag,
    beschrijving,
    referentie,
    klantNaam,
    klantEmail,
    type,
    redirectUrl,
    metadata,
    openInNieuwVenster,
    onSuccess,
    onError,
  ]);

  return (
    <Button
      onClick={handleKlik}
      disabled={isBezig || disabled}
      className={cn(
        "gap-2 font-medium",
        isBezig && "cursor-wait opacity-80",
        className
      )}
    >
      {isBezig ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Betaling starten...</span>
        </>
      ) : (
        <>
          <CreditCard className="h-4 w-4" />
          <span>Betaal {formateerBedrag(bedrag)}</span>
        </>
      )}
    </Button>
  );
}
