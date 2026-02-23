"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const CALENDLY_SCRIPT_URL = "https://assets.calendly.com/assets/external/widget.js";
const CALENDLY_CSS_URL = "https://assets.calendly.com/assets/external/widget.css";
const SCRIPT_ID = "calendly-widget-script";
const LINK_ID = "calendly-widget-css";

/**
 * Laadt het Calendly widget script en stylesheet dynamisch aan de client-side.
 *
 * Returns:
 *   isLoaded   – true zodra het script volledig is geladen
 *   openPopup  – opent de Calendly popup overlay voor de opgegeven URL
 */
export function useCalendlyEmbed() {
  const [isLoaded, setIsLoaded] = useState(false);
  const loadAttempted = useRef(false);

  useEffect(() => {
    // Voorkom dubbele initialisatie bij Strict Mode double-invoke
    if (loadAttempted.current) return;
    loadAttempted.current = true;

    // Voeg Calendly stylesheet toe als die nog niet aanwezig is
    if (!document.getElementById(LINK_ID)) {
      const link = document.createElement("link");
      link.id = LINK_ID;
      link.rel = "stylesheet";
      link.href = CALENDLY_CSS_URL;
      document.head.appendChild(link);
    }

    // Controleer of het script al is geladen
    const existingScript = document.getElementById(SCRIPT_ID);
    if (existingScript) {
      setIsLoaded(true);
      return;
    }

    // Laad het Calendly widget script asynchroon
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = CALENDLY_SCRIPT_URL;
    script.async = true;

    script.onload = () => setIsLoaded(true);
    script.onerror = () => {
      console.error("[useCalendlyEmbed] Calendly script kon niet worden geladen.");
    };

    document.body.appendChild(script);
  }, []);

  /**
   * Opent de Calendly popup overlay.
   * Het Calendly widget-object wordt pas beschikbaar nadat het script is geladen.
   */
  const openPopup = useCallback(
    (url: string) => {
      if (!isLoaded) {
        console.warn("[useCalendlyEmbed] Calendly is nog niet geladen.");
        return;
      }

      // Het Calendly widget-object wordt door het externe script op window gezet
      const calendlyWidget = (
        window as Window & {
          Calendly?: {
            initPopupWidget: (options: { url: string }) => void;
            initInlineWidget: (options: {
              url: string;
              parentElement: HTMLElement;
            }) => void;
          };
        }
      ).Calendly;

      if (!calendlyWidget) {
        console.warn("[useCalendlyEmbed] window.Calendly is niet beschikbaar.");
        return;
      }

      calendlyWidget.initPopupWidget({ url });
    },
    [isLoaded]
  );

  return { isLoaded, openPopup };
}
