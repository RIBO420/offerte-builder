"use client";

import * as React from "react";
import { CalendarIcon, ExternalLinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCalendlyEmbed } from "@/hooks/use-calendly";
import {
  CALENDLY_EVENT_LABELS,
  getCalendlyUrl,
  type GetCalendlyUrlOptions,
} from "@/lib/calendly";
import { cn } from "@/lib/utils";

export interface CalendlyEmbedProps {
  eventType: keyof typeof CALENDLY_EVENT_LABELS;
  klantNaam?: string;
  klantEmail?: string;
  klantTelefoon?: string;
  /** Weergavemodus: ingesloten widget, popup overlay of een knop die popup opent */
  mode: "inline" | "popup" | "button";
  /** Knoptekst in button- en popup-modus. Standaard: "Plan een afspraak" */
  buttonText?: string;
  className?: string;
}

/**
 * Calendly embed component
 *
 * Drie weergavemodi:
 *   inline  – Calendly widget ingesloten in de pagina (minimaal 600px hoog)
 *   popup   – knop die een Calendly popup overlay opent
 *   button  – shadcn/ui-knop die dezelfde popup opent (alias voor popup)
 *
 * Klantgegevens worden automatisch vooringevuld in de Calendly URL.
 * Fallback: directe link als het script niet beschikbaar is.
 */
export function CalendlyEmbed({
  eventType,
  klantNaam,
  klantEmail,
  klantTelefoon,
  mode,
  buttonText = "Plan een afspraak",
  className,
}: CalendlyEmbedProps) {
  const { isLoaded, openPopup } = useCalendlyEmbed();
  const inlineContainerRef = React.useRef<HTMLDivElement>(null);
  const inlineInitialized = React.useRef(false);

  const urlOptions: GetCalendlyUrlOptions = {
    eventType,
    naam: klantNaam,
    email: klantEmail,
    telefoon: klantTelefoon,
  };
  const calendlyUrl = getCalendlyUrl(urlOptions);

  // Initialiseer de inline widget zodra het script is geladen
  React.useEffect(() => {
    if (mode !== "inline") return;
    if (!isLoaded) return;
    if (inlineInitialized.current) return;
    if (!inlineContainerRef.current) return;

    const calendlyWidget = (
      window as Window & {
        Calendly?: {
          initInlineWidget: (options: {
            url: string;
            parentElement: HTMLElement;
          }) => void;
        };
      }
    ).Calendly;

    if (!calendlyWidget) return;

    inlineInitialized.current = true;
    calendlyWidget.initInlineWidget({
      url: calendlyUrl,
      parentElement: inlineContainerRef.current,
    });
  }, [isLoaded, mode, calendlyUrl]);

  // ── Fallback: directe link als het script niet beschikbaar is ──────────────
  const fallbackLink = (
    <a
      href={calendlyUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
    >
      <ExternalLinkIcon className="size-3.5" />
      Open de afspraakpagina
    </a>
  );

  // ── Inline modus ───────────────────────────────────────────────────────────
  if (mode === "inline") {
    return (
      <div className={cn("w-full", className)}>
        {/* Loading skeleton zolang script nog laadt */}
        {!isLoaded && (
          <div className="flex min-h-[600px] flex-col gap-3 rounded-lg border bg-muted/30 p-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
            <div className="mt-4 grid grid-cols-3 gap-3">
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </div>
            <Skeleton className="mt-2 h-40 rounded-lg" />
            <div className="mt-auto pt-4">{fallbackLink}</div>
          </div>
        )}

        {/* Container voor de Calendly inline widget */}
        <div
          ref={inlineContainerRef}
          className={cn(
            "min-h-[600px] w-full rounded-lg",
            !isLoaded && "hidden"
          )}
          aria-label={`Afspraak plannen: ${CALENDLY_EVENT_LABELS[eventType]}`}
        />
      </div>
    );
  }

  // ── Popup / button modus ───────────────────────────────────────────────────
  const handleOpenPopup = () => {
    if (isLoaded) {
      openPopup(calendlyUrl);
    } else {
      // Fallback: open Calendly direct in een nieuw tabblad
      window.open(calendlyUrl, "_blank", "noopener,noreferrer");
    }
  };

  if (mode === "popup" || mode === "button") {
    return (
      <div className={cn("inline-flex flex-col items-start gap-1", className)}>
        <Button
          type="button"
          onClick={handleOpenPopup}
          disabled={false} // altijd klikbaar dankzij fallback
          aria-label={`${buttonText} — ${CALENDLY_EVENT_LABELS[eventType]}`}
        >
          <CalendarIcon />
          {buttonText}
        </Button>

        {/* Toon subtekst met het event-type */}
        <span className="pl-1 text-xs text-muted-foreground">
          {CALENDLY_EVENT_LABELS[eventType]}
        </span>
      </div>
    );
  }

  // TypeScript exhaustiveness check
  return null;
}
